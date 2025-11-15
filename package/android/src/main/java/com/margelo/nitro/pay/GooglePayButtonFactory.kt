package com.margelo.nitro.pay

import android.content.Context
import android.util.Log
import com.google.android.gms.wallet.button.ButtonConstants
import com.google.android.gms.wallet.button.ButtonOptions
import com.google.android.gms.wallet.button.PayButton

/**
 * Factory for creating and configuring Google Pay buttons
 */
object GooglePayButtonFactory {
    
    /**
     * Creates a configured PayButton
     */
    fun createButton(
        context: Context,
        buttonType: GooglePayButtonType,
        theme: GooglePayButtonTheme,
        radius: Double?,
        onPress: (() -> Unit)?
    ): PayButton {
        val allowedPaymentMethods = GooglePayRequestBuilder.createAllowedCardNetworks()
        
        val buttonOptions = ButtonOptions.newBuilder()
            .setButtonType(mapButtonType(buttonType))
            .setButtonTheme(mapTheme(theme))
            .setAllowedPaymentMethods(createAllowedPaymentMethodsJson(allowedPaymentMethods))
            .apply {
                radius?.let { r ->
                    if (r >= 0) {
                        setCornerRadius(r.toInt())
                    }
                }
            }
            .build()
        
        val button = PayButton(context)
        button.initialize(buttonOptions)
        button.setOnClickListener {
            onPress?.invoke()
        }
        
        return button
    }
    
    /**
     * Maps GooglePayButtonType to ButtonConstants
     */
    private fun mapButtonType(type: GooglePayButtonType): Int {
        return when (type) {
            GooglePayButtonType.BUY -> ButtonConstants.ButtonType.BUY
            GooglePayButtonType.BOOK -> ButtonConstants.ButtonType.BOOK
            GooglePayButtonType.CHECKOUT -> ButtonConstants.ButtonType.CHECKOUT
            GooglePayButtonType.DONATE -> ButtonConstants.ButtonType.DONATE
            GooglePayButtonType.ORDER -> ButtonConstants.ButtonType.ORDER
            GooglePayButtonType.PAY -> ButtonConstants.ButtonType.PAY
            GooglePayButtonType.SUBSCRIBE -> ButtonConstants.ButtonType.SUBSCRIBE
            GooglePayButtonType.PLAIN -> ButtonConstants.ButtonType.PLAIN
        }
    }
    
    /**
     * Maps GooglePayButtonTheme to ButtonConstants
     */
    private fun mapTheme(theme: GooglePayButtonTheme): Int {
        return when (theme) {
            GooglePayButtonTheme.DARK -> ButtonConstants.ButtonTheme.DARK
            GooglePayButtonTheme.LIGHT -> ButtonConstants.ButtonTheme.LIGHT
        }
    }
    
    /**
     * Creates allowed payment methods JSON for button configuration
     */
    private fun createAllowedPaymentMethodsJson(
        allowedNetworks: org.json.JSONArray
    ): String {
        return org.json.JSONArray().apply {
            put(org.json.JSONObject().apply {
                put("type", PaymentConstants.PAYMENT_METHOD_CARD)
                put("parameters", org.json.JSONObject().apply {
                    put("allowedAuthMethods", org.json.JSONArray().apply {
                        put(PaymentConstants.AUTH_PAN_ONLY)
                        put(PaymentConstants.AUTH_CRYPTOGRAM_3DS)
                    })
                    put("allowedCardNetworks", allowedNetworks)
                })
            })
        }.toString()
    }
}


