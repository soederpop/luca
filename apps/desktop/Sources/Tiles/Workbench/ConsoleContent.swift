import SwiftUI
import Combine

/// `luca://<project>/console`: a REPL with the container in scope, and the
/// docs of whatever is being typed beside it.
///
/// Entries run through the host's `POST /console` and share one scope, so a
/// name set in one is there in the next. While typing, `POST
/// /console/complete` answers from that live scope: the completion list,
/// the signature of the call the caret is in, and the docs of the name the
/// caret is on. The host shapes all of it; this tile draws it.
///
/// `Enter` runs the input (or adds a line while a bracket is open),
/// `Shift-Return` adds a line, `Tab` completes, `Ctrl-Space` completes
/// anywhere, up and down recall this project's history (kept in
/// `console/<project>.json` under the app folder). `?name` or `name?`
/// puts a name's docs in the transcript. `_` is the last result.
///
/// `luca://<project>/console/<session>` is another scope on the host (the
/// inspector's `e` opens one per helper); `?run=<code>` runs that code once
/// the host is there, then drops the option so a restore is a plain console.
@MainActor
final class ConsoleContent: WorkbenchContent {
    static let kind = TileKind(id: "luca-console", label: "Console", glyph: "chevron.left.forwardslash.chevron.right") { uri, _ in
        ConsoleContent(uri: uri)
    }

    struct Entry: Identifiable, Equatable {
        let id: Int
        let input: String
        var answer: WorkbenchConsoleAnswer?
        /// The request failed (no host, bad answer): one line.
        var failure: String?
        var running: Bool { answer == nil && failure == nil }
    }

    /// The input's text. The text view reports every change; `setInput`
    /// puts a new text in it.
    @Published var draft = ""
    /// The caret, as a UTF-16 offset in `draft`.
    @Published private(set) var caret = 0
    /// Goes up each time the model sets the input, so the text view takes it.
    @Published private(set) var push = 0
    @Published private(set) var entries: [Entry] = []
    @Published private(set) var inputTick = 0
    @Published private(set) var assist = ConsoleAssist()
    /// The docs last asked for (`?name`, a click on a member). Shown when
    /// the caret is on nothing with docs.
    @Published private(set) var pinned: WorkbenchDocCard?
    /// What is in scope now: the container, the enabled features, the names
    /// the entries set.
    @Published private(set) var scope: [WorkbenchCompletion.Item] = []
    @Published var docsShown: Bool {
        didSet { UserDefaults.standard.set(docsShown, forKey: Self.docsKey) }
    }
    // Set by the views.
    @Published var inputHeight: CGFloat = ConsoleInputView.lineHeight
    @Published var caretX: CGFloat = 0
    @Published var inputFocused = false
    /// True while the docs pane is on screen (the tile is wide enough).
    var paneVisible = false

    /// The host scope this tile runs in: the address's id, else `default`.
    let session: String
    private(set) var history: ConsoleHistory
    private var nextId = 0
    private var assistSeq = 0
    private static let docsKey = "lucaDesktop.console.docs"

    init(uri: TileURI) {
        history = ConsoleHistory.load(from: ConsoleHistory.file(project: uri.authority))
        docsShown = UserDefaults.standard.object(forKey: Self.docsKey) as? Bool ?? true
        session = uri.id.flatMap { $0.isEmpty ? nil : $0 } ?? "default"
        let name = ProjectHub.shared.displayName(uri.authority)
        super.init(kindId: Self.kind.id, uri: uri, title: session == "default" ? "\(name) console" : "\(name) console · \(session)")
    }

    /// The address for a project's console in `session`.
    nonisolated static func address(project: String, session: String? = nil, run: String? = nil) -> TileURI {
        TileURI.luca(project: project, tool: "console", id: session == "default" ? nil : session,
                     options: run.map { [.init(name: "run", value: $0)] } ?? [])
    }

    override func makeBody() -> AnyView { AnyView(ConsoleView(model: self)) }

    override func hostChanged(_ client: WorkbenchClient?) {
        stateLabel = client == nil ? hostStatus.label : nil
        assist.clear()
        guard client != nil else { return }
        loadScope()
        // `?run=`: code the opener wrote (the inspector's example), run once.
        if let code = uri.option("run"), !code.isEmpty {
            uri = uri.with(option: "run", nil)
            run(code)
        }
    }

    override func perform(_ action: String) -> Bool {
        switch action {
        case "lucaConsole.input": inputTick += 1
        case "lucaConsole.clear": entries = []
        case "lucaConsole.reset": resetScope()
        case "lucaConsole.history": pickFromHistory()
        case "lucaConsole.restart": restartHost()
        case "lucaConsole.docs": docsShown.toggle()
        case "lucaConsole.inspect": inspect()
        // For check runs, where no window has the keyboard.
        case "lucaConsole.key.tab": _ = inputKey(.tab)
        case "lucaConsole.key.down": _ = inputKey(.down)
        case "lucaConsole.key.enter": _ = inputKey(.enter)
        case "lucaConsole.key.complete": _ = inputKey(.complete)
        default: return false
        }
        return true
    }

    override func runCommand(_ verb: String, _ rest: String) -> Bool {
        switch verb {
        case "eval":
            guard !rest.isEmpty else { Shell.shared.flash("Usage: eval <code>"); return true }
            run(rest)
        case "reset": resetScope()
        case "doc", "describe":
            guard !rest.isEmpty else { Shell.shared.flash("Usage: doc <name>"); return true }
            run("?" + rest)
        default: return false
        }
        return true
    }

    /// `Esc` closes the completion list before it leaves the input.
    override func passesEscape() -> Bool { assist.open }

    override func typeForCheck(_ text: String) -> Bool {
        let ns = draft as NSString
        let at = min(caret, ns.length)
        let next = ns.replacingCharacters(in: NSRange(location: at, length: 0), with: text)
        draft = next
        caret = at + (text as NSString).length
        push += 1
        inputChanged(text: next, caret: caret, edited: true)
        return true
    }

    // MARK: Input

    /// The text view's text or caret changed. `edited`: the text did.
    func inputChanged(text: String, caret: Int, edited: Bool) {
        draft = text
        self.caret = caret
        if edited { history.endRecall() }
        let show = edited && ConsoleAssist.opens(after: text, caret: caret)
        if !show { assist.close() }
        requestAssist(show: show)
    }

    /// Put a text in the input, with the caret at `caret`.
    func setInput(_ text: String, caret: Int? = nil) {
        draft = text
        self.caret = caret ?? (text as NSString).length
        push += 1
        assist.close()
        requestAssist(show: false)
    }

    /// A key in the input. True when it was used here.
    func inputKey(_ key: ConsoleInputKey) -> Bool {
        switch key {
        case .enter:
            if assist.open { return takeCompletion() }
            if ConsoleSyntax.isComplete(draft) { submit() } else { insert("\n" + ConsoleSyntax.indent(after: draft, caret: caret)) }
            return true
        case .tab:
            if assist.open { return takeCompletion() }
            if draft.isEmpty || ConsoleAssist.opens(after: draft, caret: caret) { requestAssist(show: true) } else { insert("  ") }
            return true
        case .up:
            if assist.open { assist.move(-1); return true }
            return recallPrevious()
        case .down:
            if assist.open { assist.move(1); return true }
            return recallNext()
        case .escape:
            guard assist.open else { return false }
            assist.close()
            return true
        case .complete:
            requestAssist(show: true)
            return true
        }
    }

    /// A click on a row of the list.
    func pickCompletion(_ index: Int) {
        assist.select(index)
        _ = takeCompletion()
        inputTick += 1
    }

    private func takeCompletion() -> Bool {
        guard let next = assist.accept(in: draft) else { return false }
        setInput(next.text, caret: next.caret)
        return true
    }

    private func insert(_ text: String) {
        let ns = draft as NSString
        let at = min(caret, ns.length)
        setInput(ns.replacingCharacters(in: NSRange(location: at, length: 0), with: text), caret: at + (text as NSString).length)
    }

    /// Ask the host what it knows at the caret. Only the newest answer counts.
    private func requestAssist(show: Bool) {
        assistSeq += 1
        let seq = assistSeq
        guard let host, show || !draft.isEmpty else { assist.clear(); return }
        let code = draft
        let cursor = caret
        let session = self.session
        Task { [weak self] in
            guard let answer = try? await host.complete(code, cursor: cursor, session: session) else { return }
            guard let self, seq == self.assistSeq else { return }
            self.assist.apply(answer, show: show)
        }
    }

    // MARK: Docs

    /// The docs beside the input: what the caret is on, else the last asked for.
    var focusDoc: WorkbenchDocCard? { assist.focusDoc ?? pinned }

    /// The argument at the caret, when the docs shown are of the call being typed.
    var focusActive: Int? {
        guard assist.selected == nil, let signature = assist.signature, signature.doc == focusDoc else { return nil }
        return signature.active
    }

    /// Show a name's docs: in the pane when it is there, else as an entry.
    func showDoc(_ target: String) {
        guard paneVisible else { return run("?" + target) }
        guard let host else { return Shell.shared.flash("The workbench host is not running") }
        let session = self.session
        Task { [weak self] in
            do {
                let doc = try await host.describe(target, session: session)
                self?.pinned = doc
            } catch {
                Shell.shared.flash(ErrorText.message(error))
            }
        }
    }

    /// The docs target of a member of `doc`.
    static func memberTarget(of doc: WorkbenchDocCard, _ name: String) -> String {
        if doc.kind == "helper", let owner = doc.owner { return "\(owner.registry).\(owner.id).\(name)" }
        return "\(doc.title).\(name)"
    }

    func unpin() { pinned = nil }

    /// Open the inspector of the helper the docs in focus belong to.
    func inspect(_ doc: WorkbenchDocCard? = nil) {
        guard let owner = (doc ?? focusDoc)?.owner else { return Shell.shared.flash("No helper in the docs to open") }
        guard let uri = TileURI(TileURI.lucaScheme + projectId + "/" + owner.address) else { return }
        Shell.shared.openOrFocus(uri)
    }

    /// What is in scope, for the docs pane at rest.
    private func loadScope() {
        guard let host else { return }
        let session = self.session
        Task { [weak self] in
            guard let answer = try? await host.complete("", cursor: 0, session: session) else { return }
            self?.scope = answer.items.filter { !["keyword", "global"].contains($0.kind) }
        }
    }

    // MARK: Entries

    /// `Enter` in the input.
    func submit() {
        let code = draft
        guard !code.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        setInput("")
        assist.clear()
        run(code)
    }

    /// Run `code` as an entry, as if typed. The inspector sends examples here.
    func run(_ code: String) {
        history.add(code)
        history.save(to: ConsoleHistory.file(project: projectId))
        guard let host else { return Shell.shared.flash("The workbench host is not running") }
        let id = nextId
        nextId += 1
        entries.append(Entry(id: id, input: code))
        stateLabel = "running"
        let session = self.session
        Task { [weak self] in
            let result: Result<WorkbenchConsoleAnswer, Error>
            do { result = .success(try await host.console(code, session: session)) } catch { result = .failure(error) }
            guard let self, let index = self.entries.firstIndex(where: { $0.id == id }) else { return }
            switch result {
            case .success(let answer):
                self.entries[index].answer = answer
                // A `?name` entry is also the docs beside the input.
                if answer.type == "docs", let doc = answer.doc { self.pinned = doc }
            case .failure(let error): self.entries[index].failure = ErrorText.message(error)
            }
            if !self.entries.contains(where: \.running) { self.stateLabel = nil }
            // The entry may have set a name.
            self.loadScope()
        }
    }

    /// Up in a one-line input: the entry before.
    func recallPrevious() -> Bool {
        guard ConsoleHistory.recalls(draft), let text = history.previous(current: draft) else { return false }
        setInput(text)
        return true
    }

    /// Down: the entry after, then back to what was typed.
    func recallNext() -> Bool {
        guard ConsoleHistory.recalls(draft), let text = history.next() else { return false }
        setInput(text)
        return true
    }

    private func pickFromHistory() {
        let items = history.items.reversed().prefix(200).map { text in
            PaletteChoice(title: text.replacingOccurrences(of: "\n", with: " ⏎ "), detail: "") { [weak self] in
                self?.setInput(text)
                self?.inputTick += 1
            }
        }
        guard !items.isEmpty else { return Shell.shared.flash("No history yet") }
        PaletteController.shared.choose("console history", Array(items))
    }

    private func resetScope() {
        guard let host else { return Shell.shared.flash("The workbench host is not running") }
        let session = self.session
        Task { [weak self] in
            do {
                try await host.resetConsole(session: session)
                Shell.shared.flash("Console scope reset: names set before are gone")
                self?.loadScope()
            } catch {
                Shell.shared.flash(ErrorText.message(error))
            }
        }
    }
}

/// The inputs typed in a project's console, oldest first, and where up and
/// down are while recalling. Pure, so it is tested.
struct ConsoleHistory: Equatable {
    static let limit = 500
    private(set) var items: [String] = []
    /// The recalled item; nil while editing a fresh draft.
    private var cursor: Int?
    /// What was typed before the recall began, for down past the newest.
    private var stash = ""

    init(items: [String] = []) { self.items = Array(items.suffix(Self.limit)) }

    /// Recall only in a one-line input, so up and down move the caret in a longer one.
    static func recalls(_ draft: String) -> Bool { !draft.contains("\n") }

    mutating func add(_ input: String) {
        endRecall()
        guard !input.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        if items.last != input { items.append(input) }
        if items.count > Self.limit { items.removeFirst(items.count - Self.limit) }
    }

    mutating func previous(current: String) -> String? {
        guard !items.isEmpty else { return nil }
        if let cursor {
            guard cursor > 0 else { return nil }
            self.cursor = cursor - 1
        } else {
            stash = current
            cursor = items.count - 1
        }
        return items[cursor!]
    }

    mutating func next() -> String? {
        guard let cursor else { return nil }
        if cursor + 1 < items.count {
            self.cursor = cursor + 1
            return items[cursor + 1]
        }
        self.cursor = nil
        return stash
    }

    mutating func endRecall() {
        cursor = nil
        stash = ""
    }

    // MARK: File

    private struct Stored: Codable { let items: [String] }

    static func file(project: String) -> URL {
        let safe = project.replacingOccurrences(of: "/", with: "_")
        return TilesPaths.root.appendingPathComponent("console/\(safe).json")
    }

    static func load(from url: URL) -> ConsoleHistory {
        guard let data = try? Data(contentsOf: url), let stored = try? JSONDecoder().decode(Stored.self, from: data) else { return ConsoleHistory() }
        return ConsoleHistory(items: stored.items)
    }

    func save(to url: URL) {
        try? FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        try? JSONEncoder().encode(Stored(items: items)).write(to: url, options: .atomic)
    }
}

struct ConsoleView: View {
    @ObservedObject var model: ConsoleContent

    private var p: KitPalette { Theme.palette }
    /// From the tile's left edge to the first letter of the input.
    private static let inputLeading: CGFloat = KitTokens.Space.s7 + KitTokens.Space.s6 + 14 + KitTokens.Space.s4
    private static let charWidth: CGFloat = ("M" as NSString).size(withAttributes: [.font: ConsoleInputView.font]).width

    var body: some View {
        GeometryReader { geo in
            let pane = model.docsShown && geo.size.width >= 940
            let paneWidth = pane ? min(520, max(400, geo.size.width * 0.36)) : 0
            HStack(spacing: 0) {
                main(width: geo.size.width - paneWidth, pane: pane)
                if pane {
                    Rectangle().fill(p.border.color).frame(width: 1)
                    ConsoleDocsPane(model: model).frame(width: paneWidth - 1)
                }
            }
            .onChange(of: pane, initial: true) { _, on in model.paneVisible = on }
        }
        .background(p.surface.color)
    }

    private func main(width: CGFloat, pane: Bool) -> some View {
        VStack(spacing: 0) {
            WorkbenchHostLine(status: model.hostStatus)
                .padding(.horizontal, KitTokens.Space.s7)
                .padding(.top, model.hostStatus == .running ? 0 : KitTokens.Space.s5)
            transcript
                .overlay(alignment: .bottomLeading) {
                    if model.assist.open { popup(width: width, pane: pane) }
                }
            VStack(spacing: KitTokens.Space.s4) {
                if let signature = model.assist.signature {
                    ConsoleSignatureStrip(signature: signature)
                        .transition(.opacity)
                }
                input
            }
            .padding(.horizontal, KitTokens.Space.s7)
            .padding(.top, KitTokens.Space.s5)
            .padding(.bottom, KitTokens.Space.s6)
            .background(p.surface.color)
            .overlay(alignment: .top) { Rectangle().fill(p.border.color).frame(height: 1) }
            .animation(.easeOut(duration: 0.12), value: model.assist.signature != nil)
        }
        .frame(width: width)
    }

    /// The list sits over the transcript, its names in line with the name being typed.
    private func popup(width: CGFloat, pane: Bool) -> some View {
        let prefix = model.assist.prefix(in: model.draft, caret: model.caret)
        let detail = !pane && width >= ConsoleCompletionPopup.listWidth + ConsoleCompletionPopup.detailWidth + 80
        let total = ConsoleCompletionPopup.listWidth + (detail ? ConsoleCompletionPopup.detailWidth + KitTokens.Space.s4 : 0)
        let wanted = Self.inputLeading + model.caretX - CGFloat(prefix.utf16.count) * Self.charWidth - 46
        let x = max(KitTokens.Space.s5, min(wanted, width - total - KitTokens.Space.s5))
        return ConsoleCompletionPopup(assist: model.assist, prefix: prefix, showsDetail: detail) { model.pickCompletion($0) }
            .padding(.leading, x)
            .padding(.bottom, KitTokens.Space.s4)
    }

    private var transcript: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: KitTokens.Space.s6) {
                    if model.entries.isEmpty { ConsoleWelcome(model: model) }
                    ForEach(model.entries) { entry in
                        ConsoleEntryView(entry: entry, model: model).id(entry.id)
                    }
                    Color.clear.frame(height: 1).id("end")
                }
                .padding(.horizontal, KitTokens.Space.s7)
                .padding(.vertical, KitTokens.Space.s6)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .onChange(of: model.entries) { _, _ in
                withAnimation(.easeOut(duration: 0.15)) { proxy.scrollTo("end", anchor: .bottom) }
            }
        }
    }

    private var input: some View {
        HStack(alignment: .top, spacing: KitTokens.Space.s4) {
            Text("›")
                .font(WorkbenchStyle.code(KitTokens.TypeScale.sm, weight: .bold))
                .foregroundStyle(WorkbenchStyle.inputColor)
                .frame(width: 14, height: ConsoleInputView.lineHeight)
            ConsoleInputView(model: model)
                .frame(height: model.inputHeight)
                .overlay(alignment: .topLeading) {
                    if model.draft.isEmpty {
                        Text("code, or ?name for docs")
                            .font(WorkbenchStyle.code(KitTokens.TypeScale.sm))
                            .foregroundStyle(p.textFaint.color)
                            .frame(height: ConsoleInputView.lineHeight)
                            .allowsHitTesting(false)
                    }
                }
                .keyBadge("lucaConsole.input")
                .hintTarget("lucaConsole.input", in: model.hints) { _ = model.perform("lucaConsole.input") }
        }
        .padding(.horizontal, KitTokens.Space.s6)
        .padding(.vertical, KitTokens.Space.s5)
        .background(RoundedRectangle(cornerRadius: KitTokens.Radius.lg).fill(p.inset.color))
        .overlay(RoundedRectangle(cornerRadius: KitTokens.Radius.lg)
            .stroke(model.inputFocused ? p.accent.color.opacity(0.7) : p.border.color, lineWidth: model.inputFocused ? 1.5 : 1))
        .contentShape(Rectangle())
        .onTapGesture { _ = model.perform("lucaConsole.input") }
    }
}

/// A key cap and what it does.
private struct ConsoleKeyTip: View {
    let key: String
    let text: String

    var body: some View {
        let p = Theme.palette
        HStack(alignment: .firstTextBaseline, spacing: KitTokens.Space.s4) {
            Text(key)
                .font(WorkbenchStyle.code(15, weight: .semibold))
                .foregroundStyle(p.text.color)
                .padding(.horizontal, KitTokens.Space.s3)
                .padding(.vertical, 2)
                .background(RoundedRectangle(cornerRadius: 5).fill(p.inset.color))
                .overlay(RoundedRectangle(cornerRadius: 5).stroke(p.borderStrong.color))
                .frame(minWidth: 118, alignment: .leading)
            Text(text).font(WorkbenchStyle.ui(KitTokens.TypeScale.xs)).foregroundStyle(p.textMuted.color)
        }
    }
}

/// The empty console: what it is and the few keys worth knowing.
private struct ConsoleWelcome: View {
    @ObservedObject var model: ConsoleContent

    var body: some View {
        let p = Theme.palette
        WorkbenchCard(tint: p.accent.color) {
            VStack(alignment: .leading, spacing: KitTokens.Space.s6) {
                VStack(alignment: .leading, spacing: KitTokens.Space.s3) {
                    Text("Console")
                        .font(WorkbenchStyle.ui(KitTokens.TypeScale.lg, weight: .semibold))
                        .foregroundStyle(p.text.color)
                    Text("The container and every enabled feature are in scope. Names you set stay between entries.")
                        .font(WorkbenchStyle.ui(KitTokens.TypeScale.sm))
                        .foregroundStyle(p.textMuted.color)
                        .fixedSize(horizontal: false, vertical: true)
                }
                VStack(alignment: .leading, spacing: KitTokens.Space.s4) {
                    ConsoleKeyTip(key: "Tab", text: "complete the name, with its docs beside it")
                    ConsoleKeyTip(key: "Ctrl-Space", text: "list everything that fits here")
                    ConsoleKeyTip(key: "?fs.readFile", text: "put a name's docs in the transcript (fs.readFile? works too)")
                    ConsoleKeyTip(key: "_", text: "the last result")
                    ConsoleKeyTip(key: "Shift-Return", text: "a new line. Enter also adds one while a bracket is open")
                    ConsoleKeyTip(key: "↑ ↓", text: "this project's history")
                }
            }
        }
    }
}

/// The docs beside the input. They follow the caret: the picked completion,
/// the call being typed, the name under the caret, then the last docs
/// asked for. At rest: what is in scope.
private struct ConsoleDocsPane: View {
    @ObservedObject var model: ConsoleContent

    private var p: KitPalette { Theme.palette }

    private var follows: String {
        if model.assist.selected != nil { return "picked in the list" }
        if model.assist.focusDoc != nil { return "at the caret" }
        return model.pinned == nil ? "in scope" : "last asked for"
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: KitTokens.Space.s4) {
                Image(systemName: "book.closed.fill").font(.system(size: 14, weight: .semibold)).foregroundStyle(p.accent.color)
                Text("Docs").font(WorkbenchStyle.ui(KitTokens.TypeScale.sm, weight: .semibold)).foregroundStyle(p.text.color)
                Text(follows).font(WorkbenchStyle.ui(KitTokens.TypeScale.xs)).foregroundStyle(p.textFaint.color)
                Spacer(minLength: 0)
                if model.assist.focusDoc == nil, model.pinned != nil {
                    Button { model.unpin() } label: {
                        Text("In scope").font(WorkbenchStyle.caption()).foregroundStyle(p.textMuted.color)
                            .padding(.horizontal, KitTokens.Space.s4).padding(.vertical, KitTokens.Space.s2)
                            .background(Capsule().stroke(p.border.color))
                    }
                    .buttonStyle(.plain)
                }
                Color.clear.frame(width: 1, height: 1).keyBadge("lucaConsole.docs")
            }
            .padding(.horizontal, KitTokens.Space.s7)
            .frame(height: 52)
            .overlay(alignment: .bottom) { Rectangle().fill(p.border.color).frame(height: 1) }

            if let doc = model.focusDoc {
                ScrollView {
                    DocCardView(
                        doc: doc, active: model.focusActive,
                        onMember: { model.showDoc(ConsoleContent.memberTarget(of: doc, $0)) },
                        onOwner: doc.owner.map { owner in { model.showDoc(owner.title) } },
                        onInspect: { model.inspect(doc) }, showsKey: true)
                        .padding(KitTokens.Space.s7)
                }
                // A new name starts at its top.
                .id(doc.title)
            } else {
                scope
            }
        }
        .background(p.ground.color.opacity(0.35))
    }

    private var scope: some View {
        let helpers = model.scope.filter { $0.kind == "helper" || $0.kind == "container" }
        let names = model.scope.filter { $0.kind != "helper" && $0.kind != "container" }
        return ScrollView {
            VStack(alignment: .leading, spacing: KitTokens.Space.s7) {
                if model.scope.isEmpty {
                    Text("Docs show here as you type.")
                        .font(WorkbenchStyle.ui(KitTokens.TypeScale.sm))
                        .foregroundStyle(p.textFaint.color)
                }
                if !names.isEmpty { section("Your names", names, color: p.syntax.number.color) }
                if !helpers.isEmpty { section("In scope", helpers, color: p.syntax.function.color) }
            }
            .padding(KitTokens.Space.s7)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func section(_ title: String, _ items: [WorkbenchCompletion.Item], color: Color) -> some View {
        VStack(alignment: .leading, spacing: KitTokens.Space.s4) {
            WorkbenchSectionTitle(title: title, count: items.count, color: color)
            VStack(alignment: .leading, spacing: KitTokens.Space.s2) {
                ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                    ConsoleScopeRow(item: item) { model.showDoc(item.label) }
                }
            }
        }
    }
}

private struct ConsoleScopeRow: View {
    let item: WorkbenchCompletion.Item
    let action: () -> Void
    @State private var hovered = false

    var body: some View {
        let p = Theme.palette
        let registry = item.kind == "helper" ? item.doc.owner?.registry : nil
        let color = DocKind.color(item.kind, registry: registry)
        Button(action: action) {
            HStack(alignment: .center, spacing: KitTokens.Space.s5) {
                ThingGlyph(symbol: DocKind.glyph(item.kind, registry: registry), color: color, size: 30)
                VStack(alignment: .leading, spacing: KitTokens.Space.s1) {
                    Text(item.label)
                        .font(WorkbenchStyle.code(KitTokens.TypeScale.sm, weight: .semibold))
                        .foregroundStyle(p.text.color)
                    if !item.detail.isEmpty {
                        Text(item.detail)
                            .font(item.kind == "helper" || item.kind == "container" ? WorkbenchStyle.ui(KitTokens.TypeScale.xs) : WorkbenchStyle.code(KitTokens.TypeScale.xs))
                            .foregroundStyle(p.textMuted.color)
                            .lineLimit(1)
                    }
                }
                Spacer(minLength: 0)
            }
            .padding(.horizontal, KitTokens.Space.s4)
            .padding(.vertical, KitTokens.Space.s4)
            .background(RoundedRectangle(cornerRadius: KitTokens.Radius.md).fill(hovered ? p.raised.color : .clear))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .onHover { hovered = $0 }
    }
}

private struct ConsoleEntryView: View {
    let entry: ConsoleContent.Entry
    let model: ConsoleContent

    private var p: KitPalette { Theme.palette }
    private var isDocs: Bool { entry.answer?.type == "docs" && entry.answer?.doc != nil }

    private var tint: Color {
        if entry.failure != nil || entry.answer?.ok == false { return p.bad.color }
        if entry.running { return p.info.color }
        if isDocs { return p.accent.color }
        return p.good.color.opacity(0.7)
    }

    var body: some View {
        WorkbenchCard(tint: tint) {
            VStack(alignment: .leading, spacing: KitTokens.Space.s5) {
                HStack(alignment: .firstTextBaseline, spacing: KitTokens.Space.s4) {
                    Text("›").font(WorkbenchStyle.code(KitTokens.TypeScale.sm, weight: .bold)).foregroundStyle(WorkbenchStyle.inputColor)
                    TilesCodeSyntaxHighlighter(palette: p).highlightCode(entry.input, language: "typescript")
                        .font(WorkbenchStyle.code(KitTokens.TypeScale.sm))
                        .foregroundStyle(p.text.color)
                        .lineSpacing(3)
                        .textSelection(.enabled)
                    Spacer(minLength: KitTokens.Space.s4)
                    if let answer = entry.answer, !isDocs {
                        if let type = answer.ok ? answer.type : answer.name {
                            WorkbenchTag(text: type, color: answer.ok ? WorkbenchStyle.typeColor : p.bad.color)
                        }
                        if let ms = answer.ms {
                            Text("\(ms) ms").font(WorkbenchStyle.ui(KitTokens.TypeScale.xs)).foregroundStyle(p.textFaint.color)
                        }
                    }
                }
                Rectangle().fill(p.border.color).frame(height: 1)
                if let logs = entry.answer?.logs, !logs.isEmpty {
                    VStack(alignment: .leading, spacing: KitTokens.Space.s2) {
                        ForEach(Array(logs.enumerated()), id: \.offset) { _, log in
                            HStack(alignment: .firstTextBaseline, spacing: KitTokens.Space.s4) {
                                Text(log.level)
                                    .font(WorkbenchStyle.ui(KitTokens.TypeScale.xs, weight: .semibold))
                                    .foregroundStyle(logColor(log.level))
                                    .frame(width: 44, alignment: .leading)
                                Text(log.text)
                                    .font(WorkbenchStyle.code(KitTokens.TypeScale.xs))
                                    .foregroundStyle(log.level == "log" || log.level == "info" ? p.textMuted.color : logColor(log.level))
                                    .textSelection(.enabled)
                            }
                        }
                    }
                }
                result
            }
        }
    }

    private func logColor(_ level: String) -> Color {
        switch level {
        case "error": return p.bad.color
        case "warn": return p.warn.color
        case "debug", "trace": return p.textFaint.color
        default: return p.info.color
        }
    }

    /// Under a helper that was the result: what it is, and a way to its docs.
    private func helperLine(_ doc: WorkbenchDocCard) -> some View {
        HStack(alignment: .center, spacing: KitTokens.Space.s5) {
            ThingGlyph(symbol: DocKind.glyph(of: doc), color: DocKind.color(of: doc), size: 30)
            VStack(alignment: .leading, spacing: KitTokens.Space.s1) {
                Text(doc.title).font(WorkbenchStyle.code(KitTokens.TypeScale.sm, weight: .semibold)).foregroundStyle(p.text.color)
                if !doc.summary.isEmpty {
                    docProse(doc.summary).font(WorkbenchStyle.ui(KitTokens.TypeScale.xs)).foregroundStyle(p.textMuted.color).lineLimit(2)
                }
            }
            Spacer(minLength: KitTokens.Space.s4)
            Button { model.showDoc(doc.title) } label: {
                Label("Docs", systemImage: "book.closed")
                    .font(WorkbenchStyle.caption())
                    .foregroundStyle(p.accent.color)
                    .padding(.horizontal, KitTokens.Space.s4).padding(.vertical, KitTokens.Space.s2)
                    .background(Capsule().stroke(p.accent.color.opacity(0.5)))
            }
            .buttonStyle(.plain)
        }
    }

    @ViewBuilder private var result: some View {
        if let failure = entry.failure {
            Text(failure).font(WorkbenchStyle.ui(KitTokens.TypeScale.sm)).foregroundStyle(p.bad.color)
        } else if let answer = entry.answer {
            if answer.ok, isDocs, let doc = answer.doc {
                DocCardView(
                    doc: doc,
                    onMember: { model.showDoc(ConsoleContent.memberTarget(of: doc, $0)) },
                    onOwner: doc.owner.map { owner in { model.showDoc(owner.title) } },
                    onInspect: { model.inspect(doc) })
                    .padding(.vertical, KitTokens.Space.s3)
            } else if answer.ok {
                if let doc = answer.doc {
                    helperLine(doc)
                } else if let tree = answer.tree, tree.children != nil {
                    ConsoleTreeRow(node: tree)
                } else {
                    Text(answer.text ?? "")
                        .font(WorkbenchStyle.code(KitTokens.TypeScale.sm))
                        .foregroundStyle(WorkbenchStyle.valueColor(answer.tree?.type ?? answer.type ?? ""))
                        .textSelection(.enabled)
                }
            } else {
                VStack(alignment: .leading, spacing: KitTokens.Space.s4) {
                    HStack(alignment: .firstTextBaseline, spacing: KitTokens.Space.s3) {
                        Image(systemName: "exclamationmark.triangle.fill").foregroundStyle(p.bad.color)
                        Text(answer.error ?? "failed")
                            .font(WorkbenchStyle.code(KitTokens.TypeScale.sm, weight: .semibold))
                            .foregroundStyle(p.bad.color)
                            .textSelection(.enabled)
                    }
                    if let hint = answer.hint {
                        Text(hint).font(WorkbenchStyle.ui(KitTokens.TypeScale.xs)).foregroundStyle(p.warn.color)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    if let stack = answer.stack, !stack.isEmpty {
                        VStack(alignment: .leading, spacing: KitTokens.Space.s2) {
                            Text("Stack").font(WorkbenchStyle.ui(KitTokens.TypeScale.xs, weight: .semibold)).foregroundStyle(p.textMuted.color)
                            Text(stack)
                                .font(WorkbenchStyle.code(KitTokens.TypeScale.xs))
                                .foregroundStyle(p.textMuted.color)
                                .textSelection(.enabled)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(KitTokens.Space.s5)
                        .background(RoundedRectangle(cornerRadius: KitTokens.Radius.md).fill(p.bad.color.opacity(0.07)))
                    }
                }
            }
        } else {
            HStack(spacing: KitTokens.Space.s3) {
                ProgressView().controlSize(.small)
                Text("running").font(WorkbenchStyle.ui(KitTokens.TypeScale.xs)).foregroundStyle(p.info.color)
            }
        }
    }
}

/// One node of a result tree. A container opens and closes on a click;
/// the host says which start open.
struct ConsoleTreeRow: View {
    let node: WorkbenchTreeNode
    @State private var open: Bool

    init(node: WorkbenchTreeNode) {
        self.node = node
        _open = State(initialValue: node.open ?? false)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: KitTokens.Space.s2) {
            HStack(alignment: .firstTextBaseline, spacing: KitTokens.Space.s3) {
                if node.children != nil {
                    Image(systemName: open ? "chevron.down" : "chevron.right")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(Theme.palette.textFaint.color)
                        .frame(width: 12)
                } else {
                    Color.clear.frame(width: 12, height: 1)
                }
                if let key = node.key {
                    Text(key).foregroundStyle(WorkbenchStyle.keyColor) + Text(":").foregroundStyle(Theme.palette.textFaint.color)
                }
                Text(node.text)
                    .foregroundStyle(node.children != nil ? WorkbenchStyle.typeColor : WorkbenchStyle.valueColor(node.type))
                    .lineLimit(node.children != nil ? 1 : nil)
                    .textSelection(.enabled)
            }
            .font(WorkbenchStyle.code(KitTokens.TypeScale.sm))
            .padding(.vertical, 1)
            .contentShape(Rectangle())
            .onTapGesture { if node.children != nil { open.toggle() } }
            if open, let children = node.children {
                VStack(alignment: .leading, spacing: KitTokens.Space.s2) {
                    ForEach(children.indices, id: \.self) { index in
                        ConsoleTreeRow(node: children[index])
                    }
                    if let more = node.more, more > 0 {
                        Text("… \(more) more")
                            .font(WorkbenchStyle.ui(KitTokens.TypeScale.xs))
                            .foregroundStyle(Theme.palette.textFaint.color)
                    }
                }
                .padding(.leading, KitTokens.Space.s6)
                .overlay(alignment: .leading) {
                    Rectangle().fill(Theme.palette.border.color).frame(width: 1).padding(.leading, 5)
                }
            }
        }
    }
}
