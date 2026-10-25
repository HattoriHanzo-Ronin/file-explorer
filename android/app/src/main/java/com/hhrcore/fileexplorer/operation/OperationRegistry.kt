package com.hhrcore.fileexplorer.operation

import java.util.concurrent.ConcurrentHashMap

object OperationRegistry {
    private val activeIds = ConcurrentHashMap.newKeySet<String>()

    fun markActive(id: String) {
        activeIds.add(id)
    }

    fun markInactive(id: String) {
        activeIds.remove(id)
    }

    fun isActive(id: String): Boolean = id in activeIds
}
