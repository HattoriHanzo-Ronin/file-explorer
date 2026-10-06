package com.hhrcore.fileexplorer.operation

import org.json.JSONArray
import org.json.JSONObject

data class FileOperationRecord(
    val id: String,
    val operation: String,
    val request: JSONObject,
    val notificationTexts: JSONObject,
    var status: String = STATUS_PENDING,
    var bytesTransferred: Long = 0,
    var totalBytes: Long = 0,
    var currentFileName: String? = null,
    var apiSessionId: String? = null,
    var error: JSONObject? = null,
    var result: JSONObject? = null,
    var revision: Long = 0,
    val createdAt: Long = System.currentTimeMillis(),
    var updatedAt: Long = createdAt,
    val createdPaths: MutableList<String> = mutableListOf()
) {
    fun toJson(): JSONObject = JSONObject()
        .put("id", id)
        .put("operation", operation)
        .put("request", request)
        .put("notificationTexts", notificationTexts)
        .put("status", status)
        .put("bytesTransferred", bytesTransferred)
        .put("totalBytes", totalBytes)
        .put("currentFileName", currentFileName)
        .put("apiSessionId", apiSessionId)
        .put("error", error ?: JSONObject.NULL)
        .put("result", result ?: JSONObject.NULL)
        .put("revision", revision)
        .put("createdAt", createdAt)
        .put("updatedAt", updatedAt)
        .put("createdPaths", JSONArray(createdPaths))

    companion object {
        const val OPERATION_UPLOAD = "UPLOAD"
        const val OPERATION_DOWNLOAD = "DOWNLOAD"
        const val OPERATION_REMOTE_MOVE = "REMOTE_MOVE"
        const val OPERATION_REMOTE_DELETE = "REMOTE_DELETE"
        const val OPERATION_LOCAL_COPY = "LOCAL_COPY"
        const val OPERATION_LOCAL_MOVE = "LOCAL_MOVE"
        const val OPERATION_LOCAL_DELETE = "LOCAL_DELETE"
        const val OPERATION_LOCAL_EXTRACT = "LOCAL_EXTRACT"
        const val STATUS_PENDING = "PENDING"
        const val STATUS_RUNNING = "RUNNING"
        const val STATUS_COMPLETED = "COMPLETED"
        const val STATUS_FAILED = "FAILED"
        const val STATUS_CANCELLED = "CANCELLED"
        const val STATUS_INTERRUPTED = "INTERRUPTED"

        fun isCancellable(operation: String) = operation == OPERATION_UPLOAD ||
            operation == OPERATION_DOWNLOAD || operation == OPERATION_LOCAL_COPY ||
            operation == OPERATION_LOCAL_MOVE || operation == OPERATION_LOCAL_EXTRACT

        fun fromJson(source: JSONObject): FileOperationRecord {
            val paths = source.optJSONArray("createdPaths") ?: JSONArray()
            return FileOperationRecord(
                id = source.getString("id"),
                operation = source.optString("operation").takeIf { it.isNotEmpty() }
                    ?: source.getString("direction"),
                request = source.getJSONObject("request"),
                notificationTexts = source.optJSONObject("notificationTexts") ?: JSONObject(),
                status = source.optString("status", STATUS_PENDING),
                bytesTransferred = source.optLong("bytesTransferred"),
                totalBytes = source.optLong("totalBytes"),
                currentFileName = source.optString("currentFileName").takeIf { it.isNotEmpty() && it != "null" },
                apiSessionId = source.optString("apiSessionId").takeIf { it.isNotEmpty() && it != "null" },
                error = source.optJSONObject("error"),
                result = source.optJSONObject("result"),
                revision = source.optLong("revision"),
                createdAt = source.optLong("createdAt", System.currentTimeMillis()),
                updatedAt = source.optLong("updatedAt", System.currentTimeMillis()),
                createdPaths = MutableList(paths.length()) { paths.getString(it) }
            )
        }
    }
}
