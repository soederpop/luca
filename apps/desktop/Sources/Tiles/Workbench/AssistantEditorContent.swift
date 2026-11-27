import SwiftUI
import Combine
import MarkdownUI

/// `luca://<project>/assistant/<name>?file=<path>&view=preview|rich|source`:
/// one assistant's folder in an editor. The host draws the folder
/// (`GET /assistant/<name>`): the definition files first (CORE.md, ABOUT.md,
/// tools.ts, hooks.ts, voice.yml, present or not), then every other file,
/// the hooks the runtime fires and which `hooks.ts` exports, and the
/// container features with tools and which the `use` array names.
///
/// A file opens in the shared `WorkbenchDocBuffer`: markdown has preview,
/// rich and source views, anything else is source. A save sends the whole
/// text with the digest (`POST /assistant/<name>/file/save`); the host
/// parse-checks a `.ts` file first and refuses one that does not load, keeps
/// the old file in `.history/`, and reloads every live instance.
///
/// A plugin's assistant is read only here: `C` copies it into the project.
///
/// `i` edit, `e` rich, `E` source, `P` preview, `f` pick a file, `a` new
/// file, `h` add a hook, `t` add or remove a tool provider, `c` chat with
/// lucaExpert about this assistant, `n` chat with the assistant itself,
/// `b` the sidebar, `r` reload, `d p` / `d o` settle a conflict, `u` the
/// assistants, `R` restart the host. `:w`, `:wq`, `:e!`,
/// `:replace <old> => <new>`, `:file <path>`, `:hook <name>`,
/// `:use <feature> [tool,tool]`, `:unuse <feature>`.
@MainActor
final class AssistantEditorContent: WorkbenchContent {
    static let kind = TileKind(id: "luca-assistant", label: "Assistant", glyph: "person.text.rectangle") { uri, _ in
        AssistantEditorContent(uri: uri)
    }

    /// The tile for an assistant, at its CORE.md. Pure, so it is tested.
    nonisolated static func address(project: String, assistant: String, file: String? = nil) -> TileURI {
        TileURI.luca(project: project, tool: "assistant", id: assistant, options: file.map { [.init(name: "file", value: $0)] } ?? [])
    }

    /// Who `c` talks to about an assistant.
    static let builderAssistant = WorkbenchChatContent.supportAssistant

    let assistant: String
    let buffer = WorkbenchDocBuffer()
    @Published private(set) var editor: WorkbenchAssistantEditor?
    @Published private(set) var file: String
    @Published private(set) var doc: WorkbenchDoc?
    @Published private(set) var view: DocEditorView
    @Published private(set) var error: String?
    /// The host refused the last save because the file does not load; the text is still here.
    @Published private(set) var parseError: String?
    @Published private(set) var saving = false
    @Published var richFocused = false
    @Published var showSidebar = true
    private var frameWatch: AnyCancellable?
    private var bufferWatch: AnyCancellable?
    private var loadTask: Task<Void, Never>?
    /// One per language: the page takes its language when it loads, so a
    /// `.ts` file after a `.md` one gets a new editor.
    private var sourceEditor: SourceEditorController?
    private var sourceLanguage = ""

    init(uri: TileURI) {
        assistant = uri.id ?? ""
        file = uri.option("file") ?? "CORE.md"
        view = DocEditorView(rawValue: uri.option("view") ?? "") ?? .rich
        super.init(kindId: Self.kind.id, uri: uri, title: "\(uri.id ?? "assistant") · editor")
        bufferWatch = buffer.objectWillChange
            .receive(on: DispatchQueue.main)
            .sink { [weak self] in self?.refreshLabel() }
    }

    override func makeBody() -> AnyView { AnyView(AssistantEditorView(model: self, buffer: buffer)) }

    override func hostChanged(_ client: WorkbenchClient?) {
        loadTask?.cancel()
        frameWatch = nil
        guard let client else { return }
        client.connect()
        // A save here, a chat's write, or a copy: the folder changed.
        frameWatch = client.events
            .filter { [weak self] in $0.type == "assistant-changed" && $0.name == self?.assistant }
            .debounce(for: .milliseconds(300), scheduler: DispatchQueue.main)
            .sink { [weak self] _ in self?.reloadQuietly() }
        load()
    }

    override func stop() {
        if buffer.dirty { Shell.shared.flash("Unsaved edits to \(title) are dropped") }
        loadTask?.cancel()
        frameWatch = nil
        super.stop()
    }

    // MARK: Loading and saving

    /// The folder, then the open file. `discard` drops edits.
    func load(discard: Bool = false) {
        guard let host else { return }
        loadTask?.cancel()
        if editor == nil { stateLabel = "loading" }
        loadTask = Task { [weak self] in
            guard let self else { return }
            do {
                let view = try await host.assistantEditor(self.assistant)
                guard !Task.isCancelled else { return }
                self.editor = view
                self.title = "\(view.name) · editor"
                self.error = nil
                if view.folder.isEmpty {
                    self.doc = nil
                    self.refreshLabel()
                    return
                }
                let doc = try await host.assistantFile(self.assistant, path: self.file)
                guard !Task.isCancelled else { return }
                self.doc = doc
                self.buffer.take(doc, discard: discard)
                if !self.isMarkdown, self.view != .source { self.view = .source }
            } catch {
                guard !Task.isCancelled else { return }
                self.error = ErrorText.message(error)
            }
            self.refreshLabel()
        }
    }

    /// The folder again (a chat wrote a file); the open file too unless it has edits.
    private func reloadQuietly() {
        guard let host else { return }
        Task { [weak self] in
            guard let self else { return }
            if let view = try? await host.assistantEditor(self.assistant) { self.editor = view }
            if !self.buffer.dirty, let doc = try? await host.assistantFile(self.assistant, path: self.file) {
                self.doc = doc
                self.buffer.take(doc)
            }
            self.refreshLabel()
        }
    }

    var isMarkdown: Bool { SourceEditorController.language(for: file) == "markdown" }
    var isEditable: Bool { editor?.editable ?? false }
    var currentFile: WorkbenchAssistantEditor.File? { editor?.files.first { $0.path == file } }

    /// Open another file of the folder. Edits to the current one must be saved or dropped first.
    func open(file next: String, then: (() -> Void)? = nil) {
        let path = next.trimmingCharacters(in: .whitespaces)
        guard !path.isEmpty else { return }
        guard path != file else { then?(); return }
        if buffer.dirty {
            PaletteController.shared.confirm("\(file) has unsaved edits. Drop them and open \(path)?", yes: "Drop them") { [weak self] in
                self?.switchTo(path, then: then)
            }
            return
        }
        switchTo(path, then: then)
    }

    private func switchTo(_ path: String, then: (() -> Void)?) {
        guard let host else { return }
        file = path
        uri = uri.with(option: "file", path)
        parseError = nil
        if !isMarkdown { show(.source) } else if view == .source, let current = currentFile, current.isMarkdown { show(.rich) }
        Shell.shared.scheduleSave()
        loadTask?.cancel()
        stateLabel = "loading"
        loadTask = Task { [weak self] in
            guard let self else { return }
            do {
                let doc = try await host.assistantFile(self.assistant, path: path)
                guard !Task.isCancelled else { return }
                self.doc = doc
                self.error = nil
                self.buffer.take(doc, discard: true)
                then?()
            } catch {
                guard !Task.isCancelled else { return }
                self.error = ErrorText.message(error)
            }
            self.refreshLabel()
        }
    }

    func save(then done: (() -> Void)? = nil) {
        guard let host, let digest = buffer.digest else { return Shell.shared.flash("Not loaded yet") }
        guard isEditable else { return Shell.shared.flash(editor?.readOnly ?? "This assistant is read only") }
        guard buffer.conflict == nil else { return Shell.shared.flash("The file changed on disk. d p keeps yours, d o takes the file") }
        guard buffer.dirty else { Shell.shared.flash("No changes"); done?(); return }
        guard !saving else { return Shell.shared.flash("Still saving") }
        let sent = buffer.raw
        saving = true
        refreshLabel()
        Task { [weak self] in
            guard let self else { return }
            do {
                let answer = try await host.saveAssistantFile(self.assistant, path: self.file, text: sent, digest: digest)
                self.saving = false
                self.parseError = nil
                if let view = answer.view {
                    self.doc = view
                    self.buffer.saved(sent, digest: view.digest)
                }
                Shell.shared.flash(answer.unchanged == true ? "No changes" : (answer.text ?? "Saved \(self.file)"))
                done?()
            } catch let refused as WorkbenchAssistantParseError {
                self.saving = false
                self.parseError = refused.message
                Shell.shared.flash("Not saved: the file does not load")
            } catch let refused as WorkbenchAssistantReadOnly {
                self.saving = false
                Shell.shared.flash(refused.message)
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
        else if parseError != nil { stateLabel = "does not load" }
        else if saving { stateLabel = "saving" }
        else if buffer.dirty { stateLabel = "modified" }
        else if error != nil, !buffer.isLoaded { stateLabel = "error" }
        else if let editor, !editor.editable { stateLabel = "read only" }
        else if buffer.isLoaded { stateLabel = file }
        else { stateLabel = hostStatus == .running ? "loading" : hostStatus.label }
    }

    // MARK: Edits the host writes into the buffer

    /// `h`, `:hook <name>`: a stub for a hook in hooks.ts. The host answers
    /// the text; the human saves it.
    func addHook(_ name: String? = nil) {
        guard let editor else { return Shell.shared.flash("Still loading") }
        guard editor.editable else { return Shell.shared.flash(editor.readOnly ?? "This assistant is read only") }
        guard let name, !name.isEmpty else {
            let missing = editor.hooks.filter { !$0.present }
            guard !missing.isEmpty else { return Shell.shared.flash("hooks.ts defines every hook already") }
            return PaletteController.shared.choose("add a hook to hooks.ts", missing.map { hook in
                PaletteChoice(title: hook.name, detail: "\(hook.kind) · \(hook.description)") { [weak self] in self?.addHook(hook.name) }
            })
        }
        if let present = editor.hooks.first(where: { $0.name == name && $0.present }) {
            return open(file: "hooks.ts") { Shell.shared.flash("\(name) is on line \(present.line ?? 0) of hooks.ts") }
        }
        open(file: "hooks.ts") { [weak self] in
            self?.apply(op: "hook", hook: name, done: "Added \(name) to hooks.ts; :w saves it")
        }
    }

    /// `t`, `:use <feature> [tools]`, `:unuse <feature>`: a feature's tools in
    /// the `use` array of tools.ts.
    func useFeature(_ feature: String? = nil, only: [String]? = nil, remove: Bool = false) {
        guard let editor else { return Shell.shared.flash("Still loading") }
        guard editor.editable else { return Shell.shared.flash(editor.readOnly ?? "This assistant is read only") }
        guard let feature, !feature.isEmpty else {
            let providers = editor.providers.sorted { ($0.used ? 0 : 1, $0.name) < ($1.used ? 0 : 1, $1.name) }
            guard !providers.isEmpty else { return Shell.shared.flash("No container feature has tools") }
            return PaletteController.shared.choose("tool providers · Enter adds one, or takes a used one out", providers.map { p in
                let tools = p.tools.map(\.name).joined(separator: ", ")
                let detail = (p.used ? "used · " : "") + [p.description, tools].filter { !$0.isEmpty }.joined(separator: " · ")
                return PaletteChoice(title: (p.used ? "☑ " : "☐ ") + p.name, detail: detail) { [weak self] in
                    self?.useFeature(p.name, remove: p.used)
                }
            })
        }
        open(file: "tools.ts") { [weak self] in
            self?.apply(op: "use", feature: feature, only: only, remove: remove,
                        done: remove ? "Took \(feature) out of the use array; :w saves it" : "Added \(feature) to the use array; :w saves it")
        }
    }

    private func apply(op: String, hook: String? = nil, feature: String? = nil, only: [String]? = nil, remove: Bool = false, done: String) {
        guard let host, buffer.isLoaded else { return Shell.shared.flash("Still loading") }
        Task { [weak self] in
            guard let self else { return }
            do {
                let answer = try await host.editAssistantText(self.assistant, op: op, text: self.buffer.raw, hook: hook, feature: feature, only: only, remove: remove)
                guard let text = answer.text, answer.ok == true else { return Shell.shared.flash(answer.error ?? "The host made no edit") }
                if text == self.buffer.raw { return Shell.shared.flash("Nothing to change") }
                self.buffer.setRaw(text)
                self.show(.source)
                Shell.shared.flash(done)
            } catch {
                Shell.shared.flash(ErrorText.message(error))
            }
        }
    }

    /// `a`, `:new <path>`: a file that is not there yet opens empty; the first save makes it.
    func newFile(_ path: String? = nil) {
        guard let editor else { return Shell.shared.flash("Still loading") }
        guard editor.editable else { return Shell.shared.flash(editor.readOnly ?? "This assistant is read only") }
        guard let path, !path.isEmpty else {
            return PaletteController.shared.ask("new file in \(assistant)/ (a path, like notes/plan.md)") { [weak self] in self?.newFile($0) }
        }
        open(file: path) { Shell.shared.flash("\(path) is new: :w makes it") }
    }

    /// `f`, `:file`: pick a file of the folder.
    func pickFile() {
        guard let editor else { return Shell.shared.flash("Still loading") }
        var rows = editor.files.map { f in
            PaletteChoice(title: (f.present ? "" : "+ ") + f.path, detail: f.present ? "\(f.kind) · \(f.sizeText)" : "not there yet: the first save makes it") { [weak self] in
                self?.open(file: f.path)
            }
        }
        if editor.editable {
            rows.append(PaletteChoice(title: "New file…", detail: "a path in the folder") { [weak self] in self?.newFile() })
        }
        PaletteController.shared.choose("files of \(assistant)", rows)
    }

    /// `C`: a plugin's assistant becomes the project's own, and the editor opens the copy.
    func copyIn() {
        guard let host, let editor else { return Shell.shared.flash("Still loading") }
        guard !editor.editable, editor.source != "registered" else { return Shell.shared.flash(editor.editable ? "\(assistant) is editable already" : "There is no folder to copy") }
        PaletteController.shared.confirm("Copy \(assistant) from \(editor.folderDisplay) into this project's assistants/? The copy wins the name.", yes: "Copy it") { [weak self] in
            guard let self else { return }
            Task { @MainActor in
                do {
                    let answer = try await host.copyAssistant(self.assistant)
                    Shell.shared.flash(answer.text ?? "Copied")
                    self.load(discard: true)
                } catch {
                    Shell.shared.flash(ErrorText.message(error))
                }
            }
        }
    }

    /// `c`: lucaExpert beside this tile, briefed on this assistant and given
    /// the tools to change its files. One per assistant: a second `c`
    /// focuses it. Without lucaExpert in the project, the palette asks who.
    func chatAbout() {
        guard let host else { return Shell.shared.flash("The workbench host is not running") }
        if let tile = Shell.shared.tiles.values.first(where: {
            $0.content.kindId == WorkbenchChatContent.kind.id && $0.uri.authority == projectId && $0.uri.option("about") == assistant
        }) {
            return Shell.shared.focusTile(tile.id)
        }
        let open: (String) -> Void = { [weak self] who in
            guard let self else { return }
            _ = Shell.shared.open(TileURI.luca(project: self.projectId, tool: "chat", id: "new", options: [
                .init(name: "assistant", value: who),
                .init(name: "about", value: self.assistant),
            ]), focus: true, near: self.tileId, group: true)
        }
        Task { @MainActor [weak self] in
            guard let self else { return }
            do {
                let reply = try await host.assistants()
                let names = reply.assistants.map(\.name).filter { !$0.hasPrefix("guide:") }
                if names.contains(Self.builderAssistant) { return open(Self.builderAssistant) }
                guard !names.isEmpty else { return Shell.shared.flash(reply.notice ?? "This project has no assistants") }
                PaletteController.shared.choose("\(Self.builderAssistant) is not in this project. Build \(self.assistant) with", names.map { name in
                    PaletteChoice(title: name, detail: name == self.assistant ? "itself" : "") { open(name) }
                })
            } catch {
                Shell.shared.flash(ErrorText.message(error))
            }
        }
    }

    // MARK: Views

    func show(_ next: DocEditorView) {
        if next != .source, !isMarkdown { return Shell.shared.flash("\(file) is source only") }
        view = next
        uri = uri.with(option: "view", next.rawValue)
        refreshLabel()
    }

    var sourceController: SourceEditorController {
        let language = SourceEditorController.language(for: file)
        if let sourceEditor, sourceLanguage == language { return sourceEditor }
        let editor = makeSourceEditor(language)
        sourceEditor = editor
        sourceLanguage = language
        return editor
    }

    private func makeSourceEditor(_ language: String) -> SourceEditorController {
        let editor = SourceEditorController(buffer: buffer, language: language)
        editor.onSave = { [weak self] in self?.save() }
        editor.onClose = { [weak self] in
            guard let self else { return }
            Shell.shared.close(self.tileId)
        }
        editor.onEscape = { Shell.shared.leaveEditor() }
        editor.onVimChanged = { on in Shell.shared.flash(on ? "vim on" : "vim off") }
        return editor
    }

    override var editorHasKeyboard: Bool { view == .source && (sourceEditor?.hasFocus ?? false) }
    override func passesEscape() -> Bool { editorHasKeyboard }
    override func didLeaveInsert() { richFocused = false }

    // MARK: Keys and commands

    override func perform(_ action: String) -> Bool {
        switch action {
        case "doc.save", "lucaAssistant.save": save()
        case "lucaAssistant.reload": reload()
        case "lucaAssistant.edit": edit()
        case "lucaAssistant.rich": show(.rich)
        case "lucaAssistant.source": show(.source)
        case "lucaAssistant.preview": show(.preview)
        case "lucaAssistant.sidebar": showSidebar.toggle()
        case "lucaAssistant.file": pickFile()
        case "lucaAssistant.newFile": newFile()
        case "lucaAssistant.hook": addHook()
        case "lucaAssistant.tools": useFeature()
        case "lucaAssistant.chat": chatAbout()
        case "lucaAssistant.talk":
            Shell.shared.open(WorkbenchChat.newChat(project: projectId, assistant: assistant), near: tileId)
        case "lucaAssistant.copy": copyIn()
        case "lucaAssistant.assistants":
            Shell.shared.focusOrOpenTool(project: projectId, tool: "assistants")
        case "lucaAssistant.keepMine":
            guard buffer.conflict != nil else { Shell.shared.flash("No conflict"); return true }
            buffer.keepMine()
        case "lucaAssistant.takeTheirs":
            guard buffer.conflict != nil else { Shell.shared.flash("No conflict"); return true }
            buffer.takeTheirs()
        case "lucaAssistant.restart": restartHost()
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
        case "file": rest.isEmpty ? pickFile() : open(file: rest)
        case "new": newFile(rest.isEmpty ? nil : rest)
        case "hook": addHook(rest.isEmpty ? nil : rest)
        case "use":
            let words = rest.split(separator: " ", maxSplits: 1).map(String.init)
            guard let feature = words.first else { useFeature(); return true }
            let only = words.count > 1 ? words[1].split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty } : nil
            useFeature(feature, only: only)
        case "unuse":
            guard !rest.isEmpty else { Shell.shared.flash("Usage: unuse <feature>"); return true }
            useFeature(rest, remove: true)
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
        guard isEditable else { return Shell.shared.flash(editor?.readOnly ?? "This assistant is read only. C copies it into the project") }
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

struct AssistantEditorView: View {
    @ObservedObject var model: AssistantEditorContent
    @ObservedObject var buffer: WorkbenchDocBuffer

    private var p: KitPalette { Theme.palette }
    private var color: Color { WorkbenchStyle.thingColor("assistants") }

    var body: some View {
        VStack(spacing: 0) {
            if model.hostStatus != .running {
                WorkbenchHostLine(status: model.hostStatus).padding(KitTokens.Space.s5)
            }
            if let editor = model.editor { header(editor) }
            if buffer.conflict != nil { conflictBar }
            if let parseError = model.parseError { refusedBar(parseError) }
            if let editor = model.editor, let readOnly = editor.readOnly { readOnlyBar(readOnly, editor: editor) }
            HStack(spacing: 0) {
                if model.showSidebar, let editor = model.editor {
                    AssistantSidebar(model: model, editor: editor)
                        .frame(width: 250)
                    Rectangle().fill(p.border.color).frame(width: 1)
                }
                content
            }
        }
        .background(p.surface.color)
    }

    @ViewBuilder private var content: some View {
        if let error = model.error, !buffer.isLoaded {
            Text(error)
                .font(WorkbenchStyle.body)
                .foregroundStyle(p.bad.color)
                .textSelection(.enabled)
                .padding(KitTokens.Space.s7)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        } else if let editor = model.editor, editor.folder.isEmpty {
            Text(editor.readOnly ?? "There is no folder to edit.")
                .font(WorkbenchStyle.body)
                .foregroundStyle(p.textMuted.color)
                .padding(KitTokens.Space.s7)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        } else if !buffer.isLoaded {
            ProgressView().controlSize(.small).frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
            VStack(spacing: 0) {
                fileLine
                switch model.view {
                case .preview:
                    ScrollView {
                        VStack(alignment: .leading, spacing: KitTokens.Space.s6) {
                            if !buffer.text.frontmatter.isEmpty { frontmatterCard }
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
                    if !buffer.text.frontmatter.isEmpty {
                        frontmatterCard
                            .padding(.horizontal, KitTokens.Space.s7)
                            .padding(.top, KitTokens.Space.s5)
                            .frame(maxWidth: 820 + KitTokens.Space.s7 * 2)
                    }
                    WorkbenchRichEditor(buffer: buffer, focused: $model.richFocused, documentId: "luca|\(model.projectId)|assistant|\(model.assistant)|\(model.file)")
                case .source:
                    SourceEditorView(controller: model.sourceController)
                }
            }
        }
    }

    /// The frontmatter of CORE.md as it is: the model, provider, skills and
    /// config an assistant declares. Edit it in source.
    private var frontmatterCard: some View {
        WorkbenchCard(tint: color) {
            VStack(alignment: .leading, spacing: KitTokens.Space.s3) {
                HStack(alignment: .firstTextBaseline, spacing: KitTokens.Space.s4) {
                    Text("Frontmatter").font(WorkbenchStyle.ui(KitTokens.TypeScale.sm, weight: .semibold)).foregroundStyle(p.text.color)
                    Text("model, provider, skills, config · edit it in source (E)").font(WorkbenchStyle.meta).foregroundStyle(p.textFaint.color)
                }
                Text(buffer.text.frontmatter.replacingOccurrences(of: "\r", with: "").trimmingCharacters(in: .whitespacesAndNewlines))
                    .font(WorkbenchStyle.code(KitTokens.TypeScale.xs))
                    .foregroundStyle(p.textBody.color)
                    .textSelection(.enabled)
            }
        }
    }

    private func header(_ editor: WorkbenchAssistantEditor) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: KitTokens.Space.s4) {
            Text(editor.name)
                .font(WorkbenchStyle.ui(KitTokens.TypeScale.md, weight: .semibold))
                .foregroundStyle(color)
            WorkbenchTag(text: sourceLabel(editor.source), color: editor.editable ? WorkbenchStyle.declaredColor(editor.source == "home" ? "home" : "own") : WorkbenchStyle.declaredColor("plugin"))
            Text(editor.modelText)
                .font(WorkbenchStyle.code(KitTokens.TypeScale.xs))
                .foregroundStyle(p.textMuted.color)
                .lineLimit(1)
            Text("\(editor.tools.count) tool\(editor.tools.count == 1 ? "" : "s")")
                .font(WorkbenchStyle.meta)
                .foregroundStyle(p.textFaint.color)
            Spacer(minLength: KitTokens.Space.s4)
            Text(editor.folderDisplay)
                .font(WorkbenchStyle.code(KitTokens.TypeScale.xs))
                .foregroundStyle(p.textFaint.color)
                .lineLimit(1).truncationMode(.head)
                .textSelection(.enabled)
            Button { _ = model.perform("lucaAssistant.chat") } label: {
                Text("build with \(AssistantEditorContent.builderAssistant)").font(WorkbenchStyle.meta).foregroundStyle(p.info.color)
            }
            .buttonStyle(.plain)
            .keyBadge("lucaAssistant.chat")
        }
        .padding(.horizontal, KitTokens.Space.s7)
        .padding(.vertical, KitTokens.Space.s4)
        .background(p.surface.color)
        .overlay(alignment: .bottom) { Rectangle().fill(p.border.color).frame(height: 1) }
    }

    private func sourceLabel(_ source: String) -> String {
        switch source {
        case "project": return "project"
        case "home": return "home · ~/.luca"
        case "extra": return "plugin · read only"
        default: return source
        }
    }

    private var fileLine: some View {
        HStack(alignment: .firstTextBaseline, spacing: KitTokens.Space.s4) {
            WorkbenchTag(text: SourceEditorController.language(for: model.file), color: Theme.ownerColor(model.owner))
            Text(model.file)
                .font(WorkbenchStyle.code(KitTokens.TypeScale.xs))
                .foregroundStyle(p.textMuted.color)
                .lineLimit(1).truncationMode(.head)
                .textSelection(.enabled)
            if model.currentFile?.present == false {
                WorkbenchTag(text: "new file", color: p.info.color)
            }
            Spacer(minLength: KitTokens.Space.s4)
            if buffer.dirty {
                WorkbenchTag(text: model.saving ? "saving" : "modified", color: p.warn.color)
            }
            if let size = model.doc?.sizeText, model.currentFile?.present != false {
                Text(size).font(WorkbenchStyle.meta).foregroundStyle(p.textFaint.color)
            }
            if model.isMarkdown {
                HStack(spacing: 2) {
                    viewButton("preview", .preview, "lucaAssistant.preview")
                    viewButton("rich", .rich, "lucaAssistant.rich")
                    viewButton("source", .source, "lucaAssistant.source")
                }
                .padding(2)
                .background(RoundedRectangle(cornerRadius: KitTokens.Radius.md).fill(p.inset.color))
            } else {
                Text("edit").font(WorkbenchStyle.meta).foregroundStyle(p.textMuted.color)
                    .keyBadge("lucaAssistant.edit", leading: true)
            }
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
            Button { _ = model.perform("lucaAssistant.keepMine") } label: { Text("keep mine").underline() }
                .buttonStyle(.plain).keyBadge("lucaAssistant.keepMine")
            Button { _ = model.perform("lucaAssistant.takeTheirs") } label: { Text("take the file").underline() }
                .buttonStyle(.plain).keyBadge("lucaAssistant.takeTheirs")
        }
        .font(WorkbenchStyle.ui(KitTokens.TypeScale.sm))
        .foregroundStyle(p.accentOn.color)
        .padding(.horizontal, KitTokens.Space.s7)
        .padding(.vertical, KitTokens.Space.s4)
        .background(p.warn.color)
    }

    /// The host would not take the file: it does not load. The text is still here to fix.
    private func refusedBar(_ message: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: KitTokens.Space.s4) {
            Image(systemName: "xmark.octagon.fill")
            Text(message)
                .font(WorkbenchStyle.ui(KitTokens.TypeScale.sm))
                .textSelection(.enabled)
                .lineLimit(4)
            Spacer(minLength: KitTokens.Space.s4)
        }
        .foregroundStyle(p.accentOn.color)
        .padding(.horizontal, KitTokens.Space.s7)
        .padding(.vertical, KitTokens.Space.s4)
        .background(p.bad.color)
    }

    private func readOnlyBar(_ message: String, editor: WorkbenchAssistantEditor) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: KitTokens.Space.s4) {
            Image(systemName: "lock.fill")
            Text(message)
                .font(WorkbenchStyle.ui(KitTokens.TypeScale.sm))
                .lineLimit(3)
            Spacer(minLength: KitTokens.Space.s4)
            if editor.source == "extra" {
                Button { model.copyIn() } label: { Text("copy into this project").underline() }
                    .buttonStyle(.plain).keyBadge("lucaAssistant.copy")
            }
        }
        .foregroundStyle(p.text.color)
        .padding(.horizontal, KitTokens.Space.s7)
        .padding(.vertical, KitTokens.Space.s4)
        .background(p.inset.color)
        .overlay(alignment: .bottom) { Rectangle().fill(p.border.color).frame(height: 1) }
    }
}

/// The folder at a glance: its files, the hooks and the tool providers, each
/// row a button. A missing file or hook is faint and `+` adds it.
struct AssistantSidebar: View {
    @ObservedObject var model: AssistantEditorContent
    let editor: WorkbenchAssistantEditor

    private var p: KitPalette { Theme.palette }
    private var color: Color { WorkbenchStyle.thingColor("assistants") }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: WorkbenchStyle.Gap.section) {
                if !editor.description.isEmpty {
                    Text(editor.description)
                        .font(WorkbenchStyle.body)
                        .foregroundStyle(p.textMuted.color)
                        .lineLimit(4)
                }
                if let error = editor.error {
                    Text(error).font(WorkbenchStyle.meta).foregroundStyle(p.bad.color).lineLimit(4)
                }
                files
                hooks
                providers
                if !editor.shadows.isEmpty {
                    WorkbenchSection(title: "Hides", note: "same name, lower priority", color: p.textFaint.color) {
                        ForEach(editor.shadows, id: \.self) { folder in
                            Text(folder).font(WorkbenchStyle.code(KitTokens.TypeScale.xs)).foregroundStyle(p.textFaint.color).lineLimit(1).truncationMode(.head)
                        }
                    }
                }
            }
            .padding(KitTokens.Space.s6)
        }
        .background(p.surface.color)
    }

    private var files: some View {
        let definition = editor.files.filter { $0.kind == "definition" }
        let others = editor.files.filter { $0.kind != "definition" }
        return WorkbenchSection(title: "Files", count: editor.files.filter(\.present).count, color: color) {
            VStack(alignment: .leading, spacing: KitTokens.Space.s2) {
                ForEach(definition) { fileRow($0) }
                if !others.isEmpty {
                    Rectangle().fill(p.border.color).frame(height: 1).padding(.vertical, KitTokens.Space.s2)
                    ForEach(others) { fileRow($0) }
                }
                if editor.editable {
                    Button { model.newFile() } label: {
                        HStack(spacing: KitTokens.Space.s3) {
                            Image(systemName: "plus").font(.system(size: 10, weight: .semibold))
                            Text("new file").font(WorkbenchStyle.meta)
                        }
                        .foregroundStyle(p.textFaint.color)
                    }
                    .buttonStyle(.plain)
                    .keyBadge("lucaAssistant.newFile")
                    .padding(.top, KitTokens.Space.s2)
                }
            }
        }
    }

    private func fileRow(_ f: WorkbenchAssistantEditor.File) -> some View {
        let on = f.path == model.file
        return Button { model.open(file: f.path) } label: {
            HStack(alignment: .firstTextBaseline, spacing: KitTokens.Space.s3) {
                Text(f.present ? f.path : "+ \(f.path)")
                    .font(WorkbenchStyle.code(KitTokens.TypeScale.xs, weight: on ? .semibold : .regular))
                    .foregroundStyle(f.present ? (on ? p.text.color : p.textBody.color) : p.textFaint.color)
                    .lineLimit(1).truncationMode(.middle)
                Spacer(minLength: 0)
                if f.present {
                    Text(f.sizeText).font(WorkbenchStyle.meta).foregroundStyle(p.textFaint.color)
                }
            }
            .padding(.horizontal, KitTokens.Space.s3)
            .padding(.vertical, 3)
            .background(RoundedRectangle(cornerRadius: KitTokens.Radius.sm).fill(on ? p.raised.color : Color.clear))
        }
        .buttonStyle(.plain)
    }

    private var hooks: some View {
        let present = editor.hooks.filter(\.present)
        return WorkbenchSection(title: "Hooks", note: "hooks.ts exports", count: present.count, color: WorkbenchStyle.thingColor("commands")) {
            VStack(alignment: .leading, spacing: KitTokens.Space.s2) {
                ForEach(editor.hooks) { hook in
                    Button { model.addHook(hook.name) } label: {
                        HStack(alignment: .firstTextBaseline, spacing: KitTokens.Space.s3) {
                            Image(systemName: hook.present ? "checkmark.square.fill" : "square")
                                .font(.system(size: 11))
                                .foregroundStyle(hook.present ? WorkbenchStyle.thingColor("commands") : p.textFaint.color)
                            Text(hook.name)
                                .font(WorkbenchStyle.code(KitTokens.TypeScale.xs, weight: hook.present ? .semibold : .regular))
                                .foregroundStyle(hook.present ? p.text.color : p.textMuted.color)
                            Spacer(minLength: 0)
                            Text(hook.kind).font(WorkbenchStyle.meta).foregroundStyle(p.textFaint.color)
                        }
                    }
                    .buttonStyle(.plain)
                    .help(hook.description)
                }
                Text("Enter on one adds a stub, or opens the one that is there")
                    .font(WorkbenchStyle.meta).foregroundStyle(p.textFaint.color)
                    .keyBadge("lucaAssistant.hook", leading: true)
                    .padding(.top, KitTokens.Space.s2)
            }
        }
    }

    private var providers: some View {
        let used = editor.providers.filter(\.used)
        let rest = editor.providers.filter { !$0.used }
        return WorkbenchSection(title: "Tool providers", note: "the use array", count: used.count, color: WorkbenchStyle.thingColor("features")) {
            VStack(alignment: .leading, spacing: KitTokens.Space.s2) {
                if !editor.ownTools.isEmpty {
                    Text("own: " + editor.ownTools.joined(separator: ", "))
                        .font(WorkbenchStyle.code(KitTokens.TypeScale.xs))
                        .foregroundStyle(p.textMuted.color)
                        .lineLimit(3)
                }
                ForEach(used) { providerRow($0) }
                ForEach(editor.use.filter { $0.feature == nil }, id: \.line) { entry in
                    HStack(spacing: KitTokens.Space.s3) {
                        Image(systemName: "checkmark.square.fill").font(.system(size: 11)).foregroundStyle(WorkbenchStyle.thingColor("features"))
                        Text(entry.text).font(WorkbenchStyle.code(KitTokens.TypeScale.xs)).foregroundStyle(p.textBody.color).lineLimit(1)
                    }
                }
                if !rest.isEmpty {
                    Button { model.useFeature() } label: {
                        HStack(spacing: KitTokens.Space.s3) {
                            Image(systemName: "plus").font(.system(size: 10, weight: .semibold))
                            Text("\(rest.count) more feature\(rest.count == 1 ? "" : "s") with tools").font(WorkbenchStyle.meta)
                        }
                        .foregroundStyle(p.textFaint.color)
                    }
                    .buttonStyle(.plain)
                    .keyBadge("lucaAssistant.tools")
                    .padding(.top, KitTokens.Space.s2)
                }
            }
        }
    }

    private func providerRow(_ provider: WorkbenchAssistantEditor.Provider) -> some View {
        Button { model.useFeature(provider.name, remove: true) } label: {
            HStack(alignment: .firstTextBaseline, spacing: KitTokens.Space.s3) {
                Image(systemName: "checkmark.square.fill").font(.system(size: 11)).foregroundStyle(WorkbenchStyle.thingColor("features"))
                VStack(alignment: .leading, spacing: 1) {
                    Text(provider.name)
                        .font(WorkbenchStyle.code(KitTokens.TypeScale.xs, weight: .semibold))
                        .foregroundStyle(p.text.color)
                    Text(provider.only?.joined(separator: ", ") ?? "all \(provider.tools.count) tool\(provider.tools.count == 1 ? "" : "s")")
                        .font(WorkbenchStyle.meta).foregroundStyle(p.textFaint.color).lineLimit(2)
                }
                Spacer(minLength: 0)
            }
        }
        .buttonStyle(.plain)
        .help(provider.description.isEmpty ? "Enter takes it out of the use array" : provider.description)
    }
}
