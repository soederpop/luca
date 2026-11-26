import XCTest
@testable import LucaDesktop

final class ConsoleAssistTests: XCTestCase {
    private func doc(_ title: String, kind: String = "method") -> WorkbenchDocCard {
        WorkbenchDocCard(title: title, kind: kind, summary: "")
    }

    private func completion(from: Int, to: Int, _ labels: [String], signature: Bool = false, hover: Bool = false) -> WorkbenchCompletion {
        WorkbenchCompletion(
            from: from, to: to,
            items: labels.map { .init(label: $0, kind: "method", detail: "", insert: $0, doc: doc("fs.\($0)")) },
            signature: signature ? .init(doc: doc("fs.call"), active: 1) : nil,
            hover: hover ? doc("fs.hover") : nil)
    }

    func testListOpensOnlyWhenAskedAndThereAreItems() {
        var assist = ConsoleAssist()
        assist.apply(completion(from: 3, to: 5, ["readFile", "readJson"]), show: true)
        XCTAssertTrue(assist.open)
        XCTAssertEqual(assist.selected?.label, "readFile")
        assist.apply(completion(from: 3, to: 5, ["readFile"]), show: false)
        XCTAssertFalse(assist.open)
        XCTAssertNil(assist.selected)
        assist.apply(completion(from: 3, to: 5, []), show: true)
        XCTAssertFalse(assist.open)
    }

    func testMoveWrapsAndAcceptReplacesTheName() {
        var assist = ConsoleAssist()
        assist.apply(completion(from: 3, to: 5, ["readFile", "readJson", "rename"]), show: true)
        assist.move(-1)
        XCTAssertEqual(assist.selected?.label, "rename")
        assist.move(1)
        assist.move(1)
        XCTAssertEqual(assist.selected?.label, "readJson")
        let next = assist.accept(in: "fs.re('x')")
        XCTAssertEqual(next?.text, "fs.readJson('x')")
        XCTAssertEqual(next?.caret, 11)
        XCTAssertEqual(assist.prefix(in: "fs.re('x')", caret: 5), "re")
    }

    func testAcceptRefusesARangeOutsideTheText() {
        var assist = ConsoleAssist()
        assist.apply(completion(from: 3, to: 40, ["readFile"]), show: true)
        XCTAssertNil(assist.accept(in: "fs.re"))
        assist.close()
        XCTAssertNil(assist.accept(in: "fs.re"))
    }

    func testDocsFollowThePickThenTheCallThenTheCaret() {
        var assist = ConsoleAssist()
        assist.apply(completion(from: 0, to: 0, ["a"], signature: true, hover: true), show: true)
        XCTAssertEqual(assist.focusDoc?.title, "fs.a")
        assist.close()
        XCTAssertEqual(assist.focusDoc?.title, "fs.call")
        assist.apply(completion(from: 0, to: 0, [], hover: true), show: false)
        XCTAssertEqual(assist.focusDoc?.title, "fs.hover")
        assist.clear()
        XCTAssertNil(assist.focusDoc)
    }

    func testWhatOpensTheList() {
        XCTAssertTrue(ConsoleAssist.opens(after: "fs.", caret: 3))
        XCTAssertTrue(ConsoleAssist.opens(after: "fs.re", caret: 5))
        XCTAssertTrue(ConsoleAssist.opens(after: "container.feature('", caret: 19))
        XCTAssertFalse(ConsoleAssist.opens(after: "fs.readFile('", caret: 13))
        XCTAssertFalse(ConsoleAssist.opens(after: "fs.readFile(", caret: 12))
        XCTAssertFalse(ConsoleAssist.opens(after: "a ", caret: 2))
        XCTAssertFalse(ConsoleAssist.opens(after: "", caret: 0))
    }

    func testEnterRunsOnlyAWholeExpression() {
        XCTAssertTrue(ConsoleSyntax.isComplete("fs.exists('a')"))
        XCTAssertTrue(ConsoleSyntax.isComplete("const a = { b: [1, 2] }"))
        XCTAssertFalse(ConsoleSyntax.isComplete("const a = {"))
        XCTAssertFalse(ConsoleSyntax.isComplete("fs.readFile("))
        XCTAssertFalse(ConsoleSyntax.isComplete("[1, 2,"))
        XCTAssertFalse(ConsoleSyntax.isComplete("`a ${b}"))
        XCTAssertFalse(ConsoleSyntax.isComplete("items.map(x =>"))
        XCTAssertFalse(ConsoleSyntax.isComplete("container\n  ."))
        // Brackets in strings and comments do not count.
        XCTAssertTrue(ConsoleSyntax.isComplete("'(' + \"[\""))
        XCTAssertTrue(ConsoleSyntax.isComplete("1 // ("))
        XCTAssertTrue(ConsoleSyntax.isComplete("1 /* { */"))
        // A stray closer or an open plain string is the host's error to report.
        XCTAssertTrue(ConsoleSyntax.isComplete("a)"))
        XCTAssertTrue(ConsoleSyntax.isComplete("'abc"))
        XCTAssertTrue(ConsoleSyntax.isComplete("i++"))
        XCTAssertTrue(ConsoleSyntax.isComplete("?fs.readFile"))
    }

    func testNewLineKeepsTheIndent() {
        XCTAssertEqual(ConsoleSyntax.indent(after: "const a = {", caret: 11), "  ")
        XCTAssertEqual(ConsoleSyntax.indent(after: "  b: 1,", caret: 7), "  ")
        XCTAssertEqual(ConsoleSyntax.indent(after: "a\n    f(", caret: 8), "      ")
        XCTAssertEqual(ConsoleSyntax.indent(after: "a", caret: 1), "")
    }

    func testDecodesTheHostsCompletion() throws {
        let json = """
        {"from":3,"to":8,"items":[{"label":"readFile","kind":"method","detail":"(path, encoding?) → string","insert":"readFile",
          "doc":{"title":"fs.readFile","kind":"method","signature":"readFile(path: string): string","summary":"Reads.",
                 "params":[{"name":"path","type":"string","description":"The path","required":true},{"name":"encoding","type":"string","description":""}],
                 "returns":"string","examples":["fs.readFile('a')"],"owner":{"registry":"features","id":"fs","title":"features.fs","address":"helper/features/fs"},"documented":true}}],
         "signature":{"doc":{"title":"fs.readFile","kind":"method","summary":"","documented":true},"active":1},
         "hover":{"title":"features.fs","kind":"helper","summary":"Files.","members":[{"name":"exists","kind":"method","detail":"(path)","summary":"True if there."}],"value":"live instance","documented":true}}
        """
        let completion = try JSONDecoder().decode(WorkbenchCompletion.self, from: Data(json.utf8))
        XCTAssertEqual(completion.items[0].doc.params?[0].required, true)
        XCTAssertNil(completion.items[0].doc.params?[1].required)
        XCTAssertEqual(completion.items[0].doc.owner?.address, "helper/features/fs")
        XCTAssertEqual(completion.signature?.active, 1)
        XCTAssertEqual(completion.hover?.members?.first?.name, "exists")
    }

    @MainActor
    func testMemberTargets() {
        var helper = doc("fs", kind: "helper")
        helper.owner = .init(registry: "features", id: "fs", title: "features.fs", address: "helper/features/fs")
        XCTAssertEqual(ConsoleContent.memberTarget(of: helper, "readFile"), "features.fs.readFile")
        XCTAssertEqual(ConsoleContent.memberTarget(of: doc("container", kind: "container"), "paths"), "container.paths")
    }
}
