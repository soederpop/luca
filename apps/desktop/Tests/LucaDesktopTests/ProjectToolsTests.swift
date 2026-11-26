import XCTest
@testable import LucaDesktop

final class ProjectToolsTests: XCTestCase {
    private let listJSON = """
    {"notice":null,"count":2,
     "tools":[
      {"id":"todo","title":"Todo board","hint":"a tiny board","glyph":null,"kind":"view","renderer":"stacks","page":null,
       "address":"tool/todo","origin":{"kind":"own","tag":"project","label":"workbench/todo.ts","file":"/p/workbench/todo.ts"},
       "fileDisplay":"workbench/todo.ts","keys":[{"action":"add","key":"a","label":"add a todo"}]},
      {"id":"site","title":"Site","hint":"","glyph":"globe","kind":"page","renderer":null,"page":"/site/index.html",
       "address":"page/site/index.html","origin":{"kind":"plugin","tag":"plugin · extra","label":"plugin extra","plugin":"extra"},
       "fileDisplay":"~/x/workbench/site.ts","keys":[]}],
     "errors":[{"file":"/p/workbench/broken.ts","fileDisplay":"workbench/broken.ts","id":null,
       "origin":{"kind":"own","tag":"project","label":"workbench/broken.ts"},"error":"Unexpected token"}]}
    """

    func testTheListDecodesAndEachToolKnowsItsTile() throws {
        let list = try JSONDecoder().decode(WorkbenchTools.self, from: Data(listJSON.utf8))
        XCTAssertEqual(list.tools.map(\.id), ["todo", "site"])
        XCTAssertEqual(list.tools[0].uri(project: "demo")?.description, "luca://demo/tool/todo")
        XCTAssertEqual(list.tools[1].uri(project: "demo")?.kindKey, "luca-page")
        XCTAssertEqual(list.errors.first?.error, "Unexpected token")
        XCTAssertEqual(Shell.toolDetail(list.tools[0]), "project · stacks · a tiny board")
        XCTAssertEqual(Shell.toolDetail(list.tools[1]), "plugin · extra · /site/index.html")
    }

    func testStacksBecomeIndexCardsWithTargetsAndInertCards() throws {
        let json = """
        {"ok":true,"id":"todo","renderer":"stacks","keys":[],
         "stacks":[{"id":"todo","title":"To do","tone":"warn","count":2,"cards":[
           {"id":"t1","title":"Milk","subtitle":null,"preview":null,"badge":"soon","tone":"bad","address":"helper/features/fs"},
           {"id":"t2","title":"Bread","subtitle":"x","preview":null,"badge":null,"tone":null,"address":null}]},
          {"id":"done","title":"Done","tone":"good","count":1,"cards":[
           {"id":"t1","title":"Old","subtitle":null,"preview":null,"badge":null,"tone":null,"address":"luca://other/docs"}]}]}
        """
        let data = try JSONDecoder().decode(WorkbenchToolData.self, from: Data(json.utf8))
        let fallback = TileURI.luca(project: "demo", tool: "tool", id: "todo")
        let built = ToolContent.indexStacks(data, project: "demo", fallback: fallback)
        XCTAssertEqual(built.stacks.map(\.id), ["todo", "done"])
        XCTAssertEqual(built.stacks[0].tone, "warn")
        // Card ids stay unique across stacks.
        XCTAssertEqual(built.stacks.flatMap(\.cards).map(\.id), ["todo/t1", "todo/t2", "done/t1"])
        XCTAssertEqual(built.stacks[0].cards[0].uri.description, "luca://demo/helper/features/fs")
        XCTAssertEqual(built.stacks[0].cards[0].tone, "bad")
        XCTAssertEqual(built.stacks[1].cards[0].uri.description, "luca://other/docs")
        XCTAssertEqual(built.inert, ["todo/t2"])
        XCTAssertEqual(built.stacks[0].cards[1].uri, fallback)
        XCTAssertEqual(built.targets["done/t1"], WorkbenchActionTarget(stack: "done", card: "t1"))
    }

    func testAFailedToolHasNoStacksAndKeepsItsError() throws {
        let json = #"{"ok":false,"id":"oops","renderer":null,"error":"data() threw: data broke"}"#
        let data = try JSONDecoder().decode(WorkbenchToolData.self, from: Data(json.utf8))
        XCTAssertEqual(data.error, "data() threw: data broke")
        XCTAssertTrue(ToolContent.indexStacks(data, project: "p", fallback: TileURI.luca(project: "p", tool: "tool")).stacks.isEmpty)
        let tree = #"{"ok":true,"id":"facts","renderer":"tree","tree":{"type":"Object","text":"{a: 1}","open":true,"children":[{"key":"a","type":"number","text":"1"}]}}"#
        XCTAssertEqual(try JSONDecoder().decode(WorkbenchToolData.self, from: Data(tree.utf8)).tree?.children?.first?.key, "a")
    }

    func testActionStepsDecode() throws {
        let choose = #"{"ok":true,"done":false,"token":"act-1","step":{"kind":"choose","title":"Column","items":[{"title":"To do","detail":""}]}}"#
        let a = try JSONDecoder().decode(WorkbenchActionAnswer.self, from: Data(choose.utf8))
        XCTAssertEqual(a.step?.items?.first?.title, "To do")
        XCTAssertEqual(a.token, "act-1")
        let done = #"{"ok":true,"done":true,"result":{"flash":"added","reload":true,"open":null}}"#
        XCTAssertEqual(try JSONDecoder().decode(WorkbenchActionAnswer.self, from: Data(done.utf8)).result?.flash, "added")
        let body = try JSONEncoder().encode(["value": WorkbenchStepValue.index(2)])
        XCTAssertEqual(String(data: body, encoding: .utf8), #"{"value":2}"#)
    }

    func testAnAddressIsATileInThisProjectOrAFullAddress() {
        XCTAssertEqual(ToolContent.address("/doc/x", project: "p")?.description, "luca://p/doc/x")
        XCTAssertEqual(ToolContent.address("luca://q/registry", project: "p")?.authority, "q")
        XCTAssertNil(ToolContent.address("", project: "p"))
    }

    func testDeclaredKeysNeverTakeTheAppsKeys() {
        let map = Keymap.merged(defaults: DefaultKeymap.file, user: nil)
        let declared = [
            WorkbenchToolKey(action: "add", key: "a", label: "add"),
            WorkbenchToolKey(action: "reload", key: "r", label: "my reload"),
            WorkbenchToolKey(action: "colon", key: ":", label: "x"),
            WorkbenchToolKey(action: "space", key: "Space", label: "x"),
            WorkbenchToolKey(action: "seq", key: "g g", label: "x"),
            WorkbenchToolKey(action: "again", key: "a", label: "x"),
            WorkbenchToolKey(action: "hint", key: "f", label: "x"),
            WorkbenchToolKey(action: "big", key: "A", label: "big add"),
        ]
        let out = ToolKeys.resolve(declared, keymap: map, kind: "luca-tool")
        XCTAssertEqual(out.keys.map(\.action), ["add", "big"])
        XCTAssertEqual(out.warnings.count, 6)
        XCTAssertTrue(out.warnings.contains { $0.hasPrefix("reload:") && $0.contains("built-in wins") })
        XCTAssertTrue(out.warnings.contains { $0.hasPrefix("colon:") && $0.contains("belongs to the app") })
        XCTAssertTrue(out.warnings.contains { $0.hasPrefix("seq:") && $0.contains("one key") })
        XCTAssertTrue(out.warnings.contains { $0.hasPrefix("again:") && $0.contains("twice") })
        XCTAssertTrue(out.warnings.contains { $0.hasPrefix("hint:") && $0.contains("hint mode") })
    }

    @MainActor
    func testTheToolKindIsAnIndexWithItsOwnKeysAndALeaderKey() {
        let map = Keymap.merged(defaults: DefaultKeymap.file, user: nil)
        XCTAssertTrue(Keymap.indexKinds.contains("luca-tool"))
        XCTAssertEqual(map.keyLabel(for: "luca.tools"), "Space w")
        XCTAssertNotNil(map.binding(for: "lucaTool.actions"))
        TileKinds.registerBuiltIns()
        XCTAssertNotNil(TileKinds.kind(for: TileURI.luca(project: "p", tool: "tool", id: "todo")))
        XCTAssertNotNil(WorkbenchStyle.toneColor("good"))
        XCTAssertNotNil(WorkbenchStyle.toneColor("slot:3"))
        XCTAssertNil(WorkbenchStyle.toneColor("hotpink"))
    }
}
