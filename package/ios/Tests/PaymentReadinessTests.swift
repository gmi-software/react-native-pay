import XCTest
@testable import NitroPay

// Only `hasActiveCard` paths that return before PassKit is asked: its answers
// depend on the device and the cards in Wallet.
final class PaymentReadinessTests: XCTestCase {

    func testNoCardWithoutARecognisedNetwork() throws {
        XCTAssertFalse(try PaymentReadiness.hasActiveCard(networks: [], merchantCapabilities: nil))
        XCTAssertFalse(try PaymentReadiness.hasActiveCard(
            networks: ["unknown", "VISA"],
            merchantCapabilities: ["3DS"]
        ))
    }

    func testRejectsUnknownMerchantCapability() {
        XCTAssertThrowsError(try PaymentReadiness.hasActiveCard(
            networks: ["visa"],
            merchantCapabilities: ["3ds2"]
        )) { error in
            let message = "Unknown merchant capability \"3ds2\". Use \"3DS\", \"EMV\", \"Credit\" or \"Debit\""
            XCTAssertEqual(error.localizedDescription, message)
            // What a rejected JS promise carries.
            XCTAssertEqual(String(describing: error), message)
        }
    }
}
