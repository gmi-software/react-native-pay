import XCTest
@testable import NitroPay

final class PendingPaymentTests: XCTestCase {

    func testSettlesTheClaimedPayment() {
        let pending = PendingPayment<String>()
        var settled: [String] = []

        XCTAssertTrue(pending.tryBegin { settled.append($0) })
        XCTAssertTrue(pending.settle("done"))

        XCTAssertEqual(settled, ["done"])
    }

    func testRejectsOverlapWithoutReplacingTheInFlightPayment() {
        let pending = PendingPayment<String>()
        var first: [String] = []
        var second: [String] = []

        XCTAssertTrue(pending.tryBegin { first.append($0) })
        XCTAssertFalse(pending.tryBegin { second.append($0) })
        pending.settle("done")

        XCTAssertEqual(first, ["done"])
        XCTAssertEqual(second, [])
    }

    func testSettlesOnlyOnce() {
        let pending = PendingPayment<String>()
        var settled: [String] = []

        XCTAssertTrue(pending.tryBegin { settled.append($0) })

        XCTAssertTrue(pending.settle("first"))
        XCTAssertFalse(pending.settle("second"))
        XCTAssertEqual(settled, ["first"])
    }

    func testSettleWithoutPaymentIsNoOp() {
        let pending = PendingPayment<String>()

        XCTAssertFalse(pending.settle("orphan"))
    }

    func testAcceptsNewPaymentAfterSettle() {
        let pending = PendingPayment<String>()
        var settled: [String] = []

        XCTAssertTrue(pending.tryBegin { settled.append("a:\($0)") })
        pending.settle("1")

        XCTAssertTrue(pending.tryBegin { settled.append("b:\($0)") })
        pending.settle("2")

        XCTAssertEqual(settled, ["a:1", "b:2"])
    }

    func testIsInProgressFollowsTheSlot() {
        let pending = PendingPayment<String>()

        XCTAssertFalse(pending.isInProgress)

        XCTAssertTrue(pending.tryBegin { _ in })
        XCTAssertTrue(pending.isInProgress)

        XCTAssertFalse(pending.tryBegin { _ in })
        XCTAssertTrue(pending.isInProgress)

        pending.settle("done")
        XCTAssertFalse(pending.isInProgress)
    }

    func testConcurrentBeginsClaimTheSlotOnce() {
        let pending = PendingPayment<Int>()
        let lock = NSLock()
        var claims = 0

        DispatchQueue.concurrentPerform(iterations: 16) { _ in
            if pending.tryBegin({ _ in }) {
                lock.lock()
                claims += 1
                lock.unlock()
            }
        }

        XCTAssertEqual(claims, 1)
    }
}
