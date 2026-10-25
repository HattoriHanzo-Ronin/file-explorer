package com.hhrcore.fileexplorer.operation.impl

import com.hhrcore.fileexplorer.operation.RemoteTransferClient
import okhttp3.Call
import okhttp3.OkHttpClient
import okhttp3.Request
import java.util.concurrent.TimeUnit

class OkHttpRemoteTransferClient : RemoteTransferClient {
    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(10, TimeUnit.MINUTES)
        .writeTimeout(10, TimeUnit.MINUTES)
        .retryOnConnectionFailure(true)
        .build()

    override fun newCall(request: Request, readTimeoutMs: Long?): Call {
        val client = if (readTimeoutMs == null) client else client.newBuilder().readTimeout(readTimeoutMs, TimeUnit.MILLISECONDS).build()
        return client.newCall(request)
    }
}
