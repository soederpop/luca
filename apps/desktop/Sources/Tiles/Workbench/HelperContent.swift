import SwiftUI
import Combine
import MarkdownUI

/// `luca://<project>/helper/<registry>/<id>?view=docs|source`: the inspector
/// for one helper. The docs view draws what the host's
/// `GET /helper/<registry>/<id>` sends (docs, schemas, methods), the live
/// state and events from the host socket, and the last method call. The
/// source view is the helper's file (`GET …/source`) in the shared source
/// editor, saved with the doc tile's digest rule (`Cmd-s`, `:w`; a 409 is a
/// conflict bar, `d p` / `d o`); a plugin's or built-in helper is read only.
///
/// `m` calls a method: the palette picks it and asks for its arguments, the
/// host runs it and shapes the result. `e` picks one of the helper's
/// `@example` blocks and runs it in a console beside the tile, one console
/// scope per helper, so the next example sees the names the last one set.
/// `c` opens lucaArchitect beside the tile, briefed on this helper (one chat
/// per helper; a second `c` focuses it). `P` docs, `E` source, `i` edit.
@MainActor
final class HelperContent: WorkbenchContent {
    static let kind = TileKind(id: "luca-helper", label: "Helper", glyph: "cube") { uri, _ in
        HelperContent(uri: uri)
    }

    /// The two views of the tile.
    enum HelperTileView: String { case docs, source }

    nonisolated static func address(project: String, registry: String, id: String) -> TileURI {
        TileURI.luca(project: project, tool: "helper", id: "\(registry)/\(id)")
    }

    /// Who `c` talks to about a helper.
    static let expertAssistant = WorkbenchChatContent.supportAssistant

    /// The last method call, as the host answered it.
    struct CallShown: Equatable {
        let call: String
        let ok: Bool
        let text: String
        let detail: String
    }

    let address: HelperAddress?
    @Published private(set) var info: WorkbenchHelper?
    @Published private(set) var error: String?
    /// The live state from the last socket frame, else from the last load.
    @Published private(set) var stateText: String?
    @Published private(set) var events = HelperEventLog()
    @Published private(set) var lastCall: CallShown?
    @Published private(set) var calling: String?
    @Published private(set) var view: HelperTileView
    /// The source file as the host last sent it; nil until the source view is first shown.
    @Published private(set) var source: WorkbenchHelperSource?
    /// Why there is no source to show (built in, a folder, a read error).
    @Published private(set) var sourceError: String?
    @Published private(set) var saving = false
    let buffer = WorkbenchDocBuffer()
    private var loadTask: Task<Void, Never>?
    private var sourceTask: Task<Void, Never>?
    private var frameWatch: AnyCancellable?
    private var bufferWatch: AnyCancellable?
    private var sourceEditor: SourceEditorController?
    private var sourceLanguage = ""

    init(uri: TileURI) {
        address = HelperAddress(uri.id ?? "")
        view = HelperTileView(rawValue: uri.option("view") ?? "") ?? .docs
        super.init(kindId: Self.kind.id, uri: uri, title: address?.title ?? "helper")
        bufferWatch = buffer.objectWillChange
            .receive(on: DispatchQueue.main)
            .sink { [weak self] in self?.refreshLabel() }
    }

    override func makeBody() -> AnyView { AnyView(HelperView(model: self, buffer: buffer)) }

    override func hostChanged(_ client: WorkbenchClient?) {
        loadTask?.cancel()
        sourceTask?.cancel()
        frameWatch = nil
        guard let client, let address else {
            if address == nil { error = "Not a helper address: \(uri)" }
            return
        }
        frameWatch = client.events
            .filter { $0.registry == address.registry && $0.id == address.id }
            .sink { [weak self] frame in self?.take(frame) }
        client.subscribe(registry: address.registry, id: address.id)
        load(client)
        if view == .source { loadSource() }
    }

    override func perform(_ action: String) -> Bool {
        switch action {
        case "lucaHelper.call": pickMethod()
        case "lucaHelper.reload":
            if let host {
                load(host)
                if view == .source || source != nil { reloadSource() }
            } else { restartHost() }
        case "lucaHelper.restart": restartHost()
        case "lucaHelper.clearEvents": events.clear()
        case "lucaHelper.take": Shell.shared.takeInto(takeSource ?? TakeSource(project: projectId, registry: address?.registry ?? "", id: address?.id ?? "", origin: nil))
        case "lucaHelper.registry":
            Shell.shared.openOrFocus(TileURI.luca(project: projectId, tool: "registry",
                                                  options: address.map { [.init(name: "stack", value: $0.registry)] } ?? []))
        case "lucaHelper.docs": show(.docs)
        case "lucaHelper.source": show(.source)
        case "lucaHelper.edit": edit()
        case "lucaHelper.example": pickExample()
        case "lucaHelper.chat": chatAbout()
        case "doc.save", "lucaHelper.save": save()
        case "lucaHelper.keepMine":
            guard buffer.conflict != nil else { Shell.shared.flash("No conflict"); return true }
            buffer.keepMine()
        case "lucaHelper.takeTheirs":
            guard buffer.conflict != nil else { Shell.shared.flash("No conflict"); return true }
            buffer.takeTheirs()
        default: return false
        }
        refreshLabel()
        return true
    }

    // MARK: Docs and source views

    func show(_ next: HelperTileView) {
        view = next
        uri = uri.with(option: "view", next == .docs ? nil : next.rawValue)
        if next == .source, source == nil, sourceError == nil { loadSource() }
        refreshLabel()
    }

    /// `i`: the source view with the editor's keyboard. A read-only file still scrolls and selects.
    private func edit() {
        if view != .source { show(.source) }
        guard source != nil else { return Shell.shared.flash(sourceError ?? "Still loading the source") }
        sourceController.focus()
        Shell.shared.syncTextMode()
    }

    /// The source file, read on the first switch to the source view.
    private func loadSource() {
        guard let host, let address else { return }
        sourceTask?.cancel()
        sourceError = nil
        if source == nil { stateLabel = "loading" }
        sourceTask = Task { [weak self] in
            guard let self else { return }
            do {
                let next = try await host.helperSource(registry: address.registry, id: address.id)
                guard !Task.isCancelled else { return }
                self.source = next
                self.buffer.take(next.doc)
            } catch {
                guard !Task.isCancelled else { return }
                self.sourceError = ErrorText.message(error)
            }
            self.refreshLabel()
        }
    }

    private func reloadSource() {
        if buffer.dirty {
            PaletteController.shared.confirm("Drop your unsaved edits to \(source?.doc.title ?? "the source")?", yes: "Drop them and reload") { [weak self] in
                self?.buffer.takeTheirs()
                self?.loadSource()
            }
            return
        }
        loadSource()
    }

    func save(then done: (() -> Void)? = nil) {
        guard let host, let address, let source, let digest = buffer.digest else { return Shell.shared.flash("No source loaded: E shows it") }
        guard source.editable else { return Shell.shared.flash(source.readOnly ?? "This file is read only") }
        guard buffer.conflict == nil else { return Shell.shared.flash("The file changed on disk. d p keeps yours, d o takes the file") }
        guard buffer.dirty else { Shell.shared.flash("No changes"); done?(); return }
        guard !saving else { return Shell.shared.flash("Still saving") }
        let sent = buffer.raw
        saving = true
        refreshLabel()
        Task { [weak self] in
            guard let self else { return }
            do {
                let answer = try await host.saveHelperSource(registry: address.registry, id: address.id, text: sent, digest: digest)
                self.saving = false
                if let view = answer.view {
                    self.source = WorkbenchHelperSource(doc: view, editable: source.editable, readOnly: source.readOnly, origin: source.origin)
                    self.buffer.saved(sent, digest: view.digest)
                }
                Shell.shared.flash(answer.unchanged == true ? "No changes" : (answer.text ?? "Saved") + " · R restarts the host to load it")
                done?()
            } catch let conflict as WorkbenchDocConflict {
                self.saving = false
                if let current = conflict.current { self.buffer.take(current) }
                Shell.shared.flash("The file changed on disk since you opened it. d p keeps yours, d o takes the file")
            } catch {
                self.saving = false
                Shell.shared.flash("Save failed: \(ErrorText.message(error))")
            }
            self.refreshLabel()
        }
    }

    private func refreshLabel() {
        if buffer.conflict != nil { stateLabel = "conflict" }
        else if saving { stateLabel = "saving" }
        else if buffer.dirty { stateLabel = "modified" }
        else if view == .source { stateLabel = source == nil ? (sourceError == nil ? "loading" : "no source") : (source!.editable ? "source" : "read only") }
        else if let info { stateLabel = info.live ? "live" : "no instance" }
    }

    /// The source editor, made for the file's language on first use.
    var sourceController: SourceEditorController {
        let language = SourceEditorController.language(for: source?.doc.path ?? "x.ts")
        if let sourceEditor, sourceLanguage == language { return sourceEditor }
        let editor = SourceEditorController(buffer: buffer, language: language)
        editor.onSave = { [weak self] in self?.save() }
        editor.onClose = { [weak self] in
            guard let self else { return }
            Shell.shared.close(self.tileId)
        }
        editor.onEscape = { Shell.shared.leaveEditor() }
        editor.onVimChanged = { on in Shell.shared.flash(on ? "vim on" : "vim off") }
        sourceEditor = editor
        sourceLanguage = language
        return editor
    }

    override var editorHasKeyboard: Bool { view == .source && (sourceEditor?.hasFocus ?? false) }
    override func passesEscape() -> Bool { editorHasKeyboard }

    // MARK: Examples and chat

    /// `e`: the palette lists the helper's examples; the pick runs in a console beside this tile.
    func pickExample() {
        guard let info else { return Shell.shared.flash("Still loading") }
        let examples = info.examples ?? []
        guard !examples.isEmpty else { return openInstance() }
        if examples.count == 1 { return runExample(examples[0]) }
        PaletteController.shared.choose("run an example of \(info.title) in a console", examples.map { ex in
            PaletteChoice(title: ex.title, detail: Self.firstLine(ex.code)) { [weak self] in self?.runExample(ex) }
        })
    }

    /// With no examples, `e` makes the helper with its default options in its
    /// console, under its id when that is a plain name (`const fs = feature('fs')`).
    func openInstance() {
        guard let address, let code = Self.instanceCode(registry: address.registry, id: address.id) else {
            return Shell.shared.flash("\(info?.title ?? "This helper") has no @example blocks")
        }
        runInConsole(code)
    }

    /// The console line that makes a helper; nil for a registry with no factory (commands).
    nonisolated static func instanceCode(registry: String, id: String) -> String? {
        let factories = ["features": "feature", "clients": "client", "servers": "server"]
        guard let factory = factories[registry] else { return nil }
        let quoted = id.replacingOccurrences(of: "\\", with: "\\\\").replacingOccurrences(of: "'", with: "\\'")
        let isName = id.range(of: #"^[A-Za-z_$][\w$]*$"#, options: .regularExpression) != nil
        return isName ? "const \(id) = \(factory)('\(quoted)')" : "container.\(factory)('\(quoted)')"
    }

    /// The console scope the helper's examples run in: one per helper, so names carry over.
    var consoleSession: String { address.map { "\($0.registry)-\($0.id)" } ?? "default" }

    func runExample(_ example: WorkbenchHelper.Example) {
        runInConsole(example.code)
    }

    /// Run `code` in this helper's console beside the tile: the open one takes it, else one opens with it.
    func runInConsole(_ code: String) {
        let session = consoleSession
        if let tile = Shell.shared.tiles.values.first(where: {
            $0.content.kindId == ConsoleContent.kind.id && $0.uri.authority == projectId && ($0.uri.id ?? "default") == session
        }) {
            Shell.shared.focusTile(tile.id)
            (tile.content as? ConsoleContent)?.run(code)
            return
        }
        _ = Shell.shared.open(ConsoleContent.address(project: projectId, session: session, run: code), focus: true, near: tileId, group: true)
    }

    nonisolated static func firstLine(_ code: String) -> String {
        let lines = code.split(separator: "\n", omittingEmptySubsequences: true)
        guard let first = lines.first else { return "" }
        return lines.count > 1 ? "\(first) … (\(lines.count) lines)" : String(first)
    }

    /// `c`: lucaArchitect beside this tile, briefed on this helper (`?aboutHelper=`).
    /// One per helper: a second `c` focuses it. Without lucaArchitect in the
    /// project, the palette asks who.
    func chatAbout() {
        guard let host, let address else { return Shell.shared.flash("The workbench host is not running") }
        let key = "\(address.registry)/\(address.id)"
        if let tile = Shell.shared.tiles.values.first(where: {
            $0.content.kindId == WorkbenchChatContent.kind.id && $0.uri.authority == projectId && $0.uri.option("aboutHelper") == key
        }) {
            return Shell.shared.focusTile(tile.id)
        }
        let open: (String) -> Void = { [weak self] who in
            guard let self else { return }
            _ = Shell.shared.open(TileURI.luca(project: self.projectId, tool: "chat", id: "new", options: [
                .init(name: "assistant", value: who),
                .init(name: "aboutHelper", value: key),
            ]), focus: true, near: self.tileId, group: true)
        }
        Task { @MainActor [weak self] in
            guard let self else { return }
            do {
                let reply = try await host.assistants()
                let names = reply.assistants.map(\.name).filter { !$0.hasPrefix("guide:") }
                if names.contains(Self.expertAssistant) { return open(Self.expertAssistant) }
                guard !names.isEmpty else { return Shell.shared.flash(reply.notice ?? "This project has no assistants") }
                PaletteController.shared.choose("\(Self.expertAssistant) is not in this project. Talk about \(address.title) with", names.map { name in
                    PaletteChoice(title: name, detail: "") { open(name) }
                })
            } catch {
                Shell.shared.flash(ErrorText.message(error))
            }
        }
    }

    /// This helper and where it comes from, once loaded.
    var takeSource: TakeSource? {
        guard let address, let info else { return nil }
        return TakeSource(project: projectId, registry: address.registry, id: address.id, origin: info.origin)
    }

    override func runCommand(_ verb: String, _ rest: String) -> Bool {
        switch verb {
        case "take": Shell.shared.takeCommand(takeSource, rest)
        case "w", "write": save()
        case "wq", "x":
            save { [weak self] in
                guard let self else { return }
                Shell.shared.close(self.tileId)
            }
        case "e!":
            buffer.takeTheirs()
            loadSource()
        case "replace":
            let parts = rest.components(separatedBy: " => ")
            guard parts.count == 2 else { Shell.shared.flash("Usage: replace <old> => <new>"); return true }
            if buffer.replaceFirst(parts[0], with: parts[1]) { Shell.shared.flash("Replaced. :w saves") }
            else { Shell.shared.flash("Not in the file: \(parts[0])") }
        case "eval":
            guard !rest.isEmpty else { Shell.shared.flash("Usage: eval <code>"); return true }
            runInConsole(rest)
        case "example":
            guard let info else { Shell.shared.flash("Still loading"); return true }
            guard let ex = (info.examples ?? []).first(where: { $0.id == rest || $0.title == rest || $0.member == rest }) else {
                Shell.shared.flash(rest.isEmpty ? "Usage: example <id>" : "No example \(rest)"); return true
            }
            runExample(ex)
        default: return false
        }
        return true
    }

    private func take(_ frame: WorkbenchEvent) {
        switch frame.type {
        case "state":
            if let text = frame.text { stateText = text }
        case "event":
            events.add(name: frame.name ?? "event", text: frame.text ?? "",
                       at: frame.at.map { Date(timeIntervalSince1970: $0 / 1000) } ?? Date())
        default:
            break
        }
    }

    private func load(_ client: WorkbenchClient) {
        guard let address else { return }
        loadTask?.cancel()
        stateLabel = info == nil ? "loading" : "updating"
        loadTask = Task { [weak self] in
            do {
                let info = try await client.helper(registry: address.registry, id: address.id)
                guard let self, !Task.isCancelled else { return }
                self.info = info
                self.stateText = info.stateText
                self.error = nil
                self.title = info.title
                self.refreshLabel()
            } catch {
                guard let self, !Task.isCancelled else { return }
                self.error = ErrorText.message(error)
                self.stateLabel = "error"
            }
        }
    }

    /// `m`: the palette lists the methods, then asks for the arguments.
    func pickMethod() {
        guard let info else { return Shell.shared.flash("Still loading") }
        guard info.callable else { return Shell.shared.flash(info.liveNote ?? "This helper has no instance to call") }
        guard !info.methods.isEmpty else { return Shell.shared.flash("\(info.title) lists no methods") }
        let items = info.methods.map { method in
            PaletteChoice(title: method.signature, detail: method.description) { [weak self] in self?.ask(method) }
        }
        PaletteController.shared.choose("call a method on \(info.title)", items)
    }

    func ask(_ method: WorkbenchHelper.Method) {
        guard method.askArgs else { return call(method, args: "") }
        PaletteController.shared.ask("\(method.signature) · \(method.argsHint)") { [weak self] text in
            self?.call(method, args: text)
        }
    }

    private func call(_ method: WorkbenchHelper.Method, args: String) {
        guard let host, let address else { return Shell.shared.flash("The workbench host is not running") }
        calling = method.name
        Task { [weak self] in
            do {
                let answer = try await host.call(registry: address.registry, id: address.id, method: method.name, args: args)
                guard let self else { return }
                self.calling = nil
                self.lastCall = Self.shown(answer, method: method.name)
                // A call may have made the instance; its state comes with the reload.
                if answer.created == true || self.info?.live == false { self.load(host) }
            } catch {
                guard let self else { return }
                self.calling = nil
                self.lastCall = CallShown(call: method.name, ok: false, text: ErrorText.message(error), detail: "")
            }
        }
    }

    nonisolated static func shown(_ answer: WorkbenchCallResult, method: String) -> CallShown {
        var detail: [String] = []
        if let type = answer.type { detail.append(type) }
        if let ms = answer.ms { detail.append("\(ms) ms") }
        if answer.created == true { detail.append("created the instance") }
        return CallShown(call: answer.call ?? method, ok: answer.ok,
                         text: answer.ok ? (answer.text ?? "") : (answer.error ?? "failed"),
                         detail: detail.joined(separator: " · "))
    }

    override func stop() {
        if buffer.dirty { Shell.shared.flash("Unsaved edits to \(title) are dropped") }
        loadTask?.cancel()
        sourceTask?.cancel()
        frameWatch = nil
        super.stop()
    }
}

/// `features/fs` in a helper address: the registry, then the helper id.
struct HelperAddress: Equatable {
    let registry: String
    let id: String

    init?(_ text: String) {
        guard let slash = text.firstIndex(of: "/") else { return nil }
        registry = String(text[..<slash])
        id = String(text[text.index(after: slash)...])
        guard !registry.isEmpty, !id.isEmpty else { return nil }
    }

    var title: String { "\(registry).\(id)" }
}

/// The events the inspector has seen, newest first, at most `limit`.
struct HelperEventLog: Equatable {
    struct Entry: Equatable, Identifiable {
        let id: Int
        let name: String
        let text: String
        let at: Date
    }

    static let limit = 40
    private(set) var entries: [Entry] = []
    private var next = 0

    mutating func add(name: String, text: String, at: Date) {
        entries.insert(Entry(id: next, name: name, text: text, at: at), at: 0)
        next += 1
        if entries.count > Self.limit { entries.removeLast(entries.count - Self.limit) }
    }

    mutating func clear() { entries = [] }
}

struct HelperView: View {
    @ObservedObject var model: HelperContent
    @ObservedObject var buffer: WorkbenchDocBuffer

    private var p: KitPalette { Theme.palette }
    private var registry: String { model.address?.registry ?? "" }
    /// The registry's color: the title mark, method names, section bars.
    private var tint: Color { WorkbenchStyle.thingColor(registry) }

    private static let clock: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "HH:mm:ss"
        return f
    }()

    var body: some View {
        VStack(spacing: 0) {
            switch model.view {
            case .docs: docs
            case .source: sourcePane
            }
        }
        .background(p.surface.color)
    }

    /// The source view: the file in the editor, under a slim header with the toggle.
    @ViewBuilder private var sourcePane: some View {
        if model.hostStatus != .running {
            WorkbenchHostLine(status: model.hostStatus).padding(KitTokens.Space.s5)
        }
        sourceHeader
        if buffer.conflict != nil { conflictBar }
        if let source = model.source, !source.editable, let why = source.readOnly { noteBar(why) }
        if let error = model.sourceError {
            VStack(alignment: .leading, spacing: KitTokens.Space.s4) {
                Text(error).font(WorkbenchStyle.body).foregroundStyle(p.textMuted.color)
                Button { model.show(.docs) } label: { Text("Back to the docs").underline() }
                    .buttonStyle(.plain).foregroundStyle(p.accent.color).keyBadge("lucaHelper.docs")
            }
            .padding(KitTokens.Space.s7)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        } else if !buffer.isLoaded {
            ProgressView().controlSize(.small).frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
            SourceEditorView(controller: model.sourceController)
        }
    }

    private var sourceHeader: some View {
        HStack(alignment: .firstTextBaseline, spacing: KitTokens.Space.s4) {
            ThingGlyph(symbol: WorkbenchStyle.thingGlyph(registry), color: tint, size: 20)
            Text(model.address?.id ?? "helper")
                .font(WorkbenchStyle.ui(KitTokens.TypeScale.md, weight: .semibold))
                .foregroundStyle(p.text.color)
            Text(registry).font(WorkbenchStyle.ui(KitTokens.TypeScale.sm, weight: .medium)).foregroundStyle(tint)
            if let path = model.source?.doc.pathDisplay {
                Text(path)
                    .font(WorkbenchStyle.code(KitTokens.TypeScale.xs))
                    .foregroundStyle(p.textFaint.color)
                    .lineLimit(1).truncationMode(.head)
                    .textSelection(.enabled)
            }
            Spacer(minLength: KitTokens.Space.s4)
            if buffer.dirty {
                WorkbenchTag(text: model.saving ? "saving" : "modified", color: p.warn.color)
            }
            if let size = model.source?.doc.sizeText {
                Text(size).font(WorkbenchStyle.ui(KitTokens.TypeScale.xs)).foregroundStyle(p.textFaint.color)
            }
            viewToggle
        }
        .padding(.horizontal, KitTokens.Space.s7)
        .padding(.vertical, KitTokens.Space.s4)
        .background(p.surface.color)
        .overlay(alignment: .bottom) { Rectangle().fill(p.border.color).frame(height: 1) }
    }

    /// docs | source, as the doc tile draws its views.
    private var viewToggle: some View {
        HStack(spacing: 2) {
            viewButton("docs", .docs, "lucaHelper.docs")
            viewButton("source", .source, "lucaHelper.source")
        }
        .padding(2)
        .background(RoundedRectangle(cornerRadius: KitTokens.Radius.md).fill(p.inset.color))
    }

    private func viewButton(_ label: String, _ view: HelperContent.HelperTileView, _ action: String) -> some View {
        let on = model.view == view
        return Button { model.show(view) } label: {
            Text(label)
                .font(WorkbenchStyle.ui(KitTokens.TypeScale.xs, weight: on ? .semibold : .regular))
                .foregroundStyle(on ? p.text.color : p.textMuted.color)
                .padding(.horizontal, KitTokens.Space.s4)
                .padding(.vertical, 3)
                .background(RoundedRectangle(cornerRadius: KitTokens.Radius.sm).fill(on ? p.raised.color : Color.clear))
        }
        .buttonStyle(.plain)
        .keyBadge(action)
    }

    private func noteBar(_ text: String) -> some View {
        HStack(spacing: KitTokens.Space.s4) {
            Image(systemName: "lock")
            Text(text).font(WorkbenchStyle.ui(KitTokens.TypeScale.sm))
            Spacer(minLength: 0)
        }
        .foregroundStyle(p.textMuted.color)
        .padding(.horizontal, KitTokens.Space.s7)
        .padding(.vertical, KitTokens.Space.s3)
        .background(p.inset.color)
        .overlay(alignment: .bottom) { Rectangle().fill(p.border.color).frame(height: 1) }
    }

    private var conflictBar: some View {
        HStack(spacing: KitTokens.Space.s4) {
            Image(systemName: "exclamationmark.triangle.fill")
            Text("The file changed on disk while you were editing")
                .font(WorkbenchStyle.ui(KitTokens.TypeScale.sm, weight: .semibold))
            Spacer(minLength: KitTokens.Space.s4)
            Button { _ = model.perform("lucaHelper.keepMine") } label: { Text("keep mine").underline() }
                .buttonStyle(.plain).keyBadge("lucaHelper.keepMine")
            Button { _ = model.perform("lucaHelper.takeTheirs") } label: { Text("take the file").underline() }
                .buttonStyle(.plain).keyBadge("lucaHelper.takeTheirs")
        }
        .font(WorkbenchStyle.ui(KitTokens.TypeScale.sm))
        .foregroundStyle(p.accentOn.color)
        .padding(.horizontal, KitTokens.Space.s7)
        .padding(.vertical, KitTokens.Space.s4)
        .background(p.warn.color)
    }

    private var docs: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: WorkbenchStyle.Gap.section) {
                WorkbenchHostLine(status: model.hostStatus)
                if let error = model.error {
                    WorkbenchCard(tint: p.bad.color) {
                        Text(error).font(WorkbenchStyle.body).foregroundStyle(p.bad.color).lineLimit(3)
                    }
                }
                header
                if let info = model.info {
                    actionsRow(info)
                    callSection
                    stateSection(info)
                    eventsSection
                    methodsSection(info)
                    if !info.getters.isEmpty { fieldsSection("Getters", info.getters) }
                    if !info.optionFields.isEmpty { fieldsSection("Options", info.optionFields) }
                    if !info.stateFields.isEmpty { fieldsSection("State schema", info.stateFields) }
                    WorkbenchSection(title: "Docs", color: p.textFaint.color) {
                        Markdown(info.markdown).tilesMarkdown().textSelection(.enabled)
                    }
                } else if model.hostStatus == .running, model.error == nil {
                    ProgressView().controlSize(.small)
                }
            }
            .padding(.horizontal, WorkbenchStyle.Gap.page)
            .padding(.vertical, WorkbenchStyle.Gap.page - KitTokens.Space.s2)
            .frame(maxWidth: WorkbenchStyle.Size.readable, alignment: .leading)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    /// What the tile can do from here: examples into a console, a chat about it, the source.
    private func actionsRow(_ info: WorkbenchHelper) -> some View {
        HStack(spacing: KitTokens.Space.s4) {
            let examples = info.examples ?? []
            Button { model.pickExample() } label: {
                Label(examples.isEmpty ? "open in console" : "run an example", systemImage: examples.isEmpty ? "terminal" : "play.circle")
            }
            .keyBadge("lucaHelper.example")
            .help(examples.isEmpty ? "No @example blocks: make this helper with its default options in a console beside this tile" : "Pick an @example block; it runs in a console beside this tile")
            Button { model.chatAbout() } label: { Label("ask \(HelperContent.expertAssistant)", systemImage: "bubble.left.and.text.bubble.right") }
                .keyBadge("lucaHelper.chat")
                .help("A chat briefed on this helper, kept beside this tile")
            Button { model.show(.source) } label: { Label("source", systemImage: "chevron.left.forwardslash.chevron.right") }
                .keyBadge("lucaHelper.source")
            if !examples.isEmpty {
                CountPill(count: examples.count, color: tint)
            }
            Spacer(minLength: 0)
        }
        .font(WorkbenchStyle.ui(KitTokens.TypeScale.sm))
        .buttonStyle(.bordered)
        .controlSize(.small)
    }

    private var header: some View {
        HStack(alignment: .top, spacing: WorkbenchStyle.Gap.card) {
            ThingGlyph(symbol: WorkbenchStyle.thingGlyph(registry), color: tint, size: 48)
            VStack(alignment: .leading, spacing: KitTokens.Space.s3) {
                HStack(alignment: .firstTextBaseline, spacing: KitTokens.Space.s4) {
                    Text(model.address?.id ?? model.info?.title ?? "helper")
                        .font(WorkbenchStyle.title)
                        .foregroundStyle(p.text.color)
                        .lineLimit(1)
                    Text(registry)
                        .font(WorkbenchStyle.ui(KitTokens.TypeScale.sm, weight: .medium))
                        .foregroundStyle(tint)
                    Spacer(minLength: 0)
                    if let info = model.info {
                        WorkbenchTag(text: info.live ? "● live" : "no instance", color: info.live ? p.good.color : p.textMuted.color)
                    }
                    viewToggle
                }
                if let summary = model.info?.summary, !summary.isEmpty {
                    Text(summary).font(WorkbenchStyle.body).foregroundStyle(p.textBody.color)
                        .fixedSize(horizontal: false, vertical: true)
                }
                if let origin = model.info?.origin { OriginLine(origin: origin) }
            }
        }
    }

    @ViewBuilder private var callSection: some View {
        if let name = model.calling {
            HStack(spacing: KitTokens.Space.s4) {
                ProgressView().controlSize(.small)
                Text("calling \(name)…").font(WorkbenchStyle.body).foregroundStyle(p.textMuted.color)
            }
        } else if let call = model.lastCall {
            WorkbenchSection(title: "Last call", note: call.detail, color: call.ok ? p.good.color : p.bad.color) {
                WorkbenchCard(tint: call.ok ? p.good.color : p.bad.color) {
                    VStack(alignment: .leading, spacing: KitTokens.Space.s4) {
                        Text(call.call).font(WorkbenchStyle.code(KitTokens.TypeScale.sm, weight: .semibold))
                            .foregroundStyle(call.ok ? tint : p.bad.color)
                            .lineLimit(2)
                        if call.ok {
                            ValueRows(text: call.text)
                        } else {
                            Text(call.text).font(WorkbenchStyle.code()).foregroundStyle(p.bad.color).textSelection(.enabled)
                        }
                    }
                }
            }
        }
    }

    private func stateSection(_ info: WorkbenchHelper) -> some View {
        WorkbenchSection(title: "Live state", color: p.good.color) {
            if let text = model.stateText {
                ValueRows(text: text)
            } else {
                Text(info.liveNote ?? "No instance yet.")
                    .font(WorkbenchStyle.body).foregroundStyle(p.textMuted.color)
            }
        }
    }

    private var eventsSection: some View {
        WorkbenchSection(title: "Events", count: model.events.entries.count, color: p.info.color) {
            if model.events.entries.isEmpty {
                if let names = model.info?.events, !names.isEmpty {
                    HStack(alignment: .firstTextBaseline, spacing: KitTokens.Space.s3) {
                        Text("Waiting for").font(WorkbenchStyle.body).foregroundStyle(p.textMuted.color)
                        ForEach(names.prefix(6), id: \.self) { name in
                            WorkbenchTag(text: name, color: eventColor(name))
                        }
                        if names.count > 6 { Text("…").foregroundStyle(p.textFaint.color) }
                    }
                } else {
                    Text("No events declared. Any it emits show here.")
                        .font(WorkbenchStyle.body).foregroundStyle(p.textMuted.color)
                }
            } else {
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(Array(model.events.entries.enumerated()), id: \.element.id) { index, entry in
                        eventRow(entry, last: index == model.events.entries.count - 1)
                    }
                }
            }
        }
    }

    /// One event on the timeline: a dot on the line, the time, the name in
    /// its own color, and what it carried.
    private func eventRow(_ entry: HelperEventLog.Entry, last: Bool) -> some View {
        let color = eventColor(entry.name)
        return HStack(alignment: .top, spacing: WorkbenchStyle.Gap.row) {
            VStack(spacing: 0) {
                Circle().fill(color).frame(width: 10, height: 10).padding(.top, 7)
                if !last { Rectangle().fill(p.border.color).frame(width: 2).frame(maxHeight: .infinity) }
            }
            .frame(width: 12)
            Text(Self.clock.string(from: entry.at))
                .font(WorkbenchStyle.code(KitTokens.TypeScale.xs))
                .foregroundStyle(p.textFaint.color)
                .padding(.top, 2)
            VStack(alignment: .leading, spacing: KitTokens.Space.s2) {
                Text(entry.name).font(WorkbenchStyle.ui(KitTokens.TypeScale.sm, weight: .semibold)).foregroundStyle(color)
                if !entry.text.isEmpty {
                    Text(entry.text).font(WorkbenchStyle.code(KitTokens.TypeScale.xs)).foregroundStyle(p.textBody.color)
                        .lineLimit(3).textSelection(.enabled)
                }
            }
            .padding(.bottom, WorkbenchStyle.Gap.row)
            Spacer(minLength: 0)
        }
        .fixedSize(horizontal: false, vertical: true)
    }

    /// An event name keeps one color: the slot its name hashes to.
    private func eventColor(_ name: String) -> Color {
        WorkbenchStyle.slotColor(OwnerColors.index(name, slots: 8))
    }

    private func methodsSection(_ info: WorkbenchHelper) -> some View {
        WorkbenchSection(title: "Methods", count: info.methods.count, color: tint) {
            WorkbenchCard(padding: KitTokens.Space.s4) {
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(Array(info.methods.enumerated()), id: \.element.id) { index, method in
                        if index > 0 { Rectangle().fill(p.border.color).frame(height: 1) }
                        Button { model.ask(method) } label: {
                            VStack(alignment: .leading, spacing: KitTokens.Space.s3) {
                                signature(method)
                                    .multilineTextAlignment(.leading)
                                    .fixedSize(horizontal: false, vertical: true)
                                if !method.description.isEmpty {
                                    Text(method.description)
                                        .font(WorkbenchStyle.body)
                                        .foregroundStyle(p.textMuted.color)
                                        .lineLimit(3)
                                        .multilineTextAlignment(.leading)
                                        .fixedSize(horizontal: false, vertical: true)
                                }
                            }
                            .padding(.vertical, WorkbenchStyle.Gap.row)
                            .padding(.horizontal, KitTokens.Space.s2)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .disabled(!info.callable)
                    }
                }
            }
        }
    }

    /// `name(param: type, …) → returns`: the name in the registry's color,
    /// parameter names dim, types in their type colors.
    private func signature(_ method: WorkbenchHelper.Method) -> Text {
        let size = KitTokens.TypeScale.sm
        var text = Text(method.name).font(WorkbenchStyle.code(size, weight: .semibold)).foregroundColor(tint)
        text = text + Text("(").font(WorkbenchStyle.code(size)).foregroundColor(p.textFaint.color)
        for (i, param) in method.params.enumerated() {
            if i > 0 { text = text + Text(", ").font(WorkbenchStyle.code(size)).foregroundColor(p.textFaint.color) }
            let optional = param.required == false ? "?" : ""
            text = text + Text(param.name + optional).font(WorkbenchStyle.code(size)).foregroundColor(p.textMuted.color)
            if !param.type.isEmpty, param.type != "unknown" {
                text = text + Text(": ").font(WorkbenchStyle.code(size)).foregroundColor(p.textFaint.color)
                    + Text(param.type).font(WorkbenchStyle.code(size)).foregroundColor(WorkbenchStyle.typeNameColor(param.type))
            }
        }
        text = text + Text(")").font(WorkbenchStyle.code(size)).foregroundColor(p.textFaint.color)
        if let returns = method.returns, !returns.isEmpty, returns != "unknown" {
            text = text + Text("  →  ").font(WorkbenchStyle.code(size)).foregroundColor(p.textFaint.color)
                + Text(returns).font(WorkbenchStyle.code(size)).foregroundColor(WorkbenchStyle.typeNameColor(returns))
        }
        return text
    }

    private func fieldsSection(_ title: String, _ fields: [WorkbenchField]) -> some View {
        WorkbenchSection(title: title, count: fields.count, color: p.syntax.property.color) {
            WorkbenchCard(padding: KitTokens.Space.s4) {
                Grid(alignment: .leadingFirstTextBaseline, horizontalSpacing: WorkbenchStyle.Gap.card, verticalSpacing: 0) {
                    ForEach(Array(fields.enumerated()), id: \.element.id) { index, field in
                        if index > 0 {
                            Rectangle().fill(p.border.color).frame(height: 1).gridCellColumns(3)
                        }
                        GridRow {
                            HStack(spacing: KitTokens.Space.s2) {
                                Text(field.name).font(WorkbenchStyle.code(KitTokens.TypeScale.sm, weight: .medium))
                                    .foregroundStyle(p.text.color)
                                if field.required == true {
                                    Text("*").font(WorkbenchStyle.code(KitTokens.TypeScale.sm, weight: .bold)).foregroundStyle(p.warn.color)
                                }
                            }
                            Text(field.type.isEmpty ? "any" : field.type)
                                .font(WorkbenchStyle.code(KitTokens.TypeScale.xs, weight: .medium))
                                .foregroundStyle(WorkbenchStyle.typeNameColor(field.type))
                                .lineLimit(1)
                            Text(field.description.isEmpty ? " " : field.description)
                                .font(WorkbenchStyle.body)
                                .foregroundStyle(p.textMuted.color)
                                .fixedSize(horizontal: false, vertical: true)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                        .padding(.vertical, WorkbenchStyle.Gap.row)
                    }
                }
                .padding(.horizontal, KitTokens.Space.s2)
            }
        }
    }
}
