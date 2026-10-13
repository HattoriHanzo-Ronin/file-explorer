package com.hhrcore.fileexplorer.permission

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment 
import android.provider.Settings
import com.facebook.react.bridge.*

class StoragePermissionModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "StoragePermission"

    @ReactMethod
    fun openAllFilesAccess() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            val intent = Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION)
            intent.data = Uri.parse("package:${reactApplicationContext.packageName}")
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            reactApplicationContext.startActivity(intent)
        }
    }

    @ReactMethod
    fun isExternalStorageManager(promise: Promise) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            promise.resolve(Environment.isExternalStorageManager())
        } else {
            promise.resolve(true)
        }
    }
}