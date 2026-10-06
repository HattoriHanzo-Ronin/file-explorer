package com.hhrcore.fileexplorer.operation

import android.util.Log
import okhttp3.Call
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
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
import java.util.concurrent.TimeUnit

class FileOperationEngine(private val store: FileOperationStore, private val onChange: (FileOperationRecord) -> Unit) {
    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(10, TimeUnit.MINUTES)
        .writeTimeout(10, TimeUnit.MINUTES)
        .retryOnConnectionFailure(true)
        .build()
    private val calls = ConcurrentHashMap<String, Call>()
    private val cancelled = ConcurrentHashMap.newKeySet<String>()
    private val committing = ConcurrentHashMap.newKeySet<String>()
    private val lastProgressAt = ConcurrentHashMap<String, Long>()

    fun execute(record: FileOperationRecord, accessToken: String?) {
        record.status = FileOperationRecord.STATUS_RUNNING
        persist(record)
        try {
            when (record.operation) {
                FileOperationRecord.OPERATION_UPLOAD -> upload(record, requireToken(accessToken))
                FileOperationRecord.OPERATION_DOWNLOAD -> download(record, requireToken(accessToken))
                FileOperationRecord.OPERATION_REMOTE_MOVE -> remoteMove(record, requireToken(accessToken))
                FileOperationRecord.OPERATION_REMOTE_DELETE -> remoteDelete(record, requireToken(accessToken))
                FileOperationRecord.OPERATION_LOCAL_COPY -> localCopyMove(record, false)
                FileOperationRecord.OPERATION_LOCAL_MOVE -> localCopyMove(record, true)
                FileOperationRecord.OPERATION_LOCAL_DELETE -> localDelete(record)
                FileOperationRecord.OPERATION_LOCAL_EXTRACT -> localExtract(record)
                else -> throw IllegalArgumentException("Operación de archivos no válida")
            }
            checkCancelled(record.id)
            record.status = FileOperationRecord.STATUS_COMPLETED
            persist(record)
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
        }
    }

    fun cancel(id: String) {
        val record = store.get(id) ?: return
        if (!FileOperationRecord.isCancellable(record.operation) || committing.contains(id)) return
        cancelled.add(id)
        calls[id]?.cancel()
    }

    fun reconcile(record: FileOperationRecord) {
        record.status = FileOperationRecord.STATUS_INTERRUPTED
        record.error = null
        if (record.operation == FileOperationRecord.OPERATION_DOWNLOAD ||
            record.operation == FileOperationRecord.OPERATION_LOCAL_COPY ||
            record.operation == FileOperationRecord.OPERATION_LOCAL_MOVE ||
            record.operation == FileOperationRecord.OPERATION_LOCAL_EXTRACT
        ) {
            cleanupLocal(record)
        } else if (record.operation == FileOperationRecord.OPERATION_UPLOAD) {
            record.apiSessionId = null
        }
        persist(record)
    }

    private fun upload(record: FileOperationRecord, token: String) {
        val request = record.request
        val entries = request.getJSONArray("entries")
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
        for (index in 0 until entries.length()) {
            val entry = entries.getJSONObject(index)
            if (entry.getString("type") == "FILE") {
                uploadFile(record, token, entry, safeRelativePath(resolvedEntries.getJSONObject(index).getString("path")))
            }
        }
        record.result = completeUpload(record, token)
        record.apiSessionId = null
    }

    private fun uploadFile(record: FileOperationRecord, token: String, entry: JSONObject, remotePath: String) {
        val file = File(entry.getString("localPath"))
        val size = entry.getLong("size")
        record.currentFileName = file.name
        persist(record)
        var offset = 0L
        do {
            checkCancelled(record.id)
            val length = minOf(CHUNK_SIZE, size - offset)
            val transferredBeforeChunk = record.bytesTransferred
            val body = MultipartBody.Builder().setType(MultipartBody.FORM).addFormDataPart(
                "file", File(remotePath).name,
                FileSliceRequestBody(file, offset, length, entry.optString("mimeType", "application/octet-stream")) { sent ->
                    record.bytesTransferred = transferredBeforeChunk + sent
                    notifyProgress(record)
                }
            ).build()
            val url = "${record.request.getString("apiUrl")}/ftp/uploads/${encode(record.apiSessionId!!)}/entries" +
                "?path=${encode(remotePath)}&offset=$offset"
            val nextOffset = JSONObject(execute(record, token, Request.Builder().url(url).put(body).build())).getLong("nextOffset")
            if (nextOffset != offset + length) throw IllegalStateException("Offset de subida no válido")
            record.bytesTransferred = transferredBeforeChunk + length
            offset = nextOffset
            persist(record)
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
        val roots = mutableMapOf<String, String>()
        for (index in 0 until entries.length()) {
            checkCancelled(record.id)
            val entry = entries.getJSONObject(index)
            val relativePath = safeRelativePath(entry.getString("path"))
            val parts = relativePath.split("/")
            val localRoot = roots.getOrPut(parts.first()) { availableName(destination, parts.first()) }
            val localFile = File(destination, listOf(localRoot).plus(parts.drop(1)).joinToString("/"))
            if (entry.getString("type") == "DIR") {
                registerOwnedPath(record, localFile)
                if (!localFile.mkdirs() && !localFile.isDirectory) throw IllegalStateException("No se pudo crear ${localFile.path}")
            } else {
                val size = entry.getLong("size")
                localFile.parentFile?.let { parent ->
                    if (!parent.exists()) {
                        registerOwnedPath(record, parent)
                        if (!parent.mkdirs() && !parent.isDirectory) throw IllegalStateException("No se pudo crear ${parent.path}")
                    }
                }
                registerOwnedPath(record, localFile)
                downloadFile(record, token, relativePath, localFile, size)
            }
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
        record.currentFileName = destination.name
        persist(record)
        val url = "${record.request.getString("apiUrl")}/ftp/downloads/${encode(record.apiSessionId!!)}/entries" +
            "?path=${encode(remotePath)}&offset=0"
        val call = client.newCall(Request.Builder().url(url).get().header("Authorization", "Bearer $token").build())
        calls[record.id] = call
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
                        record.bytesTransferred += read
                        notifyProgress(record)
                    }
                }
            }
            if (fileBytesTransferred != expectedSize) {
                throw IllegalStateException("La descarga terminó antes del tamaño declarado")
            }
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
        val call = client.newCall(request.newBuilder().header("Authorization", "Bearer $token").build())
        calls[record.id] = call
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
    }

    private fun localCopyMove(record: FileOperationRecord, move: Boolean) {
        val request = record.request
        val sources = request.getJSONArray("sources")
        val destination = File(request.getString("destination"))
        validateLocalDestination(sources, destination)
        val totalSize = (0 until sources.length()).sumOf { fileSize(File(sources.getString(it))) }
        val trackEntries = totalSize == 0L
        record.totalBytes = if (trackEntries) sources.length().toLong() else totalSize
        persist(record)
        for (index in 0 until sources.length()) {
            checkCancelled(record.id)
            val source = File(sources.getString(index))
            val target = File(destination, availableName(destination, source.name))
            registerOwnedPath(record, target)
            copyLocal(record, source, target)
            if (trackEntries) {
                record.bytesTransferred = (index + 1).toLong()
                persist(record)
            }
        }
        if (move) {
            committing.add(record.id)
            cancelled.remove(record.id)
            for (index in 0 until sources.length()) {
                File(sources.getString(index)).deleteRecursively()
            }
        }
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

    private fun copyLocal(record: FileOperationRecord, source: File, destination: File) {
        checkCancelled(record.id)
        record.currentFileName = source.name
        if (source.isDirectory) {
            if (!destination.mkdirs() && !destination.isDirectory) {
                throw IllegalStateException("No se pudo crear ${destination.path}")
            }
            source.listFiles()?.forEach { copyLocal(record, it, File(destination, it.name)) }
            return
        }

        destination.parentFile?.let {
            if (!it.exists() && !it.mkdirs()) throw IllegalStateException("No se pudo crear ${it.path}")
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
            deleteLocal(record, source)
            record.bytesTransferred = (index + 1).toLong()
            persist(record)
        }
    }

    private fun localExtract(record: FileOperationRecord) {
        val source = File(record.request.getString("source"))
        val destination = File(record.request.getString("destination"))
        val temporary = File(destination, ".file-explorer-${record.id}")
        if (!temporary.mkdirs()) throw IllegalStateException("No se pudo preparar la extracción")
        registerOwnedPath(record, temporary)
        record.currentFileName = source.name
        persist(record)

        if (source.extension.equals("7z", true)) {
            extractSevenZip(record, source, temporary)
        } else {
            extractStream(record, source, temporary)
        }

        temporary.listFiles()?.forEach { extracted ->
            checkCancelled(record.id)
            val target = File(destination, availableName(destination, extracted.name))
            registerOwnedPath(record, target)
            if (!extracted.renameTo(target)) {
                extracted.copyRecursively(target, overwrite = false)
                if (!extracted.deleteRecursively()) throw IllegalStateException("No se pudo finalizar la extracción")
            }
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
        if (record.operation == FileOperationRecord.OPERATION_DOWNLOAD ||
            record.operation == FileOperationRecord.OPERATION_LOCAL_COPY ||
            record.operation == FileOperationRecord.OPERATION_LOCAL_MOVE ||
            record.operation == FileOperationRecord.OPERATION_LOCAL_EXTRACT
        && !committing.contains(record.id)) {
            cleanupLocal(record)
        }

        if (token != null && runCatching { cancelRemoteSession(record, token) }.isSuccess) {
            record.apiSessionId = null
        }
    }

    private fun cleanupLocal(record: FileOperationRecord) {
        record.createdPaths.asReversed().forEach { File(it).deleteRecursively() }
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
        val call = client.newCall(request)
        calls[record.id] = call
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
    }

    private fun execute(record: FileOperationRecord, token: String, request: Request): String {
        checkCancelled(record.id)
        val authorized = request.newBuilder().header("Authorization", "Bearer $token").build()
        val call = client.newCall(authorized)
        calls[record.id] = call
        call.execute().use { response ->
            val body = response.body?.string().orEmpty()
            if (!response.isSuccessful) throw ApiException(body, response.code)
            return body
        }
    }

    private fun executeCleanup(token: String, request: Request) {
        val authorized = request.newBuilder().header("Authorization", "Bearer $token").build()
        client.newCall(authorized).execute().use { response ->
            if (!response.isSuccessful) {
                throw ApiException(response.body?.string(), response.code)
            }
        }
    }

    private fun registerOwnedPath(record: FileOperationRecord, file: File) {
        if (!record.createdPaths.contains(file.path)) {
            record.createdPaths.add(file.path)
            persist(record)
        }
    }

    private fun availableName(destination: File, requestedName: String): String {
        if (!File(destination, requestedName).exists()) return requestedName
        val extensionIndex = requestedName.lastIndexOf('.').takeIf { it > 0 } ?: requestedName.length
        val base = requestedName.substring(0, extensionIndex).replace(Regex(" \\(\\d+\\)$"), "")
        val extension = requestedName.substring(extensionIndex)
        var index = 1
        while (File(destination, "$base ($index)$extension").exists()) index++
        return "$base ($index)$extension"
    }

    private fun safeRelativePath(path: String): String {
        val normalized = path.replace('\\', '/')
        if (normalized.startsWith('/') || normalized.split('/').any { it.isBlank() || it == "." || it == ".." }) {
            throw IllegalArgumentException("Ruta de transferencia no válida")
        }

        return normalized
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
        private const val PROGRESS_INTERVAL = 1000L
        private val JSON_MEDIA_TYPE = "application/json; charset=utf-8".toMediaType()
        private val EMPTY_BODY = ByteArray(0).toRequestBody(null)
        private fun encode(value: String): String = URLEncoder.encode(value, StandardCharsets.UTF_8.toString())
    }
}
