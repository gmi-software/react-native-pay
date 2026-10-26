package com.margelo.nitro.pay

import android.content.Context
import com.google.android.gms.wallet.button.ButtonConstants
import com.google.android.gms.wallet.button.ButtonOptions
import com.google.android.gms.wallet.button.PayButton

/**
 * Factory for creating and configuring Google Pay buttons
 */
object GooglePayButtonFactory {
    
    /**
     * Creates a configured PayButton that shows the cards in [cardParameters]
     */
    internal fun createButton(
        context: Context,
        buttonType: GooglePayButtonType,
        theme: GooglePayButtonTheme,
        radius: Double?,
        cardParameters: GooglePayCardParameters,
        onPress: (() -> Unit)?
    ): PayButton {
        val allowedPaymentMethods = GooglePayRequestBuilder.createButtonPaymentMethods(cardParameters)
        
        val buttonOptions = ButtonOptions.newBuilder()
            .setButtonType(mapButtonType(buttonType))
            .setButtonTheme(mapTheme(theme))
            .setAllowedPaymentMethods(allowedPaymentMethods.toString())
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
}
