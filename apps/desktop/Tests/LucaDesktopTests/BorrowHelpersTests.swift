import XCTest
@testable import LucaDesktop

final class BorrowHelpersTests: XCTestCase {
    private let ownOrigin = WorkbenchOrigin(kind: "own", tag: "own", label: "this project",
                                            file: "/x/a b/features/greeter.ts", dir: "/x/a b/features", root: "/x/a b", plugin: nil)

    func testAChangeRequestRidesInTheTileAddressAndBack() throws {
        let request = try XCTUnwrap(ChangeRequest.copy(registry: "features", id: "greeter", origin: ownOrigin))
        let uri = TileURI.luca(project: "b", tool: "change", options: request.options)
        XCTAssertEqual(uri.kindKey, "luca-change")
        let again = try XCTUnwrap(TileURI(uri.description))
        XCTAssertEqual(ChangeRequest(uri: again), request)
        XCTAssertEqual(again.option("file"), "/x/a b/features/greeter.ts")
        XCTAssertNil(ChangeRequest(uri: TileURI("luca://b/change")!), "no route or op: no request")
    }

    func testCopyAndBorrowComeFromTheOrigin() {
        let copy = ChangeRequest.copy(registry: "features", id: "greeter", origin: ownOrigin)
        XCTAssertEqual(copy?.op, "copy")
        XCTAssertEqual(copy?.root, "/x/a b")
        let borrow = ChangeRequest.borrow(registry: "features", origin: ownOrigin)
        XCTAssertEqual(borrow?.op, "borrow")
        XCTAssertEqual(borrow?.dir, "/x/a b/features")
        XCTAssertNil(borrow?.file)
        let builtIn = WorkbenchOrigin(kind: "builtin", tag: "built in", label: "built into Luca", file: nil, dir: nil, root: nil, plugin: nil)
        XCTAssertNil(ChangeRequest.copy(registry: "features", id: "fs", origin: builtIn))
        XCTAssertNil(ChangeRequest.borrow(registry: "features", origin: builtIn))
    }

    func testTheBodySkipsTheRouteAndEmptyFields() throws {
        var request = ChangeRequest(route: "plugins", op: "on", name: "example-plugin")
        request.digest = "abc"
        let json = try XCTUnwrap(JSONSerialization.jsonObject(with: JSONEncoder().encode(request)) as? [String: Any])
        XCTAssertEqual(json["op"] as? String, "on")
        XCTAssertEqual(json["name"] as? String, "example-plugin")
        XCTAssertEqual(json["digest"] as? String, "abc")
        XCTAssertEqual(json["overwrite"] as? Bool, false)
        XCTAssertNil(json["route"])
        XCTAssertNil(json["file"])
    }

    func testRegistryCardsWearTheOriginTagAndKnowTheirHelper() throws {
        let json = """
        {"stacks":[{"id":"commands","title":"commands","cards":[
          {"id":"commands.wave","title":"wave","subtitle":"","preview":"","badge":"project","address":"command/wave",
           "origin":{"kind":"borrowed","tag":"borrowed · a","label":"borrowed from ~/a/commands","file":"/a/commands/wave.ts","dir":"/a/commands","root":"/a"}},
          {"id":"commands.help","title":"help","subtitle":"","preview":"","address":"command/help",
           "origin":{"kind":"builtin","tag":"built in","label":"built into Luca"}}]}]}
        """
        let reply = try JSONDecoder().decode(WorkbenchStacks.self, from: Data(json.utf8))
        let cards = RegistryContent.indexStacks(reply, project: "b")[0].cards
        XCTAssertEqual(cards[0].badge, "borrowed · a")
        XCTAssertEqual(cards[0].badgeTone, "borrowed")
        XCTAssertEqual(cards[1].badge, "built in")
        XCTAssertEqual(cards[1].badgeTone, "builtin")
        let sources = RegistryContent.takeSources(reply, project: "b")
        XCTAssertEqual(sources["commands.wave"]?.registry, "commands")
        XCTAssertEqual(sources["commands.wave"]?.id, "wave")
        XCTAssertEqual(sources["commands.wave"]?.origin?.dir, "/a/commands")
        XCTAssertEqual(sources["commands.wave"]?.project, "b")
    }

    func testAnOlderHostWithNoOriginKeepsTheBadge() throws {
        let json = """
        {"stacks":[{"id":"features","title":"features","cards":[{"id":"features.x","title":"x","subtitle":"","preview":"","badge":"project","address":"helper/features/x"}]}]}
        """
        let reply = try JSONDecoder().decode(WorkbenchStacks.self, from: Data(json.utf8))
        let card = RegistryContent.indexStacks(reply, project: "b")[0].cards[0]
        XCTAssertEqual(card.badge, "project")
        XCTAssertNil(card.badgeTone)
    }

    func testAChangeDecodesAsTheHostSendsIt() throws {
        let json = """
        {"op":"copy","title":"Copy features.greeter into b","summary":"From ~/a.","ok":false,"blocked":null,
         "clashes":["~/b/features/greeter.ts exists in this project and is different"],"needsOverwrite":true,
         "notes":["1 relative import not copied."],
         "files":[{"path":"/b/features/greeter.ts","display":"~/b/features/greeter.ts","action":"overwrite",
                   "lines":[{"kind":"gap","text":"3 unchanged lines"},{"kind":"del","text":"old"},{"kind":"add","text":"new"}],"added":1,"removed":1}],
         "imports":[{"spec":"./lib/shout","from":"~/a/features/greeter.ts","path":"/b/features/lib/shout.ts","display":"~/b/features/lib/shout.ts","action":"create"}],
         "helpers":[],"digest":"0123456789abcdef"}
        """
        let change = try JSONDecoder().decode(WorkbenchChange.self, from: Data(json.utf8))
        XCTAssertTrue(change.needsOverwrite)
        XCTAssertEqual(change.files[0].lines.map(\.kind), ["gap", "del", "add"])
        XCTAssertNil(change.files[0].target)
        XCTAssertEqual(change.imports[0].action, "create")
        XCTAssertEqual(ChangePreview.importWord("create", withImports: false), "skip")
        XCTAssertEqual(ChangePreview.importWord("create", withImports: true), "copy")
    }

    func testPluginRowsAndWhatTTurnsThemInto() throws {
        let json = """
        {"envFile":"~/b/.env","envExists":true,"line":"LUCA_PLUGINS=example-plugin,gone","pluginsDir":"~/.luca/plugins","pluginsDirIsDefault":true,
         "loaded":["example-plugin"],
         "plugins":[{"name":"example-plugin","path":"/h/.luca/plugins/example-plugin","display":"~/.luca/plugins/example-plugin","link":true,
           "target":"~/@luca/plugins/example-plugin","isThisProject":false,"entry":"luca.plugin.ts","on":true,"loaded":true,
           "entryValue":"example-plugin","adds":[],"addsText":"luca.plugin.ts attach()"},
           {"name":"other","path":"/h/.luca/plugins/other","display":"~/.luca/plugins/other","link":false,"target":"~/.luca/plugins/other",
           "isThisProject":false,"entry":null,"on":false,"loaded":false,"entryValue":"other","adds":[{"type":"features","names":["x"]}],"addsText":"1 feature"}],
         "missing":[{"entry":"gone","resolved":null,"note":"not found"}],
         "cliFile":"~/b/luca.cli.ts","cliExists":true,
         "borrowed":[{"id":"commands:/a/commands","type":"commands","directory":"/a/commands","display":"~/a/commands","exists":true,"helpers":["wave"]}]}
        """
        let info = try JSONDecoder().decode(WorkbenchPlugins.self, from: Data(json.utf8))
        let rows = PluginsContent.rows(info)
        XCTAssertEqual(rows.map(\.id), ["plugin:example-plugin", "plugin:other", "missing:gone", "borrowed:commands:/a/commands"])
        XCTAssertEqual(rows[0].toggle, ChangeRequest(route: "plugins", op: "off", name: "example-plugin"))
        XCTAssertEqual(rows[1].toggle, ChangeRequest(route: "plugins", op: "on", name: "other"))
        XCTAssertEqual(rows[2].toggle, ChangeRequest(route: "plugins", op: "off", name: "gone", entry: "gone"))
        XCTAssertEqual(rows[3].toggle, ChangeRequest(route: "borrow", op: "unborrow", id: "commands:/a/commands"))
    }

    func testBorrowKeysAreInTheKeymapWithLabels() {
        let map = Keymap.merged(defaults: DefaultKeymap.file, user: nil)
        let expected: [(String, String, String?)] = [
            ("luca.plugins", "Space b", nil),
            ("lucaRegistry.take", "t", "luca-registry"),
            ("lucaRegistry.own", "o", "luca-registry"),
            ("lucaRegistry.origin", "O", "luca-registry"),
            ("lucaRegistry.plugins", "b", "luca-registry"),
            ("lucaHelper.take", "t", "luca-helper"),
            ("lucaChange.apply", "a", "luca-change"),
            ("lucaChange.imports", "i", "luca-change"),
            ("lucaChange.overwrite", "o", "luca-change"),
            ("lucaPlugins.toggle", "t", "luca-plugins"),
            ("lucaPlugins.link", "l", "luca-plugins"),
            ("lucaPlugins.apply", "a", "luca-plugins"),
            ("lucaPlugins.down", "j", "luca-plugins"),
            ("lucaPlugins.open", "o", "luca-plugins"),
            ("lucaPlugins.filter", "/", "luca-plugins"),
        ]
        for (action, spec, kind) in expected {
            let binding = map.binding(for: action)
            XCTAssertEqual(binding?.spec, spec, action)
            XCTAssertFalse(binding?.label.isEmpty ?? true, action)
            if let kind { XCTAssertEqual(binding?.kind, kind, action) }
        }
    }

    func testAPluginsHelpersFilterByNameAndOpenAsTiles() {
        let adds = [
            WorkbenchPlugins.Adds(type: "features", names: ["gmail", "github", "briefings"]),
            WorkbenchPlugins.Adds(type: "commands", names: ["main", "doctor"]),
            WorkbenchPlugins.Adds(type: "endpoints", names: ["GET /health"]),
        ]
        XCTAssertEqual(PluginsContent.adds(adds, matching: ""), adds)
        XCTAssertEqual(PluginsContent.adds(adds, matching: " Git "), [WorkbenchPlugins.Adds(type: "features", names: ["github"])])
        XCTAssertEqual(PluginsContent.adds(adds, matching: "G"), [WorkbenchPlugins.Adds(type: "features", names: ["gmail", "github", "briefings"]), WorkbenchPlugins.Adds(type: "endpoints", names: ["GET /health"])])
        XCTAssertEqual(PluginsContent.adds(adds, matching: "zzz"), [])
        XCTAssertEqual(PluginsContent.address(project: "p", type: "features", name: "gmail")?.description, "luca://p/helper/features/gmail")
        XCTAssertEqual(PluginsContent.address(project: "p", type: "commands", name: "main")?.description, "luca://p/command/main")
        XCTAssertNil(PluginsContent.address(project: "p", type: "endpoints", name: "GET /health"))
        XCTAssertNil(PluginsContent.address(project: "p", type: "assistants", name: "chief"))
    }
}
