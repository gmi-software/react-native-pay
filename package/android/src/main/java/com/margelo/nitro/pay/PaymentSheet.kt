package com.margelo.nitro.pay

import android.app.Activity
import com.google.android.gms.common.api.CommonStatusCodes
import com.google.android.gms.wallet.PaymentData
import com.google.android.gms.wallet.contract.ApiTaskResult

/**
 * The Google Pay sheet's decisions, apart from the React context and the
 * Activity result, so the JVM tests can check them. Logs nothing: `Log` is
 * a stub there.
 */
internal object PaymentSheet {

    /**
     * Listens for the sheet's result, then shows the sheet in [activity].
     * Returns why it could not, or `null` once the sheet is showing.
     */
    fun show(
        activity: Activity?,
        listenForResult: () -> Unit,
        stopListening: () -> Unit,
        start: (Activity) -> Unit
    ): PaymentResult? {
        if (activity == null) {
            return PaymentMapper.createErrorResult(
                PaymentErrorCode.NOT_AVAILABLE,
                PaymentConstants.ERROR_NO_ACTIVITY
            )
        }

        listenForResult()
        return try {
            start(activity)
            null
        } catch (e: Exception) {
            stopListening()
            PaymentMapper.createErrorResult(
                PaymentErrorCode.NOT_AVAILABLE,
                "Failed to show payment UI: ${e.message}"
            )
        }
    }

    /**
     * The payment for what the sheet returned, as Google's Activity Result
     * contract reads it: the payment data, a cancel, or an error status.
     */
    fun result(sheetResult: ApiTaskResult<PaymentData>, requested: RequestedDetails): PaymentResult {
        sheetResult.result?.let { return PaymentMapper.mapPaymentDataToResult(it, requested) }

        val status = sheetResult.status
        if (status.statusCode == CommonStatusCodes.CANCELED) {
            // Also returned when the user dismisses Google's sign-in prompt.
            return PaymentMapper.createErrorResult(
                PaymentErrorCode.CANCELLED,
                PaymentConstants.ERROR_PAYMENT_CANCELLED
            )
        }
        return PaymentMapper.walletErrorResult(status.statusCode, status.statusMessage)
    }
}
