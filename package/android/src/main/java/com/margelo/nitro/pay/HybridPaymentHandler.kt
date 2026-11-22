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
import com.google.android.gms.wallet.IsReadyToPayRequest
import com.google.android.gms.wallet.PaymentData
import com.google.android.gms.wallet.PaymentDataRequest
import com.google.android.gms.wallet.PaymentsClient
import com.google.android.gms.wallet.Wallet
import com.google.android.gms.wallet.WalletConstants
import com.google.android.gms.wallet.contract.TaskResultContracts
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
    // Set with onAuthorize, for the in-sheet authorization; main thread after startPayment.
    @Volatile private var sheetAuthorization: SheetAuthorization? = null
    private val sheetAuthorizer = PaymentDataCallbacks.Authorizer(::authorizeInSheet)
    private val jsTimersKeepAlive = JsTimersKeepAlive { reactContext }
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
        val environment = determineEnvironment(options?.googlePayEnvironment)
        // Rejects what the payment would refuse, with the same error.
        val cardParameters = try {
            GooglePayCardParameters.from(
                options?.supportedNetworks,
                options?.googlePayAllowedAuthMethods,
                options?.merchantCapabilities
            )
        } catch (e: IllegalArgumentException) {
            return Promise.rejected(e)
        }
        // Both requests run at once; neither blocks the calling (JS) thread.
        val isSupported = isReadyToPay(
            environment,
            GooglePayCardParameters.DEFAULT,
            existingPaymentMethodRequired = false
        )
        val hasActiveCard = isReadyToPay(environment, cardParameters, existingPaymentMethodRequired = true)
        
        val promise = Promise<PayServiceStatus>()
        Tasks.whenAll(isSupported, hasActiveCard).addOnCompleteListener {
            promise.resolve(
                PayServiceStatus(isSupported = isSupported.result, hasActiveCard = hasActiveCard.result)
            )
        }
        return promise
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
            promise.resolve(
                PaymentMapper.createErrorResult(
                    PaymentErrorCode.IN_PROGRESS,
                    PaymentConstants.ERROR_PAYMENT_IN_PROGRESS
                )
            )
            return promise
        }
        val authorize = options?.onAuthorize
        onAuthorize = authorize
        requestedDetails = RequestedDetails.from(request)
        if (authorize != null) {
            sheetAuthorization = SheetAuthorization(
                authorize = { token, authorizedResult, onOutcome ->
                    // The sheet pauses the app's activity, which stops JS timers.
                    jsTimersKeepAlive.start()
                    runAuthorization(authorize, token, authorizedResult) { outcome, payerMessage ->
                        jsTimersKeepAlive.stop()
                        onOutcome(outcome, payerMessage)
                    }
                },
                settle = ::settlePayment,
                authorizeAfterSheet = ::handlePaymentSuccess
            )
            PaymentDataCallbacks.register(sheetAuthorizer)
        }
        
        try {
            val environment = determineEnvironment(request.googlePayEnvironment)
            
            val paymentDataRequest = try {
                GooglePayRequestBuilder.createPaymentDataRequest(
                    request,
                    environment,
                    fallbackMerchantName = appLabel(),
                    authorizeInSheet = authorize != null
                )
            } catch (e: IllegalArgumentException) {
                // The builder's validation: only this call reports a configuration error.
                PayLog.e(PaymentConstants.TAG_PAYMENT_HANDLER, "Invalid payment request", e)
                handlePaymentError(PaymentErrorCode.CONFIGURATION, "Failed to start payment: ${e.message}")
                return promise
            }
            
            logPaymentRequest(paymentDataRequest, environment)
            
            loadPaymentData(paymentDataRequest, environment)
            
        } catch (e: Exception) {
            PayLog.e(PaymentConstants.TAG_PAYMENT_HANDLER, "Failed to start payment", e)
            handlePaymentError(PaymentErrorCode.UNKNOWN, "Failed to start payment: ${e.message}")
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
                sheetFinished(PaymentMapper.mapPaymentDataToResult(task.result, requestedDetails))
                return@addOnCompleteListener
            }
            when (val error = task.exception) {
                is ResolvableApiException -> showPaymentSheet(error)
                is ApiException -> handleWalletError(error.status)
                else -> sheetFinished(
                    PaymentMapper.createErrorResult(
                        PaymentErrorCode.UNKNOWN,
                        "Payment error: ${error?.message ?: "Unknown error"}"
                    )
                )
            }
        }
    }
    
    private fun showPaymentSheet(sheet: ResolvableApiException) {
        val failure = PaymentSheet.show(
            reactContext.currentActivity,
            listenForResult = { reactContext.addActivityEventListener(sheetResultListener) },
            stopListening = ::stopListeningForSheetResult,
            start = { sheet.startResolutionForResult(it, PaymentConstants.LOAD_PAYMENT_DATA_REQUEST_CODE) }
        )
        if (failure == null) {
            PayLog.d(PaymentConstants.TAG_PAYMENT_HANDLER, "Payment UI launched")
            return
        }
        // Outside startPayment's try, so settle here instead of crashing.
        PayLog.e(PaymentConstants.TAG_PAYMENT_HANDLER, failure.error ?: "Failed to show payment UI")
        settlePayment(failure)
    }
    
    private fun stopListeningForSheetResult() {
        reactContext.removeActivityEventListener(sheetResultListener)
    }
    
    private fun handleSheetResult(resultCode: Int, data: Intent?) {
        // Reads the result as Google's Activity Result contract does: the payment
        // data, a cancel, or the error status Google Pay put in the intent.
        val result = PaymentSheet.result(
            TaskResultContracts.GetPaymentDataResult().parseResult(resultCode, data),
            requestedDetails
        )
        if (result.code == PaymentErrorCode.CANCELLED) {
            PayLog.d(PaymentConstants.TAG_PAYMENT_HANDLER, PaymentConstants.ERROR_PAYMENT_CANCELLED)
        } else if (!result.success) {
            PayLog.e(PaymentConstants.TAG_PAYMENT_HANDLER, result.error ?: "Payment error")
        }
        sheetFinished(result)
    }
    
    /**
     * What the sheet returned. With onAuthorize, [SheetAuthorization] decides
     * once any running attempt has settled.
     */
    private fun sheetFinished(result: PaymentResult) {
        val sheet = sheetAuthorization
        when {
            sheet != null -> sheet.sheetClosed(result)
            result.success -> handlePaymentSuccess(result)
            else -> settlePayment(result)
        }
    }
    
    /**
     * Google Pay's `PAYMENT_AUTHORIZATION` callback, from
     * [PaymentDataCallbacksService] on a worker thread.
     */
    private fun authorizeInSheet(paymentData: PaymentData?, answer: (String) -> Unit) {
        mainHandler.post {
            val sheet = sheetAuthorization
            if (sheet == null) {
                // The payment has already settled.
                answer(SheetAuthorization.failureJson())
                return@post
            }
            PayLog.d(PaymentConstants.TAG_PAYMENT_HANDLER, "Authorizing in the Google Pay sheet")
            val authorizedResult = paymentData?.let { PaymentMapper.mapPaymentDataToResult(it, requestedDetails) }
                ?: PaymentMapper.createErrorResult(PaymentErrorCode.PROVIDER_ERROR, "Payment data is missing")
            sheet.paymentAuthorized(authorizedResult) { outcome, payerMessage ->
                answer(SheetAuthorization.googleResultJson(outcome, payerMessage))
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
     * the main thread and never fails: an error, or no answer within the
     * timeout, counts as not ready.
     */
    private fun isReadyToPay(
        environment: Int,
        cardParameters: GooglePayCardParameters,
        existingPaymentMethodRequired: Boolean
    ): Task<Boolean> {
        val answer: Task<Boolean> = try {
            val requestJson = GooglePayRequestBuilder.createIsReadyToPayRequest(
                cardParameters = cardParameters,
                existingPaymentMethodRequired = existingPaymentMethodRequired
            )
            Tasks.withTimeout(
                createPaymentsClient(environment).isReadyToPay(
                    IsReadyToPayRequest.fromJson(requestJson.toString())
                ),
                PaymentConstants.READY_TO_PAY_TIMEOUT_SECONDS,
                TimeUnit.SECONDS
            )
        } catch (e: Exception) {
            Tasks.forException(e)
        }
        return answer.continueWith { task ->
            if (!task.isSuccessful) {
                PayLog.w(PaymentConstants.TAG_PAYMENT_HANDLER, "isReadyToPay failed", task.exception)
            }
            task.isSuccessful && task.result == true
        }
    }
    
    private fun handlePaymentSuccess(result: PaymentResult) {
        PayLog.d(PaymentConstants.TAG_PAYMENT_HANDLER, "Payment successful")
        val authorize = onAuthorize
        val token = result.token
        if (authorize == null || token == null) {
            settlePayment(result)
            return
        }
        onAuthorize = null
        authorizePayment(authorize, token, result)
    }
    
    private fun handlePaymentError(code: PaymentErrorCode, errorMessage: String) {
        settlePayment(PaymentMapper.createErrorResult(code, errorMessage))
    }
    
    private fun handleWalletError(status: Status?) {
        PayLog.e(PaymentConstants.TAG_PAYMENT_HANDLER, "Payment error ${status?.statusCode}: ${status?.statusMessage}")
        sheetFinished(PaymentMapper.walletErrorResult(status?.statusCode, status?.statusMessage))
    }
    
    private fun settlePayment(result: PaymentResult) {
        // Clear before settling: once the slot is free, a new startPayment may set its own.
        onAuthorize = null
        sheetAuthorization = null
        PaymentDataCallbacks.unregister(sheetAuthorizer)
        jsTimersKeepAlive.stop()
        pendingPayment.settle(result)
    }
    
    /**
     * Lets the merchant decide the result after the sheet has closed, when
     * Google Pay returned a payment without its `PAYMENT_AUTHORIZATION`
     * callback. There is no UI to update. Runs on the main thread. The
     * payment keeps its slot until the outcome settles, so overlapping calls
     * are rejected meanwhile.
     */
    private fun authorizePayment(
        authorize: AuthorizeCallback,
        token: PaymentToken,
        authorizedResult: PaymentResult
    ) {
        runAuthorization(authorize, token, authorizedResult) { result, _ -> settlePayment(result) }
    }
    
    /**
     * Runs one onAuthorize attempt, which settles once: with the merchant's
     * outcome, its failure, or the timeout, which Google Pay's own 30-second
     * limit allows. Main thread.
     */
    private fun runAuthorization(
        authorize: AuthorizeCallback,
        token: PaymentToken,
        authorizedResult: PaymentResult,
        onSettled: (PaymentResult, String) -> Unit
    ) {
        lateinit var timeout: Runnable
        val attempt = AuthorizationAttempt(authorizedResult) { result, payerMessage ->
            // Otherwise the queued timeout keeps this attempt for its full delay.
            mainHandler.removeCallbacks(timeout)
            onSettled(result, payerMessage)
        }
        // Nitro settles JS promises on the JS thread.
        val failOnMain = { error: Throwable -> mainHandler.post { attempt.failed(error) } }
        
        timeout = Runnable { attempt.timedOut() }
        mainHandler.postDelayed(timeout, PaymentConstants.AUTHORIZATION_TIMEOUT_MS)
        
        try {
            authorize(token, PaymentMapper.paymentDetails(authorizedResult))
                .then { authorization ->
                    authorization
                        .then { mainHandler.post { attempt.authorized(it) } }
                        .catch { failOnMain(it) }
                }
                .catch { failOnMain(it) }
        } catch (e: Throwable) {
            // Thrown when the JS runtime is gone.
            PayLog.e(PaymentConstants.TAG_PAYMENT_HANDLER, "Failed to call onAuthorize", e)
            failOnMain(e)
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
