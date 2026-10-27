import XCTest
@testable import NitroPay

final class PaymentFailureTests: XCTestCase {

    private let codes: [PaymentErrorCode] = [
        .cancelled, .inProgress, .configuration, .notAvailable, .providerError, .unknown,
    ]

    func testReportsACancelAsCancelled() {
        XCTAssertEqual(PaymentFailure(code: .cancelled, message: "").status, .cancelled)
    }

    func testReportsEveryOtherCodeAsFailed() {
        for code in codes where code != .cancelled {
            XCTAssertEqual(PaymentFailure(code: code, message: "").status, .failed, code.stringValue)
        }
    }

    func testConfigurationFailureKeepsItsMessage() {
        let failure = PaymentFailure.configuration("No Apple Pay merchant identifier configured")

        XCTAssertEqual(failure.code, .configuration)
        XCTAssertEqual(failure.localizedDescription, "No Apple Pay merchant identifier configured")
    }
}
