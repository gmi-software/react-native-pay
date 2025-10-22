import UIKit
import PassKit

class HybridApplePayButton: HybridApplePayButtonSpec {
  // Props
    var buttonType: ApplePayButtonType = ApplePayButtonType.buy
    var buttonStyle: ApplePayButtonStyle = ApplePayButtonStyle.black
  var onPress: (() -> Void)?
  
  // View
  var view: UIView = UIView()
  
  private var paymentButton: PKPaymentButton?
  
  override init() {
    super.init()
    setupButton()
  }
  
  private func setupButton() {
    // Remove existing button if any
    paymentButton?.removeFromSuperview()
    
    // Convert string to PKPaymentButtonType
    let pkButtonType: PKPaymentButtonType
    switch buttonType {
    case ApplePayButtonType.buy: pkButtonType = .buy
    case ApplePayButtonType.setup: pkButtonType = .setUp
    case ApplePayButtonType.book: pkButtonType = .book
    case ApplePayButtonType.donate: pkButtonType = .donate
    case ApplePayButtonType.continue: pkButtonType = .continue
    case ApplePayButtonType.reload: pkButtonType = .reload
    case ApplePayButtonType.addmoney: pkButtonType = .addMoney
    case ApplePayButtonType.topup: pkButtonType = .topUp
    case ApplePayButtonType.order: pkButtonType = .order
    case ApplePayButtonType.rent: pkButtonType = .rent
    case ApplePayButtonType.support: pkButtonType = .support
    case ApplePayButtonType.contribute: pkButtonType = .contribute
    case ApplePayButtonType.tip: pkButtonType = .tip
    default: pkButtonType = .buy
    }
    
    // Convert string to PKPaymentButtonStyle
    let pkButtonStyle: PKPaymentButtonStyle
    switch buttonStyle {
    case ApplePayButtonStyle.white: pkButtonStyle = .white
    case ApplePayButtonStyle.whiteoutline: pkButtonStyle = .whiteOutline
    case ApplePayButtonStyle.black: pkButtonStyle = .black
    default: pkButtonStyle = .black
    }
    
    // Create the payment button
    paymentButton = PKPaymentButton(paymentButtonType: pkButtonType, paymentButtonStyle: pkButtonStyle)
    
    guard let button = paymentButton else { return }
    
    // Add target for button press
    button.addTarget(self, action: #selector(buttonPressed), for: .touchUpInside)
    
    // Configure button constraints
    button.translatesAutoresizingMaskIntoConstraints = false
    
    // Remove from old parent and add to new view
    button.removeFromSuperview()
    view.addSubview(button)
    
    // Set up constraints to fill the view
    NSLayoutConstraint.activate([
      button.topAnchor.constraint(equalTo: view.topAnchor),
      button.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      button.trailingAnchor.constraint(equalTo: view.trailingAnchor),
      button.bottomAnchor.constraint(equalTo: view.bottomAnchor)
    ])
  }
  
    @objc private func buttonPressed() {
        onPress?()
    }
}
