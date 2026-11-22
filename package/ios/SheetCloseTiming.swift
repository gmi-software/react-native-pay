import Foundation

/// Tells, from timing alone, when the Apple Pay sheet probably closed by
/// itself rather than because the user cancelled it.
///
/// PassKit gives no reason when the sheet closes before authorization, and a
/// sheet that Apple Pay refuses, for example for a merchant ID it isn't set
/// up for, closes right after it appears. Main thread only.
/// Internal, not private, so the NitroPay unit tests can reach it.
final class SheetCloseTiming {
    /// A close sooner than this after the sheet appeared is treated as early.
    static let threshold: TimeInterval = 1

    /// Seconds on a monotonic clock, so a change to the device clock can't
    /// shift the measurement.
    private let now: () -> TimeInterval
    private var presentedAt: TimeInterval?
    private var closedAt: TimeInterval?

    init(now: @escaping () -> TimeInterval = SheetCloseTiming.uptime) {
        self.now = now
    }

    /// The clock the payment flow uses. Safe to read on any thread.
    static func uptime() -> TimeInterval {
        return ProcessInfo.processInfo.systemUptime
    }

    /// Records that the sheet finished appearing at `presentedAt`, read on
    /// this timing's clock. PassKit reports it on any thread, and the hop to
    /// the main thread can wait, so the time is read before the hop.
    func sheetPresented(at presentedAt: TimeInterval) {
        self.presentedAt = presentedAt
    }

    /// Records that the sheet has started to close.
    func sheetClosed() {
        closedAt = now()
    }

    /// Whether the sheet closed too soon after it appeared to be a user's
    /// cancel. A sheet that closed before it finished appearing did. Without
    /// a recorded close, the close is now.
    var closedEarly: Bool {
        let closedAt = closedAt ?? now()
        guard let presentedAt else { return true }
        return closedAt - presentedAt < Self.threshold
    }
}

/// Debug builds only, like the Android `PayLog`: the payment request holds
/// merchant IDs, item labels and amounts, so nothing from it goes here.
enum PayLog {
    static func warn(_ message: String) {
        #if DEBUG
        NSLog("[NitroPay] %@", message)
        #endif
    }
}
