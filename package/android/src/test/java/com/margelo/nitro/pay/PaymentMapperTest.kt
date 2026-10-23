package com.margelo.nitro.pay

import com.google.android.gms.wallet.PaymentData
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test

class PaymentMapperTest {

    private fun paymentData(paymentMethodData: String): PaymentData =
        PaymentData.fromJson("""{"apiVersion":2,"apiVersionMinor":0,"paymentMethodData":$paymentMethodData}""")

    private fun authorizedResult() = PaymentResult(
        success = true,
        transactionId = "transaction",
        token = null,
        error = null
    )

    @Test
    fun mapPaymentDataToResult_readsTokenAndCard() {
        val result = PaymentMapper.mapPaymentDataToResult(
            paymentData(
                """
                {
                  "type": "CARD",
                  "info": {"cardNetwork": "MASTERCARD", "cardDetails": "4242"},
                  "tokenizationData": {"type": "PAYMENT_GATEWAY", "token": "gateway-token"}
                }
                """
            )
        )

        assertTrue(result.success)
        assertNull(result.error)
        assertNotNull(result.transactionId)
        val token = result.token!!
        assertEquals("gateway-token", token.paymentData)
        assertEquals("MASTERCARD 4242", token.paymentMethod.displayName)
        assertEquals(PaymentNetwork.MASTERCARD, token.paymentMethod.network)
        assertEquals(PaymentMethodType.UNKNOWN, token.paymentMethod.type)
        assertNull(token.paymentMethod.billingAddress)
    }

    @Test
    fun mapPaymentDataToResult_fillsMissingCardInfo() {
        val result = PaymentMapper.mapPaymentDataToResult(
            paymentData("""{"info": {}, "tokenizationData": {"token": "gateway-token"}}""")
        )

        assertTrue(result.success)
        assertEquals("unknown ****", result.token!!.paymentMethod.displayName)
    }

    @Test
    fun mapPaymentDataToResult_reportsMissingTokenAsError() {
        val result = PaymentMapper.mapPaymentDataToResult(
            paymentData("""{"info": {"cardNetwork": "VISA", "cardDetails": "4242"}}""")
        )

        assertFalse(result.success)
        assertNull(result.token)
        assertTrue(result.error!!.startsWith("Failed to parse payment data:"))
    }

    @Test
    fun mapCardNetwork_mapsGooglePayNetworksIgnoringCase() {
        assertEquals(PaymentNetwork.VISA, PaymentMapper.mapCardNetwork("VISA"))
        assertEquals(PaymentNetwork.MASTERCARD, PaymentMapper.mapCardNetwork("MASTERCARD"))
        assertEquals(PaymentNetwork.AMEX, PaymentMapper.mapCardNetwork("AMEX"))
        assertEquals(PaymentNetwork.DISCOVER, PaymentMapper.mapCardNetwork("DISCOVER"))
        assertEquals(PaymentNetwork.JCB, PaymentMapper.mapCardNetwork("JCB"))
        assertEquals(PaymentNetwork.INTERAC, PaymentMapper.mapCardNetwork("INTERAC"))
        assertEquals(PaymentNetwork.MAESTRO, PaymentMapper.mapCardNetwork("maestro"))
        assertEquals(PaymentNetwork.ELECTRON, PaymentMapper.mapCardNetwork("Electron"))
        assertEquals(PaymentNetwork.ELO, PaymentMapper.mapCardNetwork("elo"))
    }

    @Test
    fun mapCardNetwork_reportsUnknownNetworksAsVisa() {
        // Current behavior, tracked in #13.
        assertEquals(PaymentNetwork.VISA, PaymentMapper.mapCardNetwork("unknown"))
    }

    @Test
    fun applyAuthorization_keepsTheAuthorizedResultOnSuccess() {
        val authorized = authorizedResult()

        val result = PaymentMapper.applyAuthorization(
            PaymentAuthorizationResult(PaymentAuthorizationStatus.SUCCESS, null),
            authorized
        )

        assertSame(authorized, result)
    }

    @Test
    fun applyAuthorization_reportsTheMerchantsFailure() {
        val result = PaymentMapper.applyAuthorization(
            PaymentAuthorizationResult(PaymentAuthorizationStatus.FAILURE, "Card declined"),
            authorizedResult()
        )

        assertEquals(PaymentMapper.createErrorResult("Card declined"), result)
    }

    @Test
    fun applyAuthorization_defaultsTheFailureMessage() {
        val result = PaymentMapper.applyAuthorization(
            PaymentAuthorizationResult(PaymentAuthorizationStatus.FAILURE, null),
            authorizedResult()
        )

        assertFalse(result.success)
        assertNull(result.transactionId)
        assertNull(result.token)
        assertEquals(PaymentConstants.ERROR_AUTHORIZATION_FAILED, result.error)
    }
}
