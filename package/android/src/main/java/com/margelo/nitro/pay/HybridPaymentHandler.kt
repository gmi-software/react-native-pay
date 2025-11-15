package com.margelo.nitro.pay

import android.app.Activity
import android.content.Intent
import android.util.Log
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.ReactApplicationContext
import com.google.android.gms.wallet.AutoResolveHelper
import com.google.android.gms.wallet.IsReadyToPayRequest
import com.google.android.gms.wallet.PaymentData
import com.google.android.gms.wallet.PaymentDataRequest
import com.google.android.gms.wallet.PaymentsClient
import com.google.android.gms.wallet.Wallet
import com.google.android.gms.wallet.WalletConstants
import com.margelo.nitro.core.Promise
import com.margelo.nitro.NitroModules

/**
 * Hybrid implementation of PaymentHandler for Google Pay on Android
 */
class HybridPaymentHandler : HybridPaymentHandlerSpec(), ActivityEventListener {
    
    private val reactContext: ReactApplicationContext by lazy {
        NitroModules.applicationContext as? ReactApplicationContext
            ?: throw IllegalStateException("Application context is not ReactApplicationContext")
    }
    
    private var paymentPromise: Promise<PaymentResult>? = null
    private var currentEnvironment: Int = WalletConstants.ENVIRONMENT_TEST
    
    init {
        reactContext.addActivityEventListener(this)
    }
    
    override val memorySize: Long get() = 0L
    
    // MARK: - Public API
    
    override fun payServiceStatus(): PayServiceStatus {
        return try {
            val request = IsReadyToPayRequest.fromJson(
                GooglePayRequestBuilder.createIsReadyToPayRequest().toString()
            )
            
            val client = createPaymentsClient(currentEnvironment)
            client.isReadyToPay(request) // Trigger async check
            
            // Return optimistic status (actual check is async)
            PayServiceStatus(canMakePayments = true, canSetupCards = true)
        } catch (e: Exception) {
            Log.e(PaymentConstants.TAG_PAYMENT_HANDLER, "Error checking status", e)
            PayServiceStatus(canMakePayments = false, canSetupCards = false)
        }
    }
    
    override fun canMakePayments(usingNetworks: Array<String>): Boolean {
        return usingNetworks.any { network ->
            PaymentConstants.SUPPORTED_NETWORKS.contains(network.lowercase())
        }
    }
    
    override fun startPayment(request: PaymentRequest): Promise<PaymentResult> {
        val promise = Promise<PaymentResult>()
        paymentPromise = promise
        
        try {
            val environment = determineEnvironment(request.googlePayEnvironment)
            currentEnvironment = environment
            
            val paymentDataRequest = GooglePayRequestBuilder.createPaymentDataRequest(
                request,
                environment
            )
            
            logPaymentRequest(paymentDataRequest, environment)
            
            val activity = reactContext.currentActivity
            if (activity == null) {
                handlePaymentError("No activity available to show payment UI")
                return promise
            }
            
            launchPaymentUI(paymentDataRequest, activity, environment)
            
        } catch (e: Exception) {
            Log.e(PaymentConstants.TAG_PAYMENT_HANDLER, "Failed to start payment", e)
            handlePaymentError("Failed to start payment: ${e.message}")
        }
        
        return promise
    }
    
    // MARK: - ActivityEventListener
    
    override fun onActivityResult(
        activity: Activity,
        requestCode: Int,
        resultCode: Int,
        data: Intent?
    ) {
        if (requestCode != PaymentConstants.LOAD_PAYMENT_DATA_REQUEST_CODE) return
        
        when (resultCode) {
            Activity.RESULT_OK -> {
                data?.let { 
                    PaymentData.getFromIntent(it)?.let { paymentData ->
                        handlePaymentSuccess(paymentData)
                    }
                } ?: handlePaymentError("No payment data received")
            }
            Activity.RESULT_CANCELED -> {
                Log.d(PaymentConstants.TAG_PAYMENT_HANDLER, "Payment cancelled by user")
                handlePaymentError("Payment cancelled by user")
            }
            AutoResolveHelper.RESULT_ERROR -> {
                val status = data?.let { AutoResolveHelper.getStatusFromIntent(it) }
                val message = status?.statusMessage ?: "Unknown error"
                Log.e(PaymentConstants.TAG_PAYMENT_HANDLER, "Payment error: $message")
                handlePaymentError("Payment error: $message")
            }
            else -> {
                handlePaymentError("Payment failed with result code: $resultCode")
            }
        }
    }
    
    override fun onNewIntent(intent: Intent) {
        // Not used for Google Pay
    }
    
    // MARK: - Private helpers
    
    private fun createPaymentsClient(environment: Int): PaymentsClient {
        val walletOptions = Wallet.WalletOptions.Builder()
            .setEnvironment(environment)
            .build()
        return Wallet.getPaymentsClient(reactContext, walletOptions)
    }
    
    private fun determineEnvironment(envConfig: GooglePayEnvironment?): Int {
        return when (envConfig) {
            GooglePayEnvironment.PRODUCTION -> WalletConstants.ENVIRONMENT_PRODUCTION
            GooglePayEnvironment.TEST, null -> WalletConstants.ENVIRONMENT_TEST
        }
    }
    
    private fun launchPaymentUI(
        paymentDataRequest: org.json.JSONObject,
        activity: Activity,
        environment: Int
    ) {
        val request = PaymentDataRequest.fromJson(paymentDataRequest.toString())
        val client = createPaymentsClient(environment)
        
        AutoResolveHelper.resolveTask(
            client.loadPaymentData(request),
            activity,
            PaymentConstants.LOAD_PAYMENT_DATA_REQUEST_CODE
        )
        
        Log.d(PaymentConstants.TAG_PAYMENT_HANDLER, "Payment UI launched")
    }
    
    private fun handlePaymentSuccess(paymentData: PaymentData) {
        Log.d(PaymentConstants.TAG_PAYMENT_HANDLER, "Payment successful")
        val result = PaymentMapper.mapPaymentDataToResult(paymentData)
        paymentPromise?.resolve(result)
        paymentPromise = null
    }
    
    private fun handlePaymentError(errorMessage: String) {
        val result = PaymentMapper.createErrorResult(errorMessage)
        paymentPromise?.resolve(result)
        paymentPromise = null
    }
    
    private fun logPaymentRequest(request: org.json.JSONObject, environment: Int) {
        Log.d(PaymentConstants.TAG_PAYMENT_HANDLER, "Payment request: $request")
        Log.d(
            PaymentConstants.TAG_PAYMENT_HANDLER,
            "Environment: ${if (environment == WalletConstants.ENVIRONMENT_TEST) "TEST" else "PRODUCTION"}"
        )
    }
}
