import XCTest
@testable import LucaDesktop

final class BundledPortfolioTests: XCTestCase {
    private var root: URL!
    private var source: URL { root.appendingPathComponent("bundle") }
    private var target: URL { root.appendingPathComponent("portfolio") }

    override func setUpWithError() throws {
        root = FileManager.default.temporaryDirectory.appendingPathComponent("bundled-portfolio-\(UUID().uuidString)")
        try put("portfolio.yml", "roots: [a]", in: source)
        try put("features/portfolio.ts", "v1", in: source)
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: root)
    }

    private func put(_ rel: String, _ text: String, in base: URL) throws {
        let url = base.appendingPathComponent(rel)
        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        try text.write(to: url, atomically: true, encoding: .utf8)
    }

    private func read(_ rel: String) throws -> String {
        try String(contentsOf: target.appendingPathComponent(rel), encoding: .utf8)
    }

    func testInstallsThenStaysCurrent() throws {
        let first = try BundledPortfolio.install(from: source, to: target)
        XCTAssertEqual(first, ["portfolio.yml": .installed, "features/portfolio.ts": .installed])
        XCTAssertEqual(try read("features/portfolio.ts"), "v1")
        let again = try BundledPortfolio.install(from: source, to: target)
        XCTAssertEqual(again, ["portfolio.yml": .current, "features/portfolio.ts": .current])
    }

    func testUpdatesUntouchedFilesAndKeepsChangedOnes() throws {
        _ = try BundledPortfolio.install(from: source, to: target)
        try put("portfolio.yml", "roots: [mine]", in: target)
        try put("portfolio.yml", "roots: [b]", in: source)
        try put("features/portfolio.ts", "v2", in: source)

        let results = try BundledPortfolio.install(from: source, to: target)
        XCTAssertEqual(results["features/portfolio.ts"], .updated)
        XCTAssertEqual(results["portfolio.yml"], .kept)
        XCTAssertEqual(try read("features/portfolio.ts"), "v2")
        XCTAssertEqual(try read("portfolio.yml"), "roots: [mine]")
    }

    func testAFileThatWasThereFirstIsKept() throws {
        try put("features/portfolio.ts", "hand made", in: target)
        let results = try BundledPortfolio.install(from: source, to: target)
        XCTAssertEqual(results["features/portfolio.ts"], .kept)
        XCTAssertEqual(try read("features/portfolio.ts"), "hand made")
    }

    func testPortfolioIdIsNeverGivenToAFolder() {
        var list = ProjectList()
        let entry = list.add(path: "/tmp/x/luca-portfolio", now: Date())
        XCTAssertNotEqual(entry.id, PortfolioProject.id)
        XCTAssertEqual(PortfolioProject.newChat.description, "luca://luca-portfolio/chat/new?assistant=lucaPortfolio")
    }

    @MainActor
    func testHubKnowsThePortfolioWithoutListingIt() {
        XCTAssertEqual(ProjectHub.shared.project(PortfolioProject.id)?.path, BundledPortfolio.destination.path)
        XCTAssertFalse(ProjectHub.shared.recent.contains { $0.id == PortfolioProject.id })
    }

    private func reviewEvent(_ body: String) throws -> WorkbenchEvent {
        try JSONDecoder().decode(WorkbenchEvent.self, from: Data(body.utf8))
    }

    func testReviewEventBecomesCopyRequests() throws {
        let event = try reviewEvent(#"{"type":"event","registry":"features","id":"portfolio","name":"review","args":[{"target":"/p/poker","changes":[{"registry":"features","id":"microsoftGraph","file":"/p/shop/features/microsoft-graph.ts","root":"/p/shop"},{"registry":"commands","id":"x","file":"relative.ts","root":"/p/shop"}]}]}"#)
        let review = try XCTUnwrap(PortfolioReview(event: event))
        XCTAssertEqual(review.target, "/p/poker")
        XCTAssertEqual(review.changes, [ChangeRequest(route: "borrow", op: "copy", registry: "features", id: "microsoftGraph", file: "/p/shop/features/microsoft-graph.ts", root: "/p/shop")])
    }

    func testOtherEventsAreNotReviews() throws {
        XCTAssertNil(PortfolioReview(event: try reviewEvent(#"{"type":"event","registry":"features","id":"other","name":"review","args":[{"target":"/p","changes":[]}]}"#)))
        XCTAssertNil(PortfolioReview(event: try reviewEvent(#"{"type":"canvas-open","id":"c1"}"#)))
    }

    @MainActor
    func testColumnGoesRightWhenThereIsRoom() {
        let screen = CGRect(x: 0, y: 0, width: 3000, height: 1000)
        let anchor = CGRect(x: 0, y: 100, width: 1000, height: 800)
        let placed = Shell.columnBeside(anchor, screen: screen, count: 2, width: 900)
        XCTAssertEqual(placed.anchor, anchor)
        XCTAssertEqual(placed.column.count, 2)
        XCTAssertEqual(placed.column[0].minX, anchor.maxX + Shell.gap)
        XCTAssertEqual(placed.column[0].maxY, anchor.maxY)
        XCTAssertLessThan(placed.column[1].maxY, placed.column[0].minY)
    }

    @MainActor
    func testWithNoRoomTheAnchorGivesUpHalf() {
        let screen = CGRect(x: 0, y: 0, width: 2000, height: 1000)
        let anchor = CGRect(x: 0, y: 0, width: 1280, height: 900)
        let placed = Shell.columnBeside(anchor, screen: screen, count: 1, width: 1280)
        XCTAssertFalse(placed.anchor.intersects(placed.column[0]))
        XCTAssertEqual(placed.anchor.minX, 0)
        XCTAssertEqual(placed.column[0].maxX, anchor.maxX)
    }
}
