package com.hhrcore.fileexplorer.operation

import android.content.Context
import android.media.MediaScannerConnection
import java.io.File

/**
 * Paths that require media index synchronization
 *
 * @author HattoriHanzo-Ronin
 */
data class MediaIndexChange(
    val removedPaths: List<String> = emptyList(),
    val createdFiles: List<File> = emptyList()
)

/**
 * Android media index manager
 *
 * @author HattoriHanzo-Ronin
 */
class MediaIndex(context: Context) {
    private val context: Context

    init {
        this.context = context.applicationContext
    }

    /**
     * Returns the file paths within a file or directory
     *
     * @param file File or directory to inspect
     * @return File paths
     */
    fun paths(file: File): List<String> {
        if (!file.exists()) {
            return listOf(file.absolutePath)
        }

        if (file.isFile) {
            return listOf(file.absolutePath)
        }

        return file.walkTopDown().filter(File::isFile).map(File::getAbsolutePath).toList()
    }

    /**
     * Schedules media index synchronization
     *
     * @param change Removed paths and created files
     */
    fun scan(change: MediaIndexChange) {
        if (change.removedPaths.isEmpty() && change.createdFiles.isEmpty()) {
            return
        }

        Thread { scanPaths(change.removedPaths + change.createdFiles.flatMap(::paths)) }.start()
    }

    private fun scanPaths(paths: Collection<String>): Unit {
        val files = paths.distinct()
        if (files.isEmpty()) {
            return
        }

        MediaScannerConnection.scanFile(context, files.toTypedArray(), null, null)
    }
}
