package com.hhrcore.fileexplorer.thumbnail

import java.io.File

interface ThumbnailCache {
    fun find(source: File): File?

    fun isThumbnailFile(source: File): Boolean

    fun store(source: File, thumbnail: File): File

    fun reconcileDirectory(directory: File)

    fun cleanupInactive(cutoff: Long)

    fun snapshot(source: File): List<ThumbnailSnapshot>

    fun copy(snapshot: List<ThumbnailSnapshot>, destination: File)

    fun delete(snapshot: List<ThumbnailSnapshot>)

    fun move(snapshot: List<ThumbnailSnapshot>, source: File, destination: File)

    fun deletePath(path: String)

    fun close()
}

data class ThumbnailSnapshot(val id: String, val relativePath: String)
