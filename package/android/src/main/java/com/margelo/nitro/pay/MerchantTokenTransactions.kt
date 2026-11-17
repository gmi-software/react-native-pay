package com.margelo.nitro.pay

import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant
import java.time.format.DateTimeFormatter

/**
 * Maps `recurring`, `deferred` and `automaticReload` to Google Pay's
 * `recurringTransactionInfo`, `deferredTransactionInfo` and
 * `automaticReloadTransactionInfo`. Google Pay takes exactly one transaction
 * object, so these replace `transactionInfo`, and the payment items become
 * what is charged now. The JS side validates the rest; this only rejects what
 * can't be sent, with the same rules as iOS.
 *
 * A recurring request sends only `immediateTotalPrice`: Google Pay forbids
 * regular charges in its `immediateDisplayItems`, and the payment items can't
 * tell a setup fee from a first period paid today.
 */
internal object MerchantTokenTransactions {

    /**
     * The key and object that replace `transactionInfo`, or null for a
     * one-off payment.
     *
     * @param immediateTotalPrice what is charged now, formatted for Google Pay
     * @param immediateDisplayItems the lines of what is charged now
     */
    fun create(
        request: PaymentRequest,
        immediateTotalPrice: String,
        immediateDisplayItems: JSONArray?
    ): Pair<String, JSONObject>? {
        val recurring = request.recurring
        val deferred = request.deferred
        val automaticReload = request.automaticReload
        require(listOfNotNull(recurring, deferred, automaticReload).size <= 1) {
            "Set at most one of recurring, deferred and automaticReload"
        }

        fun base(
            managementUrl: String,
            billingAgreement: String?,
            tokenNotificationUrl: String?,
            displayItems: JSONArray? = immediateDisplayItems
        ) = JSONObject().apply {
            put("currencyCode", request.currencyCode)
            put("countryCode", request.countryCode)
            put("managementUrl", managementUrl)
            billingAgreement?.let { put("billingAgreement", it) }
            tokenNotificationUrl?.let { put("tokenUpdateUrl", it) }
            put("immediateTotalPrice", immediateTotalPrice)
            displayItems?.let { put("immediateDisplayItems", it) }
        }

        return when {
            recurring != null -> "recurringTransactionInfo" to base(
                recurring.managementUrl,
                recurring.billingAgreement,
                recurring.tokenNotificationUrl,
                displayItems = null
            ).apply { putRecurrence(recurring) }

            deferred != null -> "deferredTransactionInfo" to base(
                deferred.managementUrl, deferred.billingAgreement, deferred.tokenNotificationUrl
            ).apply {
                val billing = deferred.deferredBilling
                put("label", billing.label)
                put("price", PaymentAmounts.googlePayPrice(billing.label, billing.amount))
                put("priceStatus", PaymentConstants.TOTAL_PRICE_STATUS_FINAL)
                put("billingDateTime", dateTime(billing.date))
            }

            automaticReload != null -> "automaticReloadTransactionInfo" to base(
                automaticReload.managementUrl,
                automaticReload.billingAgreement,
                automaticReload.tokenNotificationUrl
            ).apply {
                val billing = automaticReload.automaticReloadBilling
                put("label", billing.label)
                put("reloadAmount", PaymentAmounts.googlePayPrice(billing.label, billing.amount))
                put("minimumBalanceAmount", PaymentAmounts.googlePayPrice(billing.label, billing.thresholdAmount))
            }

            else -> null
        }
    }

    /**
     * A paid trial is the first recurrence item. A free one is an
     * introductory period, because Google Pay rejects a recurrence price of
     * zero. The regular phase starts when the trial ends, unless it has its
     * own start. Both phases are checked as on iOS, whichever way they are sent.
     */
    private fun JSONObject.putRecurrence(recurring: RecurringPaymentRequest) {
        val regular = recurring.regularBilling
        val regularCount = intervalCount(regular)
        val items = JSONArray()
        val trialEnd = recurring.trialBilling?.let { trial ->
            val end = requireNotNull(trial.endDate) { "recurring.trialBilling.endDate is required" }
            val count = intervalCount(trial)
            val price = PaymentAmounts.parse(trial.label, trial.amount)
            if (price.signum() == 0) {
                put("introductoryPeriodInfo", JSONObject().apply {
                    put("label", trial.label)
                    put("totalPrice", PaymentAmounts.formatPrice(price))
                    trial.startDate?.let { put("introductoryPeriodStartDateTime", dateTime(it)) }
                    put("introductoryPeriodEndDateTime", dateTime(end))
                })
            } else {
                items.put(recurrenceItem(trial, count, trial.startDate, end))
            }
            end
        }
        items.put(recurrenceItem(regular, regularCount, regular.startDate ?: trialEnd, regular.endDate))
        put("recurrenceItems", items)
    }

    private fun recurrenceItem(
        item: RecurringBillingItem,
        intervalCount: Int,
        startDate: Instant?,
        endDate: Instant?
    ) = JSONObject().apply {
        put("label", item.label)
        put("price", PaymentAmounts.googlePayPrice(item.label, item.amount))
        put("priceStatus", PaymentConstants.TOTAL_PRICE_STATUS_FINAL)
        put("recurrencePeriod", recurrencePeriod(item.intervalUnit))
        put("recurrencePeriodCount", intervalCount)
        startDate?.let { put("billingInitialDateTime", dateTime(it)) }
        endDate?.let { put("billingFinalDateTime", dateTime(it)) }
    }

    private fun recurrencePeriod(unit: RecurringIntervalUnit): String = when (unit) {
        RecurringIntervalUnit.DAY -> "DAY"
        RecurringIntervalUnit.MONTH -> "MONTH"
        RecurringIntervalUnit.YEAR -> "YEAR"
    }

    // Double.toInt() saturates, so check the range instead of converting blindly.
    private fun intervalCount(item: RecurringBillingItem): Int {
        val count = item.intervalCount ?: 1.0
        require(count % 1.0 == 0.0 && count >= 1 && count <= Int.MAX_VALUE) {
            "intervalCount for \"${item.label}\" must be a positive integer, got $count"
        }
        return count.toInt()
    }

    // RFC 3339, as Google Pay requires.
    private fun dateTime(instant: Instant): String = DateTimeFormatter.ISO_INSTANT.format(instant)
}
