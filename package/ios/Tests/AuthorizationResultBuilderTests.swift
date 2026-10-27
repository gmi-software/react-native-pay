import PassKit
import XCTest
@testable import NitroPay

final class AuthorizationResultBuilderTests: XCTestCase {

    func testSuccessCarriesNoErrors() {
        let result = AuthorizationResultBuilder.build(success: true, error: nil)

        XCTAssertEqual(result.status, .success)
        XCTAssertTrue(result.errors.isEmpty)
    }

    // PassKit closes the sheet after a failure with no errors, or with an
    // error from another domain; after `unknownError` the payer can retry.
    func testFailureLetsThePayerRetry() {
        let result = AuthorizationResultBuilder.build(success: false, error: "Card declined")

        XCTAssertEqual(result.status, .failure)
        XCTAssertEqual(result.errors.count, 1)
        let error = result.errors[0] as NSError
        XCTAssertEqual(error.domain, PKPaymentErrorDomain)
        XCTAssertEqual(error.code, PKPaymentError.unknownError.rawValue)
        XCTAssertEqual(error.localizedDescription, "Card declined")
    }

    func testFailureWithoutAMessageUsesTheGenericOne() {
        let result = AuthorizationResultBuilder.build(success: false, error: nil)

        XCTAssertEqual((result.errors.first as NSError?)?.localizedDescription, "Payment authorization failed")
    }
}
