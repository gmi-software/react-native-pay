import PassKit
import NitroModules

typealias SheetCallback<Value> = (Value, PaymentSheetSelection) -> Promise<Promise<PaymentSheetUpdate>>

/// The sheet callbacks of `StartPaymentOptions`.
struct PaymentSheetCallbacks {
    var onShippingAddressChange: SheetCallback<PaymentSheetAddress>?
    var onShippingMethodChange: SheetCallback<ShippingMethod>?
    var onPaymentMethodChange: SheetCallback<PaymentSheetCard>?
    var onCouponCodeChange: SheetCallback<String>?

    init(
        onShippingAddressChange: SheetCallback<PaymentSheetAddress>? = nil,
        onShippingMethodChange: SheetCallback<ShippingMethod>? = nil,
        onPaymentMethodChange: SheetCallback<PaymentSheetCard>? = nil,
        onCouponCodeChange: SheetCallback<String>? = nil
    ) {
        self.onShippingAddressChange = onShippingAddressChange
        self.onShippingMethodChange = onShippingMethodChange
        self.onPaymentMethodChange = onPaymentMethodChange
        self.onCouponCodeChange = onCouponCodeChange
    }

    var isEmpty: Bool {
        return onShippingAddressChange == nil && onShippingMethodChange == nil
            && onPaymentMethodChange == nil && onCouponCodeChange == nil
    }

    init(_ options: StartPaymentOptions?) {
        self.init(
            onShippingAddressChange: options?.onShippingAddressChange,
            onShippingMethodChange: options?.onShippingMethodChange,
            onPaymentMethodChange: options?.onPaymentMethodChange,
            onCouponCodeChange: options?.onCouponCodeChange
        )
    }
}

/// A sheet update this can't apply. Never reported: the sheet keeps its items.
private struct UnusableSheetUpdate: Error {}

/// What the Apple Pay sheet shows, kept across the payer's changes so each one
/// starts from the last update: a coupon stays applied when the courier
/// changes. Runs the sheet callbacks and turns their updates into PassKit's.
/// Main thread only. Internal so the NitroPay unit tests can drive it.
final class PaymentSheetUpdater {
    private let callbacks: PaymentSheetCallbacks
    private let merchantName: String
    private let laterCharges: [PKPaymentSummaryItem]
    private let timeout: TimeInterval
    /// With multi-token contexts, PassKit needs the total to stay equal to
    /// their sum, so no update may change it.
    private let fixedTotal: Decimal?
    private var paymentItems: [PaymentItem]
    private var shippingMethods: [ShippingMethod]
    private var selectedShippingMethodIdentifier: String?
    private var shippingAddress: PaymentSheetAddress?
    private var card: PaymentSheetCard?
    private var couponCode: String?
    private(set) var summaryItems: [PKPaymentSummaryItem]

    init(
        request: PaymentRequest,
        paymentRequest: PKPaymentRequest,
        callbacks: PaymentSheetCallbacks,
        timeout: TimeInterval = callbackTimeout
    ) {
        self.callbacks = callbacks
        self.merchantName = PaymentRequestBuilder.resolveMerchantName(from: request)
        self.laterCharges = MerchantTokenRequestBuilder.laterCharges(of: paymentRequest)
        self.timeout = timeout
        let shippingMethods = request.shippingMethods ?? []
        self.paymentItems = request.paymentItems
        self.shippingMethods = shippingMethods
        self.selectedShippingMethodIdentifier = shippingMethods.first?.identifier
        self.couponCode = paymentRequest.couponCode
        self.summaryItems = paymentRequest.paymentSummaryItems
        if #available(iOS 16.0, *), !paymentRequest.multiTokenContexts.isEmpty {
            self.fixedTotal = paymentRequest.paymentSummaryItems.last?.amount.decimalValue
        } else {
            self.fixedTotal = nil
        }
    }

    /// What the payer has chosen so far, as the callbacks get it.
    var selection: PaymentSheetSelection {
        return selection(couponCode: couponCode)
    }

    var selectedShippingMethod: ShippingMethod? {
        return shippingMethod(withIdentifier: selectedShippingMethodIdentifier)
    }

    /// The current entry with this identifier, as the app last sent it.
    func shippingMethod(withIdentifier identifier: String?) -> ShippingMethod? {
        return shippingMethods.first { $0.identifier == identifier }
    }

    // MARK: - Changes in the sheet

    /// PassKit also calls this when the sheet opens. A contact without a
    /// country has no address to report, so the callback isn't called.
    func shippingAddressChanged(
        to contact: PKContact,
        completion: @escaping (PKPaymentRequestShippingContactUpdate) -> Void
    ) {
        guard let address = PassKitTypeMapper.convertSheetAddress(contact) else {
            completion(PKPaymentRequestShippingContactUpdate(errors: nil, paymentSummaryItems: summaryItems, shippingMethods: []))
            return
        }
        shippingAddress = address
        run(callbacks.onShippingAddressChange, with: address) { summaryItems, shippingMethods, errors in
            completion(PKPaymentRequestShippingContactUpdate(
                errors: errors,
                paymentSummaryItems: summaryItems,
                shippingMethods: shippingMethods
            ))
        }
    }

    /// Adds the method's amount to the current items first, so a callback that
    /// fails still leaves the right total. PassKit can't show an error here.
    func shippingMethodChanged(
        to pkMethod: PKShippingMethod,
        completion: @escaping (PKPaymentRequestShippingMethodUpdate) -> Void
    ) {
        selectedShippingMethodIdentifier = pkMethod.identifier
        // The cart was checked when it was set, so this keeps the current
        // items only if rebuilding fails.
        if let items = try? buildSummary(paymentItems, shippingMethod: selectedShippingMethod) {
            summaryItems = items
        }
        guard let method = selectedShippingMethod else {
            completion(PKPaymentRequestShippingMethodUpdate(paymentSummaryItems: summaryItems))
            return
        }
        run(callbacks.onShippingMethodChange, with: method) { summaryItems, shippingMethods, _ in
            let update = PKPaymentRequestShippingMethodUpdate(paymentSummaryItems: summaryItems)
            update.shippingMethods = shippingMethods
            completion(update)
        }
    }

    /// PassKit also calls this when the sheet opens.
    func paymentMethodChanged(
        to pkMethod: PKPaymentMethod,
        completion: @escaping (PKPaymentRequestPaymentMethodUpdate) -> Void
    ) {
        let card = PassKitTypeMapper.convertSheetCard(pkMethod)
        self.card = card
        run(callbacks.onPaymentMethodChange, with: card) { summaryItems, shippingMethods, errors in
            let update = PKPaymentRequestPaymentMethodUpdate(errors: errors, paymentSummaryItems: summaryItems)
            update.shippingMethods = shippingMethods
            completion(update)
        }
    }

    /// The code counts as accepted only when the callback's update applies
    /// without an error.
    func couponCodeChanged(
        to code: String,
        completion: @escaping (PKPaymentRequestCouponCodeUpdate) -> Void
    ) {
        let candidate = code.isEmpty ? nil : code
        run(
            callbacks.onCouponCodeChange,
            with: code,
            selection: selection(couponCode: candidate),
            onAccepted: { self.couponCode = candidate }
        ) { summaryItems, shippingMethods, errors in
            completion(PKPaymentRequestCouponCodeUpdate(
                errors: errors,
                paymentSummaryItems: summaryItems,
                shippingMethods: shippingMethods
            ))
        }
    }

    // MARK: - Running a callback

    /// Calls `callback` and hands `complete` the summary items, the shipping
    /// methods (empty when they don't change, as PassKit reads it) and the
    /// errors to show. Without
    /// a callback, or when it rejects, times out or returns an update this
    /// can't apply, the sheet keeps its items and shows no error.
    private func run<Value>(
        _ callback: SheetCallback<Value>?,
        with value: Value,
        selection: PaymentSheetSelection? = nil,
        onAccepted: (() -> Void)? = nil,
        complete: @escaping ([PKPaymentSummaryItem], [PKShippingMethod], [Error]) -> Void
    ) {
        guard let callback else {
            complete(summaryItems, [], [])
            return
        }

        // PassKit waits for each change, so it completes exactly once. A late
        // answer after the timeout changes nothing.
        var isSettled = false
        let settle = { (update: PaymentSheetUpdate?) in
            guard !isSettled else { return }
            isSettled = true
            guard let update, let shippingMethods = try? self.apply(update) else {
                complete(self.summaryItems, [], [])
                return
            }
            if update.error == nil {
                onAccepted?()
            }
            complete(self.summaryItems, shippingMethods, update.error.map { [Self.convert($0)] } ?? [])
        }
        // Nitro settles JS promises on the JS thread.
        let settleOnMain = { (update: PaymentSheetUpdate?) in
            DispatchQueue.main.async { settle(update) }
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + timeout) { settle(nil) }

        callback(value, selection ?? self.selection)
            .then { update in
                update
                    .then { settleOnMain($0) }
                    .catch { _ in settleOnMain(nil) }
            }
            .catch { _ in settleOnMain(nil) }
    }

    /// Applies `update` to the cart, or throws and changes nothing. Returns
    /// the new shipping methods for PassKit, empty when they don't change.
    private func apply(_ update: PaymentSheetUpdate) throws -> [PKShippingMethod] {
        let items = update.paymentItems ?? paymentItems
        var methods = shippingMethods
        var selectedIdentifier = selectedShippingMethodIdentifier
        var pkMethods: [PKShippingMethod] = []

        if let newMethods = update.shippingMethods {
            guard !newMethods.isEmpty else { throw UnusableSheetUpdate() }
            var newPKMethods = try PaymentRequestBuilder.buildShippingMethods(newMethods)
            // With a fixed total every method must cost the same, or picking
            // another one would change it. The total check below covers the
            // selected one.
            if fixedTotal != nil {
                let amounts = newPKMethods.map(\.amount.decimalValue)
                guard amounts.allSatisfy({ $0 == amounts[0] }) else { throw UnusableSheetUpdate() }
            }
            // The selected method stays selected while it is in the list.
            // PassKit selects the first method, so move it there.
            let index = newMethods.firstIndex { $0.identifier == selectedIdentifier } ?? 0
            methods = newMethods
            methods.insert(methods.remove(at: index), at: 0)
            newPKMethods.insert(newPKMethods.remove(at: index), at: 0)
            selectedIdentifier = methods[0].identifier
            pkMethods = newPKMethods
        }

        let selected = methods.first { $0.identifier == selectedIdentifier }
        let newSummary = try buildSummary(items, shippingMethod: selected)
        if let fixedTotal, newSummary.last?.amount.decimalValue != fixedTotal {
            throw UnusableSheetUpdate()
        }
        summaryItems = newSummary
        paymentItems = items
        shippingMethods = methods
        selectedShippingMethodIdentifier = selectedIdentifier
        return pkMethods
    }

    private func buildSummary(
        _ items: [PaymentItem],
        shippingMethod: ShippingMethod?
    ) throws -> [PKPaymentSummaryItem] {
        return try PaymentRequestBuilder.buildSummaryItems(
            items,
            shippingMethod: shippingMethod,
            merchantName: merchantName,
            laterCharges: laterCharges
        )
    }

    private func selection(couponCode: String?) -> PaymentSheetSelection {
        return PaymentSheetSelection(
            shippingAddress: shippingAddress,
            shippingMethod: selectedShippingMethod,
            card: card,
            couponCode: couponCode
        )
    }

    /// The error PassKit shows for `error`. Internal so the unit tests can check it.
    static func convert(_ error: PaymentSheetError) -> Error {
        switch error.code {
        case .shippingaddressinvalid:
            return PKPaymentRequest.paymentContactInvalidError(
                withContactField: .postalAddress,
                localizedDescription: error.message
            )
        case .shippingaddressunserviceable:
            return PKPaymentRequest.paymentShippingAddressUnserviceableError(withLocalizedDescription: error.message)
        case .couponcodeinvalid:
            return paymentError(.couponCodeInvalidError, error.message)
        case .couponcodeexpired:
            return paymentError(.couponCodeExpiredError, error.message)
        case .other:
            return paymentError(.unknownError, error.message)
        }
    }

    private static func paymentError(_ code: PKPaymentError.Code, _ message: String) -> Error {
        return PKPaymentError(code, userInfo: [NSLocalizedDescriptionKey: message])
    }
}
