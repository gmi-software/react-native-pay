import PassKit
import UIKit
import NitroModules

// MARK: - Constants

private enum ErrorMessage {
    static let paymentCancelled = "Payment cancelled by user"
    static let unableToPresent = "Unable to present payment authorization"
    static let unableToCreate = "Unable to create payment authorization"
}

// MARK: - Payment Request Builder

private struct PaymentRequestBuilder {
    
    static func build(from request: PaymentRequest) -> PKPaymentRequest {
        let paymentRequest = PKPaymentRequest()
        
        paymentRequest.merchantIdentifier = request.merchantIdentifier
        paymentRequest.countryCode = request.countryCode
        paymentRequest.currencyCode = request.currencyCode
        paymentRequest.paymentSummaryItems = buildPaymentItems(request.paymentItems)
        paymentRequest.merchantCapabilities = buildMerchantCapabilities(request.merchantCapabilities)
        paymentRequest.supportedNetworks = buildSupportedNetworks(request.supportedNetworks)
        
        if let shippingType = request.shippingType {
            paymentRequest.shippingType = convertShippingType(shippingType)
        }
        
        configureContactRequirements(paymentRequest, request: request)
        
        return paymentRequest
    }
    
    private static func buildPaymentItems(_ items: [PaymentItem]) -> [PKPaymentSummaryItem] {
        return items.map { item in
            let pkItem = PKPaymentSummaryItem(
                label: item.label,
                amount: NSDecimalNumber(decimal: Decimal(item.amount))
            )
            pkItem.type = item.type == .final ? .final : .pending
            return pkItem
        }
    }
    
    private static func buildMerchantCapabilities(_ capabilities: [String]) -> PKMerchantCapability {
        var merchantCapabilities: PKMerchantCapability = []
        for capability in capabilities {
            switch capability {
            case "3DS": merchantCapabilities.insert(.capability3DS)
            case "EMV": merchantCapabilities.insert(.capabilityEMV)
            case "Credit": merchantCapabilities.insert(.capabilityCredit)
            case "Debit": merchantCapabilities.insert(.capabilityDebit)
            default: break
            }
        }
        return merchantCapabilities
    }
    
    private static func buildSupportedNetworks(_ networks: [String]) -> [PKPaymentNetwork] {
        return networks.compactMap { PassKitTypeMapper.convertToPKPaymentNetwork($0) }
    }
    
    private static func convertShippingType(_ type: String) -> PKShippingType {
        switch type {
        case "shipping": return .shipping
        case "delivery": return .delivery
        case "storePickup": return .storePickup
        case "servicePickup": return .servicePickup
        default: return .shipping
        }
    }
    
    private static func configureContactRequirements(_ paymentRequest: PKPaymentRequest, request: PaymentRequest) {
        if request.billingContactRequired == true {
            paymentRequest.requiredBillingContactFields = [.postalAddress, .name]
        }
        
        if request.shippingContactRequired == true {
            paymentRequest.requiredShippingContactFields = [.postalAddress, .name]
        }
    }
}

// MARK: - Payment Token Converter

private struct PaymentTokenConverter {
    
    static func convert(_ pkToken: PKPaymentToken) -> PaymentToken {
        let paymentMethod = convertPaymentMethod(pkToken.paymentMethod)
        
        return PaymentToken.init(
            paymentMethod: paymentMethod,
            transactionIdentifier: pkToken.transactionIdentifier,
            paymentData: pkToken.paymentData.base64EncodedString()
        )
    }
    
    private static func convertPaymentMethod(_ pkMethod: PKPaymentMethod) -> PaymentMethod {
        return PaymentMethod.init(
            displayName: pkMethod.displayName,
            network: pkMethod.network.map { PassKitTypeMapper.convert($0) },
            type: PassKitTypeMapper.convert(pkMethod.type),
            secureElementPass: convertSecureElementPass(pkMethod),
            billingAddress: convertBillingAddress(pkMethod)
        )
    }
    
    private static func convertSecureElementPass(_ pkMethod: PKPaymentMethod) -> PKSecureElementPass? {
        if #available(iOS 13.4, *) {
            guard let pkSecureElementPass = pkMethod.secureElementPass else { return nil }
            return PassKitTypeMapper.convert(pkSecureElementPass)
        }
        return nil
    }
    
    private static func convertBillingAddress(_ pkMethod: PKPaymentMethod) -> CNContact? {
        if #available(iOS 13.0, *) {
            guard let billingAddress = pkMethod.billingAddress else { return nil }
            return PassKitTypeMapper.convert(billingAddress)
        }
        return nil
    }
}

// MARK: - Payment Delegate

private class PaymentDelegate: NSObject, PKPaymentAuthorizationViewControllerDelegate {
    private weak var paymentHandler: HybridPaymentHandler?
    private var paymentAuthorized: Bool = false
    
    init(paymentHandler: HybridPaymentHandler) {
        self.paymentHandler = paymentHandler
    }
    
    func paymentAuthorizationViewController(
        _ controller: PKPaymentAuthorizationViewController,
        didAuthorizePayment payment: PKPayment,
        handler completion: @escaping (PKPaymentAuthorizationResult) -> Void
    ) {
        paymentAuthorized = true
        
        // Simulate payment processing
        let workItem = DispatchWorkItem {
            completion(PKPaymentAuthorizationResult(status: .success, errors: nil))
            
            let paymentToken = PaymentTokenConverter.convert(payment.token)
            let transactionId = UUID().uuidString
            let result = PaymentResult.init(
                success: true,
                transactionId: transactionId,
                token: paymentToken,
                error: nil
            )
            
            self.paymentHandler?.handlePaymentResult(result)
        }
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0, execute: workItem)
    }
    
    func paymentAuthorizationViewControllerDidFinish(_ controller: PKPaymentAuthorizationViewController) {
        controller.dismiss(animated: true) {
            if !self.paymentAuthorized {
                let result = PaymentResult.init(
                    success: false,
                    transactionId: nil,
                    token: nil,
                    error: ErrorMessage.paymentCancelled
                )
                self.paymentHandler?.handlePaymentResult(result)
            }
        }
    }
}

// MARK: - Hybrid Payment Handler

class HybridPaymentHandler: HybridPaymentHandlerSpec {
    private var currentPaymentRequest: PKPaymentRequest?
    private var paymentCompletion: ((PaymentResult) -> Void)?
    private var delegate: PaymentDelegate?
    
    // MARK: - Public Methods
    
    func applePayStatus() throws -> ApplePayStatus {
        let canMakePayments = PKPaymentAuthorizationViewController.canMakePayments()
        let canSetupCards = PKPaymentAuthorizationViewController.canMakePayments(usingNetworks: [])
        return ApplePayStatus.init(canMakePayments, canSetupCards)
    }
    
    func canMakePayments(usingNetworks: [String]) throws -> Bool {
        let networks = usingNetworks.compactMap { PassKitTypeMapper.convertToPKPaymentNetwork($0) }
        return PKPaymentAuthorizationViewController.canMakePayments(usingNetworks: networks)
    }
    
    func startPayment(request: PaymentRequest) throws -> Promise<PaymentResult> {
        let promise = Promise<PaymentResult>()
        
        DispatchQueue.main.async {
            self.performPayment(request: request) { result in
                promise.resolve(withResult: result)
            }
        }
        
        return promise
    }
    
    // MARK: - Internal Methods
    
    func handlePaymentResult(_ result: PaymentResult) {
        paymentCompletion?(result)
    }
    
    // MARK: - Private Methods
    
    private func performPayment(request: PaymentRequest, completion: @escaping (PaymentResult) -> Void) {
        let paymentRequest = PaymentRequestBuilder.build(from: request)
        
        paymentCompletion = completion
        currentPaymentRequest = paymentRequest
        delegate = PaymentDelegate(paymentHandler: self)
        
        guard let paymentAuthVC = PKPaymentAuthorizationViewController(paymentRequest: paymentRequest) else {
            completion(createErrorResult(ErrorMessage.unableToCreate))
            return
        }
        
        paymentAuthVC.delegate = delegate
        
        guard let rootViewController = UIApplication.shared.windows.first?.rootViewController else {
            completion(createErrorResult(ErrorMessage.unableToPresent))
            return
        }
        
        rootViewController.present(paymentAuthVC, animated: true)
    }
    
    private func createErrorResult(_ error: String) -> PaymentResult {
        return PaymentResult.init(
            success: false,
            transactionId: nil,
            token: nil,
            error: error
        )
    }
}
