package com.hhrcore.fileexplorer.operation

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.lang.ref.WeakReference

object FileOperationEvents {
    private var context = WeakReference<ReactApplicationContext>(null)

    fun attach(reactContext: ReactApplicationContext) {
        context = WeakReference(reactContext)
    }

    fun emit(record: FileOperationRecord) {
        val reactContext = context.get() ?: return
        if (!reactContext.hasActiveReactInstance()) return
        val map = Arguments.createMap().apply {
            putString("id", record.id)
            putString("operation", record.operation)
            putString("status", record.status)
            putDouble("bytesTransferred", record.bytesTransferred.toDouble())
            putDouble("totalBytes", record.totalBytes.toDouble())
            putDouble("revision", record.revision.toDouble())
            record.error?.let { putMap("error", toApiErrorMap(it)) }
            record.result?.let { putMap("result", toResultMap(it)) }
            putString("remoteDir", record.request.optString("remoteDir"))
            putString("destinationDir", record.request.optString("destination"))
            putString("localDir", record.request.optString("destination"))
        }
        reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit("FileOperationChanged", map)
    }

    private fun toApiErrorMap(error: org.json.JSONObject): WritableMap = Arguments.createMap().apply {
        putString("code", error.optString("code"))
        putString("message", error.optString("message"))
        error.optJSONArray("details")?.let { details ->
            putArray("details", Arguments.createArray().apply {
                for (index in 0 until details.length()) {
                    val detail = details.getJSONObject(index)
                    pushMap(Arguments.createMap().apply {
                        detail.optString("field").takeIf(String::isNotEmpty)?.let { putString("field", it) }
                        putString("message", detail.optString("message"))
                    })
                }
            })
        }
    }

    private fun toResultMap(result: org.json.JSONObject): WritableMap = Arguments.createMap().apply {
        if (result.has("changes")) {
            if (result.has("version")) {
                putString("version", result.getString("version"))
            }

            putArray("changes", Arguments.createArray().apply {
                val changes = result.getJSONArray("changes")
                for (index in 0 until changes.length()) {
                    val change = changes.getJSONObject(index)
                    pushMap(Arguments.createMap().apply {
                        putString("path", change.getString("path"))
                        change.optString("targetPath").takeIf(String::isNotEmpty)?.let { putString("targetPath", it) }
                        putString("type", change.getString("type"))
                        putInt("completed", change.getInt("completed"))
                        putInt("total", change.getInt("total"))
                    })
                }
            })
        } else {
            putString("version", result.getString("version"))
            putArray("entries", Arguments.createArray().apply {
                val entries = result.getJSONArray("entries")
                for (index in 0 until entries.length()) {
                    val entry = entries.getJSONObject(index)
                    pushMap(Arguments.createMap().apply {
                        putString("name", entry.getString("name"))
                        putString("type", entry.getString("type"))
                        if (entry.has("supportsThumbnail")) {
                            putBoolean("supportsThumbnail", entry.getBoolean("supportsThumbnail"))
                        }
                    })
                }
            })
        }
    }
}
