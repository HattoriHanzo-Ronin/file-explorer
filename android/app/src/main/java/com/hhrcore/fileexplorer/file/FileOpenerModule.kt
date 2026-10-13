package com.hhrcore.fileexplorer.file

import android.content.Intent
import android.net.Uri
import android.os.Build
import androidx.core.content.FileProvider
import com.facebook.react.bridge.*
import java.io.File

class FileOpenerModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "FileOpener"

    @ReactMethod
    fun openFile(path: String) {
        val context = reactApplicationContext
        val file = File(path)

        val uri: Uri = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            FileProvider.getUriForFile(
                context,
                context.packageName + ".provider",
                file
            )
        } else {
            Uri.fromFile(file)
        }

        val intent = Intent(Intent.ACTION_VIEW)

        intent.setDataAndType(uri, getMimeType(path))
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)

        val chooser = Intent.createChooser(intent, "Abrir con")
        chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)

        context.startActivity(chooser)
    }

    private fun getMimeType(path: String): String {
        return when {
            path.endsWith(".apk") -> "application/vnd.android.package-archive"
            path.endsWith(".pdf") -> "application/pdf"
            path.endsWith(".jpg") -> "image/*"
            path.endsWith(".png") -> "image/*"
            else -> "*/*"
        }
    }
}