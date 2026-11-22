package com.margelo.nitro.pay

import org.json.JSONArray

/**
 * The Google Pay payment data callbacks (`callbackIntents`) a payment asks
 * for. Each one keeps the sheet waiting for [PaymentDataCallbacksService].
 *
 * - [shippingOption]: the payer picks one of the request's shipping methods
 *   in the sheet. Offered with any sheet callback, and only with a shipping
 *   address. Not for `onAuthorize` alone, whose request stays as it was.
 * - [shippingAddress], [paymentMethod]: for `onShippingAddressChange` and
 *   `onPaymentMethodChange`.
 * - [authorization]: for `onAuthorize`, and with any other intent, which
 *   Google Pay requires. Without `onAuthorize` the library accepts the payment
 *   itself.
 *
 * Google Pay can't update recurring, deferred or automatic reload payments,
 * so those only get [authorization].
 */
internal data class CallbackIntents(
    val authorization: Boolean = false,
    val shippingAddress: Boolean = false,
    val shippingOption: Boolean = false,
    val paymentMethod: Boolean = false
) {
    /** Google Pay calls `onPaymentDataChanged`, so the sheet can be updated. */
    val updatesSheet: Boolean
        get() = shippingAddress || shippingOption || paymentMethod

    /** The `callbackIntents` array, or null without any. */
    fun toJson(): JSONArray? {
        val intents = listOfNotNull(
            PaymentConstants.CALLBACK_INTENT_PAYMENT_AUTHORIZATION.takeIf { authorization },
            PaymentConstants.CALLBACK_INTENT_SHIPPING_ADDRESS.takeIf { shippingAddress },
            PaymentConstants.CALLBACK_INTENT_SHIPPING_OPTION.takeIf { shippingOption },
            PaymentConstants.CALLBACK_INTENT_PAYMENT_METHOD.takeIf { paymentMethod }
        )
        return if (intents.isEmpty()) null else JSONArray(intents)
    }

    companion object {
        val NONE = CallbackIntents()

        /** The intents for [request] with the callbacks the app passed. */
        fun from(
            request: PaymentRequest,
            onAuthorize: Boolean,
            onShippingAddressChange: Boolean = false,
            onShippingMethodChange: Boolean = false,
            onPaymentMethodChange: Boolean = false
        ): CallbackIntents {
            val anySheetCallback = onShippingAddressChange || onShippingMethodChange || onPaymentMethodChange
            val canUpdate = canUpdateSheet(request)
            val withShipping = canUpdate && request.shippingContactRequired == true
            val shippingOption = withShipping && anySheetCallback && !request.shippingMethods.isNullOrEmpty()
            val shippingAddress = withShipping && onShippingAddressChange
            val paymentMethod = canUpdate && onPaymentMethodChange
            return CallbackIntents(
                authorization = onAuthorize || shippingOption || shippingAddress || paymentMethod,
                shippingAddress = shippingAddress,
                shippingOption = shippingOption,
                paymentMethod = paymentMethod
            )
        }

        /**
         * Google Pay has no dynamic pricing for merchant initiated
         * transactions: recurring, deferred and automatic reload payments.
         */
        fun canUpdateSheet(request: PaymentRequest): Boolean =
            request.recurring == null && request.deferred == null && request.automaticReload == null
    }
}
