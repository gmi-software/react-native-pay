import Foundation

/// Holds the settle callback of the single in-flight payment.
///
/// `startPayment` claims it on the JS thread while PassKit settles it on the
/// main thread, so claiming and settling go through one lock.
final class PendingPayment<T> {
    private let lock = NSLock()
    private var settleCallback: ((T) -> Void)?

    /// Whether a payment has claimed the slot and not settled yet.
    var isInProgress: Bool {
        lock.lock()
        defer { lock.unlock() }
        return settleCallback != nil
    }

    /// Claims the slot for a new payment.
    /// Returns `false` without touching the in-flight payment if one exists.
    func tryBegin(_ settle: @escaping (T) -> Void) -> Bool {
        lock.lock()
        defer { lock.unlock() }
        guard settleCallback == nil else { return false }
        settleCallback = settle
        return true
    }

    /// Settles the in-flight payment once and frees the slot.
    /// Returns `false` if there was nothing to settle.
    @discardableResult
    func settle(_ result: T) -> Bool {
        lock.lock()
        let settle = settleCallback
        settleCallback = nil
        lock.unlock()

        guard let settle else { return false }
        settle(result)
        return true
    }
}
