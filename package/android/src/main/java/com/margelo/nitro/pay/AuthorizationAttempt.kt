package com.margelo.nitro.pay

/**
 * One `onAuthorize` call. Settles once, with the merchant's outcome, its
 * failure or the timeout, whichever comes first. Without this, a late outcome
 * after the timeout would settle the next payment that claimed the slot.
 * Main thread only.
 */
internal class AuthorizationAttempt(
    private val authorizedResult: PaymentResult,
    private val onSettled: (PaymentResult) -> Unit
) {
    private var isSettled = false

    fun authorized(authorization: PaymentAuthorizationResult) {
        settle(PaymentMapper.applyAuthorization(authorization, authorizedResult))
    }

    fun failed(error: Throwable) {
        settle(
            PaymentMapper.createErrorResult(
                PaymentErrorCode.PROVIDER_ERROR,
                error.message ?: PaymentConstants.ERROR_AUTHORIZATION_FAILED
            )
        )
    }

    fun timedOut() {
        settle(
            PaymentMapper.createErrorResult(
                PaymentErrorCode.PROVIDER_ERROR,
                PaymentConstants.ERROR_AUTHORIZATION_TIMED_OUT
            )
        )
    }

    private fun settle(result: PaymentResult) {
        if (isSettled) return
        isSettled = true
        onSettled(result)
    }
}
