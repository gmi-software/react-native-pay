package com.margelo.nitro.pay

import com.google.android.gms.wallet.WalletConstants
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class GooglePayRequestBuilderTest {

    private fun item(label: String, amount: Double, type: PaymentItemType) =
        PaymentItem(label = label, amount = PaymentAmount.create(amount), type = type)

    private fun item(label: String, amount: String, type: PaymentItemType = PaymentItemType.FINAL) =
        PaymentItem(label = label, amount = PaymentAmount.create(amount), type = type)

    private fun paymentRequest(
        items: Array<PaymentItem>,
        currencyCode: String = "USD",
        merchantName: String? = null,
        environment: GooglePayEnvironment? = null,
        googlePayMerchantId: String? = null,
        googlePayGateway: String? = null,
        googlePayGatewayMerchantId: String? = null,
        billingContactRequired: Boolean? = null,
        shippingContactRequired: Boolean? = null,
        emailRequired: Boolean? = null,
        phoneNumberRequired: Boolean? = null,
        shippingMethods: Array<ShippingMethod>? = null,
        supportedNetworks: Array<String> = arrayOf("visa"),
        googlePayAllowedAuthMethods: Array<String>? = null
    ) = PaymentRequest(
        applePayMerchantIdentifier = null,
        merchantName = merchantName,
        countryCode = "US",
        currencyCode = currencyCode,
        paymentItems = items,
        merchantCapabilities = arrayOf("3DS"),
        supportedNetworks = supportedNetworks,
        shippingType = null,
        shippingMethods = shippingMethods,
        billingContactRequired = billingContactRequired,
        shippingContactRequired = shippingContactRequired,
        emailRequired = emailRequired,
        phoneNumberRequired = phoneNumberRequired,
        googlePayMerchantId = googlePayMerchantId,
        googlePayEnvironment = environment,
        googlePayGateway = googlePayGateway,
        googlePayGatewayMerchantId = googlePayGatewayMerchantId,
        googlePayAllowedAuthMethods = googlePayAllowedAuthMethods
    )

    private fun build(
        request: PaymentRequest,
        environment: Int = WalletConstants.ENVIRONMENT_TEST,
        fallbackMerchantName: String? = null
    ): JSONObject = GooglePayRequestBuilder.createPaymentDataRequest(
        request,
        environment,
        fallbackMerchantName
    )

    private fun JSONObject.displayItems(): List<JSONObject> {
        val items = getJSONObject("transactionInfo").getJSONArray("displayItems")
        return (0 until items.length()).map { items.getJSONObject(it) }
    }

    private fun JSONObject.totalPriceStatus(): String =
        getJSONObject("transactionInfo").getString("totalPriceStatus")

    private fun JSONObject.totalPrice(): String =
        getJSONObject("transactionInfo").getString("totalPrice")

    // Display items and total status

    @Test
    fun finalOnlyCart_sendsLineItemsAndFinalTotal() {
        val json = build(
            paymentRequest(
                arrayOf(
                    item("Coffee", 4.99, PaymentItemType.FINAL),
                    item("Tax", 0.40, PaymentItemType.FINAL)
                )
            )
        )

        val items = json.displayItems()
        assertEquals(listOf("LINE_ITEM", "LINE_ITEM"), items.map { it.getString("type") })
        assertEquals(listOf("FINAL", "FINAL"), items.map { it.getString("status") })
        assertEquals(listOf("4.99", "0.40"), items.map { it.getString("price") })
        assertEquals("FINAL", json.totalPriceStatus())
        assertEquals("5.39", json.getJSONObject("transactionInfo").getString("totalPrice"))
    }

    @Test
    fun mixedCart_marksPendingItemsAndEstimatesTotal() {
        val json = build(
            paymentRequest(
                arrayOf(
                    item("Coffee", 4.99, PaymentItemType.FINAL),
                    item("Shipping (estimate)", 5.0, PaymentItemType.PENDING)
                )
            )
        )

        val items = json.displayItems()
        assertEquals(listOf("LINE_ITEM", "LINE_ITEM"), items.map { it.getString("type") })
        assertEquals(listOf("FINAL", "PENDING"), items.map { it.getString("status") })
        assertEquals("ESTIMATED", json.totalPriceStatus())
        assertEquals("9.99", json.getJSONObject("transactionInfo").getString("totalPrice"))
    }

    @Test
    fun pendingOnlyCart_marksAllItemsPendingAndEstimatesTotal() {
        val json = build(
            paymentRequest(
                arrayOf(
                    item("Deposit", 20.0, PaymentItemType.PENDING),
                    item("Shipping (estimate)", 5.0, PaymentItemType.PENDING)
                )
            )
        )

        val items = json.displayItems()
        assertEquals(listOf("LINE_ITEM", "LINE_ITEM"), items.map { it.getString("type") })
        assertEquals(listOf("PENDING", "PENDING"), items.map { it.getString("status") })
        assertEquals("ESTIMATED", json.totalPriceStatus())
    }

    @Test
    fun displayItemTypeIsNeverAStatusValue() {
        val json = build(
            paymentRequest(arrayOf(item("Shipping", 5.0, PaymentItemType.PENDING)))
        )

        assertFalse(json.toString().contains("\"type\":\"PENDING\""))
    }

    // Amounts

    @Test
    fun totalPrice_isTheExactSumOfTheItems() {
        val json = build(
            paymentRequest(
                arrayOf(
                    item("Book", "19.99"),
                    item("Book", 19.99, PaymentItemType.FINAL),
                    item("Fee", "0.01")
                )
            )
        )

        assertEquals("39.99", json.totalPrice())
        assertEquals(listOf("19.99", "19.99", "0.01"), json.displayItems().map { it.getString("price") })
    }

    @Test
    fun prices_haveTwoDecimalsOrNone() {
        assertEquals("10.00", build(paymentRequest(arrayOf(item("Item", "10.0")))).totalPrice())
        assertEquals(
            "1500",
            build(paymentRequest(arrayOf(item("Item", "1500")), currencyCode = "JPY")).totalPrice()
        )
        assertEquals(
            "10000000",
            build(paymentRequest(arrayOf(item("Item", 1.0E7, PaymentItemType.FINAL)))).totalPrice()
        )
    }

    @Test
    fun negativeLineItems_areSentWhenTheTotalIsNotNegative() {
        val json = build(paymentRequest(arrayOf(item("Item", "20.00"), item("Discount", "-5.00"))))

        assertEquals("15.00", json.totalPrice())
        assertEquals(listOf("20.00", "-5.00"), json.displayItems().map { it.getString("price") })
    }

    @Test
    fun negativeTotal_isRejected() {
        val error = assertThrows(IllegalArgumentException::class.java) {
            build(paymentRequest(arrayOf(item("Item", "5.00"), item("Discount", "-5.01"))))
        }

        assertTrue(error.message!!.contains("must not be negative, got -0.01"))
    }

    @Test
    fun thirdDecimalPlace_isRejectedInsteadOfRounded() {
        assertEquals(
            "1.23",
            build(paymentRequest(arrayOf(item("Item", "1.230")), currencyCode = "KWD")).totalPrice()
        )

        val error = assertThrows(IllegalArgumentException::class.java) {
            build(paymentRequest(arrayOf(item("Item", "1.234")), currencyCode = "KWD"))
        }
        assertTrue(error.message!!.contains("at most two decimal places, got 1.234"))
    }

    // Merchant name

    private fun JSONObject.merchantInfo(): JSONObject = getJSONObject("merchantInfo")

    private val coffee = arrayOf(item("Coffee", 4.99, PaymentItemType.FINAL))

    @Test
    fun merchantName_usesTrimmedRequestValue() {
        val json = build(
            paymentRequest(coffee, merchantName = "  Coffee Shop  "),
            fallbackMerchantName = "My App"
        )

        assertEquals("Coffee Shop", json.merchantInfo().getString("merchantName"))
    }

    @Test
    fun merchantName_fallsBackWhenMissing() {
        val json = build(paymentRequest(coffee), fallbackMerchantName = "My App")

        assertEquals("My App", json.merchantInfo().getString("merchantName"))
    }

    @Test
    fun merchantName_fallsBackWhenBlank() {
        val json = build(
            paymentRequest(coffee, merchantName = "   "),
            fallbackMerchantName = "My App"
        )

        assertEquals("My App", json.merchantInfo().getString("merchantName"))
    }

    @Test
    fun merchantName_isOmittedWithoutRequestValueOrFallback() {
        val json = build(paymentRequest(coffee), fallbackMerchantName = " ")

        assertFalse(json.merchantInfo().has("merchantName"))
        assertFalse(json.toString().contains("Example Merchant"))
    }

    @Test
    fun production_usesFallbackMerchantNameAndMerchantId() {
        val json = build(
            paymentRequest(
                coffee,
                environment = GooglePayEnvironment.PRODUCTION,
                googlePayMerchantId = "BCR2DN4T000000",
                googlePayGateway = "stripe",
                googlePayGatewayMerchantId = "acct_123"
            ),
            environment = WalletConstants.ENVIRONMENT_PRODUCTION,
            fallbackMerchantName = "My App"
        )

        val merchantInfo = json.merchantInfo()
        assertEquals("My App", merchantInfo.getString("merchantName"))
        assertEquals("BCR2DN4T000000", merchantInfo.getString("merchantId"))
    }

    // PRODUCTION validation (regression)

    @Test
    fun production_requiresGatewayConfiguration() {
        val error = assertThrows(IllegalArgumentException::class.java) {
            build(
                paymentRequest(coffee, googlePayMerchantId = "BCR2DN4T000000"),
                environment = WalletConstants.ENVIRONMENT_PRODUCTION
            )
        }

        assertTrue(error.message!!.contains("googlePayGateway"))
    }

    @Test
    fun production_requiresMerchantId() {
        val error = assertThrows(IllegalArgumentException::class.java) {
            build(
                paymentRequest(
                    coffee,
                    googlePayGateway = "stripe",
                    googlePayGatewayMerchantId = "acct_123"
                ),
                environment = WalletConstants.ENVIRONMENT_PRODUCTION
            )
        }

        assertTrue(error.message!!.contains("googlePayMerchantId"))
    }

    // Contact details

    private fun JSONObject.cardParameters(): JSONObject =
        getJSONArray("allowedPaymentMethods").getJSONObject(0).getJSONObject("parameters")

    @Test
    fun contacts_areNotRequestedByDefault() {
        val json = build(paymentRequest(coffee))

        assertFalse(json.has("emailRequired"))
        assertFalse(json.has("shippingAddressRequired"))
        assertFalse(json.has("shippingAddressParameters"))
        assertFalse(json.cardParameters().has("billingAddressRequired"))
        assertFalse(json.cardParameters().has("billingAddressParameters"))
    }

    @Test
    fun billingContact_requestsAFullBillingAddress() {
        val json = build(paymentRequest(coffee, billingContactRequired = true))

        val parameters = json.cardParameters()
        assertTrue(parameters.getBoolean("billingAddressRequired"))
        assertEquals("FULL", parameters.getJSONObject("billingAddressParameters").getString("format"))
        assertFalse(parameters.getJSONObject("billingAddressParameters").getBoolean("phoneNumberRequired"))
        assertFalse(json.has("shippingAddressRequired"))
    }

    @Test
    fun shippingContact_requestsTheShippingAddressWithThePhoneNumber() {
        val json = build(
            paymentRequest(
                coffee,
                shippingContactRequired = true,
                emailRequired = true,
                phoneNumberRequired = true
            )
        )

        assertTrue(json.getBoolean("emailRequired"))
        assertTrue(json.getBoolean("shippingAddressRequired"))
        assertTrue(json.getJSONObject("shippingAddressParameters").getBoolean("phoneNumberRequired"))
        assertFalse(json.cardParameters().has("billingAddressRequired"))
    }

    @Test
    fun phoneNumberWithoutShipping_requestsItWithAMinimalBillingAddress() {
        val json = build(paymentRequest(coffee, phoneNumberRequired = true))

        val parameters = json.cardParameters()
        assertTrue(parameters.getBoolean("billingAddressRequired"))
        assertEquals("MIN", parameters.getJSONObject("billingAddressParameters").getString("format"))
        assertTrue(parameters.getJSONObject("billingAddressParameters").getBoolean("phoneNumberRequired"))
        assertFalse(json.has("shippingAddressRequired"))
        assertFalse(json.has("emailRequired"))
    }

    @Test
    fun phoneNumberWithBillingContact_requestsItWithTheFullBillingAddress() {
        val json = build(paymentRequest(coffee, billingContactRequired = true, phoneNumberRequired = true))

        val billingParameters = json.cardParameters().getJSONObject("billingAddressParameters")
        assertEquals("FULL", billingParameters.getString("format"))
        assertTrue(billingParameters.getBoolean("phoneNumberRequired"))
    }

    // Shipping methods

    private fun method(identifier: String, label: String, amount: String) =
        ShippingMethod(identifier = identifier, label = label, amount = PaymentAmount.create(amount), detail = null)

    private val shippingMethods = arrayOf(
        method("standard", "Standard", "4.50"),
        method("express", "Express", "9.00")
    )

    @Test
    fun shippingMethods_chargeTheFirstMethodAsALineItem() {
        val json = build(paymentRequest(arrayOf(item("Beans", "18.00")), shippingMethods = shippingMethods))

        val items = json.displayItems()
        assertEquals(listOf("Beans", "Standard"), items.map { it.getString("label") })
        assertEquals(listOf("18.00", "4.50"), items.map { it.getString("price") })
        assertEquals(listOf("LINE_ITEM", "LINE_ITEM"), items.map { it.getString("type") })
        assertEquals("FINAL", items[1].getString("status"))
        assertEquals("22.50", json.totalPrice())
        assertEquals("FINAL", json.totalPriceStatus())
    }

    @Test
    fun shippingMethods_emptyListChargesNoShipping() {
        val json = build(paymentRequest(arrayOf(item("Beans", "18.00")), shippingMethods = emptyArray()))

        assertEquals(listOf("Beans"), json.displayItems().map { it.getString("label") })
        assertEquals("18.00", json.totalPrice())
    }

    @Test
    fun shippingMethods_areValidatedLikeOnIos() {
        val beans = arrayOf(item("Beans", "18.00"))
        val cases = listOf(
            arrayOf(method(" ", "Standard", "0")) to
                "Shipping method \"Standard\" needs an identifier",
            arrayOf(method("express", "Express", "7.50"), method("express", "Express (again)", "9.00")) to
                "Shipping method identifier \"express\" is used more than once",
            arrayOf(method("pickup", "Pickup", "-1.00")) to
                "Amount for \"Pickup\" must not be negative",
            arrayOf(method("express", "Express", "7,50")) to
                "Amount for \"Express\" must be a finite number or a decimal string like \"19.99\""
        )

        cases.forEach { (methods, message) ->
            val error = assertThrows(IllegalArgumentException::class.java) {
                build(paymentRequest(beans, shippingMethods = methods))
            }
            assertEquals(message, error.message)
        }
    }

    @Test
    fun shippingMethods_doNotMakeUpForANegativeItemTotal() {
        val error = assertThrows(IllegalArgumentException::class.java) {
            build(
                paymentRequest(
                    arrayOf(item("Coffee", "4.99"), item("Discount", "-10.00")),
                    shippingMethods = arrayOf(method("express", "Express", "6.00"), method("standard", "Standard", "0"))
                )
            )
        }

        assertEquals("Payment total must not be negative, got -5.01", error.message)
    }

    @Test
    fun isReadyToPayRequest_neverAsksForContacts() {
        val parameters = GooglePayRequestBuilder.createIsReadyToPayRequest().cardParameters()

        assertFalse(parameters.has("billingAddressRequired"))
    }

    // Card networks and auth methods

    private fun JSONObject.strings(key: String): List<String> {
        val array = getJSONArray(key)
        return (0 until array.length()).map { array.getString(it) }
    }

    private fun cardParametersOf(
        networks: Array<String>?,
        authMethods: Array<String>? = null
    ) = GooglePayCardParameters.from(networks, authMethods)

    @Test
    fun supportedNetworks_areTheOnlyNetworksInTheRequestTheReadinessCheckAndTheButton() {
        val request = build(paymentRequest(coffee, supportedNetworks = arrayOf("visa", "mastercard")))
        val parameters = cardParametersOf(arrayOf("visa", "mastercard"))
        val readiness = GooglePayRequestBuilder.createIsReadyToPayRequest(true, parameters)
        val button = GooglePayRequestBuilder.createAllowedPaymentMethods(parameters)

        val expected = listOf("VISA", "MASTERCARD")
        assertEquals(expected, request.cardParameters().strings("allowedCardNetworks"))
        assertEquals(expected, readiness.cardParameters().strings("allowedCardNetworks"))
        assertEquals(
            expected,
            button.getJSONObject(0).getJSONObject("parameters").strings("allowedCardNetworks")
        )
        assertEquals(
            readiness.getJSONArray("allowedPaymentMethods").toString(),
            button.toString()
        )
    }

    @Test
    fun supportedNetworks_mapEveryGooglePayNetworkIgnoringCase() {
        val parameters = cardParametersOf(
            arrayOf("VISA", "MasterCard", "amex", "discover", "jcb", "interac", "electron", "maestro", "elo")
        )

        assertEquals(
            listOf("VISA", "MASTERCARD", "AMEX", "DISCOVER", "JCB", "INTERAC", "ELECTRON", "MAESTRO", "ELO"),
            parameters.cardNetworks
        )
    }

    @Test
    fun supportedNetworks_leaveOutNetworksGooglePayDoesNotOffer() {
        val parameters = cardParametersOf(arrayOf("cartesBancaires", "visa", "mada", "VISA"))

        assertEquals(listOf("VISA"), parameters.cardNetworks)
    }

    @Test
    fun supportedNetworks_defaultToTheFourCommonNetworks() {
        val parameters = GooglePayRequestBuilder.createIsReadyToPayRequest().cardParameters()

        assertEquals(
            listOf("VISA", "MASTERCARD", "AMEX", "DISCOVER"),
            parameters.strings("allowedCardNetworks")
        )
        assertEquals(listOf("PAN_ONLY", "CRYPTOGRAM_3DS"), parameters.strings("allowedAuthMethods"))
    }

    @Test
    fun supportedNetworks_rejectUnknownNames() {
        for (name in listOf("vsa", "unknown", "")) {
            val error = assertThrows(IllegalArgumentException::class.java) {
                build(paymentRequest(coffee, supportedNetworks = arrayOf("visa", name)))
            }

            assertEquals(
                "Unknown payment network \"$name\". Use a PaymentNetwork value such as \"visa\" or \"mastercard\"",
                error.message
            )
        }
    }

    @Test
    fun supportedNetworks_rejectAListWithoutAGooglePayNetwork() {
        val empty = assertThrows(IllegalArgumentException::class.java) {
            build(paymentRequest(coffee, supportedNetworks = emptyArray()))
        }
        val iosOnly = assertThrows(IllegalArgumentException::class.java) {
            build(paymentRequest(coffee, supportedNetworks = arrayOf("cartesBancaires", "mada")))
        }

        assertEquals("supportedNetworks needs at least one network", empty.message)
        assertEquals("Google Pay offers none of these networks: cartesBancaires, mada", iosOnly.message)
    }

    @Test
    fun authMethods_canBeRestrictedToCryptogram3ds() {
        val request = build(
            paymentRequest(coffee, googlePayAllowedAuthMethods = arrayOf("cryptogram_3ds"))
        )

        assertEquals(listOf("CRYPTOGRAM_3DS"), request.cardParameters().strings("allowedAuthMethods"))
    }

    @Test
    fun authMethods_keepTheGivenOrderWithoutDuplicates() {
        val parameters = cardParametersOf(null, arrayOf("CRYPTOGRAM_3DS", "PAN_ONLY", "pan_only"))

        assertEquals(listOf("CRYPTOGRAM_3DS", "PAN_ONLY"), parameters.authMethods)
    }

    @Test
    fun authMethods_rejectUnknownAndEmptyLists() {
        val unknown = assertThrows(IllegalArgumentException::class.java) {
            build(paymentRequest(coffee, googlePayAllowedAuthMethods = arrayOf("3DS")))
        }
        val empty = assertThrows(IllegalArgumentException::class.java) {
            build(paymentRequest(coffee, googlePayAllowedAuthMethods = emptyArray()))
        }

        assertEquals(
            "Unknown Google Pay auth method \"3DS\". Use \"PAN_ONLY\" or \"CRYPTOGRAM_3DS\"",
            unknown.message
        )
        assertEquals(
            "Google Pay needs at least one auth method: \"PAN_ONLY\" or \"CRYPTOGRAM_3DS\"",
            empty.message
        )
    }
}
