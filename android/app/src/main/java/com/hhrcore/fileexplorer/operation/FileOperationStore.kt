package com.hhrcore.fileexplorer.operation

import android.content.Context
import org.json.JSONArray

class FileOperationStore(context: Context) {
    private val preferences = context.getSharedPreferences("file_transfers", Context.MODE_PRIVATE)

    @Synchronized
    fun save(record: FileOperationRecord) {
        record.revision = preferences.getLong(REVISION_KEY, 0) + 1
        record.updatedAt = System.currentTimeMillis()
        preferences.edit()
            .putLong(REVISION_KEY, record.revision)
            .putString(record.id, record.toJson().toString())
            .commit()
    }

    @Synchronized
    fun get(id: String): FileOperationRecord? {
        val source = preferences.getString(id, null) ?: return null
        return runCatching { FileOperationRecord.fromJson(org.json.JSONObject(source)) }.getOrNull()
    }

    @Synchronized
    fun list(): List<FileOperationRecord> = preferences.all
        .filterKeys { it != REVISION_KEY }
        .values
        .mapNotNull { value ->
            (value as? String)?.let { runCatching { FileOperationRecord.fromJson(org.json.JSONObject(it)) }.getOrNull() }
        }
        .sortedBy { it.revision }

    @Synchronized
    fun snapshot(): String = JSONArray(list().map { it.toJson() }).toString()

    @Synchronized
    fun removeSettled() {
        val settledIds = list()
            .filter { it.status !in ACTIVE_STATUSES }
            .map(FileOperationRecord::id)
        if (settledIds.isEmpty()) {
            return
        }

        val editor = preferences.edit()
        settledIds.forEach(editor::remove)
        editor.commit()
    }

    companion object {
        private const val REVISION_KEY = "__revision__"
        private val ACTIVE_STATUSES = setOf(FileOperationRecord.STATUS_PENDING, FileOperationRecord.STATUS_RUNNING)
    }
}
