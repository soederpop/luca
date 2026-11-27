import XCTest
@testable import LucaDesktop

final class DocsAndChatTests: XCTestCase {
    private let docsJSON = """
    {"rootPath":"/p/docs","rootDisplay":"p/docs","notice":null,"error":null,"count":3,
     "stacks":[
      {"id":"Note","title":"Note","slot":0,"count":2,"cards":[
        {"id":"notes/first","title":"The first note","subtitle":"notes/first","preview":"Body.","badge":"draft","address":"doc/notes/first"},
        {"id":"notes/b c","title":"Spaces","subtitle":"notes/b c","preview":"","badge":"","address":"doc/notes/b c"}]},
      {"id":"Base","title":"Other","slot":-1,"count":1,"cards":[
        {"id":"README","title":"Readme","subtitle":"README","preview":"Loose.","badge":"","address":"doc/README"}]}]}
    """

    func testDocsStacksWearTheirModelColorAndOpenDocTiles() throws {
        let reply = try JSONDecoder().decode(WorkbenchDocs.self, from: Data(docsJSON.utf8))
        let stacks = LucaDocsContent.indexStacks(reply, project: "notes")
        XCTAssertEqual(stacks.map(\.id), ["Note", "Base"])
        XCTAssertEqual(stacks.map(\.title), ["Note", "Other"])
        XCTAssertEqual(stacks.map(\.tone), ["slot:0", "slot:-1"])
        let first = stacks[0].cards[0]
        XCTAssertEqual(first.uri.description, "luca://notes/doc/notes/first")
        XCTAssertEqual(first.uri.kindKey, "luca-doc")
        XCTAssertEqual(first.badge, "draft")
        XCTAssertNil(stacks[0].cards[1].badge)
        XCTAssertNil(stacks[0].cards[1].preview)
        // An id with a space survives the address round trip.
        let spaced = stacks[0].cards[1].uri
        XCTAssertEqual(TileURI(spaced.description)?.id, "notes/b c")
    }

    func testModelsAndADocDecode() throws {
        let models = """
        {"rootDisplay":"p/docs","notice":null,"error":null,"models":[
          {"name":"Note","prefix":"notes","description":"Short notes","count":2,"slot":0,
           "fields":[{"name":"status","kind":"enum","typeText":"enum(draft, done)","required":false,"default":"draft","description":null,"options":["draft","done"]}],
           "sections":[],"relationships":[]}]}
        """
        let m = try JSONDecoder().decode(WorkbenchModels.self, from: Data(models.utf8))
        XCTAssertEqual(m.models[0].fields[0].options, ["draft", "done"])
        XCTAssertEqual(m.models[0].fields[0].default, "draft")
        let doc = """
        {"id":"notes/crlf","model":"Note","slot":0,"title":"T","path":"/p/docs/notes/crlf.md","pathDisplay":"p/docs/notes/crlf.md",
         "file":"---\\ntitle: T\\n---\\r\\n\\r\\nBody\\r\\n","digest":"abc","size":24,"sizeText":"24 B",
         "fields":[{"name":"title","kind":"string","typeText":"string","value":"T","items":[],"extra":false,"required":true,"description":null},
                   {"name":"tags","kind":"array","typeText":"string[]","value":null,"items":[],"extra":false,"required":false,"description":null}]}
        """
        let d = try JSONDecoder().decode(WorkbenchDoc.self, from: Data(doc.utf8))
        XCTAssertEqual(d.file, "---\ntitle: T\n---\r\n\r\nBody\r\n")
        XCTAssertNil(d.fields[1].value)
    }

    private func doc(_ file: String, digest: String) -> WorkbenchDoc {
        WorkbenchDoc(id: "notes/x", model: "Note", slot: 0, title: "X", path: "/p/x.md", pathDisplay: "x.md",
                     file: file, digest: digest, size: file.utf8.count, sizeText: "", fields: [])
    }

    @MainActor func testTheDocBufferKeepsTheFileByteExactOutsideAnEdit() {
        let crlf = "---\ntitle: T\n---\r\n\r\n# T\r\n\r\nBody line.\r\n"
        let buffer = WorkbenchDocBuffer()
        buffer.take(doc(crlf, digest: "d1"))
        XCTAssertFalse(buffer.dirty)
        XCTAssertEqual(buffer.raw, crlf)
        XCTAssertEqual(buffer.text.frontmatter, "---\ntitle: T\n---\r\n\r\n")
        buffer.setBody(buffer.body.replacingOccurrences(of: "Body line.", with: "Body line, edited."))
        XCTAssertTrue(buffer.dirty)
        XCTAssertEqual(Array(buffer.raw.utf8), Array(crlf.replacingOccurrences(of: "Body line.", with: "Body line, edited.").utf8))
        XCTAssertTrue(buffer.replaceFirst("title: T", with: "title: U"))
        XCTAssertFalse(buffer.replaceFirst("not there", with: "x"))
        XCTAssertTrue(buffer.raw.hasPrefix("---\ntitle: U\n---\r\n"))
        buffer.saved(buffer.raw, digest: "d2")
        XCTAssertFalse(buffer.dirty)
        XCTAssertEqual(buffer.digest, "d2")
    }

    @MainActor func testADirtyBufferShowsAConflictWhenTheFileMoves() {
        let buffer = WorkbenchDocBuffer()
        buffer.take(doc("a\n", digest: "d1"))
        buffer.setRaw("mine\n")
        // The same file again: no conflict, the edit stays.
        buffer.take(doc("a\n", digest: "d1"))
        XCTAssertNil(buffer.conflict)
        XCTAssertEqual(buffer.raw, "mine\n")
        // The file changed on disk.
        buffer.take(doc("theirs\n", digest: "d2"))
        XCTAssertEqual(buffer.conflict?.digest, "d2")
        buffer.keepMine()
        XCTAssertNil(buffer.conflict)
        XCTAssertEqual(buffer.digest, "d2")
        XCTAssertEqual(buffer.raw, "mine\n")
        buffer.take(doc("again\n", digest: "d3"))
        buffer.takeTheirs()
        XCTAssertEqual(buffer.raw, "again\n")
        XCTAssertFalse(buffer.dirty)
    }

    private let assistantsJSON = """
    {"notice":null,"historyDir":"~/.cache/luca/disk-cache-x","assistants":[
      {"id":"helper","name":"helper","description":"Adds numbers","model":"m","provider":"local","modelText":"local · m","toolCount":1,"tools":["add"],
       "source":"project","folder":"/p/assistants/helper","folderDisplay":"p/assistants/helper","conversationCount":2,"lastText":"today 14:02","slot":0,"error":null},
      {"id":"writer","name":"writer","description":"","model":null,"provider":null,"modelText":"default model","toolCount":0,"tools":[],
       "source":"project","folder":"","folderDisplay":"","conversationCount":0,"lastText":"","slot":1,"error":null}],
     "recent":[{"conversationId":"desk-20261125-abc","thread":"helper:h:desk-20261125-abc","assistant":"helper","title":"add 2 and 3","messageCount":4,
       "updatedAt":"2026-11-25T14:02:00Z","updatedText":"today 14:02"}]}
    """

    func testAssistantsAndRecentConversationsAreStacks() throws {
        let reply = try JSONDecoder().decode(WorkbenchAssistants.self, from: Data(assistantsJSON.utf8))
        let stacks = AssistantsContent.indexStacks(reply, project: "notes")
        XCTAssertEqual(stacks.map(\.id), ["assistants", "recent"])
        let helper = stacks[0].cards[0]
        XCTAssertEqual(helper.title, "helper")
        XCTAssertEqual(helper.subtitle, "local · m")
        XCTAssertEqual(helper.badge, "1 tool")
        XCTAssertEqual(helper.tone, "slot:0")
        XCTAssertEqual(helper.uri.description, "luca://notes/chat/new?assistant=helper")
        XCTAssertTrue(helper.preview?.contains("Tools: add") ?? false)
        XCTAssertTrue(helper.preview?.contains("2 conversations · last today 14:02") ?? false)
        XCTAssertTrue(stacks[0].cards[1].preview?.contains("No conversations yet") ?? false)
        let recent = stacks[1].cards[0]
        XCTAssertEqual(recent.uri.kindKey, "luca-chat")
        XCTAssertEqual(recent.uri.id, "desk-20261125-abc")
        XCTAssertEqual(recent.uri.option("assistant"), "helper")
        XCTAssertEqual(recent.tone, "slot:0")
        XCTAssertEqual(recent.subtitle, "helper · today 14:02")
        let of = AssistantsContent.assistantOf(reply)
        XCTAssertEqual(of[recent.id], "helper")
        XCTAssertEqual(of["assistant:writer"], "writer")
    }

    private func frame(_ json: String) throws -> WorkbenchEvent {
        try JSONDecoder().decode(WorkbenchEvent.self, from: Data(json.utf8))
    }

    func testChatFramesDecodeAndMoveTheTranscript() throws {
        var t = WorkbenchChatTranscript()
        t.load(WorkbenchChatView(ok: true, error: nil, assistant: "helper", conversationId: "c1", thread: "helper:h:c1", title: "x",
                                 modelText: "m", tools: ["add"], messages: [], busy: false, live: nil))
        t.begin(user: "please add")
        XCTAssertTrue(t.busy)
        XCTAssertEqual(t.live?.user, "please add")
        let c = #""assistant":"helper","conversationId":"c1","turnId":"t1""#
        t.apply(try frame(#"{"type":"chat-start",\#(c),"text":"please add","at":1}"#))
        XCTAssertEqual(t.live?.turnId, "t1")
        XCTAssertEqual(t.live?.user, "please add")
        t.apply(try frame(#"{"type":"chat-tool",\#(c),"tool":{"id":"a1","name":"add","argsText":"{\n  \"a\": 2\n}","status":"running","resultText":null,"ms":null}}"#))
        XCTAssertEqual(t.live?.tools.map(\.status), ["running"])
        t.apply(try frame(#"{"type":"chat-tool",\#(c),"tool":{"id":"a1","name":"add","argsText":"{}","status":"done","resultText":"5","ms":3}}"#))
        XCTAssertEqual(t.live?.tools.map(\.status), ["done"])
        XCTAssertEqual(t.live?.tools.first?.ms, 3)
        XCTAssertNil(t.live?.tools.first?.purpose, "a frame without intent decodes (older hosts)")
        t.apply(try frame(#"{"type":"chat-tool",\#(c),"tool":{"id":"e1","name":"evalCode","argsText":"container.cwd","status":"running","resultText":null,"ms":null,"purpose":"Find the root","expectation":"a path"}}"#))
        XCTAssertEqual(t.live?.tools.last?.purpose, "Find the root")
        XCTAssertEqual(t.live?.tools.last?.expectation, "a path")
        t.apply(try frame(#"{"type":"chat-tool",\#(c),"tool":{"id":"e1","name":"evalCode","argsText":"container.cwd","status":"done","resultText":"\"/x\"","ms":1,"purpose":"Find the root","expectation":"a path"}}"#))
        t.apply(try frame(#"{"type":"chat-delta",\#(c),"text":"The sum "}"#))
        t.apply(try frame(#"{"type":"chat-delta",\#(c),"text":"is 5."}"#))
        XCTAssertEqual(t.live?.text, "The sum is 5.")
        t.apply(try frame(#"{"type":"chat-done",\#(c),"text":"The sum is 5.","aborted":false,"ms":120}"#))
        XCTAssertFalse(t.busy)
        XCTAssertEqual(t.messages.map(\.role), ["user", "assistant"])
        XCTAssertEqual(t.messages[1].text, "The sum is 5.")
        XCTAssertEqual(t.messages[1].tools.first?.resultText, "5")
    }

    func testAStoppedOrFailedReplyAndATurnFromElsewhere() throws {
        var t = WorkbenchChatTranscript()
        let c = #""assistant":"helper","conversationId":"c1","turnId":"t2""#
        // Another tile sent it: chat-start brings the user's message.
        t.apply(try frame(#"{"type":"chat-start",\#(c),"text":"tell a story"}"#))
        t.apply(try frame(#"{"type":"chat-delta",\#(c),"text":"Once"}"#))
        t.apply(try frame(#"{"type":"chat-done",\#(c),"text":"Once","aborted":true}"#))
        XCTAssertEqual(t.messages.map(\.role), ["user", "assistant"])
        XCTAssertEqual(t.messages[1].aborted, true)
        t.begin(user: "again")
        t.apply(try frame(#"{"type":"chat-error",\#(c),"error":"no model"}"#))
        XCTAssertEqual(t.error, "no model")
        XCTAssertFalse(t.busy)
        XCTAssertEqual(t.messages.last?.role, "user")
        t.begin(user: "x")
        t.abandon("host gone")
        XCTAssertFalse(t.busy)
        XCTAssertEqual(t.error, "host gone")
    }

    func testOpeningAConversationShowsTheReplyInFlight() throws {
        let json = """
        {"ok":true,"assistant":"helper","conversationId":"c1","thread":"helper:h:c1","title":"hi","modelText":"local · m","tools":["add"],
         "messages":[{"id":"m0","role":"user","text":"hi","tools":[]},{"id":"m1","role":"assistant","text":"Hello.","tools":[]}],
         "busy":true,"live":{"turnId":"t9","user":"more","text":"Part","tools":[]}}
        """
        let view = try JSONDecoder().decode(WorkbenchChatView.self, from: Data(json.utf8))
        var t = WorkbenchChatTranscript()
        t.load(view)
        XCTAssertEqual(t.messages.count, 2)
        XCTAssertEqual(t.live?.turnId, "t9")
        XCTAssertEqual(t.live?.text, "Part")
    }

    func testReasoningStreamsIntoTheTurnAndAHistoryFrameReplacesTheMessages() throws {
        var t = WorkbenchChatTranscript()
        let c = #""assistant":"helper","conversationId":"c1","turnId":"t3""#
        t.apply(try frame(#"{"type":"chat-start",\#(c),"text":"think"}"#))
        t.apply(try frame(#"{"type":"chat-reasoning",\#(c),"text":"Let me "}"#))
        t.apply(try frame(#"{"type":"chat-reasoning",\#(c),"text":"think."}"#))
        XCTAssertEqual(t.live?.reasoning, "Let me think.")
        t.apply(try frame(#"{"type":"chat-done",\#(c),"text":"Done.","aborted":false}"#))
        XCTAssertEqual(t.messages.last?.reasoning, "Let me think.")
        XCTAssertEqual(t.messages.last?.text, "Done.")
        // A turn that only thought still counts as a reply.
        t.apply(try frame(#"{"type":"chat-start",\#(c),"text":""}"#))
        t.apply(try frame(#"{"type":"chat-reasoning",\#(c),"text":"hmm"}"#))
        t.apply(try frame(#"{"type":"chat-done",\#(c),"text":"","aborted":false}"#))
        XCTAssertEqual(t.messages.count, 3)
        // A retry: the host's history replaces what the tile had.
        t.apply(try frame(#"{"type":"chat-error",\#(c),"error":"x"}"#))
        t.apply(try frame(#"{"type":"chat-history",\#(c),"messages":[{"id":"m0","role":"user","text":"think","tools":[]}]}"#))
        XCTAssertEqual(t.messages.map(\.text), ["think"])
        XCTAssertNil(t.error)
    }

    func testChatSettingsAndTheModelPickerDecode() throws {
        let f = try frame(#"{"type":"chat-settings","assistant":"helper","conversationId":"c1","settings":{"provider":"stub2","reasoningEffort":"high"},"routing":{"provider":"stub2","model":"other-model","reasoningEffort":"high"},"modelText":"stub2 · other-model","title":null}"#)
        XCTAssertEqual(f.settings, WorkbenchChatSettings(provider: "stub2", reasoningEffort: "high"))
        XCTAssertEqual(f.routing?.model, "other-model")
        XCTAssertEqual(f.modelText, "stub2 · other-model")
        XCTAssertFalse(f.settings?.isEmpty ?? true)
        XCTAssertTrue(WorkbenchChatSettings().isEmpty)
        let json = """
        {"settings":{},"routing":{"provider":"stub","model":"stub-model","reasoningEffort":""},"own":{"provider":"stub","model":"stub-model","text":"stub · stub-model"},
         "efforts":["minimal","low","medium","high","xhigh"],"choices":[{"provider":"openai","model":"","title":"OpenAI · gpt-5.4-mini","detail":"key set","ready":true}]}
        """
        let models = try JSONDecoder().decode(WorkbenchChatModels.self, from: Data(json.utf8))
        XCTAssertEqual(models.own.text, "stub · stub-model")
        XCTAssertEqual(models.choices.first?.provider, "openai")
        let view = try JSONDecoder().decode(WorkbenchChatView.self, from: Data(#"{"ok":true,"messages":[],"settings":{"model":"big"},"routing":{"provider":"stub","model":"big","reasoningEffort":""},"live":{"turnId":"t","user":"u","text":"","reasoning":"r","tools":[]}}"#.utf8))
        XCTAssertEqual(view.settings?.model, "big")
        XCTAssertEqual(view.live?.reasoning, "r")
        var t = WorkbenchChatTranscript()
        t.load(view)
        XCTAssertEqual(t.live?.reasoning, "r")
    }

    func testTheDocsAndChatKeysAreInTheDefaultKeymap() {
        let map = Keymap.merged(defaults: DefaultKeymap.file, user: nil)
        let byKind: [String: [String]] = [
            "luca-docs": ["lucaDocs.models", "lucaDocs.new", "lucaDocs.restart"],
            "luca-models": ["lucaModels.docs", "lucaModels.reload", "lucaModels.restart"],
            "luca-doc": ["lucaDoc.edit", "lucaDoc.rich", "lucaDoc.source", "lucaDoc.preview", "lucaDoc.fields", "lucaDoc.reload",
                         "lucaDoc.keepMine", "lucaDoc.takeTheirs", "lucaDoc.docs", "lucaDoc.chat", "lucaDoc.prompt", "lucaDoc.restart"],
            "luca-assistants": ["lucaAssistants.new", "lucaAssistants.history", "lucaAssistants.restart"],
            "luca-chat": ["lucaChat.input", "lucaChat.stop", "lucaChat.history", "lucaChat.new", "lucaChat.assistants",
                          "lucaChat.reload", "lucaChat.restart", "lucaChat.next", "lucaChat.prev", "lucaChat.details",
                          "lucaChat.copyMessage", "lucaChat.set.model", "lucaChat.set.thinking", "lucaChat.set.toolOutput",
                          "lucaChat.retry", "lucaChat.rename", "lucaChat.export", "lucaChat.clear", "lucaChat.delete"],
        ]
        for (kind, actions) in byKind {
            for action in actions {
                let binding = map.binding(for: action)
                XCTAssertNotNil(binding, action)
                XCTAssertFalse(binding?.label.isEmpty ?? true, action)
                XCTAssertEqual(binding?.kind, kind, action)
            }
        }
        for (action, spec) in [("luca.docs", "Space d"), ("luca.models", "Space D"), ("luca.assistants", "Space c"), ("luca.chat", "Space n")] {
            XCTAssertEqual(map.binding(for: action)?.scope, .leader, action)
            XCTAssertEqual(map.binding(for: action)?.spec, spec, action)
        }
        XCTAssertTrue(Keymap.indexKinds.contains("luca-docs"))
        XCTAssertTrue(Keymap.indexKinds.contains("luca-assistants"))
    }

    @MainActor func testTheKindsAreRegistered() {
        TileKinds.registerBuiltIns()
        for (tool, id) in [("docs", nil), ("models", nil), ("doc", "notes/first"), ("assistants", nil), ("chat", "new")] as [(String, String?)] {
            XCTAssertNotNil(TileKinds.kind(for: TileURI.luca(project: "notes", tool: tool, id: id)), tool)
        }
    }
}
