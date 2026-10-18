package com.hhrcore.fileexplorer.thumbnail

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.webkit.MimeTypeMap
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File
import java.io.FileOutputStream
import java.security.MessageDigest
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledFuture
import java.util.concurrent.TimeUnit
import kotlin.math.max

class ThumbnailGeneratorModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private val executor = Executors.newFixedThreadPool(2)
    private val cleanupExecutor = Executors.newSingleThreadScheduledExecutor()
    private val locks = Array(32) { Any() }
    private val cacheLock = Any()
    private val cacheDirectory = File(reactContext.cacheDir, "thumbnails")
    private var maxBytes = 0L
    private var idleTimeoutMs = 0L
    private var cleanupTask: ScheduledFuture<*>? = null
    private var pendingRequests = 0

    override fun getName() = "ThumbnailGenerator"

    @ReactMethod
    fun configure(maxBytes: Double, idleTimeoutMs: Double) {
        synchronized(cacheLock) {
            this.maxBytes = maxBytes.toLong()
            this.idleTimeoutMs = idleTimeoutMs.toLong()
        }
        cleanupExecutor.execute { cleanupExpiredCache() }
    }

    @ReactMethod
    fun generate(path: String, promise: Promise) {
        synchronized(cacheLock) {
            pendingRequests++
            cleanupTask?.cancel(false)
        }
        executor.execute {
            try {
                synchronized(locks[(path.hashCode() and Int.MAX_VALUE) % locks.size]) {
                    generateThumbnail(path, promise)
                }
            } finally {
                synchronized(cacheLock) {
                    pendingRequests--
                    if (pendingRequests == 0 && idleTimeoutMs > 0) {
                        cleanupTask = cleanupExecutor.schedule({ clearIdleCache() }, idleTimeoutMs, TimeUnit.MILLISECONDS)
                    }
                }
            }
        }
    }

    override fun invalidate() {
        executor.shutdownNow()
        cleanupExecutor.shutdownNow()
        super.invalidate()
    }

    private fun generateThumbnail(path: String, promise: Promise) {
        try {
            val source = File(path)
            if (!source.isFile) {
                promise.resolve(null)
                return
            }

            val thumbnail = getThumbnailFile(source)
            val cached = synchronized(cacheLock) {
                val valid = thumbnail.exists() && thumbnail.lastModified() >= source.lastModified()
                if (valid) {
                    thumbnail.parentFile?.setLastModified(System.currentTimeMillis())
                }
                valid
            }
            if (cached) {
                promise.resolve(Uri.fromFile(thumbnail).toString())
                return
            }

            val mimeType = getMimeType(source)
            val bitmap = when {
                mimeType.startsWith("image/") -> createImageThumbnail(source)
                mimeType.startsWith("video/") -> createVideoThumbnail(source)
                else -> null
            }
            if (bitmap == null) {
                promise.resolve(null)
                return
            }

            synchronized(cacheLock) {
                thumbnail.parentFile?.mkdirs()
                FileOutputStream(thumbnail).use { output ->
                    bitmap.compress(Bitmap.CompressFormat.JPEG, 85, output)
                }
                thumbnail.parentFile?.setLastModified(System.currentTimeMillis())
                trimCache()
            }

            bitmap.recycle()
            promise.resolve(Uri.fromFile(thumbnail).toString())
        } catch (error: Exception) {
            promise.reject("THUMBNAIL_GENERATION_ERROR", error.message, error)
        }
    }

    private fun createImageThumbnail(source: File): Bitmap? {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(source.path, bounds)
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) {
            return null
        }

        val options = BitmapFactory.Options().apply {
            inSampleSize = calculateSampleSize(bounds.outWidth, bounds.outHeight)
        }
        val bitmap = BitmapFactory.decodeFile(source.path, options) ?: return null
        return scaleBitmap(bitmap)
    }

    private fun createVideoThumbnail(source: File): Bitmap? {
        val retriever = MediaMetadataRetriever()
        return try {
            retriever.setDataSource(source.path)
            val bitmap = retriever.getFrameAtTime(0, MediaMetadataRetriever.OPTION_CLOSEST_SYNC) ?: return null
            scaleBitmap(bitmap)
        } finally {
            retriever.release()
        }
    }

    private fun calculateSampleSize(width: Int, height: Int): Int {
        var sampleSize = 1
        while (width / sampleSize > THUMBNAIL_SIZE * 2 || height / sampleSize > THUMBNAIL_SIZE * 2) {
            sampleSize *= 2
        }

        return sampleSize
    }

    private fun scaleBitmap(bitmap: Bitmap): Bitmap {
        val scale = THUMBNAIL_SIZE.toFloat() / max(bitmap.width, bitmap.height)
        if (scale >= 1) {
            return bitmap
        }

        val scaled = Bitmap.createScaledBitmap(bitmap, (bitmap.width * scale).toInt(), (bitmap.height * scale).toInt(), true)
        bitmap.recycle()
        return scaled
    }

    private fun getThumbnailFile(source: File): File {
        val directory = File(cacheDirectory, hashPath(source.parent.orEmpty()))
        return File(directory, "${hashPath(source.path)}.jpg")
    }

    private fun hashPath(path: String): String {
        val digest = MessageDigest.getInstance("SHA-256").digest(path.toByteArray())
        return digest.joinToString("") { byte -> "%02x".format(byte) }
    }

    private fun trimCache() {
        if (maxBytes <= 0) return
        val directories = cacheDirectory.listFiles()?.sortedBy { it.lastModified() }.orEmpty()
        var total = directories.sumOf { cacheSize(it) }
        for (directory in directories) {
            if (total <= maxBytes) break
            val size = cacheSize(directory)
            if (directory.deleteRecursively()) total -= size
        }
    }

    private fun cacheSize(file: File): Long {
        return if (file.isDirectory) file.listFiles()?.sumOf { cacheSize(it) } ?: 0L else file.length()
    }

    private fun cleanupExpiredCache() {
        synchronized(cacheLock) {
            if (idleTimeoutMs <= 0 || pendingRequests > 0) return
            val cutoff = System.currentTimeMillis() - idleTimeoutMs
            cacheDirectory.listFiles()?.filter { it.lastModified() <= cutoff }?.forEach { it.deleteRecursively() }
            trimCache()
        }
    }

    private fun clearIdleCache() {
        synchronized(cacheLock) {
            if (pendingRequests == 0) cacheDirectory.listFiles()?.forEach { it.deleteRecursively() }
        }
    }

    private fun getMimeType(file: File): String {
        val extension = file.extension.lowercase()
        return MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension).orEmpty()
    }

    private companion object {
        const val THUMBNAIL_SIZE = 320
    }
}
