import UIKit
import PassKit

/**
 * Hybrid implementation of ApplePayButton view component
 */
class HybridApplePayButton: HybridApplePayButtonSpec {

    // Props
    var buttonType: ApplePayButtonType = .buy
    var buttonStyle: ApplePayButtonStyle = .black
    var disableCardArt: Bool?
    var cornerRadius: Double?
    var onPress: (() -> Void)?

    // View
    var view: UIView = UIView()

    // Internal state
    private var paymentButton: PKPaymentButton?
    /// The type, style and card art setting `paymentButton` was built with: a change needs a new button
    private var builtType: ApplePayButtonType?
    private var builtStyle: ApplePayButtonStyle?
    private var builtDisableCardArt: Bool?
    /// The radius the system gave `paymentButton`, restored when `cornerRadius` is unset
    private var systemCornerRadius: CGFloat = 0

    override init() {
        super.init()
        setupButton()
    }

    func afterUpdate() {
        // onPress is read at tap time, and the radius can change on the existing button.
        if buttonType != builtType || buttonStyle != builtStyle || (disableCardArt ?? false) != builtDisableCardArt {
            setupButton()
        } else {
            applyCornerRadius()
        }
    }

    // MARK: - Private Methods

    private func setupButton() {
        // Remove existing button if any
        paymentButton?.removeFromSuperview()

        // Create new button
        let cardArtDisabled = disableCardArt ?? false
        let button = ApplePayButtonFactory.createButton(
            type: buttonType,
            style: buttonStyle,
            disableCardArt: cardArtDisabled,
            target: self,
            action: #selector(buttonPressed)
        )

        paymentButton = button
        builtType = buttonType
        builtStyle = buttonStyle
        builtDisableCardArt = cardArtDisabled
        systemCornerRadius = button.cornerRadius
        applyCornerRadius()

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

    private func applyCornerRadius() {
        guard let button = paymentButton else { return }
        let radius = cornerRadius.map { CGFloat($0) } ?? systemCornerRadius
        if button.cornerRadius != radius {
            button.cornerRadius = radius
        }
    }

    @objc private func buttonPressed() {
        onPress?()
    }
}
