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
    static func createButton(
        type: ApplePayButtonType,
        style: ApplePayButtonStyle,
        target: Any?,
        action: Selector
    ) -> PKPaymentButton {
        let pkButtonType = mapButtonType(type)
        let pkButtonStyle = mapButtonStyle(style)
        let button = PKPaymentButton(paymentButtonType: pkButtonType, paymentButtonStyle: pkButtonStyle)
        button.addTarget(target, action: action, for: .touchUpInside)
        button.translatesAutoresizingMaskIntoConstraints = false
        return button
    }
}


