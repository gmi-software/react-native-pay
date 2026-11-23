package com.margelo.nitro.pay

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SheetAuthorizationTest {

    private fun payment(token: String) = PaymentResult(
        status = PaymentStatus.SUCCESS,
        code = null,
        success = true,
        token = PaymentToken(
            paymentMethod = PaymentMethod(
                displayName = "Visa 1111",
                network = PaymentNetwork.VISA,
                type = PaymentMethodType.CREDIT,
                secureElementPass = null,
                billingAddress = null,
                assuranceDetails = null
            ),
            transactionIdentifier = null,
            paymentData = token
        ),
        error = null,
        billingContact = null,
        shippingContact = null,
        emailAddress = null,
        phoneNumber = null,
        shippingMethod = null,
        couponCode = null
    )

    private val firstCard = payment("first-token")
    private val secondCard = payment("second-token")
    private val declined = PaymentMapper.createErrorResult(PaymentErrorCode.PROVIDER_ERROR, "Card declined")
    private val cancelled = PaymentMapper.createErrorResult(
        PaymentErrorCode.CANCELLED,
        PaymentConstants.ERROR_PAYMENT_CANCELLED
    )

    // onAuthorize attempts waiting for the merchant, in order.
    private val attempts = mutableListOf<Pair<PaymentToken, (PaymentResult, String) -> Unit>>()
    private val settled = mutableListOf<PaymentResult>()
    private val authorizedAfterSheet = mutableListOf<PaymentResult>()
    // What the sheet was told, in order.
    private val answers = mutableListOf<Pair<PaymentResult, String>>()
    private val events = mutableListOf<String>()

    private val sheet = SheetAuthorization(
        authorize = { token, _, onOutcome -> attempts.add(token to onOutcome) },
        settle = {
            events.add("settled")
            settled.add(it)
        },
        authorizeAfterSheet = { authorizedAfterSheet.add(it) }
    )

    private fun authorize(payment: PaymentResult) {
        sheet.paymentAuthorized(payment) { outcome, payerMessage ->
            events.add("answered")
            answers.add(outcome to payerMessage)
        }
    }

    private fun merchantAnswers(outcome: PaymentResult, payerMessage: String = "") {
        attempts.removeAt(0).second(outcome, payerMessage)
    }

    @Test
    fun approvedInTheSheet_settlesWithTheMerchantsOutcome() {
        authorize(firstCard)
        merchantAnswers(firstCard)
        sheet.sheetClosed(firstCard)

        assertEquals(listOf(firstCard to ""), answers)
        assertEquals(listOf(firstCard), settled)
        // onAuthorize runs once: not again after the sheet.
        assertTrue(authorizedAfterSheet.isEmpty())
    }

    @Test
    fun withoutOnAuthorize_thePaymentIsAcceptedInTheSheetAndSettlesOnce() {
        // What the handler does for sheet callbacks without onAuthorize.
        val accepted = mutableListOf<PaymentResult>()
        val accepting = SheetAuthorization(
            authorize = { _, authorizedResult, onOutcome ->
                onOutcome(authorizedResult, PaymentConstants.ERROR_AUTHORIZATION_FAILED)
            },
            settle = { accepted.add(it) },
            authorizeAfterSheet = { authorizedAfterSheet.add(it) }
        )
        val sheetAnswers = mutableListOf<String>()

        accepting.paymentAuthorized(firstCard) { outcome, payerMessage ->
            sheetAnswers.add(SheetAuthorization.googleResultJson(outcome, payerMessage))
        }
        accepting.sheetClosed(firstCard)
        accepting.sheetClosed(firstCard)

        assertEquals(listOf("SUCCESS"), sheetAnswers.map { JSONObject(it).getString("transactionState") })
        assertEquals(listOf(firstCard), accepted)
        assertTrue(authorizedAfterSheet.isEmpty())
    }

    @Test
    fun theOutcomeIsRecordedBeforeTheSheetHearsIt() {
        // Google Pay may return the sheet's result as soon as it hears the answer.
        sheet.paymentAuthorized(firstCard) { _, _ -> sheet.sheetClosed(firstCard) }
        merchantAnswers(firstCard)

        // Not a payment without the callback, which would run onAuthorize again.
        assertEquals(listOf(firstCard), settled)
        assertTrue(authorizedAfterSheet.isEmpty())
    }

    @Test
    fun theSheetWaitsForTheMerchant() {
        authorize(firstCard)

        assertTrue(answers.isEmpty())
        assertEquals(listOf("first-token"), attempts.map { it.first.paymentData })
        assertTrue(settled.isEmpty())
    }

    @Test
    fun aRetryAfterADeclineAuthorizesTheNewToken() {
        authorize(firstCard)
        merchantAnswers(declined, "Card declined")
        authorize(secondCard)
        merchantAnswers(secondCard)
        sheet.sheetClosed(secondCard)

        assertEquals(listOf(declined to "Card declined", secondCard to ""), answers)
        assertEquals(listOf(secondCard), settled)
    }

    @Test
    fun closedAfterADecline_reportsTheDeclineNotACancel() {
        authorize(firstCard)
        merchantAnswers(declined, "Card declined")
        sheet.sheetClosed(cancelled)

        assertEquals(listOf(declined), settled)
    }

    @Test
    fun closedWhileTheMerchantDecides_waitsForTheOutcome() {
        authorize(firstCard)
        sheet.sheetClosed(cancelled)

        assertTrue(settled.isEmpty())

        merchantAnswers(firstCard)

        // Charged: report it, even though the sheet closed.
        assertEquals(listOf(firstCard), settled)
        assertEquals(listOf("answered", "settled"), events)
    }

    @Test
    fun cancelledWithoutAuthorizing_isACancel() {
        sheet.sheetClosed(cancelled)

        assertEquals(listOf(cancelled), settled)
        assertTrue(attempts.isEmpty())
    }

    @Test
    fun aPaymentWithoutTheCallback_runsOnAuthorizeAfterTheSheet() {
        // Google Pay ignored callbackIntents.
        sheet.sheetClosed(firstCard)

        assertEquals(listOf(firstCard), authorizedAfterSheet)
        assertTrue(settled.isEmpty())
    }

    @Test
    fun unreadablePaymentData_isRefusedWithoutCallingOnAuthorize() {
        val unreadable = PaymentMapper.createErrorResult(PaymentErrorCode.PROVIDER_ERROR, "No payment data")

        authorize(unreadable)
        sheet.sheetClosed(cancelled)

        assertTrue(attempts.isEmpty())
        assertEquals(listOf(unreadable to PaymentConstants.ERROR_AUTHORIZATION_FAILED), answers)
        assertEquals(listOf(unreadable), settled)
    }

    @Test
    fun aCallbackAfterTheSheetClosed_isRefused() {
        sheet.sheetClosed(cancelled)
        authorize(firstCard)

        assertTrue(attempts.isEmpty())
        assertEquals(1, answers.size)
        assertEquals(false, answers[0].first.success)
        assertEquals(listOf(cancelled), settled)
    }

    @Test
    fun settlesOnce() {
        authorize(firstCard)
        merchantAnswers(firstCard)
        sheet.sheetClosed(firstCard)
        sheet.sheetClosed(cancelled)

        assertEquals(listOf(firstCard), settled)
    }

    // Google's PaymentAuthorizationResult

    @Test
    fun aSuccessClosesTheSheet() {
        val json = JSONObject(SheetAuthorization.googleResultJson(firstCard, ""))

        assertEquals("SUCCESS", json.getString("transactionState"))
        assertTrue(!json.has("error"))
    }

    @Test
    fun aFailureShowsThePayerMessage() {
        val json = JSONObject(SheetAuthorization.googleResultJson(declined, "Card declined"))

        assertEquals("ERROR", json.getString("transactionState"))
        val error = json.getJSONObject("error")
        assertEquals("OTHER_ERROR", error.getString("reason"))
        assertEquals("Card declined", error.getString("message"))
        assertEquals("PAYMENT_AUTHORIZATION", error.getString("intent"))
    }

    @Test
    fun theDefaultFailureIsGeneric() {
        val error = JSONObject(SheetAuthorization.failureJson()).getJSONObject("error")

        assertEquals(PaymentConstants.ERROR_AUTHORIZATION_FAILED, error.getString("message"))
    }
}
