package com.margelo.nitro.pay

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ReadyToPayRequestTest {

    private fun JSONObject.cardParameters(): JSONObject =
        getJSONArray("allowedPaymentMethods").getJSONObject(0).getJSONObject("parameters")

    private fun JSONObject.allowedCardNetworks(): List<String> =
        cardParameters().getJSONArray("allowedCardNetworks").strings()

    @Test
    fun isReadyToPayRequest_checksTheGivenNetworksForAnExistingCard() {
        val request = GooglePayRequestBuilder.createIsReadyToPayRequest(
            cardParameters = GooglePayCardParameters.from(arrayOf("visa", "jcb"), null),
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
            cardParameters = GooglePayCardParameters.DEFAULT,
            existingPaymentMethodRequired = false
        )

        assertEquals(
            listOf("VISA", "MASTERCARD", "AMEX", "DISCOVER"),
            request.allowedCardNetworks()
        )
        assertTrue(request.has("existingPaymentMethodRequired"))
        assertFalse(request.getBoolean("existingPaymentMethodRequired"))
        assertFalse(request.cardParameters().has("allowPrepaidCards"))
    }

    @Test
    fun isReadyToPayRequest_leavesPrepaidCardsOutWhenThePaymentDoes() {
        val request = GooglePayRequestBuilder.createIsReadyToPayRequest(
            cardParameters = GooglePayCardParameters.from(null, null, null, allowPrepaidCards = false),
            existingPaymentMethodRequired = true
        )

        assertFalse(request.cardParameters().getBoolean("allowPrepaidCards"))
    }
}
