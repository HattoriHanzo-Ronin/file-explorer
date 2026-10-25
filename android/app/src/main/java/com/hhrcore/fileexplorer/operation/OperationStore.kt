package com.hhrcore.fileexplorer.operation

interface OperationStore {
    fun save(record: FileOperationRecord)

    fun get(id: String): FileOperationRecord?

    fun list(): List<FileOperationRecord>

    fun reconcileInterrupted(reconcile: (FileOperationRecord) -> Unit): String

    fun removeSettled()

    fun close()
}
