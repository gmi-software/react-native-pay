import PassKit
import XCTest
@testable import NitroPay

final class PaymentRequestBuilderTests: XCTestCase {

    private func item(_ label: String, _ amount: String, _ type: PaymentItemType = .final) -> PaymentItem {
        return PaymentItem(label: label, amount: .second(amount), type: type)
    }

    private func paymentRequest(
        items: [PaymentItem],
        merchantIdentifier: String? = "merchant.com.example",
        merchantName: String? = nil,
        merchantCapabilities: [String] = ["3DS"],
        supportedNetworks: [String] = ["visa"],
        shippingType: String? = nil,
        billingContactRequired: Bool? = nil,
        shippingContactRequired: Bool? = nil
    ) -> PaymentRequest {
        return PaymentRequest(
            applePayMerchantIdentifier: merchantIdentifier,
            merchantName: merchantName,
            countryCode: "US",
            currencyCode: "USD",
            paymentItems: items,
            merchantCapabilities: merchantCapabilities,
            supportedNetworks: supportedNetworks,
            shippingType: shippingType,
            shippingMethods: nil,
            billingContactRequired: billingContactRequired,
            shippingContactRequired: shippingContactRequired,
            googlePayMerchantId: nil,
            googlePayEnvironment: nil,
            googlePayGateway: nil,
            googlePayGatewayMerchantId: nil
        )
    }

    private func assertBuildFails(
        _ request: PaymentRequest,
        with message: String,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        XCTAssertThrowsError(try PaymentRequestBuilder.build(from: request), file: file, line: line) { error in
            XCTAssertEqual(error.localizedDescription, message, file: file, line: line)
        }
    }

    func testCopiesRequestFields() throws {
        let request = try PaymentRequestBuilder.build(from: paymentRequest(
            items: [item("Coffee", "4.99")],
            merchantIdentifier: "  merchant.com.example\n",
            merchantCapabilities: ["3DS", "Debit"],
            supportedNetworks: ["visa", "amex", "unknown"],
            shippingType: "delivery"
        ))

        XCTAssertEqual(request.merchantIdentifier, "merchant.com.example")
        XCTAssertEqual(request.countryCode, "US")
        XCTAssertEqual(request.currencyCode, "USD")
        XCTAssertEqual(request.merchantCapabilities, [.capability3DS, .capabilityDebit])
        XCTAssertEqual(request.supportedNetworks, [.visa, .amex])
        XCTAssertEqual(request.shippingType, .delivery)
    }

    func testMatchesMerchantCapabilitiesCaseInsensitively() throws {
        let request = try PaymentRequestBuilder.build(from: paymentRequest(
            items: [item("Coffee", "4.99")],
            merchantCapabilities: ["3ds", "CREDIT", "debit"]
        ))

        XCTAssertEqual(request.merchantCapabilities, [.capability3DS, .capabilityCredit, .capabilityDebit])
    }

    func testAddsThreeDSWhenNeither3DSNorEMVIsGiven() throws {
        let cases: [([String], PKMerchantCapability)] = [
            ([], [.capability3DS]),
            (["Credit"], [.capability3DS, .capabilityCredit]),
            (["Credit", "Debit"], [.capability3DS, .capabilityCredit, .capabilityDebit]),
        ]

        for (capabilities, expected) in cases {
            let request = try PaymentRequestBuilder.build(from: paymentRequest(
                items: [item("Coffee", "4.99")],
                merchantCapabilities: capabilities
            ))
            XCTAssertEqual(request.merchantCapabilities, expected, "\(capabilities)")
        }
    }

    func testKeepsEMVWithout3DS() throws {
        // EMV alone is valid for China UnionPay merchants.
        let request = try PaymentRequestBuilder.build(from: paymentRequest(
            items: [item("Coffee", "4.99")],
            merchantCapabilities: ["EMV"]
        ))

        XCTAssertEqual(request.merchantCapabilities, [.capabilityEMV])
    }

    func testRejectsUnknownMerchantCapability() {
        assertBuildFails(
            paymentRequest(items: [item("Coffee", "4.99")], merchantCapabilities: ["3DS", "Unknown"]),
            with: "Unknown merchant capability \"Unknown\". Use \"3DS\", \"EMV\", \"Credit\" or \"Debit\""
        )
    }

    func testRequestsContactFieldsOnlyWhenRequired() throws {
        let optional = try PaymentRequestBuilder.build(from: paymentRequest(items: [item("Coffee", "4.99")]))
        XCTAssertEqual(optional.requiredBillingContactFields, [])
        XCTAssertEqual(optional.requiredShippingContactFields, [])

        let required = try PaymentRequestBuilder.build(from: paymentRequest(
            items: [item("Coffee", "4.99")],
            billingContactRequired: true,
            shippingContactRequired: true
        ))
        XCTAssertEqual(required.requiredBillingContactFields, [.postalAddress, .name])
        XCTAssertEqual(required.requiredShippingContactFields, [.postalAddress, .name])
    }

    func testAppendsAMerchantTotalToASingleItem() throws {
        // PassKit shows the last item as the total, so one item still gets one.
        let request = try PaymentRequestBuilder.build(from: paymentRequest(
            items: [item("Coffee", "4.99")],
            merchantName: "Coffee Shop"
        ))

        let items = request.paymentSummaryItems
        XCTAssertEqual(items.map(\.label), ["Coffee", "Coffee Shop"])
        XCTAssertEqual(items[1].amount, NSDecimalNumber(string: "4.99"))
        XCTAssertEqual(items[1].type, .final)
    }

    func testAppendsAnExactTotalLabelledWithTheMerchant() throws {
        let request = try PaymentRequestBuilder.build(from: paymentRequest(
            items: [
                PaymentItem(label: "Coffee", amount: .first(4.99), type: .final),
                item("Tip", "0.50"),
                item("Discount", "-1.00"),
            ],
            merchantName: "  Coffee Shop "
        ))

        let items = request.paymentSummaryItems
        XCTAssertEqual(items.map(\.label), ["Coffee", "Tip", "Discount", "Coffee Shop"])
        XCTAssertEqual(items[3].amount, NSDecimalNumber(string: "4.49"))
        XCTAssertEqual(items[3].type, .final)
    }

    func testTotalFallsBackToTheAppNameWithoutMerchantName() throws {
        // CFBundleDisplayName, then CFBundleName, then the process name.
        let appName = ["CFBundleDisplayName", "CFBundleName"]
            .compactMap { Bundle.main.object(forInfoDictionaryKey: $0) as? String }
            .first { !$0.isEmpty } ?? ProcessInfo.processInfo.processName

        for merchantName in [nil, " "] {
            let request = try PaymentRequestBuilder.build(from: paymentRequest(
                items: [item("Coffee", "4.99"), item("Tip", "0.50")],
                merchantName: merchantName
            ))

            XCTAssertEqual(request.paymentSummaryItems.last?.label, appName)
        }
    }

    func testTotalIsPendingWhenAnyItemIsPending() throws {
        let request = try PaymentRequestBuilder.build(from: paymentRequest(
            items: [item("Coffee", "4.99"), item("Delivery", "2.00", .pending)]
        ))

        XCTAssertEqual(request.paymentSummaryItems.map(\.type), [.final, .pending, .pending])
    }

    func testRejectsInvalidAmounts() {
        assertBuildFails(
            paymentRequest(items: [item("Coffee", "4.99"), item("Tip", "1,00")]),
            with: "Amount for \"Tip\" must be a finite number or a decimal string like \"19.99\""
        )
    }

    func testRejectsNegativeTotal() {
        assertBuildFails(
            paymentRequest(items: [item("Coffee", "4.99"), item("Discount", "-5.00")]),
            with: "Payment total must not be negative"
        )
    }

    func testRequiresMerchantIdentifier() {
        // The test bundle has no ReactNativePayApplePayMerchantIdentifiers entry to fall back to.
        assertBuildFails(
            paymentRequest(items: [item("Coffee", "4.99")], merchantIdentifier: " "),
            with: "No Apple Pay merchant identifier configured"
        )
    }
}
