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
        PaymentItem(label = label, amount = amount, type = type)

    private fun paymentRequest(
        items: Array<PaymentItem>,
        merchantName: String? = null,
        environment: GooglePayEnvironment? = null,
        googlePayMerchantId: String? = null,
        googlePayGateway: String? = null,
        googlePayGatewayMerchantId: String? = null
    ) = PaymentRequest(
        applePayMerchantIdentifier = null,
        merchantName = merchantName,
        countryCode = "US",
        currencyCode = "USD",
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
