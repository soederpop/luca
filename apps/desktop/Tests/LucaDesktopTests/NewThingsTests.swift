import XCTest
@testable import LucaDesktop

/// Making new things from the app: a project (`luca bootstrap`), a helper
/// (`luca scaffold`), a document (`POST /docs/create`).
final class NewThingsTests: XCTestCase {
    func testTheKeysAreInTheDefaultKeymap() {
        let map = Keymap.merged(defaults: DefaultKeymap.file, user: nil)
        let expected: [(String, String, String?)] = [
            ("projects.new", "Space N", nil),
            ("luca.scaffold", "Space S", nil),
            ("appProjects.new", "n", "app-projects"),
            ("lucaDocs.new", "n", "luca-docs"),
        ]
        for (action, spec, kind) in expected {
            let binding = map.binding(for: action)
            XCTAssertEqual(binding?.spec, spec, action)
            XCTAssertFalse(binding?.label.isEmpty ?? true, action)
            if let kind { XCTAssertEqual(binding?.kind, kind, action) }
        }
    }

    func testTheFileScaffoldWroteIsReadFromItsOutput() {
        XCTAssertEqual(CommandContent.scaffoldedPath(in: "  ✓ Wrote feature scaffold to features/disk-cache.ts\n  Next: edit the file\n"), "features/disk-cache.ts")
        XCTAssertEqual(CommandContent.scaffoldedPath(in: "\n  ✓ Scaffolded assistant \"chief\" in assistants/chief/\n    CORE.md   — system prompt\n"), "assistants/chief/CORE.md")
        XCTAssertNil(CommandContent.scaffoldedPath(in: "  ✗ File already exists: features/x.ts\n"))
        XCTAssertNil(CommandContent.scaffoldedPath(in: ""))
    }

    func testACommandFormDecodesItsSubcommandsAndTakesTheirAbsence() throws {
        let json = """
        {"id":"scaffold","title":"luca scaffold","summary":"s","badge":null,"usage":"luca scaffold [type] [name] [flags]","fields":[],"examples":[],
         "subcommands":[{"name":"feature","args":"<name>","description":"A capability → features/<name>.ts"}]}
        """
        let form = try JSONDecoder().decode(WorkbenchCommandForm.self, from: Data(json.utf8))
        XCTAssertEqual(form.subcommands.map(\.name), ["feature"])
        XCTAssertEqual(form.subcommands[0].description, "A capability → features/<name>.ts")
        let old = try JSONDecoder().decode(WorkbenchCommandForm.self, from: Data("""
        {"id":"hello","title":"luca hello","summary":"","badge":"project","usage":"luca hello","fields":[],"examples":[]}
        """.utf8))
        XCTAssertEqual(old.subcommands, [])
    }

    func testChatAboutADocumentPutsTheLastPickFirstAndHandsTheTextOver() {
        XCTAssertEqual(WorkbenchDocContent.chatOrder(["a", "b", "c"], last: "b"), ["b", "a", "c"])
        XCTAssertEqual(WorkbenchDocContent.chatOrder(["a", "b"], last: nil), ["a", "b"])
        XCTAssertEqual(WorkbenchDocContent.chatOrder(["a", "b"], last: "gone"), ["a", "b"])
        let short = WorkbenchDocContent.chatOpener(path: "docs/notes/x.md", text: "# X\n\nBody\n")
        XCTAssertTrue(short.hasPrefix("Let's talk about the document `docs/notes/x.md`."))
        XCTAssertTrue(short.contains("```md\n# X\n\nBody\n\n```"))
        XCTAssertFalse(short.contains("goes on past"))
        let long = WorkbenchDocContent.chatOpener(path: "p", text: String(repeating: "x", count: WorkbenchDocContent.chatTextLimit + 5))
        XCTAssertTrue(long.contains("goes on past this point"))
        XCTAssertFalse(long.contains(String(repeating: "x", count: WorkbenchDocContent.chatTextLimit + 1)))
    }
}
