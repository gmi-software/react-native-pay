package com.margelo.nitro.pay

import android.util.Log
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import com.facebook.react.uimanager.ThemedReactContext
import com.google.android.gms.wallet.button.PayButton

/**
 * Hybrid implementation of GooglePayButton view component
 */
class HybridGooglePayButton(context: ThemedReactContext) : HybridGooglePayButtonSpec() {
    
    // View state
    private var payButton: PayButton? = null
    private val container: FrameLayout = FrameLayout(context)
    
    // Configuration tracking for change detection
    private var currentButtonType: GooglePayButtonType? = null
    private var currentTheme: GooglePayButtonTheme? = null
    private var currentRadius: Double? = null
    
    // Props
    override var buttonType: GooglePayButtonType = GooglePayButtonType.BUY
    override var theme: GooglePayButtonTheme = GooglePayButtonTheme.DARK
    override var radius: Double? = null
    override var onPress: (() -> Unit)? = null
    
    override var view: View = container
    override val memorySize: Long get() = 0L
    
    init {
        Log.d(PaymentConstants.TAG_GOOGLE_PAY_BUTTON, "Initializing Google Pay button")
        setupButton()
    }
    
    override fun afterUpdate() {
        setupButton()
    }
    
    // MARK: - Private helpers
    
    private fun setupButton() {
        val context = container.context ?: return
        
        try {
            if (shouldReuseButton()) {
                updateExistingButton()
                return
            }
            
            recreateButton(context)
            
        } catch (e: Exception) {
            Log.e(PaymentConstants.TAG_GOOGLE_PAY_BUTTON, "Error setting up button", e)
            restoreExistingButton()
        }
    }
    
    /**
     * Checks if the existing button can be reused
     */
    private fun shouldReuseButton(): Boolean {
        val hasButton = payButton != null && payButton?.parent == container
        val propsUnchanged = currentButtonType == buttonType &&
                             currentTheme == theme &&
                             currentRadius == radius
        return hasButton && propsUnchanged
    }
    
    /**
     * Updates the click listener on existing button
     */
    private fun updateExistingButton() {
        payButton?.setOnClickListener {
            onPress?.invoke()
        }
        Log.d(PaymentConstants.TAG_GOOGLE_PAY_BUTTON, "Button reused - props unchanged")
    }
    
    /**
     * Recreates the button with new configuration
     */
    private fun recreateButton(context: android.content.Context) {
        Log.d(
            PaymentConstants.TAG_GOOGLE_PAY_BUTTON,
            "Recreating button - type: $buttonType, theme: $theme, radius: $radius"
        )
        
        // Remove existing button
        container.removeAllViews()
        
        // Create new button
        val newButton = GooglePayButtonFactory.createButton(
            context,
            buttonType,
            theme,
            radius,
            onPress
        )
        
        // Update state
        payButton = newButton
        currentButtonType = buttonType
        currentTheme = theme
        currentRadius = radius
        
        // Add to container
        val layoutParams = FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        )
        container.addView(newButton, layoutParams)
        container.requestLayout()
        
        Log.d(PaymentConstants.TAG_GOOGLE_PAY_BUTTON, "Button created successfully")
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
                    Log.d(PaymentConstants.TAG_GOOGLE_PAY_BUTTON, "Restored existing button")
                }
            } catch (restoreException: Exception) {
                Log.e(
                    PaymentConstants.TAG_GOOGLE_PAY_BUTTON,
                    "Failed to restore button",
                    restoreException
                )
            }
        }
    }
}
