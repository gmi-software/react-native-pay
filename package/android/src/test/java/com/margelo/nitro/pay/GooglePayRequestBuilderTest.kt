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
        googlePayGatewayMerchantId: String? = null
    ) = PaymentRequest(
        applePayMerchantIdentifier = null,
        merchantName = merchantName,
        countryCode = "US",
        currencyCode = currencyCode,
        paymentItems = items,
        merchantCapabilities = arrayOf("3DS"),
        supportedNetworks = arrayOf("visa"),
        shippingType = null,
        shippingMethods = null,
        billingContactRequired = null,
        shippingContactRequired = null,
        googlePayMerchantId = googlePayMerchantId,
        googlePayEnvironment = environment,
        googlePayGateway = googlePayGateway,
        googlePayGatewayMerchantId = googlePayGatewayMerchantId
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
}
