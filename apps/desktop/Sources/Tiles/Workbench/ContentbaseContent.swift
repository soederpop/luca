import SwiftUI
import Combine

/// `luca://<project>/contentbase?model=<name>&pane=model|query`: the
/// project's contentbase models, an editor for them, and a query view.
///
/// A model the tile defines is `docs/models/<name>.md` (the workspace model
/// format, loaded by luca's `markdownModels`). The host writes it from the
/// spec the form holds, checks the spec as it changes (`/contentbase/preview`)
/// and reads it back. Models from `models.ts` or hand-written files show the
/// same form, read only, with their file one key away.
///
/// The query pane builds where rows and sorts on one model and shows the
/// rows as a table, typed by field kind. It runs as you change it.
@MainActor
final class ContentbaseContent: WorkbenchContent {
    static let kind = TileKind(id: "luca-contentbase", label: "Contentbase", glyph: "tablecells") { uri, _ in
        ContentbaseContent(uri: uri)
    }

    enum Pane: String { case model, query }

    @Published private(set) var overview: ContentbaseOverview?
    @Published private(set) var error: String?
    @Published private(set) var selected: String?
    @Published var pane: Pane
    /// True while the form holds a model not saved yet.
    @Published private(set) var isNew = false

    // The model form.
    @Published var draft = ContentbaseModelSpec.blank() { didSet { draftChanged() } }
    @Published private(set) var loaded = ContentbaseModelSpec.blank()
    @Published private(set) var preview: ContentbasePreview?
    @Published private(set) var saving = false
    @Published var showFile = false
    /// The prefix follows the name until it is typed in.
    var prefixTouched = false

    // The query.
    @Published var filters: [ContentbaseFilter] = [] { didSet { scheduleQuery() } }
    @Published var sorts: [ContentbaseSort] = [] { didSet { scheduleQuery() } }
    @Published var columns: [String] = [] { didSet { scheduleQuery() } }
    /// The DSL's where as JSON text (`:query`); when set, it runs instead of the rows.
    @Published var rawWhere: String? { didSet { scheduleQuery() } }
    @Published private(set) var result: ContentbaseResult?
    @Published private(set) var querying = false

    @Published private(set) var focusTick = 0

    private var loadTask: Task<Void, Never>?
    private var previewTask: Task<Void, Never>?
    private var queryTask: Task<Void, Never>?
    private var quietQuery = false

    init(uri: TileURI) {
        pane = Pane(rawValue: uri.option("pane") ?? "") ?? .model
        selected = uri.option("model")
        super.init(kindId: Self.kind.id, uri: uri, title: "\(ProjectHub.shared.displayName(uri.authority)) contentbase")
    }

    override func makeBody() -> AnyView { AnyView(ContentbaseView(model: self)) }

    override func hostChanged(_ client: WorkbenchClient?) {
        loadTask?.cancel()
        if client != nil { reload() }
    }

    override func stop() {
        previewTask?.cancel()
        queryTask?.cancel()
        super.stop()
    }

    var models: [ContentbaseModel] { overview?.models ?? [] }
    var current: ContentbaseModel? { isNew ? nil : models.first { $0.name == selected } }
    var editable: Bool { isNew || current?.editable == true }
    var dirty: Bool { editable && !draft.sameContent(as: loaded) }
    var fieldTypes: [String] { overview?.fieldTypes ?? ["string", "number", "boolean", "date", "enum", "list"] }
    var extractKinds: [String] { overview?.extractKinds ?? ["text", "list", "code"] }

    override func perform(_ action: String) -> Bool {
        switch action {
        case "lucaContentbase.next": step(1)
        case "lucaContentbase.prev": step(-1)
        case "lucaContentbase.model": show(.model)
        case "lucaContentbase.query": show(.query)
        case "lucaContentbase.new": newModel()
        case "lucaContentbase.edit": focusTick += 1
        case "lucaContentbase.addField": addField()
        case "lucaContentbase.addSection": addSection()
        case "lucaContentbase.addFilter": addFilter()
        case "lucaContentbase.addSort": addSort()
        case "lucaContentbase.run": pane == .query ? runQuery() : reload()
        case "lucaContentbase.file": openFile()
        case "lucaContentbase.template": openTemplate()
        case "lucaContentbase.delete": confirmDelete()
        case "lucaContentbase.copy": copyCode()
        case "lucaContentbase.docs": openDocs()
        case "lucaContentbase.restart": restartHost()
        case "doc.save": save()
        default: return false
        }
        return true
    }

    override func runCommand(_ verb: String, _ rest: String) -> Bool {
        switch verb {
        case "w": save()
        case "model":
            guard models.contains(where: { $0.name == rest }) else { Shell.shared.flash("No model \(rest)"); return true }
            select(rest)
        case "new": newModel(name: rest)
        case "query":
            show(.query)
            rawWhere = rest.isEmpty ? nil : rest
        case "where":
            // `:where meta.status eq done`, for check runs and quick edits.
            let parts = rest.split(separator: " ", maxSplits: 2).map(String.init)
            guard parts.count >= 2 else { Shell.shared.flash("Usage: where <path> <op> [value]"); return true }
            show(.query)
            filters.append(ContentbaseFilter(path: parts[0], op: parts[1], value: parts.count > 2 ? parts[2] : ""))
        default: return false
        }
        return true
    }

    // MARK: Loading

    func reload() {
        guard let host else { return }
        stateLabel = overview == nil ? "loading" : "updating"
        loadTask?.cancel()
        loadTask = Task { [weak self] in
            do {
                let overview = try await host.contentbase()
                guard let self, !Task.isCancelled else { return }
                self.overview = overview
                self.error = nil
                self.stateLabel = "\(overview.models.filter { $0.slot >= 0 }.count) models"
                self.settleSelection()
            } catch {
                guard let self, !Task.isCancelled else { return }
                self.error = ErrorText.message(error)
                self.stateLabel = "error"
            }
        }
    }

    /// Keep the model picked if it is still there, else the first one.
    private func settleSelection() {
        if isNew { return }
        if let name = selected, models.contains(where: { $0.name == name }) {
            // Refresh the form only when there are no unsaved edits.
            if !dirty { loadForm() }
            if pane == .query { runQuery() }
            return
        }
        if let first = models.first { select(first.name) }
    }

    private func loadForm() {
        guard let m = current else { return }
        quietPreview { loaded = m.spec; draft = m.spec }
        prefixTouched = true
        preview = nil
        showFile = false
    }

    /// Set the draft without asking the host to check it.
    private func quietPreview(_ change: () -> Void) {
        let was = suppressPreview
        suppressPreview = true
        change()
        suppressPreview = was
    }
    private var suppressPreview = false

    // MARK: Selection and panes

    func select(_ name: String) {
        guard !dirty || name == selected else {
            return Shell.shared.flash("Save (Cmd-s) or revert this model first")
        }
        isNew = false
        selected = name
        loadForm()
        resetQuery()
        updateAddress()
        if pane == .query { runQuery() }
    }

    func show(_ next: Pane) {
        pane = next
        updateAddress()
        if next == .query, result == nil || result?.model != selected { runQuery() }
    }

    private func step(_ by: Int) {
        let names = models.map(\.name)
        guard !names.isEmpty else { return }
        let at = names.firstIndex(of: selected ?? "") ?? -1
        let next = max(0, min(names.count - 1, at + by))
        if names[next] != selected { select(names[next]) }
    }

    private func updateAddress() {
        var options: [TileURI.Option] = []
        if let selected, !isNew { options.append(.init(name: "model", value: selected)) }
        if pane == .query { options.append(.init(name: "pane", value: "query")) }
        uri = TileURI.luca(project: projectId, tool: "contentbase", options: options)
    }

    // MARK: The model form

    func newModel(name: String = "") {
        guard !dirty else { return Shell.shared.flash("Save (Cmd-s) or revert this model first") }
        isNew = true
        pane = .model
        prefixTouched = false
        quietPreview { loaded = .blank(); draft = .blank() }
        draft.name = name
        preview = nil
        stateLabel = "new model"
        updateAddress()
        focusTick += 1
    }

    func revert() {
        if isNew {
            isNew = false
            quietPreview { draft = loaded }
            if let first = selected ?? models.first?.name { select(first) }
        } else {
            loadForm()
        }
    }

    func addField() {
        guard editable else { return readOnlyFlash() }
        show(.model)
        draft.fields.append(.blank())
        focusTick += 1
    }

    func addSection() {
        guard editable else { return readOnlyFlash() }
        show(.model)
        draft.sections.append(.blank())
    }

    func removeField(_ id: UUID) { draft.fields.removeAll { $0.id == id } }
    func removeSection(_ id: UUID) { draft.sections.removeAll { $0.id == id } }

    func moveField(_ id: UUID, by: Int) {
        guard let i = draft.fields.firstIndex(where: { $0.id == id }) else { return }
        let j = i + by
        guard draft.fields.indices.contains(j) else { return }
        draft.fields.swapAt(i, j)
    }

    private func readOnlyFlash() {
        Shell.shared.flash(current?.readOnlyNote ?? "This model is read only here")
    }

    private func draftChanged() {
        guard !suppressPreview, editable else { return }
        previewTask?.cancel()
        guard let host else { return }
        let spec = draft
        let original = isNew ? nil : selected
        previewTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 250_000_000)
            guard !Task.isCancelled else { return }
            guard let answer = try? await host.contentbasePreview(spec, original: original) else { return }
            guard let self, !Task.isCancelled else { return }
            self.preview = answer
            // The host names the folder for a new name until one is typed.
            if self.isNew, !self.prefixTouched, self.draft.prefix != answer.suggestedPrefix {
                self.quietPreview { self.draft.prefix = answer.suggestedPrefix }
            }
        }
    }

    func save() {
        guard editable else { return readOnlyFlash() }
        guard let host else { return Shell.shared.flash("The workbench host is not running") }
        guard !saving else { return }
        if !isNew, !dirty { return Shell.shared.flash("No changes") }
        saving = true
        let spec = draft
        let original = isNew ? nil : selected
        let digest = isNew ? nil : current?.digest
        Task { [weak self] in
            defer { self?.saving = false }
            do {
                let saved = try await host.contentbaseSave(spec, original: original, digest: digest)
                guard let self else { return }
                self.isNew = false
                self.selected = saved.view?.name ?? spec.name
                if let view = saved.view { self.quietPreview { self.loaded = view.spec; self.draft = view.spec } }
                self.updateAddress()
                Shell.shared.flash(saved.loadError.map { "Saved, but it did not load: \($0)" } ?? saved.text)
                self.reload()
            } catch {
                Shell.shared.flash(ErrorText.message(error))
                self?.draftChanged()
            }
        }
    }

    func confirmDelete() {
        guard let m = current else { return }
        guard m.source == "tile" else { return Shell.shared.flash("Only models this tile wrote can be deleted here") }
        PaletteController.shared.confirm("Delete \(m.fileDisplay)? Its \(m.count) document\(m.count == 1 ? "" : "s") stay.", yes: "delete") { [weak self] in
            guard let self, let host = self.host else { return }
            Task {
                do {
                    let text = try await host.contentbaseDelete(m.name)
                    Shell.shared.flash(text)
                    self.selected = nil
                    self.reload()
                } catch {
                    Shell.shared.flash(ErrorText.message(error))
                }
            }
        }
    }

    // MARK: Files

    func openFile() {
        guard let m = current, !m.file.isEmpty else { return Shell.shared.flash("This model has no file") }
        Shell.shared.open(FileContent.address(project: projectId, path: m.file))
    }

    /// The template opens in a file tile; a missing one is made on its first save.
    func openTemplate() {
        guard let m = current else { return Shell.shared.flash(isNew ? "Save the model first" : "Pick a model") }
        guard m.source != "builtin" else { return Shell.shared.flash("Base has no template") }
        Shell.shared.open(FileContent.address(project: projectId, path: m.template.file))
    }

    func openDocs() {
        guard let name = selected else { return }
        Shell.shared.open(TileURI.luca(project: projectId, tool: "docs", options: [.init(name: "model", value: name)]))
    }

    func openRow(_ row: ContentbaseResult.Row) {
        Shell.shared.open(TileURI.luca(project: projectId, tool: "doc", id: row.id))
    }

    // MARK: The query

    private func resetQuery() {
        quietQuery = true
        filters = []
        sorts = []
        columns = []
        rawWhere = nil
        quietQuery = false
        result = nil
    }

    func addFilter() {
        show(.query)
        let path = result?.paths?.first { $0.key.hasPrefix("meta.") }?.key ?? "id"
        filters.append(ContentbaseFilter(path: path, op: "eq", value: ""))
        focusTick += 1
    }

    func addSort() {
        show(.query)
        let path = result?.paths?.first { $0.key.hasPrefix("meta.") }?.key ?? "id"
        sorts.append(ContentbaseSort(path: path, direction: "asc"))
    }

    func toggleColumn(_ key: String) {
        var keys = columns.isEmpty ? (result?.columns?.map(\.key) ?? []) : columns
        if let i = keys.firstIndex(of: key) { keys.remove(at: i) } else { keys.append(key) }
        // No columns at all would ask the host for its default set.
        columns = keys.isEmpty ? ["id"] : keys
    }

    func shownColumn(_ key: String) -> Bool {
        (result?.columns ?? []).contains { $0.key == key }
    }

    private func scheduleQuery() {
        guard !quietQuery, pane == .query else { return }
        queryTask?.cancel()
        queryTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 300_000_000)
            guard !Task.isCancelled else { return }
            self?.runQuery()
        }
    }

    func runQuery() {
        guard let host, let model = selected, !isNew else { return }
        queryTask?.cancel()
        querying = true
        let request = ContentbaseQueryRequest(model: model, filters: filters, sort: sorts, columns: columns, limit: 200, where: rawWhere)
        queryTask = Task { [weak self] in
            do {
                let answer = try await host.contentbaseQuery(request)
                guard let self, !Task.isCancelled else { return }
                self.result = answer
                self.querying = false
                if answer.ok { self.stateLabel = "\(answer.total ?? 0) of \(model)" }
            } catch {
                guard let self, !Task.isCancelled else { return }
                self.querying = false
                self.result = ContentbaseResult(ok: false, error: ErrorText.message(error), model: model, slot: nil, total: nil, count: nil,
                                                columns: nil, rows: nil, paths: self.result?.paths, ops: nil, whereText: nil, sortText: nil, code: nil, ms: nil)
            }
        }
    }

    func copyCode() {
        guard let code = result?.code else { return Shell.shared.flash("Run a query first") }
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(code, forType: .string)
        Shell.shared.flash("Copied the query as code")
    }

    /// A path's kind and enum values, from the last result.
    func path(_ key: String) -> ContentbaseResult.Path? {
        result?.paths?.first { $0.key == key }
    }

    /// The DSL's operators as words a person reads. Pure.
    nonisolated static func opLabel(_ op: String) -> String {
        switch op {
        case "eq": return "is"
        case "neq": return "is not"
        case "in": return "is one of"
        case "notIn": return "is none of"
        case "gt": return ">"
        case "gte": return "≥"
        case "lt": return "<"
        case "lte": return "≤"
        case "contains": return "contains"
        case "startsWith": return "starts with"
        case "endsWith": return "ends with"
        case "regex": return "matches"
        case "exists": return "exists"
        default: return op
        }
    }
}
