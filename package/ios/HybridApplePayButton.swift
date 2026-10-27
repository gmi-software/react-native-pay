import UIKit
import PassKit

/**
 * Hybrid implementation of ApplePayButton view component
 */
class HybridApplePayButton: HybridApplePayButtonSpec {
    
    // Props
    var buttonType: ApplePayButtonType = .buy
    var buttonStyle: ApplePayButtonStyle = .black
    var onPress: (() -> Void)?
    
    // View
    var view: UIView = UIView()
    
    // Internal state
    private var paymentButton: PKPaymentButton?
    /// The type and style `paymentButton` was built with: a change needs a new button
    private var builtType: ApplePayButtonType?
    private var builtStyle: ApplePayButtonStyle?
    
    override init() {
        super.init()
        setupButton()
    }
    
    func afterUpdate() {
        // onPress is read at tap time, so only the type and style need a new button.
        guard buttonType != builtType || buttonStyle != builtStyle else { return }
        setupButton()
    }
    
    // MARK: - Private Methods
    
    private func setupButton() {
        // Remove existing button if any
        paymentButton?.removeFromSuperview()
        
        // Create new button
        let button = ApplePayButtonFactory.createButton(
            type: buttonType,
            style: buttonStyle,
            target: self,
            action: #selector(buttonPressed)
        )
        
        paymentButton = button
        builtType = buttonType
        builtStyle = buttonStyle
        
        // Add to view
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
