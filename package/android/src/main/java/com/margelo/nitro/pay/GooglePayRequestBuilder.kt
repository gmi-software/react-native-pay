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
     * Creates an IsReadyToPay request
     */
    fun createIsReadyToPayRequest(existingPaymentMethodRequired: Boolean? = null): JSONObject {
        return JSONObject().apply {
            put("apiVersion", PaymentConstants.API_VERSION)
            put("apiVersionMinor", PaymentConstants.API_VERSION_MINOR)
            put("allowedPaymentMethods", JSONArray().apply {
                put(createBaseCardPaymentMethod())
            })
            existingPaymentMethodRequired?.let {
                put("existingPaymentMethodRequired", it)
            }
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

        return JSONObject().apply {
            put("apiVersion", PaymentConstants.API_VERSION)
            put("apiVersionMinor", PaymentConstants.API_VERSION_MINOR)
            put("merchantInfo", createMerchantInfo(request, environment, fallbackMerchantName))
            put("allowedPaymentMethods", JSONArray().apply {
                put(createCardPaymentMethod(request, environment))
            })
            put("transactionInfo", createTransactionInfo(request))
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
    private fun createBaseCardPaymentMethod(): JSONObject {
        return JSONObject().apply {
            put("type", PaymentConstants.PAYMENT_METHOD_CARD)
            put("parameters", JSONObject().apply {
                put("allowedAuthMethods", createAllowedAuthMethods())
                put("allowedCardNetworks", createAllowedCardNetworks())
            })
        }
    }
    
    /**
     * Creates card payment method with tokenization
     */
    private fun createCardPaymentMethod(
        request: PaymentRequest,
        environment: Int
    ): JSONObject {
        val baseMethod = createBaseCardPaymentMethod()
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
     * Creates transaction info
     */
    private fun createTransactionInfo(request: PaymentRequest): JSONObject {
        val totalAmount = PaymentAmounts.total(request.paymentItems)
        require(totalAmount.signum() >= 0) {
            "Payment total must not be negative, got ${totalAmount.toPlainString()}"
        }
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
            if (request.paymentItems.isNotEmpty()) {
                put("displayItems", createDisplayItems(request.paymentItems))
            }
        }
    }
    
    /**
     * Creates display items array
     */
    private fun createDisplayItems(items: Array<PaymentItem>): JSONArray {
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
    
    /**
     * Creates allowed auth methods
     */
    private fun createAllowedAuthMethods(): JSONArray {
        return JSONArray().apply {
            put(PaymentConstants.AUTH_PAN_ONLY)
            put(PaymentConstants.AUTH_CRYPTOGRAM_3DS)
        }
    }
    
    /**
     * Creates allowed card networks
     */
    fun createAllowedCardNetworks(): JSONArray {
        return JSONArray().apply {
            put(PaymentConstants.NETWORK_VISA)
            put(PaymentConstants.NETWORK_MASTERCARD)
            put(PaymentConstants.NETWORK_AMEX)
            put(PaymentConstants.NETWORK_DISCOVER)
        }
    }
}


