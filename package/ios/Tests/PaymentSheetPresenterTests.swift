import PassKit
import XCTest
@testable import NitroPay

/// Answers `present` the way the test asks, on the queue it names, and
/// signals `answered` once the completion has returned.
private final class FakeSheet: PaymentSheet {
    weak var delegate: PKPaymentAuthorizationControllerDelegate?
    private let presents: Bool
    private let queue: DispatchQueue?
    private let answered: DispatchSemaphore?
    private(set) var presentCount = 0

    init(presents: Bool, answeringOn queue: DispatchQueue? = nil, answered: DispatchSemaphore? = nil) {
        self.presents = presents
        self.queue = queue
        self.answered = answered
    }

    func present(completion: (@Sendable (Bool) -> Void)?) {
        presentCount += 1
        let presents = self.presents
        let answered = self.answered
        if let queue {
            queue.async {
                completion?(presents)
                answered?.signal()
            }
        } else {
            completion?(presents)
            answered?.signal()
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

    /// Whether `onPresented` ran, and on the main thread, once PassKit answered.
    private func presentedOnMain(_ sheet: FakeSheet) -> Bool? {
        let presenter = PaymentSheetPresenter { _ in sheet }
        let answered = expectation(description: "presentation answered")
        var presentedOnMain: Bool?

        presenter.present(
            PKPaymentRequest(),
            delegate: delegate,
            onFailure: { _ in answered.fulfill() },
            onPresented: { _ in
                presentedOnMain = Thread.isMainThread
                answered.fulfill()
            }
        )
        wait(for: [answered], timeout: 1)
        return presentedOnMain
    }

    func testReportsAPresentedSheetOnTheMainThreadWhenPassKitAnswersOffIt() {
        XCTAssertEqual(presentedOnMain(FakeSheet(presents: true, answeringOn: .global())), true)
    }

    func testDoesNotReportARefusedSheetAsPresented() {
        XCTAssertNil(presentedOnMain(FakeSheet(presents: false)))
    }

    func testReadsThePresentationTimeBeforeTheMainThreadIsFree() throws {
        let answered = DispatchSemaphore(value: 0)
        let presenter = PaymentSheetPresenter { _ in
            FakeSheet(presents: true, answeringOn: .global(), answered: answered)
        }
        let presented = expectation(description: "sheet presented")
        var presentedAt: TimeInterval?

        presenter.present(
            PKPaymentRequest(),
            delegate: delegate,
            onFailure: { _ in },
            onPresented: {
                presentedAt = $0
                presented.fulfill()
            }
        )
        // Holds the main thread until PassKit's completion has returned, so
        // the hop to main can only run after this point.
        answered.wait()
        let mainThreadFreed = SheetCloseTiming.uptime()
        wait(for: [presented], timeout: 1)

        XCTAssertLessThanOrEqual(try XCTUnwrap(presentedAt), mainThreadFreed)
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

    private func coffeeRequest() -> PaymentRequest {
        return paymentRequest(items: [item("Coffee", "4.99")], merchantName: "Example")
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
            try handler.startPayment(request: coffeeRequest(), options: nil).then { result in
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
