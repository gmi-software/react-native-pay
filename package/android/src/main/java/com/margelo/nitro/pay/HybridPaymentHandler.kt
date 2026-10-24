package com.margelo.nitro.pay

import android.app.Activity
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.util.Log
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.ReactApplicationContext
import com.google.android.gms.tasks.Tasks
import com.google.android.gms.wallet.AutoResolveHelper
import com.google.android.gms.wallet.IsReadyToPayRequest
import com.google.android.gms.wallet.PaymentData
import com.google.android.gms.wallet.PaymentDataRequest
import com.google.android.gms.wallet.PaymentsClient
import com.google.android.gms.wallet.Wallet
import com.google.android.gms.wallet.WalletConstants
import com.margelo.nitro.core.Promise
import com.margelo.nitro.NitroModules
import java.util.concurrent.TimeUnit

private typealias AuthorizeCallback = (PaymentToken) -> Promise<Promise<PaymentAuthorizationResult>>

/**
 * Hybrid implementation of PaymentHandler for Google Pay on Android
 */
class HybridPaymentHandler : HybridPaymentHandlerSpec(), ActivityEventListener {
    
    private val reactContext: ReactApplicationContext by lazy {
        NitroModules.applicationContext as? ReactApplicationContext
            ?: throw IllegalStateException("Application context is not ReactApplicationContext")
    }
    
    private val pendingPayment = PendingPayment<PaymentResult>()
    // Written on the JS thread, read on the main thread
    @Volatile private var onAuthorize: AuthorizeCallback? = null
    private val mainHandler = Handler(Looper.getMainLooper())
    private var currentEnvironment: Int = WalletConstants.ENVIRONMENT_TEST
    
    init {
        reactContext.addActivityEventListener(this)
    }
    
    override val memorySize: Long get() = 0L
    
    // MARK: - Public API
    
    override fun payServiceStatus(): PayServiceStatus {
        return try {
            val client = createPaymentsClient(currentEnvironment)
            val canSetupCards = isReadyToPay(
                client = client,
                requestJson = GooglePayRequestBuilder.createIsReadyToPayRequest(
                    existingPaymentMethodRequired = false
                )
            )
            val canMakePayments = isReadyToPay(
                client = client,
                requestJson = GooglePayRequestBuilder.createIsReadyToPayRequest(
                    existingPaymentMethodRequired = true
                )
            )
            PayServiceStatus(
                canMakePayments = canMakePayments,
                canSetupCards = canSetupCards
            )
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
    
    override fun isPaymentInProgress(): Boolean {
        return pendingPayment.isInProgress
    }
    
    override fun startPayment(
        request: PaymentRequest,
        options: StartPaymentOptions?
    ): Promise<PaymentResult> {
        val promise = Promise<PaymentResult>()
        
        // Reject overlaps without touching the in-flight payment, so its
        // promise still settles and no second Google Pay sheet is requested.
        if (!pendingPayment.tryBegin { result -> promise.resolve(result) }) {
            Log.w(PaymentConstants.TAG_PAYMENT_HANDLER, PaymentConstants.ERROR_PAYMENT_IN_PROGRESS)
            promise.resolve(PaymentMapper.createErrorResult(PaymentConstants.ERROR_PAYMENT_IN_PROGRESS))
            return promise
        }
        onAuthorize = options?.onAuthorize
        
        try {
            val environment = determineEnvironment(request.googlePayEnvironment)
            currentEnvironment = environment
            
            val paymentDataRequest = GooglePayRequestBuilder.createPaymentDataRequest(
                request,
                environment,
                fallbackMerchantName = appLabel()
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
    
    private fun appLabel(): String? {
        return try {
            reactContext.applicationInfo.loadLabel(reactContext.packageManager).toString()
        } catch (e: Exception) {
            Log.w(PaymentConstants.TAG_PAYMENT_HANDLER, "Unable to read app label", e)
            null
        }
    }

    private fun determineEnvironment(envConfig: GooglePayEnvironment?): Int {
        return when (envConfig) {
            GooglePayEnvironment.PRODUCTION -> WalletConstants.ENVIRONMENT_PRODUCTION
            GooglePayEnvironment.TEST, null -> WalletConstants.ENVIRONMENT_TEST
        }
    }

    private fun isReadyToPay(
        client: PaymentsClient,
        requestJson: org.json.JSONObject
    ): Boolean {
        val request = IsReadyToPayRequest.fromJson(requestJson.toString())
        val task = client.isReadyToPay(request)
        return Tasks.await(task, 5, TimeUnit.SECONDS) ?: false
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
        val authorize = onAuthorize
        val token = result.token
        if (authorize == null || token == null) {
            settlePayment(result)
            return
        }
        onAuthorize = null
        authorizePayment(authorize, token, result)
    }
    
    private fun handlePaymentError(errorMessage: String) {
        val result = PaymentMapper.createErrorResult(errorMessage)
        settlePayment(result)
    }
    
    private fun settlePayment(result: PaymentResult) {
        // Clear before settling: once the slot is free, a new startPayment may set its own.
        onAuthorize = null
        pendingPayment.settle(result)
    }
    
    /**
     * Lets the merchant decide the result. Google Pay has already closed its
     * sheet, so unlike iOS there is no UI to update. Runs on the main thread.
     * The payment keeps its slot until the outcome settles, so overlapping
     * calls are rejected meanwhile.
     */
    private fun authorizePayment(
        authorize: AuthorizeCallback,
        token: PaymentToken,
        authorizedResult: PaymentResult
    ) {
        // Settles this attempt once. Without it, a late outcome after the timeout
        // would settle the next payment that claimed the slot.
        var isSettled = false
        val settle = { result: PaymentResult ->
            if (!isSettled) {
                isSettled = true
                pendingPayment.settle(result)
            }
        }
        // Nitro settles JS promises on the JS thread.
        val settleOnMain = { result: PaymentResult ->
            mainHandler.post { settle(result) }
        }
        val settleWithError = { error: Throwable ->
            settleOnMain(
                PaymentMapper.createErrorResult(
                    error.message ?: PaymentConstants.ERROR_AUTHORIZATION_FAILED
                )
            )
        }
        
        mainHandler.postDelayed({
            settle(PaymentMapper.createErrorResult(PaymentConstants.ERROR_AUTHORIZATION_TIMED_OUT))
        }, PaymentConstants.AUTHORIZATION_TIMEOUT_MS)
        
        try {
            authorize(token)
                .then { authorization ->
                    authorization
                        .then { settleOnMain(PaymentMapper.applyAuthorization(it, authorizedResult)) }
                        .catch { settleWithError(it) }
                }
                .catch { settleWithError(it) }
        } catch (e: Throwable) {
            // Thrown when the JS runtime is gone.
            Log.e(PaymentConstants.TAG_PAYMENT_HANDLER, "Failed to call onAuthorize", e)
            settleWithError(e)
        }
    }
    
    private fun logPaymentRequest(request: org.json.JSONObject, environment: Int) {
        Log.d(PaymentConstants.TAG_PAYMENT_HANDLER, "Payment request: $request")
        Log.d(
            PaymentConstants.TAG_PAYMENT_HANDLER,
            "Environment: ${if (environment == WalletConstants.ENVIRONMENT_TEST) "TEST" else "PRODUCTION"}"
        )
    }
}
