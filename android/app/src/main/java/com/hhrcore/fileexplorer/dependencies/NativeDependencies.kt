package com.hhrcore.fileexplorer.dependencies

import android.content.Context
import com.hhrcore.fileexplorer.operation.FileOperationEngine
import com.hhrcore.fileexplorer.operation.FileOperationRecord
import com.hhrcore.fileexplorer.operation.MediaIndex
import com.hhrcore.fileexplorer.operation.store.OperationStore
import com.hhrcore.fileexplorer.operation.store.impl.SqliteOperationStore
import com.hhrcore.fileexplorer.operation.transfer.RemoteTransferClient
import com.hhrcore.fileexplorer.operation.transfer.impl.OkHttpRemoteTransferClient
import com.hhrcore.fileexplorer.sharing.SharedFileCleanup
import com.hhrcore.fileexplorer.thumbnail.cache.ThumbnailCache
import com.hhrcore.fileexplorer.thumbnail.cache.impl.NativeThumbnailCache

/**
 * Native dependency factory
 *
 * @author HattoriHanzo-Ronin
 */
class NativeDependencies(context: Context) {
    private val context: Context

    init {
        this.context = context.applicationContext
    }

    /**
     * Creates an operation store
     *
     * @return Operation store
     */
    fun createOperationStore(): OperationStore = SqliteOperationStore(context)

    /**
     * Creates a remote transfer client
     *
     * @return Remote transfer client
     */
    fun createRemoteTransferClient(): RemoteTransferClient = OkHttpRemoteTransferClient()

    /**
     * Creates a thumbnail cache
     *
     * @return Thumbnail cache
     */
    fun createThumbnailCache(): ThumbnailCache = NativeThumbnailCache(context)

    /**
     * Creates a media index manager
     *
     * @return Media index manager
     */
    fun createMediaIndex(): MediaIndex = MediaIndex(context)

    /**
     * Creates a file operation engine
     *
     * @param store Operation store
     * @param onChange Operation update callback
     * @param thumbnailCache Thumbnail cache
     * @return File operation engine
     */
    fun createFileOperationEngine(
        store: OperationStore,
        onChange: (FileOperationRecord) -> Unit,
        thumbnailCache: ThumbnailCache
    ): FileOperationEngine = FileOperationEngine(store, onChange, thumbnailCache, createMediaIndex(), SharedFileCleanup(context), createRemoteTransferClient())
}
