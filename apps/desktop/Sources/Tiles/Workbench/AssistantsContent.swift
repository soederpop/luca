import SwiftUI
import Combine

/// `luca://<project>/assistants`: the project's assistants from
/// `assistantsManager` (model, tools, conversations), then the newest past
/// conversations of any of them from `conversationHistory` (`GET /assistants`).
///
/// `Enter` on an assistant starts a new chat; on a conversation it opens it
/// again. `n` new chat with the focused card's assistant, `c` its past
/// conversations in the palette, `e` its editor, `a` scaffolds a new
/// assistant. Each assistant has its own color.
@MainActor
final class AssistantsContent: IndexContent {
    static let kind = TileKind(id: "luca-assistants", label: "Assistants", glyph: "person.2") { uri, _ in
        AssistantsContent(uri: uri)
    }

    let projectId: String
    private(set) var host: WorkbenchClient?
    private var hostWatch: AnyCancellable?
    private var frameWatch: AnyCancellable?
    /// Card id to the assistant it is or belongs to.
    private(set) var assistantOf: [String: String] = [:]

    init(uri: TileURI) {
        projectId = uri.authority
        super.init(kindId: Self.kind.id, uri: uri, owner: ProjectHub.ownerId(uri.authority),
                   title: "\(ProjectHub.shared.displayName(uri.authority)) assistants")
        stateLabel = HostStatus.starting.label
    }

    override var emptyNote: String { "No assistants." }

    override func start() {
        hostWatch = WorkbenchHostWatch.watch(projectId) { [weak self] status, client in
            guard let self else { return }
            if case .failed(let line) = status { self.notice = line }
            if status != .running { self.stateLabel = status.label }
            guard client !== self.host else { return }
            self.host = client
            self.frameWatch = nil
            guard let client else { return }
            self.reload()
            // A reply saved a conversation: the counts and the recent list move.
            client.connect()
            self.frameWatch = client.events
                .filter { $0.type == "chat-done" || $0.type == "chat-error" }
                .debounce(for: .milliseconds(500), scheduler: DispatchQueue.main)
                .sink { [weak self] _ in self?.reload(quiet: true) }
        }
    }

    override func stop() {
        hostWatch = nil
        frameWatch = nil
        host = nil
        super.stop()
    }

    override func loadStacks() async throws -> [IndexStack] {
        guard let host else { return [] }
        let reply = try await host.assistants()
        notice = reply.notice
        assistantOf = Self.assistantOf(reply)
        return Self.indexStacks(reply, project: projectId)
    }

    private var focusedAssistant: String? { state.focusedCard.flatMap { assistantOf[$0.id] } }

    override func performKind(_ action: String) -> Bool {
        switch action {
        case "lucaAssistants.new":
            guard let name = focusedAssistant else { Shell.shared.flash("No assistant in focus"); return true }
            Shell.shared.open(WorkbenchChat.newChat(project: projectId, assistant: name))
        case "lucaAssistants.history":
            guard let name = focusedAssistant else { Shell.shared.flash("No assistant in focus"); return true }
            WorkbenchChat.pickConversation(project: projectId, assistant: name)
        case "lucaAssistants.edit":
            guard let name = focusedAssistant else { Shell.shared.flash("No assistant in focus"); return true }
            guard !name.hasPrefix("guide:") else { Shell.shared.flash("A guide is a YAML file under guides/; open it with the file tile"); return true }
            _ = Shell.shared.open(AssistantEditorContent.address(project: projectId, assistant: name), near: tileId)
        case "lucaAssistants.create":
            Shell.shared.scaffold(in: projectId, type: "assistant")
        case "lucaAssistants.restart":
            ProjectHub.shared.restart(projectId)
        default:
            return false
        }
        return true
    }

    nonisolated static func assistantOf(_ reply: WorkbenchAssistants) -> [String: String] {
        var out: [String: String] = [:]
        for a in reply.assistants { out["assistant:" + a.name] = a.name }
        for c in reply.recent { out["conversation:" + c.id] = c.assistant }
        return out
    }

    /// Assistants, then recent conversations. A card wears its assistant's
    /// color. Pure, so it is tested.
    nonisolated static func indexStacks(_ reply: WorkbenchAssistants, project: String) -> [IndexStack] {
        let slots = Dictionary(reply.assistants.map { ($0.name, $0.slot) }, uniquingKeysWith: { a, _ in a })
        let assistants = reply.assistants.map { a in
            var lines: [String] = []
            if !a.description.isEmpty { lines.append(a.description) }
            if !a.tools.isEmpty { lines.append("Tools: " + a.tools.joined(separator: ", ")) }
            lines.append(a.conversationCount == 0 ? "No conversations yet" : "\(a.conversationCount) conversation\(a.conversationCount == 1 ? "" : "s") · last \(a.lastText)")
            if let error = a.error { lines.append("Could not load: \(error)") }
            if a.source == "extra" { lines.append("From a plugin: read only in the editor") }
            else if a.source == "home" { lines.append("From ~/.luca/assistants, shared by every project") }
            var card = IndexCard(id: "assistant:" + a.name, title: a.name, subtitle: a.modelText,
                                 preview: lines.joined(separator: "\n"),
                                 badge: "\(a.toolCount) tool\(a.toolCount == 1 ? "" : "s")",
                                 uri: WorkbenchChat.newChat(project: project, assistant: a.name))
            card.tone = "slot:\(a.slot)"
            card.subtitleIsCode = true
            return card
        }
        let recent = reply.recent.map { c in
            var card = IndexCard(id: "conversation:" + c.id, title: c.title, subtitle: "\(c.assistant) · \(c.updatedText)",
                                 preview: nil, badge: "\(c.messageCount) msgs",
                                 uri: WorkbenchChat.address(project: project, assistant: c.assistant, conversationId: c.conversationId))
            card.tone = "slot:\(slots[c.assistant] ?? -1)"
            return card
        }
        return [
            IndexStack(id: "assistants", title: "Assistants", cards: assistants, tone: "kind:assistants"),
            IndexStack(id: "recent", title: "Recent conversations", cards: recent),
        ]
    }
}

/// Addresses and pickers for workbench chats.
@MainActor
enum WorkbenchChat {
    nonisolated static func address(project: String, assistant: String, conversationId: String) -> TileURI {
        TileURI.luca(project: project, tool: "chat", id: conversationId, options: [.init(name: "assistant", value: assistant)])
    }

    /// A new chat: the host names the conversation when the tile opens it.
    nonisolated static func newChat(project: String, assistant: String) -> TileURI {
        address(project: project, assistant: assistant, conversationId: "new")
    }

    /// The palette lists an assistant's past conversations, newest first.
    static func pickConversation(project: String, assistant: String) {
        guard let host = ProjectHub.shared.client(project) else { return Shell.shared.flash("The workbench host is not running") }
        Task {
            do {
                let list = try await host.conversations(assistant: assistant)
                guard !list.conversations.isEmpty else { Shell.shared.flash("\(assistant) has no past conversations"); return }
                PaletteController.shared.choose("\(assistant): past conversations", list.conversations.map { c in
                    PaletteChoice(title: c.title, detail: "\(c.updatedText) · \(c.messageCount) msgs · \(c.conversationId)") {
                        Shell.shared.openOrFocus(address(project: project, assistant: assistant, conversationId: c.conversationId))
                    }
                })
            } catch {
                Shell.shared.flash(ErrorText.message(error))
            }
        }
    }

    /// `Space Q`: pick one of the project's assistants, then a new chat with it.
    /// `toEdit` opens the assistant editor instead of a chat.
    static func pickAssistant(project: String, toEdit: Bool = false) {
        guard let host = ProjectHub.shared.client(project) else {
            Shell.shared.focusOrOpenTool(project: project, tool: "assistants")
            return Shell.shared.flash("Starting the host: pick an assistant in the list")
        }
        let open: (String) -> Void = { name in
            Shell.shared.open(toEdit ? AssistantEditorContent.address(project: project, assistant: name) : newChat(project: project, assistant: name))
        }
        Task {
            do {
                let reply = try await host.assistants()
                // A guide is scripted, not an assistant folder: nothing to edit.
                let assistants = toEdit ? reply.assistants.filter { !$0.name.hasPrefix("guide:") } : reply.assistants
                guard !assistants.isEmpty else { Shell.shared.flash(reply.notice ?? "No assistants"); return }
                if assistants.count == 1 {
                    open(assistants[0].name)
                    return
                }
                PaletteController.shared.choose(toEdit ? "edit which assistant" : "new chat with", assistants.map { a in
                    PaletteChoice(title: a.name, detail: [a.modelText, a.description].filter { !$0.isEmpty }.joined(separator: " · ")) {
                        open(a.name)
                    }
                })
            } catch {
                Shell.shared.flash(ErrorText.message(error))
            }
        }
    }
}
