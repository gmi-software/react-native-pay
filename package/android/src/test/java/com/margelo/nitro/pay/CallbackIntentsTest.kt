package com.margelo.nitro.pay

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Instant

class CallbackIntentsTest {

    private val methods = arrayOf(
        ShippingMethod("standard", "Standard", PaymentAmount.create("0"), null),
        ShippingMethod("express", "Express", PaymentAmount.create("9.00"), null)
    )

    private val shipped = paymentRequest(
        arrayOf(item("Sneakers", "40.00")),
        shippingContactRequired = true,
        shippingMethods = methods
    )

    private val deferred = paymentRequest(
        arrayOf(item("Deposit", "0")),
        shippingContactRequired = true,
        shippingMethods = methods,
        deferred = DeferredPaymentRequest(
            deferredBilling = DeferredBillingItem(
                "Hotel",
                PaymentAmount.create("240.00"),
                Instant.parse("2030-01-10T00:00:00Z")
            ),
            freeCancellation = null,
            description = "Hotel booking",
            managementUrl = "https://example.com/manage",
            billingAgreement = null,
            tokenNotificationUrl = null
        )
    )

    @Test
    fun withoutCallbacks_asksForNone() {
        val intents = CallbackIntents.from(shipped, onAuthorize = false)

        assertEquals(CallbackIntents.NONE, intents)
        assertNull(intents.toJson())
        assertFalse(intents.updatesSheet)
    }

    @Test
    fun onAuthorizeAlone_onlyAuthorizes() {
        val intents = CallbackIntents.from(shipped, onAuthorize = true)

        assertEquals(CallbackIntents(authorization = true), intents)
        assertFalse(intents.updatesSheet)
    }

    @Test
    fun onShippingMethodChange_letsThePayerPickAShippingMethod() {
        val intents = CallbackIntents.from(shipped, onAuthorize = true, onShippingMethodChange = true)

        assertEquals(CallbackIntents(authorization = true, shippingOption = true), intents)
        assertTrue(intents.updatesSheet)
    }

    @Test
    fun sheetCallbacks_needPaymentAuthorizationEvenWithoutOnAuthorize() {
        val intents = CallbackIntents.from(
            shipped,
            onAuthorize = false,
            onShippingAddressChange = true,
            onPaymentMethodChange = true
        )

        assertEquals(
            CallbackIntents(authorization = true, shippingAddress = true, shippingOption = true, paymentMethod = true),
            intents
        )
    }

    @Test
    fun shippingCallbacks_needAShippingAddress() {
        val request = paymentRequest(arrayOf(item("Sneakers", "40.00")), shippingMethods = methods)

        val intents = CallbackIntents.from(
            request,
            onAuthorize = false,
            onShippingAddressChange = true,
            onShippingMethodChange = true
        )

        assertEquals(CallbackIntents.NONE, intents)
    }

    @Test
    fun onPaymentMethodChange_worksWithoutShipping() {
        val request = paymentRequest(arrayOf(item("Sneakers", "40.00")))

        assertEquals(
            CallbackIntents(authorization = true, paymentMethod = true),
            CallbackIntents.from(request, onAuthorize = false, onPaymentMethodChange = true)
        )
    }

    @Test
    fun merchantTokenPayments_onlyAuthorize() {
        assertFalse(CallbackIntents.canUpdateSheet(deferred))
        assertEquals(
            CallbackIntents(authorization = true),
            CallbackIntents.from(
                deferred,
                onAuthorize = true,
                onShippingAddressChange = true,
                onShippingMethodChange = true,
                onPaymentMethodChange = true
            )
        )
        assertEquals(
            CallbackIntents.NONE,
            CallbackIntents.from(deferred, onAuthorize = false, onShippingAddressChange = true)
        )
    }
}
