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
    
    override init() {
        super.init()
        setupButton()
    }
    
    func afterUpdate() {
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
