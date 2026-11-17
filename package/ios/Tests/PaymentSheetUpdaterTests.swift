import Contacts
import NitroModules
import PassKit
import XCTest
@testable import NitroPay

private final class FakePaymentMethod: PKPaymentMethod {
    override var network: PKPaymentNetwork? { .visa }
    override var type: PKPaymentMethodType { .credit }
    override var displayName: String? { "Visa 1234" }
}

final class PaymentSheetUpdaterTests: XCTestCase {

    private let standard = shippingMethod("standard", "Standard", "0.00")
    private let express = shippingMethod("express", "Express", "7.50")
    private let pickup = shippingMethod("pickup", "Pickup", "2.00")

    private func updater(
        items: [PaymentItem] = [item("Kit", "10.00")],
        shippingMethods: [ShippingMethod]? = nil,
        multiTokenContexts: [PaymentTokenContext]? = nil,
        couponCode: String? = nil,
        callbacks: PaymentSheetCallbacks = PaymentSheetCallbacks(),
        timeout: TimeInterval = 1
    ) throws -> PaymentSheetUpdater {
        let request = paymentRequest(
            items: items,
            merchantName: "Shop",
            shippingMethods: shippingMethods ?? [standard, express],
            multiTokenContexts: multiTokenContexts,
            couponCode: couponCode
        )
        let paymentRequest = try PaymentRequestBuilder.build(from: request)
        try PaymentRequestBuilder.configureCouponCode(
            paymentRequest,
            couponCode: couponCode,
            hasCallback: callbacks.onCouponCodeChange != nil
        )
        return PaymentSheetUpdater(
            request: request,
            paymentRequest: paymentRequest,
            callbacks: callbacks,
            timeout: timeout
        )
    }

    /// A callback that resolves with `update` and records what it was called with.
    private func answering<Value>(
        _ update: PaymentSheetUpdate,
        record: ((Value, PaymentSheetSelection) -> Void)? = nil
    ) -> SheetCallback<Value> {
        return { value, selection in
            record?(value, selection)
            return .resolved(withResult: .resolved(withResult: update))
        }
    }

    private func update(
        items: [PaymentItem]? = nil,
        shippingMethods: [ShippingMethod]? = nil,
        error: PaymentSheetError? = nil
    ) -> PaymentSheetUpdate {
        return PaymentSheetUpdate(paymentItems: items, shippingMethods: shippingMethods, error: error)
    }

    private func contact(country: String?, state: String? = nil) -> PKContact {
        let address = CNMutablePostalAddress()
        address.isoCountryCode = country ?? ""
        address.state = state ?? ""
        let contact = PKContact()
        contact.postalAddress = address
        return contact
    }

    private func pkShippingMethod(_ identifier: String) -> PKShippingMethod {
        let method = PKShippingMethod(label: identifier, amount: .zero)
        method.identifier = identifier
        return method
    }

    /// What a change completed with, once PassKit's completion ran.
    private func completed<Update>(_ change: (@escaping (Update) -> Void) -> Void) -> Update {
        let done = expectation(description: "completed")
        var result: Update?
        change {
            result = $0
            done.fulfill()
        }
        wait(for: [done], timeout: 2)
        return result!
    }

    private func summary(_ items: [PKPaymentSummaryItem]) -> [String] {
        return items.map { "\($0.label) \($0.amount)" }
    }

    // MARK: Without callbacks

    func testCompletesAtOnceWithoutACallback() throws {
        let sheet = try updater()
        var update: PKPaymentRequestPaymentMethodUpdate?

        sheet.paymentMethodChanged(to: FakePaymentMethod()) { update = $0 }

        XCTAssertEqual(summary(try XCTUnwrap(update).paymentSummaryItems), ["Kit 10", "Standard 0", "Shop 10"])
        XCTAssertEqual(update?.errors.count, 0)
    }

    func testAddsTheShippingMethodToTheCurrentItems() throws {
        let sheet = try updater(callbacks: PaymentSheetCallbacks(
            onCouponCodeChange: answering(update(items: [item("Kit", "10.00"), item("SAVE10", "-1.00")]))
        ))
        _ = completed { sheet.couponCodeChanged(to: "SAVE10", completion: $0) }

        let update = completed { sheet.shippingMethodChanged(to: pkShippingMethod("express"), completion: $0) }

        XCTAssertEqual(summary(update.paymentSummaryItems), ["Kit 10", "SAVE10 -1", "Express 7.5", "Shop 16.5"])
        XCTAssertEqual(sheet.selectedShippingMethod?.identifier, "express")
    }

    func testSkipsTheCallbackForAContactWithoutACountry() throws {
        var called = false
        let sheet = try updater(callbacks: PaymentSheetCallbacks(
            onShippingAddressChange: answering(update()) { _, _ in called = true }
        ))
        var update: PKPaymentRequestShippingContactUpdate?

        sheet.shippingAddressChanged(to: contact(country: nil)) { update = $0 }

        XCTAssertFalse(called)
        XCTAssertEqual(summary(try XCTUnwrap(update).paymentSummaryItems), ["Kit 10", "Standard 0", "Shop 10"])
    }

    // MARK: Callbacks

    func testPassesTheSelectionSoFar() throws {
        var received: (PaymentSheetAddress, PaymentSheetSelection)?
        let sheet = try updater(callbacks: PaymentSheetCallbacks(
            onShippingAddressChange: answering(update()) { received = ($0, $1) },
            onCouponCodeChange: answering(update())
        ))
        sheet.paymentMethodChanged(to: FakePaymentMethod()) { _ in }
        _ = completed { sheet.couponCodeChanged(to: "SAVE10", completion: $0) }

        _ = completed { sheet.shippingAddressChanged(to: contact(country: "us", state: "CA"), completion: $0) }

        let (address, selection) = try XCTUnwrap(received)
        XCTAssertEqual(address.countryCode, "US")
        XCTAssertEqual(address.administrativeArea, "CA")
        XCTAssertNil(address.locality)
        XCTAssertEqual(selection.shippingAddress?.countryCode, "US")
        XCTAssertEqual(selection.shippingMethod?.identifier, "standard")
        XCTAssertEqual(selection.card?.network, .visa)
        XCTAssertEqual(selection.card?.type, .credit)
        XCTAssertEqual(selection.card?.displayName, "Visa 1234")
        XCTAssertEqual(selection.couponCode, "SAVE10")
    }

    func testAppliesTheItemsAndShowsTheError() throws {
        let sheet = try updater(callbacks: PaymentSheetCallbacks(
            onShippingAddressChange: answering(update(
                items: [item("Kit", "10.00"), item("Tax", "0.80")],
                error: PaymentSheetError(code: .shippingaddressunserviceable, message: "We don't ship to Alaska")
            ))
        ))

        let update = completed { sheet.shippingAddressChanged(to: contact(country: "US", state: "AK"), completion: $0) }

        XCTAssertEqual(summary(update.paymentSummaryItems), ["Kit 10", "Tax 0.8", "Standard 0", "Shop 10.8"])
        let error = try XCTUnwrap(update.errors.first as NSError?)
        XCTAssertEqual(error.domain, PKPaymentErrorDomain)
        XCTAssertEqual(error.code, PKPaymentError.Code.shippingAddressUnserviceableError.rawValue)
        XCTAssertEqual(error.localizedDescription, "We don't ship to Alaska")
        XCTAssertEqual(update.shippingMethods.count, 0)
    }

    func testAcceptsACouponCodeOnlyWithoutAnError() throws {
        var received: [String?] = []
        let sheet = try updater(couponCode: "WELCOME", callbacks: PaymentSheetCallbacks(
            onCouponCodeChange: { code, selection in
                received.append(selection.couponCode)
                let error = code == "OLD"
                    ? PaymentSheetError(code: .couponcodeexpired, message: "Expired")
                    : nil
                return .resolved(withResult: .resolved(withResult: self.update(error: error)))
            }
        ))
        XCTAssertEqual(sheet.selection.couponCode, "WELCOME")

        let refused = completed { sheet.couponCodeChanged(to: "OLD", completion: $0) }
        XCTAssertEqual((refused.errors.first as NSError?)?.code, PKPaymentError.Code.couponCodeExpiredError.rawValue)
        XCTAssertEqual(sheet.selection.couponCode, "WELCOME")

        _ = completed { sheet.couponCodeChanged(to: "", completion: $0) }
        XCTAssertNil(sheet.selection.couponCode)
        // The callback sees the code it checks.
        XCTAssertEqual(received, ["OLD", nil])
    }

    func testKeepsTheItemsWhenTheCallbackRejects() throws {
        let sheet = try updater(callbacks: PaymentSheetCallbacks(
            onCouponCodeChange: { _, _ in .rejected(withError: RuntimeError.error(withMessage: "offline")) }
        ))

        let update = completed { sheet.couponCodeChanged(to: "SAVE10", completion: $0) }

        XCTAssertEqual(summary(update.paymentSummaryItems), ["Kit 10", "Standard 0", "Shop 10"])
        XCTAssertEqual(update.errors.count, 0)
        XCTAssertNil(sheet.selection.couponCode)
    }

    func testKeepsTheItemsForAnUpdateItCannotApply() throws {
        let sheet = try updater(callbacks: PaymentSheetCallbacks(
            onShippingAddressChange: answering(update(items: [item("Refund", "-20.00")]))
        ))

        let update = completed { sheet.shippingAddressChanged(to: contact(country: "US"), completion: $0) }

        XCTAssertEqual(summary(update.paymentSummaryItems), ["Kit 10", "Standard 0", "Shop 10"])
        XCTAssertEqual(update.errors.count, 0)
    }

    func testKeepsTheItemsAfterATimeoutAndIgnoresTheLateAnswer() throws {
        let late = Promise<PaymentSheetUpdate>()
        let sheet = try updater(
            callbacks: PaymentSheetCallbacks(onPaymentMethodChange: { _, _ in .resolved(withResult: late) }),
            timeout: 0.05
        )

        let update = completed { sheet.paymentMethodChanged(to: FakePaymentMethod(), completion: $0) }
        XCTAssertEqual(summary(update.paymentSummaryItems), ["Kit 10", "Standard 0", "Shop 10"])

        late.resolve(withResult: self.update(items: [item("Surcharge", "5.00")]))
        let drained = expectation(description: "main queue drained")
        DispatchQueue.main.async { drained.fulfill() }
        wait(for: [drained], timeout: 1)
        XCTAssertEqual(summary(sheet.summaryItems), ["Kit 10", "Standard 0", "Shop 10"])
    }

    // MARK: Several merchants

    /// Kit 10 + Courier 5, split between two merchants.
    private func multiMerchantUpdater(_ callbacks: PaymentSheetCallbacks) throws -> PaymentSheetUpdater {
        let contexts = [("Shop", "12.00"), ("Courier", "3.00")].map { name, amount in
            PaymentTokenContext(
                merchantIdentifier: "merchant.com.example.\(name.lowercased())",
                externalIdentifier: name.lowercased(),
                merchantName: name,
                merchantDomain: nil,
                amount: .second(amount)
            )
        }
        return try updater(
            shippingMethods: [shippingMethod("courier", "Courier", "5.00"), shippingMethod("locker", "Locker", "5.00")],
            multiTokenContexts: contexts,
            callbacks: callbacks
        )
    }

    func testKeepsTheTotalOfSeveralMerchants() throws {
        guard #available(iOS 16.0, *) else { throw XCTSkip("multiTokenContexts need iOS 16") }
        let sheet = try multiMerchantUpdater(PaymentSheetCallbacks(
            onShippingAddressChange: answering(update(items: [item("Kit", "8.00")])),
            onPaymentMethodChange: answering(update(shippingMethods: [shippingMethod("express", "Express", "9.00")])),
            onCouponCodeChange: answering(update(
                items: [item("Kit", "12.00"), item("SAVE2", "-2.00")],
                shippingMethods: [shippingMethod("van", "Van", "5.00")]
            ))
        ))
        let initial = ["Kit 10", "Courier 5", "Shop 15"]

        // A lower total and a pricier method would break the contexts.
        let address = completed { sheet.shippingAddressChanged(to: contact(country: "US"), completion: $0) }
        XCTAssertEqual(summary(address.paymentSummaryItems), initial)
        let card = completed { sheet.paymentMethodChanged(to: FakePaymentMethod(), completion: $0) }
        XCTAssertEqual(summary(card.paymentSummaryItems), initial)
        XCTAssertEqual(card.shippingMethods.count, 0)

        // The same total with other items and methods applies.
        let coupon = completed { sheet.couponCodeChanged(to: "SAVE2", completion: $0) }
        XCTAssertEqual(summary(coupon.paymentSummaryItems), ["Kit 12", "SAVE2 -2", "Van 5", "Shop 15"])
        XCTAssertEqual(coupon.shippingMethods.map(\.identifier), ["van"])
    }

    // MARK: Shipping methods

    func testKeepsTheSelectedMethodFirstInANewList() throws {
        let sheet = try updater(callbacks: PaymentSheetCallbacks(
            onShippingAddressChange: answering(update(shippingMethods: [standard, express, pickup]))
        ))
        sheet.shippingMethodChanged(to: pkShippingMethod("express")) { _ in }

        let update = completed { sheet.shippingAddressChanged(to: contact(country: "US"), completion: $0) }

        XCTAssertEqual(update.shippingMethods.map(\.identifier), ["express", "standard", "pickup"])
        XCTAssertEqual(summary(update.paymentSummaryItems), ["Kit 10", "Express 7.5", "Shop 17.5"])
    }

    func testSelectsTheFirstMethodWhenTheSelectedOneIsGone() throws {
        let sheet = try updater(callbacks: PaymentSheetCallbacks(
            onShippingAddressChange: answering(update(shippingMethods: [pickup, express]))
        ))

        let update = completed { sheet.shippingAddressChanged(to: contact(country: "US"), completion: $0) }

        XCTAssertEqual(update.shippingMethods.map(\.identifier), ["pickup", "express"])
        XCTAssertEqual(summary(update.paymentSummaryItems), ["Kit 10", "Pickup 2", "Shop 12"])
        XCTAssertEqual(sheet.selectedShippingMethod?.identifier, "pickup")
    }

    func testIgnoresAnEmptyMethodList() throws {
        let sheet = try updater(callbacks: PaymentSheetCallbacks(
            onShippingAddressChange: answering(update(items: [item("Kit", "12.00")], shippingMethods: []))
        ))

        let update = completed { sheet.shippingAddressChanged(to: contact(country: "US"), completion: $0) }

        XCTAssertEqual(summary(update.paymentSummaryItems), ["Kit 10", "Standard 0", "Shop 10"])
        XCTAssertEqual(sheet.selectedShippingMethod?.identifier, "standard")
    }

    func testShippingMethodCallbackGetsTheNewMethod() throws {
        var received: (ShippingMethod, PaymentSheetSelection)?
        let sheet = try updater(callbacks: PaymentSheetCallbacks(
            onShippingMethodChange: answering(update(items: [item("Kit", "10.00"), item("Insurance", "1.00")])) {
                received = ($0, $1)
            }
        ))

        let update = completed { sheet.shippingMethodChanged(to: pkShippingMethod("express"), completion: $0) }

        XCTAssertEqual(received?.0.identifier, "express")
        XCTAssertEqual(received?.1.shippingMethod?.identifier, "express")
        XCTAssertEqual(summary(update.paymentSummaryItems), ["Kit 10", "Insurance 1", "Express 7.5", "Shop 18.5"])
    }

    // MARK: Coupon field and errors

    func testShowsTheCouponFieldOnlyWithACallback() throws {
        let request = PKPaymentRequest()
        try PaymentRequestBuilder.configureCouponCode(request, couponCode: "WELCOME", hasCallback: true)
        XCTAssertTrue(request.supportsCouponCode)
        XCTAssertEqual(request.couponCode, "WELCOME")

        let withoutCallback = PKPaymentRequest()
        try PaymentRequestBuilder.configureCouponCode(withoutCallback, couponCode: nil, hasCallback: false)
        XCTAssertFalse(withoutCallback.supportsCouponCode)

        XCTAssertThrowsError(
            try PaymentRequestBuilder.configureCouponCode(PKPaymentRequest(), couponCode: "WELCOME", hasCallback: false)
        ) { error in
            XCTAssertEqual((error as? PaymentFailure)?.code, .configuration)
        }
    }

    func testAsksPassKitForTheChangesOnlyWithSheetCallbacks() {
        let shippingMethod = #selector(PaymentDelegate.paymentAuthorizationController(_:didSelectShippingMethod:handler:))
        for selector in PaymentDelegate.sheetChangeSelectors {
            XCTAssertFalse(PaymentDelegate.responds(to: selector, hasSheetCallbacks: false))
            XCTAssertTrue(PaymentDelegate.responds(to: selector, hasSheetCallbacks: true))
        }
        XCTAssertEqual(PaymentDelegate.sheetChangeSelectors.count, 3)
        XCTAssertTrue(PaymentDelegate.responds(to: shippingMethod, hasSheetCallbacks: false))
        XCTAssertTrue(PaymentSheetCallbacks().isEmpty)
        XCTAssertFalse(PaymentSheetCallbacks(onCouponCodeChange: answering(update())).isEmpty)
    }

    func testTreatsAnEmptyCouponCodeAsNone() throws {
        let request = PKPaymentRequest()
        try PaymentRequestBuilder.configureCouponCode(request, couponCode: "", hasCallback: false)
        XCTAssertFalse(request.supportsCouponCode)
    }

    func testConvertsEachErrorCode() {
        let cases: [(PaymentSheetErrorCode, PKPaymentError.Code)] = [
            (.shippingaddressinvalid, .shippingContactInvalidError),
            (.shippingaddressunserviceable, .shippingAddressUnserviceableError),
            (.couponcodeinvalid, .couponCodeInvalidError),
            (.couponcodeexpired, .couponCodeExpiredError),
            (.other, .unknownError),
        ]
        for (code, expected) in cases {
            let error = PaymentSheetUpdater.convert(PaymentSheetError(code: code, message: "Message")) as NSError
            XCTAssertEqual(error.domain, PKPaymentErrorDomain)
            XCTAssertEqual(error.code, expected.rawValue, "\(code)")
            XCTAssertEqual(error.localizedDescription, "Message")
        }
        let invalid = PaymentSheetUpdater.convert(PaymentSheetError(code: .shippingaddressinvalid, message: "Message")) as NSError
        XCTAssertEqual(invalid.userInfo[PKPaymentErrorKey.contactFieldUserInfoKey.rawValue] as? PKContactField, .postalAddress)
    }
}
