import SwiftUI
import AppKit
import Combine
import MarkdownUI

/// A workbench chat as the tile draws it: the saved messages, and the reply
/// in flight (the user's message, the text so far, its tool calls). Socket
/// frames move it on. One reply at a time per conversation, so every frame
/// of this conversation belongs to the live turn. Pure, so it is tested.
struct WorkbenchChatTranscript: Equatable {
    struct Live: Equatable {
        var turnId: String?
        var user: String
        var text = ""
        var reasoning = ""
        var tools: [WorkbenchChatTool] = []
    }

    private(set) var messages: [WorkbenchChatMessage] = []
    private(set) var live: Live?
    /// The last turn's failure, in the host's words.
    private(set) var error: String?
    private var counter = 0

    var busy: Bool { live != nil }

    /// The conversation as the host opened it.
    mutating func load(_ view: WorkbenchChatView) {
        messages = view.messages ?? []
        if let l = view.live {
            live = Live(turnId: l.turnId, user: l.user, text: l.text, reasoning: l.reasoning ?? "", tools: l.tools)
        } else {
            live = nil
        }
    }

    /// This tile sent a message: show it at once.
    mutating func begin(user: String) {
        error = nil
        live = Live(turnId: nil, user: user)
    }

    /// The send failed before a turn started.
    mutating func abandon(_ why: String) {
        live = nil
        error = why
    }

    /// Apply one `chat-*` frame of this conversation.
    mutating func apply(_ frame: WorkbenchEvent) {
        switch frame.type {
        case "chat-start":
            if live == nil || live?.turnId != nil && live?.turnId != frame.turnId {
                live = Live(turnId: frame.turnId, user: frame.text ?? "")
            } else {
                live?.turnId = frame.turnId
            }
            error = nil
        case "chat-delta":
            guard let text = frame.text else { return }
            if live == nil { live = Live(turnId: frame.turnId, user: "") }
            live?.text += text
        case "chat-reasoning":
            guard let text = frame.text else { return }
            if live == nil { live = Live(turnId: frame.turnId, user: "") }
            live?.reasoning += text
        case "chat-history":
            // A retry or a clear rewrote the history: the host's copy wins.
            messages = frame.messages ?? []
            error = nil
        case "chat-tool":
            guard let tool = frame.tool else { return }
            if live == nil { live = Live(turnId: frame.turnId, user: "") }
            if let i = live?.tools.firstIndex(where: { $0.id == tool.id }) { live?.tools[i] = tool } else { live?.tools.append(tool) }
        case "chat-done", "chat-error":
            let turn = live ?? Live(turnId: frame.turnId, user: "")
            if !turn.user.isEmpty {
                messages.append(WorkbenchChatMessage(id: nextId(), role: "user", text: turn.user, tools: []))
            }
            let text = frame.type == "chat-done" ? (frame.text ?? turn.text) : turn.text
            if !text.isEmpty || !turn.tools.isEmpty || !turn.reasoning.isEmpty || frame.aborted == true {
                messages.append(WorkbenchChatMessage(id: nextId(), role: "assistant", text: text, tools: turn.tools, aborted: frame.aborted,
                                                     reasoning: turn.reasoning.isEmpty ? nil : turn.reasoning))
            }
            if frame.type == "chat-error" { error = frame.error ?? "The reply failed" }
            live = nil
        default:
            break
        }
    }

    private mutating func nextId() -> String {
        counter += 1
        return "local-\(counter)"
    }
}

/// `luca://<project>/chat/<conversationId>?assistant=<name>`: a chat with
/// one of the project's assistants, run by the host with Luca's own
/// `assistant` and `conversationHistory` (`POST /chat/open|send|stop`). The
/// reply streams over the socket token by token; tool calls show as they
/// start and end. `new` as the id asks the host for a fresh conversation;
/// the tile then takes the real id, so it opens the same one after a restart.
///
/// `?say=<text>` sends that as the first message once the chat is open, then
/// drops the option (a doc tile's `c` hands the document over that way).
/// `?extends=<conversationId>&extendsAssistant=<name>` opens it as the tech
/// support chat of that conversation: the host gives it tools to change that
/// chat's added tools. `?about=<name>` opens it about an assistant: the host
/// briefs it on that assistant's files. `?aboutHelper=<registry>/<id>` opens
/// it about a helper: the host briefs it on the inspector's docs and source.
/// briefs it on that assistant's files and gives it the editor's tools.
///
/// `i` writes, `Enter` sends, `Ctrl-c` stops the reply, `h` past
/// conversations, `n` a new chat, `t` tools for this chat, `s` tech support.
/// `:say <text>` sends from the command line.
@MainActor
final class WorkbenchChatContent: WorkbenchContent {
    static let kind = TileKind(id: "luca-chat", label: "Chat", glyph: "bubble.left.and.text.bubble.right") { uri, _ in
        WorkbenchChatContent(uri: uri)
    }

    let assistant: String
    @Published private(set) var conversationId: String
    @Published private(set) var transcript = WorkbenchChatTranscript()
    @Published private(set) var opened: WorkbenchChatView?
    @Published private(set) var loadError: String?
    @Published var draft = ""
    /// Messages sent while a reply was still coming. The next one goes out
    /// when the reply ends; "send now" stops the reply so it goes out at once.
    @Published private(set) var queued: [String] = []
    /// The tools added to this conversation only, as the host last said.
    @Published private(set) var extensions: [WorkbenchChatExtension] = []
    /// Set on a tech support chat: the chat it changes.
    let target: WorkbenchChatTarget?
    /// Set on a chat about an assistant (`?about=<name>`): the host briefs
    /// the chat on that assistant's files and gives it the tools to change them.
    let about: WorkbenchChatAbout?
    @Published private(set) var inputTick = 0
    /// This conversation's own provider, model and effort, and where the next turn goes.
    @Published private(set) var settings = WorkbenchChatSettings()
    @Published private(set) var routing: WorkbenchChatRouting?
    @Published private(set) var modelText: String?
    /// A settings change is on its way to the host.
    @Published var applyingSettings = false
    /// View preferences, for every chat tile (`, T` and `, o`).
    @Published var showThinking = WorkbenchChatContent.prefs.bool(forKey: WorkbenchChatContent.thinkingKey)
    @Published var showToolOutput = WorkbenchChatContent.prefs.object(forKey: WorkbenchChatContent.toolOutputKey) as? Bool ?? true
    /// The message `] ]` and `[ [` are on; `o` and `y m` act on it.
    @Published var cursor: String?
    /// Messages whose tool calls and thinking are open while those are hidden.
    @Published var expanded: Set<String> = []
    private var frameWatch: AnyCancellable?
    private var openTask: Task<Void, Never>?

    init(uri: TileURI) {
        assistant = uri.option("assistant") ?? ""
        conversationId = uri.id ?? "new"
        if let id = uri.option("extends"), let other = uri.option("extendsAssistant"), !id.isEmpty, !other.isEmpty {
            target = WorkbenchChatTarget(assistant: other, conversationId: id)
        } else {
            target = nil
        }
        if let name = uri.option("about"), !name.isEmpty {
            about = WorkbenchChatAbout(assistant: name)
        } else if let helper = uri.option("aboutHelper"), let address = HelperAddress(helper) {
            about = WorkbenchChatAbout(helper: .init(registry: address.registry, id: address.id))
        } else {
            about = nil
        }
        super.init(kindId: Self.kind.id, uri: uri, title: "\(uri.option("assistant") ?? "chat") · new chat")
    }

    override func makeBody() -> AnyView { AnyView(LucaChatView(model: self)) }

    override func hostChanged(_ client: WorkbenchClient?) {
        openTask?.cancel()
        frameWatch = nil
        guard let client else {
            if transcript.busy { transcript.abandon("The workbench host stopped during the reply") }
            return
        }
        client.connect()
        frameWatch = client.events
            .filter { $0.type.hasPrefix("chat-") }
            .sink { [weak self] frame in self?.take(frame) }
        open(client)
    }

    override func stop() {
        openTask?.cancel()
        frameWatch = nil
        super.stop()
    }

    private func take(_ frame: WorkbenchEvent) {
        guard frame.assistant == assistant, frame.conversationId == conversationId, conversationId != "new" else { return }
        switch frame.type {
        case "chat-extensions":
            extensions = frame.extensions ?? []
            return
        case "chat-settings":
            settings = frame.settings ?? WorkbenchChatSettings()
            routing = frame.routing
            modelText = frame.modelText
            if let name = frame.title, !name.isEmpty { title = "\(assistant) · \(name)" }
            return
        case "chat-deleted":
            Shell.shared.flash("Deleted the chat")
            Shell.shared.close(tileId)
            return
        default:
            break
        }
        let wasBusy = transcript.busy
        transcript.apply(frame)
        refreshLabel()
        // The reply ended cleanly: the next queued message goes out. After a
        // failure the queue waits, so a broken host does not eat every message.
        if wasBusy, !transcript.busy, frame.type == "chat-done", !queued.isEmpty {
            let next = queued.removeFirst()
            if !send(next) { queued.insert(next, at: 0) }
        }
    }

    private func open(_ client: WorkbenchClient) {
        guard !assistant.isEmpty else { loadError = "This address names no assistant (?assistant=<name>)"; return }
        stateLabel = "opening"
        openTask = Task { [weak self] in
            guard let self else { return }
            do {
                let view = try await client.openChat(assistant: self.assistant, conversationId: self.conversationId, target: self.target, about: self.about)
                guard !Task.isCancelled else { return }
                if view.ok == false {
                    self.loadError = view.error ?? "Could not open the chat"
                    self.stateLabel = "error"
                    return
                }
                if let id = view.conversationId, id != self.conversationId {
                    self.conversationId = id
                    self.uri = self.uri.with(id: id)
                }
                self.extensions = view.extensions ?? []
                self.loadError = nil
                self.transcript.load(view)
                self.adopt(view)
                // `?say=`: a first message the opener wrote (a doc tile's `c`), sent once.
                if let say = self.uri.option("say"), !say.isEmpty {
                    self.uri = self.uri.with(option: "say", nil)
                    Shell.shared.scheduleSave()
                    self.send(say)
                }
            } catch {
                guard !Task.isCancelled else { return }
                self.loadError = ErrorText.message(error)
                self.stateLabel = "error"
            }
        }
    }

    /// A view the host answered (open, settings, clear, rename).
    /// `transcript` also takes its messages (after a clear).
    func adopt(_ view: WorkbenchChatView, transcript reload: Bool = false) {
        if reload { transcript.load(view) }
        opened = view
        settings = view.settings ?? WorkbenchChatSettings()
        routing = view.routing
        modelText = view.modelText
        title = "\(assistant) · \(view.title ?? "chat")"
        refreshLabel()
    }

    func refreshLabel() {
        if transcript.busy { stateLabel = "streaming" }
        else if transcript.error != nil { stateLabel = "failed" }
        else { stateLabel = "\(transcript.messages.count) msgs" }
    }

    // MARK: Actions

    func submit() {
        let text = draft
        guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        if transcript.busy {
            queued.append(text)
            draft = ""
            return
        }
        if send(text) { draft = "" }
    }

    /// Send queued message `index` ahead of the rest. With a reply still
    /// coming it stops that reply first; the message goes out when the host
    /// confirms the stop (`chat-done`, via the queue).
    func sendNow(_ index: Int) {
        guard queued.indices.contains(index) else { return }
        let text = queued.remove(at: index)
        queued.insert(text, at: 0)
        if transcript.busy { stopReply() } else if send(text) { queued.removeFirst() }
    }

    func unqueue(_ index: Int) {
        guard queued.indices.contains(index) else { return }
        let text = queued.remove(at: index)
        if draft.isEmpty { draft = text }
    }

    @discardableResult
    func send(_ text: String) -> Bool {
        guard let host else { Shell.shared.flash("The workbench host is not running"); return false }
        guard opened != nil, conversationId != "new" else { Shell.shared.flash("Still opening the chat"); return false }
        guard !transcript.busy else { Shell.shared.flash("A reply is still coming. Ctrl-c stops it"); return false }
        transcript.begin(user: text)
        if transcript.messages.isEmpty { title = "\(assistant) · \(text.split(separator: "\n").first.map(String.init) ?? text)" }
        refreshLabel()
        let id = conversationId
        Task { [weak self] in
            do {
                let answer = try await host.sendChat(assistant: self?.assistant ?? "", conversationId: id, text: text)
                if answer.ok != true { self?.transcript.abandon(answer.error ?? "The send failed") }
            } catch {
                self?.transcript.abandon(ErrorText.message(error))
            }
            self?.refreshLabel()
        }
        return true
    }

    func stopReply() {
        guard let host, transcript.busy else { return Shell.shared.flash("No reply is coming") }
        let id = conversationId
        Task {
            do { try await host.stopChat(assistant: assistant, conversationId: id) } catch { Shell.shared.flash(ErrorText.message(error)) }
        }
    }

    override func perform(_ action: String) -> Bool {
        switch action {
        case "lucaChat.input": inputTick += 1
        case "lucaChat.stop": stopReply()
        case "lucaChat.history": WorkbenchChat.pickConversation(project: projectId, assistant: assistant)
        case "lucaChat.new": Shell.shared.open(WorkbenchChat.newChat(project: projectId, assistant: assistant))
        case "lucaChat.tools": chooseTools()
        case "lucaChat.support": openSupport()
        case "lucaChat.assistants": Shell.shared.focusOrOpenTool(project: projectId, tool: "assistants")
        case "lucaChat.reload": if let host { open(host) }
        case "lucaChat.restart": restartHost()
        case "lucaChat.next", "lucaChat.prev": moveCursor(action == "lucaChat.next" ? 1 : -1)
        case "lucaChat.details": toggleDetails()
        case "lucaChat.copyMessage": copyMessage()
        default: return performSetting(action)
        }
        return true
    }

    private func moveCursor(_ by: Int) {
        let ids = transcript.messages.map(\.id)
        guard !ids.isEmpty else { return }
        let index = cursor.flatMap { ids.firstIndex(of: $0) } ?? ids.count
        cursor = ids[min(max(index + by, 0), ids.count - 1)]
    }

    /// The message `o` and `y m` act on: the one under the cursor, else the last reply.
    private var cursorMessage: WorkbenchChatMessage? {
        transcript.messages.first { $0.id == cursor } ?? transcript.messages.last { $0.role == "assistant" }
    }

    private func toggleDetails() {
        let message = transcript.messages.first { $0.id == cursor }
            ?? transcript.messages.last { $0.role == "assistant" && (!$0.tools.isEmpty || !($0.reasoning ?? "").isEmpty) }
        guard let id = message?.id else { return Shell.shared.flash("No tool calls or thinking to open") }
        if expanded.contains(id) { expanded.remove(id) } else { expanded.insert(id) }
    }

    private func copyMessage() {
        guard let message = cursorMessage else { return Shell.shared.flash("No message yet") }
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(message.text, forType: .string)
        Shell.shared.flash("Copied the message")
    }

    override func runCommand(_ verb: String, _ rest: String) -> Bool {
        switch verb {
        case "say":
            guard !rest.isEmpty else { Shell.shared.flash("Usage: say <message>"); return true }
            send(rest)
        case "stop": stopReply()
        case "rename":
            guard !rest.isEmpty else { _ = perform("lucaChat.rename"); return true }
            rename(rest)
        case "retry": retry()
        case "clear": _ = perform("lucaChat.clear")
        case "export": _ = perform("lucaChat.export")
        case "model": rest.isEmpty ? chooseModel() : setModelText(rest)
        case "effort": rest.isEmpty ? chooseEffort() : applySettings(reasoningEffort: rest == "default" ? "" : rest)
        default: return false
        }
        return true
    }
}

// MARK: - Views

struct LucaChatView: View {
    @ObservedObject var model: WorkbenchChatContent
    @FocusState private var inputFocused: Bool

    private var p: KitPalette { Theme.palette }

    var body: some View {
        VStack(spacing: 0) {
            header
            LucaChatSettingsStrip(model: model)
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: KitTokens.Space.s7) {
                        WorkbenchHostLine(status: model.hostStatus)
                        if let error = model.loadError {
                            Text(error).font(WorkbenchStyle.ui(KitTokens.TypeScale.sm)).foregroundStyle(p.bad.color)
                        }
                        if model.opened != nil, model.transcript.messages.isEmpty, model.transcript.live == nil {
                            Text("Say something to \(model.assistant). Replies stream here, with each tool call as it happens.")
                                .font(WorkbenchStyle.ui(KitTokens.TypeScale.sm))
                                .foregroundStyle(p.textMuted.color)
                        }
                        ForEach(model.transcript.messages) { message in
                            ChatBubble(role: message.role, who: message.role == "user" ? "You" : model.assistant,
                                       text: message.text, reasoning: message.reasoning ?? "", tools: message.tools,
                                       streaming: false, aborted: message.aborted == true,
                                       showThinking: model.showThinking || model.expanded.contains(message.id),
                                       showToolOutput: model.showToolOutput || model.expanded.contains(message.id),
                                       selected: model.cursor == message.id)
                                .id(message.id)
                        }
                        if let live = model.transcript.live {
                            if !live.user.isEmpty {
                                ChatBubble(role: "user", who: "You", text: live.user, reasoning: "", tools: [], streaming: false, aborted: false,
                                           showThinking: false, showToolOutput: false, selected: false)
                            }
                            ChatBubble(role: "assistant", who: model.assistant, text: live.text, reasoning: live.reasoning, tools: live.tools,
                                       streaming: true, aborted: false, showThinking: model.showThinking, showToolOutput: model.showToolOutput,
                                       selected: false)
                        }
                        if let error = model.transcript.error {
                            HStack(alignment: .firstTextBaseline, spacing: KitTokens.Space.s3) {
                                Image(systemName: "exclamationmark.triangle.fill").foregroundStyle(p.bad.color)
                                Text(error).font(WorkbenchStyle.ui(KitTokens.TypeScale.sm)).foregroundStyle(p.bad.color).textSelection(.enabled)
                                Button { model.retry() } label: {
                                    Text("retry").font(WorkbenchStyle.ui(KitTokens.TypeScale.sm, weight: .semibold)).foregroundStyle(p.accent.color)
                                }
                                .buttonStyle(.plain)
                                BoundKey(action: "lucaChat.retry", tint: p.accent.color, withKeysView: true)
                            }
                        }
                        Color.clear.frame(height: 1).id("end")
                    }
                    .padding(.horizontal, KitTokens.Space.s7)
                    .padding(.vertical, KitTokens.Space.s7)
                    .frame(maxWidth: 900, alignment: .leading)
                    .frame(maxWidth: .infinity, alignment: .center)
                }
                .onChange(of: model.transcript) { _, _ in
                    proxy.scrollTo("end", anchor: .bottom)
                }
                .onChange(of: model.cursor) { _, id in
                    if let id { withAnimation(.easeOut(duration: 0.15)) { proxy.scrollTo(id, anchor: .center) } }
                }
            }
            input
        }
        .background(p.surface.color)
        .onChange(of: model.inputTick) { _, _ in inputFocused = true }
    }

    private var header: some View {
        let color = WorkbenchStyle.roleColor("assistant")
        return HStack(alignment: .firstTextBaseline, spacing: KitTokens.Space.s4) {
            Circle().fill(color).frame(width: 9, height: 9)
            Text(model.assistant)
                .font(WorkbenchStyle.ui(KitTokens.TypeScale.md, weight: .semibold))
                .foregroundStyle(p.text.color)
            if let title = model.opened?.title, title != "New conversation" {
                Text(title)
                    .font(WorkbenchStyle.ui(KitTokens.TypeScale.sm))
                    .foregroundStyle(p.textMuted.color)
                    .lineLimit(1)
                    .truncationMode(.tail)
            }
            if let target = model.target {
                WorkbenchTag(text: "support for \(target.assistant)", color: p.info.color)
            }
            if let about = model.about ?? model.opened?.about {
                if let name = about.assistant {
                    Button { _ = Shell.shared.open(AssistantEditorContent.address(project: model.projectId, assistant: name), near: model.tileId) } label: {
                        WorkbenchTag(text: "building \(name)", color: WorkbenchStyle.thingColor("assistants"))
                    }
                    .buttonStyle(.plain)
                    .help("The assistant this chat builds. Click for its editor.")
                }
                if let helper = about.helper {
                    Button { Shell.shared.openOrFocus(HelperContent.address(project: model.projectId, registry: helper.registry, id: helper.id)) } label: {
                        WorkbenchTag(text: "about \(helper.title)", color: WorkbenchStyle.thingColor(helper.registry))
                    }
                    .buttonStyle(.plain)
                    .help("The helper this chat is about. Click for its inspector.")
                }
            }
            Spacer(minLength: KitTokens.Space.s4)
            if model.transcript.busy {
                Button { model.stopReply() } label: {
                    HStack(spacing: KitTokens.Space.s2) {
                        ProgressView().controlSize(.mini)
                        Text("streaming").foregroundStyle(WorkbenchStyle.toolStateColor("running"))
                        Image(systemName: "stop.circle.fill").foregroundStyle(p.bad.color)
                        BoundKey(action: "lucaChat.stop", tint: p.bad.color, withKeysView: true)
                    }
                    .font(WorkbenchStyle.caption())
                    .padding(.horizontal, KitTokens.Space.s4)
                    .padding(.vertical, 3)
                    .background(Capsule().fill(p.bad.color.opacity(0.08)))
                    .overlay(Capsule().stroke(p.bad.color.opacity(0.25), lineWidth: 1))
                }
                .buttonStyle(.plain)
                .help("Stop the reply (Ctrl-c)")
                .keyBadge("lucaChat.stop")
            }
            Text(model.conversationId)
                .font(WorkbenchStyle.code(KitTokens.TypeScale.xs))
                .foregroundStyle(p.textFaint.color)
                .textSelection(.enabled)
        }
        .padding(.horizontal, KitTokens.Space.s7)
        .padding(.vertical, KitTokens.Space.s4)
    }

    private var input: some View {
        VStack(spacing: KitTokens.Space.s3) {
            ForEach(Array(model.queued.enumerated()), id: \.offset) { index, text in
                queuedRow(index, text)
            }
            composer
        }
        .padding(.horizontal, KitTokens.Space.s7)
        .padding(.vertical, KitTokens.Space.s6)
        .overlay(alignment: .top) { Rectangle().fill(p.border.color).frame(height: 1) }
    }

    /// A message waiting for the reply to end. "send now" stops the reply so
    /// this one goes out first; the x takes it back into the draft.
    private func queuedRow(_ index: Int, _ text: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: KitTokens.Space.s4) {
            Image(systemName: "clock").foregroundStyle(p.textFaint.color).font(WorkbenchStyle.caption())
            Text(text)
                .font(WorkbenchStyle.ui(KitTokens.TypeScale.sm))
                .foregroundStyle(p.textBody.color)
                .lineLimit(3)
                .frame(maxWidth: .infinity, alignment: .leading)
            Button { model.sendNow(index) } label: {
                Text(model.transcript.busy ? "send now" : "send")
                    .font(WorkbenchStyle.ui(KitTokens.TypeScale.xs, weight: .semibold))
                    .foregroundStyle(p.accent.color)
            }
            .buttonStyle(.plain)
            .help(model.transcript.busy ? "Stop the reply and send this message" : "Send this message")
            Button { model.unqueue(index) } label: {
                Image(systemName: "xmark").font(WorkbenchStyle.caption()).foregroundStyle(p.textFaint.color)
            }
            .buttonStyle(.plain)
            .help("Take it back into the draft")
        }
        .padding(.horizontal, KitTokens.Space.s6)
        .padding(.vertical, KitTokens.Space.s3)
        .background(RoundedRectangle(cornerRadius: KitTokens.Radius.md).fill(p.raised.color.opacity(0.6)))
        .overlay(RoundedRectangle(cornerRadius: KitTokens.Radius.md).stroke(p.border.color, lineWidth: 1))
    }

    private var placeholder: String {
        if model.transcript.busy { return "a reply is coming; Enter queues the message" }
        return "message \(model.assistant); Enter sends, Shift-Return adds a line"
    }

    private var composer: some View {
        TextField(placeholder, text: $model.draft, axis: .vertical)
            .textFieldStyle(.plain)
            .font(WorkbenchStyle.ui(KitTokens.TypeScale.md))
            .foregroundStyle(p.text.color)
            .lineLimit(1...10)
            // A vertical TextField only wraps when its width is pinned; without
            // this it grows sideways when the tile is narrow (a canvas beside it).
            .frame(maxWidth: .infinity, alignment: .leading)
            .fixedSize(horizontal: false, vertical: true)
            .focused($inputFocused)
            .onSubmit { model.submit() }
            .keyBadge("lucaChat.input")
            .hintTarget("lucaChat.input", in: model.hints) { _ = model.perform("lucaChat.input") }
            .padding(.horizontal, KitTokens.Space.s6)
            .padding(.vertical, KitTokens.Space.s5)
            .background(RoundedRectangle(cornerRadius: KitTokens.Radius.lg).fill(p.inset.color))
            .overlay(RoundedRectangle(cornerRadius: KitTokens.Radius.lg)
                .stroke(inputFocused ? p.accent.color.opacity(0.7) : p.border.color, lineWidth: inputFocused ? 1.5 : 1))
    }
}

/// The row under a chat's header: what this conversation runs on and what
/// the transcript shows. Each chip is a button and names its key. A chip
/// in a stronger tint is this chat's own choice, over the assistant's.
struct LucaChatSettingsStrip: View {
    @ObservedObject var model: WorkbenchChatContent

    private var p: KitPalette { Theme.palette }

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: KitTokens.Space.s3) {
                let ownModel = !(model.settings.provider ?? "").isEmpty || !(model.settings.model ?? "").isEmpty
                chip("model", model.modelText ?? "…", color: p.syntax.function.color, strong: ownModel, action: "lucaChat.set.model") {
                    model.chooseModel()
                }
                chip("effort", model.effortText, color: p.syntax.number.color, strong: !(model.settings.reasoningEffort ?? "").isEmpty,
                     action: "lucaChat.set.model") {
                    model.chooseEffort()
                }
                chip("thinking", model.showThinking ? "shown" : "hidden", color: p.info.color, strong: model.showThinking,
                     action: "lucaChat.set.thinking") {
                    model.toggleThinking()
                }
                chip("tool output", model.showToolOutput ? "shown" : "hidden", color: WorkbenchStyle.roleColor("tool"), strong: model.showToolOutput,
                     action: "lucaChat.set.toolOutput") {
                    model.toggleToolOutput()
                }
                if let tools = model.opened?.tools, !tools.isEmpty {
                    chip("tools", "\(tools.count) built in", color: p.good.color, strong: false, action: nil) {}
                        .help(tools.joined(separator: ", "))
                }
                ForEach(model.extensions, id: \.feature) { entry in
                    chip("+", entry.label, color: p.accent.color, strong: true, action: nil) { model.configure(entry.feature) }
                        .help(entry.description ?? (entry.only?.joined(separator: ", ") ?? "all its tools"))
                }
                Button { _ = model.perform("lucaChat.tools") } label: {
                    HStack(spacing: KitTokens.Space.s2) {
                        Image(systemName: "plus.circle").foregroundStyle(p.accent.color)
                        Text("add tools").font(WorkbenchStyle.caption()).foregroundStyle(p.textMuted.color)
                        BoundKey(action: "lucaChat.tools", tint: p.accent.color, withKeysView: true)
                    }
                }
                .buttonStyle(.plain)
                if model.applyingSettings { ProgressView().controlSize(.mini) }
            }
            .padding(.horizontal, KitTokens.Space.s7)
            .padding(.vertical, KitTokens.Space.s3)
        }
        .background(p.raised.color.opacity(0.6))
        .overlay(alignment: .top) { Rectangle().fill(p.border.color).frame(height: 1) }
        .overlay(alignment: .bottom) { Rectangle().fill(p.border.color).frame(height: 1) }
    }

    private func chip(_ label: String, _ value: String, color: Color, strong: Bool, action: String?, tap: @escaping () -> Void) -> some View {
        Button(action: tap) {
            HStack(spacing: KitTokens.Space.s2) {
                Text(label).foregroundStyle(p.textFaint.color)
                Text(value).foregroundStyle(strong ? color : p.textBody.color).lineLimit(1)
                if let action { BoundKey(action: action, tint: color, withKeysView: true) }
            }
            .font(WorkbenchStyle.caption())
            .padding(.horizontal, KitTokens.Space.s4)
            .padding(.vertical, 3)
            .background(Capsule().fill(color.opacity(strong ? 0.16 : 0.07)))
            .overlay(Capsule().stroke(color.opacity(strong ? 0.35 : 0.18), lineWidth: 1))
        }
        .buttonStyle(.plain)
    }
}

/// One message: who wrote it in their color, its thinking, the tool calls
/// of the turn, then the text as markdown. A user message sits on a soft
/// accent card. With tool output hidden each call is one line.
private struct ChatBubble: View {
    let role: String
    let who: String
    let text: String
    let reasoning: String
    let tools: [WorkbenchChatTool]
    let streaming: Bool
    let aborted: Bool
    let showThinking: Bool
    let showToolOutput: Bool
    let selected: Bool

    private var p: KitPalette { Theme.palette }
    private var color: Color { WorkbenchStyle.roleColor(role) }

    var body: some View {
        VStack(alignment: .leading, spacing: KitTokens.Space.s4) {
            HStack(alignment: .firstTextBaseline, spacing: KitTokens.Space.s3) {
                Circle().fill(color).frame(width: 7, height: 7)
                Text(who)
                    .font(WorkbenchStyle.ui(KitTokens.TypeScale.xs, weight: .semibold))
                    .foregroundStyle(color)
                if streaming {
                    ProgressView().controlSize(.mini)
                }
                if aborted {
                    WorkbenchTag(text: "stopped", color: p.warn.color)
                }
                if !showThinking, !reasoning.isEmpty {
                    Text("thought \(reasoning.split(separator: " ").count) words")
                        .font(WorkbenchStyle.ui(KitTokens.TypeScale.xs))
                        .foregroundStyle(p.textFaint.color)
                }
            }
            VStack(alignment: .leading, spacing: KitTokens.Space.s5) {
                if showThinking, !reasoning.isEmpty {
                    Text(reasoning)
                        .font(WorkbenchStyle.ui(KitTokens.TypeScale.sm))
                        .italic()
                        .foregroundStyle(p.textMuted.color)
                        .textSelection(.enabled)
                        .padding(.leading, KitTokens.Space.s5)
                        .overlay(alignment: .leading) { Rectangle().fill(p.info.color.opacity(0.5)).frame(width: 2) }
                }
                if showToolOutput {
                    ForEach(tools) { tool in ToolCallCard(tool: tool) }
                } else if !tools.isEmpty {
                    VStack(alignment: .leading, spacing: KitTokens.Space.s2) {
                        ForEach(tools) { tool in ToolCallLine(tool: tool) }
                    }
                }
                if !text.isEmpty {
                    Markdown(streaming ? text + " ▍" : text)
                        .tilesMarkdown()
                        .textSelection(.enabled)
                } else if streaming, tools.isEmpty {
                    Text(reasoning.isEmpty || showThinking ? "thinking…" : "thinking… (\(reasoning.split(separator: " ").count) words)")
                        .font(WorkbenchStyle.ui(KitTokens.TypeScale.sm)).foregroundStyle(p.textFaint.color)
                }
            }
            .padding(.horizontal, KitTokens.Space.s6)
            .padding(.vertical, KitTokens.Space.s5)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: KitTokens.Radius.lg).fill(role == "user" ? color.opacity(0.09) : p.raised.color))
            .overlay(alignment: .leading) {
                UnevenRoundedRectangle(topLeadingRadius: KitTokens.Radius.lg, bottomLeadingRadius: KitTokens.Radius.lg)
                    .fill(color.opacity(0.8))
                    .frame(width: 3)
            }
            .overlay(RoundedRectangle(cornerRadius: KitTokens.Radius.lg)
                .stroke(selected ? p.accent.color.opacity(0.8) : p.border.color.opacity(role == "user" ? 0.4 : 1), lineWidth: selected ? 1.5 : 1))
        }
    }
}

/// A tool call in one line, for when tool output is hidden.
private struct ToolCallLine: View {
    let tool: WorkbenchChatTool

    private var p: KitPalette { Theme.palette }

    var body: some View {
        let state = WorkbenchStyle.toolStateColor(tool.status)
        HStack(alignment: .firstTextBaseline, spacing: KitTokens.Space.s3) {
            if tool.status == "running" { ProgressView().controlSize(.mini) }
            else {
                Image(systemName: tool.status == "failed" ? "xmark.circle.fill" : "checkmark.circle.fill")
                    .font(.system(size: 11))
                    .foregroundStyle(state)
            }
            Text(tool.name)
                .font(WorkbenchStyle.code(KitTokens.TypeScale.xs, weight: .semibold))
                .foregroundStyle(WorkbenchStyle.roleColor("tool"))
            if let ms = tool.ms {
                Text(ms < 1000 ? "\(ms) ms" : String(format: "%.1f s", Double(ms) / 1000))
                    .font(WorkbenchStyle.ui(KitTokens.TypeScale.xs))
                    .foregroundStyle(p.textFaint.color)
            }
        }
    }
}

/// One tool call: its name in the tool color, its state, the arguments and
/// the result in the code font. A long result opens on a click.
private struct ToolCallCard: View {
    let tool: WorkbenchChatTool
    @State private var open = false

    private var p: KitPalette { Theme.palette }

    var body: some View {
        let state = WorkbenchStyle.toolStateColor(tool.status)
        VStack(alignment: .leading, spacing: KitTokens.Space.s3) {
            HStack(alignment: .firstTextBaseline, spacing: KitTokens.Space.s3) {
                Image(systemName: "wrench.and.screwdriver.fill")
                    .font(.system(size: 11))
                    .foregroundStyle(WorkbenchStyle.roleColor("tool"))
                Text(tool.name)
                    .font(WorkbenchStyle.code(KitTokens.TypeScale.sm, weight: .semibold))
                    .foregroundStyle(WorkbenchStyle.roleColor("tool"))
                Spacer(minLength: KitTokens.Space.s4)
                if tool.status == "running" { ProgressView().controlSize(.mini) }
                WorkbenchTag(text: tool.status, color: state)
                if let ms = tool.ms {
                    Text(ms < 1000 ? "\(ms) ms" : String(format: "%.1f s", Double(ms) / 1000))
                        .font(WorkbenchStyle.ui(KitTokens.TypeScale.xs))
                        .foregroundStyle(p.textFaint.color)
                }
            }
            if !tool.argsText.isEmpty, tool.argsText != "{}" {
                Text(tool.argsText)
                    .font(WorkbenchStyle.code(KitTokens.TypeScale.xs))
                    .foregroundStyle(p.textMuted.color)
                    .textSelection(.enabled)
                    .lineLimit(open ? nil : 6)
            }
            if let result = tool.resultText, !result.isEmpty {
                Text(result)
                    .font(WorkbenchStyle.code(KitTokens.TypeScale.xs))
                    .foregroundStyle(tool.status == "failed" ? p.bad.color : p.textBody.color)
                    .textSelection(.enabled)
                    .lineLimit(open ? nil : 8)
                    .padding(KitTokens.Space.s4)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(RoundedRectangle(cornerRadius: KitTokens.Radius.md).fill(state.opacity(0.07)))
            }
        }
        .padding(.horizontal, KitTokens.Space.s5)
        .padding(.vertical, KitTokens.Space.s4)
        .background(RoundedRectangle(cornerRadius: KitTokens.Radius.md).fill(p.inset.color))
        .overlay(alignment: .leading) {
            UnevenRoundedRectangle(topLeadingRadius: KitTokens.Radius.md, bottomLeadingRadius: KitTokens.Radius.md)
                .fill(state)
                .frame(width: 3)
        }
        .contentShape(Rectangle())
        .onTapGesture { open.toggle() }
    }
}
