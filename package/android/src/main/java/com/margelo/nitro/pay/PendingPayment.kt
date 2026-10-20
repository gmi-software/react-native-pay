package com.margelo.nitro.pay

import java.util.concurrent.atomic.AtomicReference

/**
 * Holds the settle callback of the single in-flight payment.
 *
 * `startPayment` runs on the JS thread while `onActivityResult` runs on the
 * main thread, so claiming and settling go through one atomic slot.
 */
internal class PendingPayment<T> {
    private val settleCallback = AtomicReference<((T) -> Unit)?>(null)

    /**
     * Claims the slot for a new payment.
     * Returns `false` without touching the in-flight payment if one exists.
     */
    fun tryBegin(settle: (T) -> Unit): Boolean {
        return settleCallback.compareAndSet(null, settle)
    }

    /**
     * Settles the in-flight payment once and frees the slot.
     * Returns `false` if there was nothing to settle.
     */
    fun settle(result: T): Boolean {
        val settle = settleCallback.getAndSet(null) ?: return false
        settle(result)
        return true
    }
}
