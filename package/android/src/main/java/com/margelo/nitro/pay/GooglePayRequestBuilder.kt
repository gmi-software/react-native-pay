package com.margelo.nitro.pay

import com.google.android.gms.wallet.WalletConstants
import org.json.JSONArray
import org.json.JSONObject

/**
 * Builder for Google Pay API request objects
 */
object GooglePayRequestBuilder {
    
    /**
     * Creates an IsReadyToPay request
     */
    fun createIsReadyToPayRequest(): JSONObject {
        return JSONObject().apply {
            put("apiVersion", PaymentConstants.API_VERSION)
            put("apiVersionMinor", PaymentConstants.API_VERSION_MINOR)
            put("allowedPaymentMethods", JSONArray().apply {
                put(createBaseCardPaymentMethod())
            })
        }
    }
    
    /**
     * Creates a complete payment data request
     */
    fun createPaymentDataRequest(
        request: PaymentRequest,
        environment: Int
    ): JSONObject {
        return JSONObject().apply {
            put("apiVersion", PaymentConstants.API_VERSION)
            put("apiVersionMinor", PaymentConstants.API_VERSION_MINOR)
            put("merchantInfo", createMerchantInfo(request, environment))
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
        environment: Int
    ): JSONObject {
        return JSONObject().apply {
            put("merchantName", request.merchantName ?: PaymentConstants.DEFAULT_MERCHANT_NAME)
            // Add merchant ID only for PRODUCTION environment
            if (environment == WalletConstants.ENVIRONMENT_PRODUCTION) {
                put("merchantId", request.merchantIdentifier)
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
        return JSONObject().apply {
            put("type", PaymentConstants.TOKENIZATION_PAYMENT_GATEWAY)
            put("parameters", JSONObject().apply {
                val isProduction = environment == WalletConstants.ENVIRONMENT_PRODUCTION
                put("gateway", request.googlePayGateway ?: PaymentConstants.DEFAULT_GATEWAY)
                put(
                    "gatewayMerchantId",
                    request.googlePayGatewayMerchantId 
                        ?: if (isProduction) request.merchantIdentifier 
                        else PaymentConstants.DEFAULT_GATEWAY_MERCHANT_ID
                )
            })
        }
    }
    
    /**
     * Creates transaction info
     */
    private fun createTransactionInfo(request: PaymentRequest): JSONObject {
        val totalAmount = request.paymentItems.sumOf { it.amount }
        
        return JSONObject().apply {
            put("totalPriceStatus", PaymentConstants.TOTAL_PRICE_STATUS_FINAL)
            put("totalPrice", String.format("%.2f", totalAmount))
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
                    put(
                        "type",
                        if (item.type == PaymentItemType.FINAL) 
                            PaymentConstants.LINE_ITEM_TYPE 
                        else 
                            PaymentConstants.PENDING_TYPE
                    )
                    put("price", String.format("%.2f", item.amount))
                })
            }
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


