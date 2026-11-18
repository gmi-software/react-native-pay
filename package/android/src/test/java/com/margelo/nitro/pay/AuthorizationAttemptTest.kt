package com.margelo.nitro.pay

import org.junit.Assert.assertEquals
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test

class AuthorizationAttemptTest {

    private val authorizedResult = PaymentResult(
        status = PaymentStatus.SUCCESS,
        code = null,
        success = true,
        token = PaymentToken(
            paymentMethod = PaymentMethod(
                displayName = "Visa 1111",
                network = PaymentNetwork.VISA,
                type = PaymentMethodType.CREDIT,
                secureElementPass = null,
                billingAddress = null
            ),
            transactionIdentifier = null,
            paymentData = "gateway-token"
        ),
        error = null,
        billingContact = null,
        shippingContact = null,
        emailAddress = null,
        phoneNumber = null,
        shippingMethod = null
    )

    private val settled = mutableListOf<PaymentResult>()
    private val attempt = AuthorizationAttempt(authorizedResult) { settled.add(it) }

    private val timedOut = PaymentMapper.createErrorResult(
        PaymentErrorCode.PROVIDER_ERROR,
        PaymentConstants.ERROR_AUTHORIZATION_TIMED_OUT
    )

    @Test
    fun settlesWithTheAuthorizedResultOnSuccess() {
        attempt.authorized(PaymentAuthorizationResult(PaymentAuthorizationStatus.SUCCESS, null))

        assertEquals(1, settled.size)
        assertSame(authorizedResult, settled[0])
    }

    @Test
    fun settlesWithTheMerchantsFailure() {
        attempt.authorized(PaymentAuthorizationResult(PaymentAuthorizationStatus.FAILURE, "Card declined"))

        assertEquals(
            listOf(PaymentMapper.createErrorResult(PaymentErrorCode.PROVIDER_ERROR, "Card declined")),
            settled
        )
    }

    @Test
    fun settlesWithARejection() {
        attempt.failed(RuntimeException("Server unreachable"))

        assertEquals(
            listOf(PaymentMapper.createErrorResult(PaymentErrorCode.PROVIDER_ERROR, "Server unreachable")),
            settled
        )
    }

    @Test
    fun describesARejectionWithoutAMessage() {
        attempt.failed(RuntimeException())

        assertEquals(PaymentConstants.ERROR_AUTHORIZATION_FAILED, settled.single().error)
    }

    @Test
    fun settlesWithTheTimeout() {
        attempt.timedOut()

        assertEquals(listOf(timedOut), settled)
    }

    @Test
    fun ignoresAResultAfterTheTimeout() {
        attempt.timedOut()
        attempt.authorized(PaymentAuthorizationResult(PaymentAuthorizationStatus.SUCCESS, null))
        attempt.failed(RuntimeException("Server unreachable"))

        assertEquals(listOf(timedOut), settled)
    }

    @Test
    fun ignoresTheTimeoutAfterAResult() {
        attempt.authorized(PaymentAuthorizationResult(PaymentAuthorizationStatus.SUCCESS, null))
        attempt.timedOut()

        assertEquals(listOf(authorizedResult), settled)
    }

    @Test
    fun aLateResultDoesNotSettleTheNextPayment() {
        val pending = PendingPayment<PaymentResult>()
        val first = mutableListOf<PaymentResult>()
        val second = mutableListOf<PaymentResult>()
        pending.tryBegin { first.add(it) }
        val firstAttempt = AuthorizationAttempt(authorizedResult) { pending.settle(it) }

        firstAttempt.timedOut()
        pending.tryBegin { second.add(it) }
        firstAttempt.authorized(PaymentAuthorizationResult(PaymentAuthorizationStatus.SUCCESS, null))

        assertEquals(listOf(timedOut), first)
        assertEquals(emptyList<PaymentResult>(), second)
        // The second payment still waits for its own outcome.
        assertTrue(pending.isInProgress)
    }
}
