package com.margelo.nitro.pay

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.concurrent.CountDownLatch
import java.util.concurrent.atomic.AtomicInteger

class PendingPaymentTest {

    @Test
    fun settlesTheClaimedPayment() {
        val pending = PendingPayment<String>()
        val settled = mutableListOf<String>()

        assertTrue(pending.tryBegin { settled.add(it) })
        assertTrue(pending.settle("done"))

        assertEquals(listOf("done"), settled)
    }

    @Test
    fun rejectsOverlapWithoutReplacingTheInFlightPayment() {
        val pending = PendingPayment<String>()
        val first = mutableListOf<String>()
        val second = mutableListOf<String>()

        assertTrue(pending.tryBegin { first.add(it) })
        assertFalse(pending.tryBegin { second.add(it) })
        pending.settle("done")

        assertEquals(listOf("done"), first)
        assertEquals(emptyList<String>(), second)
    }

    @Test
    fun settlesOnlyOnce() {
        val pending = PendingPayment<String>()
        val settled = mutableListOf<String>()

        pending.tryBegin { settled.add(it) }

        assertTrue(pending.settle("first"))
        assertFalse(pending.settle("second"))
        assertEquals(listOf("first"), settled)
    }

    @Test
    fun settleWithoutPaymentIsNoOp() {
        val pending = PendingPayment<String>()

        assertFalse(pending.settle("orphan"))
    }

    @Test
    fun acceptsNewPaymentAfterSettle() {
        val pending = PendingPayment<String>()
        val settled = mutableListOf<String>()

        pending.tryBegin { settled.add("a:$it") }
        pending.settle("1")

        assertTrue(pending.tryBegin { settled.add("b:$it") })
        pending.settle("2")

        assertEquals(listOf("a:1", "b:2"), settled)
    }

    @Test
    fun isInProgressFollowsTheSlot() {
        val pending = PendingPayment<String>()

        assertFalse(pending.isInProgress)

        pending.tryBegin { }
        assertTrue(pending.isInProgress)

        pending.tryBegin { }
        assertTrue(pending.isInProgress)

        pending.settle("done")
        assertFalse(pending.isInProgress)
    }

    @Test
    fun concurrentBeginsClaimTheSlotOnce() {
        val pending = PendingPayment<Int>()
        val threads = 16
        val gate = CountDownLatch(1)
        val claims = AtomicInteger(0)

        val workers = (0 until threads).map {
            Thread {
                gate.await()
                if (pending.tryBegin { }) claims.incrementAndGet()
            }.apply { start() }
        }
        gate.countDown()
        workers.forEach { it.join() }

        assertEquals(1, claims.get())
    }
}
