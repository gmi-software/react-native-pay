package com.margelo.nitro.pay

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class SheetUpdaterTest {

    private val standard = ShippingMethod("standard", "Standard", PaymentAmount.create("0"), "3-5 days")
    private val express = ShippingMethod("express", "Express", PaymentAmount.create("9.00"), "Next day")
    private val courier = ShippingMethod("courier", "Courier", PaymentAmount.create("15.00"), null)

    private val request = paymentRequest(
        arrayOf(item("Sneakers", "40.00")),
        shippingContactRequired = true,
        shippingMethods = arrayOf(standard, express)
    )

    private val allIntents = CallbackIntents(
        authorization = true,
        shippingAddress = true,
        shippingOption = true,
        paymentMethod = true
    )

    // Callbacks waiting for the app, in order: what changed, the selection, and how to answer.
    private data class Call(val value: Any, val selection: PaymentSheetSelection, val done: (PaymentSheetUpdate?) -> Unit)
    private val calls = mutableListOf<Call>()
    private fun <V : Any> recording(): SheetCallback<V> = { value, selection, done -> calls.add(Call(value, selection, done)) }

    // The timeouts scheduled, which a test fires by hand.
    private class Timer(val delayMs: Long, val block: () -> Unit) { var isCancelled = false }
    private val timers = mutableListOf<Timer>()
    private val schedule: (Long, () -> Unit) -> () -> Unit = { delay, block ->
        val timer = Timer(delay, block)
        timers.add(timer)
        ({ timer.isCancelled = true })
    }

    private val answers = mutableListOf<JSONObject>()

    private fun updater(
        callbacks: SheetCallbacks = SheetCallbacks(recording(), recording(), recording()),
        intents: CallbackIntents = allIntents,
        paymentRequest: PaymentRequest = request
    ) = SheetUpdater(paymentRequest, intents, callbacks, schedule)

    private fun SheetUpdater.change(data: JSONObject) {
        dataChanged(data.toString()) { answers.add(JSONObject(it)) }
    }

    private fun address(country: String = "US", state: String? = "CA") = JSONObject().apply {
        put("countryCode", country)
        state?.let { put("administrativeArea", it) }
        put("locality", "San Francisco")
        put("postalCode", "94107")
    }

    private fun card(network: String = "VISA", funding: String = "CREDIT") = JSONObject()
        .put("type", "CARD")
        .put("info", JSONObject().put("cardNetwork", network).put("cardFundingSource", funding))

    private fun trigger(name: String) = JSONObject().put("callbackTrigger", name)

    private fun JSONObject.total(): String = getJSONObject("newTransactionInfo").getString("totalPrice")
    private fun JSONObject.labels(): List<String> =
        getJSONObject("newTransactionInfo").getJSONArray("displayItems").objects().map { it.getString("label") }
    private fun JSONObject.selectedOption(): String =
        getJSONObject("newShippingOptionParameters").getString("defaultSelectedOptionId")

    private fun update(
        items: Array<PaymentItem>? = null,
        methods: Array<ShippingMethod>? = null,
        error: PaymentSheetError? = null
    ) = PaymentSheetUpdate(paymentItems = items, shippingMethods = methods, error = error)

    // Opening the sheet

    @Test
    fun initialize_runsTheAddressThenTheCardCallback() {
        val sheet = updater()

        sheet.change(
            trigger("INITIALIZE")
                .put("shippingAddress", address())
                .put("shippingOptionData", JSONObject().put("id", "standard"))
                .put("paymentMethodData", card())
        )

        assertEquals(1, calls.size)
        val addressCall = calls[0]
        assertEquals(PaymentSheetAddress("US", "CA", "San Francisco", "94107"), addressCall.value)
        assertEquals(standard, addressCall.selection.shippingMethod)
        assertEquals(PaymentMethodType.CREDIT, addressCall.selection.card?.type)

        addressCall.done(update(arrayOf(item("Sneakers", "40.00"), item("CA tax", "2.90"))))

        assertEquals(2, calls.size)
        assertEquals(PaymentSheetCard(PaymentNetwork.VISA, PaymentMethodType.CREDIT, null), calls[1].value)
        assertTrue(answers.isEmpty())

        calls[1].done(update())

        assertEquals(1, answers.size)
        assertEquals("42.90", answers[0].total())
        assertEquals(listOf("Sneakers", "CA tax", "Standard"), answers[0].labels())
        assertEquals("standard", answers[0].selectedOption())
        assertFalse(answers[0].has("error"))
        assertTrue(timers.single().isCancelled)
    }

    @Test
    fun initialize_withoutCallbacksAnswersWithTheRequestsCart() {
        val sheet = updater(SheetCallbacks())

        sheet.change(trigger("INITIALIZE").put("shippingAddress", address()))

        assertEquals("40.00", answers.single().total())
        assertEquals(listOf("Sneakers", "Standard"), answers.single().labels())
        assertEquals(PaymentSheetAddress("US", "CA", "San Francisco", "94107"), sheet.selection.shippingAddress)
    }

    // Shipping options

    @Test
    fun shippingOption_withoutACallbackStillChargesTheNewMethod() {
        val sheet = updater(SheetCallbacks())

        sheet.change(trigger("SHIPPING_OPTION").put("shippingOptionData", JSONObject().put("id", "express")))

        assertEquals("49.00", answers.single().total())
        assertEquals(listOf("Sneakers", "Express"), answers.single().labels())
        assertEquals("express", answers.single().selectedOption())
        assertEquals(express, sheet.selectedShippingMethod)
    }

    @Test
    fun shippingOption_callsOnShippingMethodChangeWithTheNewMethod() {
        val sheet = updater()

        sheet.change(trigger("SHIPPING_OPTION").put("shippingOptionData", JSONObject().put("id", "express")))
        assertEquals(express, calls.single().value)
        assertEquals(express, calls.single().selection.shippingMethod)

        calls.single().done(update(arrayOf(item("Sneakers", "40.00"), item("Gift wrap", "2.00"))))

        assertEquals("51.00", answers.single().total())
    }

    @Test
    fun shippingOption_anUnknownIdKeepsTheSelection() {
        val sheet = updater(SheetCallbacks())

        sheet.change(trigger("SHIPPING_OPTION").put("shippingOptionData", JSONObject().put("id", "drone")))

        assertEquals(standard, sheet.selectedShippingMethod)
        assertEquals("40.00", answers.single().total())
    }

    @Test
    fun newShippingMethods_keepTheSelectedOneWhileItIsListed() {
        val sheet = updater()
        sheet.change(trigger("SHIPPING_OPTION").put("shippingOptionData", JSONObject().put("id", "express")))
        calls.removeAt(0).done(update())

        sheet.change(trigger("SHIPPING_ADDRESS").put("shippingAddress", address()))
        calls.removeAt(0).done(update(methods = arrayOf(courier, express)))

        val answer = answers.last()
        assertEquals("express", answer.selectedOption())
        assertEquals(
            listOf("courier", "express"),
            answer.getJSONObject("newShippingOptionParameters").getJSONArray("shippingOptions").objects()
                .map { it.getString("id") }
        )
        assertEquals("49.00", answer.total())
    }

    @Test
    fun newShippingMethods_selectTheFirstWhenTheSelectedOneIsGone() {
        val sheet = updater()

        sheet.change(trigger("SHIPPING_ADDRESS").put("shippingAddress", address()))
        calls.single().done(update(methods = arrayOf(courier, express)))

        assertEquals(courier, sheet.selectedShippingMethod)
        assertEquals("courier", answers.single().selectedOption())
        assertEquals("55.00", answers.single().total())
    }

    @Test
    fun withoutTheShippingOptionIntent_theAnswerHasNoOptions() {
        val sheet = updater(intents = CallbackIntents(authorization = true, paymentMethod = true))

        sheet.change(trigger("PAYMENT_METHOD").put("paymentMethodData", card()))
        calls.single().done(update())

        assertFalse(answers.single().has("newShippingOptionParameters"))
        assertEquals("40.00", answers.single().total())
    }

    // Unusable updates

    @Test
    fun unusableUpdates_leaveTheCartAsItWas() {
        val unpayable = ShippingMethod("courier", "Courier", PaymentAmount.create("1.005"), null)
        val unusable = listOf(
            null,
            update(methods = emptyArray()),
            update(methods = arrayOf(express, express)),
            // Google Pay can't charge it, so it can't be offered, even unselected.
            update(methods = arrayOf(standard, unpayable)),
            update(items = arrayOf(item("Refund", "-50.00"))),
            update(items = arrayOf(item("Sneakers", "40.005")))
        )
        val sheet = updater()

        unusable.forEach { bad ->
            sheet.change(trigger("SHIPPING_ADDRESS").put("shippingAddress", address()))
            calls.removeAt(0).done(bad)
        }

        assertEquals(unusable.size, answers.size)
        answers.forEach { answer ->
            assertEquals("40.00", answer.total())
            assertFalse(answer.has("error"))
        }
        assertEquals(standard, sheet.selectedShippingMethod)
    }

    @Test
    fun anUnusableUpdateStillAppliesTheNewShippingOption() {
        val sheet = updater()

        sheet.change(trigger("SHIPPING_OPTION").put("shippingOptionData", JSONObject().put("id", "express")))
        calls.single().done(null)

        assertEquals("49.00", answers.single().total())
    }

    @Test
    fun malformedData_answersWithTheCurrentCart() {
        val sheet = updater()

        sheet.dataChanged("not json") { answers.add(JSONObject(it)) }

        assertEquals("40.00", answers.single().total())
        assertTrue(calls.isEmpty())
    }

    // Timeouts and overlapping changes

    @Test
    fun timeout_answersOnceAndIgnoresTheLateUpdate() {
        val sheet = updater()
        sheet.change(trigger("SHIPPING_ADDRESS").put("shippingAddress", address()))

        assertEquals(PaymentConstants.SHEET_CALLBACK_TIMEOUT_MS, timers.single().delayMs)
        timers.single().block()
        calls.single().done(update(arrayOf(item("Sneakers", "40.00"), item("Tax", "3.00"))))

        assertEquals(1, answers.size)
        assertEquals("40.00", answers.single().total())
        // The late update changes nothing for the next answer either.
        sheet.change(trigger("SHIPPING_OPTION").put("shippingOptionData", JSONObject().put("id", "standard")))
        calls.last().done(update())
        assertEquals("40.00", answers.last().total())
    }

    @Test
    fun timeout_skipsTheCallbacksNotRunYet() {
        val sheet = updater()
        sheet.change(trigger("INITIALIZE").put("shippingAddress", address()).put("paymentMethodData", card()))

        timers.single().block()
        calls.single().done(update())

        assertEquals(1, calls.size)
        assertEquals(1, answers.size)
    }

    @Test
    fun shippingOptionIds_areMatchedExactly() {
        val padded = ShippingMethod(" express ", "Express", PaymentAmount.create("9.00"), null)
        val sheet = updater(
            SheetCallbacks(),
            paymentRequest = paymentRequest(
                arrayOf(item("Sneakers", "40.00")),
                shippingContactRequired = true,
                shippingMethods = arrayOf(standard, padded)
            )
        )

        sheet.change(trigger("SHIPPING_OPTION").put("shippingOptionData", JSONObject().put("id", " express ")))

        assertEquals(padded, sheet.selectedShippingMethod)
        assertEquals("49.00", answers.single().total())
    }

    @Test
    fun aSupersededChange_dropsItsError() {
        val sheet = updater()
        sheet.change(trigger("INITIALIZE").put("shippingAddress", address(country = "CA")).put("paymentMethodData", card()))
        calls[0].done(update(error = PaymentSheetError(PaymentSheetErrorCode.SHIPPINGADDRESSUNSERVICEABLE, "US only.")))
        // The card callback is still running when the payer picks a US address.
        sheet.change(trigger("SHIPPING_ADDRESS").put("shippingAddress", address()))
        calls[2].done(update(arrayOf(item("Sneakers", "40.00"), item("CA tax", "2.90"))))

        calls[1].done(update())

        assertEquals(listOf("42.90", "42.90"), answers.map { it.total() })
        answers.forEach { assertFalse(it.has("error")) }
    }

    @Test
    fun aSupersededChangeThatTimesOut_dropsItsErrorToo() {
        val sheet = updater()
        sheet.change(trigger("INITIALIZE").put("shippingAddress", address(country = "CA")).put("paymentMethodData", card()))
        calls[0].done(update(error = PaymentSheetError(PaymentSheetErrorCode.SHIPPINGADDRESSUNSERVICEABLE, "US only.")))
        sheet.change(trigger("SHIPPING_ADDRESS").put("shippingAddress", address()))

        timers[0].block()

        assertFalse(answers.single().has("error"))
    }

    @Test
    fun aNewerChange_answersTheOlderOneWithoutItsUpdate() {
        val sheet = updater()
        sheet.change(trigger("SHIPPING_ADDRESS").put("shippingAddress", address(state = "CA")))
        sheet.change(trigger("SHIPPING_ADDRESS").put("shippingAddress", address(state = "NY")))

        calls[0].done(update(arrayOf(item("Sneakers", "40.00"), item("CA tax", "2.90"))))

        assertEquals("40.00", answers.single().total())

        calls[1].done(update(arrayOf(item("Sneakers", "40.00"), item("NY tax", "3.55"))))

        assertEquals("43.55", answers.last().total())
    }

    // Errors

    @Test
    fun addressErrors_mapToGooglesReasons() {
        val cases = listOf(
            PaymentSheetErrorCode.SHIPPINGADDRESSUNSERVICEABLE to "SHIPPING_ADDRESS_UNSERVICEABLE",
            PaymentSheetErrorCode.SHIPPINGADDRESSINVALID to "SHIPPING_ADDRESS_INVALID",
            PaymentSheetErrorCode.OTHER to "OTHER_ERROR"
        )
        val sheet = updater()

        cases.forEach { (code, reason) ->
            sheet.change(trigger("SHIPPING_ADDRESS").put("shippingAddress", address(country = "CA")))
            calls.removeAt(0).done(update(error = PaymentSheetError(code, "We only ship within the US.")))

            val error = answers.last().getJSONObject("error")
            assertEquals(reason, error.getString("reason"))
            assertEquals("We only ship within the US.", error.getString("message"))
            assertEquals("SHIPPING_ADDRESS", error.getString("intent"))
        }
    }

    @Test
    fun anErrorStillAppliesTheUpdatesItems() {
        val sheet = updater()

        sheet.change(trigger("SHIPPING_ADDRESS").put("shippingAddress", address()))
        calls.single().done(
            update(
                arrayOf(item("Sneakers", "40.00"), item("Tax", "3.00")),
                error = PaymentSheetError(PaymentSheetErrorCode.SHIPPINGADDRESSINVALID, "Check the postal code.")
            )
        )

        assertEquals("43.00", answers.single().total())
        assertTrue(answers.single().has("error"))
    }

    @Test
    fun shippingMethodErrors_areShownForTheShippingOption() {
        val sheet = updater()

        sheet.change(trigger("SHIPPING_OPTION").put("shippingOptionData", JSONObject().put("id", "express")))
        calls.single().done(update(error = PaymentSheetError(PaymentSheetErrorCode.OTHER, "Express is sold out.")))

        val error = answers.single().getJSONObject("error")
        assertEquals("OTHER_ERROR", error.getString("reason"))
        assertEquals("SHIPPING_OPTION", error.getString("intent"))
    }

    @Test
    fun cardErrors_areNotShown() {
        val sheet = updater()

        sheet.change(trigger("PAYMENT_METHOD").put("paymentMethodData", card()))
        calls.single().done(
            update(
                arrayOf(item("Sneakers", "40.00"), item("Card fee", "0.60")),
                error = PaymentSheetError(PaymentSheetErrorCode.OTHER, "We don't take this card.")
            )
        )

        assertFalse(answers.single().has("error"))
        assertEquals("40.60", answers.single().total())
    }

    @Test
    fun anAddressErrorNeedsTheShippingAddressIntent() {
        val sheet = updater(intents = CallbackIntents(authorization = true, shippingOption = true, paymentMethod = true))

        sheet.change(trigger("PAYMENT_METHOD").put("paymentMethodData", card()))
        calls.single().done(
            update(error = PaymentSheetError(PaymentSheetErrorCode.SHIPPINGADDRESSUNSERVICEABLE, "No."))
        )

        assertFalse(answers.single().has("error"))
    }

    // What the callbacks get

    @Test
    fun callbacksAreSkippedWithoutTheirIntent() {
        val sheet = updater(intents = CallbackIntents(authorization = true, shippingOption = true))

        sheet.change(trigger("INITIALIZE").put("shippingAddress", address()).put("paymentMethodData", card()))

        assertTrue(calls.isEmpty())
        assertEquals(1, answers.size)
    }

    @Test
    fun anAddressWithoutACountry_isNotReported() {
        val sheet = updater()

        sheet.change(trigger("SHIPPING_ADDRESS").put("shippingAddress", JSONObject().put("postalCode", "94107")))

        assertTrue(calls.isEmpty())
        assertNull(sheet.selection.shippingAddress)
        assertEquals(1, answers.size)
    }

    @Test
    fun cards_mapGooglesNetworkAndFundingSource() {
        assertEquals(
            PaymentSheetCard(PaymentNetwork.MASTERCARD, PaymentMethodType.DEBIT, null),
            SheetUpdater.sheetCard(card("MASTERCARD", "DEBIT"))
        )
        assertEquals(
            PaymentSheetCard(null, PaymentMethodType.UNKNOWN, null),
            SheetUpdater.sheetCard(JSONObject().put("type", "CARD").put("info", JSONObject()))
        )
        assertNull(SheetUpdater.sheetCard(JSONObject().put("type", "CARD")))
    }

    @Test
    fun addresses_haveAnUppercaseCountryAndNoBlankFields() {
        assertEquals(
            PaymentSheetAddress("GB", null, null, "SW1A"),
            SheetUpdater.sheetAddress(
                JSONObject().put("countryCode", "gb").put("locality", " ").put("postalCode", "SW1A")
            )
        )
    }
}
