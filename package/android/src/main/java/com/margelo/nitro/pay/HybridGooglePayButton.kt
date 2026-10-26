package com.margelo.nitro.pay

import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import com.facebook.react.uimanager.ThemedReactContext
import com.google.android.gms.wallet.button.PayButton

/**
 * Hybrid implementation of GooglePayButton view component
 */
class HybridGooglePayButton(context: ThemedReactContext) : HybridGooglePayButtonSpec() {
    
    /** What a PayButton is built from: a different value needs a new button */
    private data class ButtonConfig(
        val buttonType: GooglePayButtonType,
        val theme: GooglePayButtonTheme,
        val radius: Double?,
        val cardParameters: GooglePayCardParameters
    )
    
    // View state
    private var payButton: PayButton? = null
    private val container: FrameLayout = FrameLayout(context)
    private var buttonConfig: ButtonConfig? = null
    
    // Props
    override var buttonType: GooglePayButtonType = GooglePayButtonType.BUY
    override var theme: GooglePayButtonTheme = GooglePayButtonTheme.DARK
    override var radius: Double? = null
    override var supportedNetworks: Array<String>? = null
    override var googlePayAllowedAuthMethods: Array<String>? = null
    override var merchantCapabilities: Array<String>? = null
    override var onPress: (() -> Unit)? = null
    
    override var view: View = container
    override val memorySize: Long get() = 0L
    
    init {
        PayLog.d(PaymentConstants.TAG_GOOGLE_PAY_BUTTON, "Initializing Google Pay button")
        setupButton()
    }
    
    override fun afterUpdate() {
        setupButton()
    }
    
    // MARK: - Private helpers
    
    private fun setupButton() {
        val context = container.context ?: return
        
        try {
            // Built first, so an invalid value keeps the existing button.
            val config = ButtonConfig(
                buttonType,
                theme,
                radius,
                GooglePayCardParameters.from(
                    supportedNetworks,
                    googlePayAllowedAuthMethods,
                    merchantCapabilities
                )
            )
            if (payButton?.parent == container && config == buttonConfig) {
                updateExistingButton()
                return
            }
            
            recreateButton(context, config)
            
        } catch (e: Exception) {
            PayLog.e(PaymentConstants.TAG_GOOGLE_PAY_BUTTON, "Error setting up button", e)
            restoreExistingButton()
        }
    }
    
    /**
     * Updates the click listener on existing button
     */
    private fun updateExistingButton() {
        payButton?.setOnClickListener {
            onPress?.invoke()
        }
        PayLog.d(PaymentConstants.TAG_GOOGLE_PAY_BUTTON, "Button reused - props unchanged")
    }
    
    /**
     * Recreates the button with new configuration
     */
    private fun recreateButton(context: android.content.Context, config: ButtonConfig) {
        PayLog.d(PaymentConstants.TAG_GOOGLE_PAY_BUTTON, "Recreating button - $config")
        
        // Remove existing button
        container.removeAllViews()
        
        // Create new button
        val newButton = GooglePayButtonFactory.createButton(
            context,
            config.buttonType,
            config.theme,
            config.radius,
            config.cardParameters,
            onPress
        )
        
        // Update state
        payButton = newButton
        buttonConfig = config
        
        // Add to container
        val layoutParams = FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        )
        container.addView(newButton, layoutParams)
        container.requestLayout()
        
        PayLog.d(PaymentConstants.TAG_GOOGLE_PAY_BUTTON, "Button created successfully")
    }
    
    /**
     * Attempts to restore existing button if setup fails
     */
    private fun restoreExistingButton() {
        payButton?.let { existingButton ->
            try {
                if (existingButton.parent == null) {
                    container.removeAllViews()
                    container.addView(
                        existingButton,
                        FrameLayout.LayoutParams(
                            ViewGroup.LayoutParams.MATCH_PARENT,
                            ViewGroup.LayoutParams.MATCH_PARENT
                        )
                    )
                    PayLog.d(PaymentConstants.TAG_GOOGLE_PAY_BUTTON, "Restored existing button")
                }
            } catch (restoreException: Exception) {
                PayLog.e(
                    PaymentConstants.TAG_GOOGLE_PAY_BUTTON,
                    "Failed to restore button",
                    restoreException
                )
            }
        }
    }
}
