package com.hhrcore.fileexplorer.operation

import okhttp3.Call
import okhttp3.Request

/** Creates HTTP calls for remote file operations */
interface RemoteTransferClient {
    /**
     * Creates a request call with an optional read timeout
     *
     * @param request HTTP request
     * @param readTimeoutMs Optional read timeout in milliseconds
     * @return HTTP call
     */
    fun newCall(request: Request, readTimeoutMs: Long? = null): Call
}
