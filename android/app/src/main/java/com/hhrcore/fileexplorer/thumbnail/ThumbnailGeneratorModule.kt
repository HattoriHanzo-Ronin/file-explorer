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
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledFuture
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.TimeUnit
import kotlin.math.max

class ThumbnailGeneratorModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
    private val context: ReactApplicationContext
    private val executor: ExecutorService
    private val cleanupExecutor: ScheduledExecutorService
    private val locks: Array<Any>
    private val cacheLock: Any
    private val cache: ThumbnailCache
    private var idleTimeoutMs = 0L
    private var cleanupTask: ScheduledFuture<*>? = null
    private var pendingRequests = 0

    init {
        this.context = context
        executor = Executors.newFixedThreadPool(2)
        cleanupExecutor = Executors.newSingleThreadScheduledExecutor()
        locks = Array(32) { Any() }
        cacheLock = Any()
        cache = ThumbnailCache(context)
    }

    override fun getName() = "ThumbnailGenerator"

    @ReactMethod
    fun configure(idleTimeoutMs: Double) {
        synchronized(cacheLock) {
            this.idleTimeoutMs = idleTimeoutMs.toLong()
        }
        cleanupExecutor.execute {
            cleanupCache()
        }
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
                        cleanupTask = cleanupExecutor.schedule(::cleanupCache, idleTimeoutMs, TimeUnit.MILLISECONDS)
                    }
                }
            }
        }
    }

    override fun invalidate() {
        executor.shutdownNow()
        cleanupExecutor.shutdownNow()
        cache.close()
        super.invalidate()
    }

    private fun generateThumbnail(path: String, promise: Promise) {
        try {
            val source = File(path).canonicalFile
            if (!source.isFile) {
                promise.resolve(null)
                return
            }

            if (cache.isThumbnailFile(source)) {
                promise.resolve(null)
                return
            }

            val cached = cache.find(source)
            if (cached != null) {
                promise.resolve(Uri.fromFile(cached).toString())
                return
            }

            val bitmap = when {
                getMimeType(source).startsWith("image/") -> createImageThumbnail(source)
                getMimeType(source).startsWith("video/") -> createVideoThumbnail(source)
                else -> null
            }
            if (bitmap == null) {
                promise.resolve(null)
                return
            }

            val thumbnail = try {
                writeThumbnail(bitmap)
            } finally {
                bitmap.recycle()
            }
            val cachedThumbnail = cache.store(source, thumbnail)
            thumbnail.delete()
            promise.resolve(Uri.fromFile(cachedThumbnail).toString())
        } catch (error: Exception) {
            promise.reject("THUMBNAIL_GENERATION_ERROR", error.message, error)
        }
    }

    private fun writeThumbnail(bitmap: Bitmap): File {
        val pending = File.createTempFile("thumbnail-", ".pending", context.cacheDir)
        try {
            FileOutputStream(pending).use { output ->
                if (!bitmap.compress(Bitmap.CompressFormat.JPEG, JPEG_QUALITY, output)) {
                    throw IllegalStateException("No se pudo guardar la miniatura")
                }
            }
            return pending
        } catch (error: Throwable) {
            pending.delete()
            throw error
        }
    }

    private fun createImageThumbnail(source: File): Bitmap? {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(source.path, bounds)
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) {
            return null
        }

        val options = BitmapFactory.Options().apply { inSampleSize = calculateSampleSize(bounds.outWidth, bounds.outHeight) }
        return BitmapFactory.decodeFile(source.path, options)?.let(::scaleBitmap)
    }

    private fun createVideoThumbnail(source: File): Bitmap? {
        val retriever = MediaMetadataRetriever()
        return try {
            retriever.setDataSource(source.path)
            retriever.getFrameAtTime(0, MediaMetadataRetriever.OPTION_CLOSEST_SYNC)?.let(::scaleBitmap)
        } finally {
            retriever.release()
        }
    }

    private fun calculateSampleSize(width: Int, height: Int): Int {
        var sampleSize = 1
        while (width / sampleSize > THUMBNAIL_SIZE * 2 || height / sampleSize > THUMBNAIL_SIZE * 2) sampleSize *= 2
        return sampleSize
    }

    private fun scaleBitmap(bitmap: Bitmap): Bitmap {
        val scale = THUMBNAIL_SIZE.toFloat() / max(bitmap.width, bitmap.height)
        if (scale >= 1) {
            return bitmap
        }

        return Bitmap.createScaledBitmap(bitmap, (bitmap.width * scale).toInt(), (bitmap.height * scale).toInt(), true).also {
            bitmap.recycle()
        }
    }

    private fun cleanupCache() {
        synchronized(cacheLock) {
            if (pendingRequests > 0) {
                return
            }
        }
        if (idleTimeoutMs > 0) {
            cache.cleanupInactive(System.currentTimeMillis() - idleTimeoutMs)
        }
    }

    private fun getMimeType(file: File): String {
        return MimeTypeMap.getSingleton().getMimeTypeFromExtension(file.extension.lowercase()).orEmpty()
    }

    private companion object {
        const val JPEG_QUALITY = 85
        const val THUMBNAIL_SIZE = 320
    }
}
