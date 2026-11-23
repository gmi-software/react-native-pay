import PassKit
import XCTest
@testable import NitroPay

final class ApplePayButtonFactoryTests: XCTestCase {

    func testMapsEveryButtonTypeToPassKit() {
        let expected: [(ApplePayButtonType, PKPaymentButtonType)] = [
            (.plain, .plain),
            (.buy, .buy),
            (.setup, .setUp),
            (.instore, .inStore),
            (.donate, .donate),
            (.checkout, .checkout),
            (.book, .book),
            (.subscribe, .subscribe),
            (.reload, .reload),
            (.addmoney, .addMoney),
            (.topup, .topUp),
            (.order, .order),
            (.rent, .rent),
            (.support, .support),
            (.contribute, .contribute),
            (.tip, .tip),
            (.continue, .continue),
        ]

        for (type, pkType) in expected {
            XCTAssertEqual(ApplePayButtonFactory.mapButtonType(type), pkType, "\(type.stringValue)")
        }
    }

    func testReadsTheNewTypesFromJavaScriptNames() {
        XCTAssertEqual(ApplePayButtonType(fromString: "plain"), .plain)
        XCTAssertEqual(ApplePayButtonType(fromString: "checkout"), .checkout)
        XCTAssertEqual(ApplePayButtonType(fromString: "subscribe"), .subscribe)
        XCTAssertEqual(ApplePayButtonType(fromString: "inStore"), .instore)
    }
}
