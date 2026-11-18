package com.hhrcore.fileexplorer.operation

object AtomicRename {
    init {
        System.loadLibrary("file_operations")
    }

    /**
     * Renames a path without replacing an existing entry
     *
     * @param source Source path
     * @param destination Destination path
     * @return Rename result code
     */
    fun rename(source: String, destination: String): Int =
        renameBytes(source.toByteArray(Charsets.UTF_8), destination.toByteArray(Charsets.UTF_8))

    private external fun renameBytes(source: ByteArray, destination: ByteArray): Int
}
