package com.margelo.nitro.pay

import org.json.JSONObject

/**
 * `onAuthorize` inside the Google Pay sheet, through Google's
 * `PAYMENT_AUTHORIZATION` callback: the sheet waits for the merchant and shows
 * the outcome, and after a failure the payer can retry from the same sheet.
 *
 * Settles the payment once the sheet has closed and no attempt is running,
 * with the last attempt's outcome: as iOS does, a sheet closed after a decline
 * reports the decline, not a cancel. A sheet that returned a payment without
 * ever calling back (Google Pay ignored `callbackIntents`) goes to
 * [authorizeAfterSheet], which runs `onAuthorize` after the sheet as before.
 *
 * Apart from the React context, so the JVM tests can check it. Main thread only.
 *
 * @param authorize runs one `onAuthorize` attempt for a payment's token and
 *   calls back once with its outcome and the message the sheet shows if it
 *   failed.
 */
internal class SheetAuthorization(
    private val authorize: (PaymentToken, PaymentResult, (PaymentResult, String) -> Unit) -> Unit,
    private val settle: (PaymentResult) -> Unit,
    private val authorizeAfterSheet: (PaymentResult) -> Unit
) {
    private var lastOutcome: PaymentResult? = null
    private var isAuthorizing = false
    // The sheet's result when it closed while an attempt was running.
    private var closedWith: PaymentResult? = null
    private var isFinished = false

    /**
     * Google Pay asks whether to accept [authorizedResult], the payment the
     * payer just authorized. [answer] tells the sheet, exactly once.
     */
    fun paymentAuthorized(authorizedResult: PaymentResult, answer: (PaymentResult, String) -> Unit) {
        if (isFinished || isAuthorizing) {
            // Google Pay waits for each answer, so this shouldn't happen.
            answer(
                PaymentMapper.createErrorResult(
                    PaymentErrorCode.PROVIDER_ERROR,
                    PaymentConstants.ERROR_AUTHORIZATION_FAILED
                ),
                PaymentConstants.ERROR_AUTHORIZATION_FAILED
            )
            return
        }
        val token = authorizedResult.token
        if (!authorizedResult.success || token == null) {
            // Payment data the library can't read: nothing to charge.
            lastOutcome = authorizedResult
            answer(authorizedResult, PaymentConstants.ERROR_AUTHORIZATION_FAILED)
            return
        }
        isAuthorizing = true
        authorize(token, authorizedResult) { outcome, payerMessage ->
            isAuthorizing = false
            // Recorded before the sheet hears it: its result can follow at once.
            lastOutcome = outcome
            answer(outcome, payerMessage)
            closedWith?.let {
                closedWith = null
                finish(it)
            }
        }
    }

    /** The sheet closed with [sheetResult]: a payment, a cancel or an error. */
    fun sheetClosed(sheetResult: PaymentResult) {
        if (isAuthorizing) {
            closedWith = sheetResult
            return
        }
        finish(sheetResult)
    }

    private fun finish(sheetResult: PaymentResult) {
        if (isFinished) return
        isFinished = true
        val outcome = lastOutcome
        when {
            outcome != null -> settle(outcome)
            sheetResult.success -> authorizeAfterSheet(sheetResult)
            else -> settle(sheetResult)
        }
    }

    companion object {
        /**
         * Google's `PaymentAuthorizationResult` JSON for [outcome]. On a
         * failure the sheet shows [payerMessage] in a dialog and lets the
         * payer retry.
         */
        fun googleResultJson(outcome: PaymentResult, payerMessage: String): String {
            if (outcome.success) {
                return JSONObject().put("transactionState", "SUCCESS").toString()
            }
            return failureJson(payerMessage)
        }

        /** A failure for the sheet, which shows [payerMessage]. */
        fun failureJson(payerMessage: String = PaymentConstants.ERROR_AUTHORIZATION_FAILED): String {
            return JSONObject()
                .put("transactionState", "ERROR")
                .put("error", JSONObject().apply {
                    put("reason", "OTHER_ERROR")
                    put("message", payerMessage)
                    put("intent", PaymentConstants.CALLBACK_INTENT_PAYMENT_AUTHORIZATION)
                })
                .toString()
        }
    }
}
