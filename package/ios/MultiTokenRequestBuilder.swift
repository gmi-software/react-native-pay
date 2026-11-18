import Foundation
import PassKit

private enum ErrorMessage {
    static let withMerchantTokenRequest =
        "applePayMultiTokenContexts can't be combined with recurring, deferred or automaticReload"
    static let needsNewerIOS = "Apple Pay payments to several merchants need iOS 16 or later"

    static func emptyField(_ field: String) -> String {
        return "applePayMultiTokenContexts \(field) must not be empty"
    }

    static func notPositive(_ merchantName: String) -> String {
        return "Amount for \"\(merchantName)\" must be positive"
    }

    static let shippingMethodsDiffer =
        "With applePayMultiTokenContexts, all shipping methods must cost the same: another method would change the total"

    static func notTheTotal(_ sum: NSDecimalNumber, _ total: NSDecimalNumber) -> String {
        return "applePayMultiTokenContexts amounts must add up to the total of \(total.stringValue), got \(sum.stringValue)"
    }
}

/// Maps `applePayMultiTokenContexts` to PassKit's `multiTokenContexts`. The
/// JS side validates the same rules; this keeps PassKit from refusing the
/// sheet without a reason. Internal so the NitroPay unit tests can reach it.
enum MultiTokenRequestBuilder {

    /// Sets the request's multi-token contexts. Call it once the summary
    /// items and shipping methods are set.
    ///
    /// Apple's documentation lets the contexts add up to less than the total,
    /// but PassKit refuses the request unless they add up to exactly the
    /// total ("The sum of all payment token context amounts must be equal to
    /// the PKPaymentRequest total", iOS 26.5). So the shipping methods must
    /// all cost the same, or picking another one would break it.
    static func configure(_ paymentRequest: PKPaymentRequest, from request: PaymentRequest) throws {
        guard let contexts = request.applePayMultiTokenContexts, !contexts.isEmpty else {
            return
        }
        guard request.recurring == nil, request.deferred == nil, request.automaticReload == nil else {
            throw PaymentFailure.configuration(ErrorMessage.withMerchantTokenRequest)
        }
        guard #available(iOS 16.0, *) else {
            throw PaymentFailure(code: .notAvailable, message: ErrorMessage.needsNewerIOS)
        }

        let shippingAmounts = paymentRequest.shippingMethods?.map(\.amount.decimalValue) ?? []
        guard shippingAmounts.allSatisfy({ $0 == shippingAmounts.first }) else {
            throw PaymentFailure.configuration(ErrorMessage.shippingMethodsDiffer)
        }

        let pkContexts = try contexts.map(buildContext)
        let sum = pkContexts.reduce(Decimal.zero) { $0 + $1.amount.decimalValue }
        let total = paymentRequest.paymentSummaryItems.last?.amount.decimalValue ?? Decimal.zero
        guard sum == total else {
            throw PaymentFailure.configuration(ErrorMessage.notTheTotal(
                NSDecimalNumber(decimal: sum),
                NSDecimalNumber(decimal: total)
            ))
        }
        paymentRequest.multiTokenContexts = pkContexts
    }

    @available(iOS 16.0, *)
    private static func buildContext(_ context: PaymentTokenContext) throws -> PKPaymentTokenContext {
        try checkNotEmpty("merchantIdentifier", context.merchantIdentifier)
        try checkNotEmpty("externalIdentifier", context.externalIdentifier)
        try checkNotEmpty("merchantName", context.merchantName)
        let amount = try context.amount.decimalNumber(for: context.merchantName)
        guard amount.decimalValue > Decimal.zero else {
            throw PaymentFailure.configuration(ErrorMessage.notPositive(context.merchantName))
        }
        return PKPaymentTokenContext(
            merchantIdentifier: context.merchantIdentifier,
            externalIdentifier: context.externalIdentifier,
            merchantName: context.merchantName,
            merchantDomain: context.merchantDomain,
            amount: amount
        )
    }

    private static func checkNotEmpty(_ field: String, _ value: String) throws {
        if value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            throw PaymentFailure.configuration(ErrorMessage.emptyField(field))
        }
    }
}
