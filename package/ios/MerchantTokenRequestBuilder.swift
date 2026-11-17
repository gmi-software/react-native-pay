import Foundation
import PassKit

private enum ErrorMessage {
    static let moreThanOneRequest = "Set at most one of recurring, deferred and automaticReload"

    static func needsNewerIOS(_ field: String, _ version: String) -> String {
        return "Apple Pay \(field) payments need iOS \(version) or later"
    }

    static func invalidUrl(_ field: String, _ url: String) -> String {
        return "\(field) must be an https URL, got \"\(url)\""
    }

    static func unknownTimeZone(_ identifier: String) -> String {
        return "Unknown time zone \"\(identifier)\". Use an IANA name such as \"Europe/Warsaw\""
    }
}

/// Maps `recurring`, `deferred` and `automaticReload` to their PassKit
/// requests. The JS side validates the rest; this only rejects what PassKit
/// can't take. Internal so the NitroPay unit tests can reach it.
enum MerchantTokenRequestBuilder {

    /// Sets the request's recurring, deferred or automatic reload request.
    static func configure(_ paymentRequest: PKPaymentRequest, from request: PaymentRequest) throws {
        switch (request.recurring, request.deferred, request.automaticReload) {
        case (nil, nil, nil):
            return
        case let (recurring?, nil, nil):
            guard #available(iOS 16.0, *) else {
                throw PaymentFailure(code: .notAvailable, message: ErrorMessage.needsNewerIOS("recurring", "16"))
            }
            paymentRequest.recurringPaymentRequest = try buildRecurring(recurring)
        case let (nil, deferred?, nil):
            guard #available(iOS 16.4, *) else {
                throw PaymentFailure(code: .notAvailable, message: ErrorMessage.needsNewerIOS("deferred", "16.4"))
            }
            paymentRequest.deferredPaymentRequest = try buildDeferred(deferred)
        case let (nil, nil, automaticReload?):
            guard #available(iOS 16.0, *) else {
                throw PaymentFailure(code: .notAvailable, message: ErrorMessage.needsNewerIOS("automaticReload", "16"))
            }
            paymentRequest.automaticReloadPaymentRequest = try buildAutomaticReload(automaticReload)
        default:
            throw PaymentFailure.configuration(ErrorMessage.moreThanOneRequest)
        }
    }

    /// The billing items of the request's recurring, deferred or automatic
    /// reload request, for the sheet to list before the total.
    static func laterCharges(of paymentRequest: PKPaymentRequest) -> [PKPaymentSummaryItem] {
        if #available(iOS 16.4, *), let deferred = paymentRequest.deferredPaymentRequest {
            return [deferred.deferredBilling]
        }
        guard #available(iOS 16.0, *) else { return [] }
        if let recurring = paymentRequest.recurringPaymentRequest {
            return [recurring.trialBilling, recurring.regularBilling].compactMap { $0 }
        }
        if let automaticReload = paymentRequest.automaticReloadPaymentRequest {
            return [automaticReload.automaticReloadBilling]
        }
        return []
    }

    // MARK: - Recurring

    /// The regular phase starts when the trial ends, unless it has its own start.
    @available(iOS 16.0, *)
    private static func buildRecurring(_ recurring: RecurringPaymentRequest) throws -> PKRecurringPaymentRequest {
        let pkRequest = PKRecurringPaymentRequest(
            paymentDescription: recurring.description,
            regularBilling: try recurringItem(
                recurring.regularBilling,
                defaultStartDate: recurring.trialBilling?.endDate
            ),
            managementURL: try url("managementUrl", recurring.managementUrl)
        )
        pkRequest.trialBilling = try recurring.trialBilling.map { try recurringItem($0, defaultStartDate: nil) }
        pkRequest.billingAgreement = recurring.billingAgreement
        pkRequest.tokenNotificationURL = try recurring.tokenNotificationUrl.map { try url("tokenNotificationUrl", $0) }
        return pkRequest
    }

    @available(iOS 16.0, *)
    private static func recurringItem(
        _ item: RecurringBillingItem,
        defaultStartDate: Date?
    ) throws -> PKRecurringPaymentSummaryItem {
        let pkItem = PKRecurringPaymentSummaryItem(
            label: item.label,
            amount: try item.amount.decimalNumber(for: item.label)
        )
        pkItem.intervalUnit = PassKitTypeMapper.convert(item.intervalUnit)
        pkItem.intervalCount = Int(item.intervalCount ?? 1)
        pkItem.startDate = item.startDate ?? defaultStartDate
        pkItem.endDate = item.endDate
        return pkItem
    }

    // MARK: - Deferred

    @available(iOS 16.4, *)
    private static func buildDeferred(_ deferred: DeferredPaymentRequest) throws -> PKDeferredPaymentRequest {
        let billing = deferred.deferredBilling
        let pkItem = PKDeferredPaymentSummaryItem(
            label: billing.label,
            amount: try billing.amount.decimalNumber(for: billing.label)
        )
        pkItem.deferredDate = billing.date
        let pkRequest = PKDeferredPaymentRequest(
            paymentDescription: deferred.description,
            deferredBilling: pkItem,
            managementURL: try url("managementUrl", deferred.managementUrl)
        )
        // PassKit needs both or neither.
        if let freeCancellation = deferred.freeCancellation {
            guard let timeZone = TimeZone(identifier: freeCancellation.timeZone) else {
                throw PaymentFailure.configuration(ErrorMessage.unknownTimeZone(freeCancellation.timeZone))
            }
            pkRequest.freeCancellationDate = freeCancellation.date
            pkRequest.freeCancellationDateTimeZone = timeZone
        }
        pkRequest.billingAgreement = deferred.billingAgreement
        pkRequest.tokenNotificationURL = try deferred.tokenNotificationUrl.map { try url("tokenNotificationUrl", $0) }
        return pkRequest
    }

    // MARK: - Automatic reload

    @available(iOS 16.0, *)
    private static func buildAutomaticReload(
        _ automaticReload: AutomaticReloadPaymentRequest
    ) throws -> PKAutomaticReloadPaymentRequest {
        let billing = automaticReload.automaticReloadBilling
        let pkItem = PKAutomaticReloadPaymentSummaryItem(
            label: billing.label,
            amount: try billing.amount.decimalNumber(for: billing.label)
        )
        pkItem.thresholdAmount = try billing.thresholdAmount.decimalNumber(for: billing.label)
        let pkRequest = PKAutomaticReloadPaymentRequest(
            paymentDescription: automaticReload.description,
            automaticReloadBilling: pkItem,
            managementURL: try url("managementUrl", automaticReload.managementUrl)
        )
        pkRequest.billingAgreement = automaticReload.billingAgreement
        pkRequest.tokenNotificationURL = try automaticReload.tokenNotificationUrl.map {
            try url("tokenNotificationUrl", $0)
        }
        return pkRequest
    }

    // MARK: - Values

    private static func url(_ field: String, _ string: String) throws -> URL {
        guard let url = URL(string: string), url.scheme?.lowercased() == "https", url.host != nil else {
            throw PaymentFailure.configuration(ErrorMessage.invalidUrl(field, string))
        }
        return url
    }
}
