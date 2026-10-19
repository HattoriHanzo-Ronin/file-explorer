package com.hhrcore.fileexplorer.operation

import android.content.Context
import org.json.JSONArray
import java.util.concurrent.ConcurrentHashMap

class FileOperationStore(context: Context) {
    private val preferences = context.getSharedPreferences("file_transfers", Context.MODE_PRIVATE)

    fun save(record: FileOperationRecord) = synchronized(lock) {
        record.revision = preferences.getLong(REVISION_KEY, 0) + 1
        record.updatedAt = System.currentTimeMillis()
        val saved = preferences.edit()
            .putLong(REVISION_KEY, record.revision)
            .putString(record.id, record.toJson().toString())
            .commit()
        if (!saved) {
            throw IllegalStateException("No se pudo guardar el estado de la operación")
        }
    }

    fun get(id: String): FileOperationRecord? = synchronized(lock) {
        val source = preferences.getString(id, null) ?: return@synchronized null
        runCatching { FileOperationRecord.fromJson(org.json.JSONObject(source)) }.getOrNull()
    }

    fun list(): List<FileOperationRecord> = synchronized(lock) {
        preferences.all
            .filterKeys { it != REVISION_KEY }
            .values
            .mapNotNull { value ->
                (value as? String)?.let { runCatching { FileOperationRecord.fromJson(org.json.JSONObject(it)) }.getOrNull() }
            }
            .sortedBy { it.revision }
    }

    fun reconcileInterrupted(engine: FileOperationEngine): String = synchronized(lock) {
        list().filter { (it.status in ACTIVE_STATUSES || it.moveCommitStarted) && it.id !in activeIds }
            .forEach(engine::reconcile)
        JSONArray(list().map { it.toJson() }).toString()
    }

    fun removeSettled() = synchronized(lock) {
        val settledIds = list()
            .filter { it.status !in ACTIVE_STATUSES && !it.moveCommitStarted }
            .map(FileOperationRecord::id)
        if (settledIds.isEmpty()) {
            return@synchronized
        }

        val editor = preferences.edit()
        settledIds.forEach(editor::remove)
        editor.commit()
    }

    companion object {
        private const val REVISION_KEY = "__revision__"
        private val lock = Any()
        private val activeIds = ConcurrentHashMap.newKeySet<String>()
        private val ACTIVE_STATUSES = setOf(FileOperationRecord.STATUS_PENDING, FileOperationRecord.STATUS_RUNNING)

        fun markActive(id: String) {
            activeIds.add(id)
        }

        fun markInactive(id: String) {
            activeIds.remove(id)
        }
    }
}
