package com.hhrcore.fileexplorer.dependencies

import android.content.Context
import com.hhrcore.fileexplorer.operation.FileOperationEngine
import com.hhrcore.fileexplorer.operation.OperationStore
import com.hhrcore.fileexplorer.operation.RemoteTransferClient
import com.hhrcore.fileexplorer.operation.impl.OkHttpRemoteTransferClient
import com.hhrcore.fileexplorer.operation.impl.SqliteOperationStore
import com.hhrcore.fileexplorer.thumbnail.ThumbnailCache
import com.hhrcore.fileexplorer.thumbnail.impl.NativeThumbnailCache

class NativeDependencies(context: Context) {
    private val context = context.applicationContext

    fun createOperationStore(): OperationStore = SqliteOperationStore(context)

    fun createRemoteTransferClient(): RemoteTransferClient = OkHttpRemoteTransferClient()

    fun createThumbnailCache(): ThumbnailCache = NativeThumbnailCache(context)

    fun createFileOperationEngine(
        store: OperationStore,
        onChange: (com.hhrcore.fileexplorer.operation.FileOperationRecord) -> Unit,
        thumbnailCache: ThumbnailCache
    ): FileOperationEngine = FileOperationEngine(store, onChange, thumbnailCache, createRemoteTransferClient())
}
