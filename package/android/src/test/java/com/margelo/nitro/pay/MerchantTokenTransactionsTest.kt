package com.margelo.nitro.pay

import com.google.android.gms.wallet.WalletConstants
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Test
import java.time.Instant

class MerchantTokenTransactionsTest {

    private val trialEnd = Instant.parse("2033-05-18T03:33:20Z")
    private val managementUrl = "https://example.com/account"

    private fun billing(
        label: String,
        amount: String,
        unit: RecurringIntervalUnit = RecurringIntervalUnit.MONTH,
        count: Double? = null,
        startDate: Instant? = null,
        endDate: Instant? = null
    ) = RecurringBillingItem(label, PaymentAmount.create(amount), unit, count, startDate, endDate)

    private fun recurring(
        regular: RecurringBillingItem = billing("Monthly", "9.99"),
        trial: RecurringBillingItem? = null
    ) = RecurringPaymentRequest(
        regularBilling = regular,
        trialBilling = trial,
        description = "Premium membership",
        managementUrl = managementUrl,
        billingAgreement = "Renews monthly",
        tokenNotificationUrl = "https://example.com/tokens"
    )

    private val deferred = DeferredPaymentRequest(
        deferredBilling = DeferredBillingItem("Hotel", PaymentAmount.create("240.00"), trialEnd),
        freeCancellation = FreeCancellation(trialEnd.minusSeconds(86_400), "Europe/Warsaw"),
        description = "Hotel booking",
        managementUrl = managementUrl,
        billingAgreement = null,
        tokenNotificationUrl = null
    )

    private val automaticReload = AutomaticReloadPaymentRequest(
        automaticReloadBilling = AutomaticReloadBillingItem(
            "Top-up", PaymentAmount.create("25.00"), PaymentAmount.create("5.00")
        ),
        description = "Card top-up",
        managementUrl = managementUrl,
        billingAgreement = null,
        tokenNotificationUrl = null
    )

    private fun build(
        items: Array<PaymentItem> = emptyArray(),
        recurring: RecurringPaymentRequest? = null,
        deferred: DeferredPaymentRequest? = null,
        automaticReload: AutomaticReloadPaymentRequest? = null,
        shippingMethods: Array<ShippingMethod>? = null
    ): JSONObject = GooglePayRequestBuilder.createPaymentDataRequest(
        paymentRequest(
            items,
            shippingMethods = shippingMethods,
            recurring = recurring,
            deferred = deferred,
            automaticReload = automaticReload
        ),
        WalletConstants.ENVIRONMENT_TEST
    )

    private fun JSONObject.recurrenceItems(): List<JSONObject> =
        getJSONObject("recurringTransactionInfo").getJSONArray("recurrenceItems").objects()

    private val transactionKeys = listOf(
        "transactionInfo",
        "recurringTransactionInfo",
        "deferredTransactionInfo",
        "automaticReloadTransactionInfo"
    )

    private fun JSONObject.transactionKeys() = transactionKeys.filter { has(it) }

    @Test
    fun oneOffPayment_keepsTransactionInfo() {
        val json = build(items = arrayOf(item("Coffee", "4.99")))

        assertEquals(listOf("transactionInfo"), json.transactionKeys())
        assertEquals("4.99", json.getJSONObject("transactionInfo").getString("totalPrice"))
    }

    @Test
    fun recurring_replacesTransactionInfoWithTheSharedFields() {
        val info = build(recurring = recurring()).also {
            assertEquals(listOf("recurringTransactionInfo"), it.transactionKeys())
        }.getJSONObject("recurringTransactionInfo")

        assertEquals("USD", info.getString("currencyCode"))
        assertEquals("US", info.getString("countryCode"))
        assertEquals(managementUrl, info.getString("managementUrl"))
        assertEquals("Renews monthly", info.getString("billingAgreement"))
        assertEquals("https://example.com/tokens", info.getString("tokenUpdateUrl"))
        assertEquals("0", info.getString("immediateTotalPrice"))
        assertFalse(info.has("immediateDisplayItems"))
        assertFalse(info.has("description"))
        assertFalse(info.has("introductoryPeriodInfo"))
    }

    @Test
    fun recurring_regularPhaseWithoutStartBillsNow() {
        val items = build(recurring = recurring()).recurrenceItems()

        assertEquals(1, items.size)
        val regular = items[0]
        assertEquals("Monthly", regular.getString("label"))
        assertEquals("9.99", regular.getString("price"))
        assertEquals("FINAL", regular.getString("priceStatus"))
        assertEquals("MONTH", regular.getString("recurrencePeriod"))
        assertEquals(1, regular.getInt("recurrencePeriodCount"))
        assertFalse(regular.has("billingInitialDateTime"))
        assertFalse(regular.has("billingFinalDateTime"))
    }

    @Test
    fun recurring_freeTrialIsAnIntroductoryPeriodAndTheRegularPhaseStartsWhenItEnds() {
        val trial = billing("Free trial", "0.00", RecurringIntervalUnit.DAY, count = 7.0, endDate = trialEnd)
        val json = build(recurring = recurring(trial = trial))

        val intro = json.getJSONObject("recurringTransactionInfo").getJSONObject("introductoryPeriodInfo")
        assertEquals("Free trial", intro.getString("label"))
        assertEquals("0.00", intro.getString("totalPrice"))
        assertEquals("2033-05-18T03:33:20Z", intro.getString("introductoryPeriodEndDateTime"))
        assertFalse(intro.has("introductoryPeriodStartDateTime"))
        val items = json.recurrenceItems()
        assertEquals(listOf("Monthly"), items.map { it.getString("label") })
        assertEquals("2033-05-18T03:33:20Z", items[0].getString("billingInitialDateTime"))
    }

    @Test
    fun recurring_paidTrialIsTheFirstRecurrenceItem() {
        val trial = billing("Intro", "1.99", RecurringIntervalUnit.MONTH, count = 3.0, endDate = trialEnd)
        val json = build(recurring = recurring(trial = trial))

        assertFalse(json.getJSONObject("recurringTransactionInfo").has("introductoryPeriodInfo"))
        val (first, regular) = json.recurrenceItems()
        assertEquals("Intro", first.getString("label"))
        assertEquals("1.99", first.getString("price"))
        assertEquals(3, first.getInt("recurrencePeriodCount"))
        assertFalse(first.has("billingInitialDateTime"))
        assertEquals("2033-05-18T03:33:20Z", first.getString("billingFinalDateTime"))
        assertEquals("2033-05-18T03:33:20Z", regular.getString("billingInitialDateTime"))
    }

    @Test
    fun recurring_keepsTheRegularDatesWhenGiven() {
        val start = trialEnd.plusSeconds(86_400)
        val end = trialEnd.plusSeconds(365L * 86_400)
        val regular = billing("Yearly", "99.00", RecurringIntervalUnit.YEAR, startDate = start, endDate = end)
        val trial = billing("Free trial", "0", RecurringIntervalUnit.DAY, endDate = trialEnd)

        val item = build(recurring = recurring(regular, trial)).recurrenceItems().single()

        assertEquals("YEAR", item.getString("recurrencePeriod"))
        assertEquals("2033-05-19T03:33:20Z", item.getString("billingInitialDateTime"))
        assertEquals("2034-05-18T03:33:20Z", item.getString("billingFinalDateTime"))
    }

    @Test
    fun recurring_rejectsAnIntervalCountThatIsNotAPositiveInteger() {
        for (count in listOf(0.0, 1.5, -2.0, 1e20)) {
            val error = assertThrows(IllegalArgumentException::class.java) {
                build(recurring = recurring(billing("Monthly", "9.99", count = count)))
            }
            assertEquals(
                "intervalCount for \"Monthly\" must be a positive integer, got $count",
                error.message
            )
        }
    }

    @Test
    fun recurring_checksTheIntervalCountOfAFreeTrialToo() {
        val trial = billing("Free trial", "0.00", RecurringIntervalUnit.DAY, count = 1.5, endDate = trialEnd)

        val error = assertThrows(IllegalArgumentException::class.java) {
            build(recurring = recurring(trial = trial))
        }
        assertEquals("intervalCount for \"Free trial\" must be a positive integer, got 1.5", error.message)
    }

    @Test
    fun recurring_rejectsATrialWithoutAnEndDate() {
        val error = assertThrows(IllegalArgumentException::class.java) {
            build(recurring = recurring(trial = billing("Free trial", "0.00", RecurringIntervalUnit.DAY)))
        }
        assertEquals("recurring.trialBilling.endDate is required", error.message)
    }

    @Test
    fun deferred_sendsTheLaterChargeAndLeavesOutIosOnlyFields() {
        val info = build(items = arrayOf(item("Deposit", "20.00")), deferred = deferred).also {
            assertEquals(listOf("deferredTransactionInfo"), it.transactionKeys())
        }.getJSONObject("deferredTransactionInfo")

        assertEquals("Hotel", info.getString("label"))
        assertEquals("240.00", info.getString("price"))
        assertEquals("FINAL", info.getString("priceStatus"))
        assertEquals("2033-05-18T03:33:20Z", info.getString("billingDateTime"))
        assertEquals("20.00", info.getString("immediateTotalPrice"))
        assertEquals("Deposit", info.getJSONArray("immediateDisplayItems").getJSONObject(0).getString("label"))
        assertFalse(info.has("tokenUpdateUrl"))
        assertFalse(info.has("billingAgreement"))
        assertFalse(info.has("freeCancellation"))
    }

    @Test
    fun automaticReload_sendsTheReloadAndThreshold() {
        val info = build(items = arrayOf(item("Initial load", "25.00")), automaticReload = automaticReload).also {
            assertEquals(listOf("automaticReloadTransactionInfo"), it.transactionKeys())
        }.getJSONObject("automaticReloadTransactionInfo")

        assertEquals("Top-up", info.getString("label"))
        assertEquals("25.00", info.getString("reloadAmount"))
        assertEquals("5.00", info.getString("minimumBalanceAmount"))
        assertEquals("25.00", info.getString("immediateTotalPrice"))
    }

    @Test
    fun shippingMethod_isChargedNow() {
        val shipping = arrayOf(ShippingMethod("standard", "Standard", PaymentAmount.create("4.50"), null))
        val info = build(
            items = arrayOf(item("Starter kit", "10.00")),
            automaticReload = automaticReload,
            shippingMethods = shipping
        ).getJSONObject("automaticReloadTransactionInfo")

        assertEquals("14.50", info.getString("immediateTotalPrice"))
        val lines = info.getJSONArray("immediateDisplayItems").objects()
        assertEquals(listOf("Starter kit", "Standard"), lines.map { it.getString("label") })
        assertEquals(listOf("LINE_ITEM", "SHIPPING_OPTION"), lines.map { it.getString("type") })
    }

    @Test
    fun itemKinds_reachTheItemsChargedNow() {
        val items = arrayOf(item("Kit", "10.00"), item("VAT", "2.30", kind = PaymentItemKind.TAX))
        val lines = build(items = items, deferred = deferred)
            .getJSONObject("deferredTransactionInfo")
            .getJSONArray("immediateDisplayItems")
            .objects()

        assertEquals(listOf("LINE_ITEM", "TAX"), lines.map { it.getString("type") })
    }

    // Google Pay forbids regular charges in immediateDisplayItems, and a first
    // period paid today is a payment item like any other.
    @Test
    fun recurring_chargesItemsNowWithoutListingThem() {
        val shipping = arrayOf(ShippingMethod("standard", "Standard", PaymentAmount.create("4.50"), null))
        val info = build(
            items = arrayOf(item("Monthly", "9.99")),
            recurring = recurring(),
            shippingMethods = shipping
        ).getJSONObject("recurringTransactionInfo")

        assertEquals("14.49", info.getString("immediateTotalPrice"))
        assertFalse(info.has("immediateDisplayItems"))
    }

    @Test
    fun pendingItem_staysPendingInTheItemsChargedNow() {
        val items = arrayOf(item("Kit", "10.00"), item("Tax", "0.80", PaymentItemType.PENDING))
        val lines = build(items = items, deferred = deferred)
            .getJSONObject("deferredTransactionInfo")
            .getJSONArray("immediateDisplayItems")
            .objects()

        assertEquals(listOf("FINAL", "PENDING"), lines.map { it.getString("status") })
    }

    @Test
    fun moreThanOne_isRejected() {
        val error = assertThrows(IllegalArgumentException::class.java) {
            build(recurring = recurring(), automaticReload = automaticReload)
        }
        assertEquals("Set at most one of recurring, deferred and automaticReload", error.message)
    }
}
