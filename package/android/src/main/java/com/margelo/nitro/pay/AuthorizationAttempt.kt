package com.margelo.nitro.pay

/**
 * One `onAuthorize` call. Settles once, with the merchant's outcome, its
 * failure or the timeout, whichever comes first. Without this, a late outcome
 * after the timeout would settle the next payment that claimed the slot.
 *
 * [onSettled] also gets the message the Google Pay sheet shows on a failure:
 * the merchant's `error`, but never a rejection's message, which may be raw
 * exception text. Main thread only.
 */
internal class AuthorizationAttempt(
    private val authorizedResult: PaymentResult,
    private val onSettled: (result: PaymentResult, payerMessage: String) -> Unit
) {
    private var isSettled = false

    fun authorized(authorization: PaymentAuthorizationResult) {
        settle(
            PaymentMapper.applyAuthorization(authorization, authorizedResult),
            authorization.error?.takeUnless { it.isBlank() } ?: PaymentConstants.ERROR_AUTHORIZATION_FAILED
        )
    }

    fun failed(error: Throwable) {
        settle(
            PaymentMapper.createErrorResult(
                PaymentErrorCode.PROVIDER_ERROR,
                error.message ?: PaymentConstants.ERROR_AUTHORIZATION_FAILED
            ),
            PaymentConstants.ERROR_AUTHORIZATION_FAILED
        )
    }

    fun timedOut() {
        settle(
            PaymentMapper.createErrorResult(
                PaymentErrorCode.PROVIDER_ERROR,
                PaymentConstants.ERROR_AUTHORIZATION_TIMED_OUT
            ),
            PaymentConstants.ERROR_AUTHORIZATION_TIMED_OUT
        )
    }

    private fun settle(result: PaymentResult, payerMessage: String) {
        if (isSettled) return
        isSettled = true
        onSettled(result, payerMessage)
    }
}
