import XCTest
@testable import NitroPay

final class PaymentAmountDecimalTests: XCTestCase {

    func testReadsDecimalStringsExactly() {
        XCTAssertEqual(PaymentAmount.second("19.99").decimalNumber, NSDecimalNumber(string: "19.99"))
        XCTAssertEqual(PaymentAmount.second("-5.00").decimalNumber, NSDecimalNumber(string: "-5"))
        XCTAssertEqual(PaymentAmount.second("1500").decimalNumber, NSDecimalNumber(string: "1500"))
    }

    func testReadsNumbersThroughTheirShortestDecimalForm() {
        // Decimal(19.99) would be 19.98999999999999488.
        XCTAssertEqual(PaymentAmount.first(19.99).decimalNumber, NSDecimalNumber(string: "19.99"))
        XCTAssertEqual(PaymentAmount.first(1.0e7).decimalNumber, NSDecimalNumber(string: "10000000"))
    }

    func testRejectsAnythingButPlainDecimals() {
        let invalid: [PaymentAmount] = [
            .first(.nan),
            .first(.infinity),
            .second(""),
            .second("12abc"),
            .second(" 1.00"),
            .second("1,00"),
            .second("1e3"),
            .second("1."),
        ]

        for amount in invalid {
            XCTAssertNil(amount.decimalNumber, "\(amount)")
        }
    }
}
