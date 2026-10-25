package com.hhrcore.fileexplorer.operation

import java.io.File

object LocalPathLocks {
    data class Claim(val path: String, val write: Boolean, val subtree: Boolean)

    private val monitor = Object()
    private val held = mutableMapOf<String, MutableList<Claim>>()
    private val waiting = mutableListOf<Pair<String, List<Claim>>>()

    fun claim(file: File, write: Boolean, subtree: Boolean = true): Claim =
        Claim(file.canonicalFile.path, write, subtree)

    fun acquire(owner: String, claims: List<Claim>, checkCancelled: () -> Unit = {}) {
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

    fun tryAcquire(owner: String, claims: List<Claim>): Boolean = synchronized(monitor) {
        if (!available(owner, claims)) {
            return@synchronized false
        }

        held.getOrPut(owner) { mutableListOf() }.addAll(claims)
        true
    }

    fun release(owner: String) = synchronized(monitor) {
        held.remove(owner)
        monitor.notifyAll()
    }

    fun releaseClaim(owner: String, claim: Claim) = synchronized(monitor) {
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
