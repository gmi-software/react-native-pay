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
    
    // Address formats. MIN is for billing only.
    const val BILLING_ADDRESS_FORMAT_MIN = "MIN"
    // FULL plus `iso3166AdministrativeArea`, the region as an ISO 3166-2 code
    const val ADDRESS_FORMAT_FULL_ISO3166 = "FULL-ISO3166"
    
    // Tokenization
    const val TOKENIZATION_PAYMENT_GATEWAY = "PAYMENT_GATEWAY"
    const val DEFAULT_GATEWAY = "example"
    const val DEFAULT_GATEWAY_MERCHANT_ID = "exampleGatewayMerchantId"
    
    // Transaction
    const val TOTAL_PRICE_STATUS_FINAL = "FINAL"
    const val TOTAL_PRICE_STATUS_ESTIMATED = "ESTIMATED"
    const val TOTAL_PRICE_LABEL_DEFAULT = "Total"
    const val LINE_ITEM_TYPE = "LINE_ITEM"
    const val SUBTOTAL_TYPE = "SUBTOTAL"
    const val TAX_TYPE = "TAX"
    const val DISCOUNT_TYPE = "DISCOUNT"
    const val SHIPPING_OPTION_TYPE = "SHIPPING_OPTION"
    const val DISPLAY_ITEM_STATUS_FINAL = "FINAL"
    const val DISPLAY_ITEM_STATUS_PENDING = "PENDING"
    const val CHECKOUT_OPTION_DEFAULT = "DEFAULT"
    const val CHECKOUT_OPTION_COMPLETE_IMMEDIATE_PURCHASE = "COMPLETE_IMMEDIATE_PURCHASE"
    const val CHECKOUT_OPTION_CONTINUE_TO_REVIEW = "CONTINUE_TO_REVIEW"
    
    // Merchant authorization (`StartPaymentOptions.onAuthorize`), same limit as iOS
    const val AUTHORIZATION_TIMEOUT_MS = 25_000L
    const val ERROR_AUTHORIZATION_FAILED = "Payment authorization failed"
    const val ERROR_AUTHORIZATION_TIMED_OUT = "Payment authorization timed out"
    // Google Pay's payment data callbacks (`callbackIntents`)
    const val CALLBACK_INTENT_PAYMENT_AUTHORIZATION = "PAYMENT_AUTHORIZATION"
    const val CALLBACK_INTENT_SHIPPING_ADDRESS = "SHIPPING_ADDRESS"
    const val CALLBACK_INTENT_SHIPPING_OPTION = "SHIPPING_OPTION"
    const val CALLBACK_INTENT_PAYMENT_METHOD = "PAYMENT_METHOD"
    // `IntermediatePaymentData.callbackTrigger`, besides the intents above
    const val CALLBACK_TRIGGER_INITIALIZE = "INITIALIZE"
    // Sheet callbacks (`onShippingAddressChange`...), same limit as iOS
    const val SHEET_CALLBACK_TIMEOUT_MS = 25_000L
    // Keeps JS timers running under the sheet; same key as src/sheetAuthorizationTask.ts
    const val SHEET_AUTHORIZATION_TASK = "ReactNativePaySheetAuthorization"
    const val SHEET_AUTHORIZATION_TASK_TIMEOUT_MS = 35_000L
    
    // How long an availability check waits for Google Pay
    const val READY_TO_PAY_TIMEOUT_SECONDS = 5L
    
    // Errors (keep in sync with iOS `ErrorMessage`)
    const val ERROR_PAYMENT_IN_PROGRESS = "A payment is already in progress"
    const val ERROR_NO_ACTIVITY = "No activity available to show payment UI"
    const val ERROR_PAYMENT_CANCELLED = "Payment cancelled by user"
    
    // Logging tags
    const val TAG_PAYMENT_HANDLER = "HybridPaymentHandler"
    const val TAG_GOOGLE_PAY_BUTTON = "HybridGooglePayButton"
}


