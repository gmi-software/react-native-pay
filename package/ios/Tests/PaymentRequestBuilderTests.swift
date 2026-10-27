import PassKit
import XCTest
@testable import NitroPay

final class PaymentRequestBuilderTests: XCTestCase {

    private func item(_ label: String, _ amount: String, _ type: PaymentItemType = .final) -> PaymentItem {
        return PaymentItem(label: label, amount: .second(amount), type: type)
    }

    private func method(
        _ identifier: String,
        _ label: String,
        _ amount: String,
        detail: String? = nil
    ) -> ShippingMethod {
        return ShippingMethod(identifier: identifier, label: label, amount: .second(amount), detail: detail)
    }

    private func paymentRequest(
        items: [PaymentItem],
        merchantIdentifier: String? = "merchant.com.example",
        merchantName: String? = nil,
        merchantCapabilities: [String] = ["3DS"],
        supportedNetworks: [String] = ["visa"],
        shippingType: String? = nil,
        shippingMethods: [ShippingMethod]? = nil,
        billingContactRequired: Bool? = nil,
        shippingContactRequired: Bool? = nil,
        emailRequired: Bool? = nil,
        phoneNumberRequired: Bool? = nil
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
            shippingMethods: shippingMethods,
            billingContactRequired: billingContactRequired,
            shippingContactRequired: shippingContactRequired,
            emailRequired: emailRequired,
            phoneNumberRequired: phoneNumberRequired,
            googlePayMerchantId: nil,
            googlePayEnvironment: nil,
            googlePayGateway: nil,
            googlePayGatewayMerchantId: nil,
            googlePayAllowedAuthMethods: nil
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
            XCTAssertEqual((error as? PaymentFailure)?.code, .configuration, file: file, line: line)
        }
    }

    func testCopiesRequestFields() throws {
        let request = try PaymentRequestBuilder.build(from: paymentRequest(
            items: [item("Coffee", "4.99")],
            merchantIdentifier: "  merchant.com.example\n",
            merchantCapabilities: ["3DS", "Debit"],
            supportedNetworks: ["visa", "amex"],
            shippingType: "delivery"
        ))

        XCTAssertEqual(request.merchantIdentifier, "merchant.com.example")
        XCTAssertEqual(request.countryCode, "US")
        XCTAssertEqual(request.currencyCode, "USD")
        XCTAssertEqual(request.merchantCapabilities, [.capability3DS, .capabilityDebit])
        XCTAssertEqual(request.supportedNetworks, [.visa, .amex])
        XCTAssertEqual(request.shippingType, .delivery)
    }

    func testMatchesNetworksCaseInsensitivelyWithoutDuplicates() throws {
        let request = try PaymentRequestBuilder.build(from: paymentRequest(
            items: [item("Coffee", "4.99")],
            supportedNetworks: ["VISA", "MasterCard", "cartesBancaires", "visa"]
        ))

        XCTAssertEqual(request.supportedNetworks, [.visa, .masterCard, .cartesBancaires])
    }

    func testRejectsUnknownNetworks() {
        for name in ["vsa", "unknown", ""] {
            assertBuildFails(
                paymentRequest(items: [item("Coffee", "4.99")], supportedNetworks: ["visa", name]),
                with: "Unknown payment network \"\(name)\". Use a PaymentNetwork value such as \"visa\" or \"mastercard\""
            )
        }
    }

    func testRejectsAnEmptyNetworkList() {
        assertBuildFails(
            paymentRequest(items: [item("Coffee", "4.99")], supportedNetworks: []),
            with: "supportedNetworks needs at least one network"
        )
    }

    func testLeavesOutNetworksThisIOSVersionLacks() throws {
        let names = ["visa", "myDebit"]
        if #available(iOS 26.0, *) {
            let request = try PaymentRequestBuilder.build(from: paymentRequest(
                items: [item("Coffee", "4.99")],
                supportedNetworks: names
            ))
            XCTAssertEqual(request.supportedNetworks, [.visa, .myDebit])
        } else {
            XCTAssertEqual(try PaymentRequestBuilder.convertNetworks(names), [.visa])
            assertBuildFails(
                paymentRequest(items: [item("Coffee", "4.99")], supportedNetworks: ["myDebit"]),
                with: "Apple Pay on this iOS version offers none of these networks: myDebit"
            )
        }
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

    func testRequestsEmailAndPhoneWithTheShippingContact() throws {
        // Apple Pay returns email and phone only with the shipping contact.
        let withoutAddress = try PaymentRequestBuilder.build(from: paymentRequest(
            items: [item("Coffee", "4.99")],
            billingContactRequired: true,
            emailRequired: true,
            phoneNumberRequired: true
        ))
        XCTAssertEqual(withoutAddress.requiredBillingContactFields, [.postalAddress, .name])
        XCTAssertEqual(withoutAddress.requiredShippingContactFields, [.emailAddress, .phoneNumber])

        let withAddress = try PaymentRequestBuilder.build(from: paymentRequest(
            items: [item("Coffee", "4.99")],
            shippingContactRequired: true,
            emailRequired: true
        ))
        XCTAssertEqual(withAddress.requiredBillingContactFields, [])
        XCTAssertEqual(withAddress.requiredShippingContactFields, [.postalAddress, .name, .emailAddress])
    }

    // MARK: Shipping methods

    private let shippingMethods = [
        ShippingMethod(identifier: "standard", label: "Standard", amount: .second("0.00"), detail: "3-5 days"),
        ShippingMethod(identifier: "express", label: "Express", amount: .second("7.50"), detail: nil),
    ]

    private func summary(_ items: [PKPaymentSummaryItem]) -> [String] {
        return items.map { "\($0.label) \($0.amount)" }
    }

    func testBuildsShippingMethodsAndSelectsTheFirst() throws {
        let request = try PaymentRequestBuilder.build(from: paymentRequest(
            items: [item("Coffee", "18.00")],
            merchantName: "Coffee Shop",
            shippingMethods: shippingMethods
        ))

        let methods = try XCTUnwrap(request.shippingMethods)
        XCTAssertEqual(methods.map(\.identifier), ["standard", "express"])
        XCTAssertEqual(methods.map(\.label), ["Standard", "Express"])
        XCTAssertEqual(methods.map(\.detail), ["3-5 days", nil])
        XCTAssertEqual(methods.map(\.amount), [NSDecimalNumber(string: "0.00"), NSDecimalNumber(string: "7.50")])
        XCTAssertEqual(summary(request.paymentSummaryItems), ["Coffee 18", "Standard 0", "Coffee Shop 18"])
    }

    func testSummaryIncludesTheSelectedShippingMethod() throws {
        let items = try PaymentRequestBuilder.buildSummaryItems(
            for: paymentRequest(
                items: [item("Coffee", "18.00"), item("Tax", "1.44")],
                merchantName: "Coffee Shop",
                shippingMethods: shippingMethods
            ),
            selectedShippingMethodIdentifier: "express"
        )

        XCTAssertEqual(summary(items), ["Coffee 18", "Tax 1.44", "Express 7.5", "Coffee Shop 26.94"])
        XCTAssertTrue(items[2] is PKShippingMethod)
        XCTAssertEqual(items.last?.type, .final)
    }

    func testSummaryHasNoShippingLineWithoutASelectedMethod() throws {
        let request = paymentRequest(
            items: [item("Coffee", "18.00")],
            merchantName: "Coffee Shop",
            shippingMethods: shippingMethods
        )

        for identifier in [nil, "unknown"] {
            let items = try PaymentRequestBuilder.buildSummaryItems(
                for: request,
                selectedShippingMethodIdentifier: identifier
            )
            XCTAssertEqual(summary(items), ["Coffee 18", "Coffee Shop 18"])
        }
    }

    func testIgnoresAnEmptyShippingMethodList() throws {
        let request = try PaymentRequestBuilder.build(from: paymentRequest(
            items: [item("Coffee", "18.00")],
            merchantName: "Coffee Shop",
            shippingMethods: []
        ))

        XCTAssertNil(request.shippingMethods)
        XCTAssertEqual(summary(request.paymentSummaryItems), ["Coffee 18", "Coffee Shop 18"])
    }

    func testRejectsInvalidShippingMethods() {
        let coffee = [item("Coffee", "18.00")]
        assertBuildFails(
            paymentRequest(items: coffee, shippingMethods: [method(" ", "Standard", "0")]),
            with: "Shipping method \"Standard\" needs an identifier"
        )
        assertBuildFails(
            paymentRequest(items: coffee, shippingMethods: [
                method("express", "Express", "7.50"),
                method("express", "Express (again)", "9.00"),
            ]),
            with: "Shipping method identifier \"express\" is used more than once"
        )
        assertBuildFails(
            paymentRequest(items: coffee, shippingMethods: [method("pickup", "Pickup", "-1.00")]),
            with: "Amount for \"Pickup\" must not be negative"
        )
        assertBuildFails(
            paymentRequest(items: coffee, shippingMethods: [method("express", "Express", "7,50")]),
            with: "Amount for \"Express\" must be a finite number or a decimal string like \"19.99\""
        )
    }

    func testRejectsANegativeItemTotalEvenWhenShippingCoversIt() {
        // Otherwise picking the free method in the sheet would make the total negative.
        assertBuildFails(
            paymentRequest(
                items: [item("Coffee", "4.99"), item("Discount", "-10.00")],
                shippingMethods: [method("express", "Express", "6.00"), method("standard", "Standard", "0")]
            ),
            with: "Payment total must not be negative"
        )
    }

    func testRejectsUnknownShippingType() {
        assertBuildFails(
            paymentRequest(items: [item("Coffee", "4.99")], shippingType: "pickup"),
            with: "Unknown shipping type \"pickup\". Use \"shipping\", \"delivery\", \"storePickup\" or \"servicePickup\""
        )
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
