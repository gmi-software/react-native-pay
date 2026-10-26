package com.margelo.nitro.pay

import android.app.Activity
import android.content.Intent
import android.os.Handler
import android.os.Looper
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.ReactApplicationContext
import com.google.android.gms.common.api.ApiException
import com.google.android.gms.common.api.ResolvableApiException
import com.google.android.gms.common.api.Status
import com.google.android.gms.tasks.Task
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

private typealias AuthorizeCallback = (PaymentToken, PaymentDetails) -> Promise<Promise<PaymentAuthorizationResult>>

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
    @Volatile private var requestedDetails = RequestedDetails()
    private val mainHandler = Handler(Looper.getMainLooper())
    
    // Registered only while the sheet is open, so the React context doesn't
    // keep this handler alive.
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
    
    // MARK: - Public API
    
    override fun payServiceStatus(options: PayServiceStatusOptions?): Promise<PayServiceStatus> {
        return try {
            val client = createPaymentsClient(determineEnvironment(options?.googlePayEnvironment))
            val cardNetworks = options?.supportedNetworks
                ?.let { GooglePayRequestBuilder.googleCardNetworks(it) }
                ?: PaymentConstants.DEFAULT_CARD_NETWORKS
            // Both requests run at once; neither blocks the calling (JS) thread.
            val isSupported = isReadyToPay(
                client,
                PaymentConstants.DEFAULT_CARD_NETWORKS,
                existingPaymentMethodRequired = false
            )
            val hasActiveCard = isReadyToPay(client, cardNetworks, existingPaymentMethodRequired = true)
            
            val promise = Promise<PayServiceStatus>()
            Tasks.whenAllComplete(isSupported, hasActiveCard).addOnCompleteListener {
                promise.resolve(
                    PayServiceStatus(
                        isSupported = isSupported.resultOrFalse(),
                        hasActiveCard = hasActiveCard.resultOrFalse()
                    )
                )
            }
            promise
        } catch (e: Exception) {
            PayLog.e(PaymentConstants.TAG_PAYMENT_HANDLER, "Error checking status", e)
            Promise.resolved(PayServiceStatus(isSupported = false, hasActiveCard = false))
        }
    }
    
    override fun canMakePayments(
        usingNetworks: Array<String>,
        options: CanMakePaymentsOptions?
    ): Promise<Boolean> {
        return try {
            val client = createPaymentsClient(determineEnvironment(options?.googlePayEnvironment))
            val hasActiveCard = isReadyToPay(
                client,
                GooglePayRequestBuilder.googleCardNetworks(usingNetworks),
                existingPaymentMethodRequired = true
            )
            
            val promise = Promise<Boolean>()
            hasActiveCard.addOnCompleteListener { promise.resolve(it.resultOrFalse()) }
            promise
        } catch (e: Exception) {
            PayLog.e(PaymentConstants.TAG_PAYMENT_HANDLER, "Error checking networks", e)
            Promise.resolved(false)
        }
    }
    
    override fun isPaymentInProgress(): Boolean {
        return pendingPayment.isInProgress
    }
    
    override fun openPaymentSetup() {
        // Google Pay has no setup screen to open: its sheet lets the user add a card.
        PayLog.d(PaymentConstants.TAG_PAYMENT_HANDLER, "openPaymentSetup does nothing on Android")
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
        requestedDetails = RequestedDetails.from(request)
        
        try {
            val environment = determineEnvironment(request.googlePayEnvironment)
            
            val paymentDataRequest = GooglePayRequestBuilder.createPaymentDataRequest(
                request,
                environment,
                fallbackMerchantName = appLabel()
            )
            
            logPaymentRequest(paymentDataRequest, environment)
            
            loadPaymentData(paymentDataRequest, environment)
            
        } catch (e: Exception) {
            PayLog.e(PaymentConstants.TAG_PAYMENT_HANDLER, "Failed to start payment", e)
            handlePaymentError("Failed to start payment: ${e.message}")
        }
        
        return promise
    }
    
    // MARK: - Google Pay sheet
    
    /**
     * Shows the Google Pay sheet; its result arrives in [sheetResultListener].
     * Not an Activity Result launcher: one registered from a library belongs
     * to a single Activity instance and loses the result if that Activity is
     * recreated while the sheet is open.
     *
     * If the process dies while the sheet is open, the result is dropped, so
     * no token reaches the app and nothing is charged.
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
                is ApiException -> handleWalletError(error.status)
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
        } catch (e: Exception) {
            // Outside startPayment's try, so settle here instead of crashing.
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
                handleWalletError(data?.let { AutoResolveHelper.getStatusFromIntent(it) })
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

    /**
     * Asks Google Pay without waiting for the answer. The task completes on
     * the main thread, with a `TimeoutException` if Google Pay does not answer.
     */
    private fun isReadyToPay(
        client: PaymentsClient,
        cardNetworks: List<String>,
        existingPaymentMethodRequired: Boolean
    ): Task<Boolean> {
        // No network Google Pay knows: no card can be on it.
        if (cardNetworks.isEmpty()) return Tasks.forResult(false)
        
        val requestJson = GooglePayRequestBuilder.createIsReadyToPayRequest(
            cardNetworks = cardNetworks,
            existingPaymentMethodRequired = existingPaymentMethodRequired
        )
        val request = IsReadyToPayRequest.fromJson(requestJson.toString())
        return Tasks.withTimeout(
            client.isReadyToPay(request),
            PaymentConstants.READY_TO_PAY_TIMEOUT_SECONDS,
            TimeUnit.SECONDS
        )
    }
    
    /** A failed or timed-out check counts as not ready. */
    private fun Task<Boolean>.resultOrFalse(): Boolean {
        if (isSuccessful) return result == true
        PayLog.w(PaymentConstants.TAG_PAYMENT_HANDLER, "isReadyToPay failed", exception)
        return false
    }
    
    private fun handlePaymentSuccess(paymentData: PaymentData) {
        PayLog.d(PaymentConstants.TAG_PAYMENT_HANDLER, "Payment successful")
        val result = PaymentMapper.mapPaymentDataToResult(paymentData, requestedDetails)
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
    
    private fun handleWalletError(status: Status?) {
        val message = status?.statusMessage ?: "Unknown error"
        PayLog.e(PaymentConstants.TAG_PAYMENT_HANDLER, "Payment error: $message")
        handlePaymentError("Payment error: $message")
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
            authorize(token, PaymentMapper.paymentDetails(authorizedResult))
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
