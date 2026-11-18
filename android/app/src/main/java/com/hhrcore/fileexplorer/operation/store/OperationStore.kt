package com.hhrcore.fileexplorer.operation.store

import com.hhrcore.fileexplorer.operation.FileOperationRecord

/** Persists and reconciles file operations */
interface OperationStore {
    /**
     * Saves an operation
     *
     * @param record Operation to save
     */
    fun save(record: FileOperationRecord)

    /**
     * Returns an operation by its identifier
     *
     * @param id Operation identifier
     * @return Matching operation or null
     */
    fun get(id: String): FileOperationRecord?

    /**
     * Returns persisted operations
     *
     * @return Persisted operations
     */
    fun list(): List<FileOperationRecord>

    /**
     * Reconciles inactive operations that need recovery
     *
     * @param reconcile Operation recovery callback
     * @return Serialized operation list
     */
    fun reconcileInterrupted(reconcile: (FileOperationRecord) -> Unit): String

    /** Deletes settled operations */
    fun removeSettled()

    /** Closes the store */
    fun close()
}
