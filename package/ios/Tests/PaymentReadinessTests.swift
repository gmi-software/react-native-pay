import XCTest
@testable import NitroPay

// Only `hasActiveCard` paths that fail before PassKit is asked: its answers
// depend on the device and the cards in Wallet.
final class PaymentReadinessTests: XCTestCase {

    func testRejectsNetworksThePaymentWouldRefuse() {
        XCTAssertThrowsError(try PaymentReadiness.hasActiveCard(networks: [], merchantCapabilities: nil)) { error in
            XCTAssertEqual(String(describing: error), "supportedNetworks needs at least one network")
        }
        XCTAssertThrowsError(try PaymentReadiness.hasActiveCard(
            networks: ["VISA", "unknown"],
            merchantCapabilities: ["3DS"]
        )) { error in
            XCTAssertEqual(
                String(describing: error),
                "Unknown payment network \"unknown\". Use a PaymentNetwork value such as \"visa\" or \"mastercard\""
            )
        }
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
