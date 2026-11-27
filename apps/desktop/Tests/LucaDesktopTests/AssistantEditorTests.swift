import XCTest
@testable import LucaDesktop

final class AssistantEditorTests: XCTestCase {
    private let viewJSON = """
    {"name":"helper","folder":"/p/assistants/helper","folderDisplay":"~/p/assistants/helper","source":"project","editable":true,"readOnly":null,
     "description":"Adds numbers","modelText":"stub · stub-model","tools":["add","readFile"],"ownTools":["add"],
     "use":[{"feature":"fileTools","only":["readFile"],"text":"container.feature('fileTools').toTools({ only: ['readFile'] })","line":9},
            {"feature":null,"text":"container.describer","line":10}],
     "files":[{"path":"CORE.md","kind":"definition","language":"markdown","present":true,"size":40,"sizeText":"40 B"},
              {"path":"ABOUT.md","kind":"definition","language":"markdown","present":false,"size":0,"sizeText":""},
              {"path":"tools.ts","kind":"definition","language":"typescript","present":true,"size":300,"sizeText":"300 B"},
              {"path":"skills/one/SKILL.md","kind":"skill","language":"markdown","present":true,"size":5,"sizeText":"5 B"}],
     "hooks":[{"name":"started","kind":"lifecycle","params":"","description":"The conversation exists.","present":true,"line":3},
              {"name":"beforeAsk","kind":"lifecycle","params":"question: string | any[], options?: any","description":"Every ask().","returns":"Return a string to replace the question.","present":false}],
     "providers":[{"name":"fileTools","description":"Files","tools":[{"name":"readFile","description":"Read"}],"used":true,"only":["readFile"]},
                  {"name":"grep","description":"Search","tools":[{"name":"search","description":"Find"}],"used":false}],
     "history":["2026-11-26T10-00-00-000Z-CORE.md"],"shadows":["~/.luca/assistants/helper"],"error":null}
    """

    func testTheEditorViewDecodes() throws {
        let v = try JSONDecoder().decode(WorkbenchAssistantEditor.self, from: Data(viewJSON.utf8))
        XCTAssertTrue(v.editable)
        XCTAssertEqual(v.files.map(\.path), ["CORE.md", "ABOUT.md", "tools.ts", "skills/one/SKILL.md"])
        XCTAssertFalse(v.files[1].present)
        XCTAssertTrue(v.files[0].isMarkdown)
        XCTAssertFalse(v.files[2].isMarkdown)
        XCTAssertEqual(v.hooks[0].line, 3)
        XCTAssertNil(v.hooks[1].line)
        XCTAssertEqual(v.hooks[1].returns, "Return a string to replace the question.")
        XCTAssertEqual(v.providers[0].only, ["readFile"])
        XCTAssertNil(v.use[1].feature)
        XCTAssertEqual(v.shadows, ["~/.luca/assistants/helper"])
    }

    func testAReadOnlyPluginAssistantDecodes() throws {
        let json = """
        {"name":"shared","folder":"/plug/assistants/shared","folderDisplay":"~/.luca/plugins/x/assistants/shared","source":"extra","editable":false,
         "readOnly":"This assistant comes from a plugin.","description":"","modelText":"default model","tools":[],"ownTools":[],"use":[],"files":[],"hooks":[],"providers":[],"history":[],"shadows":[],"error":null}
        """
        let v = try JSONDecoder().decode(WorkbenchAssistantEditor.self, from: Data(json.utf8))
        XCTAssertFalse(v.editable)
        XCTAssertEqual(v.source, "extra")
        XCTAssertEqual(v.readOnly, "This assistant comes from a plugin.")
    }

    func testTheAddressNamesTheAssistantAndItsFile() throws {
        let uri = AssistantEditorContent.address(project: "notes", assistant: "helper", file: "tools.ts")
        XCTAssertEqual(uri.description, "luca://notes/assistant/helper?file=tools.ts")
        XCTAssertEqual(uri.kindKey, "luca-assistant")
        let back = try XCTUnwrap(TileURI(uri.description))
        XCTAssertEqual(back.id, "helper")
        XCTAssertEqual(back.option("file"), "tools.ts")
        XCTAssertNil(AssistantEditorContent.address(project: "notes", assistant: "helper").option("file"))
    }

    func testAChatAboutAnAssistantDecodesAndKeepsTheLink() throws {
        let json = """
        {"ok":true,"assistant":"lucaExpert","conversationId":"desk-1","thread":"t","title":"New conversation","modelText":"m",
         "tools":["writeAssistantFile"],"messages":[],"busy":false,"live":null,"about":{"assistant":"helper"}}
        """
        let view = try JSONDecoder().decode(WorkbenchChatView.self, from: Data(json.utf8))
        XCTAssertEqual(view.about, WorkbenchChatAbout(assistant: "helper"))
        XCTAssertTrue(view.tools?.contains("writeAssistantFile") ?? false)
    }

    func testTheEditorKeysAreInTheDefaultKeymap() {
        let map = Keymap.merged(defaults: DefaultKeymap.file, user: nil)
        let actions = ["lucaAssistant.edit", "lucaAssistant.rich", "lucaAssistant.source", "lucaAssistant.preview", "lucaAssistant.sidebar",
                       "lucaAssistant.file", "lucaAssistant.newFile", "lucaAssistant.hook", "lucaAssistant.tools", "lucaAssistant.chat",
                       "lucaAssistant.talk", "lucaAssistant.copy", "lucaAssistant.reload", "lucaAssistant.keepMine", "lucaAssistant.takeTheirs",
                       "lucaAssistant.assistants", "lucaAssistant.restart"]
        for action in actions {
            let binding = map.binding(for: action)
            XCTAssertNotNil(binding, action)
            XCTAssertFalse(binding?.label.isEmpty ?? true, action)
            XCTAssertEqual(binding?.kind, "luca-assistant", action)
        }
        for action in ["lucaAssistants.edit", "lucaAssistants.create"] {
            XCTAssertEqual(map.binding(for: action)?.kind, "luca-assistants", action)
        }
        // One key, one action, within the kind.
        let keys = map.bindings(in: .kind, kind: "luca-assistant").map(\.spec)
        XCTAssertEqual(Set(keys).count, keys.count, "a key is bound twice: \(keys)")
    }

    @MainActor func testTheKindIsRegistered() {
        TileKinds.registerBuiltIns()
        XCTAssertNotNil(TileKinds.kind(for: TileURI.luca(project: "notes", tool: "assistant", id: "helper")))
        XCTAssertEqual(Theme.kindColor("luca-assistant"), WorkbenchStyle.thingColor("assistants"))
    }
}
