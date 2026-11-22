import XCTest
@testable import NitroPay

/// Stands in for the delegate, which holds the payment token.
private final class Probe {}

final class AuthorizationAttemptTests: XCTestCase {

    func testSettlesWithTheOutcome() {
        var settled: [String] = []
        let attempt = AuthorizationAttempt(timeout: 60, timeoutResult: "timeout") { settled.append($0) }

        XCTAssertTrue(attempt.settle("done"))

        XCTAssertEqual(settled, ["done"])
    }

    func testSettlesOnlyOnce() {
        var settled: [String] = []
        let attempt = AuthorizationAttempt(timeout: 60, timeoutResult: "timeout") { settled.append($0) }

        XCTAssertTrue(attempt.settle("first"))
        XCTAssertFalse(attempt.settle("second"))

        XCTAssertEqual(settled, ["first"])
    }

    func testSettlesWithTheTimeoutResultWhenNobodyHoldsIt() {
        let timedOut = expectation(description: "timed out")
        var settled: [String] = []
        _ = AuthorizationAttempt(timeout: 0.05, timeoutResult: "timeout") {
            settled.append($0)
            timedOut.fulfill()
        }

        wait(for: [timedOut], timeout: 2)
        XCTAssertEqual(settled, ["timeout"])
    }

    func testIgnoresTheTimeoutAfterSettling() {
        var settled: [String] = []
        let attempt = AuthorizationAttempt(timeout: 0.05, timeoutResult: "timeout") { settled.append($0) }
        attempt.settle("done")

        drainMain(for: 0.2)

        XCTAssertEqual(settled, ["done"])
    }

    func testReleasesWhatItCapturesOnSettle() {
        var probe: Probe? = Probe()
        weak var weakProbe = probe
        weak var weakAttempt: AuthorizationAttempt<String>?
        do {
            let attempt = AuthorizationAttempt(timeout: 60, timeoutResult: "timeout") { [probe] _ in
                _ = probe
            }
            weakAttempt = attempt
            probe = nil
            XCTAssertNotNil(weakProbe)

            attempt.settle("done")
        }

        XCTAssertNil(weakProbe)
        // The cancelled timer releases its handler, and with it the attempt, on main.
        drainMain(for: 0.1)
        XCTAssertNil(weakAttempt)
    }

    private func drainMain(for interval: TimeInterval) {
        let drained = expectation(description: "main drained")
        DispatchQueue.main.asyncAfter(deadline: .now() + interval) { drained.fulfill() }
        wait(for: [drained], timeout: interval + 2)
    }
}
