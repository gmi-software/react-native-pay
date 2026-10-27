import PassKit
import XCTest
@testable import NitroPay

/// Answers `present` the way the test asks, on the queue it names.
private final class FakeSheet: PaymentSheet {
    weak var delegate: PKPaymentAuthorizationControllerDelegate?
    private let presents: Bool
    private let queue: DispatchQueue?
    private(set) var presentCount = 0

    init(presents: Bool, answeringOn queue: DispatchQueue? = nil) {
        self.presents = presents
        self.queue = queue
    }

    func present(completion: (@Sendable (Bool) -> Void)?) {
        presentCount += 1
        let presents = self.presents
        if let queue {
            queue.async { completion?(presents) }
        } else {
            completion?(presents)
        }
    }
}

private final class SheetDelegate: NSObject, PKPaymentAuthorizationControllerDelegate {
    func paymentAuthorizationControllerDidFinish(_ controller: PKPaymentAuthorizationController) {}

    func presentationWindow(for controller: PKPaymentAuthorizationController) -> UIWindow? {
        return nil
    }
}

final class PaymentSheetPresenterTests: XCTestCase {

    private let delegate = SheetDelegate()

    /// What the presenter reported once its work on the main queue has run.
    private func reportedFailure(from presenter: PaymentSheetPresenter) -> PaymentFailure? {
        var failure: PaymentFailure?
        presenter.present(PKPaymentRequest(), delegate: delegate) { failure = $0 }
        let drained = expectation(description: "main queue drained")
        DispatchQueue.main.async { drained.fulfill() }
        wait(for: [drained], timeout: 1)
        return failure
    }

    func testReportsARefusedSheet() {
        let presenter = PaymentSheetPresenter { _ in FakeSheet(presents: false) }

        let failure = reportedFailure(from: presenter)

        XCTAssertEqual(failure?.code, .notAvailable)
        XCTAssertEqual(failure?.message, "Unable to present payment authorization")
    }

    func testReportsNothingForAPresentedSheet() {
        let sheet = FakeSheet(presents: true)
        let presenter = PaymentSheetPresenter { _ in sheet }

        XCTAssertNil(reportedFailure(from: presenter))
        XCTAssertEqual(sheet.presentCount, 1)
        XCTAssertTrue(sheet.delegate === delegate)
    }

    func testReportsARequestPassKitCannotShow() {
        let presenter = PaymentSheetPresenter { _ in nil }

        let failure = reportedFailure(from: presenter)

        XCTAssertEqual(failure?.code, .notAvailable)
        XCTAssertEqual(failure?.message, "Unable to create payment authorization")
    }

    func testReportsARefusalOnTheMainThreadWhenPassKitAnswersOffIt() {
        let presenter = PaymentSheetPresenter { _ in
            FakeSheet(presents: false, answeringOn: .global())
        }
        let reported = expectation(description: "refusal reported")
        var reportedOnMain: Bool?

        presenter.present(PKPaymentRequest(), delegate: delegate) { _ in
            reportedOnMain = Thread.isMainThread
            reported.fulfill()
        }
        wait(for: [reported], timeout: 1)

        XCTAssertEqual(reportedOnMain, true)
    }

    func testHoldsTheSheetUntilReleased() {
        weak var weakSheet: FakeSheet?
        let presenter = PaymentSheetPresenter { _ in
            let sheet = FakeSheet(presents: true)
            weakSheet = sheet
            return sheet
        }

        _ = reportedFailure(from: presenter)
        XCTAssertNotNil(weakSheet)

        presenter.release()
        XCTAssertNil(weakSheet)
    }
}

/// Runs `startPayment` with a sheet PassKit refuses, as in issue #20.
final class RefusedPaymentSheetTests: XCTestCase {

    private func paymentRequest() -> PaymentRequest {
        return PaymentRequest(
            applePayMerchantIdentifier: "merchant.com.example",
            merchantName: "Example",
            countryCode: "US",
            currencyCode: "USD",
            paymentItems: [PaymentItem(label: "Coffee", amount: .second("4.99"), type: .final)],
            merchantCapabilities: ["3DS"],
            supportedNetworks: ["visa"],
            shippingType: nil,
            shippingMethods: nil,
            billingContactRequired: nil,
            shippingContactRequired: nil,
            emailRequired: nil,
            phoneNumberRequired: nil,
            googlePayMerchantId: nil,
            googlePayEnvironment: nil,
            googlePayGateway: nil,
            googlePayGatewayMerchantId: nil,
            googlePayAllowedAuthMethods: nil
        )
    }

    func testSettlesThePaymentAndLetsTheNextOneStart() throws {
        var sheets: [FakeSheet] = []
        let handler = HybridPaymentHandler(sheetPresenter: PaymentSheetPresenter { _ in
            let sheet = FakeSheet(presents: false)
            sheets.append(sheet)
            return sheet
        })

        for attempt in 1...2 {
            let settled = expectation(description: "payment \(attempt) settled")
            var status: PaymentStatus?
            var code: PaymentErrorCode?
            var error: String?
            try handler.startPayment(request: paymentRequest(), options: nil).then { result in
                status = result.status
                code = result.code
                error = result.error
                settled.fulfill()
            }
            wait(for: [settled], timeout: 1)

            XCTAssertEqual(status, .failed)
            XCTAssertEqual(code, .notAvailable)
            XCTAssertEqual(error, "Unable to present payment authorization")
            XCTAssertFalse(try handler.isPaymentInProgress())
        }
        // The second payment reached PassKit instead of "already in progress".
        XCTAssertEqual(sheets.map(\.presentCount), [1, 1])
    }
}
