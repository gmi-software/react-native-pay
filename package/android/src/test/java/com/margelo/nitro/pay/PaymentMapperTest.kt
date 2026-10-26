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
        error = null,
        billingContact = null,
        shippingContact = null,
        emailAddress = null,
        phoneNumber = null,
        shippingMethod = null
    )

    private val paymentDataWithContacts = PaymentData.fromJson(
        """
        {
          "apiVersion": 2,
          "apiVersionMinor": 0,
          "email": "jane@example.com",
          "shippingAddress": {
            "name": "Sam Shipper",
            "address1": "2 Shipping St",
            "address2": "Unit 5",
            "address3": "",
            "locality": "Springfield",
            "administrativeArea": "IL",
            "countryCode": "us",
            "postalCode": "62701",
            "sortingCode": "",
            "phoneNumber": "+1 555 0101"
          },
          "paymentMethodData": {
            "type": "CARD",
            "info": {
              "cardNetwork": "VISA",
              "cardDetails": "1111",
              "billingAddress": {
                "name": "Jane Appleseed",
                "address1": "1 Billing St",
                "locality": "Cupertino",
                "administrativeArea": "CA",
                "countryCode": "US",
                "postalCode": "95014",
                "phoneNumber": "+1 555 0100"
              }
            },
            "tokenizationData": {"type": "PAYMENT_GATEWAY", "token": "gateway-token"}
          }
        }
        """
    )

    @Test
    fun mapPaymentDataToResult_readsTokenAndCard() {
        val result = PaymentMapper.mapPaymentDataToResult(
            paymentData(
                """
                {
                  "type": "CARD",
                  "info": {"cardNetwork": "MASTERCARD", "cardDetails": "4242", "cardFundingSource": "CREDIT"},
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
        assertEquals(PaymentMethodType.CREDIT, token.paymentMethod.type)
        assertNull(token.paymentMethod.billingAddress)
    }

    @Test
    fun mapPaymentDataToResult_fillsMissingCardInfo() {
        val result = PaymentMapper.mapPaymentDataToResult(
            paymentData("""{"info": {}, "tokenizationData": {"token": "gateway-token"}}""")
        )

        assertTrue(result.success)
        assertEquals("unknown ****", result.token!!.paymentMethod.displayName)
        assertEquals(PaymentNetwork.UNKNOWN, result.token!!.paymentMethod.network)
        assertEquals(PaymentMethodType.UNKNOWN, result.token!!.paymentMethod.type)
    }

    @Test
    fun mapPaymentDataToResult_showsTheDescriptionToThePayer() {
        val result = PaymentMapper.mapPaymentDataToResult(
            paymentData(
                """
                {
                  "type": "CARD",
                  "description": "Visa •••• 4242",
                  "info": {"cardNetwork": "VISA", "cardDetails": "4242"},
                  "tokenizationData": {"type": "PAYMENT_GATEWAY", "token": "gateway-token"}
                }
                """
            )
        )

        assertEquals("Visa •••• 4242", result.token!!.paymentMethod.displayName)
        assertEquals(PaymentNetwork.VISA, result.token!!.paymentMethod.network)
    }

    @Test
    fun mapPaymentDataToResult_fallsBackToNetworkAndDetailsForABlankDescription() {
        val result = PaymentMapper.mapPaymentDataToResult(
            paymentData(
                """
                {
                  "description": " ",
                  "info": {"cardNetwork": "AMEX", "cardDetails": "0005"},
                  "tokenizationData": {"token": "gateway-token"}
                }
                """
            )
        )

        assertEquals("AMEX 0005", result.token!!.paymentMethod.displayName)
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
    fun mapPaymentDataToResult_reportsTheRequestedContacts() {
        val result = PaymentMapper.mapPaymentDataToResult(
            paymentDataWithContacts,
            RequestedDetails(billingContact = true, shippingContact = true, email = true, phoneNumber = true)
        )

        assertTrue(result.success)
        assertEquals(
            PaymentContact(
                name = "Jane Appleseed",
                givenName = null,
                familyName = null,
                postalAddress = CNPostalAddress(
                    street = "1 Billing St",
                    city = "Cupertino",
                    state = "CA",
                    postalCode = "95014",
                    country = null,
                    isoCountryCode = "US"
                )
            ),
            result.billingContact
        )
        assertEquals(
            PaymentContact(
                name = "Sam Shipper",
                givenName = null,
                familyName = null,
                postalAddress = CNPostalAddress(
                    street = "2 Shipping St\nUnit 5",
                    city = "Springfield",
                    state = "IL",
                    postalCode = "62701",
                    country = null,
                    isoCountryCode = "US"
                )
            ),
            result.shippingContact
        )
        assertEquals("jane@example.com", result.emailAddress)
        // Requested with the shipping address, so read from it.
        assertEquals("+1 555 0101", result.phoneNumber)
    }

    @Test
    fun mapPaymentDataToResult_readsThePhoneFromTheBillingAddressWithoutShipping() {
        val result = PaymentMapper.mapPaymentDataToResult(
            paymentDataWithContacts,
            RequestedDetails(phoneNumber = true)
        )

        // The billing address only carried the phone number, so it is not reported.
        assertNull(result.billingContact)
        assertNull(result.shippingContact)
        assertNull(result.emailAddress)
        assertEquals("+1 555 0100", result.phoneNumber)
    }

    @Test
    fun mapPaymentDataToResult_reportsNoContactsUnlessRequested() {
        val result = PaymentMapper.mapPaymentDataToResult(paymentDataWithContacts)

        assertTrue(result.success)
        assertNull(result.billingContact)
        assertNull(result.shippingContact)
        assertNull(result.emailAddress)
        assertNull(result.phoneNumber)
    }

    @Test
    fun mapPaymentDataToResult_omitsMissingAndBlankContactFields() {
        val result = PaymentMapper.mapPaymentDataToResult(
            paymentData(
                """
                {
                  "info": {"billingAddress": {"name": " ", "countryCode": "gb", "postalCode": null}},
                  "tokenizationData": {"token": "gateway-token"}
                }
                """
            ),
            RequestedDetails(billingContact = true, shippingContact = true, email = true, phoneNumber = true)
        )

        assertTrue(result.success)
        assertEquals(
            PaymentContact(
                name = null,
                givenName = null,
                familyName = null,
                postalAddress = CNPostalAddress(
                    street = null,
                    city = null,
                    state = null,
                    postalCode = null,
                    country = null,
                    isoCountryCode = "GB"
                )
            ),
            result.billingContact
        )
        assertNull(result.shippingContact)
        assertNull(result.emailAddress)
        assertNull(result.phoneNumber)
    }

    @Test
    fun mapPaymentDataToResult_reportsTheChargedShippingMethod() {
        val express = ShippingMethod(
            identifier = "express",
            label = "Express",
            amount = PaymentAmount.create("9.00"),
            detail = "Next day"
        )

        val result = PaymentMapper.mapPaymentDataToResult(
            paymentDataWithContacts,
            RequestedDetails(shippingMethod = express)
        )

        assertTrue(result.success)
        assertSame(express, result.shippingMethod)
        assertSame(express, PaymentMapper.paymentDetails(result).shippingMethod)
    }

    @Test
    fun requestedDetails_chargesTheFirstShippingMethod() {
        fun request(methods: Array<ShippingMethod>?) = PaymentRequest(
            applePayMerchantIdentifier = null, merchantName = null, countryCode = "US",
            currencyCode = "USD", paymentItems = emptyArray(), merchantCapabilities = emptyArray(),
            supportedNetworks = emptyArray(), shippingType = null, shippingMethods = methods,
            billingContactRequired = null, shippingContactRequired = null, emailRequired = null,
            phoneNumberRequired = null, googlePayMerchantId = null, googlePayEnvironment = null,
            googlePayGateway = null, googlePayGatewayMerchantId = null,
            googlePayAllowedAuthMethods = null
        )
        val standard = ShippingMethod("standard", "Standard", PaymentAmount.create("4.50"), null)
        val express = ShippingMethod("express", "Express", PaymentAmount.create("9.00"), null)

        assertSame(standard, RequestedDetails.from(request(arrayOf(standard, express))).shippingMethod)
        assertNull(RequestedDetails.from(request(emptyArray())).shippingMethod)
        assertNull(RequestedDetails.from(request(null)).shippingMethod)
    }

    @Test
    fun paymentDetails_copiesTheResultsContacts() {
        val result = PaymentMapper.mapPaymentDataToResult(
            paymentDataWithContacts,
            RequestedDetails(shippingContact = true, email = true)
        )

        val details = PaymentMapper.paymentDetails(result)

        assertNull(details.billingContact)
        assertEquals(result.shippingContact, details.shippingContact)
        assertEquals("jane@example.com", details.emailAddress)
        assertNull(details.phoneNumber)
    }

    @Test
    fun fromGooglePay_mapsGooglePayNetworksIgnoringCase() {
        assertEquals(PaymentNetwork.VISA, GooglePayNetworks.fromGooglePay("VISA"))
        assertEquals(PaymentNetwork.MASTERCARD, GooglePayNetworks.fromGooglePay("MASTERCARD"))
        assertEquals(PaymentNetwork.AMEX, GooglePayNetworks.fromGooglePay("AMEX"))
        assertEquals(PaymentNetwork.DISCOVER, GooglePayNetworks.fromGooglePay("DISCOVER"))
        assertEquals(PaymentNetwork.JCB, GooglePayNetworks.fromGooglePay("JCB"))
        assertEquals(PaymentNetwork.INTERAC, GooglePayNetworks.fromGooglePay("INTERAC"))
        assertEquals(PaymentNetwork.MAESTRO, GooglePayNetworks.fromGooglePay("maestro"))
        assertEquals(PaymentNetwork.ELECTRON, GooglePayNetworks.fromGooglePay("Electron"))
        assertEquals(PaymentNetwork.ELO, GooglePayNetworks.fromGooglePay("elo"))
    }

    @Test
    fun fromGooglePay_reportsUnrecognizedNetworksAsUnknown() {
        assertEquals(PaymentNetwork.UNKNOWN, GooglePayNetworks.fromGooglePay("unknown"))
        assertEquals(PaymentNetwork.UNKNOWN, GooglePayNetworks.fromGooglePay("ELO_DEBIT"))
        assertEquals(PaymentNetwork.UNKNOWN, GooglePayNetworks.fromGooglePay(""))
    }

    @Test
    fun fromGooglePay_readsBackEveryNetworkTheRequestSends() {
        for (network in PaymentNetwork.entries) {
            val cardNetwork = GooglePayNetworks.toGooglePay(network) ?: continue
            assertEquals(network, GooglePayNetworks.fromGooglePay(cardNetwork))
        }
    }

    @Test
    fun mapCardFundingSource_mapsGooglePayValuesIgnoringCase() {
        assertEquals(PaymentMethodType.CREDIT, PaymentMapper.mapCardFundingSource("CREDIT"))
        assertEquals(PaymentMethodType.DEBIT, PaymentMapper.mapCardFundingSource("DEBIT"))
        assertEquals(PaymentMethodType.PREPAID, PaymentMapper.mapCardFundingSource("PREPAID"))
        assertEquals(PaymentMethodType.DEBIT, PaymentMapper.mapCardFundingSource("debit"))
        assertEquals(PaymentMethodType.PREPAID, PaymentMapper.mapCardFundingSource("Prepaid"))
    }

    @Test
    fun mapCardFundingSource_reportsUnrecognizedValuesAsUnknown() {
        assertEquals(PaymentMethodType.UNKNOWN, PaymentMapper.mapCardFundingSource("UNKNOWN"))
        assertEquals(PaymentMethodType.UNKNOWN, PaymentMapper.mapCardFundingSource("STORE"))
        assertEquals(PaymentMethodType.UNKNOWN, PaymentMapper.mapCardFundingSource(""))
    }

    @Test
    fun mapPaymentDataToResult_readsEachFundingSource() {
        val expected = mapOf(
            "CREDIT" to PaymentMethodType.CREDIT,
            "DEBIT" to PaymentMethodType.DEBIT,
            "PREPAID" to PaymentMethodType.PREPAID,
            "UNKNOWN" to PaymentMethodType.UNKNOWN
        )

        for ((fundingSource, type) in expected) {
            val result = PaymentMapper.mapPaymentDataToResult(
                paymentData(
                    """
                    {
                      "info": {"cardNetwork": "VISA", "cardDetails": "1111", "cardFundingSource": "$fundingSource"},
                      "tokenizationData": {"token": "gateway-token"}
                    }
                    """
                )
            )

            assertEquals(fundingSource, type, result.token!!.paymentMethod.type)
        }
    }

    @Test
    fun mapPaymentDataToResult_reportsANullFundingSourceAsUnknown() {
        val result = PaymentMapper.mapPaymentDataToResult(
            paymentData(
                """
                {
                  "info": {"cardNetwork": "VISA", "cardDetails": "1111", "cardFundingSource": null},
                  "tokenizationData": {"token": "gateway-token"}
                }
                """
            )
        )

        assertEquals(PaymentMethodType.UNKNOWN, result.token!!.paymentMethod.type)
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
