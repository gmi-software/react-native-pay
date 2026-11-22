package com.margelo.nitro.pay

import org.json.JSONException
import org.json.JSONObject

/**
 * Runs one sheet callback with the value that changed and the selection so
 * far, and calls back once with its update, or null when it failed. On the
 * main thread.
 */
internal typealias SheetCallback<Value> =
    (Value, PaymentSheetSelection, (PaymentSheetUpdate?) -> Unit) -> Unit

/** The sheet callbacks of `StartPaymentOptions` that Google Pay can call. */
internal class SheetCallbacks(
    val onShippingAddressChange: SheetCallback<PaymentSheetAddress>? = null,
    val onShippingMethodChange: SheetCallback<ShippingMethod>? = null,
    val onPaymentMethodChange: SheetCallback<PaymentSheetCard>? = null
)

/**
 * What the Google Pay sheet shows, kept across the payer's changes so each
 * one starts from the last update, as iOS's `PaymentSheetUpdater` does.
 * Answers Google's `onPaymentDataChanged` with a `PaymentDataRequestUpdate`.
 *
 * Google Pay never adds a shipping option's price itself, so every answer
 * carries the whole transaction: the payment items, the selected shipping
 * method and the total. Without `onShippingMethodChange` a new shipping
 * option still updates the total.
 *
 * A callback that fails, times out or returns an update this can't apply
 * changes nothing, and the sheet shows no error. One change can run several
 * callbacks (the sheet opens with an address and a card), in order and within
 * one [timeoutMs], below Google's 30 seconds.
 *
 * Apart from the React context, so the JVM tests can check it. Main thread only.
 *
 * @param schedule runs the block after the delay, unless the returned
 *   function cancels it
 */
internal class SheetUpdater(
    private val request: PaymentRequest,
    private val intents: CallbackIntents,
    private val callbacks: SheetCallbacks,
    private val schedule: (delayMs: Long, block: () -> Unit) -> () -> Unit,
    private val timeoutMs: Long = PaymentConstants.SHEET_CALLBACK_TIMEOUT_MS
) {
    private var paymentItems: Array<PaymentItem> = request.paymentItems
    private var shippingMethods: Array<ShippingMethod> = request.shippingMethods ?: emptyArray()
    private var selectedShippingMethodIdentifier: String? = shippingMethods.firstOrNull()?.identifier
    private var shippingAddress: PaymentSheetAddress? = null
    private var card: PaymentSheetCard? = null
    // Bumped by every change, so a callback that ends after a newer change began changes nothing.
    private var latestChange = 0

    /** The shipping method the payer has selected, as the app last sent it. */
    val selectedShippingMethod: ShippingMethod?
        get() = shippingMethods.firstOrNull { it.identifier == selectedShippingMethodIdentifier }

    /** What the payer has chosen so far, as the callbacks get it. */
    val selection: PaymentSheetSelection
        get() = PaymentSheetSelection(
            shippingAddress = shippingAddress,
            shippingMethod = selectedShippingMethod,
            card = card,
            couponCode = null
        )

    /**
     * Google Pay reports [intermediatePaymentData], the payer's choices so
     * far. [answer] gets the `PaymentDataRequestUpdate` JSON, exactly once.
     */
    fun dataChanged(intermediatePaymentData: String, answer: (String) -> Unit) {
        val change = ++latestChange
        val data = try {
            JSONObject(intermediatePaymentData)
        } catch (e: JSONException) {
            answer(updateJson(null))
            return
        }
        val steps = readChange(data)

        var isAnswered = false
        var error: JSONObject? = null
        var cancelTimeout: () -> Unit = {}
        fun finish() {
            if (isAnswered) return
            isAnswered = true
            cancelTimeout()
            answer(updateJson(error))
        }
        cancelTimeout = schedule(timeoutMs) { finish() }

        fun runNext() {
            if (isAnswered) return
            val step = steps.removeFirstOrNull() ?: return finish()
            step.run(selection) { update ->
                when {
                    isAnswered -> return@run
                    // A newer change has begun: answer this one as the sheet is.
                    change != latestChange -> return@run finish()
                    update != null && apply(update) -> {
                        update.error?.let { sheetError -> errorJson(sheetError, step.intent)?.let { error = it } }
                    }
                }
                runNext()
            }
        }
        runNext()
    }

    /** One sheet callback to run for a change. */
    private class Step(
        val intent: String,
        val run: (PaymentSheetSelection, (PaymentSheetUpdate?) -> Unit) -> Unit
    )

    /**
     * Records what [data] reports and returns the callbacks to run for it.
     * The sheet opens with `INITIALIZE`, which can carry an address and a
     * card at once, and may come more than once.
     */
    private fun readChange(data: JSONObject): ArrayDeque<Step> {
        val trigger = data.optString("callbackTrigger")
        val isInitialize = trigger == PaymentConstants.CALLBACK_TRIGGER_INITIALIZE
        val steps = ArrayDeque<Step>()

        data.optJSONObject("shippingOptionData")?.optNonEmpty("id")?.let { id ->
            if (shippingMethods.any { it.identifier == id }) selectedShippingMethodIdentifier = id
        }
        val address = data.optJSONObject("shippingAddress")?.let(::sheetAddress)
        if (address != null) shippingAddress = address
        val newCard = data.optJSONObject("paymentMethodData")?.let(::sheetCard)
        if (newCard != null) card = newCard

        val onAddress = callbacks.onShippingAddressChange
        if (address != null && onAddress != null && intents.shippingAddress &&
            (isInitialize || trigger == PaymentConstants.CALLBACK_INTENT_SHIPPING_ADDRESS)
        ) {
            steps.add(Step(PaymentConstants.CALLBACK_INTENT_SHIPPING_ADDRESS) { selection, done ->
                onAddress(address, selection, done)
            })
        }
        val onMethod = callbacks.onShippingMethodChange
        val method = selectedShippingMethod
        if (trigger == PaymentConstants.CALLBACK_INTENT_SHIPPING_OPTION && method != null && onMethod != null) {
            steps.add(Step(PaymentConstants.CALLBACK_INTENT_SHIPPING_OPTION) { selection, done ->
                onMethod(method, selection, done)
            })
        }
        val onCard = callbacks.onPaymentMethodChange
        if (newCard != null && onCard != null && intents.paymentMethod &&
            (isInitialize || trigger == PaymentConstants.CALLBACK_INTENT_PAYMENT_METHOD)
        ) {
            steps.add(Step(PaymentConstants.CALLBACK_INTENT_PAYMENT_METHOD) { selection, done ->
                onCard(newCard, selection, done)
            })
        }
        return steps
    }

    /**
     * Applies [update] to the cart and returns true, or returns false and
     * changes nothing. The selected shipping method stays selected while it is
     * in the new list; otherwise the first one is.
     */
    private fun apply(update: PaymentSheetUpdate): Boolean {
        val items = update.paymentItems ?: paymentItems
        var methods = shippingMethods
        var selectedIdentifier = selectedShippingMethodIdentifier
        update.shippingMethods?.let { newMethods ->
            if (newMethods.isEmpty()) return false
            methods = newMethods
            selectedIdentifier = newMethods.firstOrNull { it.identifier == selectedIdentifier }?.identifier
                ?: newMethods[0].identifier
        }
        try {
            GooglePayRequestBuilder.validateShippingMethods(methods)
            GooglePayRequestBuilder.createTransactionInfoUpdate(
                request,
                items,
                methods.firstOrNull { it.identifier == selectedIdentifier }
            )
        } catch (e: IllegalArgumentException) {
            return false
        }
        paymentItems = items
        shippingMethods = methods
        selectedShippingMethodIdentifier = selectedIdentifier
        return true
    }

    /** The `PaymentDataRequestUpdate` JSON for the current cart. */
    private fun updateJson(error: JSONObject?): String {
        return JSONObject().apply {
            // The cart was checked when it was set.
            put(
                "newTransactionInfo",
                GooglePayRequestBuilder.createTransactionInfoUpdate(request, paymentItems, selectedShippingMethod)
            )
            val selected = selectedShippingMethodIdentifier
            if (intents.shippingOption && shippingMethods.isNotEmpty() && selected != null) {
                put(
                    "newShippingOptionParameters",
                    GooglePayRequestBuilder.createShippingOptionParameters(shippingMethods, selected)
                )
            }
            error?.let { put("error", it) }
        }.toString()
    }

    /**
     * Google's `PaymentDataError` for [error] from a callback for [stepIntent],
     * or null where the sheet can't show it. Google Pay takes errors only for
     * the address and shipping option intents the request asked for, so an
     * error about the card isn't shown, as on iOS for a shipping method.
     */
    private fun errorJson(error: PaymentSheetError, stepIntent: String): JSONObject? {
        val (reason, intent) = when (error.code) {
            PaymentSheetErrorCode.SHIPPINGADDRESSINVALID ->
                "SHIPPING_ADDRESS_INVALID" to PaymentConstants.CALLBACK_INTENT_SHIPPING_ADDRESS
            PaymentSheetErrorCode.SHIPPINGADDRESSUNSERVICEABLE ->
                "SHIPPING_ADDRESS_UNSERVICEABLE" to PaymentConstants.CALLBACK_INTENT_SHIPPING_ADDRESS
            else -> "OTHER_ERROR" to stepIntent
        }
        val requested = when (intent) {
            PaymentConstants.CALLBACK_INTENT_SHIPPING_ADDRESS -> intents.shippingAddress
            PaymentConstants.CALLBACK_INTENT_SHIPPING_OPTION -> intents.shippingOption
            else -> false
        }
        if (!requested) return null
        return JSONObject()
            .put("reason", reason)
            .put("message", error.message)
            .put("intent", intent)
    }

    companion object {
        /**
         * The redacted address Google Pay reports before authorization, or
         * null without a country.
         */
        fun sheetAddress(address: JSONObject): PaymentSheetAddress? {
            val countryCode = address.optNonEmpty("countryCode")?.uppercase() ?: return null
            return PaymentSheetAddress(
                countryCode = countryCode,
                administrativeArea = address.optNonEmpty("administrativeArea"),
                locality = address.optNonEmpty("locality"),
                postalCode = address.optNonEmpty("postalCode")
            )
        }

        /** The card in Google's `IntermediatePaymentMethodData`, or null without its info. */
        fun sheetCard(paymentMethodData: JSONObject): PaymentSheetCard? {
            val info = paymentMethodData.optJSONObject("info") ?: return null
            return PaymentSheetCard(
                network = info.optNonEmpty("cardNetwork")?.let { GooglePayNetworks.fromGooglePay(it) },
                type = PaymentMapper.mapCardFundingSource(info.optNonEmpty("cardFundingSource") ?: "UNKNOWN"),
                displayName = null
            )
        }

        private fun JSONObject.optNonEmpty(key: String): String? {
            if (isNull(key)) return null
            return optString(key).trim().ifEmpty { null }
        }
    }
}
