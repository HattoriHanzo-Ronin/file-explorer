package com.hhrcore.fileexplorer.operation

import okhttp3.Call
import okhttp3.Request

interface RemoteTransferClient {
    fun newCall(request: Request, readTimeoutMs: Long? = null): Call
}
