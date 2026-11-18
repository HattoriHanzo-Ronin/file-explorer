package com.hhrcore.fileexplorer.operation

import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.hhrcore.fileexplorer.dependencies.NativeDependencies
import com.hhrcore.fileexplorer.operation.store.OperationStore
import com.hhrcore.fileexplorer.sharing.SharedFileCleanup
import com.hhrcore.fileexplorer.thumbnail.cache.ThumbnailCache
import java.io.File
import java.util.UUID
import org.json.JSONObject

/**
 * File operation module
 *
 * @author HattoriHanzo-Ronin
 */
class FileOperationModule(context: ReactApplicationContext, dependencies: NativeDependencies) : ReactContextBaseJavaModule(context) {
    private val context: ReactApplicationContext
    private val dependencies: NativeDependencies
    private val store: OperationStore
    private val thumbnailCache: ThumbnailCache
    private val mediaIndex: MediaIndex
    private val sharedFileCleanup: SharedFileCleanup

    init {
        this.context = context
        this.dependencies = dependencies
        store = dependencies.createOperationStore()
        thumbnailCache = dependencies.createThumbnailCache()
        mediaIndex = dependencies.createMediaIndex()
        sharedFileCleanup = SharedFileCleanup(context)
    }

    override fun getName() = "FileOperation"

    /**
     * Returns the entries in a local directory
     *
     * @param path Local entry path
     * @param promise Receives the operation result
     */
    @ReactMethod
    fun readDir(path: String, promise: Promise) {
        Thread {
            try {
                val directory = File(path)
                if (!directory.isDirectory) {
                    throw IllegalArgumentException("La ruta no es una carpeta")
                }

                thumbnailCache.reconcileDirectory(directory)
                val children = directory.listFiles() ?: throw IllegalStateException("No se pudo leer ${directory.path}")
                val entries = Arguments.createArray().apply {
                    children.forEach { entry ->
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

    /**
     * Creates a local directory when its path is available
     *
     * @param destination Destination directory
     * @param name Requested name
     * @param promise Receives the operation result
     */
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

    /**
     * Renames a local entry when its path is available
     *
     * @param path Local entry path
     * @param name Requested name
     * @param promise Receives the operation result
     */
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

            val sourceMediaPaths = mediaIndex.paths(source)
            val snapshot = runCatching { thumbnailCache.snapshot(source) }
                .onFailure { Log.w(LOG_TAG, "Could not snapshot thumbnails before rename", it) }
                .getOrDefault(emptyList())
            val target = AtomicFiles.rename(source, destination, name, owner)
            try {
                runCatching { thumbnailCache.move(snapshot, source, target) }
                    .onFailure { Log.w(LOG_TAG, "Could not update thumbnails after rename", it) }
            } finally {
                mediaIndex.scan(MediaIndexChange(sourceMediaPaths, listOf(target)))
            }
            promise.resolve(true)
        } catch (error: Throwable) {
            promise.reject("LOCAL_RENAME_FAILED", error.message, error)
        } finally {
            LocalPathLocks.release(owner)
        }
    }

    /**
     * Starts a local directory creation
     *
     * @param options Operation request options
     * @param promise Receives the operation result
     */
    @ReactMethod
    fun startLocalMkdir(options: ReadableMap, promise: Promise) = start(options, FileOperationRecord.OPERATION_LOCAL_MKDIR, promise)

    /**
     * Starts a local rename
     *
     * @param options Operation request options
     * @param promise Receives the operation result
     */
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

    /**
     * Starts an upload
     *
     * @param options Operation request options
     * @param promise Receives the operation result
     */
    @ReactMethod
    fun startUpload(options: ReadableMap, promise: Promise) = start(options, FileOperationRecord.OPERATION_UPLOAD, promise)

    /**
     * Starts a download
     *
     * @param options Operation request options
     * @param promise Receives the operation result
     */
    @ReactMethod
    fun startDownload(options: ReadableMap, promise: Promise) = start(options, FileOperationRecord.OPERATION_DOWNLOAD, promise)

    /**
     * Starts a remote directory creation
     *
     * @param options Operation request options
     * @param promise Receives the operation result
     */
    @ReactMethod
    fun startRemoteMkdir(options: ReadableMap, promise: Promise) = start(options, FileOperationRecord.OPERATION_REMOTE_MKDIR, promise)

    /**
     * Starts a remote rename
     *
     * @param options Operation request options
     * @param promise Receives the operation result
     */
    @ReactMethod
    fun startRemoteRename(options: ReadableMap, promise: Promise) = start(options, FileOperationRecord.OPERATION_REMOTE_RENAME, promise)

    /**
     * Starts a remote deletion
     *
     * @param options Operation request options
     * @param promise Receives the operation result
     */
    @ReactMethod
    fun startRemoteDelete(options: ReadableMap, promise: Promise) =
        start(options, FileOperationRecord.OPERATION_REMOTE_DELETE, promise)

    /**
     * Starts a remote move
     *
     * @param options Operation request options
     * @param promise Receives the operation result
     */
    @ReactMethod
    fun startRemoteMove(options: ReadableMap, promise: Promise) =
        start(options, FileOperationRecord.OPERATION_REMOTE_MOVE, promise)

    /**
     * Starts a remote copy
     *
     * @param options Operation request options
     * @param promise Receives the operation result
     */
    @ReactMethod
    fun startRemoteCopy(options: ReadableMap, promise: Promise) =
        start(options, FileOperationRecord.OPERATION_REMOTE_COPY, promise)

    /**
     * Starts a local copy
     *
     * @param options Operation request options
     * @param promise Receives the operation result
     */
    @ReactMethod
    fun startLocalCopy(options: ReadableMap, promise: Promise) = start(options, FileOperationRecord.OPERATION_LOCAL_COPY, promise)

    /**
     * Starts a local move
     *
     * @param options Operation request options
     * @param promise Receives the operation result
     */
    @ReactMethod
    fun startLocalMove(options: ReadableMap, promise: Promise) = start(options, FileOperationRecord.OPERATION_LOCAL_MOVE, promise)

    /**
     * Starts a local deletion
     *
     * @param options Operation request options
     * @param promise Receives the operation result
     */
    @ReactMethod
    fun startLocalDelete(options: ReadableMap, promise: Promise) = start(options, FileOperationRecord.OPERATION_LOCAL_DELETE, promise)

    /**
     * Starts a local extraction
     *
     * @param options Operation request options
     * @param promise Receives the operation result
     */
    @ReactMethod
    fun startLocalExtract(options: ReadableMap, promise: Promise) = start(options, FileOperationRecord.OPERATION_LOCAL_EXTRACT, promise)

    /**
     * Cancels a file operation
     *
     * @param id Operation identifier
     */
    @ReactMethod
    fun cancel(id: String) {
        val record = store.get(id) ?: return
        if (FileOperationRecord.isCancellable(record.operation)) {
            FileOperationService.cancel(context, id)
        }
    }

    /**
     * Returns persisted file operations
     *
     * @param promise Receives the operation result
     */
    @ReactMethod
    fun listOperations(promise: Promise) {
        Thread {
            try {
                val engine = dependencies.createFileOperationEngine(store, {}, thumbnailCache)
                val snapshot = store.reconcileInterrupted(engine::reconcile)
                runCatching { sharedFileCleanup.cleanupExpired() }
                    .onFailure { Log.w(LOG_TAG, "Could not clean expired shares", it) }
                promise.resolve(snapshot)
            } catch (error: Throwable) {
                promise.reject("FILE_OPERATION_RESTORE_FAILED", error.message, error)
            }
        }.start()
    }

    /** Deletes settled file operations */
    @ReactMethod
    fun clearSettled() {
        store.removeSettled()
    }

    /**
     * Provides the listener hook required by React Native
     *
     * @param eventName Event name
     */
    @ReactMethod
    fun addListener(eventName: String) = Unit

    /**
     * Provides the listener removal hook required by React Native
     *
     * @param count Number of listeners
     */
    @ReactMethod
    fun removeListeners(count: Double) = Unit

    private fun start(options: ReadableMap, operation: String, promise: Promise): Unit {
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
                    FileOperationRecord.OPERATION_REMOTE_COPY,
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
            synchronized(SharedFileCleanup.LOCK) {
                OperationRegistry.markActive(record.id)
                if (operation == FileOperationRecord.OPERATION_UPLOAD) {
                    runCatching {
                        val entries = request.getJSONArray("entries")
                        sharedFileCleanup.touch((0 until entries.length()).map { entries.getJSONObject(it).getString("path") })
                    }.onFailure { Log.w(LOG_TAG, "Could not record shared upload activity", it) }
                }
                store.save(record)
            }
            FileOperationEvents.emit(record)
            FileOperationService.start(context, record.id, token)
            promise.resolve(record.id)
        } catch (error: Throwable) {
            operationId?.let(OperationRegistry::markInactive)
            promise.reject("FILE_OPERATION_START_FAILED", error.message, error)
        }
    }

    private companion object {
        const val LOG_TAG = "FileOperationModule"
    }
}
