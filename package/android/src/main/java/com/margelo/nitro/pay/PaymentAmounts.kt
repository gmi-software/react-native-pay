package com.margelo.nitro.pay

import java.math.BigDecimal

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

    private fun parse(label: String, amount: PaymentAmount): BigDecimal {
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

    fun total(items: Array<PaymentItem>): BigDecimal {
        return items.fold(BigDecimal.ZERO) { sum, item -> sum.add(parse(item)) }
    }
}
