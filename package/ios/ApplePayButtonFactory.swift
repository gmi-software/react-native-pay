import UIKit
import PassKit

// MARK: - Button Type Mapping

enum ApplePayButtonFactory {
    
    /// Maps ApplePayButtonType to PKPaymentButtonType
    static func mapButtonType(_ type: ApplePayButtonType) -> PKPaymentButtonType {
        switch type {
        case .buy: return .buy
        case .setup: return .setUp
        case .book: return .book
        case .donate: return .donate
        case .continue: return .continue
        case .reload: return .reload
        case .addmoney: return .addMoney
        case .topup: return .topUp
        case .order: return .order
        case .rent: return .rent
        case .support: return .support
        case .contribute: return .contribute
        case .tip: return .tip
        }
    }
    
    /// Maps ApplePayButtonStyle to PKPaymentButtonStyle
    static func mapButtonStyle(_ style: ApplePayButtonStyle) -> PKPaymentButtonStyle {
        switch style {
        case .white: return .white
        case .whiteoutline: return .whiteOutline
        case .black: return .black
        default: return .automatic
        }
    }
    
    /// Creates a configured PKPaymentButton
    ///
    /// `disableCardArt` takes effect on iOS 26 and later, where the button can
    /// show the payer's default card instead of the plain label.
    static func createButton(
        type: ApplePayButtonType,
        style: ApplePayButtonStyle,
        disableCardArt: Bool,
        target: Any?,
        action: Selector
    ) -> PKPaymentButton {
        let pkButtonType = mapButtonType(type)
        let pkButtonStyle = mapButtonStyle(style)
        let button = makeButton(type: pkButtonType, style: pkButtonStyle, disableCardArt: disableCardArt)
        button.addTarget(target, action: action, for: .touchUpInside)
        button.translatesAutoresizingMaskIntoConstraints = false
        return button
    }

    private static func makeButton(
        type: PKPaymentButtonType,
        style: PKPaymentButtonStyle,
        disableCardArt: Bool
    ) -> PKPaymentButton {
        // The iOS 26 initializer is only in the iOS 26 SDK, which ships with Swift 6.2 (Xcode 26).
        #if compiler(>=6.2)
        if #available(iOS 26.0, *) {
            return PKPaymentButton(type: type, style: style, disableCardArt: disableCardArt)
        }
        #endif
        return PKPaymentButton(paymentButtonType: type, paymentButtonStyle: style)
    }
}


