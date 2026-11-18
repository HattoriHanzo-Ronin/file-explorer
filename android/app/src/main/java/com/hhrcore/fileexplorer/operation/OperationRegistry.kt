package com.hhrcore.fileexplorer.operation

import java.util.concurrent.ConcurrentHashMap

object OperationRegistry {
    private val activeIds = ConcurrentHashMap.newKeySet<String>()

    /**
     * Marks an operation as active
     *
     * @param id Operation identifier
     */
    fun markActive(id: String) {
        activeIds.add(id)
    }

    /**
     * Marks an operation as inactive
     *
     * @param id Operation identifier
     */
    fun markInactive(id: String) {
        activeIds.remove(id)
    }

    /**
     * Returns whether an operation is active
     *
     * @param id Operation identifier
     * @return Whether the operation is active
     */
    fun isActive(id: String): Boolean = id in activeIds
}
