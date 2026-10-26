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
    
    // Billing address formats
    const val BILLING_ADDRESS_FORMAT_MIN = "MIN"
    const val BILLING_ADDRESS_FORMAT_FULL = "FULL"
    
    // Tokenization
    const val TOKENIZATION_PAYMENT_GATEWAY = "PAYMENT_GATEWAY"
    const val DEFAULT_GATEWAY = "example"
    const val DEFAULT_GATEWAY_MERCHANT_ID = "exampleGatewayMerchantId"
    
    // Transaction
    const val TOTAL_PRICE_STATUS_FINAL = "FINAL"
    const val TOTAL_PRICE_STATUS_ESTIMATED = "ESTIMATED"
    const val TOTAL_PRICE_LABEL_DEFAULT = "Total"
    const val LINE_ITEM_TYPE = "LINE_ITEM"
    const val DISPLAY_ITEM_STATUS_FINAL = "FINAL"
    const val DISPLAY_ITEM_STATUS_PENDING = "PENDING"
    
    // Merchant authorization (`StartPaymentOptions.onAuthorize`), same limit as iOS
    const val AUTHORIZATION_TIMEOUT_MS = 25_000L
    const val ERROR_AUTHORIZATION_FAILED = "Payment authorization failed"
    const val ERROR_AUTHORIZATION_TIMED_OUT = "Payment authorization timed out"
    
    // Errors (keep in sync with iOS `ErrorMessage`)
    const val ERROR_PAYMENT_IN_PROGRESS = "A payment is already in progress"
    const val ERROR_NO_ACTIVITY = "No activity available to show payment UI"
    
    // Logging tags
    const val TAG_PAYMENT_HANDLER = "HybridPaymentHandler"
    const val TAG_GOOGLE_PAY_BUTTON = "HybridGooglePayButton"
}


