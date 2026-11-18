package com.hhrcore.fileexplorer.thumbnail.cache

import java.io.File

/** Stores and maintains thumbnails for local files */
interface ThumbnailCache {
    /**
     * Returns a cached thumbnail for a source file
     *
     * @param source Source file
     * @return Cached thumbnail or null
     */
    fun find(source: File): File?

    /**
     * Returns whether a file belongs to the thumbnail cache
     *
     * @param source File to inspect
     * @return Whether the file belongs to the cache
     */
    fun isThumbnailFile(source: File): Boolean

    /**
     * Stores a thumbnail for a source file
     *
     * @param source Source file
     * @param thumbnail Thumbnail file
     * @return Stored thumbnail
     */
    fun store(source: File, thumbnail: File): File

    /**
     * Reconciles cached thumbnails with a directory
     *
     * @param directory Source directory
     */
    fun reconcileDirectory(directory: File)

    /**
     * Cleans up inactive directories
     *
     * @param cutoff Last access timestamp cutoff
     */
    fun cleanupInactive(cutoff: Long)

    /**
     * Returns cached thumbnail references for an entry
     *
     * @param source Source file or directory
     * @return Thumbnail references
     */
    fun snapshot(source: File): List<ThumbnailSnapshot>

    /**
     * Copies thumbnail references to a destination
     *
     * @param snapshot Source thumbnail references
     * @param destination Destination file or directory
     */
    fun copy(snapshot: List<ThumbnailSnapshot>, destination: File)

    /**
     * Deletes thumbnail references
     *
     * @param snapshot Thumbnail references to delete
     */
    fun delete(snapshot: List<ThumbnailSnapshot>)

    /**
     * Moves thumbnail references to a destination
     *
     * @param snapshot Source thumbnail references
     * @param source Original file or directory
     * @param destination Destination file or directory
     */
    fun move(snapshot: List<ThumbnailSnapshot>, source: File, destination: File)

    /**
     * Deletes cached references for a directory and its descendants
     *
     * @param path Directory path
     */
    fun deletePath(path: String)

    /** Closes the thumbnail cache */
    fun close()
}

/**
 * Cached thumbnail reference and its path relative to a source
 *
 * @author HattoriHanzo-Ronin
 */
data class ThumbnailSnapshot(val id: String, val relativePath: String)
