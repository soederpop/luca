import XCTest
@testable import LucaDesktop

final class ConsoleCommandTests: XCTestCase {
    // MARK: Console history

    func testUpAndDownWalkTheHistoryAndComeBackToTheDraft() {
        var h = ConsoleHistory()
        h.add("one")
        h.add("two")
        XCTAssertEqual(h.previous(current: "typing"), "two")
        XCTAssertEqual(h.previous(current: "two"), "one")
        XCTAssertNil(h.previous(current: "one"), "no older entry")
        XCTAssertEqual(h.next(), "two")
        XCTAssertEqual(h.next(), "typing", "down past the newest gives back the draft")
        XCTAssertNil(h.next())
    }

    func testAddSkipsBlanksAndRepeatsAndKeepsTheLimit() {
        var h = ConsoleHistory()
        h.add("a")
        h.add("a")
        h.add("   ")
        XCTAssertEqual(h.items, ["a"])
        for n in 0..<(ConsoleHistory.limit + 10) { h.add("e\(n)") }
        XCTAssertEqual(h.items.count, ConsoleHistory.limit)
        XCTAssertEqual(h.items.last, "e\(ConsoleHistory.limit + 9)")
    }

    func testRecallOnlyInAOneLineInput() {
        XCTAssertTrue(ConsoleHistory.recalls(""))
        XCTAssertTrue(ConsoleHistory.recalls("container.features"))
        XCTAssertFalse(ConsoleHistory.recalls("const a = 1\na"))
    }

    func testHistoryIsSavedPerProject() throws {
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: dir) }
        let file = dir.appendingPathComponent("console/luca.json")
        var h = ConsoleHistory()
        h.add("1 + 1")
        h.add("const a = 2\na")
        h.save(to: file)
        XCTAssertEqual(ConsoleHistory.load(from: file).items, ["1 + 1", "const a = 2\na"])
        XCTAssertEqual(ConsoleHistory.load(from: dir.appendingPathComponent("none.json")).items, [])
        XCTAssertTrue(ConsoleHistory.file(project: "luca").path.hasSuffix("console/luca.json"))
    }

    // MARK: Shapes

    func testConsoleAnswerDecodesTheTreeAndTheError() throws {
        let ok = """
        {"ok":true,"entry":1,"input":"({a:1})","type":"Object","text":"{a: 1}","ms":2,"logs":[{"level":"log","text":"hi"}],
         "tree":{"type":"Object","text":"{a: 1}","open":true,"children":[{"key":"a","type":"number","text":"1"}],"more":3}}
        """
        let a = try JSONDecoder().decode(WorkbenchConsoleAnswer.self, from: Data(ok.utf8))
        XCTAssertTrue(a.ok)
        XCTAssertEqual(a.tree?.open, true)
        XCTAssertEqual(a.tree?.children?.first?.key, "a")
        XCTAssertEqual(a.tree?.more, 3)
        XCTAssertEqual(a.logs?.first?.text, "hi")
        let bad = """
        {"ok":false,"entry":2,"input":"x()","error":"x is not defined","name":"ReferenceError","stack":"ReferenceError: x\\n at <anonymous>","logs":[],"ms":1}
        """
        let b = try JSONDecoder().decode(WorkbenchConsoleAnswer.self, from: Data(bad.utf8))
        XCTAssertFalse(b.ok)
        XCTAssertEqual(b.name, "ReferenceError")
        XCTAssertNil(b.tree)
    }

    func testCommandFormDecodes() throws {
        let json = """
        {"id":"greet","title":"luca greet","summary":"Greet","badge":"project","usage":"luca greet <who> [flags]","examples":[],
         "fields":[{"name":"who","flag":"--who","type":"string","default":null,"description":"","required":true,"positional":true,"position":0},
                   {"name":"mood","flag":"--mood","type":"enum","options":["happy"],"default":null,"description":"","required":false,"positional":false},
                   {"name":"__extra__","flag":"","type":"string","default":null,"description":"","required":false,"positional":false,"extra":true}]}
        """
        let form = try JSONDecoder().decode(WorkbenchCommandForm.self, from: Data(json.utf8))
        XCTAssertEqual(form.fields.map(\.name), ["who", "mood", "__extra__"])
        XCTAssertEqual(form.fields[1].options, ["happy"])
        XCTAssertEqual(form.fields[2].extra, true)
    }

    func testFormValuesEncodeAsTextOrSwitch() throws {
        let data = try JSONEncoder().encode(["who": WorkbenchFormValue.text("jon"), "loud": .flag(true)])
        let back = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        XCTAssertEqual(back?["who"] as? String, "jon")
        XCTAssertEqual(back?["loud"] as? Bool, true)
    }

    // MARK: Run transcript

    private func run(status: String = "running", chunks: [WorkbenchRunChunk] = [], dropped: Int = 0) -> WorkbenchRun {
        WorkbenchRun(runId: "r1", command: "greet", display: "luca greet jon", status: status, code: status == "running" ? nil : 0,
                     signal: nil, stopped: false, statusText: status == "running" ? "running" : "exit 0 · 5 ms", ms: 5,
                     chunks: chunks, dropped: dropped)
    }

    private func output(_ seq: Int, _ text: String, stream: String = "stdout", run: String = "r1") -> WorkbenchEvent {
        WorkbenchEvent(type: "run-output", registry: nil, id: nil, name: nil, state: nil, args: nil, live: nil,
                       text: text, runId: run, stream: stream, seq: seq)
    }

    func testFramesAppendInOrderAndMergeOneStream() {
        var t = RunTranscript(run())
        XCTAssertTrue(t.running)
        XCTAssertTrue(t.take(output(0, "a\n")))
        XCTAssertTrue(t.take(output(1, "b\n")))
        XCTAssertTrue(t.take(output(2, "oops\n", stream: "stderr")))
        XCTAssertTrue(t.take(output(1, "b\n")), "an old frame is ignored")
        XCTAssertTrue(t.take(output(9, "x", run: "other")), "another run's frame is ignored")
        XCTAssertEqual(t.segments.map(\.text), ["a\nb\n", "oops\n"])
        XCTAssertEqual(t.segments.map(\.stream), ["stdout", "stderr"])
        XCTAssertEqual(t.nextSeq, 3)
    }

    func testAGapAsksForTheRunAgainAndReplaceFillsIt() {
        var t = RunTranscript(run())
        XCTAssertFalse(t.take(output(2, "late")))
        t.replace(with: run(chunks: [.init(seq: 0, stream: "stdout", text: "a"), .init(seq: 1, stream: "stdout", text: "b"),
                                     .init(seq: 2, stream: "stdout", text: "late")]))
        XCTAssertEqual(t.segments.map(\.text), ["ablate"])
        XCTAssertEqual(t.nextSeq, 3)
    }

    func testDroppedChunksStartTheCount() {
        let t = RunTranscript(run(chunks: [.init(seq: 4, stream: "stdout", text: "kept")], dropped: 4))
        XCTAssertEqual(t.dropped, 4)
        XCTAssertEqual(t.nextSeq, 5)
    }

    func testTheExitFrameEndsTheRun() {
        var t = RunTranscript(run())
        var exit = WorkbenchEvent(type: "run-exit", registry: nil, id: nil, name: nil, state: nil, args: nil, live: nil,
                                  text: "stopped · 2.0 s", runId: "r1")
        exit.code = nil
        exit.stopped = true
        XCTAssertTrue(t.take(exit))
        XCTAssertFalse(t.running)
        XCTAssertTrue(t.stopped)
        XCTAssertEqual(t.statusText, "stopped · 2.0 s")
    }

    // MARK: Addresses and keys

    func testCommandCardsOpenTheCommandTile() throws {
        let json = """
        {"stacks":[{"id":"commands","title":"commands","cards":[
          {"id":"commands.greet","title":"greet","subtitle":"","preview":"","address":"command/greet"}]}]}
        """
        let stacks = RegistryContent.indexStacks(try JSONDecoder().decode(WorkbenchStacks.self, from: Data(json.utf8)), project: "luca")
        let uri = try XCTUnwrap(stacks.first?.cards.first?.uri)
        XCTAssertEqual(uri.kindKey, "luca-command")
        XCTAssertEqual(uri.id, "greet")
        XCTAssertEqual(TileURI("luca://luca/console")?.kindKey, "luca-console")
    }

    func testTheNewKeysAreInTheDefaultKeymap() throws {
        let map = Keymap.merged(defaults: DefaultKeymap.file, user: nil)
        for action in ["luca.console", "luca.command", "lucaConsole.input", "lucaConsole.clear", "lucaConsole.reset",
                       "lucaConsole.history", "lucaConsole.docs", "lucaConsole.inspect", "lucaCommand.run", "lucaCommand.stop", "lucaCommand.edit"] {
            let binding = map.binding(for: action)
            XCTAssertNotNil(binding, action)
            XCTAssertFalse(binding?.label.isEmpty ?? true, action)
        }
        XCTAssertEqual(map.binding(for: "lucaCommand.run")?.kind, "luca-command")
        XCTAssertEqual(map.binding(for: "lucaConsole.input")?.kind, "luca-console")
        XCTAssertEqual(map.binding(for: "luca.console")?.scope, .leader)
    }
}
