package com.margelo.nitro.pay

import com.google.android.gms.wallet.PaymentData
import com.google.android.gms.wallet.callback.BasePaymentDataCallbacks
import com.google.android.gms.wallet.callback.BasePaymentDataCallbacksService
import com.google.android.gms.wallet.callback.IntermediatePaymentData
import com.google.android.gms.wallet.callback.OnCompleteListener
import com.google.android.gms.wallet.callback.PaymentDataRequestUpdate
import java.util.concurrent.atomic.AtomicBoolean
import com.google.android.gms.wallet.callback.PaymentAuthorizationResult as GooglePaymentAuthorizationResult

/**
 * Answers Google Pay's payment data callbacks while its sheet is open:
 * `PAYMENT_AUTHORIZATION`, and the payer's changes of shipping address,
 * shipping option and card. Google Play services binds it, through the
 * declaration in the library's manifest, only for a request with
 * `callbackIntents`.
 */
class PaymentDataCallbacksService : BasePaymentDataCallbacksService() {
    override fun createPaymentDataCallbacks(): BasePaymentDataCallbacks = object : BasePaymentDataCallbacks() {
        // Runs on a worker thread of the service.
        override fun onPaymentAuthorized(
            paymentData: PaymentData?,
            onComplete: OnCompleteListener<GooglePaymentAuthorizationResult>
        ) {
            PaymentDataCallbacks.paymentAuthorized(paymentData) { json ->
                onComplete.complete(GooglePaymentAuthorizationResult.fromJson(json))
            }
        }

        // Runs on a worker thread of the service.
        override fun onPaymentDataChanged(
            intermediatePaymentData: IntermediatePaymentData?,
            onComplete: OnCompleteListener<PaymentDataRequestUpdate>
        ) {
            PaymentDataCallbacks.paymentDataChanged(intermediatePaymentData?.toJson()) { json ->
                onComplete.complete(PaymentDataRequestUpdate.fromJson(json))
            }
        }
    }
}

/**
 * Links [PaymentDataCallbacksService], which Android creates, to the payment
 * whose sheet is open. Process-wide: the sheet is too.
 */
internal object PaymentDataCallbacks {
    /** The open payment's answers to Google's callbacks. */
    interface Handler {
        /** Answers with Google's `PaymentAuthorizationResult` JSON. */
        fun authorize(paymentData: PaymentData?, answer: (String) -> Unit)

        /**
         * Answers with Google's `PaymentDataRequestUpdate` JSON for
         * [intermediatePaymentData], the `IntermediatePaymentData` JSON.
         */
        fun dataChanged(intermediatePaymentData: String, answer: (String) -> Unit)
    }

    /** An update that changes nothing in the sheet. */
    const val UNCHANGED_SHEET = "{}"

    @Volatile private var handler: Handler? = null

    fun register(handler: Handler) {
        synchronized(this) { this.handler = handler }
    }

    /** Clears [handler] if it is still the registered one. */
    fun unregister(handler: Handler) {
        synchronized(this) {
            if (this.handler === handler) this.handler = null
        }
    }

    /**
     * Hands the callback to the open payment, and answers it exactly once:
     * Google Pay shows an error after 30 seconds without an answer. With no
     * payment open, as in a process restarted while the sheet was up, the
     * answer is a failure, so nothing is charged without the merchant.
     */
    fun paymentAuthorized(paymentData: PaymentData?, complete: (String) -> Unit) {
        val answered = AtomicBoolean(false)
        val answer = { json: String ->
            if (answered.compareAndSet(false, true)) complete(json)
        }
        val current = handler
        if (current == null) {
            answer(SheetAuthorization.failureJson())
            return
        }
        try {
            current.authorize(paymentData, answer)
        } catch (e: Exception) {
            answer(SheetAuthorization.failureJson())
        }
    }

    /**
     * Hands the payer's change to the open payment, and answers it exactly
     * once. With no payment open, or no data, the sheet stays as it is.
     */
    fun paymentDataChanged(intermediatePaymentData: String?, complete: (String) -> Unit) {
        val answered = AtomicBoolean(false)
        val answer = { json: String ->
            if (answered.compareAndSet(false, true)) complete(json)
        }
        val current = handler
        if (current == null || intermediatePaymentData == null) {
            answer(UNCHANGED_SHEET)
            return
        }
        try {
            current.dataChanged(intermediatePaymentData, answer)
        } catch (e: Exception) {
            answer(UNCHANGED_SHEET)
        }
    }
}
