package com.margelo.nitro.pay

import android.app.Activity
import com.google.android.gms.common.api.CommonStatusCodes
import com.google.android.gms.common.api.Status
import com.google.android.gms.wallet.PaymentData
import com.google.android.gms.wallet.WalletConstants
import com.google.android.gms.wallet.contract.ApiTaskResult
import com.google.android.gms.wallet.contract.TaskResultContracts
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PaymentSheetTest {

    private val paymentData = PaymentData.fromJson(
        """
        {
          "apiVersion": 2,
          "apiVersionMinor": 0,
          "email": "jane@example.com",
          "paymentMethodData": {
            "type": "CARD",
            "info": {"cardNetwork": "VISA", "cardDetails": "1111"},
            "tokenizationData": {"type": "PAYMENT_GATEWAY", "token": "gateway-token"}
          }
        }
        """
    )

    private val requested = RequestedDetails(email = true)

    // Google's own contract, run as the handler runs it. Without an intent,
    // and for any result code but RESULT_ERROR, it runs on the JVM.
    private fun sheetResult(resultCode: Int): PaymentResult =
        PaymentSheet.result(
            TaskResultContracts.GetPaymentDataResult().parseResult(resultCode, null),
            requested
        )

    private val internalError = PaymentMapper.walletErrorResult(CommonStatusCodes.INTERNAL_ERROR, null)

    // MARK: - Sheet result

    @Test
    fun okWithPaymentDataIsAPayment() {
        // What the contract returns when the intent holds payment data.
        val result = PaymentSheet.result(ApiTaskResult(paymentData, Status.RESULT_SUCCESS), requested)

        assertEquals(PaymentMapper.mapPaymentDataToResult(paymentData, requested), result)
        assertTrue(result.success)
        assertEquals("gateway-token", result.token?.paymentData)
        assertEquals("jane@example.com", result.emailAddress)
    }

    @Test
    fun okWithoutDataIsAnInternalError() {
        assertEquals(internalError, sheetResult(Activity.RESULT_OK))
    }

    @Test
    fun canceledIsACancel() {
        val result = sheetResult(Activity.RESULT_CANCELED)

        assertEquals(PaymentStatus.CANCELLED, result.status)
        assertEquals(PaymentErrorCode.CANCELLED, result.code)
        assertEquals(PaymentConstants.ERROR_PAYMENT_CANCELLED, result.error)
    }

    @Test
    fun errorWithAStatusReportsTheStatus() {
        // What the contract returns when the intent holds Google Pay's status.
        val status = Status(WalletConstants.ERROR_CODE_BUYER_ACCOUNT_ERROR, "Buyer account error")

        val result = PaymentSheet.result(ApiTaskResult(null, status), requested)

        assertEquals(PaymentErrorCode.NOT_AVAILABLE, result.code)
        assertEquals(
            "Payment error: Buyer account error (status code ${WalletConstants.ERROR_CODE_BUYER_ACCOUNT_ERROR})",
            result.error
        )
    }

    @Test
    fun errorWithoutAStatusIsAnInternalError() {
        // What the contract returns when the intent holds no status. Not run
        // through the contract: AutoResolveHelper needs Android to load.
        val result = PaymentSheet.result(ApiTaskResult(null, Status.RESULT_INTERNAL_ERROR), requested)

        assertEquals(internalError, result)
    }

    @Test
    fun anUnknownResultCodeIsAnInternalError() {
        assertEquals(internalError, sheetResult(42))
    }

    // MARK: - Showing the sheet

    @Test
    fun noActivityFailsWithoutListening() {
        var listened = false
        var started = false

        val failure = PaymentSheet.show(
            activity = null,
            listenForResult = { listened = true },
            stopListening = {},
            start = { started = true }
        )

        assertEquals(
            PaymentMapper.createErrorResult(PaymentErrorCode.NOT_AVAILABLE, PaymentConstants.ERROR_NO_ACTIVITY),
            failure
        )
        assertFalse(listened)
        assertFalse(started)
    }
}
