import SwiftUI
import Combine
import MarkdownUI

/// `luca://<project>/tool/<id>?<params>`: a view tool the project (or a
/// plugin it loads) declares in `workbench/`. The host runs its `data()`
/// and says which renderer draws it: card stacks, the console's value tree,
/// or markdown. The address options are `ctx.params`.
///
/// The tool's declared keys run its actions on the host. An action may ask
/// through the palette (choose, ask, confirm) one step at a time; Esc
/// cancels it. A declared key never takes a key the app or this tile kind
/// already has: the clash is a warning in the tile.
///
/// It is a card-stack index for the `stacks` renderer, so it subclasses
/// `IndexContent` and is in `Keymap.indexKinds`.
@MainActor
final class ToolContent: IndexContent {
    static let kind = TileKind(id: "luca-tool", label: "Project tool", glyph: "wand.and.stars") { uri, _ in
        ToolContent(uri: uri)
    }

    let projectId: String
    var toolId: String { uri.id ?? "" }
    @Published private(set) var reply: WorkbenchToolData?
    @Published private(set) var keys = ToolKeys.Resolved()
    @Published private(set) var hostStatus: HostStatus = .starting
    /// The action that runs now, for the header.
    @Published private(set) var running: String?
    /// The last action's failure, until the next one.
    @Published private(set) var actionError: String?
    private(set) var host: WorkbenchClient?
    private var hostWatch: AnyCancellable?
    /// The token of the action step the palette shows. Answering clears it,
    /// so the palette's end (Esc) only cancels a step no one answered.
    private var pendingToken: String?
    /// Index card id to the host's stack and card, for an action's target.
    private var targets: [String: WorkbenchActionTarget] = [:]
    /// Index card ids that open nothing.
    private var inert: Set<String> = []

    init(uri: TileURI) {
        projectId = uri.authority
        super.init(kindId: Self.kind.id, uri: uri, owner: ProjectHub.ownerId(uri.authority),
                   title: uri.id ?? "tool")
        stateLabel = HostStatus.starting.label
    }

    var renderer: String? { reply?.ok == true ? reply?.renderer : nil }
    override var emptyNote: String { "No cards." }

    override func makeBody() -> AnyView { AnyView(ToolView(model: self)) }

    override var declaredKeys: [DeclaredKey] { keys.keys }

    override func pressDeclared(_ key: DeclaredKey) { runAction(key.action) }

    override func start() {
        hostWatch = WorkbenchHostWatch.watch(projectId) { [weak self] status, client in
            guard let self else { return }
            self.hostStatus = status
            if status != .running { self.stateLabel = status.label }
            guard client !== self.host else { return }
            self.host = client
            if client != nil { self.reload() }
        }
    }

    override func stop() {
        if let token = pendingToken, let host { Task { _ = try? await host.cancelAction(token: token) } }
        pendingToken = nil
        hostWatch = nil
        host = nil
        super.stop()
    }

    override func reload(quiet: Bool = false, then: (() -> Void)? = nil) {
        super.reload(quiet: quiet) { [weak self] in
            self?.loadedLabel()
            then?()
        }
    }

    override func loadStacks() async throws -> [IndexStack] {
        guard let host else { return [] }
        let data = try await host.toolData(toolId, params: uri.options)
        reply = data
        if let title = data.title { self.title = title }
        keys = ToolKeys.resolve(data.keys ?? [], keymap: Shell.shared.keymap.map, kind: kindId)
        Shell.shared.pageKeysTick += 1
        notice = data.notice
        let built = Self.indexStacks(data, project: projectId, fallback: uri)
        targets = built.targets
        inert = built.inert
        return built.stacks
    }

    private func loadedLabel() {
        guard let reply else { return }
        if !reply.ok { stateLabel = "error"; return }
        switch reply.renderer {
        case "stacks": stateLabel = "\(state.shown.reduce(0) { $0 + $1.count }) cards"
        default: stateLabel = reply.renderer
        }
    }

    override func perform(_ action: String) -> Bool {
        // The tree and markdown views scroll with the card keys.
        if renderer != "stacks", ["index.down", "index.up"].contains(action) {
            Shell.shared.focusedTile?.controller?.scroll(.lines(action == "index.down" ? 1 : -1))
            return true
        }
        return super.perform(action)
    }

    override func performKind(_ action: String) -> Bool {
        switch action {
        case "lucaTool.actions": pickAction()
        case "lucaTool.restart": ProjectHub.shared.restart(projectId)
        case "lucaTool.project": Shell.shared.focusOrOpenTool(project: projectId, tool: "project")
        case "lucaTool.source": openSource()
        default: return false
        }
        return true
    }

    override func runCommand(_ verb: String, _ rest: String) -> Bool {
        guard verb == "action" else { return false }
        let name = rest.trimmingCharacters(in: .whitespaces)
        if name.isEmpty { pickAction() } else { runAction(name) }
        return true
    }

    override func openFocused(other: Bool = false) {
        if let card = state.focusedCard, inert.contains(card.id) {
            return Shell.shared.flash(keys.keys.isEmpty ? "This card opens nothing" : "This card opens nothing. Its actions: \(keys.keys.map { "\($0.spec) \($0.label)" }.joined(separator: " · "))")
        }
        super.openFocused(other: other)
    }

    /// The declaration file in a file tile.
    func openSource() {
        guard let file = reply?.fileDisplay ?? reply?.origin?.file else { return }
        if reply?.origin?.kind == "own" { Shell.shared.openOrFocus(FileContent.address(project: projectId, path: file)) }
        else { Shell.shared.flash("Declared in \(file)") }
    }

    // MARK: Actions

    /// `.`: every action of this tool, clashing keys too.
    func pickAction() {
        let all = reply?.keys ?? []
        guard !all.isEmpty else { return Shell.shared.flash("This tool has no actions") }
        PaletteController.shared.choose("\(title): run an action", all.map { key in
            PaletteChoice(title: key.label, detail: "\(key.action) · \(key.key)") { [weak self] in self?.runAction(key.action) }
        })
    }

    func runAction(_ action: String) {
        guard let host else { return Shell.shared.flash("The workbench host is not running") }
        guard let declared = reply?.keys?.first(where: { $0.action == action }) else {
            return Shell.shared.flash("\(title) has no action \(action)")
        }
        let target = renderer == "stacks" ? state.focusedCard.flatMap { targets[$0.id] } : nil
        running = declared.label
        actionError = nil
        Task { [weak self] in
            do {
                let answer = try await host.startAction(tool: self?.toolId ?? "", action: action, params: self?.uri.options ?? [], target: target)
                self?.handle(answer)
            } catch {
                self?.failed(ErrorText.message(error))
            }
        }
    }

    private func failed(_ message: String) {
        running = nil
        pendingToken = nil
        actionError = message
        Shell.shared.flash(message)
    }

    private func handle(_ answer: WorkbenchActionAnswer) {
        guard answer.ok else { return failed(answer.error ?? "The action failed") }
        if answer.done == true || answer.step == nil {
            running = nil
            pendingToken = nil
            guard answer.cancelled != true else { return Shell.shared.flash("Cancelled") }
            let result = answer.result
            if let flash = result?.flash { Shell.shared.flash(flash) }
            if result?.reload ?? true { reload(quiet: true) }
            if let open = result?.open, let uri = Self.address(open, project: projectId) { Shell.shared.openOrFocus(uri) }
            return
        }
        guard let token = answer.token, let step = answer.step else { return }
        pendingToken = token
        switch step.kind {
        case "choose":
            let items = step.items ?? []
            PaletteController.shared.choose(step.title ?? "choose", items.enumerated().map { index, item in
                PaletteChoice(title: item.title, detail: item.detail) { [weak self] in self?.answer(token, .index(index)) }
            })
        case "ask":
            PaletteController.shared.ask(step.title ?? "", initial: step.initial ?? "") { [weak self] text in
                self?.answer(token, .text(text))
            }
        default:
            PaletteController.shared.choose(step.question ?? "Sure?", [
                PaletteChoice(title: "Cancel", detail: "no") { [weak self] in self?.answer(token, .yes(false)) },
                PaletteChoice(title: step.yes ?? "Yes", detail: "") { [weak self] in self?.answer(token, .yes(true)) },
            ])
        }
        // Esc, or an empty answer: cancel on the host. A pick closes the
        // palette before it answers, so this waits one turn.
        Shell.shared.palette.onEnd = { [weak self] in
            DispatchQueue.main.async { self?.cancelIfWaiting(token) }
        }
    }

    private func answer(_ token: String, _ value: WorkbenchStepValue) {
        guard pendingToken == token, let host else { return }
        pendingToken = nil
        Task { [weak self] in
            do { self?.handle(try await host.answerAction(token: token, value: value)) }
            catch { self?.failed(ErrorText.message(error)) }
        }
    }

    private func cancelIfWaiting(_ token: String) {
        guard pendingToken == token, let host else { return }
        pendingToken = nil
        Task { [weak self] in
            let answer = try? await host.cancelAction(token: token)
            self?.handle(answer ?? WorkbenchActionAnswer(ok: true, done: true, cancelled: true))
        }
    }

    // MARK: Pure parts

    /// An address a tool names: `luca://…` as is, else a path in this project.
    nonisolated static func address(_ text: String, project: String) -> TileURI? {
        if text.hasPrefix(TileURI.lucaScheme) { return TileURI(text) }
        var path = text
        while path.hasPrefix("/") { path.removeFirst() }
        return path.isEmpty ? nil : TileURI(TileURI.lucaScheme + project + "/" + path)
    }

    struct Built: Equatable {
        var stacks: [IndexStack] = []
        var targets: [String: WorkbenchActionTarget] = [:]
        var inert: Set<String> = []
    }

    /// The host's stacks as index stacks. Card ids are `<stack>/<card>`, so
    /// they are unique across stacks. A card with no address opens nothing
    /// (`fallback` fills its uri). Pure, so it is tested.
    nonisolated static func indexStacks(_ data: WorkbenchToolData, project: String, fallback: TileURI) -> Built {
        var out = Built()
        guard data.ok, data.renderer == "stacks" else { return out }
        for stack in data.stacks ?? [] {
            var cards: [IndexCard] = []
            for card in stack.cards {
                let id = stack.id + "/" + card.id
                out.targets[id] = WorkbenchActionTarget(stack: stack.id, card: card.id)
                let uri = card.address.flatMap { address($0, project: project) }
                if uri == nil { out.inert.insert(id) }
                cards.append(IndexCard(id: id, title: card.title, subtitle: card.subtitle, preview: card.preview,
                                       badge: card.badge, uri: uri ?? fallback, tone: card.tone))
            }
            out.stacks.append(IndexStack(id: stack.id, title: stack.title, cards: cards, tone: stack.tone))
        }
        return out
    }
}

// MARK: - View

struct ToolView: View {
    @ObservedObject var model: ToolContent

    private var p: KitPalette { Theme.palette }

    var body: some View {
        VStack(spacing: 0) {
            ToolHeader(model: model)
            Rectangle().fill(p.border.color).frame(height: 1)
            content
        }
        .background(p.surface.color)
    }

    @ViewBuilder private var content: some View {
        if let reply = model.reply, !reply.ok {
            ScrollView {
                WorkbenchCard(tint: p.bad.color) {
                    VStack(alignment: .leading, spacing: KitTokens.Space.s3) {
                        Text(reply.title ?? model.toolId).font(WorkbenchStyle.ui(KitTokens.TypeScale.sm, weight: .semibold)).foregroundStyle(p.bad.color)
                        Text(reply.error ?? "failed")
                            .font(WorkbenchStyle.code(KitTokens.TypeScale.sm))
                            .foregroundStyle(p.textBody.color)
                            .textSelection(.enabled)
                        Text("Fix the declaration, then reload.")
                            .font(WorkbenchStyle.ui(KitTokens.TypeScale.xs)).foregroundStyle(p.textMuted.color)
                            .keyBadge("index.reload")
                    }
                }
                .padding(KitTokens.Space.s7)
            }
        } else if let reply = model.reply, reply.renderer == "tree", let tree = reply.tree {
            ScrollView {
                WorkbenchCard(tint: WorkbenchStyle.typeColor) { ConsoleTreeRow(node: tree) }
                    .padding(KitTokens.Space.s7)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        } else if let reply = model.reply, reply.renderer == "markdown", let text = reply.markdown {
            ScrollView {
                WorkbenchCard(tint: nil) {
                    Markdown(text).tilesMarkdown().textSelection(.enabled)
                }
                .padding(KitTokens.Space.s7)
                .frame(maxWidth: 920, alignment: .leading)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        } else {
            IndexView(model: model)
        }
    }
}

/// The tool's name, where it is declared, its hint and its keys.
private struct ToolHeader: View {
    @ObservedObject var model: ToolContent
    @EnvironmentObject private var keymap: KeymapStore

    private var p: KitPalette { Theme.palette }

    var body: some View {
        let origin = model.reply?.origin
        let color = WorkbenchStyle.declaredColor(origin?.kind ?? "own")
        VStack(alignment: .leading, spacing: KitTokens.Space.s4) {
            WorkbenchHostLine(status: model.hostStatus)
            HStack(alignment: .center, spacing: KitTokens.Space.s4) {
                DeclaredMark(color: color)
                VStack(alignment: .leading, spacing: 2) {
                    Text(model.reply?.title ?? model.toolId)
                        .font(WorkbenchStyle.ui(KitTokens.TypeScale.lg, weight: .semibold))
                        .foregroundStyle(p.text.color)
                    if let hint = model.reply?.hint, !hint.isEmpty {
                        Text(hint).font(WorkbenchStyle.ui(KitTokens.TypeScale.xs)).foregroundStyle(p.textMuted.color).lineLimit(2)
                    }
                }
                Spacer(minLength: KitTokens.Space.s4)
                if let running = model.running {
                    HStack(spacing: KitTokens.Space.s3) {
                        ProgressView().controlSize(.small)
                        Text(running).font(WorkbenchStyle.ui(KitTokens.TypeScale.xs)).foregroundStyle(p.info.color)
                    }
                }
                if let origin {
                    VStack(alignment: .trailing, spacing: 2) {
                        WorkbenchTag(text: origin.tag, color: color)
                        if let file = model.reply?.fileDisplay {
                            Text(file).font(WorkbenchStyle.code(KitTokens.TypeScale.xs)).foregroundStyle(p.textFaint.color)
                                .lineLimit(1).truncationMode(.head)
                        }
                    }
                    .keyBadge("lucaTool.source")
                }
            }
            if !model.keys.keys.isEmpty {
                HStack(spacing: KitTokens.Space.s4) {
                    ForEach(model.keys.keys, id: \.action) { key in
                        HStack(spacing: KitTokens.Space.s3) {
                            KeyCap(key.stroke.display(modSymbol: keymap.map.modSymbol))
                            Text(key.label).font(WorkbenchStyle.ui(KitTokens.TypeScale.xs)).foregroundStyle(p.textBody.color)
                        }
                        .padding(.horizontal, KitTokens.Space.s4)
                        .padding(.vertical, KitTokens.Space.s2)
                        .background(Capsule().fill(color.opacity(0.1)))
                    }
                    Spacer(minLength: 0)
                    Text("all actions").font(WorkbenchStyle.ui(KitTokens.TypeScale.xs)).foregroundStyle(p.textFaint.color)
                        .keyBadge("lucaTool.actions")
                }
            }
            ForEach(model.keys.warnings, id: \.self) { warning in
                Label(warning, systemImage: "exclamationmark.triangle.fill")
                    .font(WorkbenchStyle.ui(KitTokens.TypeScale.xs))
                    .foregroundStyle(p.warn.color)
            }
            if let error = model.actionError {
                Label(error, systemImage: "xmark.octagon.fill")
                    .font(WorkbenchStyle.ui(KitTokens.TypeScale.xs))
                    .foregroundStyle(p.bad.color)
                    .textSelection(.enabled)
            }
        }
        .padding(.horizontal, KitTokens.Space.s7)
        .padding(.vertical, KitTokens.Space.s5)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(color.opacity(0.05))
    }
}

/// The mark of a tool a project declared (not built into the app): a
/// small rotated square in its origin's color.
struct DeclaredMark: View {
    let color: Color
    var size: CGFloat = 12

    var body: some View {
        RoundedRectangle(cornerRadius: 2.5)
            .fill(color)
            .frame(width: size, height: size)
            .rotationEffect(.degrees(45))
            .frame(width: size * 1.5, height: size * 1.5)
    }
}
