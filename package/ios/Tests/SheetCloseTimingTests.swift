import XCTest
@testable import NitroPay

final class SheetCloseTimingTests: XCTestCase {

    private var clock: TimeInterval = 100

    private func timing() -> SheetCloseTiming {
        return SheetCloseTiming { self.clock }
    }

    /// Presents the sheet now and closes it `seconds` later.
    private func closedEarly(after seconds: TimeInterval) -> Bool {
        let timing = timing()
        timing.sheetPresented()
        clock += seconds
        timing.sheetClosed()
        return timing.closedEarly
    }

    func testAQuickCloseIsEarly() {
        XCTAssertTrue(closedEarly(after: 0.3))
    }

    func testACloseAfterTheThresholdIsNotEarly() {
        XCTAssertFalse(closedEarly(after: 2))
    }

    func testACloseAtExactlyTheThresholdIsNotEarly() {
        XCTAssertFalse(closedEarly(after: SheetCloseTiming.threshold))
    }

    func testACloseBeforeTheSheetFinishedAppearingIsEarly() {
        let timing = timing()
        clock += 5
        timing.sheetClosed()

        XCTAssertTrue(timing.closedEarly)
    }

    func testAPresentationReportedAfterTheCloseIsEarly() {
        let timing = timing()
        timing.sheetClosed()
        clock += 0.2
        timing.sheetPresented()

        XCTAssertTrue(timing.closedEarly)
    }

    func testIgnoresTimeAfterTheClose() {
        let timing = timing()
        timing.sheetPresented()
        clock += 0.5
        timing.sheetClosed()
        // The dismiss animation and the hop to the main queue come after.
        clock += 2

        XCTAssertTrue(timing.closedEarly)
    }

    func testWithoutARecordedCloseMeasuresToNow() {
        let timing = timing()
        timing.sheetPresented()
        clock += 2

        XCTAssertFalse(timing.closedEarly)
    }
}
