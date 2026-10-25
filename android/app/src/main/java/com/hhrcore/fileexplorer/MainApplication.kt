package com.hhrcore.fileexplorer

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.hhrcore.fileexplorer.database.DatabasePackage
import com.hhrcore.fileexplorer.dependencies.NativeDependencies
import com.hhrcore.fileexplorer.file.FileOpenerPackage
import com.hhrcore.fileexplorer.operation.FileOperationPackage
import com.hhrcore.fileexplorer.permission.StoragePermissionPackage
import com.hhrcore.fileexplorer.storage.StorageVolumePackage
import com.hhrcore.fileexplorer.thumbnail.ThumbnailGeneratorPackage
import com.hhrcore.fileexplorer.sharing.SharingPackage

class MainApplication : Application(), ReactApplication {
  val nativeDependencies by lazy { NativeDependencies(applicationContext) }

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Packages that cannot be autolinked yet can be added manually here, for example:
          add(StoragePermissionPackage())
          add(StorageVolumePackage())
          add(DatabasePackage())
          add(FileOpenerPackage())
          add(FileOperationPackage(nativeDependencies))
          add(ThumbnailGeneratorPackage(nativeDependencies))
          add(SharingPackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
  }
}
