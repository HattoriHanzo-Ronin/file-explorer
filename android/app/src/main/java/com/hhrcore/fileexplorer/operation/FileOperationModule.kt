package com.hhrcore.fileexplorer.operation

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReadableMap
import com.hhrcore.fileexplorer.dependencies.NativeDependencies
import com.hhrcore.fileexplorer.thumbnail.ThumbnailCache
import org.json.JSONObject
import java.io.File
import java.util.UUID

class FileOperationModule(context: ReactApplicationContext, dependencies: NativeDependencies) : ReactContextBaseJavaModule(context) {
    private val context: ReactApplicationContext
    private val dependencies: NativeDependencies
    private val store: OperationStore
    private val thumbnailCache: ThumbnailCache

    init {
        this.context = context
        this.dependencies = dependencies
        store = dependencies.createOperationStore()
        thumbnailCache = dependencies.createThumbnailCache()
    }

    override fun getName() = "FileOperation"

    @ReactMethod
    fun readDir(path: String, promise: Promise) {
        Thread {
            try {
                val directory = File(path)
                if (!directory.isDirectory) {
                    throw IllegalArgumentException("La ruta no es una carpeta")
                }

                thumbnailCache.reconcileDirectory(directory)
                val entries = Arguments.createArray().apply {
                    directory.listFiles()?.forEach { entry ->
                        pushMap(Arguments.createMap().apply {
                            putString("name", entry.name)
                            putString("path", entry.absolutePath)
                            putDouble("size", entry.length().toDouble())
                            putDouble("mtime", entry.lastModified().toDouble())
                            putBoolean("isDirectory", entry.isDirectory)
                        })
                    }
                }
                promise.resolve(entries)
            } catch (error: Throwable) {
                promise.reject("LOCAL_READ_DIR_FAILED", error.message, error)
            }
        }.start()
    }

    @ReactMethod
    fun tryLocalMkdir(destination: String, name: String, promise: Promise) {
        val owner = UUID.randomUUID().toString()
        try {
            val folder = File(destination)
            if (!LocalPathLocks.tryAcquire(owner, listOf(LocalPathLocks.claim(folder, false, false)))) {
                promise.resolve(false)
                return
            }

            AtomicFiles.reserve(folder, name, true, owner)
            promise.resolve(true)
        } catch (error: Throwable) {
            promise.reject("LOCAL_MKDIR_FAILED", error.message, error)
        } finally {
            LocalPathLocks.release(owner)
        }
    }

    @ReactMethod
    fun tryLocalRename(path: String, name: String, promise: Promise) {
        val owner = UUID.randomUUID().toString()
        try {
            val source = File(path)
            val destination = source.parentFile ?: throw IllegalArgumentException("Ruta no válida")
            val claims = listOf(LocalPathLocks.claim(source, true), LocalPathLocks.claim(destination, false, false))
            if (!LocalPathLocks.tryAcquire(owner, claims)) {
                promise.resolve(false)
                return
            }

            val snapshot = thumbnailCache.snapshot(source)
            val target = AtomicFiles.rename(source, destination, name, owner)
            thumbnailCache.move(snapshot, source, target)
            promise.resolve(true)
        } catch (error: Throwable) {
            promise.reject("LOCAL_RENAME_FAILED", error.message, error)
        } finally {
            LocalPathLocks.release(owner)
        }
    }

    @ReactMethod
    fun startLocalMkdir(options: ReadableMap, promise: Promise) = start(options, FileOperationRecord.OPERATION_LOCAL_MKDIR, promise)

    @ReactMethod
    fun startLocalRename(options: ReadableMap, promise: Promise) = start(options, FileOperationRecord.OPERATION_LOCAL_RENAME, promise)

    override fun initialize() {
        super.initialize()
        FileOperationEvents.attach(context)
    }

    override fun invalidate() {
        store.close()
        thumbnailCache.close()
        super.invalidate()
    }

    @ReactMethod
    fun startUpload(options: ReadableMap, promise: Promise) = start(options, FileOperationRecord.OPERATION_UPLOAD, promise)

    @ReactMethod
    fun startDownload(options: ReadableMap, promise: Promise) = start(options, FileOperationRecord.OPERATION_DOWNLOAD, promise)

    @ReactMethod
    fun startRemoteMkdir(options: ReadableMap, promise: Promise) = start(options, FileOperationRecord.OPERATION_REMOTE_MKDIR, promise)

    @ReactMethod
    fun startRemoteRename(options: ReadableMap, promise: Promise) = start(options, FileOperationRecord.OPERATION_REMOTE_RENAME, promise)

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
                val engine = dependencies.createFileOperationEngine(store, {}, thumbnailCache)
                val snapshot = store.reconcileInterrupted(engine::reconcile)
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
                    FileOperationRecord.OPERATION_REMOTE_MKDIR,
                    FileOperationRecord.OPERATION_REMOTE_RENAME,
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
            OperationRegistry.markActive(record.id)
            store.save(record)
            FileOperationEvents.emit(record)
            FileOperationService.start(context, record.id, token)
            promise.resolve(record.id)
        } catch (error: Throwable) {
            operationId?.let(OperationRegistry::markInactive)
            promise.reject("FILE_OPERATION_START_FAILED", error.message, error)
        }
    }
}
