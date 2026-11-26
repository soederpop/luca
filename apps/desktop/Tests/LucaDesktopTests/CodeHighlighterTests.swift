import XCTest
@testable import LucaDesktop

final class CodeHighlighterTests: XCTestCase {
    private func roles(_ code: String, _ language: String?) -> [(String, SyntaxRole)]? {
        CodeHighlighter.shared.runs(code: code, language: language)?.map {
            ((code as NSString).substring(with: $0.range), $0.role)
        }
    }

    func testScopesMapToRoles() {
        XCTAssertEqual(SyntaxRole.of(scopes: ["keyword"]), .keyword)
        XCTAssertEqual(SyntaxRole.of(scopes: ["title.function.invoke"]), .function)
        XCTAssertEqual(SyntaxRole.of(scopes: ["title.class.inherited"]), .type)
        // The innermost scope wins; one with no role falls to the outer one.
        XCTAssertEqual(SyntaxRole.of(scopes: ["string", "subst", "number"]), .number)
        XCTAssertEqual(SyntaxRole.of(scopes: ["string", "unknown-scope"]), .string)
        XCTAssertEqual(SyntaxRole.of(scopes: []), .plain)
    }

    func testTypeScriptRuns() throws {
        let code = "const n = container.feature('fs') // files\n"
        let found = try XCTUnwrap(roles(code, "ts"))
        // The runs cover the code exactly, in order.
        XCTAssertEqual(found.map(\.0).joined(), code)
        func role(_ text: String) -> SyntaxRole? { found.first { $0.0 == text }?.1 }
        XCTAssertEqual(role("const"), .keyword)
        XCTAssertEqual(role("feature"), .function)
        XCTAssertEqual(role("'fs'"), .string)
        XCTAssertEqual(role("// files"), .comment)
    }

    func testOffsetsSurviveEmojiAndMarkup() throws {
        let code = "title: \"héllo 👋 <b>\"\ncount: 3\n"
        let found = try XCTUnwrap(roles(code, "yaml title=x.yml"))
        XCTAssertEqual(found.map(\.0).joined(), code)
        XCTAssertEqual(found.first { $0.0 == "\"héllo 👋 <b>\"" }?.1, .string)
        XCTAssertEqual(found.first { $0.0 == "3" }?.1, .number)
    }

    func testNoLanguageMeansNoGuess() {
        XCTAssertNil(roles("├── docs\n└── src\n", nil))
        XCTAssertNil(roles("anything", ""))
        XCTAssertNil(roles("anything", "not-a-language"))
    }
}
