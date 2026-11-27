import SwiftUI
import Combine
import MarkdownUI
import MarkdownEngine

/// The text of one workbench doc: the whole file as the host sent it, cut
/// into frontmatter and body (`DocText`, byte for byte), and the digest of
/// the file it came from. A save sends the whole text with that digest, so
/// the host writes only over the file this buffer loaded. Pure apart from
/// the published fields, so it is tested.
@MainActor
final class WorkbenchDocBuffer: ObservableObject, SourceEditorText {
    @Published private(set) var text = DocText(frontmatter: "", body: "")
    /// The file as last loaded or saved. Nil until the first load.
    @Published private(set) var base: String?
    @Published private(set) var digest: String?
    /// The file on disk moved while this buffer had edits.
    @Published private(set) var conflict: WorkbenchDoc?

    var raw: String { text.joined }
    var body: String { text.body }
    var isLoaded: Bool { base != nil }
    var dirty: Bool { base != nil && raw != base }

    func setRaw(_ next: String) {
        guard next != raw else { return }
        text = DocText(splitting: next)
    }

    func setBody(_ next: String) {
        guard next != text.body else { return }
        text = text.with(body: next)
    }

    /// A read from the host. A clean buffer takes it; a dirty one keeps its
    /// text and shows a conflict when the file moved.
    func take(_ doc: WorkbenchDoc, discard: Bool = false) {
        if base == nil || discard || !dirty {
            text = DocText(splitting: doc.file)
            base = doc.file
            digest = doc.digest
            conflict = nil
            return
        }
        if doc.file == raw {
            base = doc.file; digest = doc.digest; conflict = nil
        } else if doc.digest == digest {
            // Same file: the edit still starts from it.
        } else {
            conflict = doc
        }
    }

    /// The save went through: what was sent is the file now.
    func saved(_ sent: String, digest next: String) {
        base = sent
        digest = next
        conflict = nil
    }

    /// Keep my text; the next save writes over the file on disk.
    func keepMine() {
        guard let c = conflict else { return }
        base = c.file
        digest = c.digest
        conflict = nil
    }

    /// Drop my edits and take the file on disk.
    func takeTheirs() {
        guard let c = conflict else { return }
        take(c, discard: true)
    }

    /// `:replace old => new`: the first `old` in the file becomes `new`.
    /// False when the file has no `old`.
    @discardableResult
    func replaceFirst(_ old: String, with new: String) -> Bool {
        guard !old.isEmpty, let range = raw.range(of: old) else { return false }
        setRaw(raw.replacingCharacters(in: range, with: new))
        return true
    }

    // SourceEditorText
    var editorText: String { raw }
    var editorTextChanges: AnyPublisher<String, Never> { $text.map(\.joined).eraseToAnyPublisher() }
    func editorSetText(_ text: String) { setRaw(text) }
}

/// `luca://<project>/doc/<id>?view=preview|rich|source`: one document of
/// the project's collection, read and saved through the host
/// (`GET /docs/item`, `POST /docs/save`). The frontmatter shows as fields
/// in the model's order and colors; edit it in source. A save writes the
/// whole file as typed, so it stays byte-exact outside the edit.
///
/// `e` rich, `E` source, `P` preview, `i` edit, `Cmd-s` or `:w` saves,
/// `:replace <old> => <new>` edits from the command line.
@MainActor
final class WorkbenchDocContent: WorkbenchContent {
    static let kind = TileKind(id: "luca-doc", label: "Doc", glyph: "doc.richtext") { uri, _ in
        WorkbenchDocContent(uri: uri)
    }

    let docId: String
    let buffer = WorkbenchDocBuffer()
    @Published private(set) var doc: WorkbenchDoc?
    @Published private(set) var view: DocEditorView
    @Published private(set) var error: String?
    @Published private(set) var saving = false
    @Published var richFocused = false
    @Published var showFields = true
    private var loadTask: Task<Void, Never>?
    private var bufferWatch: AnyCancellable?
    private lazy var sourceEditor: SourceEditorController = makeSourceEditor()
    private var hasSourceEditor = false

    init(uri: TileURI) {
        let path = uri.id ?? ""
        docId = path.hasSuffix(".md") ? String(path.dropLast(3)) : path
        view = DocEditorView(rawValue: uri.option("view") ?? "") ?? .preview
        super.init(kindId: Self.kind.id, uri: uri, title: (docId as NSString).lastPathComponent)
        bufferWatch = buffer.objectWillChange
            .receive(on: DispatchQueue.main)
            .sink { [weak self] in self?.refreshLabel() }
    }

    override func makeBody() -> AnyView { AnyView(WorkbenchDocView(model: self, buffer: buffer)) }

    /// Where the last assistant picked for `c` is kept, app wide.
    static let chatAssistantKey = "lucaDoc.chatAssistant"
    /// The most of a document that goes into the first message.
    nonisolated static let chatTextLimit = 24_000

    /// `c`: a chat with an assistant about this document. The palette lists
    /// the project's assistants with the last one picked first, so `Enter`
    /// takes it again; the chat opens beside the tile with the document as
    /// its first message (`?say=`).
    func chatAbout() {
        guard let host else { return Shell.shared.flash("The workbench host is not running") }
        guard let doc, buffer.isLoaded else { return Shell.shared.flash("Still loading the document") }
        let last = UserDefaults.standard.string(forKey: Self.chatAssistantKey)
        let say = Self.chatOpener(path: doc.pathDisplay, text: buffer.raw)
        let open: (String) -> Void = { [weak self] assistant in
            guard let self else { return }
            UserDefaults.standard.set(assistant, forKey: Self.chatAssistantKey)
            let uri = WorkbenchChat.newChat(project: self.projectId, assistant: assistant).with(option: "say", say)
            Shell.shared.open(uri, near: self.tileId)
        }
        Task { @MainActor [weak self] in
            do {
                let reply = try await host.assistants()
                let ordered = Self.chatOrder(reply.assistants.map(\.name), last: last)
                guard !ordered.isEmpty else { return Shell.shared.flash(reply.notice ?? "This project has no assistants") }
                if ordered.count == 1 { return open(ordered[0]) }
                PaletteController.shared.choose("chat about \(self?.title ?? "this document") with", ordered.enumerated().map { index, name in
                    let a = reply.assistants.first { $0.name == name }
                    var detail = [a?.modelText ?? "", a?.description ?? ""].filter { !$0.isEmpty }.joined(separator: " · ")
                    if index == 0, name == last { detail = "last time · " + detail }
                    return PaletteChoice(title: name, detail: detail) { open(name) }
                })
            } catch {
                Shell.shared.flash(ErrorText.message(error))
            }
        }
    }

    /// The assistants with the last one picked first, the rest in the
    /// host's order; a last pick the project no longer has is skipped. Pure.
    nonisolated static func chatOrder(_ names: [String], last: String?) -> [String] {
        guard let last, names.contains(last) else { return names }
        return [last] + names.filter { $0 != last }
    }

    /// The first message: the document, whole up to `chatTextLimit`. Pure.
    nonisolated static func chatOpener(path: String, text: String) -> String {
        var body = text
        var note = ""
        if body.count > chatTextLimit {
            body = String(body.prefix(chatTextLimit))
            note = "\n\n(The document goes on past this point; this is the first \(chatTextLimit) characters.)"
        }
        return "Let's talk about the document `\(path)`. Read it first, then ask what I want to do with it.\n\n```md\n\(body)\n```" + note
    }

    override func hostChanged(_ client: WorkbenchClient?) {
        loadTask?.cancel()
        if client != nil { load() }
    }

    override func stop() {
        if buffer.dirty { Shell.shared.flash("Unsaved edits to \(title) are dropped") }
        super.stop()
    }

    // MARK: Loading and saving

    func load(discard: Bool = false) {
        guard let host else { return }
        if !buffer.isLoaded { stateLabel = "loading" }
        loadTask = Task { [weak self] in
            guard let self else { return }
            do {
                let doc = try await host.doc(self.docId)
                guard !Task.isCancelled else { return }
                self.doc = doc
                self.title = doc.title
                self.error = nil
                self.buffer.take(doc, discard: discard)
            } catch {
                guard !Task.isCancelled else { return }
                self.error = ErrorText.message(error)
            }
            self.refreshLabel()
        }
    }

    /// `p`: run this doc with `luca prompt`. Unsaved edits are saved first: the command reads the file.
    func runPrompt(dryRun: Bool) {
        let go = { [weak self] in
            guard let self else { return }
            PromptRunner.run(project: self.projectId, doc: self.docId, near: self.tileId, dryRun: dryRun)
        }
        if buffer.dirty { save(then: go) } else { go() }
    }

    func save(then done: (() -> Void)? = nil) {
        guard let host, let digest = buffer.digest else { return Shell.shared.flash("Not loaded yet") }
        guard buffer.conflict == nil else { return Shell.shared.flash("The file changed on disk. d p keeps yours, d o takes the file") }
        guard buffer.dirty else { Shell.shared.flash("No changes"); done?(); return }
        guard !saving else { return Shell.shared.flash("Still saving") }
        let sent = buffer.raw
        saving = true
        refreshLabel()
        Task { [weak self] in
            guard let self else { return }
            do {
                let answer = try await host.saveDoc(id: self.docId, text: sent, digest: digest)
                self.saving = false
                if let view = answer.view {
                    self.doc = view
                    self.title = view.title
                    self.buffer.saved(sent, digest: view.digest)
                    // The disk holds what was sent, byte for byte; any typing
                    // during the save stays as an edit.
                }
                Shell.shared.flash(answer.unchanged == true ? "No changes" : (answer.text ?? "Saved \(self.title)"))
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
        else if error != nil, !buffer.isLoaded { stateLabel = "error" }
        else if buffer.isLoaded { stateLabel = view.rawValue }
        else { stateLabel = hostStatus == .running ? "loading" : hostStatus.label }
    }

    // MARK: Views

    func show(_ next: DocEditorView) {
        view = next
        uri = uri.with(option: "view", next.rawValue)
        refreshLabel()
    }

    var sourceController: SourceEditorController {
        hasSourceEditor = true
        return sourceEditor
    }

    private func makeSourceEditor() -> SourceEditorController {
        let editor = SourceEditorController(buffer: buffer, language: "markdown", name: "\(projectId)/\(docId).md",
                                            folder: ProjectHub.shared.localFolder(projectId))
        editor.onSave = { [weak self] in self?.save() }
        editor.onClose = { [weak self] in
            guard let self else { return }
            Shell.shared.close(self.tileId)
        }
        editor.onEscape = { Shell.shared.leaveEditor() }
        editor.onVimChanged = { on in Shell.shared.flash(on ? "vim on" : "vim off") }
        return editor
    }

    override var editorHasKeyboard: Bool { view == .source && hasSourceEditor && sourceEditor.hasFocus }
    override func passesEscape() -> Bool { editorHasKeyboard }
    override func didLeaveInsert() { richFocused = false }

    // MARK: Keys and commands

    override func perform(_ action: String) -> Bool {
        switch action {
        case "doc.save", "lucaDoc.save": save()
        case "lucaDoc.reload": reload()
        case "lucaDoc.edit": edit()
        case "lucaDoc.rich": show(.rich)
        case "lucaDoc.source": show(.source)
        case "lucaDoc.preview": show(.preview)
        case "lucaDoc.fields": showFields.toggle()
        case "lucaDoc.chat": chatAbout()
        case "lucaDoc.prompt": runPrompt(dryRun: false)
        case "lucaDoc.promptDry": runPrompt(dryRun: true)
        case "lucaDoc.docs":
            Shell.shared.focusOrOpenTool(project: projectId, tool: "docs")
        case "lucaDoc.keepMine":
            guard buffer.conflict != nil else { Shell.shared.flash("No conflict"); return true }
            buffer.keepMine()
        case "lucaDoc.takeTheirs":
            guard buffer.conflict != nil else { Shell.shared.flash("No conflict"); return true }
            buffer.takeTheirs()
        case "lucaDoc.restart": restartHost()
        default: return false
        }
        refreshLabel()
        return true
    }

    override func runCommand(_ verb: String, _ rest: String) -> Bool {
        switch verb {
        case "w", "write": save()
        case "wq", "x":
            save { [weak self] in
                guard let self else { return }
                Shell.shared.close(self.tileId)
            }
        case "e!": load(discard: true)
        case "replace":
            let parts = rest.components(separatedBy: " => ")
            guard parts.count == 2 else { Shell.shared.flash("Usage: replace <old> => <new>"); return true }
            if buffer.replaceFirst(parts[0], with: parts[1]) { Shell.shared.flash("Replaced. :w saves") }
            else { Shell.shared.flash("Not in the file: \(parts[0])") }
        default: return false
        }
        return true
    }

    private func reload() {
        if buffer.dirty {
            PaletteController.shared.confirm("Drop your unsaved edits?", yes: "Drop them and reload") { [weak self] in
                self?.load(discard: true)
            }
            return
        }
        load(discard: true)
    }

    private func edit() {
        switch view {
        case .rich: richFocused = true
        case .source:
            sourceController.focus()
            Shell.shared.syncTextMode()
        case .preview:
            Shell.shared.flash("Preview is read only: e for rich, E for source")
        }
    }
}

// MARK: - Views

struct WorkbenchDocView: View {
    @ObservedObject var model: WorkbenchDocContent
    @ObservedObject var buffer: WorkbenchDocBuffer

    private var p: KitPalette { Theme.palette }

    var body: some View {
        VStack(spacing: 0) {
            if model.hostStatus != .running {
                WorkbenchHostLine(status: model.hostStatus).padding(KitTokens.Space.s5)
            }
            if buffer.conflict != nil { conflictBar }
            if let doc = model.doc { header(doc) }
            if let error = model.error, !buffer.isLoaded {
                Text(error)
                    .font(WorkbenchStyle.ui(KitTokens.TypeScale.sm))
                    .foregroundStyle(p.bad.color)
                    .padding(KitTokens.Space.s7)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            } else if !buffer.isLoaded {
                ProgressView().controlSize(.small).frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                switch model.view {
                case .preview:
                    ScrollView {
                        VStack(alignment: .leading, spacing: KitTokens.Space.s6) {
                            if model.showFields, let doc = model.doc, !doc.fields.isEmpty { DocFieldsCard(doc: doc) }
                            Markdown(buffer.body)
                                .tilesMarkdown()
                                .textSelection(.enabled)
                        }
                        .padding(.horizontal, KitTokens.Space.s7)
                        .padding(.vertical, KitTokens.Space.s6)
                        .frame(maxWidth: 820, alignment: .leading)
                        .frame(maxWidth: .infinity, alignment: .center)
                    }
                case .rich:
                    if model.showFields, let doc = model.doc, !doc.fields.isEmpty {
                        DocFieldsCard(doc: doc)
                            .padding(.horizontal, KitTokens.Space.s7)
                            .padding(.top, KitTokens.Space.s5)
                            .frame(maxWidth: 820 + KitTokens.Space.s7 * 2)
                    }
                    WorkbenchRichEditor(buffer: buffer, focused: $model.richFocused, documentId: "luca|\(model.projectId)|\(model.docId)")
                case .source:
                    SourceEditorView(controller: model.sourceController)
                }
            }
        }
        .background(p.surface.color)
    }

    private func header(_ doc: WorkbenchDoc) -> some View {
        let color = WorkbenchStyle.slotColor(doc.slot)
        return HStack(alignment: .firstTextBaseline, spacing: KitTokens.Space.s4) {
            WorkbenchTag(text: doc.model == "Base" ? "no model" : doc.model, color: color)
            Text(doc.pathDisplay)
                .font(WorkbenchStyle.code(KitTokens.TypeScale.xs))
                .foregroundStyle(p.textFaint.color)
                .lineLimit(1).truncationMode(.head)
                .textSelection(.enabled)
            Spacer(minLength: KitTokens.Space.s4)
            if buffer.dirty {
                WorkbenchTag(text: model.saving ? "saving" : "modified", color: p.warn.color)
            }
            Text(doc.sizeText).font(WorkbenchStyle.ui(KitTokens.TypeScale.xs)).foregroundStyle(p.textFaint.color)
            HStack(spacing: 2) {
                viewButton("preview", .preview, "lucaDoc.preview")
                viewButton("rich", .rich, "lucaDoc.rich")
                viewButton("source", .source, "lucaDoc.source")
            }
            .padding(2)
            .background(RoundedRectangle(cornerRadius: KitTokens.Radius.md).fill(p.inset.color))
        }
        .padding(.horizontal, KitTokens.Space.s7)
        .padding(.vertical, KitTokens.Space.s4)
        .background(p.surface.color)
        .overlay(alignment: .bottom) { Rectangle().fill(p.border.color).frame(height: 1) }
    }

    private func viewButton(_ label: String, _ view: DocEditorView, _ action: String) -> some View {
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

    private var conflictBar: some View {
        HStack(spacing: KitTokens.Space.s4) {
            Image(systemName: "exclamationmark.triangle.fill")
            Text("The file changed on disk while you were editing")
                .font(WorkbenchStyle.ui(KitTokens.TypeScale.sm, weight: .semibold))
            Spacer(minLength: KitTokens.Space.s4)
            Button { _ = model.perform("lucaDoc.keepMine") } label: { Text("keep mine").underline() }
                .buttonStyle(.plain).keyBadge("lucaDoc.keepMine")
            Button { _ = model.perform("lucaDoc.takeTheirs") } label: { Text("take the file").underline() }
                .buttonStyle(.plain).keyBadge("lucaDoc.takeTheirs")
        }
        .font(WorkbenchStyle.ui(KitTokens.TypeScale.sm))
        .foregroundStyle(p.accentOn.color)
        .padding(.horizontal, KitTokens.Space.s7)
        .padding(.vertical, KitTokens.Space.s4)
        .background(p.warn.color)
    }
}

/// The frontmatter as fields, in the model's order: the name, its type in
/// the kind's color, and the value (a list as chips). Fields the doc does
/// not set are faint; fields the model does not name are marked.
struct DocFieldsCard: View {
    let doc: WorkbenchDoc

    private var p: KitPalette { Theme.palette }

    var body: some View {
        WorkbenchCard(tint: WorkbenchStyle.slotColor(doc.slot)) {
            VStack(alignment: .leading, spacing: KitTokens.Space.s4) {
                HStack(alignment: .firstTextBaseline, spacing: KitTokens.Space.s4) {
                    Text("Frontmatter")
                        .font(WorkbenchStyle.ui(KitTokens.TypeScale.sm, weight: .semibold))
                        .foregroundStyle(p.text.color)
                    Text("edit it in source (E)")
                        .font(WorkbenchStyle.ui(KitTokens.TypeScale.xs))
                        .foregroundStyle(p.textFaint.color)
                    Spacer(minLength: 0)
                }
                Grid(alignment: .leadingFirstTextBaseline, horizontalSpacing: KitTokens.Space.s5, verticalSpacing: KitTokens.Space.s4) {
                    ForEach(doc.fields) { field in
                        GridRow {
                            Text(field.name)
                                .font(WorkbenchStyle.code(KitTokens.TypeScale.sm, weight: .semibold))
                                .foregroundStyle(field.value == nil ? p.textFaint.color : WorkbenchStyle.keyColor)
                            Text(field.kind == "enum" ? "enum" : field.typeText)
                                .font(WorkbenchStyle.ui(KitTokens.TypeScale.xs, weight: .semibold))
                                .foregroundStyle(WorkbenchStyle.fieldColor(field.kind))
                            value(field)
                                .gridColumnAlignment(.leading)
                        }
                    }
                }
            }
        }
    }

    @ViewBuilder private func value(_ field: WorkbenchDoc.Field) -> some View {
        let color = WorkbenchStyle.fieldColor(field.kind)
        HStack(alignment: .firstTextBaseline, spacing: KitTokens.Space.s3) {
            if !field.items.isEmpty {
                ForEach(Array(field.items.enumerated()), id: \.offset) { _, item in
                    Text(item)
                        .font(WorkbenchStyle.code(KitTokens.TypeScale.xs))
                        .foregroundStyle(color)
                        .padding(.horizontal, KitTokens.Space.s3)
                        .padding(.vertical, 1)
                        .background(Capsule().fill(color.opacity(0.12)))
                }
            } else if let value = field.value {
                Text(value)
                    .font(field.kind == "string" ? WorkbenchStyle.ui(KitTokens.TypeScale.sm) : WorkbenchStyle.code(KitTokens.TypeScale.sm))
                    .foregroundStyle(field.kind == "string" ? p.textBody.color : color)
                    .textSelection(.enabled)
                    .lineLimit(3)
            } else {
                Text(field.required ? "not set (required)" : "not set")
                    .font(WorkbenchStyle.ui(KitTokens.TypeScale.xs))
                    .foregroundStyle(field.required ? p.warn.color : p.textFaint.color)
            }
            if field.extra {
                Text("not in the model")
                    .font(WorkbenchStyle.ui(KitTokens.TypeScale.xs))
                    .foregroundStyle(p.textFaint.color)
            }
        }
    }
}

/// The rich view on a workbench doc: swift-markdown-engine, on the body
/// only. The frontmatter text is kept as is.
struct WorkbenchRichEditor: View {
    @ObservedObject var buffer: WorkbenchDocBuffer
    @Binding var focused: Bool
    let documentId: String

    var body: some View {
        NativeTextViewWrapper(
            text: Binding(get: { buffer.body }, set: { buffer.setBody($0) }),
            configuration: RichEditorTheme.configuration,
            fontName: "SF Pro",
            fontSize: KitTokens.TypeScale.md,
            documentId: documentId,
            isFocused: $focused
        )
        .background(Theme.palette.surface.color)
    }
}
