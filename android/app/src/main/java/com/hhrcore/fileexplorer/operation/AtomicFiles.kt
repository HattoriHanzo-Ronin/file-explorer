package com.hhrcore.fileexplorer.operation

import android.system.OsConstants
import java.io.File

object AtomicFiles {
    /**
     * Reserves a unique file or directory path
     *
     * @param destination Destination directory
     * @param name Requested name
     * @param directory Whether to create a directory
     * @param owner Lock owner identifier
     * @return Reserved entry
     */
    fun reserve(destination: File, name: String, directory: Boolean, owner: String): File {
        var index = 0
        while (true) {
            val target = File(destination, candidate(name, index))
            if (!LocalPathLocks.tryAcquire(owner, listOf(LocalPathLocks.claim(target, true)))) {
                index++
                continue
            }

            val created = if (directory) target.mkdir() else target.createNewFile()
            if (created) {
                return target
            }

            if (!target.exists()) {
                throw IllegalStateException("No se pudo crear ${target.path}")
            }

            LocalPathLocks.releaseClaim(owner, LocalPathLocks.claim(target, true))
            index++
        }
    }

    /**
     * Renames an entry to a unique path
     *
     * @param source Source entry
     * @param destination Destination directory
     * @param name Requested name
     * @param owner Lock owner identifier
     * @return Renamed entry
     */
    fun rename(source: File, destination: File, name: String, owner: String): File {
        var index = 0
        while (true) {
            val target = File(destination, candidate(name, index))
            if (!LocalPathLocks.tryAcquire(owner, listOf(LocalPathLocks.claim(target, true)))) {
                index++
                continue
            }

            when (val error = AtomicRename.rename(source.path, target.path)) {
                0 -> return target
                OsConstants.EEXIST, OsConstants.ENOTEMPTY -> {
                    LocalPathLocks.releaseClaim(owner, LocalPathLocks.claim(target, true))
                    index++
                }
                else -> throw IllegalStateException("No se pudo renombrar ${source.path} ($error)")
            }
        }
    }

    /**
     * Returns a candidate name for a conflicting entry
     *
     * @param name Requested name
     * @param index Candidate index
     * @return Candidate name
     */
    fun candidate(name: String, index: Int): String {
        if (index == 0) {
            return name
        }

        val extensionIndex = name.lastIndexOf('.').takeIf { it > 0 } ?: name.length
        val base = name.substring(0, extensionIndex).replace(Regex(" \\(\\d+\\)$"), "")
        return "$base ($index)${name.substring(extensionIndex)}"
    }
}
