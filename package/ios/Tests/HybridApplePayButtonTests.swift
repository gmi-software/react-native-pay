import PassKit
import XCTest
@testable import NitroPay

final class HybridApplePayButtonTests: XCTestCase {

    private func paymentButtons(in button: HybridApplePayButton) -> [PKPaymentButton] {
        button.view.subviews.compactMap { $0 as? PKPaymentButton }
    }

    func testKeepsTheButtonWhenOnlyOnPressChanges() {
        let button = HybridApplePayButton()
        button.afterUpdate()
        let initial = paymentButtons(in: button)

        button.onPress = {}
        button.afterUpdate()
        button.onPress = {}
        button.afterUpdate()

        XCTAssertEqual(initial.count, 1)
        XCTAssertEqual(paymentButtons(in: button).count, 1)
        XCTAssertTrue(paymentButtons(in: button).first === initial.first)
    }

    func testRebuildsTheButtonWhenTheTypeOrStyleChanges() {
        let button = HybridApplePayButton()
        let initial = paymentButtons(in: button).first

        button.buttonType = .setup
        button.afterUpdate()
        let afterType = paymentButtons(in: button).first

        button.buttonStyle = .white
        button.afterUpdate()
        let afterStyle = paymentButtons(in: button).first

        XCTAssertFalse(afterType === initial)
        XCTAssertFalse(afterStyle === afterType)
        XCTAssertEqual(paymentButtons(in: button).count, 1)
    }

    func testTapCallsTheLatestOnPress() throws {
        let button = HybridApplePayButton()
        var calls: [String] = []
        button.onPress = { calls.append("first") }
        button.afterUpdate()
        button.onPress = { calls.append("second") }
        button.afterUpdate()

        // The test bundle has no host app, so no UIApplication delivers
        // sendActions(for:). Perform the kept button's registered action instead.
        let paymentButton = try XCTUnwrap(paymentButtons(in: button).first)
        let actions = try XCTUnwrap(
            paymentButton.actions(forTarget: button, forControlEvent: .touchUpInside)
        )
        XCTAssertEqual(actions.count, 1)
        for action in actions {
            _ = (button as AnyObject).perform(NSSelectorFromString(action))
        }

        XCTAssertEqual(calls, ["second"])
    }
}
