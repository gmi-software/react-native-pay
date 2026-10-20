import Foundation

extension PaymentAmount {
    private static let decimalPattern = "^-?[0-9]+(\\.[0-9]+)?$"
    private static let posixLocale = Locale(identifier: "en_US_POSIX")

    /// The exact decimal value, or `nil` unless the amount is a plain decimal.
    ///
    /// Numbers are read through their shortest round-trip description, so
    /// `19.99` becomes exactly 19.99. `Decimal(19.99)` would give
    /// 19.98999999999999488.
    var decimalNumber: NSDecimalNumber? {
        let text: String
        switch self {
        case .first(let number):
            guard number.isFinite else { return nil }
            text = "\(number)"
        case .second(let string):
            text = string
        }

        guard text.range(of: Self.decimalPattern, options: .regularExpression) != nil else {
            return nil
        }
        let decimal = NSDecimalNumber(string: text, locale: Self.posixLocale)
        return decimal == NSDecimalNumber.notANumber ? nil : decimal
    }
}
