package com.margelo.nitro.pay

import com.google.android.gms.wallet.WalletConstants
import org.json.JSONArray
import org.json.JSONObject
import java.math.BigDecimal
import java.math.RoundingMode

/**
 * Builder for Google Pay API request objects
 */
object GooglePayRequestBuilder {
    
    /**
     * Creates an IsReadyToPay request for the cards in [cardParameters]
     */
    internal fun createIsReadyToPayRequest(
        existingPaymentMethodRequired: Boolean? = null,
        cardParameters: GooglePayCardParameters = GooglePayCardParameters.from(null, null)
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
     */
    fun createPaymentDataRequest(
        request: PaymentRequest,
        environment: Int,
        fallbackMerchantName: String? = null
    ): JSONObject {
        validatePaymentRequest(request, environment)
        validateShippingMethods(request)
        val requested = RequestedDetails.from(request)
        val cardParameters = GooglePayCardParameters.from(
            request.supportedNetworks,
            request.googlePayAllowedAuthMethods
        )

        return JSONObject().apply {
            put("apiVersion", PaymentConstants.API_VERSION)
            put("apiVersionMinor", PaymentConstants.API_VERSION_MINOR)
            put("merchantInfo", createMerchantInfo(request, environment, fallbackMerchantName))
            put("allowedPaymentMethods", JSONArray().apply {
                put(createCardPaymentMethod(request, environment, requested, cardParameters))
            })
            put("transactionInfo", createTransactionInfo(request, requested.shippingMethod))
            if (requested.email) {
                put("emailRequired", true)
            }
            if (requested.shippingContact) {
                put("shippingAddressRequired", true)
                put("shippingAddressParameters", JSONObject().apply {
                    put("phoneNumberRequired", requested.phoneNumberOnShippingAddress)
                })
            }
        }
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
    private fun validateShippingMethods(request: PaymentRequest) {
        val identifiers = mutableSetOf<String>()
        request.shippingMethods?.forEach { method ->
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
     * Creates transaction info. The shipping method is charged as its own line.
     */
    private fun createTransactionInfo(
        request: PaymentRequest,
        shippingMethod: ShippingMethod?
    ): JSONObject {
        // Checked without shipping, like on iOS, where the payer can pick any method.
        val itemsTotal = PaymentAmounts.total(request.paymentItems)
        require(itemsTotal.signum() >= 0) {
            "Payment total must not be negative, got ${itemsTotal.toPlainString()}"
        }
        val shippingAmount = shippingMethod?.let { PaymentAmounts.parse(it) } ?: BigDecimal.ZERO
        val totalAmount = itemsTotal.add(shippingAmount)
        val hasPendingItems = request.paymentItems.any { it.type == PaymentItemType.PENDING }
        
        return JSONObject().apply {
            put(
                "totalPriceStatus",
                if (hasPendingItems)
                    PaymentConstants.TOTAL_PRICE_STATUS_ESTIMATED
                else
                    PaymentConstants.TOTAL_PRICE_STATUS_FINAL
            )
            put("totalPrice", formatPrice(totalAmount))
            put("totalPriceLabel", PaymentConstants.TOTAL_PRICE_LABEL_DEFAULT)
            put("currencyCode", request.currencyCode)
            put("countryCode", request.countryCode)
            
            // Add display items if present
            if (request.paymentItems.isNotEmpty() || shippingMethod != null) {
                put("displayItems", createDisplayItems(request.paymentItems, shippingMethod))
            }
        }
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
                    put("type", PaymentConstants.LINE_ITEM_TYPE)
                    put("price", formatPrice(PaymentAmounts.parse(item)))
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
                    put("type", PaymentConstants.LINE_ITEM_TYPE)
                    put("price", formatPrice(PaymentAmounts.parse(method)))
                    put("status", PaymentConstants.DISPLAY_ITEM_STATUS_FINAL)
                })
            }
        }
    }

    /**
     * Google Pay accepts whole amounts or exactly two decimal places
     * (`^[0-9]+(\.[0-9][0-9])?$` for the total).
     */
    private fun formatPrice(amount: BigDecimal): String {
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
