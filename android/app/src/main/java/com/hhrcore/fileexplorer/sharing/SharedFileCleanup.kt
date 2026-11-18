package com.hhrcore.fileexplorer.sharing

import android.content.Context
import android.os.Environment
import com.hhrcore.fileexplorer.BuildConfig
import com.hhrcore.fileexplorer.operation.FileOperationRecord
import com.hhrcore.fileexplorer.operation.OperationRegistry
import com.hhrcore.fileexplorer.operation.impl.SqliteOperationStore
import org.json.JSONObject
import java.io.File

/**
 * Cleans up temporary files received from other applications
 *
 * @author HattoriHanzo-Ronin
 */
class SharedFileCleanup(context: Context) {
    private val context = context.applicationContext
    private val privateDirectory = File(this.context.filesDir, "shared").canonicalFile
    private val publicDirectory = File(
        Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), "FileExplorer-shared"
    ).canonicalFile
    internal val sharedDirectory = if (BuildConfig.DEBUG) publicDirectory else privateDirectory
    private val sharedDirectories = setOf(privateDirectory, publicDirectory)

    /**
     * Registers a received share
     *
     * @param shareId Share identifier
     */
    fun register(shareId: String): Unit = synchronized(LOCK) {
        val store = SqliteOperationStore(context)
        try {
            val id = shareRecordId(shareId)
            store.save(FileOperationRecord(id, FileOperationRecord.OPERATION_SHARED, JSONObject().put("shareId", shareId).put("directory", sharedDirectory.path), JSONObject()))
            OperationRegistry.markActive(id)
        } finally {
            store.close()
        }
    }

    /**
     * Records activity for received files
     *
     * @param paths Received file paths
     */
    fun touch(paths: List<String>): Unit = synchronized(LOCK) {
        val store = SqliteOperationStore(context)
        try {
            directories(paths).forEach { directory ->
                val record = store.get(shareRecordId(directory.name))
                if (record?.status == FileOperationRecord.STATUS_PENDING) {
                    store.save(record)
                }
            }
        } finally {
            store.close()
        }
    }

    /**
     * Marks the preparation of a share as finished
     *
     * @param shareId Share identifier
     */
    fun finishPreparation(shareId: String): Unit = synchronized(LOCK) {
        try {
            val store = SqliteOperationStore(context)
            try {
                val record = store.get(shareRecordId(shareId))
                if (record?.status == FileOperationRecord.STATUS_PENDING) {
                    store.save(record)
                }
            } finally {
                store.close()
            }
        } finally {
            OperationRegistry.markInactive(shareRecordId(shareId))
        }
    }

    /**
     * Deletes the temporary directories containing the supplied files
     *
     * @param paths Received file paths
     */
    fun cleanup(paths: List<String>): Unit = synchronized(LOCK) {
        val store = SqliteOperationStore(context)
        try {
            directories(paths).forEach { directory ->
                check(!directory.exists() || directory.deleteRecursively()) { "No se pudo limpiar ${directory.path}" }
                val record = store.get(shareRecordId(directory.name))
                if (record != null) {
                    record.status = FileOperationRecord.STATUS_COMPLETED
                    store.save(record)
                }
            }
        } finally {
            store.close()
        }
    }

    /** Deletes expired shares that are not being prepared or uploaded */
    fun cleanupExpired(): Unit = synchronized(LOCK) {
        val store = SqliteOperationStore(context)
        try {
            val records = store.list()
            val activeDirectories = records.filter {
                it.operation == FileOperationRecord.OPERATION_UPLOAD &&
                    (it.status == FileOperationRecord.STATUS_PENDING || it.status == FileOperationRecord.STATUS_RUNNING || OperationRegistry.isActive(it.id))
            }.flatMap { operation ->
                val entries = operation.request.optJSONArray("entries") ?: return@flatMap emptyList()
                val paths = (0 until entries.length()).mapNotNull { entries.optJSONObject(it)?.optString("path") }
                directories(paths)
            }.toSet()
            val cutoff = System.currentTimeMillis() - if (BuildConfig.DEBUG) DEBUG_EXPIRY_MS else EXPIRY_MS
            records.filter {
                it.operation == FileOperationRecord.OPERATION_SHARED && it.status == FileOperationRecord.STATUS_PENDING &&
                    it.updatedAt <= cutoff && !OperationRegistry.isActive(it.id)
            }.forEach { record ->
                val shareId = record.request.getString("shareId")
                val root = File(record.request.optString("directory", privateDirectory.path)).canonicalFile
                val directory = File(root, shareId).canonicalFile
                if (root in sharedDirectories && directory.parentFile == root && directory !in activeDirectories) {
                    if (!directory.exists() || directory.deleteRecursively()) {
                        record.status = FileOperationRecord.STATUS_COMPLETED
                        store.save(record)
                    }
                }
            }
        } finally {
            store.close()
        }
    }

    private fun directories(paths: List<String>): Set<File> = paths.mapNotNull { path ->
        val parent = File(path).canonicalFile.parentFile ?: return@mapNotNull null
        val grandparent = parent.parentFile ?: return@mapNotNull null
        if (grandparent in sharedDirectories) {
            return@mapNotNull parent
        }

        grandparent.takeIf { it.parentFile?.let(sharedDirectories::contains) == true }
    }.toSet()

    private fun shareRecordId(shareId: String): String = "share:$shareId"

    companion object {
        internal val LOCK = Any()
        private const val DEBUG_EXPIRY_MS = 3 * 60 * 1000L
        private const val EXPIRY_MS = 15 * 60 * 1000L
    }
}
