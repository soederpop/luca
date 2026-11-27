import XCTest
@testable import LucaDesktop

final class WorkbenchToolsTests: XCTestCase {
    func testHelperAddressSplitsAtTheFirstSlash() {
        XCTAssertEqual(HelperAddress("features/fs")?.registry, "features")
        XCTAssertEqual(HelperAddress("features/fs")?.id, "fs")
        XCTAssertEqual(HelperAddress("endpoints/api/users")?.id, "api/users")
        XCTAssertEqual(HelperAddress("features/fs")?.title, "features.fs")
        XCTAssertNil(HelperAddress("features"))
        XCTAssertNil(HelperAddress("features/"))
        XCTAssertNil(HelperAddress("/fs"))
    }

    func testHelperAddressComesFromTheTileURI() {
        let uri = TileURI("luca://luca/helper/features/fs")!
        XCTAssertEqual(uri.kindKey, "luca-helper")
        XCTAssertEqual(HelperAddress(uri.id ?? ""), HelperAddress("features/fs"))
    }

    func testEventLogKeepsTheNewestFirstUpToTheLimit() {
        var log = HelperEventLog()
        let t = Date(timeIntervalSince1970: 0)
        for n in 0..<(HelperEventLog.limit + 5) { log.add(name: "e\(n)", text: "\(n)", at: t) }
        XCTAssertEqual(log.entries.count, HelperEventLog.limit)
        XCTAssertEqual(log.entries.first?.name, "e\(HelperEventLog.limit + 4)")
        XCTAssertEqual(log.entries.last?.name, "e5")
        XCTAssertEqual(Set(log.entries.map(\.id)).count, log.entries.count)
        log.clear()
        XCTAssertTrue(log.entries.isEmpty)
    }

    func testRegistryStacksOpenTheCardsAddress() throws {
        let json = """
        {"stacks":[{"id":"features","title":"features","cards":[
          {"id":"features.counter","title":"counter","subtitle":"Counts","preview":"Counts\\nmore","badge":"project",
           "open":{"tool":"helper","registry":"features","id":"counter"},"address":"helper/features/counter"},
          {"id":"features.fs","title":"fs","subtitle":"","preview":"","address":"helper/features/fs"}]}]}
        """
        let reply = try JSONDecoder().decode(WorkbenchStacks.self, from: Data(json.utf8))
        let stacks = RegistryContent.indexStacks(reply, project: "luca")
        XCTAssertEqual(stacks.map(\.id), ["features"])
        XCTAssertEqual(stacks[0].cards.map(\.id), ["features.counter", "features.fs"])
        XCTAssertEqual(stacks[0].cards[0].uri.description, "luca://luca/helper/features/counter")
        XCTAssertEqual(stacks[0].cards[0].badge, "project")
        XCTAssertEqual(stacks[0].cards[0].subtitle, "Counts")
        XCTAssertNil(stacks[0].cards[1].subtitle, "an empty line shows nothing")
        XCTAssertNil(stacks[0].cards[1].badge)
    }

    func testHelperViewDecodesTheHostShape() throws {
        let json = """
        {"registry":"features","id":"fs","title":"features.fs","summary":"Files","markdown":"# fs","options":null,
         "state":{"enabled":true},"events":[],"live":true,"stateText":"{\\n  \\"enabled\\": true\\n}","liveNote":null,
         "callable":true,"optionFields":[],"stateFields":[{"name":"enabled","type":"boolean","description":"On"}],
         "getters":[],"methods":[{"name":"exists","signature":"exists(path: string): boolean","description":"Is it there",
         "params":[{"name":"path","type":"string","description":"","required":true}],"returns":"boolean","argsHint":"path","askArgs":true}]}
        """
        let info = try JSONDecoder().decode(WorkbenchHelper.self, from: Data(json.utf8))
        XCTAssertTrue(info.live)
        XCTAssertEqual(info.methods.first?.signature, "exists(path: string): boolean")
        XCTAssertEqual(info.methods.first?.params.first?.required, true)
        XCTAssertEqual(info.stateFields.first?.required, nil)
    }

    func testSocketFramesCarryTextAndTime() throws {
        let json = #"{"type":"event","registry":"features","id":"counter","name":"bumped","args":[2],"text":"2","at":1800000000000}"#
        let frame = try JSONDecoder().decode(WorkbenchEvent.self, from: Data(json.utf8))
        XCTAssertEqual(frame.text, "2")
        XCTAssertEqual(frame.at, 1_800_000_000_000)
        let hello = try JSONDecoder().decode(WorkbenchEvent.self, from: Data(#"{"type":"hello"}"#.utf8))
        XCTAssertNil(hello.text)
    }

    func testACallShowsTheHostsTextOrError() {
        let ok = HelperContent.shown(WorkbenchCallResult(ok: true, call: "fs.exists(\"x\")", text: "true", type: "boolean",
                                                         error: nil, ms: 3, created: false), method: "exists")
        XCTAssertEqual(ok, .init(call: "fs.exists(\"x\")", ok: true, text: "true", detail: "boolean · 3 ms"))
        let bad = HelperContent.shown(WorkbenchCallResult(ok: false, call: nil, text: nil, type: nil,
                                                          error: "boom", ms: nil, created: true), method: "readFile")
        XCTAssertEqual(bad, .init(call: "readFile", ok: false, text: "boom", detail: "created the instance"))
    }

    func testProjectPickPrefersTheFocusedTileThenTheOnlyProjectShown() {
        let a = TileURI.luca(project: "luca", tool: "project")
        let b = TileURI.luca(project: "acme", tool: "registry")
        let app = TileURI.app("file", id: "keymap.yml")
        XCTAssertEqual(ProjectPick.current(focused: b, workspace: [a, b]), "acme")
        XCTAssertEqual(ProjectPick.current(focused: app, workspace: [app, a, a]), "luca")
        XCTAssertNil(ProjectPick.current(focused: app, workspace: [a, b]))
        XCTAssertNil(ProjectPick.current(focused: nil, workspace: [app]))
    }

    func testWorkbenchKeysAreInTheKeymapWithLabels() {
        let map = Keymap.merged(defaults: DefaultKeymap.file, user: nil)
        let expected: [(String, String)] = [
            ("luca.registry", "Space r"),
            ("lucaProject.registry", "o"),
            ("lucaRegistry.restart", "R"),
            ("lucaHelper.call", "m"),
            ("lucaHelper.reload", "r"),
            ("lucaHelper.restart", "R"),
            ("lucaHelper.clearEvents", "x"),
            ("lucaHelper.registry", "u"),
            ("lucaHelper.docs", "P"),
            ("lucaHelper.source", "E"),
            ("lucaHelper.edit", "i"),
            ("lucaHelper.example", "e"),
            ("lucaHelper.chat", "c"),
            ("lucaHelper.keepMine", "d p"),
            ("lucaHelper.takeTheirs", "d o"),
        ]
        for (action, spec) in expected {
            let binding = map.binding(for: action)
            XCTAssertNotNil(binding, action)
            XCTAssertEqual(binding?.spec, spec, action)
            XCTAssertFalse(binding?.label.isEmpty ?? true, action)
        }
        XCTAssertEqual(map.binding(for: "lucaHelper.call")?.kind, "luca-helper")
        XCTAssertEqual(map.binding(for: "luca.registry")?.scope, .leader)
    }

    func testTheRegistryTakesTheSharedIndexKeys() {
        let map = Keymap.merged(defaults: DefaultKeymap.file, user: nil)
        let actions = map.kindBindings("luca-registry").map(\.action)
        for action in ["index.open", "index.peek", "index.filter", "index.reload", "lucaRegistry.restart"] {
            XCTAssertTrue(actions.contains(action), action)
        }
        XCTAssertFalse(map.kindBindings("luca-helper").map(\.action).contains("index.open"))
    }

    func testAHelperViewDecodesItsExamplesAndTheSourceShape() throws {
        let json = """
        {"registry":"features","id":"fs","title":"features.fs","summary":"Files","markdown":"# fs","events":[],"live":true,
         "stateText":"{}","liveNote":null,"callable":true,"optionFields":[],"stateFields":[],"getters":[],"methods":[],
         "examples":[{"id":"method:readFile","title":"fs.readFile()","code":"fs.readFile('a')","language":"ts","from":"method","member":"readFile"}]}
        """
        let view = try JSONDecoder().decode(WorkbenchHelper.self, from: Data(json.utf8))
        XCTAssertEqual(view.examples?.count, 1)
        XCTAssertEqual(view.examples?.first?.title, "fs.readFile()")
        XCTAssertEqual(view.examples?.first?.member, "readFile")
        // An older host without examples still decodes.
        let old = try JSONDecoder().decode(WorkbenchHelper.self, from: Data(json.replacingOccurrences(of: "\"examples\"", with: "\"x\"").utf8))
        XCTAssertNil(old.examples)

        let source = """
        {"id":"features/counter.ts","model":"","slot":0,"title":"counter.ts","path":"/p/features/counter.ts","pathDisplay":"~/p/features/counter.ts",
         "file":"export class Counter {}","digest":"abc","size":23,"sizeText":"23 B","fields":[],"missing":false,
         "editable":false,"readOnly":"A plugin's file","origin":{"kind":"plugin","tag":"plugin · ex","label":"from the plugin ex"}}
        """
        let src = try JSONDecoder().decode(WorkbenchHelperSource.self, from: Data(source.utf8))
        XCTAssertEqual(src.doc.file, "export class Counter {}")
        XCTAssertEqual(src.doc.digest, "abc")
        XCTAssertFalse(src.editable)
        XCTAssertEqual(src.readOnly, "A plugin's file")
        XCTAssertEqual(src.origin?.kind, "plugin")
    }

    func testTheHelperTileAddressesItsConsoleAndChat() throws {
        let helper = HelperContent.address(project: "notes", registry: "features", id: "fs")
        XCTAssertEqual(helper.kindKey, "luca-helper")
        XCTAssertEqual(helper.id, "features/fs")
        let console = ConsoleContent.address(project: "notes", session: "features-fs", run: "fs.exists('x')")
        XCTAssertEqual(console.kindKey, "luca-console")
        XCTAssertEqual(console.id, "features-fs")
        XCTAssertEqual(console.option("run"), "fs.exists('x')")
        XCTAssertNil(ConsoleContent.address(project: "notes").id)
        XCTAssertNil(ConsoleContent.address(project: "notes", session: "default").id)
        XCTAssertEqual(HelperContent.firstLine("a\nb\nc"), "a … (3 lines)")
        XCTAssertEqual(HelperContent.firstLine("one"), "one")
    }
}
