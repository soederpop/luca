import SwiftUI
import Combine

/// `luca://<project>/docs`: the project's contentbase documents, one card
/// stack per model in the models file's order, `Other` last for documents no
/// model matches (`GET /docs`). Each model has its color (`slotColor`).
/// `Enter` opens a `doc` tile; `m` the models view. A project with no docs
/// folder shows the host's one-line notice.
@MainActor
final class LucaDocsContent: IndexContent {
    static let kind = TileKind(id: "luca-docs", label: "Docs", glyph: "doc.on.doc") { uri, _ in
        LucaDocsContent(uri: uri)
    }

    let projectId: String
    private(set) var host: WorkbenchClient?
    private var hostWatch: AnyCancellable?
    private var focusedStackOnce = false

    init(uri: TileURI) {
        projectId = uri.authority
        super.init(kindId: Self.kind.id, uri: uri, owner: ProjectHub.ownerId(uri.authority),
                   title: "\(ProjectHub.shared.displayName(uri.authority)) docs")
        stateLabel = HostStatus.starting.label
    }

    override var emptyNote: String { "No documents." }

    override func start() {
        hostWatch = WorkbenchHostWatch.watch(projectId) { [weak self] status, client in
            guard let self else { return }
            if case .failed(let line) = status { self.notice = line }
            if status != .running { self.stateLabel = status.label }
            guard client !== self.host else { return }
            self.host = client
            if client != nil { self.reload(then: { [weak self] in self?.focusAskedStack() }) }
        }
    }

    override func stop() {
        hostWatch = nil
        host = nil
        super.stop()
    }

    override func loadStacks() async throws -> [IndexStack] {
        guard let host else { return [] }
        let reply = try await host.docs()
        notice = reply.error ?? reply.notice
        return Self.indexStacks(reply, project: projectId)
    }

    override func performKind(_ action: String) -> Bool {
        switch action {
        case "lucaDocs.models":
            Shell.shared.focusOrOpenTool(project: projectId, tool: "models")
        case "lucaDocs.new":
            Self.newDocument(project: projectId, typed: "", near: tileId)
        case "lucaDocs.restart":
            ProjectHub.shared.restart(projectId)
        default:
            return false
        }
        return true
    }

    override func runCommand(_ verb: String, _ rest: String) -> Bool {
        switch verb {
        case "new", "new-doc":
            Self.newDocument(project: projectId, typed: rest, near: tileId)
            return true
        default:
            return false
        }
    }

    /// `n`, `:new [Model] [title]`, the shell's `:new-doc`: a new document.
    /// A first word that names a model picks it (`Other` is no model); else
    /// the palette asks, unless the project has one. The rest is the title;
    /// with none the palette asks. The host makes the file from the model's
    /// template (`POST /docs/create`) and the doc opens in source view.
    static func newDocument(project: String, typed: String, near: UUID?) {
        guard let host = ProjectHub.shared.client(project) else {
            Shell.shared.focusOrOpenTool(project: project, tool: "docs")
            return Shell.shared.flash("Starting the host: press n in the docs tile when it is up")
        }
        Task { @MainActor in
            do {
                let reply = try await host.docs()
                if reply.stacks.isEmpty { return Shell.shared.flash(reply.notice ?? reply.error ?? "This project has no docs") }
                var words = typed.split(separator: " ").map(String.init)
                var picked: WorkbenchDocs.Stack?
                if let first = words.first?.lowercased(),
                   let hit = reply.stacks.first(where: { $0.id.lowercased() == first || $0.title.lowercased() == first }) {
                    picked = hit
                    words.removeFirst()
                }
                let title = words.joined(separator: " ")
                let create: (WorkbenchDocs.Stack) -> Void = { stack in
                    let what = stack.id == "Base" ? "document" : stack.title
                    let go: (String) -> Void = { t in Self.create(host, project: project, model: stack.id, title: t, near: near) }
                    if !title.isEmpty { go(title) } else { PaletteController.shared.ask("title of the new \(what)") { go($0) } }
                }
                if let picked { return create(picked) }
                if reply.stacks.count == 1 { return create(reply.stacks[0]) }
                PaletteController.shared.choose("new document of which model", reply.stacks.map { stack in
                    let note = stack.id == "Base" ? "no model: a file at the docs root" : "\(stack.count) \(stack.count == 1 ? "document" : "documents")"
                    return PaletteChoice(title: stack.title, detail: note) { create(stack) }
                })
            } catch {
                Shell.shared.flash(ErrorText.message(error))
            }
        }
    }

    private static func create(_ host: WorkbenchClient, project: String, model: String, title: String, near: UUID?) {
        let title = title.trimmingCharacters(in: .whitespaces)
        guard !title.isEmpty else { return Shell.shared.flash("The document needs a title") }
        Task { @MainActor in
            do {
                let made = try await host.createDoc(model: model == "Base" ? "" : model, title: title)
                Shell.shared.flash(made.text)
                let doc = TileURI.luca(project: project, tool: "doc", id: made.id, options: [TileURI.Option(name: "view", value: "source")])
                Shell.shared.open(doc, near: near)
                // The docs tiles of the project show the new card without a key press.
                for tile in Shell.shared.tiles.values {
                    if let docs = tile.content as? LucaDocsContent, docs.projectId == project { docs.reload(quiet: true) }
                }
            } catch {
                Shell.shared.flash(ErrorText.message(error))
            }
        }
    }

    private func focusAskedStack() {
        guard !focusedStackOnce else { return }
        focusedStackOnce = true
        guard let stack = uri.option("model"),
              let first = state.shown.first(where: { $0.id == stack })?.cards.first else { return }
        state.focus(cardId: first.id)
    }

    /// The host's stacks as index stacks, each in its model's color. A card
    /// opens the `doc` tile its address names. Pure, so it is tested.
    nonisolated static func indexStacks(_ reply: WorkbenchDocs, project: String) -> [IndexStack] {
        reply.stacks.map { stack in
            IndexStack(id: stack.id, title: stack.title, cards: stack.cards.map { card in
                IndexCard(id: card.id, title: card.title, subtitle: card.subtitle,
                          preview: card.preview.isEmpty ? nil : card.preview,
                          badge: card.badge.isEmpty ? nil : card.badge,
                          uri: TileURI.luca(project: project, tool: "doc", id: card.id), subtitleIsCode: true)
            }, tone: "slot:\(stack.slot)")
        }
    }
}

/// `luca://<project>/models`: each model of the collection with its prefix,
/// description, document count and frontmatter fields (`GET /docs/models`).
/// Field types are colored by kind; enums list their values.
@MainActor
final class ModelsContent: WorkbenchContent {
    static let kind = TileKind(id: "luca-models", label: "Doc models", glyph: "square.stack.3d.up") { uri, _ in
        ModelsContent(uri: uri)
    }

    @Published private(set) var reply: WorkbenchModels?
    @Published private(set) var error: String?
    private var loadTask: Task<Void, Never>?

    init(uri: TileURI) {
        super.init(kindId: Self.kind.id, uri: uri, title: "\(ProjectHub.shared.displayName(uri.authority)) doc models")
    }

    override func makeBody() -> AnyView { AnyView(ModelsView(model: self)) }

    override func hostChanged(_ client: WorkbenchClient?) {
        loadTask?.cancel()
        if client != nil { load() }
    }

    override func perform(_ action: String) -> Bool {
        switch action {
        case "lucaModels.docs": Shell.shared.focusOrOpenTool(project: projectId, tool: "docs")
        case "lucaModels.reload": load()
        case "lucaModels.restart": restartHost()
        case "lucaModels.contentbase": Shell.shared.focusOrOpenTool(project: projectId, tool: "contentbase")
        default: return false
        }
        return true
    }

    func load() {
        guard let host else { return }
        stateLabel = reply == nil ? "loading" : "updating"
        loadTask = Task { [weak self] in
            do {
                let reply = try await host.models()
                guard let self, !Task.isCancelled else { return }
                self.reply = reply
                self.error = nil
                let own = reply.models.filter { $0.slot >= 0 }.count
                self.stateLabel = "\(own) model\(own == 1 ? "" : "s")"
            } catch {
                guard let self, !Task.isCancelled else { return }
                self.error = ErrorText.message(error)
                self.stateLabel = "error"
            }
        }
    }

    /// Open the docs index on one model's stack.
    func openDocs(_ name: String) {
        Shell.shared.open(TileURI.luca(project: projectId, tool: "docs", options: [.init(name: "model", value: name)]))
    }
}

struct ModelsView: View {
    @ObservedObject var model: ModelsContent

    private var p: KitPalette { Theme.palette }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: KitTokens.Space.s7) {
                WorkbenchHostLine(status: model.hostStatus)
                if let error = model.error {
                    Text(error).font(WorkbenchStyle.ui(KitTokens.TypeScale.sm)).foregroundStyle(p.bad.color)
                }
                if let reply = model.reply {
                    HStack(alignment: .firstTextBaseline, spacing: KitTokens.Space.s4) {
                        Text("Doc models")
                            .font(WorkbenchStyle.ui(KitTokens.TypeScale.lg, weight: .semibold))
                            .foregroundStyle(p.text.color)
                        Text(reply.rootDisplay)
                            .font(WorkbenchStyle.code(KitTokens.TypeScale.xs))
                            .foregroundStyle(p.textFaint.color)
                            .lineLimit(1).truncationMode(.head)
                        Spacer(minLength: 0)
                    }
                    if let line = reply.error ?? reply.notice {
                        Text(line)
                            .font(WorkbenchStyle.ui(KitTokens.TypeScale.sm))
                            .foregroundStyle(reply.error == nil ? p.warn.color : p.bad.color)
                    }
                    ForEach(reply.models) { m in
                        ModelCard(model: m) { self.model.openDocs(m.name) }
                    }
                } else if model.error == nil, model.hostStatus == .running {
                    ProgressView().controlSize(.small)
                }
            }
            .padding(.horizontal, KitTokens.Space.s7)
            .padding(.vertical, KitTokens.Space.s7)
            .frame(maxWidth: 980, alignment: .leading)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(p.surface.color)
    }
}

private struct ModelCard: View {
    let model: WorkbenchModel
    let open: () -> Void

    private var p: KitPalette { Theme.palette }
    private var color: Color { WorkbenchStyle.slotColor(model.slot) }

    var body: some View {
        WorkbenchCard(tint: color) {
            VStack(alignment: .leading, spacing: KitTokens.Space.s5) {
                HStack(alignment: .firstTextBaseline, spacing: KitTokens.Space.s4) {
                    Text(model.name)
                        .font(WorkbenchStyle.ui(KitTokens.TypeScale.md, weight: .semibold))
                        .foregroundStyle(color)
                    if !model.prefix.isEmpty {
                        Text(model.prefix + "/")
                            .font(WorkbenchStyle.code(KitTokens.TypeScale.xs))
                            .foregroundStyle(p.textMuted.color)
                            .padding(.horizontal, KitTokens.Space.s3)
                            .padding(.vertical, 2)
                            .background(RoundedRectangle(cornerRadius: KitTokens.Radius.sm).fill(p.inset.color))
                    }
                    Spacer(minLength: KitTokens.Space.s4)
                    Button(action: open) {
                        WorkbenchTag(text: "\(model.count) doc\(model.count == 1 ? "" : "s")", color: color)
                    }
                    .buttonStyle(.plain)
                    .help("Open the docs index on \(model.name)")
                }
                if !model.description.isEmpty {
                    Text(model.description)
                        .font(WorkbenchStyle.ui(KitTokens.TypeScale.sm))
                        .foregroundStyle(p.textBody.color)
                        .fixedSize(horizontal: false, vertical: true)
                }
                if !model.fields.isEmpty {
                    VStack(alignment: .leading, spacing: 0) {
                        ForEach(Array(model.fields.enumerated()), id: \.element.id) { index, field in
                            FieldRow(field: field)
                                .background(index % 2 == 1 ? p.inset.color.opacity(0.45) : Color.clear)
                        }
                    }
                    .clipShape(RoundedRectangle(cornerRadius: KitTokens.Radius.md))
                    .overlay(RoundedRectangle(cornerRadius: KitTokens.Radius.md).stroke(p.border.color))
                }
                if !model.sections.isEmpty || !model.relationships.isEmpty {
                    HStack(alignment: .firstTextBaseline, spacing: KitTokens.Space.s4) {
                        if !model.sections.isEmpty {
                            Text("Sections").font(WorkbenchStyle.ui(KitTokens.TypeScale.xs, weight: .semibold)).foregroundStyle(p.textMuted.color)
                            Text(model.sections.joined(separator: ", ")).font(WorkbenchStyle.ui(KitTokens.TypeScale.xs)).foregroundStyle(p.textBody.color)
                        }
                        if !model.relationships.isEmpty {
                            Text("Relationships").font(WorkbenchStyle.ui(KitTokens.TypeScale.xs, weight: .semibold)).foregroundStyle(p.textMuted.color)
                            Text(model.relationships.joined(separator: ", ")).font(WorkbenchStyle.ui(KitTokens.TypeScale.xs)).foregroundStyle(p.textBody.color)
                        }
                    }
                }
            }
        }
    }
}

private struct FieldRow: View {
    let field: WorkbenchModelField

    private var p: KitPalette { Theme.palette }

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: KitTokens.Space.s5) {
            HStack(spacing: 2) {
                Text(field.name)
                    .font(WorkbenchStyle.code(KitTokens.TypeScale.sm, weight: .semibold))
                    .foregroundStyle(WorkbenchStyle.keyColor)
                if field.required {
                    Text("*").font(WorkbenchStyle.code(KitTokens.TypeScale.sm, weight: .bold)).foregroundStyle(p.warn.color)
                        .help("required")
                }
            }
            .frame(width: 150, alignment: .leading)
            WorkbenchTag(text: field.kind == "enum" ? "enum" : field.typeText, color: WorkbenchStyle.fieldColor(field.kind))
                .frame(width: 110, alignment: .leading)
            VStack(alignment: .leading, spacing: KitTokens.Space.s2) {
                if let description = field.description {
                    Text(description)
                        .font(WorkbenchStyle.ui(KitTokens.TypeScale.sm))
                        .foregroundStyle(p.textBody.color)
                        .fixedSize(horizontal: false, vertical: true)
                }
                if !field.options.isEmpty || field.default != nil {
                    HStack(spacing: KitTokens.Space.s3) {
                        ForEach(field.options, id: \.self) { option in
                            Text(option)
                                .font(WorkbenchStyle.code(KitTokens.TypeScale.xs))
                                .foregroundStyle(option == field.default ? p.text.color : WorkbenchStyle.fieldColor("enum"))
                                .padding(.horizontal, KitTokens.Space.s3)
                                .padding(.vertical, 1)
                                .background(Capsule().fill(WorkbenchStyle.fieldColor("enum").opacity(option == field.default ? 0.28 : 0.1)))
                        }
                        if let value = field.default {
                            Text("default").font(WorkbenchStyle.ui(KitTokens.TypeScale.xs)).foregroundStyle(p.textFaint.color)
                            Text(value).font(WorkbenchStyle.code(KitTokens.TypeScale.xs)).foregroundStyle(WorkbenchStyle.fieldColor(field.kind))
                        }
                    }
                }
                if field.description == nil, field.options.isEmpty, field.default == nil {
                    Text(field.required ? "required" : "optional")
                        .font(WorkbenchStyle.ui(KitTokens.TypeScale.xs)).foregroundStyle(p.textFaint.color)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, KitTokens.Space.s5)
        .padding(.vertical, KitTokens.Space.s4)
    }
}
