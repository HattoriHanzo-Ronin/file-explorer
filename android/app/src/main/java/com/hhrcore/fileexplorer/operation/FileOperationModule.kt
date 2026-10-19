package com.hhrcore.fileexplorer.operation

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import org.json.JSONObject
import java.util.UUID

class FileOperationModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
    private val store = FileOperationStore(context)

    override fun getName() = "FileOperation"

    override fun initialize() {
        super.initialize()
        FileOperationEvents.attach(context)
    }

    @ReactMethod
    fun startUpload(options: ReadableMap, promise: Promise) = start(options, FileOperationRecord.OPERATION_UPLOAD, promise)

    @ReactMethod
    fun startDownload(options: ReadableMap, promise: Promise) = start(options, FileOperationRecord.OPERATION_DOWNLOAD, promise)

    @ReactMethod
    fun startRemoteDelete(options: ReadableMap, promise: Promise) =
        start(options, FileOperationRecord.OPERATION_REMOTE_DELETE, promise)

    @ReactMethod
    fun startRemoteMove(options: ReadableMap, promise: Promise) =
        start(options, FileOperationRecord.OPERATION_REMOTE_MOVE, promise)

    @ReactMethod
    fun startLocalCopy(options: ReadableMap, promise: Promise) = start(options, FileOperationRecord.OPERATION_LOCAL_COPY, promise)

    @ReactMethod
    fun startLocalMove(options: ReadableMap, promise: Promise) = start(options, FileOperationRecord.OPERATION_LOCAL_MOVE, promise)

    @ReactMethod
    fun startLocalDelete(options: ReadableMap, promise: Promise) = start(options, FileOperationRecord.OPERATION_LOCAL_DELETE, promise)

    @ReactMethod
    fun startLocalExtract(options: ReadableMap, promise: Promise) = start(options, FileOperationRecord.OPERATION_LOCAL_EXTRACT, promise)

    @ReactMethod
    fun cancel(id: String) {
        val record = store.get(id) ?: return
        if (FileOperationRecord.isCancellable(record.operation)) {
            FileOperationService.cancel(context, id)
        }
    }

    @ReactMethod
    fun listOperations(promise: Promise) {
        Thread {
            try {
                val engine = FileOperationEngine(store) {}
                val snapshot = store.reconcileInterrupted(engine)
                promise.resolve(snapshot)
            } catch (error: Throwable) {
                promise.reject("FILE_OPERATION_RESTORE_FAILED", error.message, error)
            }
        }.start()
    }

    @ReactMethod
    fun clearSettled() {
        store.removeSettled()
    }

    @ReactMethod
    fun addListener(eventName: String) = Unit

    @ReactMethod
    fun removeListeners(count: Double) = Unit

    private fun start(options: ReadableMap, operation: String, promise: Promise) {
        var operationId: String? = null
        try {
            val request = JSONObject(options.toHashMap())
            val token = request.remove("accessToken") as? String
            if (operation in setOf(
                    FileOperationRecord.OPERATION_UPLOAD,
                    FileOperationRecord.OPERATION_DOWNLOAD,
                    FileOperationRecord.OPERATION_REMOTE_MOVE,
                    FileOperationRecord.OPERATION_REMOTE_DELETE
                ) && token == null
            ) {
                throw IllegalArgumentException("Falta el token de acceso")
            }
            val notificationTexts = request.remove("notificationTexts") as? JSONObject
                ?: throw IllegalArgumentException("Faltan los textos de notificación")
            val record = FileOperationRecord(
                id = UUID.randomUUID().toString(),
                operation = operation,
                request = request,
                notificationTexts = notificationTexts
            )
            operationId = record.id
            FileOperationStore.markActive(record.id)
            store.save(record)
            FileOperationEvents.emit(record)
            FileOperationService.start(context, record.id, token)
            promise.resolve(record.id)
        } catch (error: Throwable) {
            operationId?.let(FileOperationStore::markInactive)
            promise.reject("FILE_OPERATION_START_FAILED", error.message, error)
        }
    }
}
