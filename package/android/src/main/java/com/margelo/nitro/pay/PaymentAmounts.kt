package com.margelo.nitro.pay

import java.math.BigDecimal
import java.math.RoundingMode

/**
 * Exact decimal handling for payment amounts.
 *
 * Amounts are parsed and summed as [BigDecimal], never as Double.
 */
object PaymentAmounts {
    private val decimalPattern = Regex("^-?[0-9]+(\\.[0-9]+)?$")

    /**
     * Parses an item amount. Numbers are read through their shortest
     * round-trip form, so 19.99 becomes exactly 19.99.
     */
    fun parse(item: PaymentItem): BigDecimal = parse(item.label, item.amount)

    fun parse(method: ShippingMethod): BigDecimal = parse(method.label, method.amount)

    fun parse(label: String, amount: PaymentAmount): BigDecimal {
        val decimal = when (amount) {
            is PaymentAmount.First ->
                amount.value.takeIf { it.isFinite() }?.let { BigDecimal.valueOf(it) }
            is PaymentAmount.Second ->
                amount.value.takeIf { decimalPattern.matches(it) }?.let { BigDecimal(it) }
        }
        return requireNotNull(decimal) {
            "Amount for \"$label\" must be a finite number or a decimal string like \"19.99\""
        }
    }

    /** The amount parsed and formatted for Google Pay, see [formatPrice]. */
    fun googlePayPrice(label: String, amount: PaymentAmount): String =
        formatPrice(parse(label, amount))

    fun googlePayPrice(item: PaymentItem): String = googlePayPrice(item.label, item.amount)

    fun googlePayPrice(method: ShippingMethod): String = googlePayPrice(method.label, method.amount)

    fun total(items: Array<PaymentItem>): BigDecimal {
        return items.fold(BigDecimal.ZERO) { sum, item -> sum.add(parse(item)) }
    }

    /**
     * Google Pay accepts whole amounts or exactly two decimal places
     * (`^[0-9]+(\.[0-9][0-9])?$` for the total).
     */
    fun formatPrice(amount: BigDecimal): String {
        val scale = if (amount.scale() <= 0) 0 else 2
        return try {
            amount.setScale(scale, RoundingMode.UNNECESSARY).toPlainString()
        } catch (e: ArithmeticException) {
            throw IllegalArgumentException(
                "Google Pay accepts at most two decimal places, got ${amount.toPlainString()}",
                e
            )
        }
    }
}
