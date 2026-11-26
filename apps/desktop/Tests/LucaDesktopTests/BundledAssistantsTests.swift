import XCTest
@testable import LucaDesktop

final class BundledAssistantsTests: XCTestCase {
    private var root: URL!
    private var source: URL { root.appendingPathComponent("bundle") }
    private var target: URL { root.appendingPathComponent("home") }

    override func setUpWithError() throws {
        root = FileManager.default.temporaryDirectory.appendingPathComponent("bundled-assistants-\(UUID().uuidString)")
        try makeAssistant(build: "1", core: "v1")
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: root)
    }

    private func makeAssistant(build: String, core: String) throws {
        let folder = source.appendingPathComponent("lucaExpert")
        try? FileManager.default.removeItem(at: folder)
        try FileManager.default.createDirectory(at: folder.appendingPathComponent("skills/a"), withIntermediateDirectories: true)
        try core.write(to: folder.appendingPathComponent("CORE.md"), atomically: true, encoding: .utf8)
        try "skill".write(to: folder.appendingPathComponent("skills/a/SKILL.md"), atomically: true, encoding: .utf8)
        try build.write(to: folder.appendingPathComponent(BundledAssistants.stampName), atomically: true, encoding: .utf8)
    }

    private func installedCore() throws -> String {
        try String(contentsOf: target.appendingPathComponent("lucaExpert/CORE.md"), encoding: .utf8)
    }

    private func outcome() throws -> BundledAssistants.Outcome {
        let results = BundledAssistants.install(from: source, to: target)
        XCTAssertEqual(results.map(\.0), ["lucaExpert"])
        return try results[0].1.get()
    }

    func testInstallsThenStaysCurrent() throws {
        XCTAssertEqual(try outcome(), .installed)
        XCTAssertEqual(try installedCore(), "v1")
        XCTAssertTrue(FileManager.default.fileExists(atPath: target.appendingPathComponent("lucaExpert/skills/a/SKILL.md").path))
        XCTAssertEqual(try outcome(), .current)
    }

    func testNewBuildReplacesTheCopyTheAppInstalled() throws {
        _ = try outcome()
        try makeAssistant(build: "2", core: "v2")
        XCTAssertEqual(try outcome(), .updated)
        XCTAssertEqual(try installedCore(), "v2")
    }

    func testLeavesAHandMadeFolderAlone() throws {
        let mine = target.appendingPathComponent("lucaExpert")
        try FileManager.default.createDirectory(at: mine, withIntermediateDirectories: true)
        try "mine".write(to: mine.appendingPathComponent("CORE.md"), atomically: true, encoding: .utf8)
        XCTAssertEqual(try outcome(), .handMade)
        XCTAssertEqual(try installedCore(), "mine")
    }
}
