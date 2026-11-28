import SwiftUI
import Combine

/// `luca://<project>/registry`: one card stack per registry the host reports
/// (`GET /registries`), project helpers first. `Enter` opens a card's
/// `helper` tile. `?stack=<registry>` puts focus on that stack at load.
///
/// It is a card-stack index, so it subclasses `IndexContent` and watches its
/// host with `WorkbenchHostWatch`.
@MainActor
final class RegistryContent: IndexContent {
    static let kind = TileKind(id: "luca-registry", label: "Registry", glyph: "square.grid.3x3") { uri, _ in
        RegistryContent(uri: uri)
    }

    let projectId: String
    private(set) var host: WorkbenchClient?
    private var hostWatch: AnyCancellable?
    private var focusedStackOnce = false
    /// Each card's helper and origin, by card id, for `take into…`.
    private(set) var sources: [String: TakeSource] = [:]

    init(uri: TileURI) {
        projectId = uri.authority
        super.init(kindId: Self.kind.id, uri: uri, owner: ProjectHub.ownerId(uri.authority),
                   title: "\(ProjectHub.shared.displayName(uri.authority)) registry")
        stateLabel = HostStatus.starting.label
    }

    override var emptyNote: String { "This project has no helpers." }

    /// Where a helper comes from, the project's own first.
    override var groupOrder: [(id: String, label: String)] {
        [("own", "This project"), ("borrowed", "Borrowed"), ("plugin", "Plugins"), ("home", "~/.luca"), ("builtin", "Built in")]
    }

    /// Watch the project's host: load when a host comes up.
    override func start() {
        hostWatch = WorkbenchHostWatch.watch(projectId) { [weak self] status, client in
            guard let self else { return }
            if case .failed(let line) = status { self.notice = line } else { self.notice = nil }
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
        let reply = try await host.registries()
        sources = Self.takeSources(reply, project: projectId)
        return Self.indexStacks(reply, project: projectId)
    }

    /// The focused card's helper, for `t` and `:take`.
    var focusedSource: TakeSource? { state.focusedCard.flatMap { sources[$0.id] } }

    override func runCommand(_ verb: String, _ rest: String) -> Bool {
        switch verb {
        case "take":
            Shell.shared.takeCommand(focusedSource, rest)
        case "only":
            // `:only own`, `:only plugin`; `:only` or `:only all` shows every helper.
            let word = rest.trimmingCharacters(in: .whitespaces).lowercased()
            let names = ["": nil, "all": nil, "own": "own", "project": "own", "local": "own", "borrowed": "borrowed",
                         "plugin": "plugin", "plugins": "plugin", "home": "home", "builtin": "builtin", "built-in": "builtin"] as [String: String?]
            guard let group = names[word] else { Shell.shared.flash("Usage: only own | borrowed | plugin | home | builtin | all"); return true }
            setGroup(group)
        default: return false
        }
        return true
    }

    override func performKind(_ action: String) -> Bool {
        switch action {
        case "lucaRegistry.restart":
            ProjectHub.shared.restart(projectId)
            return true
        case "lucaRegistry.take":
            guard let source = focusedSource else { Shell.shared.flash("No helper in focus"); return true }
            Shell.shared.takeInto(source)
            return true
        case "lucaRegistry.own":
            let here = state.groups(order: groupOrder).map(\.id)
            setGroup(Self.nextOwnGroup(after: state.group, available: here))
            return true
        case "lucaRegistry.origin":
            cycleGroup()
            return true
        case "lucaRegistry.servers":
            Shell.shared.focusOrOpenTool(project: projectId, tool: "servers")
            return true
        case "lucaRegistry.plugins":
            Shell.shared.focusOrOpenTool(project: projectId, tool: "plugins")
            return true
        default:
            return false
        }
    }

    private func focusAskedStack() {
        guard !focusedStackOnce else { return }
        focusedStackOnce = true
        // `?origin=own` opens it on this project's helpers only.
        if let origin = uri.option("origin"), state.groups(order: groupOrder).contains(where: { $0.id == origin }) { state.group = origin }
        guard let stack = uri.option("stack"),
              let first = state.shown.first(where: { $0.id == stack })?.cards.first else { return }
        state.focus(cardId: first.id)
    }

    /// The host's stacks as index stacks. A card opens the tile its
    /// What `o` shows next: this project, then plugins, then every helper.
    /// A group with no helpers here is skipped. From any other group
    /// (`O` put it on built in, say) it goes back to this project.
    nonisolated static func nextOwnGroup(after now: String?, available: [String]) -> String? {
        let cycle: [String?] = ["own", "plugin", nil].filter { $0 == nil || available.contains($0!) }
        guard let index = cycle.firstIndex(where: { $0 == now }) else { return cycle[0] }
        return cycle[(index + 1) % cycle.count]
    }

    /// `address` names under this project. Pure, so it is tested.
    nonisolated static func indexStacks(_ reply: WorkbenchStacks, project: String) -> [IndexStack] {
        reply.stacks.map { stack in
            IndexStack(id: stack.id, title: stack.title, cards: stack.cards.compactMap { card in
                guard let uri = TileURI(TileURI.lucaScheme + project + "/" + card.address) else { return nil }
                // The origin's tag, in its color, when the host sends one.
                return IndexCard(id: card.id, title: card.title,
                                 subtitle: card.subtitle.isEmpty ? nil : card.subtitle,
                                 preview: card.preview.isEmpty ? nil : card.preview,
                                 badge: card.origin?.tag ?? card.badge, uri: uri,
                                 badgeTone: card.origin?.kind, group: card.origin?.kind)
            }, tone: "kind:\(stack.id)")
        }
    }

    /// Card id to the helper it shows and where it comes from. A card id is
    /// `<registry>.<id>`. Pure, so it is tested.
    nonisolated static func takeSources(_ reply: WorkbenchStacks, project: String) -> [String: TakeSource] {
        var out: [String: TakeSource] = [:]
        for stack in reply.stacks {
            for card in stack.cards {
                let prefix = stack.id + "."
                let id = card.id.hasPrefix(prefix) ? String(card.id.dropFirst(prefix.count)) : card.title
                out[card.id] = TakeSource(project: project, registry: stack.id, id: id, origin: card.origin)
            }
        }
        return out
    }
}
