package com.hhrcore.fileexplorer.thumbnail

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.os.StatFs
import android.webkit.MimeTypeMap
import com.hhrcore.fileexplorer.database.ExplorerDatabaseHelper
import java.io.File
import java.io.FileOutputStream
import java.security.MessageDigest

class ThumbnailCache(context: Context) {
    private val context: Context
    private val database: ThumbnailStore

    init {
        this.context = context
        database = ThumbnailStore(ExplorerDatabaseHelper(context))
    }

    fun find(source: File): File? = synchronized(LOCK) {
        if (!source.isFile || isExcludedPath(source) || !supportsThumbnail(source)) {
            return null
        }

        val id = thumbnailId(source)
        val ownerId = database.ownerId(id) ?: return null
        val thumbnail = findById(ownerId) ?: return null
        database.touch(source.parent.orEmpty(), id)
        return thumbnail
    }

    fun isThumbnailFile(source: File): Boolean = isExcludedPath(source)

    fun store(source: File, thumbnail: File): File = synchronized(LOCK) {
        val id = thumbnailId(source)
        val cached = write(id, thumbnail)
        database.touch(source.parent.orEmpty(), id)
        return cached
    }

    fun reconcileDirectory(directory: File) = synchronized(LOCK) {
        if (isExcludedPath(directory)) {
            removeOrphanFiles()
            return
        }

        val path = directory.absolutePath
        if (!directory.isDirectory) {
            deletePath(path)
            return
        }

        database.touchDirectory(path)
        val currentIds = directory.listFiles()
            ?.filter { it.isFile && !isExcludedPath(it) && supportsThumbnail(it) }
            ?.map(::thumbnailId)
            ?.toSet()
            .orEmpty()
        database.ids(path).filterNot(currentIds::contains).forEach(::delete)
        database.touch(path, currentIds)
        removeOrphanFiles()
    }

    fun cleanupInactive(cutoff: Long) = synchronized(LOCK) {
        database.inactiveDirectories(cutoff).forEach { path ->
            val directory = File(path)
            if (!directory.isDirectory) {
                deletePath(path)
                return@forEach
            }

            reconcileDirectory(directory)
        }
        removeOrphanFiles()
    }

    fun snapshot(source: File): List<ThumbnailSnapshot> = synchronized(LOCK) {
        val root = source.canonicalFile
        if (isExcludedPath(root)) {
            return emptyList()
        }

        if (root.isFile) {
            return snapshotFile(root, "")
        }

        if (!root.isDirectory) {
            return emptyList()
        }

        root.walkTopDown().filter(File::isFile).flatMap { file ->
            snapshotFile(file, file.relativeTo(root).path).asSequence()
        }.toList()
    }

    fun copy(snapshot: List<ThumbnailSnapshot>, destination: File) = synchronized(LOCK) {
        snapshot.forEach { entry ->
            val target = if (entry.relativePath.isEmpty()) destination else File(destination, entry.relativePath)
            if (!target.isFile) {
                return@forEach
            }

            runCatching {
                val id = thumbnailId(target)
                database.copy(entry.id, target.parent.orEmpty(), id)
            }
        }
    }

    fun delete(snapshot: List<ThumbnailSnapshot>) = synchronized(LOCK) {
        snapshot.forEach { entry -> delete(entry.id) }
    }

    fun move(snapshot: List<ThumbnailSnapshot>, source: File, destination: File) = synchronized(LOCK) {
        snapshot.forEach { entry ->
            val target = if (entry.relativePath.isEmpty()) destination else File(destination, entry.relativePath)
            if (!target.isFile) {
                return@forEach
            }

            move(entry.id, thumbnailId(target), target.parent.orEmpty())
        }
        deletePath(source.absolutePath)
    }

    fun deletePath(path: String) = synchronized(LOCK) {
        database.paths(path).sortedByDescending(String::length).forEach { directory ->
            database.ids(directory).forEach(::delete)
            database.deleteDirectory(directory)
        }
    }

    fun close() {
        database.close()
    }

    private fun snapshotFile(file: File, relativePath: String): List<ThumbnailSnapshot> {
        if (isExcludedPath(file) || !supportsThumbnail(file)) {
            return emptyList()
        }

        val id = thumbnailId(file)
        val ownerId = database.ownerId(id)
        if (ownerId == null || findById(ownerId) == null) {
            return emptyList()
        }

        return listOf(ThumbnailSnapshot(id, relativePath))
    }

    private fun write(id: String, source: File): File {
        var directory = writableCacheDirectory()
        if (directory == null) {
            trim()
            directory = writableCacheDirectory()
        }
        if (directory == null) {
            throw IllegalStateException("No hay espacio disponible para crear la miniatura")
        }

        val target = File(directory, "$id.jpg")
        val pending = File(directory, "$id.pending")
        try {
            source.copyTo(pending, overwrite = true)
            if (!pending.renameTo(target)) {
                throw IllegalStateException("No se pudo finalizar la miniatura")
            }

            return target
        } finally {
            pending.delete()
        }
    }

    private fun delete(id: String) {
        var rename: Pair<File, File>? = null
        try {
            database.delete(id) { ownerId, replacementId ->
                val source = findById(ownerId) ?: return@delete false
                val replacement = File(source.parentFile, "$replacementId.jpg")
                if (replacement == source) {
                    return@delete true
                }

                if (replacement.exists() || !source.renameTo(replacement)) {
                    return@delete false
                }

                rename = source to replacement
                true
            }
            removeOrphanFiles()
        } catch (error: Throwable) {
            rename?.let { (source, replacement) ->
                if (replacement.isFile && !source.exists()) {
                    replacement.renameTo(source)
                }
            }
            throw error
        }
    }

    private fun move(sourceId: String, destinationId: String, destinationDirectory: String) {
        var rename: Pair<File, File>? = null
        try {
            database.move(sourceId, destinationDirectory, destinationId) { ownerId ->
                val source = findById(ownerId) ?: return@move false
                val destination = File(source.parentFile, "$destinationId.jpg")
                if (destination == source) {
                    return@move true
                }

                if (destination.exists() || !source.renameTo(destination)) {
                    return@move false
                }

                rename = source to destination
                true
            }
        } catch (error: Throwable) {
            rename?.let { (source, destination) ->
                if (destination.isFile && !source.exists()) {
                    destination.renameTo(source)
                }
            }
            throw error
        }
    }

    private fun trim() {
        database.oldestIds().forEach { id ->
            if (writableCacheDirectory() != null) {
                return
            }

            delete(id)
        }
    }

    private fun removeOrphanFiles() {
        cacheDirectories().forEach { directory ->
            directory.listFiles()?.forEach { file ->
                if (file.extension == "jpg" && !database.exists(file.nameWithoutExtension)) {
                    file.delete()
                }
                if (file.extension == "pending") {
                    file.delete()
                }
            }
        }
    }

    private fun findById(id: String): File? {
        return cacheDirectories().firstOrNull { File(it, "$id.jpg").isFile }?.let { File(it, "$id.jpg") }
    }

    private fun writableCacheDirectory(): File? = cacheDirectories().firstOrNull { availableBytes(it) > 0 }

    private fun cacheDirectories(): List<File> = storageDirectories().map { File(it, CACHE_DIRECTORY).apply { mkdirs() } }

    private fun storageDirectories(): List<File> {
        return listOf(context.filesDir)
    }

    private fun availableBytes(directory: File): Long = runCatching { StatFs(directory.absolutePath).availableBytes }.getOrDefault(0)

    private fun supportsThumbnail(file: File): Boolean {
        val mimeType = MimeTypeMap.getSingleton().getMimeTypeFromExtension(file.extension.lowercase()).orEmpty()
        return mimeType.startsWith("image/") || mimeType.startsWith("video/")
    }

    private fun isExcludedPath(file: File): Boolean {
        val path = file.absolutePath
        return (cacheDirectories() + appMediaCacheDirectories()).any { directory ->
            val cachePath = directory.absolutePath
            path == cachePath || path.startsWith("$cachePath${File.separator}")
        }
    }

    private fun appMediaCacheDirectories(): List<File> {
        return context.externalMediaDirs.filterNotNull().map { File(it, CACHE_DIRECTORY) }
    }

    private fun thumbnailId(file: File): String {
        val value = "${file.absolutePath}:${file.length()}:${file.lastModified()}"
        return MessageDigest.getInstance("SHA-256").digest(value.toByteArray()).joinToString("") { "%02x".format(it) }
    }

    companion object {
        private const val CACHE_DIRECTORY = ".thumbnails"
        private val LOCK = Any()
    }
}

data class ThumbnailSnapshot(val id: String, val relativePath: String)

private class ThumbnailStore(helper: ExplorerDatabaseHelper) {
    private val helper: ExplorerDatabaseHelper

    init {
        this.helper = helper
    }

    fun touch(directory: String, id: String) {
        val now = System.currentTimeMillis()
        helper.writableDatabase.beginTransaction()
        try {
            touchDirectory(directory, now)
            val parentId = parentId(id)
            if (parentId == null) {
                helper.writableDatabase.insertWithOnConflict(
                    "thumbnails", null, ContentValues().apply {
                        put("id", id)
                        put("directory_path", directory)
                        putNull("parent_id")
                        put("last_accessed_at", now)
                    }, SQLiteDatabase.CONFLICT_IGNORE
                )
            }
            helper.writableDatabase.update(
                "thumbnails", ContentValues().apply { put("last_accessed_at", now) }, "id = ?", arrayOf(id)
            )
            helper.writableDatabase.setTransactionSuccessful()
        } finally {
            helper.writableDatabase.endTransaction()
        }
    }

    fun touch(directory: String, ids: Set<String>) {
        val now = System.currentTimeMillis()
        helper.writableDatabase.beginTransaction()
        try {
            touchDirectory(directory, now)
            ids.forEach { id ->
                helper.writableDatabase.update(
                    "thumbnails", ContentValues().apply { put("last_accessed_at", now) }, "id = ?", arrayOf(id)
                )
            }
            helper.writableDatabase.setTransactionSuccessful()
        } finally {
            helper.writableDatabase.endTransaction()
        }
    }

    fun copy(sourceId: String, directory: String, id: String) {
        val parentId = ownerId(sourceId) ?: return
        val now = System.currentTimeMillis()
        helper.writableDatabase.beginTransaction()
        try {
            touchDirectory(directory, now)
            helper.writableDatabase.insertWithOnConflict(
                "thumbnails", null, ContentValues().apply {
                    put("id", id)
                    put("directory_path", directory)
                    put("parent_id", parentId)
                    put("last_accessed_at", now)
                }, SQLiteDatabase.CONFLICT_REPLACE
            )
            helper.writableDatabase.setTransactionSuccessful()
        } finally {
            helper.writableDatabase.endTransaction()
        }
    }

    fun move(sourceId: String, directory: String, id: String, renameOwner: (String) -> Boolean) {
        val record = record(sourceId) ?: return
        val ownerId = ownerId(sourceId) ?: return
        if (record.parentId == null && !renameOwner(ownerId)) {
            return
        }

        val now = System.currentTimeMillis()
        helper.writableDatabase.beginTransaction()
        try {
            touchDirectory(directory, now)
            if (record.parentId == null) {
                helper.writableDatabase.execSQL("UPDATE thumbnails SET parent_id = id WHERE parent_id = ?", arrayOf(sourceId))
                helper.writableDatabase.update(
                    "thumbnails", ContentValues().apply {
                        put("id", id)
                        put("directory_path", directory)
                        put("last_accessed_at", now)
                    }, "id = ?", arrayOf(sourceId)
                )
                helper.writableDatabase.update("thumbnails", ContentValues().apply { put("parent_id", id) }, "parent_id = id AND id != ?", arrayOf(id))
            } else {
                helper.writableDatabase.update(
                    "thumbnails", ContentValues().apply {
                        put("id", id)
                        put("directory_path", directory)
                        put("last_accessed_at", now)
                    }, "id = ?", arrayOf(sourceId)
                )
            }
            helper.writableDatabase.setTransactionSuccessful()
        } finally {
            helper.writableDatabase.endTransaction()
        }
    }

    fun touchDirectory(directory: String) = touchDirectory(directory, System.currentTimeMillis())

    fun ownerId(id: String): String? {
        var current = id
        while (true) {
            val record = record(current) ?: return null
            val parentId = record.parentId ?: return current
            current = parentId
        }
    }

    fun exists(id: String): Boolean = record(id) != null

    fun ids(directory: String): List<String> = queryStrings("thumbnails", "id", "directory_path = ?", arrayOf(directory))

    fun paths(root: String): List<String> {
        val escaped = root.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        return queryStrings("thumbnail_directories", "path", "path = ? OR path LIKE ? ESCAPE '\\'", arrayOf(root, "$escaped${File.separator}%"))
    }

    fun oldestIds(): List<String> = queryStrings("thumbnails", "id", "parent_id IS NULL", null, "last_accessed_at ASC")

    fun inactiveDirectories(cutoff: Long): List<String> = queryStrings(
        "thumbnail_directories", "path", "last_accessed_at <= ?", arrayOf(cutoff.toString()), "last_accessed_at ASC"
    )

    fun delete(id: String, renameOwner: (String, String) -> Boolean) {
        val record = record(id) ?: return
        if (record.parentId != null) {
            helper.writableDatabase.delete("thumbnails", "id = ?", arrayOf(id))
            return
        }

        val replacementId = queryStrings("thumbnails", "id", "parent_id = ?", arrayOf(id)).firstOrNull()
        if (replacementId == null) {
            helper.writableDatabase.delete("thumbnails", "id = ?", arrayOf(id))
            return
        }

        if (!renameOwner(id, replacementId)) {
            return
        }
        helper.writableDatabase.beginTransaction()
        try {
            helper.writableDatabase.update("thumbnails", ContentValues().apply { put("parent_id", replacementId) }, "parent_id = ?", arrayOf(id))
            helper.writableDatabase.update("thumbnails", ContentValues().apply { putNull("parent_id") }, "id = ?", arrayOf(replacementId))
            helper.writableDatabase.delete("thumbnails", "id = ?", arrayOf(id))
            helper.writableDatabase.setTransactionSuccessful()
        } finally {
            helper.writableDatabase.endTransaction()
        }
    }

    fun deleteDirectory(path: String) {
        helper.writableDatabase.delete("thumbnail_directories", "path = ?", arrayOf(path))
    }

    fun close() {
        helper.close()
    }

    private fun parentId(id: String): String? = record(id)?.parentId

    private fun record(id: String): ThumbnailRecord? {
        return helper.readableDatabase.query(
            "thumbnails", arrayOf("id", "parent_id"), "id = ?", arrayOf(id), null, null, null, "1"
        ).use { cursor ->
            if (!cursor.moveToFirst()) {
                return null
            }

            ThumbnailRecord(cursor.getString(0), cursor.getString(1))
        }
    }

    private fun touchDirectory(directory: String, now: Long) {
        helper.writableDatabase.insertWithOnConflict(
            "thumbnail_directories", null, ContentValues().apply {
                put("path", directory)
                put("last_accessed_at", now)
            }, SQLiteDatabase.CONFLICT_IGNORE
        )
        helper.writableDatabase.update(
            "thumbnail_directories", ContentValues().apply { put("last_accessed_at", now) }, "path = ?", arrayOf(directory)
        )
    }

    private fun queryStrings(table: String, column: String, where: String?, arguments: Array<String>?, orderBy: String? = null): List<String> {
        return helper.readableDatabase.query(table, arrayOf(column), where, arguments, null, null, orderBy).use { cursor ->
            buildList {
                while (cursor.moveToNext()) {
                    add(cursor.getString(0))
                }
            }
        }
    }

    private data class ThumbnailRecord(val id: String, val parentId: String?)
}
