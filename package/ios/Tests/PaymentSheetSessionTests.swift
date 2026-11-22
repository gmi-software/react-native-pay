import NitroModules
import PassKit
import XCTest
@testable import NitroPay

private struct RejectionError: Error, CustomStringConvertible {
    let description: String
}

/// An `onAuthorize` whose outcome the test settles, one per attempt.
private final class FakeMerchant {
    private(set) var outcomes: [Promise<PaymentAuthorizationResult>] = []

    func onAuthorize(_ token: PaymentToken, _ details: PaymentDetails) -> Promise<Promise<PaymentAuthorizationResult>> {
        let outcome = Promise<PaymentAuthorizationResult>()
        outcomes.append(outcome)
        return Promise.resolved(withResult: outcome)
    }
}

final class PaymentSheetSessionTests: XCTestCase {

    private let merchant = FakeMerchant()
    private var reported: [PaymentResult] = []
    private var completions: [PKPaymentAuthorizationStatus] = []
    private var warnings: [String] = []
    private var clock: TimeInterval = 100

    private let token = PaymentToken(
        paymentMethod: PaymentMethod(
            displayName: "Visa 1234",
            network: .visa,
            type: .credit,
            secureElementPass: nil,
            billingAddress: nil
        ),
        transactionIdentifier: "transaction",
        paymentData: "data"
    )

    private let details = PaymentDetails(
        billingContact: nil,
        shippingContact: nil,
        emailAddress: "payer@example.com",
        phoneNumber: nil,
        shippingMethod: nil
    )

    private let shippingMethods = [
        ShippingMethod(identifier: "standard", label: "Standard", amount: .second("5.00"), detail: nil),
        ShippingMethod(identifier: "express", label: "Express", amount: .second("10.00"), detail: nil),
    ]

    private func paymentRequest(
        amount: String = "4.99",
        shippingMethods: [ShippingMethod]? = nil
    ) -> PaymentRequest {
        return PaymentRequest(
            applePayMerchantIdentifier: "merchant.com.example",
            merchantName: "Example",
            totalLabel: nil,
            countryCode: "US",
            currencyCode: "USD",
            paymentItems: [PaymentItem(label: "Coffee", amount: .second(amount), type: .final, kind: nil)],
            merchantCapabilities: ["3DS"],
            supportedNetworks: ["visa"],
            shippingType: nil,
            shippingMethods: shippingMethods,
            billingContactRequired: nil,
            shippingContactRequired: nil,
            emailRequired: nil,
            phoneNumberRequired: nil,
            recurring: nil,
            deferred: nil,
            automaticReload: nil,
            applePayMultiTokenContexts: nil,
            googlePayMerchantId: nil,
            googlePayEnvironment: nil,
            googlePayGateway: nil,
            googlePayGatewayMerchantId: nil,
            googlePayAllowedAuthMethods: nil
        )
    }

    private func makeSession(
        request: PaymentRequest? = nil,
        builtFrom builtRequest: PaymentRequest? = nil,
        withOnAuthorize: Bool = true,
        onAuthorize: AuthorizeCallback? = nil,
        timeout: TimeInterval = 60
    ) throws -> PaymentSheetSession {
        let request = request ?? paymentRequest()
        let paymentRequest = try PaymentRequestBuilder.build(from: builtRequest ?? request)
        return PaymentSheetSession(
            request: request,
            paymentRequest: paymentRequest,
            onAuthorize: onAuthorize ?? (withOnAuthorize ? merchant.onAuthorize : nil),
            timeout: timeout,
            closeTiming: SheetCloseTiming { self.clock },
            warn: { self.warnings.append($0) },
            report: { self.reported.append($0) }
        )
    }

    private func authorize(_ session: PaymentSheetSession) {
        session.authorize(token: token, details: details) { self.completions.append($0.status) }
    }

    /// Runs what the session queued on the main queue, as Nitro's JS-thread
    /// settlement hops there.
    private func drainMainQueue() {
        let drained = expectation(description: "main queue drained")
        DispatchQueue.main.async { drained.fulfill() }
        wait(for: [drained], timeout: 1)
    }

    private let shortTimeout: TimeInterval = 0.05

    /// Waits past `shortTimeout`, so a session made with it has timed out.
    private func waitPastTheTimeout() {
        let waited = expectation(description: "past the timeout")
        DispatchQueue.main.asyncAfter(deadline: .now() + shortTimeout * 4) { waited.fulfill() }
        wait(for: [waited], timeout: 2)
    }

    private func amounts(_ items: [PKPaymentSummaryItem]) -> [String] {
        return items.map { "\($0.label) \($0.amount.stringValue)" }
    }

    // MARK: - Authorization

    func testSucceedsWithoutOnAuthorize() throws {
        let session = try makeSession(withOnAuthorize: false)

        authorize(session)
        session.sheetDidFinish()

        XCTAssertEqual(completions, [.success])
        XCTAssertEqual(reported.count, 1)
        XCTAssertEqual(reported.first?.status, .success)
        XCTAssertEqual(reported.first?.token?.transactionIdentifier, "transaction")
        XCTAssertEqual(reported.first?.emailAddress, "payer@example.com")
    }

    func testReportsTheMerchantsSuccess() throws {
        let session = try makeSession()

        authorize(session)
        XCTAssertEqual(completions, [])
        merchant.outcomes[0].resolve(withResult: PaymentAuthorizationResult(status: .success, error: nil))
        drainMainQueue()
        session.sheetDidFinish()

        XCTAssertEqual(completions, [.success])
        XCTAssertEqual(reported.first?.status, .success)
        XCTAssertEqual(reported.first?.token?.paymentData, "data")
        XCTAssertEqual(reported.first?.emailAddress, "payer@example.com")
    }

    func testReportsTheMerchantsFailure() throws {
        let session = try makeSession()

        authorize(session)
        merchant.outcomes[0].resolve(withResult: PaymentAuthorizationResult(status: .failure, error: "Card declined"))
        drainMainQueue()
        session.sheetDidFinish()

        XCTAssertEqual(completions, [.failure])
        XCTAssertEqual(reported.first?.status, .failed)
        XCTAssertEqual(reported.first?.code, .providerError)
        XCTAssertEqual(reported.first?.error, "Card declined")
        XCTAssertNil(reported.first?.token)
    }

    func testDescribesAFailureWithoutAMessage() throws {
        let session = try makeSession()

        authorize(session)
        merchant.outcomes[0].resolve(withResult: PaymentAuthorizationResult(status: .failure, error: nil))
        drainMainQueue()
        session.sheetDidFinish()

        XCTAssertEqual(reported.first?.error, "Payment authorization failed")
    }

    func testReportsARejectedOnAuthorize() throws {
        let session = try makeSession(onAuthorize: { _, _ in
            Promise.rejected(withError: RejectionError(description: "Server unreachable"))
        })

        authorize(session)
        drainMainQueue()
        session.sheetDidFinish()

        XCTAssertEqual(completions, [.failure])
        XCTAssertEqual(reported.first?.code, .providerError)
        XCTAssertEqual(reported.first?.error, "Server unreachable")
    }

    func testReportsARejectedOutcome() throws {
        let session = try makeSession()

        authorize(session)
        merchant.outcomes[0].reject(withError: RejectionError(description: "Charge failed"))
        drainMainQueue()
        session.sheetDidFinish()

        XCTAssertEqual(completions, [.failure])
        XCTAssertEqual(reported.first?.code, .providerError)
        XCTAssertEqual(reported.first?.error, "Charge failed")
    }

    // MARK: - Timeout

    func testTimesOutBeforePassKitDoes() throws {
        // PassKit fails the sheet itself after about 30 seconds.
        XCTAssertEqual(authorizationTimeout, 25)
        let session = try makeSession(timeout: shortTimeout)

        authorize(session)
        waitPastTheTimeout()
        session.sheetDidFinish()

        XCTAssertEqual(completions, [.failure])
        XCTAssertEqual(reported.first?.code, .providerError)
        XCTAssertEqual(reported.first?.error, "Payment authorization timed out")
    }

    func testIgnoresAResultAfterTheTimeout() throws {
        let session = try makeSession(timeout: shortTimeout)

        authorize(session)
        waitPastTheTimeout()
        merchant.outcomes[0].resolve(withResult: PaymentAuthorizationResult(status: .success, error: nil))
        drainMainQueue()
        session.sheetDidFinish()

        XCTAssertEqual(completions, [.failure])
        XCTAssertEqual(reported.count, 1)
        XCTAssertEqual(reported.first?.error, "Payment authorization timed out")
    }

    func testIgnoresTheTimeoutAfterAResult() throws {
        let session = try makeSession(timeout: shortTimeout)

        authorize(session)
        merchant.outcomes[0].resolve(withResult: PaymentAuthorizationResult(status: .success, error: nil))
        drainMainQueue()
        waitPastTheTimeout()
        session.sheetDidFinish()

        XCTAssertEqual(completions, [.success])
        XCTAssertEqual(reported.first?.status, .success)
    }

    // MARK: - Sheet closing

    func testCancelsASheetClosedBeforeAuthorization() throws {
        let session = try makeSession()

        session.sheetDidFinish()

        XCTAssertEqual(reported.count, 1)
        XCTAssertEqual(reported.first?.status, .cancelled)
        XCTAssertEqual(reported.first?.code, .cancelled)
        XCTAssertEqual(reported.first?.error, "Payment cancelled by user")
    }

    func testWarnsWhenTheSheetClosesRightAfterAppearing() throws {
        let session = try makeSession()

        session.sheetDidPresent()
        clock += 0.3
        session.sheetWillDismiss()
        session.sheetDidFinish()

        XCTAssertEqual(warnings.count, 1)
        XCTAssertTrue(warnings.first?.contains("closed less than 1 s after it appeared") == true)
        XCTAssertEqual(reported.first?.status, .cancelled)
        XCTAssertEqual(reported.first?.code, .cancelled)
        XCTAssertEqual(reported.first?.error, "Payment cancelled by user")
    }

    func testDoesNotWarnWhenTheUserCancelsLater() throws {
        let session = try makeSession()

        session.sheetDidPresent()
        clock += 2
        session.sheetWillDismiss()
        session.sheetDidFinish()

        XCTAssertEqual(warnings, [])
        XCTAssertEqual(reported.first?.status, .cancelled)
    }

    func testDoesNotWarnAfterAQuickAuthorization() throws {
        let session = try makeSession(withOnAuthorize: false)

        session.sheetDidPresent()
        clock += 0.3
        authorize(session)
        session.sheetWillDismiss()
        session.sheetDidFinish()

        XCTAssertEqual(warnings, [])
        XCTAssertEqual(reported.first?.status, .success)
    }

    func testWaitsForTheMerchantWhenTheSheetClosesWhileAuthorizing() throws {
        let session = try makeSession()

        authorize(session)
        session.sheetDidFinish()
        XCTAssertEqual(reported.count, 0)

        merchant.outcomes[0].resolve(withResult: PaymentAuthorizationResult(status: .success, error: nil))
        drainMainQueue()

        XCTAssertEqual(completions, [.success])
        XCTAssertEqual(reported.count, 1)
        XCTAssertEqual(reported.first?.status, .success)
    }

    func testReportsTheTimeoutWhenTheSheetClosedWhileAuthorizing() throws {
        let session = try makeSession(timeout: shortTimeout)

        authorize(session)
        session.sheetDidFinish()
        waitPastTheTimeout()

        XCTAssertEqual(reported.count, 1)
        XCTAssertEqual(reported.first?.error, "Payment authorization timed out")
    }

    // MARK: - Retry

    func testSucceedsOnASecondAttemptAfterAFailure() throws {
        let session = try makeSession()

        authorize(session)
        merchant.outcomes[0].resolve(withResult: PaymentAuthorizationResult(status: .failure, error: "Card declined"))
        drainMainQueue()

        authorize(session)
        XCTAssertEqual(completions, [.failure])

        merchant.outcomes[1].resolve(withResult: PaymentAuthorizationResult(status: .success, error: nil))
        drainMainQueue()
        session.sheetDidFinish()

        XCTAssertEqual(completions, [.failure, .success])
        XCTAssertEqual(reported.count, 1)
        XCTAssertEqual(reported.first?.status, .success)
    }

    func testReportsTheLastAttemptsFailure() throws {
        let session = try makeSession()

        authorize(session)
        merchant.outcomes[0].resolve(withResult: PaymentAuthorizationResult(status: .failure, error: "Card declined"))
        drainMainQueue()
        // The payer closes the sheet instead of retrying.
        session.sheetDidFinish()

        XCTAssertEqual(reported.count, 1)
        XCTAssertEqual(reported.first?.code, .providerError)
        XCTAssertEqual(reported.first?.error, "Card declined")
    }

    // MARK: - Shipping method

    func testRebuildsTheSummaryForTheSelectedShippingMethod() throws {
        let session = try makeSession(request: paymentRequest(shippingMethods: shippingMethods))

        let items = session.selectShippingMethod("express")

        XCTAssertEqual(amounts(items), ["Coffee 4.99", "Express 10", "Example 14.99"])
    }

    func testKeepsTheSummaryWhenItCannotBeRebuilt() throws {
        // Built from a valid request, so only the rebuild fails.
        let session = try makeSession(
            request: paymentRequest(amount: "not a number", shippingMethods: shippingMethods),
            builtFrom: paymentRequest(shippingMethods: shippingMethods)
        )

        let items = session.selectShippingMethod("express")

        XCTAssertEqual(amounts(items), ["Coffee 4.99", "Standard 5", "Example 9.99"])
    }

    func testAuthorizesWithTheSelectedShippingMethod() throws {
        let session = try makeSession(request: paymentRequest(shippingMethods: shippingMethods))

        // PassKit selects the first method when the sheet opens.
        XCTAssertEqual(session.shippingMethod(authorizedWith: nil)?.identifier, "standard")

        _ = session.selectShippingMethod("express")
        XCTAssertEqual(session.shippingMethod(authorizedWith: nil)?.identifier, "express")
        // The method on the payment wins over the last one selected.
        XCTAssertEqual(session.shippingMethod(authorizedWith: "standard")?.identifier, "standard")
    }
}
