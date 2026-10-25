package com.hhrcore.fileexplorer.operation.impl

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import com.hhrcore.fileexplorer.database.ExplorerDatabaseHelper
import com.hhrcore.fileexplorer.operation.FileOperationRecord
import com.hhrcore.fileexplorer.operation.OperationRegistry
import com.hhrcore.fileexplorer.operation.OperationStore
import org.json.JSONArray
import org.json.JSONObject

class SqliteOperationStore(context: Context) : OperationStore {
    private val helper: ExplorerDatabaseHelper
    private val legacyPreferences = context.getSharedPreferences(LEGACY_PREFERENCES, Context.MODE_PRIVATE)

    init {
        helper = ExplorerDatabaseHelper(context)
        migrateLegacyRecords()
    }

    override fun save(record: FileOperationRecord) = synchronized(lock) {
        val database = helper.writableDatabase
        record.revision = nextRevision(database)
        record.updatedAt = System.currentTimeMillis()
        database.transaction {
            insertWithOnConflict(TABLE, null, record.values(), SQLiteDatabase.CONFLICT_REPLACE)
            saveRecovery(record)
        }
    }

    override fun get(id: String): FileOperationRecord? = synchronized(lock) {
        helper.readableDatabase.query(
            TABLE,
            arrayOf(COLUMN_RECORD),
            "$COLUMN_ID = ?",
            arrayOf(id),
            null,
            null,
            null,
            "1"
        ).use { cursor ->
            if (!cursor.moveToFirst()) {
                return@synchronized null
            }

            FileOperationRecord.fromJson(JSONObject(cursor.getString(0)))
        }
    }

    override fun list(): List<FileOperationRecord> = synchronized(lock) {
        helper.readableDatabase.query(
            TABLE,
            arrayOf(COLUMN_RECORD),
            null,
            null,
            null,
            null,
            "$COLUMN_REVISION ASC"
        ).use { cursor ->
            buildList {
                while (cursor.moveToNext()) {
                    runCatching { FileOperationRecord.fromJson(JSONObject(cursor.getString(0))) }.getOrNull()?.let(::add)
                }
            }
        }
    }

    override fun reconcileInterrupted(reconcile: (FileOperationRecord) -> Unit): String = synchronized(reconciliationLock) {
        list().filter { (it.status in ACTIVE_STATUSES || it.moveCommitStarted || it.cleanupPending || it.pendingStagePath != null) && !OperationRegistry.isActive(it.id) }
            .forEach(reconcile)
        JSONArray(list().map { it.toJson() }).toString()
    }

    override fun removeSettled() = synchronized(lock) {
        val settledIds = list()
            .filter { it.status !in ACTIVE_STATUSES && !it.moveCommitStarted && !it.cleanupPending && it.pendingStagePath == null }
            .map(FileOperationRecord::id)
        if (settledIds.isEmpty()) {
            return@synchronized
        }

        helper.writableDatabase.transaction {
            settledIds.forEach { id -> delete(TABLE, "$COLUMN_ID = ?", arrayOf(id)) }
        }
    }

    override fun close() {
        helper.close()
    }

    private fun migrateLegacyRecords() = synchronized(lock) {
        val records = legacyPreferences.all
            .filterKeys { it != LEGACY_REVISION_KEY }
            .values
            .mapNotNull { value ->
                (value as? String)?.let { runCatching { FileOperationRecord.fromJson(JSONObject(it)) }.getOrNull() }
            }
        if (records.isEmpty()) {
            return@synchronized
        }

        helper.writableDatabase.transaction {
            records.sortedBy(FileOperationRecord::revision).forEach { record ->
                if (record.revision <= 0) {
                    record.revision = nextRevision(this)
                }

                insertWithOnConflict(TABLE, null, record.values(), SQLiteDatabase.CONFLICT_REPLACE)
                saveRecovery(record)
            }
        }
        legacyPreferences.edit().clear().commit()
    }

    private fun nextRevision(database: SQLiteDatabase): Long {
        return database.rawQuery("SELECT COALESCE(MAX($COLUMN_REVISION), 0) + 1 FROM $TABLE", null).use { cursor ->
            cursor.moveToFirst()
            cursor.getLong(0)
        }
    }

    private fun FileOperationRecord.values(): ContentValues {
        return ContentValues().apply {
            put(COLUMN_ID, id)
            put(COLUMN_RECORD, toJson().toString())
            put(COLUMN_REVISION, revision)
            put(COLUMN_STATUS, status)
            put(COLUMN_UPDATED_AT, updatedAt)
        }
    }

    private fun SQLiteDatabase.saveRecovery(record: FileOperationRecord) {
        val recovery = record.recovery() ?: run {
            delete(RECOVERY_TABLE, "$COLUMN_OPERATION_ID = ?", arrayOf(record.id))
            return
        }
        insertWithOnConflict(
            RECOVERY_TABLE,
            null,
            ContentValues().apply {
                put(COLUMN_OPERATION_ID, record.id)
                put(COLUMN_RECOVERY_TYPE, recovery.type)
                put(COLUMN_RECOVERY_STATUS, recovery.status)
                put(COLUMN_UPDATED_AT, record.updatedAt)
            },
            SQLiteDatabase.CONFLICT_REPLACE
        )
    }

    private fun FileOperationRecord.recovery(): OperationRecovery? {
        if (cleanupPending) {
            return OperationRecovery(RECOVERY_CLEANUP, RECOVERY_PENDING)
        }

        if (operation == FileOperationRecord.OPERATION_LOCAL_MOVE && moveCommitStarted) {
            return OperationRecovery(RECOVERY_ROLLBACK, RECOVERY_PENDING)
        }

        if (status !in RECOVERY_STATUSES) {
            return null
        }

        if (operation == FileOperationRecord.OPERATION_LOCAL_MOVE) {
            return OperationRecovery(RECOVERY_ROLLBACK, RECOVERY_COMPLETED)
        }

        if (operation in LOCAL_CLEANUP_OPERATIONS) {
            return OperationRecovery(RECOVERY_CLEANUP, RECOVERY_COMPLETED)
        }

        return null
    }

    private fun SQLiteDatabase.transaction(operation: SQLiteDatabase.() -> Unit) {
        beginTransaction()
        try {
            operation()
            setTransactionSuccessful()
        } finally {
            endTransaction()
        }
    }

    companion object {
        private const val TABLE = "file_operations"
        private const val RECOVERY_TABLE = "file_operation_recovery"
        private const val COLUMN_ID = "id"
        private const val COLUMN_OPERATION_ID = "operation_id"
        private const val COLUMN_RECORD = "record"
        private const val COLUMN_REVISION = "revision"
        private const val COLUMN_STATUS = "status"
        private const val COLUMN_UPDATED_AT = "updated_at"
        private const val COLUMN_RECOVERY_TYPE = "type"
        private const val COLUMN_RECOVERY_STATUS = "status"
        private const val LEGACY_PREFERENCES = "file_transfers"
        private const val LEGACY_REVISION_KEY = "__revision__"
        private val lock = Any()
        private val reconciliationLock = Any()
        private val ACTIVE_STATUSES = setOf(FileOperationRecord.STATUS_PENDING, FileOperationRecord.STATUS_RUNNING)
        private val RECOVERY_STATUSES = setOf(
            FileOperationRecord.STATUS_FAILED,
            FileOperationRecord.STATUS_CANCELLED,
            FileOperationRecord.STATUS_INTERRUPTED
        )
        private val LOCAL_CLEANUP_OPERATIONS = setOf(
            FileOperationRecord.OPERATION_DOWNLOAD,
            FileOperationRecord.OPERATION_LOCAL_COPY,
            FileOperationRecord.OPERATION_LOCAL_EXTRACT
        )
        private const val RECOVERY_CLEANUP = "CLEANUP"
        private const val RECOVERY_ROLLBACK = "ROLLBACK"
        private const val RECOVERY_PENDING = "PENDING"
        private const val RECOVERY_COMPLETED = "COMPLETED"

    }

    private data class OperationRecovery(val type: String, val status: String)
}
