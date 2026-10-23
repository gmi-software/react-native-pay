import PassKit
import UIKit
import NitroModules

// MARK: - Constants

private enum ErrorMessage {
    static let paymentCancelled = "Payment cancelled by user"
    static let paymentDismissed = "Payment sheet was dismissed before authorization"
    static let paymentInProgress = "A payment is already in progress"
    static let missingMerchantIdentifier = "No Apple Pay merchant identifier configured"
    static let unableToPresent = "Unable to present payment authorization"
    static let unableToCreate = "Unable to create payment authorization"
    static let authorizationFailed = "Payment authorization failed"
    static let authorizationTimedOut = "Payment authorization timed out"
    static let negativeTotal = "Payment total must not be negative"

    static func invalidAmount(_ label: String) -> String {
        return "Amount for \"\(label)\" must be a finite number or a decimal string like \"19.99\""
    }
}

private struct PaymentRequestError: LocalizedError {
    let message: String

    var errorDescription: String? { message }
}

// PassKit fails the sheet on its own when the authorization completion is not
// called within about 30 seconds, so settle first with a definite result.
private let authorizationTimeout: TimeInterval = 25

private typealias AuthorizeCallback = (PaymentToken) -> Promise<Promise<PaymentAuthorizationResult>>

private enum BundleKey {
    static let applePayMerchantIdentifiers = "ReactNativePayApplePayMerchantIdentifiers"
    static let displayName = "CFBundleDisplayName"
    static let bundleName = "CFBundleName"
}

// MARK: - Payment Request Builder

// Internal, not private, so the NitroPay unit tests can build requests.
struct PaymentRequestBuilder {
    
    static func build(from request: PaymentRequest) throws -> PKPaymentRequest {
        guard let merchantIdentifier = resolveMerchantIdentifier(from: request) else {
            throw PaymentRequestError(message: ErrorMessage.missingMerchantIdentifier)
        }

        let paymentRequest = PKPaymentRequest()
        
        paymentRequest.merchantIdentifier = merchantIdentifier
        paymentRequest.countryCode = request.countryCode
        paymentRequest.currencyCode = request.currencyCode
        paymentRequest.paymentSummaryItems = try buildPaymentItems(for: request)
        paymentRequest.merchantCapabilities = buildMerchantCapabilities(request.merchantCapabilities)
        paymentRequest.supportedNetworks = buildSupportedNetworks(request.supportedNetworks)
        
        if let shippingType = request.shippingType {
            paymentRequest.shippingType = convertShippingType(shippingType)
        }
        
        configureContactRequirements(paymentRequest, request: request)
        
        return paymentRequest
    }

    private static func resolveMerchantIdentifier(from request: PaymentRequest) -> String? {
        if let overrideIdentifier = request.applePayMerchantIdentifier?.trimmingCharacters(in: CharacterSet.whitespacesAndNewlines),
           !overrideIdentifier.isEmpty {
            return overrideIdentifier
        }

        if let merchantIdentifiers = Bundle.main.object(
            forInfoDictionaryKey: BundleKey.applePayMerchantIdentifiers
        ) as? [String] {
            return merchantIdentifiers.first {
                !$0.trimmingCharacters(in: CharacterSet.whitespacesAndNewlines).isEmpty
            }
        }

        if let merchantIdentifier = Bundle.main.object(
            forInfoDictionaryKey: BundleKey.applePayMerchantIdentifiers
        ) as? String {
            let trimmedIdentifier = merchantIdentifier.trimmingCharacters(in: CharacterSet.whitespacesAndNewlines)
            return trimmedIdentifier.isEmpty ? nil : trimmedIdentifier
        }

        return nil
    }
    
    private static func buildPaymentItems(for request: PaymentRequest) throws -> [PKPaymentSummaryItem] {
        let amounts = try request.paymentItems.map { item -> NSDecimalNumber in
            guard let amount = item.amount.decimalNumber else {
                throw PaymentRequestError(message: ErrorMessage.invalidAmount(item.label))
            }
            return amount
        }
        let totalAmount = amounts.reduce(Decimal.zero) { partialResult, amount in
            partialResult + amount.decimalValue
        }
        guard totalAmount >= Decimal.zero else {
            throw PaymentRequestError(message: ErrorMessage.negativeTotal)
        }

        let lineItems = zip(request.paymentItems, amounts).map { item, amount in
            let pkItem = PKPaymentSummaryItem(label: item.label, amount: amount)
            pkItem.type = item.type == .final ? .final : .pending
            return pkItem
        }

        // PassKit shows the last item as the grand total ("Pay <label>"), so
        // always append one labelled with the merchant, even for a single item.
        let totalItem = PKPaymentSummaryItem(
            label: resolveMerchantName(from: request),
            amount: NSDecimalNumber(decimal: totalAmount)
        )
        // The total is only as final as its least final item.
        totalItem.type = request.paymentItems.contains { $0.type == .pending } ? .pending : .final

        return lineItems + [totalItem]
    }

    private static func resolveMerchantName(from request: PaymentRequest) -> String {
        let candidates = [
            request.merchantName,
            Bundle.main.object(forInfoDictionaryKey: BundleKey.displayName) as? String,
            Bundle.main.object(forInfoDictionaryKey: BundleKey.bundleName) as? String,
        ]
        for candidate in candidates {
            if let name = candidate?.trimmingCharacters(in: CharacterSet.whitespacesAndNewlines),
               !name.isEmpty {
                return name
            }
        }
        return ProcessInfo.processInfo.processName
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

// MARK: - Payment Results

private enum PaymentResultFactory {

    static func success(token: PaymentToken) -> PaymentResult {
        return PaymentResult.init(
            success: true,
            transactionId: UUID().uuidString,
            token: token,
            error: nil
        )
    }

    static func failure(_ error: String) -> PaymentResult {
        return PaymentResult.init(
            success: false,
            transactionId: nil,
            token: nil,
            error: error
        )
    }

    static func failure(_ error: Error) -> PaymentResult {
        // Nitro reports JS rejections as `RuntimeError`, whose description is the message.
        return failure(String(describing: error))
    }

    static func from(_ authorization: PaymentAuthorizationResult, token: PaymentToken) -> PaymentResult {
        switch authorization.status {
        case .success:
            return success(token: token)
        case .failure:
            return failure(authorization.error ?? ErrorMessage.authorizationFailed)
        }
    }
}

// MARK: - Payment Delegate

private class PaymentDelegate: NSObject, PKPaymentAuthorizationViewControllerDelegate {
    private weak var paymentHandler: HybridPaymentHandler?
    private let onAuthorize: AuthorizeCallback?
    private var paymentAuthorized: Bool = false
    private var authorizedResult: PaymentResult?
    private var isAuthorizing: Bool = false
    private var finishedWhileAuthorizing: Bool = false
    private var presentationDate: Date?
    private let userDismissThreshold: TimeInterval = 0.75
    
    init(paymentHandler: HybridPaymentHandler, onAuthorize: AuthorizeCallback?) {
        self.paymentHandler = paymentHandler
        self.onAuthorize = onAuthorize
    }

    func markPresented() {
        presentationDate = Date()
    }
    
    func paymentAuthorizationViewController(
        _ controller: PKPaymentAuthorizationViewController,
        didAuthorizePayment payment: PKPayment,
        handler completion: @escaping (PKPaymentAuthorizationResult) -> Void
    ) {
        paymentAuthorized = true
        let paymentToken = PaymentTokenConverter.convert(payment.token)

        guard let onAuthorize else {
            authorizedResult = PaymentResultFactory.success(token: paymentToken)
            completion(PKPaymentAuthorizationResult(status: .success, errors: nil))
            return
        }

        // PassKit calls this again when the user retries after a failure, so
        // each attempt completes its own handler exactly once. Runs on main.
        var isSettled = false
        isAuthorizing = true
        let settle = { (result: PaymentResult) in
            guard !isSettled else { return }
            isSettled = true
            self.isAuthorizing = false
            self.authorizedResult = result
            completion(PKPaymentAuthorizationResult(
                status: result.success ? .success : .failure,
                errors: nil
            ))
            if self.finishedWhileAuthorizing {
                self.reportResult()
            }
        }
        // Nitro settles JS promises on the JS thread.
        let settleOnMain = { (result: PaymentResult) in
            DispatchQueue.main.async { settle(result) }
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + authorizationTimeout) {
            settle(PaymentResultFactory.failure(ErrorMessage.authorizationTimedOut))
        }

        onAuthorize(paymentToken)
            .then { authorization in
                authorization
                    .then { settleOnMain(PaymentResultFactory.from($0, token: paymentToken)) }
                    .catch { settleOnMain(PaymentResultFactory.failure($0)) }
            }
            .catch { settleOnMain(PaymentResultFactory.failure($0)) }
    }
    
    func paymentAuthorizationViewControllerDidFinish(_ controller: PKPaymentAuthorizationViewController) {
        controller.dismiss(animated: true) {
            // Report the merchant's outcome, not a cancellation, once it arrives.
            if self.isAuthorizing {
                self.finishedWhileAuthorizing = true
                return
            }
            self.reportResult()
        }
    }

    private func reportResult() {
        if paymentAuthorized, let authorizedResult {
            paymentHandler?.handlePaymentResult(authorizedResult)
            return
        }

        let errorMessage: String
        if let presentationDate,
           Date().timeIntervalSince(presentationDate) >= userDismissThreshold {
            errorMessage = ErrorMessage.paymentCancelled
        } else {
            errorMessage = ErrorMessage.paymentDismissed
        }
        paymentHandler?.handlePaymentResult(PaymentResultFactory.failure(errorMessage))
    }
}

// MARK: - Hybrid Payment Handler

class HybridPaymentHandler: HybridPaymentHandlerSpec {
    private var currentPaymentRequest: PKPaymentRequest?
    private var paymentCompletion: ((PaymentResult) -> Void)?
    private var delegate: PaymentDelegate?
    
    // MARK: - Public Methods
    
    func payServiceStatus() throws -> PayServiceStatus {
        let canMakePayments = PKPaymentAuthorizationViewController.canMakePayments()
        let canSetupCards = PKPaymentAuthorizationViewController.canMakePayments(usingNetworks: [])
        return PayServiceStatus.init(canMakePayments, canSetupCards)
    }
    
    func canMakePayments(usingNetworks: [String]) throws -> Bool {
        let networks = usingNetworks.compactMap { PassKitTypeMapper.convertToPKPaymentNetwork($0) }
        return PKPaymentAuthorizationViewController.canMakePayments(usingNetworks: networks)
    }
    
    func startPayment(request: PaymentRequest, options: StartPaymentOptions?) throws -> Promise<PaymentResult> {
        let promise = Promise<PaymentResult>()
        let onAuthorize = options?.onAuthorize
        
        DispatchQueue.main.async {
            self.performPayment(request: request, onAuthorize: onAuthorize) { result in
                promise.resolve(withResult: result)
            }
        }
        
        return promise
    }
    
    // MARK: - Internal Methods
    
    func handlePaymentResult(_ result: PaymentResult) {
        // One-shot settle: Nitro Promise crashes on a second resolve/reject.
        guard let completion = paymentCompletion else { return }
        paymentCompletion = nil
        delegate = nil
        currentPaymentRequest = nil
        completion(result)
    }
    
    // MARK: - Private Methods
    
    private func performPayment(
        request: PaymentRequest,
        onAuthorize: AuthorizeCallback?,
        completion: @escaping (PaymentResult) -> Void
    ) {
        // Reject overlaps before touching shared state so the in-flight
        // payment keeps its completion/delegate and settles correctly.
        guard paymentCompletion == nil else {
            completion(PaymentResultFactory.failure(ErrorMessage.paymentInProgress))
            return
        }

        let paymentRequest: PKPaymentRequest
        do {
            paymentRequest = try PaymentRequestBuilder.build(from: request)
        } catch {
            completion(PaymentResultFactory.failure(error.localizedDescription))
            return
        }
        
        paymentCompletion = completion
        currentPaymentRequest = paymentRequest
        delegate = PaymentDelegate(paymentHandler: self, onAuthorize: onAuthorize)
        
        guard let paymentAuthVC = PKPaymentAuthorizationViewController(paymentRequest: paymentRequest) else {
            handlePaymentResult(PaymentResultFactory.failure(ErrorMessage.unableToCreate))
            return
        }
        
        paymentAuthVC.delegate = delegate
        
        guard let rootViewController = getRootViewController() else {
            handlePaymentResult(PaymentResultFactory.failure(ErrorMessage.unableToPresent))
            return
        }
        
        rootViewController.present(paymentAuthVC, animated: true) {
            self.delegate?.markPresented()
        }
    }
    
    private func getRootViewController() -> UIViewController? {
        let scenes = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .filter { $0.activationState == .foregroundActive }

        let rootViewController = scenes
            .flatMap(\.windows)
            .first(where: \.isKeyWindow)?
            .rootViewController

        return topViewController(from: rootViewController)
    }

    private func topViewController(from viewController: UIViewController?) -> UIViewController? {
        guard let viewController else { return nil }

        if let navigationController = viewController as? UINavigationController {
            return topViewController(from: navigationController.visibleViewController)
        }

        if let tabBarController = viewController as? UITabBarController {
            return topViewController(from: tabBarController.selectedViewController)
        }

        if let presentedViewController = viewController.presentedViewController {
            return topViewController(from: presentedViewController)
        }

        return viewController
    }
}
