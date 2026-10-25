package com.hhrcore.fileexplorer.operation

import android.util.Log
import android.webkit.MimeTypeMap
import com.hhrcore.fileexplorer.thumbnail.ThumbnailCache
import com.hhrcore.fileexplorer.thumbnail.ThumbnailSnapshot
import android.system.ErrnoException
import android.system.Os
import android.system.OsConstants
import okhttp3.Call
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.Request
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import okio.BufferedSink
import org.apache.commons.compress.archivers.ArchiveInputStream
import org.apache.commons.compress.archivers.ArchiveStreamFactory
import org.apache.commons.compress.archivers.sevenz.SevenZFile
import org.apache.commons.compress.compressors.CompressorStreamFactory
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedInputStream
import java.io.File
import java.io.InputStream
import java.io.RandomAccessFile
import java.net.URLEncoder
import java.nio.charset.StandardCharsets
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference
import java.util.UUID

class FileOperationEngine(
    store: OperationStore,
    onChange: (FileOperationRecord) -> Unit,
    thumbnailCache: ThumbnailCache,
    remoteTransferClient: RemoteTransferClient
) {
    private val store: OperationStore
    private val onChange: (FileOperationRecord) -> Unit
    private val thumbnailCache: ThumbnailCache
    private val remoteTransferClient: RemoteTransferClient
    private val calls = ConcurrentHashMap<String, MutableSet<Call>>()
    private val cancelled = ConcurrentHashMap.newKeySet<String>()
    private val committing = ConcurrentHashMap.newKeySet<String>()
    private val cancellationLock = Any()
    private val lastProgressAt = ConcurrentHashMap<String, Long>()

    init {
        this.store = store
        this.onChange = onChange
        this.thumbnailCache = thumbnailCache
        this.remoteTransferClient = remoteTransferClient
    }

    fun execute(record: FileOperationRecord, accessToken: String?) {
        try {
            LocalPathLocks.acquire(record.id, localClaims(record)) { checkCancelled(record.id) }
            record.status = FileOperationRecord.STATUS_RUNNING
            persist(record)
            when (record.operation) {
                FileOperationRecord.OPERATION_UPLOAD -> upload(record, requireToken(accessToken))
                FileOperationRecord.OPERATION_DOWNLOAD -> download(record, requireToken(accessToken))
                FileOperationRecord.OPERATION_REMOTE_MKDIR, FileOperationRecord.OPERATION_REMOTE_RENAME -> remoteDirectoryChange(record, requireToken(accessToken))
                FileOperationRecord.OPERATION_REMOTE_MOVE -> remoteMove(record, requireToken(accessToken))
                FileOperationRecord.OPERATION_REMOTE_DELETE -> remoteDelete(record, requireToken(accessToken))
                FileOperationRecord.OPERATION_LOCAL_MKDIR -> AtomicFiles.reserve(File(record.request.getString("destination")), record.request.getString("name"), true, record.id)
                FileOperationRecord.OPERATION_LOCAL_RENAME -> {
                    val source = File(record.request.getString("source"))
                    val snapshot = thumbnailCache.snapshot(source)
                    val target = AtomicFiles.rename(
                        source,
                        source.parentFile ?: throw IllegalArgumentException("Ruta no válida"),
                        record.request.getString("name"),
                        record.id
                    )
                    thumbnailCache.move(snapshot, source, target)
                }
                FileOperationRecord.OPERATION_LOCAL_COPY -> localCopyMove(record, false)
                FileOperationRecord.OPERATION_LOCAL_MOVE -> localCopyMove(record, true)
                FileOperationRecord.OPERATION_LOCAL_DELETE -> localDelete(record)
                FileOperationRecord.OPERATION_LOCAL_EXTRACT -> localExtract(record)
                else -> throw IllegalArgumentException("Operación de archivos no válida")
            }
            checkCancelled(record.id)
            record.status = FileOperationRecord.STATUS_COMPLETED
            val moveCommitStarted = record.moveCommitStarted
            record.moveCommitStarted = false
            try {
                persist(record)
            } catch (error: Throwable) {
                record.moveCommitStarted = moveCommitStarted
                throw error
            }
        } catch (error: Throwable) {
            Log.e(LOG_TAG, "File operation ${record.id} (${record.operation}) failed", error)
            record.status = if (cancelled.contains(record.id)) FileOperationRecord.STATUS_CANCELLED else FileOperationRecord.STATUS_FAILED
            record.error = (error as? ApiException)?.apiError
            rollback(record, accessToken)
            persist(record)
        } finally {
            calls.remove(record.id)
            cancelled.remove(record.id)
            committing.remove(record.id)
            lastProgressAt.remove(record.id)
            LocalPathLocks.release(record.id)
        }
    }

    fun cancel(id: String) {
        val record = store.get(id) ?: return
        synchronized(cancellationLock) {
            if (!FileOperationRecord.isCancellable(record.operation) || committing.contains(id)) return
            cancelled.add(id)
            calls[id]?.forEach(Call::cancel)
        }
    }

    fun reconcile(record: FileOperationRecord) {
        val paths = record.createdPaths + record.ownedIdentities.keys().asSequence().toList() + listOfNotNull(record.pendingStagePath)
        val claims = localClaims(record) + paths.map { LocalPathLocks.claim(File(it), true) }
        LocalPathLocks.acquire(record.id, claims)
        try {
            reconcileLocked(record)
        } finally {
            LocalPathLocks.release(record.id)
        }
    }

    private fun reconcileLocked(record: FileOperationRecord) {
        if (record.status in setOf(FileOperationRecord.STATUS_PENDING, FileOperationRecord.STATUS_RUNNING)) {
            record.status = FileOperationRecord.STATUS_INTERRUPTED
        }
        record.error = null
        if (!cleanupPendingStage(record)) {
            record.cleanupPending = true
            persist(record)
            return
        }
        if (record.operation == FileOperationRecord.OPERATION_LOCAL_MOVE && record.moveCommitStarted) {
            rollbackMove(record)
        } else if (record.operation == FileOperationRecord.OPERATION_DOWNLOAD ||
            record.operation == FileOperationRecord.OPERATION_LOCAL_COPY ||
            record.operation == FileOperationRecord.OPERATION_LOCAL_MOVE ||
            record.operation == FileOperationRecord.OPERATION_LOCAL_EXTRACT
        ) {
            cleanupLocal(record)
            reconcileThumbnailDestination(record)
        } else if (record.operation == FileOperationRecord.OPERATION_UPLOAD) {
            record.apiSessionId = null
        }
        persist(record)
    }

    private fun upload(record: FileOperationRecord, token: String) {
        val request = record.request
        val entries = uploadEntries(request.getJSONArray("entries"))
        record.totalBytes = (0 until entries.length()).sumOf { entries.getJSONObject(it).optLong("size") }
        persist(record)
        val session = executeJson(record, token, "POST", "${request.getString("apiUrl")}/ftp/uploads", JSONObject().apply {
            request.optString("remoteDir").takeIf { it.isNotEmpty() }?.let { put("dir", it) }
            put("entries", JSONArray().apply {
                for (index in 0 until entries.length()) {
                    val entry = entries.getJSONObject(index)
                    put(JSONObject().apply {
                        put("path", entry.getString("path"))
                        put("type", entry.getString("type"))
                        if (entry.has("size")) put("size", entry.getLong("size"))
                    })
                }
            })
        })
        record.apiSessionId = session.getString("id")
        persist(record)
        val resolvedEntries = session.getJSONArray("entries")
        val files = buildList {
            for (index in 0 until entries.length()) {
                val entry = entries.getJSONObject(index)
                if (entry.getString("type") == "FILE") {
                    add(entry to safeRelativePath(resolvedEntries.getJSONObject(index).getString("path")))
                }
            }
        }
        executeTransfers(record, files, MAX_UPLOAD_CONCURRENCY) { (entry, remotePath) -> uploadFile(record, token, entry, remotePath) }
        record.result = completeUpload(record, token)
        record.apiSessionId = null
    }

    private fun uploadEntries(selectedEntries: JSONArray): JSONArray {
        return JSONArray().apply {
            for (index in 0 until selectedEntries.length()) {
                val selected = selectedEntries.getJSONObject(index)
                val source = File(selected.getString("path"))
                if (!source.exists()) throw IllegalArgumentException("No existe ${source.path}")
                appendUploadEntries(this, source, source.name, selected.getString("type"))
            }
        }
    }

    private fun appendUploadEntries(entries: JSONArray, source: File, remotePath: String, type: String) {
        if (type.equals("file", true)) {
            entries.put(JSONObject().apply {
                put("path", remotePath)
                put("type", "FILE")
                put("size", source.length())
                put("localPath", source.absolutePath)
                put("mimeType", MimeTypeMap.getSingleton().getMimeTypeFromExtension(source.extension.lowercase()) ?: "application/octet-stream")
            })
            return
        }

        entries.put(JSONObject().put("path", remotePath).put("type", "DIR"))
        source.listFiles()?.sortedBy(File::getName)?.forEach { entry ->
            appendUploadEntries(entries, entry, "$remotePath/${entry.name}", if (entry.isDirectory) "dir" else "file")
        }
    }

    private fun uploadFile(record: FileOperationRecord, token: String, entry: JSONObject, remotePath: String) {
        val file = File(entry.getString("localPath"))
        val size = entry.getLong("size")
        synchronized(record) {
            record.currentFileName = file.name
            persist(record)
        }
        var offset = 0L
        do {
            checkCancelled(record.id)
            val length = minOf(CHUNK_SIZE, size - offset)
            var sentBefore = 0L
            val body = MultipartBody.Builder().setType(MultipartBody.FORM).addFormDataPart(
                "file", File(remotePath).name,
                FileSliceRequestBody(file, offset, length, entry.optString("mimeType", "application/octet-stream")) { sent ->
                    val delta = sent - sentBefore
                    sentBefore = sent
                    addTransferredBytes(record, delta)
                }
            ).build()
            val url = "${record.request.getString("apiUrl")}/ftp/uploads/${encode(record.apiSessionId!!)}/entries" +
                "?path=${encode(remotePath)}&offset=$offset"
            val nextOffset = JSONObject(execute(record, token, Request.Builder().url(url).put(body).build())).getLong("nextOffset")
            if (nextOffset != offset + length) throw IllegalStateException("Offset de subida no válido")
            addTransferredBytes(record, length - sentBefore)
            offset = nextOffset
            synchronized(record) {
                persist(record)
            }
        } while (offset < size)
    }

    private fun download(record: FileOperationRecord, token: String) {
        val request = record.request
        val session = executeJson(record, token, "POST", "${request.getString("apiUrl")}/ftp/downloads", JSONObject().apply {
            request.optString("remoteDir").takeIf { it.isNotEmpty() }?.let { put("dir", it) }
            put("entries", request.getJSONArray("entries"))
        })
        record.apiSessionId = session.getString("id")
        persist(record)
        val entries = session.getJSONArray("entries")
        record.totalBytes = validateDownloadManifest(session, entries)
        persist(record)
        val destination = File(request.getString("destination"))
        val roots = mutableMapOf<String, File>()
        val files = buildList {
            for (index in 0 until entries.length()) {
                checkCancelled(record.id)
                val entry = entries.getJSONObject(index)
                val relativePath = safeRelativePath(entry.getString("path"))
                val parts = relativePath.split("/")
                val localRoot = roots.getOrPut(parts.first()) {
                    reserveOwnedPath(record, destination, parts.first(), parts.size > 1 || entry.getString("type") == "DIR")
                }
                val localFile = if (parts.size == 1) localRoot else File(localRoot, parts.drop(1).joinToString("/"))
                if (entry.getString("type") == "DIR") {
                    if (!localFile.mkdirs() && !localFile.isDirectory) throw IllegalStateException("No se pudo crear ${localFile.path}")
                } else {
                    val size = entry.getLong("size")
                    localFile.parentFile?.let { parent ->
                        if (!parent.exists()) {
                            if (!parent.mkdirs() && !parent.isDirectory) throw IllegalStateException("No se pudo crear ${parent.path}")
                        }
                    }
                    if (parts.size > 1 && !localFile.createNewFile()) {
                        throw IllegalStateException("El archivo ya existe: ${localFile.path}")
                    }
                    add(DownloadFile(relativePath, localFile, size))
                }
            }
        }
        executeTransfers(record, files, MAX_DOWNLOAD_CONCURRENCY) { (remotePath, localFile, size) ->
            downloadFile(record, token, remotePath, localFile, size)
        }
        record.bytesTransferred = record.totalBytes
        runCatching { cancelRemoteSession(record, token) }
            .onFailure { error -> Log.w(LOG_TAG, "Could not close completed download session", error) }
        record.apiSessionId = null
    }

    private fun downloadFile(
        record: FileOperationRecord,
        token: String,
        remotePath: String,
        destination: File,
        expectedSize: Long
    ) {
        synchronized(record) {
            record.currentFileName = destination.name
            persist(record)
        }
        val url = "${record.request.getString("apiUrl")}/ftp/downloads/${encode(record.apiSessionId!!)}/entries" +
            "?path=${encode(remotePath)}&offset=0"
        val call = remoteTransferClient.newCall(Request.Builder().url(url).get().header("Authorization", "Bearer $token").build())
        registerCall(record.id, call)
        try {
            call.execute().use { response ->
                if (!response.isSuccessful) throw ApiException(response.body?.string(), response.code)
                val contentLength = response.body?.contentLength() ?: -1L
                if (contentLength >= 0 && contentLength != expectedSize) {
                    throw IllegalStateException("Tamaño de descarga no válido")
                }

                val input = response.body?.byteStream() ?: throw IllegalStateException("Respuesta de descarga vacía")
                var fileBytesTransferred = 0L
                input.use {
                    destination.outputStream().buffered().use { output ->
                        val buffer = ByteArray(BUFFER_SIZE)
                        while (true) {
                            checkCancelled(record.id)
                            val read = input.read(buffer)
                            if (read < 0) break
                            if (fileBytesTransferred > expectedSize - read) {
                                throw IllegalStateException("La descarga supera el tamaño declarado")
                            }

                            output.write(buffer, 0, read)
                            fileBytesTransferred += read
                            addTransferredBytes(record, read.toLong())
                        }
                    }
                }
                if (fileBytesTransferred != expectedSize) {
                    throw IllegalStateException("La descarga terminó antes del tamaño declarado")
                }
            }
        } finally {
            unregisterCall(record.id, call)
        }
    }

    private fun remoteDirectoryChange(record: FileOperationRecord, token: String) {
        val request = record.request
        val rename = record.operation == FileOperationRecord.OPERATION_REMOTE_RENAME
        val body = JSONObject().apply {
            request.optString("remoteDir").takeIf { it.isNotEmpty() }?.let { put("dir", it) }
            if (rename) {
                put("entry", request.getJSONObject("entry"))
                put("newName", request.getString("newName"))
            } else {
                put("name", request.getString("name"))
            }
        }
        val endpoint = if (rename) "rename" else "mkdir"
        val httpRequest = Request.Builder()
            .url("${request.getString("apiUrl")}/ftp/$endpoint")
            .header("Authorization", "Bearer $token")
            .post(body.toString().toRequestBody(JSON_MEDIA_TYPE))
            .build()
        val call = remoteTransferClient.newCall(httpRequest, 0)
        registerCall(record.id, call)
        try {
            call.execute().use { response ->
                val responseBody = response.body?.string().orEmpty()
                if (!response.isSuccessful) throw ApiException(responseBody, response.code)
                val version = response.header("Data-Version") ?: throw IllegalStateException("Falta la versión del directorio")
                record.result = JSONObject().put("entries", JSONArray(responseBody)).put("version", version)
            }
        } finally {
            unregisterCall(record.id, call)
        }
    }

    private fun remoteDelete(record: FileOperationRecord, token: String) {
        val request = record.request
        val body = JSONObject().apply {
            request.optString("remoteDir").takeIf { it.isNotEmpty() }?.let { put("dir", it) }
            put("entries", request.getJSONArray("entries"))
        }
        val remoteRequest = Request.Builder()
            .url("${request.getString("apiUrl")}/ftp")
            .delete(body.toString().toRequestBody(JSON_MEDIA_TYPE))
            .build()
        executeRemoteChanges(record, token, remoteRequest)
    }

    private fun remoteMove(record: FileOperationRecord, token: String) {
        val request = record.request
        val body = JSONObject().apply {
            request.optString("remoteDir").takeIf { it.isNotEmpty() }?.let { put("dir", it) }
            request.optString("destination").takeIf { it.isNotEmpty() }?.let { put("destination", it) }
            put("entries", request.getJSONArray("entries"))
        }
        val remoteRequest = Request.Builder()
            .url("${request.getString("apiUrl")}/ftp/move")
            .post(body.toString().toRequestBody(JSON_MEDIA_TYPE))
            .build()
        executeRemoteChanges(record, token, remoteRequest)
    }

    private fun executeRemoteChanges(record: FileOperationRecord, token: String, request: Request) {
        val expectedTotal = record.request.getJSONArray("entries").length()
        val changes = JSONArray()
        record.totalBytes = expectedTotal.toLong()
        record.result = JSONObject().put("changes", changes)
        persist(record)
        val call = remoteTransferClient.newCall(request.newBuilder().header("Authorization", "Bearer $token").build())
        registerCall(record.id, call)
        try {
            call.execute().use { response ->
                if (!response.isSuccessful) throw ApiException(response.body?.string(), response.code)
                val source = response.body?.source() ?: throw IllegalStateException("Respuesta de operación vacía")
                var completed = 0
                var complete = false
                while (true) {
                    val line = source.readUtf8Line() ?: break
                    if (line.isBlank()) {
                        continue
                    }

                    val event = JSONObject(line)
                    if (event.getString("event") == "complete") {
                        if (complete || completed != expectedTotal) {
                            throw IllegalStateException("Finalización remota no válida")
                        }

                        val version = event.getString("version")
                        if (version.isEmpty()) {
                            throw IllegalStateException("Versión remota no válida")
                        }

                        record.result?.put("version", version)
                        complete = true
                        persist(record)
                        continue
                    }

                    if (event.getString("event") != "entry" || complete) {
                        throw IllegalStateException("Evento remoto no válido")
                    }

                    val change = event
                    val eventCompleted = change.getInt("completed")
                    val eventTotal = change.getInt("total")
                    if (eventTotal != expectedTotal || eventCompleted != completed + 1) {
                        throw IllegalStateException("Progreso remoto no válido")
                    }

                    completed = eventCompleted
                    changes.put(change)
                    record.bytesTransferred = completed.toLong()
                    if (record.operation == FileOperationRecord.OPERATION_REMOTE_MOVE) {
                        record.currentFileName = change.optString("targetPath").takeIf { it.isNotEmpty() }
                            ?: change.getString("path")
                    }

                    persist(record)
                }
                if (!complete) {
                    throw IllegalStateException("La operación remota terminó sin confirmar su versión")
                }
            }
        } finally {
            unregisterCall(record.id, call)
        }
    }

    private fun localClaims(record: FileOperationRecord): List<LocalPathLocks.Claim> {
        val request = record.request
        val claims = mutableListOf<LocalPathLocks.Claim>()
        when (record.operation) {
            FileOperationRecord.OPERATION_DOWNLOAD -> claims.add(LocalPathLocks.claim(File(request.getString("destination")), false, false))
            FileOperationRecord.OPERATION_LOCAL_COPY, FileOperationRecord.OPERATION_LOCAL_MOVE,
            FileOperationRecord.OPERATION_LOCAL_DELETE -> {
                val sources = request.getJSONArray("sources")
                val write = record.operation != FileOperationRecord.OPERATION_LOCAL_COPY
                for (index in 0 until sources.length()) {
                    claims.add(LocalPathLocks.claim(File(sources.getString(index)), write))
                }
                if (record.operation != FileOperationRecord.OPERATION_LOCAL_DELETE) {
                    claims.add(LocalPathLocks.claim(File(request.getString("destination")), false, false))
                }
            }
            FileOperationRecord.OPERATION_LOCAL_MKDIR -> claims.add(LocalPathLocks.claim(File(request.getString("destination")), false, false))
            FileOperationRecord.OPERATION_LOCAL_RENAME -> {
                val source = File(request.getString("source"))
                claims.add(LocalPathLocks.claim(source, true))
                claims.add(LocalPathLocks.claim(source.parentFile ?: throw IllegalArgumentException("Ruta no válida"), false, false))
            }
            FileOperationRecord.OPERATION_LOCAL_EXTRACT -> {
                claims.add(LocalPathLocks.claim(File(request.getString("source")), false))
                claims.add(LocalPathLocks.claim(File(request.getString("destination")), false, false))
            }
        }
        return claims
    }

    private fun localCopyMove(record: FileOperationRecord, move: Boolean) {
        val request = record.request
        val sources = request.getJSONArray("sources")
        val destination = File(request.getString("destination"))
        validateLocalDestination(sources, destination)
        val totalSize = (0 until sources.length()).sumOf { fileSize(File(sources.getString(it))) }
        val trackEntries = totalSize == 0L
        val thumbnailsBySource = mutableMapOf<String, List<ThumbnailSnapshot>>()
        val targetsBySource = mutableMapOf<String, File>()
        record.totalBytes = if (trackEntries) sources.length().toLong() else totalSize
        persist(record)
        for (index in 0 until sources.length()) {
            checkCancelled(record.id)
            val source = File(sources.getString(index))
            val thumbnailSnapshot = thumbnailCache.snapshot(source)
            thumbnailsBySource[source.absolutePath] = thumbnailSnapshot
            val target = reserveOwnedPath(record, destination, source.name, source.isDirectory)
            copyLocal(record, source, target)
            targetsBySource[source.absolutePath] = target
            if (!move) {
                thumbnailCache.copy(thumbnailSnapshot, target)
            }
            if (trackEntries) {
                record.bytesTransferred = (index + 1).toLong()
                persist(record)
            }
        }
        if (move) {
            synchronized(cancellationLock) {
                checkCancelled(record.id)
                record.moveCommitStarted = true
                persist(record)
                committing.add(record.id)
            }
            for (index in 0 until sources.length()) {
                val source = File(sources.getString(index))
                if (!deleteMoveSource(source)) {
                    throw IllegalStateException("No se pudo eliminar ${source.path}")
                }
            }

            for (index in 0 until sources.length()) {
                val source = File(sources.getString(index))
                thumbnailCache.move(
                    thumbnailsBySource[source.absolutePath].orEmpty(),
                    source,
                    requireNotNull(targetsBySource[source.absolutePath])
                )
            }
        }
    }

    private fun deleteMoveSource(source: File): Boolean {
        repeat(MOVE_DELETE_ATTEMPTS) { attempt ->
            if (!source.exists() || source.deleteRecursively()) return true
            if (attempt < MOVE_DELETE_ATTEMPTS - 1) Thread.sleep(MOVE_DELETE_RETRY_DELAY)
        }

        return false
    }

    private fun validateLocalDestination(sources: JSONArray, destination: File) {
        val destinationPath = destination.canonicalFile.path
        for (index in 0 until sources.length()) {
            val source = File(sources.getString(index))
            if (!source.isDirectory) {
                continue
            }

            val sourcePath = source.canonicalFile.path
            if (destinationPath == sourcePath || destinationPath.startsWith(sourcePath + File.separator)) {
                throw IllegalArgumentException("No se puede copiar o mover una carpeta dentro de sí misma")
            }
        }
    }

    private fun copyLocal(record: FileOperationRecord, source: File, destination: File, reserved: Boolean = true) {
        checkCancelled(record.id)
        record.currentFileName = source.name
        if (source.isDirectory) {
            if (!reserved && !destination.mkdir()) {
                throw IllegalStateException("No se pudo crear ${destination.path}")
            }
            val children = source.listFiles() ?: throw IllegalStateException("No se pudo leer ${source.path}")
            children.forEach { copyLocal(record, it, File(destination, it.name), false) }
            return
        }

        destination.parentFile?.let {
            if (!it.exists() && !it.mkdirs()) throw IllegalStateException("No se pudo crear ${it.path}")
        }
        if (!reserved && !destination.createNewFile()) {
            throw IllegalStateException("El archivo ya existe: ${destination.path}")
        }
        source.inputStream().buffered().use { input ->
            destination.outputStream().buffered().use { output ->
                val buffer = ByteArray(BUFFER_SIZE)
                while (true) {
                    checkCancelled(record.id)
                    val read = input.read(buffer)
                    if (read < 0) break
                    output.write(buffer, 0, read)
                    record.bytesTransferred += read
                    notifyProgress(record)
                }
            }
        }
    }

    private fun localDelete(record: FileOperationRecord) {
        val sources = record.request.getJSONArray("sources")
        record.totalBytes = sources.length().toLong()
        persist(record)
        for (index in 0 until sources.length()) {
            val source = File(sources.getString(index))
            val thumbnailSnapshot = thumbnailCache.snapshot(source)
            deleteLocal(record, source)
            thumbnailCache.delete(thumbnailSnapshot)
            thumbnailCache.deletePath(source.absolutePath)
            record.bytesTransferred = (index + 1).toLong()
            persist(record)
        }
    }

    private fun localExtract(record: FileOperationRecord) {
        val source = File(record.request.getString("source"))
        val destination = File(record.request.getString("destination"))
        val temporary = createOwnedStage(record, destination, true)
        record.currentFileName = source.name
        persist(record)

        if (source.extension.equals("7z", true)) {
            extractSevenZip(record, source, temporary)
        } else {
            extractStream(record, source, temporary)
        }

        temporary.listFiles()?.forEach { extracted ->
            checkCancelled(record.id)
            val target = reserveOwnedPath(record, destination, extracted.name, extracted.isDirectory)
            if (extracted.isDirectory) {
                check(extracted.copyRecursively(target, overwrite = false)) { "No se pudo finalizar la extracción" }
            } else {
                extracted.inputStream().use { input -> target.outputStream().use { output -> input.copyTo(output) } }
            }
            if (!extracted.deleteRecursively()) throw IllegalStateException("No se pudo finalizar la extracción")
        }
        if (!temporary.deleteRecursively()) throw IllegalStateException("No se pudo limpiar la extracción temporal")
    }

    private fun extractSevenZip(record: FileOperationRecord, source: File, destination: File) {
        SevenZFile.builder().setFile(source).get().use { archive ->
            while (true) {
                checkCancelled(record.id)
                val entry = archive.nextEntry ?: break
                val output = safeArchiveDestination(destination, entry.name)
                record.currentFileName = entry.name
                if (entry.isDirectory) {
                    if (!output.mkdirs() && !output.isDirectory) throw IllegalStateException("No se pudo crear ${output.path}")
                } else {
                    output.parentFile?.mkdirs()
                    output.outputStream().buffered().use { stream ->
                        val buffer = ByteArray(BUFFER_SIZE)
                        while (true) {
                            checkCancelled(record.id)
                            val read = archive.read(buffer)
                            if (read < 0) break
                            stream.write(buffer, 0, read)
                            record.bytesTransferred += read
                            notifyProgress(record)
                        }
                    }
                }
            }
        }
    }

    private fun extractStream(record: FileOperationRecord, source: File, destination: File) {
        val extension = source.name.lowercase()
        BufferedInputStream(source.inputStream()).use { buffered ->
            if (isCompressedStream(extension)) {
                CompressorStreamFactory().createCompressorInputStream(compressorName(extension), buffered).use { compressed ->
                    if (isCompressedArchive(extension)) {
                        extractArchiveStream(
                            record,
                            ArchiveStreamFactory().createArchiveInputStream(BufferedInputStream(compressed)),
                            destination
                        )
                    } else {
                        val outputName = source.name.substringBeforeLast('.')
                        copyExtractedStream(record, compressed, File(destination, outputName))
                    }
                }
            } else {
                extractArchiveStream(record, ArchiveStreamFactory().createArchiveInputStream(buffered), destination)
            }
        }
    }

    private fun extractArchiveStream(record: FileOperationRecord, archive: ArchiveInputStream<*>, destination: File) {
        archive.use {
            while (true) {
                checkCancelled(record.id)
                val entry = archive.nextEntry ?: break
                if (!archive.canReadEntryData(entry)) throw IllegalStateException("Formato de entrada no compatible")
                val output = safeArchiveDestination(destination, entry.name)
                record.currentFileName = entry.name
                if (entry.isDirectory) {
                    if (!output.mkdirs() && !output.isDirectory) throw IllegalStateException("No se pudo crear ${output.path}")
                } else {
                    output.parentFile?.mkdirs()
                    copyExtractedStream(record, archive, output)
                }
            }
        }
    }

    private fun copyExtractedStream(record: FileOperationRecord, input: InputStream, output: File) {
        output.parentFile?.mkdirs()
        output.outputStream().buffered().use { stream ->
            val buffer = ByteArray(BUFFER_SIZE)
            while (true) {
                checkCancelled(record.id)
                val read = input.read(buffer)
                if (read < 0) break
                stream.write(buffer, 0, read)
                record.bytesTransferred += read
                notifyProgress(record)
            }
        }
    }

    private fun safeArchiveDestination(destination: File, name: String): File {
        val output = File(destination, name)
        val root = destination.canonicalPath + File.separator
        if (!output.canonicalPath.startsWith(root)) throw IllegalArgumentException("Ruta de archivo no válida")
        return output
    }

    private fun isCompressedStream(name: String): Boolean =
        listOf(".gz", ".gzip", ".tgz", ".bz2", ".xz", ".lzma").any(name::endsWith)

    private fun isCompressedArchive(name: String): Boolean = listOf(
        ".tar.gz", ".tgz", ".tar.bz2", ".tbz2", ".tar.xz", ".txz", ".tar.lzma"
    ).any(name::endsWith)

    private fun compressorName(name: String): String = when {
        name.endsWith(".gz") || name.endsWith(".gzip") || name.endsWith(".tgz") -> CompressorStreamFactory.GZIP
        name.endsWith(".bz2") || name.endsWith(".tbz2") -> CompressorStreamFactory.BZIP2
        name.endsWith(".xz") || name.endsWith(".txz") -> CompressorStreamFactory.XZ
        name.endsWith(".lzma") -> CompressorStreamFactory.LZMA
        else -> throw IllegalArgumentException("Formato de compresión no compatible")
    }

    private fun deleteLocal(record: FileOperationRecord, file: File) {
        if (file.isDirectory) {
            file.listFiles()?.forEach { deleteLocal(record, it) }
        }
        if (file.exists() && !file.delete()) throw IllegalStateException("No se pudo eliminar ${file.path}")
    }

    private fun fileSize(file: File): Long = if (file.isDirectory) {
        file.listFiles()?.sumOf(::fileSize) ?: 0
    } else {
        file.length()
    }

    private fun validateDownloadManifest(session: JSONObject, entries: JSONArray): Long {
        val declaredTotal = session.getLong("totalBytes")
        if (declaredTotal < 0) {
            throw IllegalStateException("Tamaño total de descarga no válido")
        }

        var calculatedTotal = 0L
        for (index in 0 until entries.length()) {
            val entry = entries.getJSONObject(index)
            when (entry.getString("type")) {
                "DIR" -> Unit
                "FILE" -> {
                    if (!entry.has("size")) {
                        throw IllegalStateException("Falta el tamaño de un archivo de descarga")
                    }

                    val size = entry.getLong("size")
                    if (size < 0) {
                        throw IllegalStateException("Tamaño de archivo de descarga no válido")
                    }

                    calculatedTotal = try {
                        Math.addExact(calculatedTotal, size)
                    } catch (_: ArithmeticException) {
                        throw IllegalStateException("El tamaño total de descarga es demasiado grande")
                    }
                }
                else -> throw IllegalStateException("Tipo de entrada de descarga no válido")
            }
        }
        if (calculatedTotal != declaredTotal) {
            throw IllegalStateException("El tamaño total no coincide con el manifiesto")
        }

        return declaredTotal
    }

    private fun rollback(record: FileOperationRecord, token: String?) {
        if (record.operation == FileOperationRecord.OPERATION_LOCAL_MOVE && record.moveCommitStarted) {
            rollbackMove(record)
        } else if (record.operation == FileOperationRecord.OPERATION_DOWNLOAD ||
            record.operation == FileOperationRecord.OPERATION_LOCAL_COPY ||
            record.operation == FileOperationRecord.OPERATION_LOCAL_MOVE ||
            record.operation == FileOperationRecord.OPERATION_LOCAL_EXTRACT
        ) {
            cleanupLocal(record)
            reconcileThumbnailDestination(record)
        }

        if (token != null && runCatching { cancelRemoteSession(record, token) }.isSuccess) {
            record.apiSessionId = null
        }
    }

    private fun rollbackMove(record: FileOperationRecord) {
        runCatching {
            if (!record.moveRollbackRestored) {
                val sources = record.request.getJSONArray("sources")
                check(sources.length() == record.createdPaths.size) { "Faltan rutas para restaurar el movimiento" }
                for (index in 0 until sources.length()) {
                    val copy = File(record.createdPaths[index])
                    val expected = record.ownedIdentities.optString(copy.path)
                    check(expected.isNotEmpty() && identity(copy) == expected) { "No se pudo identificar ${copy.path}" }
                    restoreMoveSource(record, copy, File(sources.getString(index)))
                }

                record.moveRollbackRestored = true
                persist(record)
            }

            record.createdPaths.asReversed().forEach { path ->
                val target = File(path)
                val expected = record.ownedIdentities.optString(path)
                check(!target.exists() || (expected.isNotEmpty() && identity(target) == expected && target.deleteRecursively())) {
                    "No se pudo limpiar ${target.path}"
                }
            }
            cleanupLocal(record)
            check(!record.cleanupPending) { "No se pudieron limpiar los archivos temporales" }
            record.moveCommitStarted = false
            record.moveRollbackRestored = false
        }.onFailure { error ->
            Log.e(LOG_TAG, "No se pudo revertir el movimiento ${record.id}", error)
        }
    }

    private fun restoreMoveSource(record: FileOperationRecord, copy: File, source: File) {
        check(copy.exists()) { "No se encuentra la copia ${copy.path}" }
        if (copy.isDirectory) {
            check(source.isDirectory || (!source.exists() && source.mkdirs())) { "No se pudo restaurar ${source.path}" }
            val children = copy.listFiles() ?: throw IllegalStateException("No se pudo leer ${copy.path}")
            children.forEach { child -> restoreMoveSource(record, child, File(source, child.name)) }
            return
        }

        if (source.exists()) {
            check(source.isFile) { "No se pudo restaurar ${source.path}" }
            return
        }

        val parent = source.parentFile ?: throw IllegalStateException("No se pudo restaurar ${source.path}")
        check(parent.isDirectory || parent.mkdirs()) { "No se pudo crear ${parent.path}" }
        val temporary = createOwnedStage(record, parent, false)
        try {
            copy.copyTo(temporary, overwrite = true)
            check(AtomicRename.rename(temporary.path, source.path) == 0) { "No se pudo restaurar ${source.path}" }
        } finally {
            temporary.delete()
        }
    }

    private fun cleanupLocal(record: FileOperationRecord) {
        var cleaned = cleanupPendingStage(record)
        record.ownedIdentities.keys().asSequence().toList().asReversed().forEach { path ->
            val expected = record.ownedIdentities.optString(path)
            val file = File(path)
            val stat = try {
                Os.lstat(path)
            } catch (error: ErrnoException) {
                if (error.errno != OsConstants.ENOENT) cleaned = false
                return@forEach
            }
            val actual = if (stat.st_ino > 0) "${stat.st_dev}:${stat.st_ino}" else ""
            if (expected.isEmpty() || actual.isEmpty()) {
                cleaned = false
            } else if (actual == expected && !file.deleteRecursively()) {
                cleaned = false
            }
        }
        if (record.createdPaths.any { !record.ownedIdentities.has(it) && File(it).exists() }) cleaned = false
        record.cleanupPending = !cleaned
    }

    private fun reconcileThumbnailDestination(record: FileOperationRecord) {
        val destination = record.request.optString("destination")
        if (destination.isNotEmpty()) {
            thumbnailCache.reconcileDirectory(File(destination))
        }
    }

    private fun cleanupPendingStage(record: FileOperationRecord): Boolean {
        val path = record.pendingStagePath ?: return true
        val file = File(path)
        val prefix = ".file-explorer-${record.id}-"
        if (!file.name.startsWith(prefix) || runCatching { UUID.fromString(file.name.removePrefix(prefix)) }.isFailure) return false
        val stat = try {
            Os.lstat(path)
        } catch (error: ErrnoException) {
            if (error.errno != OsConstants.ENOENT) return false
            record.pendingStagePath = null
            return true
        }
        val empty = when {
            OsConstants.S_ISREG(stat.st_mode) -> stat.st_size == 0L
            OsConstants.S_ISDIR(stat.st_mode) -> file.list()?.isEmpty() == true
            else -> false
        }
        if (!empty || !file.delete()) return false
        record.pendingStagePath = null
        return true
    }

    private fun cancelRemoteSession(record: FileOperationRecord, token: String) {
        val sessionId = record.apiSessionId ?: return
        val resource = if (record.operation == FileOperationRecord.OPERATION_UPLOAD) "uploads" else "downloads"
        executeCleanup(
            token,
            Request.Builder()
                .url("${record.request.getString("apiUrl")}/ftp/$resource/${encode(sessionId)}")
                .delete()
                .build()
        )
    }

    private fun executeJson(record: FileOperationRecord, token: String, method: String, url: String, body: JSONObject?): JSONObject {
        val builder = Request.Builder().url(url)
        if (method == "POST") builder.post(body?.toString()?.toRequestBody(JSON_MEDIA_TYPE) ?: EMPTY_BODY)
        val response = execute(record, token, builder.build())
        return if (response.isBlank()) JSONObject() else JSONObject(response)
    }

    private fun completeUpload(record: FileOperationRecord, token: String): JSONObject {
        val url = "${record.request.getString("apiUrl")}/ftp/uploads/${encode(record.apiSessionId!!)}/complete"
        checkCancelled(record.id)
        val request = Request.Builder()
            .url(url)
            .post(EMPTY_BODY)
            .header("Authorization", "Bearer $token")
            .build()
        val call = remoteTransferClient.newCall(request)
        registerCall(record.id, call)
        try {
            call.execute().use { response ->
                val body = response.body?.string().orEmpty()
                if (!response.isSuccessful) {
                    throw ApiException(body, response.code)
                }

                val version = response.header("Data-Version")
                    ?: throw IllegalStateException("Falta Data-Version en la subida")
                return JSONObject()
                    .put("entries", JSONArray(body))
                    .put("version", version)
            }
        } finally {
            unregisterCall(record.id, call)
        }
    }

    private fun execute(record: FileOperationRecord, token: String, request: Request): String {
        checkCancelled(record.id)
        val authorized = request.newBuilder().header("Authorization", "Bearer $token").build()
        val call = remoteTransferClient.newCall(authorized)
        registerCall(record.id, call)
        try {
            call.execute().use { response ->
                val body = response.body?.string().orEmpty()
                if (!response.isSuccessful) throw ApiException(body, response.code)
                return body
            }
        } finally {
            unregisterCall(record.id, call)
        }
    }

    private fun executeCleanup(token: String, request: Request) {
        val authorized = request.newBuilder().header("Authorization", "Bearer $token").build()
        remoteTransferClient.newCall(authorized).execute().use { response ->
            if (!response.isSuccessful) {
                throw ApiException(response.body?.string(), response.code)
            }
        }
    }

    private fun createOwnedStage(record: FileOperationRecord, directory: File, isDirectory: Boolean): File {
        while (true) {
            val file = File(directory, ".file-explorer-${record.id}-${UUID.randomUUID()}")
            record.pendingStagePath = file.path
            persist(record)
            val created = if (isDirectory) file.mkdir() else file.createNewFile()
            if (!created) {
                record.pendingStagePath = null
                persist(record)
                if (file.exists()) continue
                throw IllegalStateException("No se pudo preparar ${file.path}")
            }

            val expected = identity(file)
            check(expected.isNotEmpty()) { "No se pudo identificar ${file.path}" }
            record.ownedIdentities.put(file.path, expected)
            record.pendingStagePath = null
            persist(record)
            return file
        }
    }

    private fun reserveOwnedPath(record: FileOperationRecord, directory: File, name: String, isDirectory: Boolean): File {
        val file = createOwnedStage(record, directory, isDirectory)
        val expected = identity(file)
        try {
            check(expected.isNotEmpty()) { "No se pudo identificar ${file.path}" }
            record.ownedIdentities.put(file.path, expected)
            persist(record)
            var index = 0
            while (true) {
                val target = File(directory, AtomicFiles.candidate(name, index))
                if (record.ownedIdentities.has(target.path)) {
                    index++
                    continue
                }
                if (!LocalPathLocks.tryAcquire(record.id, listOf(LocalPathLocks.claim(target, true)))) {
                    index++
                    continue
                }
                record.ownedIdentities.put(target.path, expected)
                persist(record)
                when (val error = AtomicRename.rename(file.path, target.path)) {
                    0 -> {
                        record.createdPaths.add(target.path)
                        persist(record)
                        return target
                    }
                    OsConstants.EEXIST, OsConstants.ENOTEMPTY -> {
                        record.ownedIdentities.remove(target.path)
                        persist(record)
                        LocalPathLocks.releaseClaim(record.id, LocalPathLocks.claim(target, true))
                        index++
                    }
                    else -> throw IllegalStateException("No se pudo reservar ${target.path} ($error)")
                }
            }
        } catch (error: Throwable) {
            if (expected.isNotEmpty() && identity(file) == expected) file.deleteRecursively()
            throw error
        }
    }

    private fun identity(file: File): String {
        return runCatching {
            Os.lstat(file.path).let { if (it.st_ino > 0) "${it.st_dev}:${it.st_ino}" else "" }
        }.getOrDefault("")
    }

    private fun safeRelativePath(path: String): String {
        val normalized = path.replace('\\', '/')
        if (normalized.startsWith('/') || normalized.split('/').any { it.isBlank() || it == "." || it == ".." }) {
            throw IllegalArgumentException("Ruta de transferencia no válida")
        }

        return normalized
    }

    private fun <T> executeTransfers(
        record: FileOperationRecord,
        entries: List<T>,
        concurrency: Int,
        transfer: (T) -> Unit
    ) {
        if (entries.isEmpty()) {
            return
        }

        val nextEntry = AtomicInteger()
        val failure = AtomicReference<Throwable?>(null)
        val workers = List(minOf(concurrency, entries.size)) {
            REMOTE_TRANSFER_EXECUTOR.submit {
                while (failure.get() == null) {
                    checkCancelled(record.id)
                    val index = nextEntry.getAndIncrement()
                    if (index >= entries.size) {
                        return@submit
                    }

                    try {
                        transfer(entries[index])
                    } catch (error: Throwable) {
                        if (failure.compareAndSet(null, error)) {
                            cancelCalls(record.id)
                        }
                        return@submit
                    }
                }
            }
        }
        workers.forEach { worker ->
            try {
                worker.get()
            } catch (error: Throwable) {
                if (failure.compareAndSet(null, error)) {
                    cancelCalls(record.id)
                }
            }
        }
        failure.get()?.let { throw it }
        checkCancelled(record.id)
    }

    private fun registerCall(operationId: String, call: Call) {
        calls.computeIfAbsent(operationId) { ConcurrentHashMap.newKeySet() }.add(call)
        if (cancelled.contains(operationId)) {
            call.cancel()
        }
    }

    private fun unregisterCall(operationId: String, call: Call) {
        calls[operationId]?.remove(call)
    }

    private fun cancelCalls(operationId: String) {
        calls[operationId]?.forEach(Call::cancel)
    }

    private fun addTransferredBytes(record: FileOperationRecord, bytes: Long) {
        if (bytes <= 0) {
            return
        }

        synchronized(record) {
            record.bytesTransferred += bytes
            notifyProgress(record)
        }
    }

    private fun notifyProgress(record: FileOperationRecord) {
        val now = System.currentTimeMillis()
        val previous = lastProgressAt[record.id] ?: 0L
        if (now - previous >= PROGRESS_INTERVAL) {
            lastProgressAt[record.id] = now
            persist(record)
        }
    }

    private fun persist(record: FileOperationRecord) {
        store.save(record)
        onChange(record)
    }

    private fun checkCancelled(id: String) {
        if (cancelled.contains(id)) throw InterruptedException("Transferencia cancelada")
    }

    private fun requireToken(token: String?): String = token
        ?: throw IllegalArgumentException("Falta el token de acceso")

    private data class DownloadFile(val remotePath: String, val destination: File, val size: Long)

    private class FileSliceRequestBody(
        private val file: File,
        private val offset: Long,
        private val length: Long,
        mediaType: String,
        private val onProgress: (Long) -> Unit
    ) : RequestBody() {
        private val contentType = mediaType.toMediaType()
        override fun contentType() = contentType
        override fun contentLength() = length
        override fun writeTo(sink: BufferedSink) {
            RandomAccessFile(file, "r").use { source ->
                source.seek(offset)
                val buffer = ByteArray(BUFFER_SIZE)
                var remaining = length
                var sent = 0L
                while (remaining > 0) {
                    val read = source.read(buffer, 0, minOf(buffer.size.toLong(), remaining).toInt())
                    if (read < 0) throw IllegalStateException("El archivo terminó antes del offset esperado")
                    sink.write(buffer, 0, read)
                    remaining -= read
                    sent += read
                    onProgress(sent)
                }
            }
        }
    }

    private class ApiException(body: String?, status: Int) : RuntimeException() {
        val apiError = runCatching {
            JSONObject(body.orEmpty()).takeIf { it.has("code") && it.has("message") }
        }.getOrNull()

        override val message = apiError?.optString("message") ?: "Error HTTP $status"
    }

    companion object {
        private const val LOG_TAG = "FileOperationEngine"
        private const val CHUNK_SIZE = 90L * 1024 * 1024
        private const val BUFFER_SIZE = 64 * 1024
        private const val MAX_DOWNLOAD_CONCURRENCY = 3
        private const val MAX_REMOTE_CONCURRENCY = 4
        private const val MAX_UPLOAD_CONCURRENCY = 3
        private const val PROGRESS_INTERVAL = 1000L
        private const val MOVE_DELETE_ATTEMPTS = 3
        private const val MOVE_DELETE_RETRY_DELAY = 200L
        private val JSON_MEDIA_TYPE = "application/json; charset=utf-8".toMediaType()
        private val EMPTY_BODY = ByteArray(0).toRequestBody(null)
        private val REMOTE_TRANSFER_EXECUTOR = Executors.newFixedThreadPool(MAX_REMOTE_CONCURRENCY)
        private fun encode(value: String): String = URLEncoder.encode(value, StandardCharsets.UTF_8.toString())
    }
}
