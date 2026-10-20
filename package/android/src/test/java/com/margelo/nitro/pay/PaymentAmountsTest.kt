package com.margelo.nitro.pay

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test
import java.math.BigDecimal

class PaymentAmountsTest {

    private fun item(amount: Double) =
        PaymentItem("Item", PaymentAmount.create(amount), PaymentItemType.FINAL)

    private fun item(amount: String) =
        PaymentItem("Item", PaymentAmount.create(amount), PaymentItemType.FINAL)

    @Test
    fun parse_readsStringsExactly() {
        assertEquals(BigDecimal("19.99"), PaymentAmounts.parse(item("19.99")))
        assertEquals(BigDecimal("-5.00"), PaymentAmounts.parse(item("-5.00")))
    }

    @Test
    fun parse_readsNumbersThroughTheirShortestDecimalForm() {
        assertEquals(BigDecimal("19.99"), PaymentAmounts.parse(item(19.99)))
        assertEquals(BigDecimal("1234.56"), PaymentAmounts.parse(item(1234.56)))
        assertEquals(0, BigDecimal("10000000").compareTo(PaymentAmounts.parse(item(1.0E7))))
    }

    @Test
    fun parse_rejectsNonDecimalAmounts() {
        val invalid = listOf(
            item(Double.NaN),
            item(Double.POSITIVE_INFINITY),
            item("12abc"),
            item(" 1.00"),
            item("1,00"),
            item("1e3"),
            item("")
        )

        invalid.forEach { candidate ->
            val error = assertThrows(IllegalArgumentException::class.java) {
                PaymentAmounts.parse(candidate)
            }
            assertTrue(error.message!!.contains("finite number or a decimal string"))
        }
    }

    @Test
    fun total_isTheExactDecimalSum() {
        val tenDimes = Array(10) { item(0.1) }

        assertEquals(BigDecimal("5.49"), PaymentAmounts.total(arrayOf(item(4.99), item("0.50"))))
        assertEquals(0, BigDecimal.ONE.compareTo(PaymentAmounts.total(tenDimes)))
    }
}
