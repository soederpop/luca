import SwiftUI

/// `luca://<project>/project`: the project's name, folder, Luca version and
/// how many helpers each registry has, from the host's `GET /project`.
/// `r` reloads, `R` restarts the host, `o` (or a click on a row) opens the
/// registry tile.
@MainActor
final class ProjectOverviewContent: WorkbenchContent {
    static let kind = TileKind(id: "luca-project", label: "Project", glyph: "shippingbox") { uri, _ in
        ProjectOverviewContent(uri: uri)
    }

    @Published private(set) var info: WorkbenchProject?
    @Published private(set) var error: String?
    private var loadTask: Task<Void, Never>?

    init(uri: TileURI) {
        super.init(kindId: Self.kind.id, uri: uri, title: ProjectHub.shared.displayName(uri.authority))
    }

    override func makeBody() -> AnyView { AnyView(ProjectOverviewView(model: self)) }

    override func hostChanged(_ client: WorkbenchClient?) {
        loadTask?.cancel()
        guard let client else { return }
        load(client)
    }

    override func perform(_ action: String) -> Bool {
        switch action {
        case "lucaProject.reload":
            if let host { load(host); ProjectToolsStore.shared.refresh(projectId) } else { restartHost() }
            return true
        case "lucaProject.restart":
            restartHost()
            return true
        case "lucaProject.registry":
            openRegistry(stack: nil)
            return true
        default:
            return false
        }
    }

    /// The registry tile, with focus on one registry's stack when given.
    func openRegistry(stack: String?) {
        Shell.shared.openOrFocus(TileURI.luca(project: projectId, tool: "registry",
                                              options: stack.map { [.init(name: "stack", value: $0)] } ?? []))
    }

    private func load(_ client: WorkbenchClient) {
        loadTask?.cancel()
        stateLabel = info == nil ? "loading" : "updating"
        loadTask = Task { [weak self] in
            do {
                let info = try await client.project()
                guard let self, !Task.isCancelled else { return }
                self.info = info
                self.error = nil
                self.title = info.name
                self.stateLabel = "luca \(info.lucaVersion)"
                self.hub.noteName(info.name, for: self.projectId)
            } catch {
                guard let self, !Task.isCancelled else { return }
                self.error = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
                self.stateLabel = "error"
            }
        }
    }
}

struct ProjectOverviewView: View {
    @ObservedObject var model: ProjectOverviewContent
    @ObservedObject private var store = ProjectToolsStore.shared

    private var p: KitPalette { Theme.palette }
    private var color: Color { Theme.ownerColor(model.owner) }

    /// The project's tools, each with its leader key and color.
    private static let tools: [(title: String, detail: String, tool: String, action: String)] = [
        ("Registry", "Features, clients, servers, commands", "registry", "luca.registry"),
        ("Console", "Eval with the container in scope", "console", "luca.console"),
        ("Endpoints", "Routes, luca serve, requests", "endpoints", "luca.endpoints"),
        ("Servers", "Start and stop the registry's servers", "servers", "luca.servers"),
        ("AI", "Providers, keys, local models, agents", "ai", "luca.ai"),
        ("Docs", "Documents by model", "docs", "luca.docs"),
        ("Contentbase", "Define models, query documents", "contentbase", "luca.contentbase"),
        ("Assistants", "Assistants and past chats", "assistants", "luca.assistants"),
        ("Plugins", "Plugins and borrowed helpers", "plugins", "luca.plugins"),
        ("Terminal", "A shell in this folder", "terminal", "luca.terminal"),
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: WorkbenchStyle.Gap.section) {
                WorkbenchHostLine(status: model.hostStatus)
                if let error = model.error {
                    WorkbenchCard(tint: p.bad.color) {
                        Text(error).font(WorkbenchStyle.ui(KitTokens.TypeScale.sm)).foregroundStyle(p.bad.color).lineLimit(3)
                    }
                }
                header
                toolsCard
                declarationErrors
                if let info = model.info {
                    VStack(alignment: .leading, spacing: WorkbenchStyle.Gap.row) {
                        WorkbenchSectionTitle(title: "Registries", note: "\(info.registries.reduce(0) { $0 + $1.count }) helpers")
                        LazyVGrid(columns: [GridItem(.adaptive(minimum: 190), spacing: WorkbenchStyle.Gap.row)], alignment: .leading, spacing: WorkbenchStyle.Gap.row) {
                            ForEach(info.registries) { registry in
                                registryTile(registry, color: WorkbenchStyle.thingColor(registry.name))
                            }
                        }
                    }
                } else if model.hostStatus == .running, model.error == nil {
                    ProgressView().controlSize(.small)
                }
            }
            .padding(.horizontal, WorkbenchStyle.Gap.page)
            .padding(.vertical, WorkbenchStyle.Gap.page)
            .frame(maxWidth: WorkbenchStyle.Size.readable, alignment: .leading)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(p.surface.color)
    }

    private var header: some View {
        HStack(alignment: .center, spacing: WorkbenchStyle.Gap.card) {
            ThingGlyph(symbol: "shippingbox", color: color, size: 52)
            VStack(alignment: .leading, spacing: KitTokens.Space.s3) {
                HStack(alignment: .firstTextBaseline, spacing: KitTokens.Space.s4) {
                    Text(model.info?.name ?? model.project?.label ?? model.projectId)
                        .font(WorkbenchStyle.title)
                        .foregroundStyle(p.text.color)
                    if let version = model.info?.lucaVersion {
                        WorkbenchTag(text: "luca \(version)", color: color)
                    }
                }
                Text(((model.info?.cwd ?? model.project?.path ?? "") as NSString).abbreviatingWithTildeInPath)
                    .font(WorkbenchStyle.code(KitTokens.TypeScale.xs))
                    .foregroundStyle(p.textFaint.color)
                    .lineLimit(1)
                    .truncationMode(.head)
                    .textSelection(.enabled)
            }
            Spacer(minLength: 0)
        }
    }

    private var toolsCard: some View {
        VStack(alignment: .leading, spacing: WorkbenchStyle.Gap.row) {
            WorkbenchSectionTitle(title: "Tools")
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 270), spacing: WorkbenchStyle.Gap.row)], alignment: .leading, spacing: WorkbenchStyle.Gap.row) {
                ForEach(Self.tools, id: \.tool) { tool in
                    let tint = Theme.kindColor("luca-" + tool.tool)
                    Button { Shell.shared.focusOrOpenTool(project: model.projectId, tool: tool.tool) } label: {
                        toolTile(glyph: TileKinds.kind("luca-" + tool.tool)?.glyph ?? "square", tint: tint,
                                 title: tool.title, detail: tool.detail) {
                            BoundKey(action: tool.action)
                        }
                    }
                    .buttonStyle(.plain)
                }
                ForEach(declared) { tool in
                    declaredTile(tool)
                }
            }
            if declared.isEmpty, let notice = store.lists[model.projectId]?.notice {
                Text(notice)
                    .font(WorkbenchStyle.meta)
                    .foregroundStyle(p.textFaint.color)
            }
        }
    }

    /// One tool: its glyph in its color, the name, a short line, and a
    /// trailing slot (its key, or its origin tag).
    private func toolTile<Trailing: View>(glyph: String, tint: Color, title: String, detail: String,
                                          @ViewBuilder trailing: () -> Trailing) -> some View {
        HStack(alignment: .top, spacing: WorkbenchStyle.Gap.row) {
            ThingGlyph(symbol: glyph, color: tint, size: 38)
            VStack(alignment: .leading, spacing: KitTokens.Space.s2) {
                HStack(alignment: .center, spacing: KitTokens.Space.s3) {
                    Text(title)
                        .font(WorkbenchStyle.heading)
                        .foregroundStyle(p.text.color)
                        .lineLimit(1)
                    Spacer(minLength: KitTokens.Space.s2)
                    trailing()
                }
                Text(detail)
                    .font(WorkbenchStyle.meta)
                    .foregroundStyle(p.textMuted.color)
                    .lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(.horizontal, WorkbenchStyle.Gap.row)
        .padding(.vertical, WorkbenchStyle.Gap.row)
        .frame(maxWidth: .infinity, minHeight: 74, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: KitTokens.Radius.lg).fill(p.raised.color.opacity(0.7)))
        .overlay(RoundedRectangle(cornerRadius: KitTokens.Radius.lg).stroke(p.border.color))
        .contentShape(Rectangle())
    }

    private var declared: [WorkbenchToolInfo] { store.tools(model.projectId) }

    /// A tool the project or a plugin declared: the declared mark and its
    /// origin tag, apart from the built-in tools.
    private func declaredTile(_ tool: WorkbenchToolInfo) -> some View {
        let color = WorkbenchStyle.declaredColor(tool.origin.kind)
        return Button { Shell.shared.openTool(tool, project: model.projectId) } label: {
            toolTile(glyph: tool.kind == "page" ? "globe" : (tool.glyph.flatMap { NSImage(systemSymbolName: $0, accessibilityDescription: nil) != nil ? $0 : nil } ?? "diamond"),
                     tint: color, title: tool.title, detail: Self.declaredDetail(tool)) {
                WorkbenchTag(text: tool.origin.kind == "plugin" ? "plugin" : "project", color: color)
                    .lineLimit(1)
                    .fixedSize()
            }
        }
        .buttonStyle(.plain)
    }

    /// The hint (or what it shows), after the plugin's name for a plugin's tool.
    static func declaredDetail(_ tool: WorkbenchToolInfo) -> String {
        let what = tool.hint.isEmpty ? (tool.kind == "page" ? (tool.page ?? "page") : (tool.renderer ?? "view")) : tool.hint
        guard tool.origin.kind == "plugin", let plugin = tool.origin.plugin else { return what }
        return "\(plugin) · \(what)"
    }

    /// Declarations the host could not use, each with its file and reason.
    @ViewBuilder private var declarationErrors: some View {
        let errors = store.lists[model.projectId]?.errors ?? []
        if !errors.isEmpty {
            WorkbenchCard(tint: p.warn.color) {
                VStack(alignment: .leading, spacing: KitTokens.Space.s4) {
                    Text("\(errors.count) tool declaration\(errors.count == 1 ? "" : "s") could not load")
                        .font(WorkbenchStyle.ui(KitTokens.TypeScale.sm, weight: .semibold))
                        .foregroundStyle(p.warn.color)
                    ForEach(errors, id: \.rowId) { error in
                        VStack(alignment: .leading, spacing: 2) {
                            HStack(spacing: KitTokens.Space.s3) {
                                Text(error.fileDisplay + (error.id.map { " · \($0)" } ?? ""))
                                    .font(WorkbenchStyle.code(KitTokens.TypeScale.xs, weight: .semibold))
                                    .foregroundStyle(p.textBody.color)
                                if error.origin.kind == "plugin" {
                                    WorkbenchTag(text: error.origin.tag, color: WorkbenchStyle.declaredColor("plugin"))
                                }
                            }
                            Text(error.error)
                                .font(WorkbenchStyle.ui(KitTokens.TypeScale.xs))
                                .foregroundStyle(p.textMuted.color)
                                .textSelection(.enabled)
                        }
                    }
                }
            }
        }
    }

    private func registryTile(_ registry: WorkbenchProject.Registry, color: Color) -> some View {
        let empty = registry.count == 0
        return Button { model.openRegistry(stack: registry.name) } label: {
            HStack(alignment: .center, spacing: WorkbenchStyle.Gap.row) {
                ThingGlyph(symbol: WorkbenchStyle.thingGlyph(registry.name), color: empty ? p.textFaint.color : color, size: 36)
                VStack(alignment: .leading, spacing: 0) {
                    Text("\(registry.count)")
                        .font(WorkbenchStyle.ui(KitTokens.TypeScale.xxl, weight: .bold).monospacedDigit())
                        .foregroundStyle(empty ? p.textFaint.color : color)
                    Text(registry.name)
                        .font(WorkbenchStyle.meta)
                        .foregroundStyle(p.textMuted.color)
                }
                Spacer(minLength: 0)
            }
            .padding(.horizontal, WorkbenchStyle.Gap.row + KitTokens.Space.s2)
            .padding(.vertical, WorkbenchStyle.Gap.row)
            .background(RoundedRectangle(cornerRadius: KitTokens.Radius.lg).fill(color.opacity(empty ? 0.03 : 0.09)))
            .overlay(RoundedRectangle(cornerRadius: KitTokens.Radius.lg).stroke(color.opacity(empty ? 0.12 : 0.3)))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}
