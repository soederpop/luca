import XCTest
@testable import LucaDesktop

/// `:edit` opens the app's own files by name and treats anything else as a project file.
final class EditCommandTests: XCTestCase {
    func testAppFilesByName() {
        XCTAssertEqual(Shell.appFile("keymap"), "keymap.yml")
        XCTAssertEqual(Shell.appFile("keymap.yml"), "keymap.yml")
        XCTAssertEqual(Shell.appFile("settings"), "settings.yml")
        XCTAssertEqual(Shell.appFile("layouts/dev.yml"), "layouts/dev.yml")
    }

    func testEverythingElseIsAProjectFile() {
        XCTAssertNil(Shell.appFile(""))
        XCTAssertNil(Shell.appFile("luca.cli.ts"))
        XCTAssertNil(Shell.appFile("assistants/hooks.ts"))
        XCTAssertNil(Shell.appFile("docs/notes/keymap.md"))
    }
}

/// The file picker hides installed skills until the query asks for them.
final class QuietChoiceTests: XCTestCase {
    func testQuietChoiceShowsOnlyWhenTyped() {
        let skill = PaletteChoice(title: "SKILL.md", detail: ".claude/skills/x/SKILL.md", onlyWhenTyped: [".claude", "skills"]) {}
        XCTAssertFalse(skill.shows(for: ""))
        XCTAssertFalse(skill.shows(for: "SKILL"))
        XCTAssertTrue(skill.shows(for: ".claude/sk"))
        XCTAssertTrue(skill.shows(for: "Skills"))
        XCTAssertTrue(PaletteChoice(title: "a.ts") {}.shows(for: ""))
    }

    func testOldHostDecodes() throws {
        let list = try JSONDecoder().decode(WorkbenchFiles.self, from: Data(#"{"files":["a.ts"],"truncated":false}"#.utf8))
        XCTAssertEqual(list.quiet, [])
    }
}
