package com.margelo.nitro.pay

import com.google.android.gms.wallet.WalletConstants
import org.json.JSONArray
import org.json.JSONObject
import java.math.BigDecimal

/**
 * Builder for Google Pay API request objects
 */
object GooglePayRequestBuilder {
    
    /**
     * Creates an IsReadyToPay request for the cards in [cardParameters]
     */
    internal fun createIsReadyToPayRequest(
        cardParameters: GooglePayCardParameters,
        existingPaymentMethodRequired: Boolean? = null
    ): JSONObject {
        return JSONObject().apply {
            put("apiVersion", PaymentConstants.API_VERSION)
            put("apiVersionMinor", PaymentConstants.API_VERSION_MINOR)
            put("allowedPaymentMethods", createAllowedPaymentMethods(cardParameters))
            existingPaymentMethodRequired?.let {
                put("existingPaymentMethodRequired", it)
            }
        }
    }

    /**
     * The `allowedPaymentMethods` of an IsReadyToPay request or a PayButton:
     * the cards in [cardParameters]
     */
    internal fun createAllowedPaymentMethods(cardParameters: GooglePayCardParameters): JSONArray {
        return JSONArray().apply {
            put(createBaseCardPaymentMethod(cardParameters))
        }
    }
    
    /**
     * Creates a complete payment data request
     *
     * @param fallbackMerchantName shown when the request has no merchantName,
     *   typically the app label. When both are blank, merchantName is omitted.
     * @param callbacks the payment data callbacks [PaymentDataCallbacksService]
     *   answers while the sheet is open. With a shipping option, the payer
     *   picks one of the shipping methods in the sheet.
     */
    internal fun createPaymentDataRequest(
        request: PaymentRequest,
        environment: Int,
        fallbackMerchantName: String? = null,
        callbacks: CallbackIntents = CallbackIntents.NONE
    ): JSONObject {
        validatePaymentRequest(request, environment)
        validateShippingMethods(request.shippingMethods)
        val requested = RequestedDetails.from(request)
        val cardParameters = GooglePayCardParameters.from(
            request.supportedNetworks,
            request.googlePayAllowedAuthMethods,
            request.merchantCapabilities,
            request.googlePayAllowPrepaidCards
        )

        return JSONObject().apply {
            put("apiVersion", PaymentConstants.API_VERSION)
            put("apiVersionMinor", PaymentConstants.API_VERSION_MINOR)
            put("merchantInfo", createMerchantInfo(request, environment, fallbackMerchantName))
            put("allowedPaymentMethods", JSONArray().apply {
                put(createCardPaymentMethod(request, environment, requested, cardParameters))
            })
            val (transactionKey, transaction) =
                createTransaction(request, request.paymentItems, requested.shippingMethod)
            put(transactionKey, transaction)
            if (requested.email) {
                put("emailRequired", true)
            }
            if (requested.shippingContact) {
                put("shippingAddressRequired", true)
                put("shippingAddressParameters", JSONObject().apply {
                    put("phoneNumberRequired", requested.phoneNumberOnShippingAddress)
                })
            }
            val shippingMethods = request.shippingMethods
            if (callbacks.shippingOption && !shippingMethods.isNullOrEmpty()) {
                put("shippingOptionRequired", true)
                put(
                    "shippingOptionParameters",
                    createShippingOptionParameters(shippingMethods, shippingMethods[0].identifier)
                )
            }
            callbacks.toJson()?.let { put("callbackIntents", it) }
        }
    }

    /**
     * The shipping options the payer picks from, with [selectedIdentifier]
     * selected. Google Pay shows no price for an option, only the total.
     *
     * @throws IllegalArgumentException when a method's amount has more than
     *   two decimal places, which Google Pay can't charge: checked for every
     *   method, since the payer can pick any of them
     */
    internal fun createShippingOptionParameters(
        methods: Array<ShippingMethod>,
        selectedIdentifier: String
    ): JSONObject {
        methods.forEach { PaymentAmounts.googlePayPrice(it) }
        return JSONObject().apply {
            put("defaultSelectedOptionId", selectedIdentifier)
            put("shippingOptions", JSONArray().apply {
                methods.forEach { method ->
                    put(JSONObject().apply {
                        put("id", method.identifier)
                        put("label", method.label)
                        method.detail?.takeIf { it.isNotBlank() }?.let { put("description", it) }
                    })
                }
            })
        }
    }

    /**
     * The `newTransactionInfo` of a sheet update: what [createPaymentDataRequest]
     * sends for [items] and [shippingMethod], with the `checkoutOption` an
     * update must have. Only for a payment whose sheet can be updated, see
     * [CallbackIntents.canUpdateSheet].
     *
     * @throws IllegalArgumentException when the request would reject the
     *   items, such as a negative total
     */
    internal fun createTransactionInfoUpdate(
        request: PaymentRequest,
        items: Array<PaymentItem>,
        shippingMethod: ShippingMethod?
    ): JSONObject {
        val (key, transaction) = createTransaction(request, items, shippingMethod)
        require(key == "transactionInfo") { "Google Pay can't update $key" }
        if (!transaction.has("checkoutOption")) {
            transaction.put("checkoutOption", PaymentConstants.CHECKOUT_OPTION_DEFAULT)
        }
        return transaction
    }
    
    /**
     * Creates merchant info object
     */
    private fun createMerchantInfo(
        request: PaymentRequest,
        environment: Int,
        fallbackMerchantName: String?
    ): JSONObject {
        val merchantName = request.merchantName?.trim().takeUnless { it.isNullOrEmpty() }
            ?: fallbackMerchantName?.trim().takeUnless { it.isNullOrEmpty() }

        return JSONObject().apply {
            merchantName?.let { put("merchantName", it) }
            // Add merchant ID only for PRODUCTION environment
            if (environment == WalletConstants.ENVIRONMENT_PRODUCTION) {
                put("merchantId", request.googlePayMerchantId)
            }
        }
    }
    
    /**
     * Creates base card payment method (no tokenization)
     */
    private fun createBaseCardPaymentMethod(cardParameters: GooglePayCardParameters): JSONObject {
        return JSONObject().apply {
            put("type", PaymentConstants.PAYMENT_METHOD_CARD)
            put("parameters", cardParameters.toJson())
        }
    }
    
    /**
     * Creates card payment method with tokenization
     */
    private fun createCardPaymentMethod(
        request: PaymentRequest,
        environment: Int,
        requested: RequestedDetails,
        cardParameters: GooglePayCardParameters
    ): JSONObject {
        val baseMethod = createBaseCardPaymentMethod(cardParameters)
        if (requested.billingAddressRequired) {
            baseMethod.getJSONObject("parameters").apply {
                put("billingAddressRequired", true)
                put("billingAddressParameters", JSONObject().apply {
                    // MIN is name, country and postal code: the least that carries a phone number.
                    put(
                        "format",
                        if (requested.billingContact)
                            PaymentConstants.BILLING_ADDRESS_FORMAT_FULL
                        else
                            PaymentConstants.BILLING_ADDRESS_FORMAT_MIN
                    )
                    put("phoneNumberRequired", requested.phoneNumberOnBillingAddress)
                })
            }
        }
        baseMethod.put("tokenizationSpecification", createTokenizationSpec(request, environment))
        return baseMethod
    }
    
    /**
     * Creates tokenization specification
     */
    private fun createTokenizationSpec(
        request: PaymentRequest,
        environment: Int
    ): JSONObject {
        val isProduction = environment == WalletConstants.ENVIRONMENT_PRODUCTION
        val gateway = if (isProduction) {
            request.googlePayGateway!!.trim()
        } else {
            request.googlePayGateway?.trim().takeUnless { it.isNullOrEmpty() }
                ?: PaymentConstants.DEFAULT_GATEWAY
        }
        val gatewayMerchantId = if (isProduction) {
            request.googlePayGatewayMerchantId!!.trim()
        } else {
            request.googlePayGatewayMerchantId?.trim().takeUnless { it.isNullOrEmpty() }
                ?: PaymentConstants.DEFAULT_GATEWAY_MERCHANT_ID
        }

        return JSONObject().apply {
            put("type", PaymentConstants.TOKENIZATION_PAYMENT_GATEWAY)
            put("parameters", JSONObject().apply {
                put("gateway", gateway)
                put("gatewayMerchantId", gatewayMerchantId)
            })
        }
    }

    private fun validatePaymentRequest(request: PaymentRequest, environment: Int) {
        if (environment != WalletConstants.ENVIRONMENT_PRODUCTION) return

        require(!request.googlePayMerchantId.isNullOrBlank()) {
            "googlePayMerchantId is required in PRODUCTION"
        }
        require(!request.googlePayGateway.isNullOrBlank()) {
            "googlePayGateway is required in PRODUCTION"
        }
        require(!request.googlePayGatewayMerchantId.isNullOrBlank()) {
            "googlePayGatewayMerchantId is required in PRODUCTION"
        }
    }
    
    /**
     * Same rules and messages as iOS
     */
    internal fun validateShippingMethods(methods: Array<ShippingMethod>?) {
        val identifiers = mutableSetOf<String>()
        methods?.forEach { method ->
            require(method.identifier.isNotBlank()) {
                "Shipping method \"${method.label}\" needs an identifier"
            }
            require(identifiers.add(method.identifier)) {
                "Shipping method identifier \"${method.identifier}\" is used more than once"
            }
            require(PaymentAmounts.parse(method).signum() >= 0) {
                "Amount for \"${method.label}\" must not be negative"
            }
        }
    }
    
    /**
     * The transaction object and its key, for [paymentItems] and
     * [shippingMethod]: `transactionInfo`, or the recurring, deferred or
     * automatic reload object that replaces it. The shipping method is
     * charged as its own line.
     */
    private fun createTransaction(
        request: PaymentRequest,
        paymentItems: Array<PaymentItem>,
        shippingMethod: ShippingMethod?
    ): Pair<String, JSONObject> {
        // Checked without shipping, like on iOS, where the payer can pick any method.
        val itemsTotal = PaymentAmounts.total(paymentItems)
        require(itemsTotal.signum() >= 0) {
            "Payment total must not be negative, got ${itemsTotal.toPlainString()}"
        }
        val shippingAmount = shippingMethod?.let { PaymentAmounts.parse(it) } ?: BigDecimal.ZERO
        val totalPrice = PaymentAmounts.formatPrice(itemsTotal.add(shippingAmount))
        val displayItems = if (paymentItems.isNotEmpty() || shippingMethod != null) {
            createDisplayItems(paymentItems, shippingMethod)
        } else {
            null
        }

        // The merchant token objects have no checkoutOption, so it has no effect there.
        MerchantTokenTransactions.create(request, totalPrice, displayItems)?.let { return it }

        val hasPendingItems = paymentItems.any { it.type == PaymentItemType.PENDING }
        val checkoutOption = request.googlePayCheckoutOption
        require(
            !(hasPendingItems && checkoutOption == GooglePayCheckoutOption.COMPLETEIMMEDIATEPURCHASE)
        ) {
            "googlePayCheckoutOption 'completeImmediatePurchase' needs a final total, but a payment item is pending"
        }
        return "transactionInfo" to JSONObject().apply {
            put(
                "totalPriceStatus",
                if (hasPendingItems)
                    PaymentConstants.TOTAL_PRICE_STATUS_ESTIMATED
                else
                    PaymentConstants.TOTAL_PRICE_STATUS_FINAL
            )
            put("totalPrice", totalPrice)
            put("totalPriceLabel", request.totalLabel ?: PaymentConstants.TOTAL_PRICE_LABEL_DEFAULT)
            put("currencyCode", request.currencyCode)
            put("countryCode", request.countryCode)
            displayItems?.let { put("displayItems", it) }
            checkoutOption?.let { put("checkoutOption", checkoutOptionValue(it)) }
        }
    }

    private fun checkoutOptionValue(option: GooglePayCheckoutOption): String = when (option) {
        GooglePayCheckoutOption.DEFAULT -> PaymentConstants.CHECKOUT_OPTION_DEFAULT
        GooglePayCheckoutOption.COMPLETEIMMEDIATEPURCHASE ->
            PaymentConstants.CHECKOUT_OPTION_COMPLETE_IMMEDIATE_PURCHASE
        GooglePayCheckoutOption.CONTINUETOREVIEW -> PaymentConstants.CHECKOUT_OPTION_CONTINUE_TO_REVIEW
    }
    
    /**
     * Creates display items array
     */
    private fun createDisplayItems(
        items: Array<PaymentItem>,
        shippingMethod: ShippingMethod?
    ): JSONArray {
        return JSONArray().apply {
            items.forEach { item ->
                put(JSONObject().apply {
                    put("label", item.label)
                    put("type", displayItemType(item.kind))
                    put("price", PaymentAmounts.googlePayPrice(item))
                    put(
                        "status",
                        if (item.type == PaymentItemType.PENDING)
                            PaymentConstants.DISPLAY_ITEM_STATUS_PENDING
                        else
                            PaymentConstants.DISPLAY_ITEM_STATUS_FINAL
                    )
                })
            }
            shippingMethod?.let { method ->
                put(JSONObject().apply {
                    put("label", method.label)
                    put("type", PaymentConstants.SHIPPING_OPTION_TYPE)
                    put("price", PaymentAmounts.googlePayPrice(method))
                    put("status", PaymentConstants.DISPLAY_ITEM_STATUS_FINAL)
                })
            }
        }
    }

    private fun displayItemType(kind: PaymentItemKind?): String = when (kind) {
        PaymentItemKind.SUBTOTAL -> PaymentConstants.SUBTOTAL_TYPE
        PaymentItemKind.TAX -> PaymentConstants.TAX_TYPE
        PaymentItemKind.DISCOUNT -> PaymentConstants.DISCOUNT_TYPE
        null -> PaymentConstants.LINE_ITEM_TYPE
    }
}
