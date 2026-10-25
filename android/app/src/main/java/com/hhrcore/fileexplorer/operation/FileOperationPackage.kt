package com.hhrcore.fileexplorer.operation

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager
import com.hhrcore.fileexplorer.dependencies.NativeDependencies

class FileOperationPackage(private val dependencies: NativeDependencies) : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
        listOf(FileOperationModule(reactContext, dependencies))

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
