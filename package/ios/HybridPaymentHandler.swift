import PassKit
import UIKit
import NitroModules

// MARK: - Constants

private enum ErrorMessage {
    static let paymentCancelled = "Payment cancelled by user"
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

    static func unknownMerchantCapability(_ capability: String) -> String {
        return "Unknown merchant capability \"\(capability)\". Use \"3DS\", \"EMV\", \"Credit\" or \"Debit\""
    }

    static func missingShippingMethodIdentifier(_ label: String) -> String {
        return "Shipping method \"\(label)\" needs an identifier"
    }

    static func duplicateShippingMethodIdentifier(_ identifier: String) -> String {
        return "Shipping method identifier \"\(identifier)\" is used more than once"
    }

    static func negativeShippingMethodAmount(_ label: String) -> String {
        return "Amount for \"\(label)\" must not be negative"
    }

    static let missingSupportedNetwork = "supportedNetworks needs at least one network"

    static func unknownNetwork(_ network: String) -> String {
        return "Unknown payment network \"\(network)\". Use a PaymentNetwork value such as \"visa\" or \"mastercard\""
    }

    static func unavailableNetworks(_ networks: [String]) -> String {
        return "Apple Pay on this iOS version offers none of these networks: \(networks.joined(separator: ", "))"
    }

    static func unknownShippingType(_ shippingType: String) -> String {
        return "Unknown shipping type \"\(shippingType)\". Use \"shipping\", \"delivery\", \"storePickup\" or \"servicePickup\""
    }
}

/// Why a payment ended without success.
// Internal, not private, so the NitroPay unit tests can check the code.
// `CustomStringConvertible` because Nitro rejects JS promises with the
// error's description.
struct PaymentFailure: LocalizedError, CustomStringConvertible {
    let code: PaymentErrorCode
    let message: String

    var errorDescription: String? { message }
    var description: String { message }

    var status: PaymentStatus {
        return code == .cancelled ? .cancelled : .failed
    }

    static func configuration(_ message: String) -> PaymentFailure {
        return PaymentFailure(code: .configuration, message: message)
    }
}

// PassKit fails the sheet on its own when the authorization completion is not
// called within about 30 seconds, so settle first with a definite result.
private let authorizationTimeout: TimeInterval = 25

private typealias AuthorizeCallback = (PaymentToken, PaymentDetails) -> Promise<Promise<PaymentAuthorizationResult>>

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
            throw PaymentFailure.configuration(ErrorMessage.missingMerchantIdentifier)
        }

        let paymentRequest = PKPaymentRequest()
        
        paymentRequest.merchantIdentifier = merchantIdentifier
        paymentRequest.countryCode = request.countryCode
        paymentRequest.currencyCode = request.currencyCode
        let shippingMethods = try buildShippingMethods(request.shippingMethods ?? [])
        if !shippingMethods.isEmpty {
            paymentRequest.shippingMethods = shippingMethods
        }
        // PassKit selects the first method when the sheet opens.
        paymentRequest.paymentSummaryItems = try buildSummaryItems(
            for: request,
            selectedShippingMethodIdentifier: shippingMethods.first?.identifier
        )
        paymentRequest.merchantCapabilities = try buildMerchantCapabilities(request.merchantCapabilities)
        paymentRequest.supportedNetworks = try buildSupportedNetworks(request.supportedNetworks)
        
        if let shippingType = request.shippingType {
            paymentRequest.shippingType = try convertShippingType(shippingType)
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
    
    private static func buildShippingMethods(_ methods: [ShippingMethod]) throws -> [PKShippingMethod] {
        var identifiers = Set<String>()
        return try methods.map { method in
            guard !method.identifier.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
                throw PaymentFailure.configuration(ErrorMessage.missingShippingMethodIdentifier(method.label))
            }
            guard identifiers.insert(method.identifier).inserted else {
                throw PaymentFailure.configuration(ErrorMessage.duplicateShippingMethodIdentifier(method.identifier))
            }
            let amount = try shippingMethodAmount(method)
            let pkMethod = PKShippingMethod(label: method.label, amount: amount)
            pkMethod.identifier = method.identifier
            pkMethod.detail = method.detail
            return pkMethod
        }
    }

    private static func shippingMethodAmount(_ method: ShippingMethod) throws -> NSDecimalNumber {
        guard let amount = method.amount.decimalNumber else {
            throw PaymentFailure.configuration(ErrorMessage.invalidAmount(method.label))
        }
        guard amount.decimalValue >= Decimal.zero else {
            throw PaymentFailure.configuration(ErrorMessage.negativeShippingMethodAmount(method.label))
        }
        return amount
    }

    /// The payment items, then the selected shipping method as its own line,
    /// then the total. Internal so the delegate and the unit tests can rebuild it.
    static func buildSummaryItems(
        for request: PaymentRequest,
        selectedShippingMethodIdentifier: String?
    ) throws -> [PKPaymentSummaryItem] {
        let amounts = try request.paymentItems.map { item -> NSDecimalNumber in
            guard let amount = item.amount.decimalNumber else {
                throw PaymentFailure.configuration(ErrorMessage.invalidAmount(item.label))
            }
            return amount
        }

        // Checked without shipping: methods are never negative, so then every
        // method the payer can pick keeps the total valid.
        var totalAmount = amounts.reduce(Decimal.zero) { partialResult, amount in
            partialResult + amount.decimalValue
        }
        guard totalAmount >= Decimal.zero else {
            throw PaymentFailure.configuration(ErrorMessage.negativeTotal)
        }

        var lineItems = zip(request.paymentItems, amounts).map { item, amount in
            let pkItem = PKPaymentSummaryItem(label: item.label, amount: amount)
            pkItem.type = item.type == .final ? .final : .pending
            return pkItem
        }

        if let identifier = selectedShippingMethodIdentifier,
           let method = request.shippingMethods?.first(where: { $0.identifier == identifier }) {
            let amount = try shippingMethodAmount(method)
            let shippingItem = PKShippingMethod(label: method.label, amount: amount)
            shippingItem.identifier = method.identifier
            lineItems.append(shippingItem)
            totalAmount += amount.decimalValue
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
    
    static func buildMerchantCapabilities(_ capabilities: [String]) throws -> PKMerchantCapability {
        var merchantCapabilities: PKMerchantCapability = []
        for capability in capabilities {
            switch capability.uppercased() {
            case "3DS": merchantCapabilities.insert(.capability3DS)
            case "EMV": merchantCapabilities.insert(.capabilityEMV)
            case "CREDIT": merchantCapabilities.insert(.capabilityCredit)
            case "DEBIT": merchantCapabilities.insert(.capabilityDebit)
            default:
                throw PaymentFailure.configuration(ErrorMessage.unknownMerchantCapability(capability))
            }
        }
        // PassKit requires 3DS or EMV. EMV only covers China UnionPay, so
        // every other card needs 3DS; Credit and Debit just filter card types.
        if merchantCapabilities.isDisjoint(with: [.capability3DS, .capabilityEMV]) {
            merchantCapabilities.insert(.capability3DS)
        }
        return merchantCapabilities
    }
    
    /// Same rules and messages as Android: an unknown name fails, a network
    /// this iOS version lacks is left out, and at least one must be left.
    static func buildSupportedNetworks(_ names: [String]) throws -> [PKPaymentNetwork] {
        guard !names.isEmpty else {
            throw PaymentFailure.configuration(ErrorMessage.missingSupportedNetwork)
        }
        let networks = try convertNetworks(names)
        guard !networks.isEmpty else {
            throw PaymentFailure.configuration(ErrorMessage.unavailableNetworks(names))
        }
        return networks
    }

    /// The PassKit networks for these names that this iOS version has,
    /// without duplicates. Fails for a name that is not a `PaymentNetwork`.
    static func convertNetworks(_ names: [String]) throws -> [PKPaymentNetwork] {
        var networks: [PKPaymentNetwork] = []
        for name in names {
            guard let network = PassKitTypeMapper.paymentNetwork(named: name) else {
                throw PaymentFailure.configuration(ErrorMessage.unknownNetwork(name))
            }
            if let pkNetwork = PassKitTypeMapper.convertToPKPaymentNetwork(network),
               !networks.contains(pkNetwork) {
                networks.append(pkNetwork)
            }
        }
        return networks
    }
    
    private static func convertShippingType(_ type: String) throws -> PKShippingType {
        switch type {
        case "shipping": return .shipping
        case "delivery": return .delivery
        case "storePickup": return .storePickup
        case "servicePickup": return .servicePickup
        default:
            throw PaymentFailure.configuration(ErrorMessage.unknownShippingType(type))
        }
    }
    
    private static func configureContactRequirements(_ paymentRequest: PKPaymentRequest, request: PaymentRequest) {
        if request.billingContactRequired == true {
            paymentRequest.requiredBillingContactFields = [.postalAddress, .name]
        }

        // Apple Pay returns email and phone only with the shipping contact.
        var shippingFields: Set<PKContactField> = []
        if request.shippingContactRequired == true {
            shippingFields.formUnion([.postalAddress, .name])
        }
        if request.emailRequired == true {
            shippingFields.insert(.emailAddress)
        }
        if request.phoneNumberRequired == true {
            shippingFields.insert(.phoneNumber)
        }
        paymentRequest.requiredShippingContactFields = shippingFields
    }
}

// MARK: - Payment Readiness

// Internal, not private, so the NitroPay unit tests can reach it.
enum PaymentReadiness {
    // Checked when the caller names no networks, like the hook's default.
    static let defaultNetworks = ["visa", "mastercard", "amex", "discover"]

    /// Rejects what the payment would refuse, with the same error.
    static func hasActiveCard(networks: [String], merchantCapabilities: [String]?) throws -> Bool {
        let capabilities = try PaymentRequestBuilder.buildMerchantCapabilities(merchantCapabilities ?? [])
        let paymentNetworks = try PaymentRequestBuilder.buildSupportedNetworks(networks)
        return PKPaymentAuthorizationViewController.canMakePayments(
            usingNetworks: paymentNetworks,
            capabilities: capabilities
        )
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

// MARK: - Authorization Results

// Internal, not private, so the NitroPay unit tests can reach it.
enum AuthorizationResultBuilder {

    /// The merchant's outcome for the sheet. PassKit ends the payment on a
    /// failure without a PassKit error, but lets the payer try again after
    /// `unknownError`, which calls `didAuthorizePayment` with a new token.
    static func build(success: Bool, error: String?) -> PKPaymentAuthorizationResult {
        guard !success else {
            return PKPaymentAuthorizationResult(status: .success, errors: nil)
        }
        let retryable = PKPaymentError(
            .unknownError,
            userInfo: [NSLocalizedDescriptionKey: error ?? ErrorMessage.authorizationFailed]
        )
        return PKPaymentAuthorizationResult(status: .failure, errors: [retryable])
    }
}

// MARK: - Payment Results

private enum PaymentResultFactory {

    static func success(token: PaymentToken, details: PaymentDetails) -> PaymentResult {
        return PaymentResult.init(
            status: .success,
            code: nil,
            success: true,
            transactionId: UUID().uuidString,
            token: token,
            error: nil,
            billingContact: details.billingContact,
            shippingContact: details.shippingContact,
            emailAddress: details.emailAddress,
            phoneNumber: details.phoneNumber,
            shippingMethod: details.shippingMethod
        )
    }

    static func failure(_ failure: PaymentFailure) -> PaymentResult {
        return PaymentResult.init(
            status: failure.status,
            code: failure.code,
            success: false,
            transactionId: nil,
            token: nil,
            error: failure.message,
            billingContact: nil,
            shippingContact: nil,
            emailAddress: nil,
            phoneNumber: nil,
            shippingMethod: nil
        )
    }

    static func failure(_ code: PaymentErrorCode, _ message: String) -> PaymentResult {
        return failure(PaymentFailure(code: code, message: message))
    }

    /// An `onAuthorize` that rejected.
    static func authorizationFailure(_ error: Error) -> PaymentResult {
        // Nitro reports JS rejections as `RuntimeError`, whose description is the message.
        return failure(.providerError, String(describing: error))
    }

    static func from(
        _ authorization: PaymentAuthorizationResult,
        token: PaymentToken,
        details: PaymentDetails
    ) -> PaymentResult {
        switch authorization.status {
        case .success:
            return success(token: token, details: details)
        case .failure:
            return failure(.providerError, authorization.error ?? ErrorMessage.authorizationFailed)
        }
    }
}

// MARK: - Payment Sheet

/// What the handler needs from `PKPaymentAuthorizationController`, so the
/// unit tests can stand in a sheet that PassKit refuses to present.
protocol PaymentSheet: AnyObject {
    var delegate: PKPaymentAuthorizationControllerDelegate? { get set }
    func present(completion: (@Sendable (Bool) -> Void)?)
}

extension PKPaymentAuthorizationController: PaymentSheet {}

/// Presents the Apple Pay sheet and holds it until `release()`: the sheet's
/// delegate is weak, and no view controller owns it. Main thread only.
/// Internal, not private, so the NitroPay unit tests can reach it.
final class PaymentSheetPresenter {
    private let makeSheet: (PKPaymentRequest) -> PaymentSheet?
    private var sheet: PaymentSheet?

    init(makeSheet: @escaping (PKPaymentRequest) -> PaymentSheet? = PaymentSheetPresenter.makePassKitSheet) {
        self.makeSheet = makeSheet
    }

    /// Calls `onFailure` when there is no sheet. PassKit then calls no
    /// delegate method, so `onFailure` is the payment's only chance to settle.
    func present(
        _ request: PKPaymentRequest,
        delegate: PKPaymentAuthorizationControllerDelegate,
        onFailure: @escaping (PaymentFailure) -> Void
    ) {
        guard let sheet = makeSheet(request) else {
            onFailure(PaymentFailure(code: .notAvailable, message: ErrorMessage.unableToCreate))
            return
        }
        sheet.delegate = delegate
        self.sheet = sheet
        sheet.present { presented in
            guard !presented else { return }
            // PassKit does not say which thread this runs on.
            DispatchQueue.main.async {
                onFailure(PaymentFailure(code: .notAvailable, message: ErrorMessage.unableToPresent))
            }
        }
    }

    func release() {
        sheet = nil
    }

    static func makePassKitSheet(for request: PKPaymentRequest) -> PaymentSheet? {
        // The controller's initializer never fails, but the view controller's
        // returns nil when the device cannot pay or the request is invalid.
        guard PKPaymentAuthorizationViewController(paymentRequest: request) != nil else {
            return nil
        }
        return PKPaymentAuthorizationController(paymentRequest: request)
    }
}

// MARK: - Payment Delegate

private class PaymentDelegate: NSObject, PKPaymentAuthorizationControllerDelegate {
    private weak var paymentHandler: HybridPaymentHandler?
    private let request: PaymentRequest
    private let paymentRequest: PKPaymentRequest
    private let onAuthorize: AuthorizeCallback?
    private var selectedShippingMethodIdentifier: String?
    private var summaryItems: [PKPaymentSummaryItem]
    private var paymentAuthorized: Bool = false
    private var authorizedResult: PaymentResult?
    private var isAuthorizing: Bool = false
    private var finishedWhileAuthorizing: Bool = false
    
    init(
        paymentHandler: HybridPaymentHandler,
        request: PaymentRequest,
        paymentRequest: PKPaymentRequest,
        onAuthorize: AuthorizeCallback?
    ) {
        self.paymentHandler = paymentHandler
        self.request = request
        self.paymentRequest = paymentRequest
        self.onAuthorize = onAuthorize
        self.selectedShippingMethodIdentifier = paymentRequest.shippingMethods?.first?.identifier
        self.summaryItems = paymentRequest.paymentSummaryItems
    }
    
    func paymentAuthorizationController(
        _ controller: PKPaymentAuthorizationController,
        didSelectShippingMethod shippingMethod: PKShippingMethod,
        handler completion: @escaping (PKPaymentRequestShippingMethodUpdate) -> Void
    ) {
        selectedShippingMethodIdentifier = shippingMethod.identifier
        // The request was validated when it was built, so this only keeps the
        // current items if rebuilding fails. PassKit waits for the completion.
        if let items = try? PaymentRequestBuilder.buildSummaryItems(
            for: request,
            selectedShippingMethodIdentifier: shippingMethod.identifier
        ) {
            summaryItems = items
        }
        completion(PKPaymentRequestShippingMethodUpdate(paymentSummaryItems: summaryItems))
    }

    func paymentAuthorizationController(
        _ controller: PKPaymentAuthorizationController,
        didAuthorizePayment payment: PKPayment,
        handler completion: @escaping (PKPaymentAuthorizationResult) -> Void
    ) {
        paymentAuthorized = true
        let paymentToken = PaymentTokenConverter.convert(payment.token)
        let details = PassKitTypeMapper.convertPaymentDetails(
            billingContact: payment.billingContact,
            shippingContact: payment.shippingContact,
            requiredBillingFields: paymentRequest.requiredBillingContactFields,
            requiredShippingFields: paymentRequest.requiredShippingContactFields,
            shippingMethod: selectedShippingMethod(payment)
        )

        guard let onAuthorize else {
            authorizedResult = PaymentResultFactory.success(token: paymentToken, details: details)
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
            completion(AuthorizationResultBuilder.build(success: result.success, error: result.error))
            if self.finishedWhileAuthorizing {
                self.reportResult()
            }
        }
        // Nitro settles JS promises on the JS thread.
        let settleOnMain = { (result: PaymentResult) in
            DispatchQueue.main.async { settle(result) }
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + authorizationTimeout) {
            settle(PaymentResultFactory.failure(.providerError, ErrorMessage.authorizationTimedOut))
        }

        onAuthorize(paymentToken, details)
            .then { authorization in
                authorization
                    .then { settleOnMain(PaymentResultFactory.from($0, token: paymentToken, details: details)) }
                    .catch { settleOnMain(PaymentResultFactory.authorizationFailure($0)) }
            }
            .catch { settleOnMain(PaymentResultFactory.authorizationFailure($0)) }
    }
    
    /// The request's entry for the method the payer authorized with.
    private func selectedShippingMethod(_ payment: PKPayment) -> ShippingMethod? {
        let identifier = payment.shippingMethod?.identifier ?? selectedShippingMethodIdentifier
        return request.shippingMethods?.first { $0.identifier == identifier }
    }

    func paymentAuthorizationControllerDidFinish(_ controller: PKPaymentAuthorizationController) {
        controller.dismiss {
            // PassKit does not say which thread this runs on.
            DispatchQueue.main.async {
                // Report the merchant's outcome, not a cancellation, once it arrives.
                if self.isAuthorizing {
                    self.finishedWhileAuthorizing = true
                    return
                }
                self.reportResult()
            }
        }
    }

    // Required on visionOS. PassKit shows the sheet on this window's scene. A
    // scene is still foregroundInactive right after a system alert closes.
    func presentationWindow(for controller: PKPaymentAuthorizationController) -> UIWindow? {
        let windows = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .filter { $0.activationState == .foregroundActive || $0.activationState == .foregroundInactive }
            .flatMap(\.windows)
        return windows.first(where: \.isKeyWindow) ?? windows.first
    }

    private func reportResult() {
        if paymentAuthorized, let authorizedResult {
            paymentHandler?.handlePaymentResult(authorizedResult)
            return
        }

        // PassKit doesn't say why a sheet closed before authorization, so a
        // sheet that closes by itself also reports a cancel.
        paymentHandler?.handlePaymentResult(
            PaymentResultFactory.failure(.cancelled, ErrorMessage.paymentCancelled)
        )
    }
}

// MARK: - Hybrid Payment Handler

class HybridPaymentHandler: HybridPaymentHandlerSpec {
    private let pendingPayment = PendingPayment<PaymentResult>()
    // Main thread only
    private let sheetPresenter: PaymentSheetPresenter
    private var delegate: PaymentDelegate?

    init(sheetPresenter: PaymentSheetPresenter = PaymentSheetPresenter()) {
        self.sheetPresenter = sheetPresenter
        super.init()
    }

    // MARK: - Public Methods
    
    // PassKit asks the Wallet service, so both checks run off the JS thread.
    // Its `canMakePayments` class methods may be called from any thread.
    func payServiceStatus(options: PayServiceStatusOptions?) throws -> Promise<PayServiceStatus> {
        let networks = options?.supportedNetworks ?? PaymentReadiness.defaultNetworks
        let merchantCapabilities = options?.merchantCapabilities
        return Promise.parallel {
            PayServiceStatus(
                isSupported: PKPaymentAuthorizationViewController.canMakePayments(),
                hasActiveCard: try PaymentReadiness.hasActiveCard(
                    networks: networks,
                    merchantCapabilities: merchantCapabilities
                )
            )
        }
    }
    
    func openPaymentSetup() throws {
        // Hands over to Wallet (Settings on iPad); does nothing without Apple Pay support.
        DispatchQueue.main.async {
            PKPassLibrary().openPaymentSetup()
        }
    }
    
    func isPaymentInProgress() throws -> Bool {
        return pendingPayment.isInProgress
    }
    
    func startPayment(request: PaymentRequest, options: StartPaymentOptions?) throws -> Promise<PaymentResult> {
        let promise = Promise<PaymentResult>()
        
        // Claim on the calling (JS) thread, so isPaymentInProgress() sees the
        // payment before the sheet is presented. Reject overlaps without
        // touching the in-flight payment, so its promise still settles.
        guard pendingPayment.tryBegin({ result in promise.resolve(withResult: result) }) else {
            promise.resolve(withResult: PaymentResultFactory.failure(.inProgress, ErrorMessage.paymentInProgress))
            return promise
        }
        let onAuthorize = options?.onAuthorize
        
        DispatchQueue.main.async {
            do {
                try self.performPayment(request: request, onAuthorize: onAuthorize)
            } catch let failure as PaymentFailure {
                self.handlePaymentResult(PaymentResultFactory.failure(failure))
            } catch {
                self.handlePaymentResult(PaymentResultFactory.failure(.unknown, error.localizedDescription))
            }
        }
        
        return promise
    }
    
    // MARK: - Internal Methods
    
    func handlePaymentResult(_ result: PaymentResult) {
        delegate = nil
        sheetPresenter.release()
        // One-shot settle: Nitro Promise crashes on a second resolve/reject.
        pendingPayment.settle(result)
    }
    
    // MARK: - Private Methods
    
    private func performPayment(request: PaymentRequest, onAuthorize: AuthorizeCallback?) throws {
        let paymentRequest = try PaymentRequestBuilder.build(from: request)

        let delegate = PaymentDelegate(
            paymentHandler: self,
            request: request,
            paymentRequest: paymentRequest,
            onAuthorize: onAuthorize
        )
        self.delegate = delegate

        // The sheet has its own window, so a view controller of the app that
        // is busy presenting or dismissing can neither refuse nor close it.
        sheetPresenter.present(
            paymentRequest,
            delegate: delegate,
            onFailure: { self.handlePaymentResult(PaymentResultFactory.failure($0)) }
        )
    }
}
