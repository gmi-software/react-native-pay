package com.margelo.nitro.pay

/**
 * Constants used across the payment module
 */
object PaymentConstants {
    // Activity result codes
    const val LOAD_PAYMENT_DATA_REQUEST_CODE = 991
    
    // Google Pay API versions
    const val API_VERSION = 2
    const val API_VERSION_MINOR = 0
    
    // Payment method types
    const val PAYMENT_METHOD_CARD = "CARD"
    
    // Auth methods
    const val AUTH_PAN_ONLY = "PAN_ONLY"
    const val AUTH_CRYPTOGRAM_3DS = "CRYPTOGRAM_3DS"
    
    // Card networks
    const val NETWORK_VISA = "VISA"
    const val NETWORK_MASTERCARD = "MASTERCARD"
    const val NETWORK_AMEX = "AMEX"
    const val NETWORK_DISCOVER = "DISCOVER"
    
    // Tokenization
    const val TOKENIZATION_PAYMENT_GATEWAY = "PAYMENT_GATEWAY"
    const val DEFAULT_GATEWAY = "example"
    const val DEFAULT_GATEWAY_MERCHANT_ID = "exampleGatewayMerchantId"
    
    // Transaction
    const val TOTAL_PRICE_STATUS_FINAL = "FINAL"
    const val TOTAL_PRICE_LABEL_DEFAULT = "Total"
    const val LINE_ITEM_TYPE = "LINE_ITEM"
    const val PENDING_TYPE = "PENDING"
    
    // Merchant
    const val DEFAULT_MERCHANT_NAME = "Example Merchant"
    
    // Supported networks (lowercase for comparison)
    val SUPPORTED_NETWORKS = listOf("visa", "mastercard", "amex", "discover")
    
    // Logging tags
    const val TAG_PAYMENT_HANDLER = "HybridPaymentHandler"
    const val TAG_GOOGLE_PAY_BUTTON = "HybridGooglePayButton"
}


