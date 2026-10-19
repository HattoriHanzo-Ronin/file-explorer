package com.hhrcore.fileexplorer.operation

object AtomicRename {
    init {
        System.loadLibrary("file_operations")
    }

    fun rename(source: String, destination: String): Int =
        renameBytes(source.toByteArray(Charsets.UTF_8), destination.toByteArray(Charsets.UTF_8))

    private external fun renameBytes(source: ByteArray, destination: ByteArray): Int
}
