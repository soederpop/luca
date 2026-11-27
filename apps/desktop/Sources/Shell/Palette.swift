import AppKit
import SwiftUI

/// One row in the palette.
struct PaletteItem: Identifiable {
    enum Group: String { case open = "open", command = "command", choice = "pick", project = "project", tool = "tool", declared = "own tool" }
    let id: String
    let group: Group
    let title: String
    var detail: String = ""
    var keys: String?
    /// The tile kind this row opens (`luca-docs`), for its glyph and hue.
    var kind: String? = nil
    let run: @MainActor () -> Void

    /// The row's glyph: its kind's, else one per group.
    @MainActor var glyph: String {
        if let kind, let g = TileKinds.kind(kind)?.glyph { return g }
        switch group {
        case .project: return "shippingbox"
        case .command: return "command"
        case .declared: return "diamond"
        case .choice: return "chevron.right"
        default: return "square"
        }
    }

    /// The row's hue: its kind's, else the group's.
    @MainActor var tint: Color {
        if let kind, group != .declared { return Theme.kindColor(kind) }
        return groupColor
    }

    /// The group word's color: a kind's hue for things that open as a tile.
    @MainActor var groupColor: Color {
        switch group {
        case .open: return Theme.palette.accent.color
        case .project: return Theme.kindColor("luca-project")
        case .tool: return Theme.kindColor("luca-registry")
        case .declared: return Theme.kindColor("luca-tool")
        case .command, .choice: return Color.kitFaint
        }
    }
}

/// One row a tile offers through the palette: a move, a yes or no.
struct PaletteChoice {
    let title: String
    var detail: String = ""
    let run: @MainActor () -> Void
}

/// The palette (`Space Space`), the project list (`Space p`) and the command
/// line (`:`). One panel; the mode picks what it lists.
@MainActor
final class PaletteModel: ObservableObject {
    /// `choose` lists a tile's own choices; `ask` takes one line of text.
    enum Mode: Equatable { case all, projects, command, choose, ask }

    @Published var mode: Mode = .all
    @Published var query = "" { didSet { queryChanged() } }
    @Published private(set) var items: [PaletteItem] = []
    @Published var selected = 0
    @Published private(set) var note: String?
    /// The prompt for `choose` and `ask`.
    @Published private(set) var customTitle = ""
    private var choices: [PaletteChoice] = []
    private var onAnswer: ((String) -> Void)?
    /// The `ask` line is a secret (an API key): drawn as dots.
    @Published private(set) var secret = false
    /// Called once when this use of the palette is over, picked or not.
    /// A page's request uses it to hear about Esc.
    var onEnd: (() -> Void)?

    /// One line, no list: the command line and `ask`.
    var isLineOnly: Bool { mode == .command || mode == .ask }

    var placeholder: String {
        switch mode {
        case .all: return "tiles, project tools, commands"
        case .projects: return "open a project"
        case .command: return "command: open-project <path or host:path> · file <path> · page <path or URL> · canvas <name> · chat [assistant] · terminal · layout · mode · ws <n> · keys · q"
        case .choose, .ask: return customTitle
        }
    }

    var prompt: String {
        switch mode {
        case .command: return ":"
        case .ask: return "?"
        default: return "›"
        }
    }

    func begin(_ mode: Mode) {
        finish()
        secret = false
        // Fetched again each time: an assistant added since should complete.
        assistantNames = [:]
        self.mode = mode
        query = ""
        selected = 0
        note = nil
        rebuild()
    }

    func beginChoose(_ title: String, _ items: [PaletteChoice]) {
        customTitle = title
        choices = items
        onAnswer = nil
        begin(.choose)
    }

    func beginAsk(_ title: String, initial: String, secret: Bool = false, onAnswer: @escaping (String) -> Void) {
        customTitle = title
        choices = []
        self.onAnswer = onAnswer
        begin(.ask)
        self.secret = secret
        query = initial
    }

    private func finish() {
        let done = onEnd
        onEnd = nil
        done?()
    }

    func end() {
        finish()
    }

    private func queryChanged() {
        if !completing { completion = nil }
        if mode == .command, Self.chatVerbs.contains(commandVerb) { loadAssistants() }
        rebuild()
    }

    // MARK: Command-line completion

    /// Verbs whose argument is an assistant name.
    static let chatVerbs: Set<String> = ["chat", "assistant"]
    /// Assistant names by project, fetched once the verb is typed.
    private var assistantNames: [String: [String]] = [:]
    private var loadingAssistants: Set<String> = []
    /// The Tab cycle in progress: what was typed and the matches for it.
    private var completion: (stem: String, matches: [String], index: Int)?
    /// True while a completion writes `query`, so it is not reset.
    private var completing = false

    private var commandVerb: String {
        String(query.drop { $0 == " " }.prefix { $0 != " " })
    }

    /// The argument of the command line, when the verb takes an assistant.
    private var chatArgument: String? {
        let line = query.drop { $0 == " " }
        guard Self.chatVerbs.contains(commandVerb), let space = line.firstIndex(of: " ") else { return nil }
        return String(line[line.index(after: space)...]).trimmingCharacters(in: .whitespaces)
    }

    private func loadAssistants(then: (() -> Void)? = nil) {
        guard let project = Shell.shared.impliedProject, assistantNames[project] == nil,
              !loadingAssistants.contains(project), let host = ProjectHub.shared.client(project) else { return }
        loadingAssistants.insert(project)
        Task { @MainActor [weak self] in
            defer { self?.loadingAssistants.remove(project) }
            guard let reply = try? await host.assistants() else { return }
            self?.assistantNames[project] = reply.assistants.map(\.name)
            then?()
        }
    }

    /// Tab on `:chat <name>`: completes the name from the project's
    /// assistants, cycling through the matches. True when the line is one
    /// that completes, whether or not a name was found.
    func complete(reverse: Bool) -> Bool {
        guard mode == .command else { return false }
        guard Self.chatVerbs.contains(commandVerb) else { return false }
        let verb = commandVerb
        guard let project = Shell.shared.impliedProject else {
            Shell.shared.flash("Open a project first, then Tab completes its assistants")
            return true
        }
        guard let names = assistantNames[project] else {
            if ProjectHub.shared.client(project) == nil { Shell.shared.flash("The project's host is starting; try Tab again") }
            loadAssistants { [weak self] in _ = self?.complete(reverse: reverse) }
            return true
        }
        let typed = chatArgument ?? ""
        if var cycle = completion, cycle.matches.indices.contains(cycle.index), typed == cycle.matches[cycle.index] {
            cycle.index = (cycle.index + (reverse ? -1 : 1) + cycle.matches.count) % cycle.matches.count
            completion = cycle
            setLine(verb: verb, argument: cycle.matches[cycle.index])
            return true
        }
        let matches = names.filter { $0.lowercased().hasPrefix(typed.lowercased()) }
        guard !matches.isEmpty else {
            Shell.shared.flash(names.isEmpty ? "No assistants in this project" : "No assistant starts with '\(typed)'. Assistants: " + names.joined(separator: ", "))
            return true
        }
        completion = (stem: typed, matches: matches, index: 0)
        if matches.count > 1 { Shell.shared.flash("Tab cycles: " + matches.joined(separator: ", ")) }
        setLine(verb: verb, argument: matches[0])
        return true
    }

    private func setLine(verb: String, argument: String) {
        completing = true
        query = verb + " " + argument
        completing = false
    }

    // MARK: Items

    /// Every tool a project has, as palette rows: title, detail, tool.
    static let projectTools: [(title: String, detail: String, tool: String)] = [
        ("registry", "features, clients, servers, commands…", "registry"),
        ("console", "eval with the container in scope", "console"),
        ("plugins", "plugins it loads, borrowed folders", "plugins"),
        ("endpoints", "routes in endpoints/, luca serve, send a request", "endpoints"),
        ("servers", "start and stop the servers of the registry", "servers"),
        ("ai", "model providers, API keys, local models, coding agents", "ai"),
        ("docs", "its contentbase documents, by model", "docs"),
        ("doc models", "each model, its prefix and fields", "models"),
        ("contentbase", "define models (fields, sections, template) and query documents", "contentbase"),
        ("assistants", "its assistants and past conversations", "assistants"),
        ("terminal", "a shell in the project folder", "terminal"),
    ]

    private func rebuild() {
        let shell = Shell.shared
        var all: [PaletteItem] = []

        if mode == .all {
            for tile in shell.tiles.values {
                let ws = shell.workspaceIndex(of: tile.id).map { $0 + 1 } ?? 0
                all.append(PaletteItem(id: "open:\(tile.id)", group: .open, title: tile.content.title,
                                       detail: "\(Shell.ownerName(tile.owner)) · ws \(ws)", kind: tile.content.kindId) { shell.focusTile(tile.id) })
            }
        }
        if mode == .all || mode == .projects {
            for project in ProjectHub.shared.recent {
                all.append(PaletteItem(id: "project:\(project.id)", group: .project, title: project.label, detail: project.place, kind: "luca-project") {
                    shell.goToProject(project.id)
                })
                guard mode == .all else { continue }
                for tool in Self.projectTools {
                    all.append(PaletteItem(id: "\(tool.tool):\(project.id)", group: .tool, title: "\(project.label) \(tool.title)", detail: tool.detail, kind: "luca-" + tool.tool) {
                        shell.focusOrOpenTool(project: project.id, tool: tool.tool)
                    })
                }
                // The project's own tools, as the host last listed them.
                for tool in ProjectToolsStore.shared.tools(project.id) {
                    all.append(PaletteItem(id: "own:\(project.id):\(tool.id)", group: .declared, title: "\(project.label) \(tool.title)",
                                           detail: Shell.toolDetail(tool), kind: "luca-tool") {
                        shell.openTool(tool, project: project.id)
                    })
                }
                all.append(PaletteItem(id: "command:\(project.id)", group: .tool, title: "\(project.label) run a command…",
                                       detail: "pick one of its commands", kind: "luca-command") {
                    shell.pickCommand(in: project.id)
                })
                all.append(PaletteItem(id: "chat:\(project.id)", group: .tool, title: "\(project.label) new chat…",
                                       detail: "pick one of its assistants", kind: "luca-chat") {
                    WorkbenchChat.pickAssistant(project: project.id)
                })
                all.append(PaletteItem(id: "file:\(project.id)", group: .tool, title: "\(project.label) open a file…",
                                       detail: "a file in its folder", kind: "luca-file") {
                    shell.pickFile(in: project.id)
                })
            }
            if mode == .projects, all.isEmpty { note = "No projects yet. Open one with :open-project <path>" }
        }
        if mode == .all {
            let map = shell.keymap.map
            for binding in map.bindings where binding.isBound && !binding.action.hasPrefix("resize.") && !binding.action.hasPrefix("workspace.send.") {
                all.append(PaletteItem(id: "cmd:\(binding.action)", group: .command, title: binding.label,
                                       detail: binding.action, keys: binding.display(modSymbol: map.modSymbol)) {
                    shell.perform(binding.action, count: nil)
                })
            }
        }
        if mode == .choose {
            all = choices.enumerated().map { index, choice in
                PaletteItem(id: "choice:\(index)", group: .choice, title: choice.title, detail: choice.detail, run: choice.run)
            }
        }
        if isLineOnly {
            items = []
            return
        }
        items = Self.fuzzy(all, query: query)
        selected = min(selected, max(0, items.count - 1))
    }

    /// Subsequence match. Earlier, tighter and word-start matches rank higher.
    static func fuzzy(_ items: [PaletteItem], query: String) -> [PaletteItem] {
        let q = query.lowercased().filter { !$0.isWhitespace }
        guard !q.isEmpty else { return Array(items.prefix(200)) }
        let scored: [(PaletteItem, Int)] = items.compactMap { item in
            let title = score(q, in: item.title.lowercased())
            let detail = score(q, in: item.detail.lowercased()).map { $0 - 30 }
            guard let best = [title, detail].compactMap({ $0 }).max() else { return nil }
            return (item, best)
        }
        return scored.sorted { $0.1 > $1.1 }.prefix(200).map(\.0)
    }

    static func score(_ query: String, in text: String) -> Int? {
        var score = 0
        var index = text.startIndex
        var last: String.Index?
        for c in query {
            guard let found = text[index...].firstIndex(of: c) else { return nil }
            if found == text.startIndex || " /-_.".contains(text[text.index(before: found)]) { score += 8 }
            if let last, text.index(after: last) == found { score += 5 }
            score -= text.distance(from: index, to: found)
            last = found
            index = text.index(after: found)
        }
        return score + 100 - text.count / 4
    }

    func move(_ step: Int) {
        guard !items.isEmpty else { return }
        selected = (selected + step + items.count) % items.count
    }

    /// Enter. True when the palette should close.
    func accept() -> Bool {
        if mode == .command {
            let line = query
            PaletteController.shared.hide()
            Shell.shared.runCommand(line)
            return false
        }
        if mode == .ask {
            let line = query.trimmingCharacters(in: .whitespacesAndNewlines)
            let answer = onAnswer
            onAnswer = nil
            PaletteController.shared.hide()
            if !line.isEmpty { answer?(line) }
            return false
        }
        guard items.indices.contains(selected) else { return false }
        let item = items[selected]
        if mode == .choose {
            // Close first: a choice may open the palette again (a comment).
            PaletteController.shared.hide()
            item.run()
            return false
        }
        PaletteController.shared.keepOpen = false
        item.run()
        return !PaletteController.shared.keepOpen
    }
}

@MainActor
final class PaletteController {
    static let shared = PaletteController()
    private lazy var panel = ShellPanel(keyable: true, level: .modalPanel) { PaletteView(model: Shell.shared.palette) }
    private(set) var isActive = false
    /// Set by an item that keeps the palette open instead of closing it.
    var keepOpen = false

    func show(_ mode: PaletteModel.Mode) {
        Shell.shared.palette.begin(mode)
        present()
    }

    /// A tile's own list: moves, a confirm. Enter runs the row; Esc does nothing.
    func choose(_ title: String, _ items: [PaletteChoice]) {
        Shell.shared.palette.beginChoose(title, items)
        present()
    }

    /// One line of text: a path, a method's arguments. Empty or Esc does nothing.
    func ask(_ title: String, initial: String = "", secret: Bool = false, onAnswer: @escaping (String) -> Void) {
        Shell.shared.palette.beginAsk(title, initial: initial, secret: secret, onAnswer: onAnswer)
        present()
    }

    /// Yes or no. The safe answer is first, so a stray Enter does nothing.
    func confirm(_ question: String, yes: String, run: @escaping @MainActor () -> Void) {
        choose(question, [PaletteChoice(title: "Cancel", detail: "do nothing") {}, PaletteChoice(title: yes, detail: "") { run() }])
    }

    private func present() {
        let model = Shell.shared.palette
        let mode = model.mode
        guard let screen = NSScreen.screens.first else { return }
        let height: CGFloat = model.isLineOnly ? 76 : (mode == .choose ? 400 : 660)
        let width: CGFloat = 920
        let frame = CGRect(x: screen.visibleFrame.midX - width / 2, y: screen.visibleFrame.maxY - height - screen.visibleFrame.height * 0.18, width: width, height: height)
        panel.setFrame(frame, display: true)
        isActive = true
        Shell.shared.setMode(.command)
        AppFocus.activate()
        panel.makeKeyAndOrderFront(nil)
    }

    func hide() {
        guard isActive else { return }
        isActive = false
        Shell.shared.palette.end()
        panel.orderOut(nil)
        Shell.shared.setMode(.normal)
        // The tile in focus: the one from before, or the one an item opened.
        if let tile = Shell.shared.focusedTile { tile.controller?.window.makeKeyAndOrderFront(nil) }
        else { StatusLineController.shared.takeKeyIfIdle() }
    }

    /// Keys the palette takes before its text field does.
    func handle(_ stroke: KeyStroke) -> Bool {
        let model = Shell.shared.palette
        let plain = !stroke.mod && !stroke.cmd && !stroke.alt
        switch (stroke.key, stroke.ctrl, plain) {
        case ("Esc", _, _): hide(); return true
        case ("Enter", false, true):
            if model.accept() { hide() }
            return true
        case ("Down", false, _), ("n", true, _), ("j", true, _): model.move(1); return true
        case ("Up", false, _), ("p", true, _), ("k", true, _): model.move(-1); return true
        case ("Tab", false, true):
            if model.complete(reverse: stroke.shift) { return true }
            model.move(stroke.shift ? -1 : 1); return true
        default: return false
        }
    }
}

struct PaletteView: View {
    @ObservedObject var model: PaletteModel
    @FocusState private var fieldFocused: Bool

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: KitTokens.Space.s4) {
                Text(model.prompt)
                    .font(Theme.chrome(KitTokens.TypeScale.lg, weight: .bold))
                    .foregroundStyle(Theme.palette.accent.color)
                if model.secret {
                    SecureField(model.placeholder, text: $model.query)
                        .textFieldStyle(.plain)
                        .font(Theme.chrome(KitTokens.TypeScale.lg))
                        .foregroundStyle(Theme.palette.text.color)
                        .focused($fieldFocused)
                } else {
                    TextField(model.placeholder, text: $model.query)
                        .textFieldStyle(.plain)
                        .font(model.isLineOnly ? Theme.chrome(KitTokens.TypeScale.lg) : WorkbenchStyle.ui(KitTokens.TypeScale.lg))
                        .foregroundStyle(Theme.palette.text.color)
                        .focused($fieldFocused)
                }
            }
            .padding(.horizontal, KitTokens.Space.s6)
            .frame(height: 60)

            if !model.isLineOnly {
                Rectangle().fill(Theme.palette.border.color).frame(height: 1)
                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(alignment: .leading, spacing: 0) {
                            ForEach(Array(model.items.enumerated()), id: \.element.id) { index, item in
                                groupHeader(index)
                                row(item, selected: index == model.selected)
                                    .id(item.id)
                                    .onTapGesture {
                                        model.selected = index
                                        if model.accept() { PaletteController.shared.hide() }
                                    }
                            }
                            if model.items.isEmpty {
                                Text(model.note ?? "Nothing matches")
                                    .font(WorkbenchStyle.body)
                                    .foregroundStyle(Color.kitFaint)
                                    .padding(KitTokens.Space.s6)
                            }
                        }
                        .padding(.vertical, KitTokens.Space.s3)
                    }
                    .onChange(of: model.selected) { _, index in
                        if model.items.indices.contains(index) { proxy.scrollTo(model.items[index].id) }
                    }
                }
            }
        }
        // Fill the panel: the hosting view limits the window to the content's
        // size, so a list that was a line a moment ago would stay a line.
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(RoundedRectangle(cornerRadius: KitTokens.Radius.lg).fill(Theme.palette.surface.color))
        .overlay(RoundedRectangle(cornerRadius: KitTokens.Radius.lg).stroke(Theme.palette.borderStrong.color))
        .clipShape(RoundedRectangle(cornerRadius: KitTokens.Radius.lg))
        .onAppear { fieldFocused = true }
        .onChange(of: model.mode) { _, _ in fieldFocused = true }
        .onReceive(NotificationCenter.default.publisher(for: NSWindow.didBecomeKeyNotification)) { _ in fieldFocused = true }
    }

    private func row(_ item: PaletteItem, selected: Bool) -> some View {
        let p = Theme.palette
        return HStack(spacing: KitTokens.Space.s5) {
            if model.mode == .choose || model.mode == .projects && item.group != .project {
                Circle().fill(selected ? p.accent.color : p.textFaint.color.opacity(0.6)).frame(width: 7, height: 7)
                    .frame(width: 28)
            } else {
                ThingGlyph(symbol: item.glyph, color: item.tint, size: 28)
            }
            Text(item.title)
                .font(WorkbenchStyle.ui(KitTokens.TypeScale.sm, weight: selected ? .semibold : .medium))
                .foregroundStyle(selected ? p.text.color : p.textBody.color)
                .lineLimit(1)
                .layoutPriority(1)
            Text(item.detail)
                .font(item.group == .project || item.group == .command ? WorkbenchStyle.code(KitTokens.TypeScale.xs) : WorkbenchStyle.meta)
                .foregroundStyle(p.textFaint.color)
                .lineLimit(1)
                .truncationMode(item.group == .project ? .head : .tail)
            Spacer(minLength: KitTokens.Space.s4)
            if model.mode == .all, item.group != .choice {
                Text(item.group.rawValue)
                    .font(WorkbenchStyle.caption(weight: .medium))
                    .foregroundStyle(item.groupColor.opacity(0.9))
            }
            if let keys = item.keys { KeyCap(keys, small: true) }
        }
        .padding(.horizontal, KitTokens.Space.s5)
        .frame(height: 50)
        .background(
            RoundedRectangle(cornerRadius: KitTokens.Radius.md)
                .fill(selected ? p.accentSoft.color : Color.clear)
        )
        .overlay(alignment: .leading) {
            if selected {
                RoundedRectangle(cornerRadius: 2).fill(p.accent.color).frame(width: 3, height: 26)
            }
        }
        .padding(.horizontal, KitTokens.Space.s3)
        .contentShape(Rectangle())
    }

    /// A group label above the first row of each group, while nothing is typed.
    @ViewBuilder private func groupHeader(_ index: Int) -> some View {
        let items = model.items
        if model.mode == .all, model.query.isEmpty, items.indices.contains(index),
           index == 0 || items[index - 1].group != items[index].group {
            Text(Self.groupTitle(items[index].group))
                .font(WorkbenchStyle.caption())
                .foregroundStyle(Theme.palette.textFaint.color)
                .padding(.horizontal, KitTokens.Space.s6 + KitTokens.Space.s2)
                .padding(.top, index == 0 ? KitTokens.Space.s4 : KitTokens.Space.s6)
                .padding(.bottom, KitTokens.Space.s2)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private static func groupTitle(_ group: PaletteItem.Group) -> String {
        switch group {
        case .open: return "Open tiles"
        case .project: return "Projects"
        case .tool: return "Project tools"
        case .declared: return "Own tools"
        case .command: return "Commands"
        case .choice: return "Pick"
        }
    }
}
