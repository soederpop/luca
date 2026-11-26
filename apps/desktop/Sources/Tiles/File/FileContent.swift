import SwiftUI
import Combine
import CryptoKit

/// A plain file in the source editor, saved whole and only over the file it
/// loaded (by digest).
///
/// - `luca://<project>/file/<path>`: a file in the project folder, read and
///   saved through the host (`GET /file`, `POST /file/save`). The host keeps
///   the path inside the folder. A path with no file yet opens empty; the
///   first save makes it.
/// - `app://desktop/file/<path>`: one of the app's own files under the app
///   folder (`keymap.yml`, `layouts/<name>.yml`), read and written here. A
///   save of the keymap reloads it; a save of a layout re-applies it.
///
/// `i` edits, `Cmd-s` or `:w` saves, `r` reloads, `d p` / `d o` settle a
/// conflict.
@MainActor
final class FileContent: TileContent {
    static let kind = TileKind(id: "luca-file", label: "File", glyph: "doc.plaintext") { uri, owner in
        FileContent(uri: uri, owner: owner)
    }

    static let appKind = TileKind(id: "app-file", label: "App file", glyph: "gearshape") { uri, owner in
        FileContent(uri: uri, owner: owner)
    }

    /// The tile for a file of a project. Pure, so it is tested.
    static func address(project: String, path: String) -> TileURI {
        var rel = path.trimmingCharacters(in: .whitespaces)
        while rel.hasPrefix("./") { rel.removeFirst(2) }
        return TileURI.luca(project: project, tool: "file", id: rel)
    }

    let path: String
    /// The project, for a project file. Nil for an app file.
    let projectId: String?
    let buffer = WorkbenchDocBuffer()
    @Published private(set) var doc: WorkbenchDoc?
    @Published private(set) var error: String?
    @Published private(set) var saving = false
    @Published private(set) var hostStatus: HostStatus = .running
    private var host: WorkbenchClient?
    private var hostWatch: AnyCancellable?
    private var bufferWatch: AnyCancellable?
    private var loadTask: Task<Void, Never>?
    private lazy var sourceEditor: SourceEditorController = makeSourceEditor()
    private var hasSourceEditor = false

    /// The action prefix of this tile's keys: `lucaFile` or `appFile`.
    var keyPrefix: String { projectId == nil ? "appFile" : "lucaFile" }

    init(uri: TileURI, owner: String) {
        path = uri.id ?? ""
        projectId = uri.project
        super.init(kindId: uri.kindKey, uri: uri, owner: owner, title: (path as NSString).lastPathComponent)
        if projectId != nil { hostStatus = .starting; stateLabel = HostStatus.starting.label }
        bufferWatch = buffer.objectWillChange
            .receive(on: DispatchQueue.main)
            .sink { [weak self] in self?.refreshLabel() }
    }

    /// The app file on disk. Nil for a project file.
    var appURL: URL? {
        guard projectId == nil else { return nil }
        return path.hasPrefix("/") ? URL(fileURLWithPath: path) : TilesPaths.root.appendingPathComponent(path)
    }

    override func makeBody() -> AnyView { AnyView(FileTileView(model: self, buffer: buffer)) }

    override func start() {
        guard let projectId else { return load() }
        hostWatch = WorkbenchHostWatch.watch(projectId) { [weak self] status, client in
            guard let self else { return }
            self.hostStatus = status
            if status != .running { self.stateLabel = status.label }
            guard client !== self.host else { return }
            self.host = client
            if client != nil { self.load() }
        }
    }

    override func stop() {
        if buffer.dirty { Shell.shared.flash("Unsaved edits to \(title) are dropped") }
        hostWatch = nil
        host = nil
        loadTask?.cancel()
        super.stop()
    }

    // MARK: Loading and saving

    func load(discard: Bool = false) {
        loadTask?.cancel()
        if !buffer.isLoaded { stateLabel = "loading" }
        loadTask = Task { [weak self] in
            guard let self else { return }
            do {
                let doc = try await self.read()
                guard !Task.isCancelled else { return }
                self.doc = doc
                self.error = nil
                self.buffer.take(doc, discard: discard)
            } catch {
                guard !Task.isCancelled else { return }
                self.error = ErrorText.message(error)
            }
            self.refreshLabel()
        }
    }

    private func read() async throws -> WorkbenchDoc {
        if let url = appURL { return try Self.readLocal(url, display: path) }
        guard let host else { throw WorkbenchError.notRunning }
        return try await host.file(path)
    }

    func save(then done: (() -> Void)? = nil) {
        guard let digest = buffer.digest else { return Shell.shared.flash("Not loaded yet") }
        guard buffer.conflict == nil else { return Shell.shared.flash("The file changed on disk. d p keeps yours, d o takes the file") }
        guard buffer.dirty else { Shell.shared.flash("No changes"); done?(); return }
        guard !saving else { return Shell.shared.flash("Still saving") }
        let sent = buffer.raw
        saving = true
        refreshLabel()
        Task { [weak self] in
            guard let self else { return }
            do {
                let answer: WorkbenchDocSaved
                if let url = self.appURL {
                    answer = try Self.saveLocal(url, display: self.path, text: sent, digest: digest)
                } else {
                    guard let host = self.host else { throw WorkbenchError.notRunning }
                    answer = try await host.saveFile(path: self.path, text: sent, digest: digest)
                }
                self.saving = false
                if let view = answer.view {
                    self.doc = view
                    self.buffer.saved(sent, digest: view.digest)
                }
                Shell.shared.flash(answer.unchanged == true ? "No changes" : (answer.text ?? "Saved \(self.title)"))
                if let url = self.appURL { Self.appFileSaved(url) }
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
        else if buffer.isLoaded { stateLabel = doc?.sizeText }
        else { stateLabel = hostStatus == .running ? "loading" : hostStatus.label }
    }

    // MARK: App files, on this Mac

    /// An app file in a doc's shape, with the sha1 the host would give it.
    static func readLocal(_ url: URL, display: String) throws -> WorkbenchDoc {
        let data = FileManager.default.fileExists(atPath: url.path) ? try Data(contentsOf: url) : Data()
        let text = String(decoding: data, as: UTF8.self)
        return WorkbenchDoc(id: display, model: "", slot: 0, title: url.lastPathComponent, path: url.path,
                            pathDisplay: display, file: text, digest: digest(data), size: data.count,
                            sizeText: ByteCountFormatter.string(fromByteCount: Int64(data.count), countStyle: .file), fields: [])
    }

    /// Write only over the file that was loaded, as the host does.
    static func saveLocal(_ url: URL, display: String, text: String, digest expected: String) throws -> WorkbenchDocSaved {
        let current = try readLocal(url, display: display)
        guard current.digest == expected else { throw WorkbenchDocConflict(current: current) }
        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        try text.write(to: url, atomically: true, encoding: .utf8)
        return WorkbenchDocSaved(ok: true, unchanged: false, view: try readLocal(url, display: display), text: "Saved \(display)", error: nil)
    }

    nonisolated static func digest(_ data: Data) -> String {
        Insecure.SHA1.hash(data: data).map { String(format: "%02x", $0) }.joined()
    }

    /// The keymap reloads; a layout re-applies where it is loaded.
    static func appFileSaved(_ url: URL) {
        if url.standardizedFileURL == TilesPaths.keymap.standardizedFileURL { KeymapStore.shared.reload(force: true) }
        Shell.shared.layoutFileSaved(url)
    }

    // MARK: Editor

    var sourceController: SourceEditorController {
        hasSourceEditor = true
        return sourceEditor
    }

    private func makeSourceEditor() -> SourceEditorController {
        let editor = SourceEditorController(buffer: buffer, language: SourceEditorController.language(for: path))
        editor.onSave = { [weak self] in self?.save() }
        editor.onClose = { [weak self] in
            guard let self else { return }
            Shell.shared.close(self.tileId)
        }
        editor.onEscape = { Shell.shared.leaveEditor() }
        editor.onVimChanged = { on in Shell.shared.flash(on ? "vim on" : "vim off") }
        return editor
    }

    override var editorHasKeyboard: Bool { hasSourceEditor && sourceEditor.hasFocus }
    override func passesEscape() -> Bool { editorHasKeyboard }

    // MARK: Keys and commands

    override func perform(_ action: String) -> Bool {
        let name = action.hasPrefix(keyPrefix + ".") ? String(action.dropFirst(keyPrefix.count + 1)) : action
        switch name {
        case "doc.save": save()
        case "reload": reload()
        case "prompt":
            guard let projectId, path.lowercased().hasSuffix(".md") || path.lowercased().hasSuffix(".markdown") else {
                Shell.shared.flash("luca prompt runs a markdown file of a project")
                return true
            }
            let go = { [weak self] in
                guard let self else { return }
                PromptRunner.run(project: projectId, file: self.path, near: self.tileId)
            }
            if buffer.dirty { save(then: go) } else { go() }
        case "edit":
            guard buffer.isLoaded else { Shell.shared.flash("Not loaded yet"); return true }
            sourceController.focus()
            Shell.shared.syncTextMode()
        case "keepMine":
            guard buffer.conflict != nil else { Shell.shared.flash("No conflict"); return true }
            buffer.keepMine()
        case "takeTheirs":
            guard buffer.conflict != nil else { Shell.shared.flash("No conflict"); return true }
            buffer.takeTheirs()
        case "project":
            guard let projectId else { return false }
            Shell.shared.focusOrOpenTool(project: projectId, tool: "project")
        case "restart":
            guard let projectId else { return false }
            ProjectHub.shared.restart(projectId)
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
}

// MARK: - View

struct FileTileView: View {
    @ObservedObject var model: FileContent
    @ObservedObject var buffer: WorkbenchDocBuffer

    private var p: KitPalette { Theme.palette }

    var body: some View {
        VStack(spacing: 0) {
            if model.hostStatus != .running {
                WorkbenchHostLine(status: model.hostStatus).padding(KitTokens.Space.s5)
            }
            if buffer.conflict != nil { conflictBar }
            header
            if let error = model.error, !buffer.isLoaded {
                WorkbenchCard(tint: p.bad.color) {
                    Text(error)
                        .font(WorkbenchStyle.ui(KitTokens.TypeScale.sm))
                        .foregroundStyle(p.bad.color)
                        .textSelection(.enabled)
                }
                .padding(KitTokens.Space.s7)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            } else if !buffer.isLoaded {
                ProgressView().controlSize(.small).frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                SourceEditorView(controller: model.sourceController)
            }
        }
        .background(p.surface.color)
    }

    private var header: some View {
        HStack(alignment: .firstTextBaseline, spacing: KitTokens.Space.s4) {
            if model.projectId != nil {
                WorkbenchTag(text: SourceEditorController.language(for: model.path), color: Theme.ownerColor(model.owner))
            } else {
                WorkbenchTag(text: "app file", color: p.accent.color)
            }
            Text(model.doc?.pathDisplay ?? model.path)
                .font(WorkbenchStyle.code(KitTokens.TypeScale.xs))
                .foregroundStyle(p.textMuted.color)
                .lineLimit(1).truncationMode(.head)
                .textSelection(.enabled)
            Spacer(minLength: KitTokens.Space.s4)
            if buffer.dirty {
                WorkbenchTag(text: model.saving ? "saving" : "modified", color: p.warn.color)
            }
            if let size = model.doc?.sizeText {
                Text(size).font(WorkbenchStyle.ui(KitTokens.TypeScale.xs)).foregroundStyle(p.textFaint.color)
            }
            Text("edit").font(WorkbenchStyle.ui(KitTokens.TypeScale.xs)).foregroundStyle(p.textMuted.color)
                .keyBadge(model.keyPrefix + ".edit", leading: true)
        }
        .padding(.horizontal, KitTokens.Space.s7)
        .padding(.vertical, KitTokens.Space.s4)
        .background(p.surface.color)
        .overlay(alignment: .bottom) { Rectangle().fill(p.border.color).frame(height: 1) }
    }

    private var conflictBar: some View {
        HStack(spacing: KitTokens.Space.s4) {
            Image(systemName: "exclamationmark.triangle.fill")
            Text("The file changed on disk while you were editing")
                .font(WorkbenchStyle.ui(KitTokens.TypeScale.sm, weight: .semibold))
            Spacer(minLength: KitTokens.Space.s4)
            Button { _ = model.perform(model.keyPrefix + ".keepMine") } label: { Text("keep mine").underline() }
                .buttonStyle(.plain).keyBadge(model.keyPrefix + ".keepMine")
            Button { _ = model.perform(model.keyPrefix + ".takeTheirs") } label: { Text("take the file").underline() }
                .buttonStyle(.plain).keyBadge(model.keyPrefix + ".takeTheirs")
        }
        .font(WorkbenchStyle.ui(KitTokens.TypeScale.sm))
        .foregroundStyle(p.accentOn.color)
        .padding(.horizontal, KitTokens.Space.s7)
        .padding(.vertical, KitTokens.Space.s4)
        .background(p.warn.color)
    }
}
