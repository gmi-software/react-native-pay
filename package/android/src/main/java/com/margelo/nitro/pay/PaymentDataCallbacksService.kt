package com.margelo.nitro.pay

import com.google.android.gms.wallet.PaymentData
import com.google.android.gms.wallet.callback.BasePaymentDataCallbacks
import com.google.android.gms.wallet.callback.BasePaymentDataCallbacksService
import com.google.android.gms.wallet.callback.OnCompleteListener
import java.util.concurrent.atomic.AtomicBoolean
import com.google.android.gms.wallet.callback.PaymentAuthorizationResult as GooglePaymentAuthorizationResult

/**
 * Answers Google Pay's `PAYMENT_AUTHORIZATION` callback while its sheet is
 * open. Google Play services binds it, through the declaration in the
 * library's manifest, only for a request with `callbackIntents`.
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
    }
}

/**
 * Links [PaymentDataCallbacksService], which Android creates, to the payment
 * whose sheet is open. Process-wide: the sheet is too.
 */
internal object PaymentDataCallbacks {
    /** Answers one callback with Google's `PaymentAuthorizationResult` JSON. */
    fun interface Authorizer {
        fun authorize(paymentData: PaymentData?, answer: (String) -> Unit)
    }

    @Volatile private var authorizer: Authorizer? = null

    fun register(authorizer: Authorizer) {
        synchronized(this) { this.authorizer = authorizer }
    }

    /** Clears [authorizer] if it is still the registered one. */
    fun unregister(authorizer: Authorizer) {
        synchronized(this) {
            if (this.authorizer === authorizer) this.authorizer = null
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
        val current = authorizer
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
}
