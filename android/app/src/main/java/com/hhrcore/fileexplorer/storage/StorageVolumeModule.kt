package com.hhrcore.fileexplorer.storage

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.SharedPreferences
import android.os.Build
import android.os.Environment
import android.os.Handler
import android.os.Looper
import android.os.storage.StorageManager
import android.os.storage.StorageVolume
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.io.File

class StorageVolumeModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext),
    LifecycleEventListener {
    private val context: ReactApplicationContext
    private val handler = Handler(Looper.getMainLooper())
    private val storageManager: StorageManager
    private val volumeNames: SharedPreferences
    private var externalStorageName = ""
    private val emitVolumesTask = Runnable { emitVolumes() }
    private val receiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) = scheduleVolumesUpdate()
    }
    private val storageVolumeCallback = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        object : StorageManager.StorageVolumeCallback() {
            override fun onStateChanged(volume: StorageVolume) = scheduleVolumesUpdate()
        }
    } else {
        null
    }

    init {
        context = reactContext
        storageManager = context.getSystemService(StorageManager::class.java)
        volumeNames = context.getSharedPreferences(VOLUME_NAMES_STORAGE, Context.MODE_PRIVATE)
    }

    override fun getName() = "StorageVolume"

    override fun getConstants(): Map<String, Any> = mapOf("internalRootPath" to Environment.getExternalStorageDirectory().absolutePath)

    override fun initialize() {
        super.initialize()
        context.addLifecycleEventListener(this)
        val filter = IntentFilter().apply {
            addAction(Intent.ACTION_MEDIA_MOUNTED)
            addAction(Intent.ACTION_MEDIA_UNMOUNTED)
            addAction(Intent.ACTION_MEDIA_REMOVED)
            addAction(Intent.ACTION_MEDIA_EJECT)
            addAction(Intent.ACTION_MEDIA_BAD_REMOVAL)
            addDataScheme("file")
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            context.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            context.registerReceiver(receiver, filter)
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            storageVolumeCallback?.let { storageManager.registerStorageVolumeCallback(context.mainExecutor, it) }
        }
    }

    override fun invalidate() {
        handler.removeCallbacks(emitVolumesTask)
        context.removeLifecycleEventListener(this)
        runCatching { context.unregisterReceiver(receiver) }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            storageVolumeCallback?.let(storageManager::unregisterStorageVolumeCallback)
        }

        super.invalidate()
    }

    override fun onHostResume() = scheduleVolumesUpdate()

    override fun onHostPause() = Unit

    override fun onHostDestroy() = Unit

    @ReactMethod
    fun getExternalRoots(externalStorageName: String, promise: Promise) {
        try {
            this.externalStorageName = externalStorageName
            promise.resolve(externalRoots())
        } catch (error: Throwable) {
            promise.reject("STORAGE_VOLUMES_FAILED", error.message, error)
        }
    }

    @ReactMethod
    fun addListener(eventName: String) = Unit

    @ReactMethod
    fun removeListeners(count: Double) = Unit

    private fun emitVolumes() {
        if (!context.hasActiveReactInstance() || externalStorageName.isEmpty()) {
            return
        }

        context.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(EVENT_NAME, externalRoots())
    }

    private fun scheduleVolumesUpdate() {
        handler.removeCallbacks(emitVolumesTask)
        handler.postDelayed(emitVolumesTask, VOLUME_UPDATE_DELAY)
    }

    private fun externalRoots() = Arguments.createArray().apply {
        removableVolumes()
            .distinctBy { it.directory.absolutePath }
            .map { volume ->
                val id = volume.directory.name.ifEmpty { volume.directory.absolutePath }
                DetectedVolume(id, volume.directory, volume.description, storageIndex(id))
            }
            .sortedBy(DetectedVolume::index)
            .forEach { volume ->
                val fallbackName = if (volume.index == 1) externalStorageName else "$externalStorageName ${volume.index}"
                val name = volume.description.takeIf(String::isNotEmpty)
                    ?.let { "$externalStorageName $it" }
                    ?: fallbackName
                pushMap(Arguments.createMap().apply {
                    putString("id", volume.id)
                    putString("name", name)
                    putString("path", volume.directory.absolutePath)
                    putString("type", "REMOVABLE")
                })
            }
    }

    private fun storageIndex(id: String): Int {
        val storedIndex = volumeNames.getInt(id, 0)
        if (storedIndex > 0) {
            return storedIndex
        }

        val nextIndex = volumeNames.getInt(NEXT_VOLUME_INDEX, 1)
        volumeNames.edit()
            .putInt(id, nextIndex)
            .putInt(NEXT_VOLUME_INDEX, nextIndex + 1)
            .apply()
        return nextIndex
    }

    private fun removableVolumes(): List<RemovableVolume> {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            return storageManager.storageVolumes
                .filter { it.isRemovable && it.state == Environment.MEDIA_MOUNTED }
                .mapNotNull { volume ->
                    volume.directory?.let { RemovableVolume(it, volume.getDescription(context).trim()) }
                }
        }

        return context.getExternalFilesDirs(null)
            .filterNotNull()
            .drop(1)
            .mapNotNull(::externalRoot)
            .filter(File::exists)
            .map { directory ->
                val description = storageManager.getStorageVolume(directory)?.getDescription(context)?.trim().orEmpty()
                RemovableVolume(directory, description)
            }
    }

    private fun externalRoot(directory: File): File? {
        var root: File? = directory
        repeat(4) { root = root?.parentFile }
        return root
    }

    companion object {
        private const val EVENT_NAME = "StorageVolumesChanged"
        private const val VOLUME_NAMES_STORAGE = "storage_volume_names"
        private const val NEXT_VOLUME_INDEX = "next_volume_index"
        private const val VOLUME_UPDATE_DELAY = 300L
    }

    private data class RemovableVolume(val directory: File, val description: String)

    private data class DetectedVolume(val id: String, val directory: File, val description: String, val index: Int)
}
