import SwiftUI
import Combine

/// `app://desktop/projects`: the start tile. Every project folder the app
/// knows (`projects.json`), newest first, with its color, path and host
/// state, and how to open another one. A first launch opens it.
///
/// `j`/`k` move, `Enter` (or a click) goes to the project, `a` asks for a
/// folder to open, `c` opens a chat with lucaPortfolio about all of them.
@MainActor
final class ProjectsContent: TileContent {
    static let kind = TileKind(id: "app-projects", label: "Projects", glyph: "folder") { uri, owner in
        ProjectsContent(uri: uri, owner: owner)
    }

    @Published var selected = 0
    private var watch: AnyCancellable?

    init(uri: TileURI, owner: String) {
        super.init(kindId: Self.kind.id, uri: uri, owner: owner, title: "Projects")
    }

    var projects: [KnownProject] { ProjectHub.shared.recent }

    override func makeBody() -> AnyView { AnyView(ProjectsView(model: self, hub: ProjectHub.shared)) }

    override func start() {
        watch = ProjectHub.shared.$list
            .receive(on: DispatchQueue.main)
            .sink { [weak self] list in
                guard let self else { return }
                self.stateLabel = "\(list.projects.count)"
                self.selected = min(self.selected, max(0, list.projects.count - 1))
            }
    }

    override func stop() { watch = nil }

    func open(_ index: Int) {
        guard projects.indices.contains(index) else { return }
        Shell.shared.goToProject(projects[index].id)
    }

    func askFolder() {
        PaletteController.shared.ask("open a project folder (~/path or /path)") { path in
            Shell.shared.openProject(path: path)
        }
    }

    override func perform(_ action: String) -> Bool {
        switch action {
        case "appProjects.down": selected = min(selected + 1, max(0, projects.count - 1))
        case "appProjects.up": selected = max(selected - 1, 0)
        case "appProjects.open":
            if projects.isEmpty { askFolder() } else { open(selected) }
        case "appProjects.add": askFolder()
        case "appProjects.ask": Shell.shared.openPortfolioChat()
        default: return false
        }
        return true
    }
}

struct ProjectsView: View {
    @ObservedObject var model: ProjectsContent
    @ObservedObject var hub: ProjectHub

    private var p: KitPalette { Theme.palette }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: WorkbenchStyle.Gap.section) {
                HStack(alignment: .center, spacing: WorkbenchStyle.Gap.card) {
                    ThingGlyph(symbol: "folder", color: Theme.kindColor("app-projects"), size: 52)
                    Text("Projects")
                        .font(WorkbenchStyle.title)
                        .foregroundStyle(p.text.color)
                    if !model.projects.isEmpty { CountPill(count: model.projects.count, color: Theme.kindColor("app-projects")) }
                    Spacer(minLength: 0)
                }
                portfolioCard
                if !model.projects.isEmpty {
                    VStack(alignment: .leading, spacing: WorkbenchStyle.Gap.row) {
                        ForEach(Array(model.projects.enumerated()), id: \.element.id) { index, project in
                            row(project, selected: index == model.selected)
                                .onTapGesture { model.selected = index; model.open(index) }
                        }
                    }
                }
                openCard
            }
            .padding(.horizontal, WorkbenchStyle.Gap.page)
            .padding(.vertical, WorkbenchStyle.Gap.page)
            .frame(maxWidth: 820, alignment: .leading)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(p.surface.color)
    }

    /// The way into lucaPortfolio, which knows every project on this Mac.
    private var portfolioCard: some View {
        let tone = WorkbenchStyle.thingColor("assistants")
        return WorkbenchCard(tint: tone) {
            HStack(alignment: .center, spacing: WorkbenchStyle.Gap.card) {
                ThingGlyph(symbol: "sparkle.magnifyingglass", color: tone, size: 40)
                VStack(alignment: .leading, spacing: KitTokens.Space.s2) {
                    Text("Ask about your projects")
                        .font(WorkbenchStyle.heading)
                        .foregroundStyle(p.text.color)
                    Text(PortfolioProject.assistant)
                        .font(WorkbenchStyle.code(KitTokens.TypeScale.xs))
                        .foregroundStyle(tone)
                }
                Spacer(minLength: KitTokens.Space.s4)
                Button { Shell.shared.openPortfolioChat() } label: {
                    Text("Chat")
                        .font(WorkbenchStyle.ui(KitTokens.TypeScale.sm, weight: .semibold))
                        .foregroundStyle(p.accentOn.color)
                        .padding(.horizontal, KitTokens.Space.s5)
                        .padding(.vertical, KitTokens.Space.s3)
                        .background(Capsule().fill(tone))
                }
                .buttonStyle(.plain)
                BoundKey(action: "appProjects.ask")
            }
        }
    }

    /// How to open a folder: the command, the keys, and a button.
    private var openCard: some View {
        WorkbenchCard {
            VStack(alignment: .leading, spacing: WorkbenchStyle.Gap.row) {
                Text(model.projects.isEmpty ? "Open a project" : "Open another project")
                    .font(WorkbenchStyle.heading)
                    .foregroundStyle(p.text.color)
                HStack(alignment: .firstTextBaseline, spacing: KitTokens.Space.s3) {
                    Text(":open-project ~/path/to/folder")
                        .font(WorkbenchStyle.code(KitTokens.TypeScale.sm, weight: .semibold))
                        .foregroundStyle(WorkbenchStyle.inputColor)
                        .padding(.horizontal, KitTokens.Space.s3)
                        .padding(.vertical, 2)
                        .background(RoundedRectangle(cornerRadius: KitTokens.Radius.sm).fill(p.inset.color))
                        .textSelection(.enabled)
                }
                HStack(spacing: WorkbenchStyle.Gap.card) {
                    Button { model.askFolder() } label: {
                        Text("Open a folder…")
                            .font(WorkbenchStyle.ui(KitTokens.TypeScale.sm, weight: .semibold))
                            .foregroundStyle(p.accentOn.color)
                            .padding(.horizontal, KitTokens.Space.s5)
                            .padding(.vertical, KitTokens.Space.s3)
                            .background(Capsule().fill(p.accent.color))
                    }
                    .buttonStyle(.plain)
                    BoundKey(action: "appProjects.add")
                    HStack(spacing: KitTokens.Space.s3) {
                        BoundKey(action: "palette.projects")
                        Text("pick a known project").font(WorkbenchStyle.meta).foregroundStyle(p.textMuted.color)
                    }
                }
            }
        }
    }

    private func row(_ project: KnownProject, selected: Bool) -> some View {
        let color = Theme.ownerColor(ProjectHub.ownerId(project.id))
        let status = hub.status[project.id]
        return HStack(alignment: .center, spacing: WorkbenchStyle.Gap.card) {
            ThingGlyph(symbol: "shippingbox", color: color, size: 40)
            VStack(alignment: .leading, spacing: KitTokens.Space.s2) {
                Text(project.label)
                    .font(WorkbenchStyle.ui(KitTokens.TypeScale.lg, weight: .semibold))
                    .foregroundStyle(p.text.color)
                Text(project.place)
                    .font(WorkbenchStyle.code(KitTokens.TypeScale.xs))
                    .foregroundStyle(p.textFaint.color)
                    .lineLimit(1).truncationMode(.head)
            }
            Spacer(minLength: KitTokens.Space.s4)
            if let status, status != .stopped {
                WorkbenchTag(text: "host \(status.label)", color: status == .running ? p.good.color : (status == .starting ? p.info.color : p.bad.color))
            }
            if let opened = project.lastOpened {
                Text(opened.formatted(.relative(presentation: .named)))
                    .font(WorkbenchStyle.ui(KitTokens.TypeScale.xs))
                    .foregroundStyle(p.textFaint.color)
            }
        }
        .padding(.horizontal, WorkbenchStyle.Gap.card)
        .padding(.vertical, WorkbenchStyle.Gap.row + KitTokens.Space.s2)
        .background(RoundedRectangle(cornerRadius: KitTokens.Radius.lg).fill(selected ? color.opacity(0.12) : p.raised.color.opacity(0.7)))
        .overlay(RoundedRectangle(cornerRadius: KitTokens.Radius.lg).stroke(selected ? color.opacity(0.7) : p.border.color, lineWidth: selected ? 1.5 : 1))
        .contentShape(Rectangle())
    }
}
