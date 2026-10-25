package com.hhrcore.fileexplorer.thumbnail

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager
import com.hhrcore.fileexplorer.dependencies.NativeDependencies

class ThumbnailGeneratorPackage(private val dependencies: NativeDependencies) : ReactPackage {

    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(ThumbnailGeneratorModule(reactContext, dependencies.createThumbnailCache()))
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}
