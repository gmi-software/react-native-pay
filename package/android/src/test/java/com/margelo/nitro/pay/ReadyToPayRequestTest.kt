package com.margelo.nitro.pay

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ReadyToPayRequestTest {

    private fun JSONObject.cardParameters(): JSONObject =
        getJSONArray("allowedPaymentMethods").getJSONObject(0).getJSONObject("parameters")

    private fun JSONObject.allowedCardNetworks(): List<String> {
        val networks = cardParameters().getJSONArray("allowedCardNetworks")
        return (0 until networks.length()).map { networks.getString(it) }
    }

    @Test
    fun googleCardNetworks_mapsPaymentNetworkNames() {
        assertEquals(
            listOf("VISA", "MASTERCARD", "AMEX", "DISCOVER", "JCB", "INTERAC"),
            GooglePayRequestBuilder.googleCardNetworks(
                arrayOf("visa", "mastercard", "amex", "discover", "jcb", "interac")
            )
        )
    }

    @Test
    fun googleCardNetworks_ignoresCaseAndDuplicates() {
        assertEquals(
            listOf("VISA", "AMEX"),
            GooglePayRequestBuilder.googleCardNetworks(arrayOf("Visa", "AMEX", "visa"))
        )
    }

    @Test
    fun googleCardNetworks_dropsNetworksGooglePayDoesNotHave() {
        assertEquals(
            listOf("MASTERCARD"),
            GooglePayRequestBuilder.googleCardNetworks(
                arrayOf("idcredit", "privateLabel", "mastercard", "unknown")
            )
        )
        assertEquals(
            emptyList<String>(),
            GooglePayRequestBuilder.googleCardNetworks(arrayOf("privateLabel"))
        )
    }

    @Test
    fun isReadyToPayRequest_checksTheGivenNetworksForAnExistingCard() {
        val request = GooglePayRequestBuilder.createIsReadyToPayRequest(
            cardNetworks = listOf("VISA", "JCB"),
            existingPaymentMethodRequired = true
        )

        assertEquals(listOf("VISA", "JCB"), request.allowedCardNetworks())
        assertTrue(request.getBoolean("existingPaymentMethodRequired"))
        assertFalse(
            request.getJSONArray("allowedPaymentMethods").getJSONObject(0)
                .has("tokenizationSpecification")
        )
    }

    @Test
    fun isReadyToPayRequest_canAskWithoutRequiringACard() {
        val request = GooglePayRequestBuilder.createIsReadyToPayRequest(
            cardNetworks = PaymentConstants.DEFAULT_CARD_NETWORKS,
            existingPaymentMethodRequired = false
        )

        assertEquals(
            listOf("VISA", "MASTERCARD", "AMEX", "DISCOVER"),
            request.allowedCardNetworks()
        )
        assertTrue(request.has("existingPaymentMethodRequired"))
        assertFalse(request.getBoolean("existingPaymentMethodRequired"))
    }
}
