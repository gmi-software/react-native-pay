package com.margelo.nitro.pay

import android.app.Activity
import android.content.Intent
import android.content.IntentSender
import android.os.Handler
import android.os.Looper
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.ReactApplicationContext
import com.google.android.gms.common.api.ApiException
import com.google.android.gms.common.api.ResolvableApiException
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
class HybridPaymentHandler : HybridPaymentHandlerSpec() {
    
    private val reactContext: ReactApplicationContext by lazy {
        NitroModules.applicationContext as? ReactApplicationContext
            ?: throw IllegalStateException("Application context is not ReactApplicationContext")
    }
    
    private val pendingPayment = PendingPayment<PaymentResult>()
    // Written on the JS thread, read on the main thread
    @Volatile private var onAuthorize: AuthorizeCallback? = null
    private val mainHandler = Handler(Looper.getMainLooper())
    private var currentEnvironment: Int = WalletConstants.ENVIRONMENT_TEST
    
    /**
     * Receives the Google Pay sheet's result. Registered on the React context
     * only while the sheet is open, so the context never keeps this handler
     * alive, and never sees request code 991 from this library, otherwise.
     */
    private val sheetResultListener = object : ActivityEventListener {
        override fun onActivityResult(
            activity: Activity,
            requestCode: Int,
            resultCode: Int,
            data: Intent?
        ) {
            if (requestCode != PaymentConstants.LOAD_PAYMENT_DATA_REQUEST_CODE) return
            stopListeningForSheetResult()
            handleSheetResult(resultCode, data)
        }
        
        override fun onNewIntent(intent: Intent) {
            // Not used for Google Pay
        }
    }
    
    override val memorySize: Long get() = 0L
    
    override fun dispose() {
        // JS calls this only explicitly; a reload drops the handler without it.
        stopListeningForSheetResult()
        super.dispose()
    }
    
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
            PayLog.e(PaymentConstants.TAG_PAYMENT_HANDLER, "Error checking status", e)
            PayServiceStatus(canMakePayments = false, canSetupCards = false)
        }
    }
    
    override fun canMakePayments(usingNetworks: Array<String>): Boolean {
        return usingNetworks.any { network ->
            PaymentConstants.SUPPORTED_NETWORKS.contains(network.lowercase())
        }
    }
    
    override fun startPayment(
        request: PaymentRequest,
        options: StartPaymentOptions?
    ): Promise<PaymentResult> {
        val promise = Promise<PaymentResult>()
        
        // Reject overlaps without touching the in-flight payment, so its
        // promise still settles and no second Google Pay sheet is requested.
        if (!pendingPayment.tryBegin { result -> promise.resolve(result) }) {
            PayLog.w(PaymentConstants.TAG_PAYMENT_HANDLER, PaymentConstants.ERROR_PAYMENT_IN_PROGRESS)
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
            
            if (reactContext.currentActivity == null) {
                handlePaymentError(PaymentConstants.ERROR_NO_ACTIVITY)
                return promise
            }
            
            loadPaymentData(paymentDataRequest, environment)
            
        } catch (e: Exception) {
            PayLog.e(PaymentConstants.TAG_PAYMENT_HANDLER, "Failed to start payment", e)
            handlePaymentError("Failed to start payment: ${e.message}")
        }
        
        return promise
    }
    
    // MARK: - Google Pay sheet
    
    /**
     * Requests the payment data and shows the Google Pay sheet when the
     * request needs the user, which is the usual case. The sheet's result
     * arrives in [sheetResultListener].
     *
     * This does what the deprecated `AutoResolveHelper.resolveTask` did. The
     * result goes through the React context instead of an Activity Result
     * launcher, because a launcher registered from a library is tied to one
     * Activity instance and loses the result if the Activity is recreated
     * while the sheet is open.
     *
     * If the app process dies while the sheet is open, the result is dropped:
     * the new JS runtime has no pending payment, so no token reaches the app
     * and nothing is charged.
     */
    private fun loadPaymentData(paymentDataRequest: org.json.JSONObject, environment: Int) {
        val request = PaymentDataRequest.fromJson(paymentDataRequest.toString())
        // Completion listeners run on the main thread.
        createPaymentsClient(environment).loadPaymentData(request).addOnCompleteListener { task ->
            if (task.isSuccessful) {
                handlePaymentSuccess(task.result)
                return@addOnCompleteListener
            }
            when (val error = task.exception) {
                is ResolvableApiException -> showPaymentSheet(error)
                is ApiException -> handlePaymentError(
                    "Payment error: ${error.status.statusMessage ?: "Unknown error"}"
                )
                else -> handlePaymentError("Payment error: ${error?.message ?: "Unknown error"}")
            }
        }
    }
    
    private fun showPaymentSheet(sheet: ResolvableApiException) {
        val activity = reactContext.currentActivity
        if (activity == null) {
            handlePaymentError(PaymentConstants.ERROR_NO_ACTIVITY)
            return
        }
        
        reactContext.addActivityEventListener(sheetResultListener)
        try {
            sheet.startResolutionForResult(activity, PaymentConstants.LOAD_PAYMENT_DATA_REQUEST_CODE)
            PayLog.d(PaymentConstants.TAG_PAYMENT_HANDLER, "Payment UI launched")
        } catch (e: IntentSender.SendIntentException) {
            stopListeningForSheetResult()
            PayLog.e(PaymentConstants.TAG_PAYMENT_HANDLER, "Failed to show payment UI", e)
            handlePaymentError("Failed to show payment UI: ${e.message}")
        }
    }
    
    private fun stopListeningForSheetResult() {
        reactContext.removeActivityEventListener(sheetResultListener)
    }
    
    private fun handleSheetResult(resultCode: Int, data: Intent?) {
        when (resultCode) {
            Activity.RESULT_OK -> {
                data?.let { 
                    PaymentData.getFromIntent(it)?.let { paymentData ->
                        handlePaymentSuccess(paymentData)
                    }
                } ?: handlePaymentError("No payment data received")
            }
            Activity.RESULT_CANCELED -> {
                PayLog.d(PaymentConstants.TAG_PAYMENT_HANDLER, "Payment cancelled by user")
                handlePaymentError("Payment cancelled by user")
            }
            AutoResolveHelper.RESULT_ERROR -> {
                val status = data?.let { AutoResolveHelper.getStatusFromIntent(it) }
                val message = status?.statusMessage ?: "Unknown error"
                PayLog.e(PaymentConstants.TAG_PAYMENT_HANDLER, "Payment error: $message")
                handlePaymentError("Payment error: $message")
            }
            else -> {
                handlePaymentError("Payment failed with result code: $resultCode")
            }
        }
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
            PayLog.w(PaymentConstants.TAG_PAYMENT_HANDLER, "Unable to read app label", e)
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
    
    private fun handlePaymentSuccess(paymentData: PaymentData) {
        PayLog.d(PaymentConstants.TAG_PAYMENT_HANDLER, "Payment successful")
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
            PayLog.e(PaymentConstants.TAG_PAYMENT_HANDLER, "Failed to call onAuthorize", e)
            settleWithError(e)
        }
    }
    
    private fun logPaymentRequest(request: org.json.JSONObject, environment: Int) {
        // Holds merchant IDs, item labels and amounts: never build it in release.
        if (!BuildConfig.DEBUG) return
        PayLog.d(PaymentConstants.TAG_PAYMENT_HANDLER, "Payment request: $request")
        PayLog.d(
            PaymentConstants.TAG_PAYMENT_HANDLER,
            "Environment: ${if (environment == WalletConstants.ENVIRONMENT_TEST) "TEST" else "PRODUCTION"}"
        )
    }
}
