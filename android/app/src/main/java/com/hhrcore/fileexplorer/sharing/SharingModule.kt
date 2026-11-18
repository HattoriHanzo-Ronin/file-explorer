package com.hhrcore.fileexplorer.sharing

import android.content.ClipData
import android.content.Intent
import android.net.Uri
import android.provider.OpenableColumns
import android.util.Log
import android.webkit.MimeTypeMap
import android.widget.Toast
import androidx.core.content.FileProvider
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.WritableArray
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.io.File
import java.io.FileOutputStream
import java.util.UUID
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/**
 * File sharing module
 *
 * @author HattoriHanzo-Ronin
 */
class SharingModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext), ActivityEventListener {
    private val context: ReactApplicationContext
    private val executor: ExecutorService = Executors.newSingleThreadExecutor()
    private val cleanup: SharedFileCleanup
    private val pendingFiles = mutableListOf<SharedFile>()
    private var initialIntentHandled = false
    @Volatile
    private var listenerCount = 0

    init {
        context = reactContext
        cleanup = SharedFileCleanup(context)
        context.addActivityEventListener(this)
    }

    override fun getName() = "Sharing"

    /**
     * Shares local files with another application
     *
     * @param paths Local file paths
     * @param promise Receives the sharing result
     */
    @ReactMethod
    fun share(paths: ReadableArray, promise: Promise) {
        context.runOnUiQueueThread {
            try {
                val files = (0 until paths.size())
                    .mapNotNull(paths::getString)
                    .map(::File)
                    .filter(File::isFile)
                if (files.isEmpty()) {
                    throw IllegalArgumentException("No hay archivos para compartir")
                }

                val uris = files.map(::uriForFile)
                val intent = Intent(if (uris.size == 1) Intent.ACTION_SEND else Intent.ACTION_SEND_MULTIPLE).apply {
                    type = mimeType(files)
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    clipData = ClipData.newUri(context.contentResolver, files.first().name, uris.first())
                    uris.drop(1).forEach { clipData?.addItem(ClipData.Item(it)) }
                    if (uris.size == 1) {
                        putExtra(Intent.EXTRA_STREAM, uris.first())
                    } else {
                        putParcelableArrayListExtra(Intent.EXTRA_STREAM, ArrayList(uris))
                    }
                }
                context.startActivity(Intent.createChooser(intent, "Compartir con").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                promise.resolve(null)
            } catch (error: Throwable) {
                promise.reject("SHARING_FAILED", error.message, error)
            }
        }
    }

    /**
     * Returns received files awaiting processing
     *
     * @param promise Receives the shared files
     */
    @ReactMethod
    fun getReceivedFiles(promise: Promise) {
        executor.execute {
            try {
                if (!initialIntentHandled) {
                    initialIntentHandled = true
                    val files = prepareReceivedFiles(context.currentActivity?.intent)
                    promise.resolve(files.toWritableArray())
                    copyReceivedFiles(files)
                    return@execute
                }
                promise.resolve(takePendingFiles().toWritableArray())
            } catch (error: Throwable) {
                promise.reject("SHARING_RECEIVE_FAILED", error.message, error)
            }
        }
    }

    /**
     * Deletes temporary copies of received files
     *
     * @param paths Temporary file paths
     * @param promise Receives cleanup completion
     */
    @ReactMethod
    fun cleanupReceivedFiles(paths: ReadableArray, promise: Promise) {
        executor.execute {
            try {
                cleanup.cleanup((0 until paths.size()).mapNotNull(paths::getString))
                promise.resolve(null)
            } catch (error: Throwable) {
                promise.reject("SHARING_CLEANUP_FAILED", error.message, error)
            }
        }
    }

    /**
     * Registers a shared file event listener
     *
     * @param eventName Event name
     */
    @ReactMethod
    fun addListener(eventName: String) {
        listenerCount++
    }

    /**
     * Removes shared file event listeners
     *
     * @param count Number of listeners
     */
    @ReactMethod
    fun removeListeners(count: Double) {
        listenerCount = (listenerCount - count.toInt()).coerceAtLeast(0)
    }

    override fun onNewIntent(intent: Intent) {
        initialIntentHandled = true
        executor.execute {
            val files = try {
                prepareReceivedFiles(intent)
            } catch (error: Exception) {
                Log.e("SharingModule", "Could not receive shared files", error)
                context.runOnUiQueueThread {
                    Toast.makeText(context, "No se pudieron recibir los archivos", Toast.LENGTH_LONG).show()
                }
                return@execute
            }
            if (files.isEmpty()) {
                return@execute
            }

            dispatchReceivedFiles(files)
            copyReceivedFiles(files)
        }
    }

    override fun onActivityResult(activity: android.app.Activity, requestCode: Int, resultCode: Int, data: Intent?) = Unit

    override fun invalidate() {
        context.removeActivityEventListener(this)
        executor.shutdownNow()
        super.invalidate()
    }

    private fun takePendingFiles(): List<SharedFile> {
        return synchronized(pendingFiles) {
            val receivedFiles = pendingFiles.toList()
            pendingFiles.clear()
            receivedFiles
        }
    }

    private fun prepareReceivedFiles(intent: Intent?): List<SharedFile> {
        val receivedIntent = intent ?: return emptyList()
        if (receivedIntent.action !in setOf(Intent.ACTION_SEND, Intent.ACTION_SEND_MULTIPLE)) {
            return emptyList()
        }

        val shareId = UUID.randomUUID().toString()
        val files = receivedIntent.sharedUris().map { uri ->
            SharedFile(UUID.randomUUID().toString(), shareId, displayName(uri), uri, null, STATUS_PREPARING)
        }
        if (files.isNotEmpty()) {
            cleanup.register(shareId)
        }

        return files
    }

    private fun copyReceivedFiles(files: List<SharedFile>): Unit {
        val first = files.firstOrNull() ?: return
        executor.execute {
            try {
                val copied = files.map { file ->
                    val result = copyReceivedFile(file)
                    check(result.status == STATUS_READY) { "No se pudo copiar el archivo recibido" }
                    result
                }
                dispatchReceivedFiles(copied)
            } catch (error: Exception) {
                Log.e("SharingModule", "Could not copy shared files", error)
                val path = File(cleanup.sharedDirectory, "${first.shareId}/${first.id}/${first.name}").path
                runCatching { cleanup.cleanup(listOf(path)) }
                    .onFailure { Log.w("SharingModule", "Could not clean shared files", it) }
                dispatchReceivedFiles(files.map { it.copy(status = STATUS_ERROR) })
                context.runOnUiQueueThread {
                    Toast.makeText(context, "No se pudieron recibir los archivos", Toast.LENGTH_LONG).show()
                }
            } finally {
                runCatching { cleanup.finishPreparation(first.shareId) }
                    .onFailure { Log.w("SharingModule", "Could not finish share preparation", it) }
            }
        }
    }

    private fun dispatchReceivedFiles(files: List<SharedFile>): Unit {
        if (listenerCount > 0 && context.hasActiveReactInstance()) {
            context.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java).emit(EVENT_NAME, files.toWritableArray())
            return
        }

        synchronized(pendingFiles) {
            pendingFiles.addAll(files)
        }
    }

    @Suppress("DEPRECATION")
    private fun Intent.sharedUris(): List<Uri> {
        return if (action == Intent.ACTION_SEND) {
            listOfNotNull(getParcelableExtra(Intent.EXTRA_STREAM) ?: clipData?.getItemAt(0)?.uri)
        } else {
            getParcelableArrayListExtra<Uri>(Intent.EXTRA_STREAM).orEmpty().ifEmpty {
                (0 until (clipData?.itemCount ?: 0)).mapNotNull { index -> clipData?.getItemAt(index)?.uri }
            }
        }
    }

    private fun copyReceivedFile(file: SharedFile): SharedFile {
        val directory = File(cleanup.sharedDirectory, "${file.shareId}/${file.id}")
        if (!directory.mkdirs()) {
            return file.copy(status = STATUS_ERROR)
        }

        val target = File(directory, file.name)
        var copied = false
        return try {
            context.contentResolver.openInputStream(file.uri)?.use { input ->
                FileOutputStream(target).use { output -> input.copyTo(output) }
            } ?: throw IllegalStateException("No se pudo abrir el archivo recibido")
            copied = true
            file.copy(path = target.absolutePath, status = STATUS_READY)
        } catch (_: Throwable) {
            file.copy(status = STATUS_ERROR)
        } finally {
            if (!copied) {
                directory.deleteRecursively()
                directory.parentFile?.delete()
            }
        }
    }

    private fun displayName(uri: Uri): String {
        val name = context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
            if (cursor.moveToFirst()) cursor.getString(0) else null
        } ?: uri.lastPathSegment ?: "shared-file"
        return File(name).name.ifEmpty { "shared-file" }
    }

    private fun uriForFile(file: File): Uri {
        return FileProvider.getUriForFile(context, "${context.packageName}.provider", file)
    }

    private fun mimeType(files: List<File>): String {
        val types = files.map { file ->
            MimeTypeMap.getSingleton().getMimeTypeFromExtension(file.extension.lowercase()).orEmpty()
        }.distinct()
        val type = types.singleOrNull()
        return if (type.isNullOrEmpty()) "*/*" else type
    }

    private fun List<SharedFile>.toWritableArray(): WritableArray {
        return Arguments.createArray().apply {
            this@toWritableArray.forEach { file ->
                pushMap(Arguments.createMap().apply {
                    putString("id", file.id)
                    putString("name", file.name)
                    putString("path", file.path)
                    putString("status", file.status)
                })
            }
        }
    }

    private data class SharedFile(
        val id: String,
        val shareId: String,
        val name: String,
        val uri: Uri,
        val path: String?,
        val status: String
    )

    private companion object {
        const val EVENT_NAME = "SharedFilesReceived"
        const val STATUS_ERROR = "ERROR"
        const val STATUS_PREPARING = "PREPARING"
        const val STATUS_READY = "READY"
    }
}
