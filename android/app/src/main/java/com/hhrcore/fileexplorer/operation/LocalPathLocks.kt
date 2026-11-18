package com.hhrcore.fileexplorer.operation

import java.io.File

object LocalPathLocks {
    data class Claim(val path: String, val write: Boolean, val subtree: Boolean)

    private val monitor = Object()
    private val held = mutableMapOf<String, MutableList<Claim>>()
    private val waiting = mutableListOf<Pair<String, List<Claim>>>()

    /**
     * Creates a claim for a local path
     *
     * @param file Path to claim
     * @param write Whether the claim requires write access
     * @param subtree Whether the claim includes descendants
     * @return Path claim
     */
    fun claim(file: File, write: Boolean, subtree: Boolean = true): Claim =
        Claim(file.canonicalFile.path, write, subtree)

    /**
     * Acquires path claims for an operation
     *
     * @param owner Operation identifier
     * @param claims Path claims
     * @param checkCancelled Cancellation check while waiting
     */
    fun acquire(owner: String, claims: List<Claim>, checkCancelled: () -> Unit = {}): Unit {
        synchronized(monitor) {
            val request = owner to claims
            waiting.add(request)
            try {
                while (!available(owner, claims) || waiting.takeWhile { it !== request }.any { (_, earlier) -> overlaps(claims, earlier) }) {
                    checkCancelled()
                    monitor.wait(250)
                }
                checkCancelled()
                held.getOrPut(owner) { mutableListOf() }.addAll(claims)
            } finally {
                waiting.remove(request)
                monitor.notifyAll()
            }
        }
    }

    /**
     * Attempts to acquire path claims
     *
     * @param owner Operation identifier
     * @param claims Path claims
     * @return Whether the claims were acquired
     */
    fun tryAcquire(owner: String, claims: List<Claim>): Boolean = synchronized(monitor) {
        if (!available(owner, claims)) {
            return@synchronized false
        }

        held.getOrPut(owner) { mutableListOf() }.addAll(claims)
        true
    }

    /**
     * Releases an operation's path claims
     *
     * @param owner Operation identifier
     */
    fun release(owner: String): Unit = synchronized(monitor) {
        held.remove(owner)
        monitor.notifyAll()
    }

    /**
     * Releases a path claim
     *
     * @param owner Operation identifier
     * @param claim Path claim
     */
    fun releaseClaim(owner: String, claim: Claim): Unit = synchronized(monitor) {
        held[owner]?.remove(claim)
        monitor.notifyAll()
    }

    private fun overlaps(first: List<Claim>, second: List<Claim>): Boolean =
        first.any { claim -> second.any { conflicts(claim, it) } }

    private fun available(owner: String, claims: List<Claim>): Boolean = held.all { (otherOwner, otherClaims) ->
        otherOwner == owner || claims.none { claim -> otherClaims.any { conflicts(claim, it) } }
    }

    private fun conflicts(first: Claim, second: Claim): Boolean {
        if (!first.write && !second.write) {
            return false
        }

        if (first.path == second.path) {
            return true
        }

        return (first.subtree && isChild(first.path, second.path)) ||
            (second.subtree && isChild(second.path, first.path))
    }

    private fun isChild(parent: String, child: String): Boolean =
        child.startsWith(if (parent == File.separator) parent else parent + File.separator)
}
