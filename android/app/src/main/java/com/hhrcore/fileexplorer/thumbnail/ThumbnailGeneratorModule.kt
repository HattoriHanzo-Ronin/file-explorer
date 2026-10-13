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
import kotlin.math.max

class ThumbnailGeneratorModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "ThumbnailGenerator"

    @ReactMethod
    fun generate(path: String, promise: Promise) {
        try {
            val source = File(path)
            if (!source.isFile) {
                promise.resolve(null)
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

            val thumbnail = getThumbnailFile(source)
            if (!thumbnail.exists() || thumbnail.lastModified() < source.lastModified()) {
                FileOutputStream(thumbnail).use { output ->
                    bitmap.compress(Bitmap.CompressFormat.JPEG, 85, output)
                }
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
        val cacheDirectory = File(reactApplicationContext.cacheDir, "thumbnails")
        cacheDirectory.mkdirs()
        val digest = MessageDigest.getInstance("SHA-256").digest(source.path.toByteArray())
        val name = digest.joinToString("") { byte -> "%02x".format(byte) }
        return File(cacheDirectory, "$name.jpg")
    }

    private fun getMimeType(file: File): String {
        val extension = file.extension.lowercase()
        return MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension).orEmpty()
    }

    private companion object {
        const val THUMBNAIL_SIZE = 320
    }
}
