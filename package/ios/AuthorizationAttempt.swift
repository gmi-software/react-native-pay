import Foundation

/// Settles one `onAuthorize` attempt once: with the merchant's outcome, or
/// with `timeoutResult` when `timeout` passes first.
///
/// Settling cancels the timer and drops `onSettle`, so nothing it captures,
/// such as the delegate holding the token, outlives the attempt. A cancelled
/// `DispatchWorkItem` would keep its block until the deadline. Main thread only.
final class AuthorizationAttempt<T> {
    private var onSettle: ((T) -> Void)?
    private let timer = DispatchSource.makeTimerSource(queue: .main)

    init(timeout: TimeInterval, timeoutResult: T, onSettle: @escaping (T) -> Void) {
        self.onSettle = onSettle
        // Holds the attempt until it settles, so the timeout fires even when
        // nobody else keeps it. Cancelling releases this handler.
        timer.setEventHandler { self.settle(timeoutResult) }
        timer.schedule(deadline: .now() + timeout)
        timer.resume()
    }

    /// Returns `false` if the attempt has already settled.
    @discardableResult
    func settle(_ result: T) -> Bool {
        guard let onSettle else { return false }
        self.onSettle = nil
        timer.cancel()
        onSettle(result)
        return true
    }
}
