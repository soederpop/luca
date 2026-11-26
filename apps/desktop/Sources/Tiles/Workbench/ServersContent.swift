import SwiftUI
import Combine

/// `luca://<project>/servers`: the servers of the project's `servers`
/// registry, and the instances that run now. The host starts and stops them
/// inside its own container (`/servers`, `/servers/start`,
/// `/servers/<key>/stop`), so the inspector and the console see the same
/// instances. `luca serve` is the endpoints tile's; that one is a child process.
///
/// `j`/`k` move over the running instances, then the registry. `s` starts
/// the server in focus with its defaults, or stops the instance in focus.
/// `S` starts with options (it asks for them).
/// `Enter` opens an instance's page, or a server's inspector. `:start <id>
/// [options]`, `:stop` (the one in focus), `:stop all`.
@MainActor
final class ServersContent: WorkbenchContent {
    static let kind = TileKind(id: "luca-servers", label: "Servers", glyph: "server.rack") { uri, _ in
        ServersContent(uri: uri)
    }

    /// What `j` and `k` move over: an instance, or a server of the registry.
    enum Row: Equatable {
        case instance(WorkbenchServers.Instance)
        case kind(WorkbenchServers.Kind)
    }

    /// Instances first: what runs is what you act on. Pure, so it is tested.
    nonisolated static func rows(_ view: WorkbenchServers) -> [Row] {
        view.instances.map(Row.instance) + view.kinds.map(Row.kind)
    }

    @Published private(set) var view: WorkbenchServers?
    @Published private(set) var error: String?
    @Published private(set) var cursor = 0
    private var task: Task<Void, Never>?
    private var frames: AnyCancellable?

    init(uri: TileURI) {
        super.init(kindId: Self.kind.id, uri: uri, title: "\(ProjectHub.shared.displayName(uri.authority)) servers")
    }

    override func makeBody() -> AnyView { AnyView(ServersView(model: self)) }

    var rows: [Row] { view.map(Self.rows) ?? [] }
    var focused: Row? { rows.indices.contains(cursor) ? rows[cursor] : nil }

    override func hostChanged(_ client: WorkbenchClient?) {
        frames = client?.events.filter { $0.type == "servers" }.sink { [weak self] _ in self?.reload(quiet: true) }
        if client != nil { reload() } else { task?.cancel(); view = nil }
    }

    override func perform(_ action: String) -> Bool {
        switch action {
        case "lucaServers.down": select(cursor + 1)
        case "lucaServers.up": select(cursor - 1)
        case "lucaServers.toggle": toggleFocused()
        case "lucaServers.options": startFocusedWithOptions()
        case "lucaServers.open": openFocused()
        case "lucaServers.inspect": inspectFocused()
        case "lucaServers.reload": reload()
        case "lucaServers.restart": restartHost()
        default: return false
        }
        return true
    }

    override func runCommand(_ verb: String, _ rest: String) -> Bool {
        switch verb {
        case "start":
            let parts = rest.split(separator: " ", maxSplits: 1).map(String.init)
            guard let id = parts.first else { Shell.shared.flash("Usage: start <server> [options]"); return true }
            start(id, options: parts.count > 1 ? parts[1] : "")
        case "stop":
            if rest == "all" {
                for instance in view?.instances ?? [] { stop(instance) }
            } else if case .instance(let instance) = focused {
                stop(instance)
            } else {
                Shell.shared.flash("No running server in focus")
            }
        default: return false
        }
        return true
    }

    func select(_ index: Int) {
        guard !rows.isEmpty else { cursor = 0; return }
        cursor = min(max(0, index), rows.count - 1)
    }

    func select(_ row: Row) {
        if let index = rows.firstIndex(of: row) { cursor = index }
    }

    /// `s`: stop the instance in focus, or start the server in focus.
    func toggleFocused() {
        switch focused {
        case .instance(let instance): stop(instance)
        case .kind(let kind):
            select(.kind(kind))
            start(kind.id, options: "")
        case nil: Shell.shared.flash("No server in focus")
        }
    }

    /// `S`: start the server in focus with options.
    func startFocusedWithOptions() {
        guard case .kind(let kind) = focused else { return Shell.shared.flash("Put focus on a server of the registry") }
        askStart(kind)
    }

    /// Ask for the options on the command line, then start.
    func askStart(_ kind: WorkbenchServers.Kind) {
        select(.kind(kind))
        PaletteController.shared.ask("start \(kind.id) · \(kind.optionsHint)") { [weak self] text in
            self?.start(kind.id, options: text)
        }
    }

    func start(_ id: String, options: String) {
        guard let host else { return Shell.shared.flash("The workbench host is not running") }
        Task { [weak self] in
            do {
                let started = try await host.startServer(id, options: options)
                Shell.shared.flash("Starting \(started.title)")
                self?.reload(quiet: true, focusKey: started.key)
            } catch {
                Shell.shared.flash(ErrorText.message(error))
            }
        }
    }

    func stop(_ instance: WorkbenchServers.Instance) {
        guard let host else { return Shell.shared.flash("The workbench host is not running") }
        Task { [weak self] in
            do {
                try await host.stopServer(instance.key)
                Shell.shared.flash(instance.status == "failed" ? "Cleared \(instance.id)" : "Stopped \(instance.title)")
                self?.reload(quiet: true)
            } catch {
                Shell.shared.flash(ErrorText.message(error))
            }
        }
    }

    /// `Enter`: a listening HTTP server opens as a page; anything else opens its inspector.
    func openFocused() {
        switch focused {
        case .instance(let instance):
            if let url = instance.url, url.hasPrefix("http") {
                Shell.shared.open(TileURI.luca(project: projectId, tool: "page", id: url))
            } else {
                inspect(instance.id)
            }
        case .kind(let kind): inspect(kind.id)
        case nil: Shell.shared.flash("No server in focus")
        }
    }

    func inspectFocused() {
        switch focused {
        case .instance(let instance): inspect(instance.id)
        case .kind(let kind): inspect(kind.id)
        case nil: Shell.shared.flash("No server in focus")
        }
    }

    func inspect(_ id: String) {
        Shell.shared.openOrFocus(TileURI.luca(project: projectId, tool: "helper", id: "servers/\(id)"))
    }

    func reload(quiet: Bool = false, focusKey: String? = nil) {
        guard let host else { return }
        task?.cancel()
        if !quiet { stateLabel = view == nil ? "loading" : "updating" }
        // Keep focus on the same thing when rows come and go above it.
        let kept = focused
        task = Task { [weak self] in
            do {
                let view = try await host.servers()
                guard let self, !Task.isCancelled else { return }
                self.view = view
                self.error = nil
                let rows = Self.rows(view)
                if let focusKey, let index = rows.firstIndex(where: { if case .instance(let i) = $0 { return i.key == focusKey }; return false }) {
                    self.cursor = index
                } else if let kept, let index = rows.firstIndex(where: { Self.same($0, kept) }) {
                    self.cursor = index
                } else {
                    self.select(self.cursor)
                }
                self.stateLabel = view.text
            } catch {
                guard let self, !Task.isCancelled else { return }
                self.error = ErrorText.message(error)
                self.stateLabel = "error"
            }
        }
    }

    /// The same row after a reload: the instance by key, the server by id.
    nonisolated static func same(_ a: Row, _ b: Row) -> Bool {
        switch (a, b) {
        case (.instance(let x), .instance(let y)): return x.key == y.key
        case (.kind(let x), .kind(let y)): return x.id == y.id
        default: return false
        }
    }

    override func stop() {
        task?.cancel()
        frames = nil
        super.stop()
    }
}

struct ServersView: View {
    @ObservedObject var model: ServersContent

    private var p: KitPalette { Theme.palette }
    private var tint: Color { WorkbenchStyle.thingColor("servers") }

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                VStack(alignment: .leading, spacing: WorkbenchStyle.Gap.section) {
                    WorkbenchHostLine(status: model.hostStatus)
                    if let error = model.error {
                        WorkbenchCard(tint: p.bad.color) {
                            Text(error).font(WorkbenchStyle.body).foregroundStyle(p.bad.color).textSelection(.enabled)
                        }
                    }
                    if let view = model.view {
                        header(view)
                        running(view)
                        registry(view)
                    } else if model.hostStatus == .running, model.error == nil {
                        ProgressView().controlSize(.small)
                    }
                }
                .padding(.horizontal, WorkbenchStyle.Gap.page)
                .padding(.vertical, WorkbenchStyle.Gap.page - KitTokens.Space.s2)
                .frame(maxWidth: WorkbenchStyle.Size.readable + 100, alignment: .leading)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .onChange(of: model.cursor) { _, index in
                withAnimation(.easeOut(duration: KitTokens.Motion.fast)) { proxy.scrollTo(index) }
            }
        }
        .background(p.surface.color)
    }

    private func header(_ view: WorkbenchServers) -> some View {
        HStack(alignment: .center, spacing: KitTokens.Space.s5) {
            ThingGlyph(symbol: "server.rack", color: tint, size: 44)
            VStack(alignment: .leading, spacing: KitTokens.Space.s2) {
                Text("Servers").font(WorkbenchStyle.title).foregroundStyle(p.text.color)
                Text("Started here, they run inside this workbench and stop with it. They listen on this Mac only unless you give a host.")
                    .font(WorkbenchStyle.body)
                    .foregroundStyle(p.textMuted.color)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
    }

    private func running(_ view: WorkbenchServers) -> some View {
        WorkbenchSection(title: "Running", count: view.instances.count, color: p.good.color) {
            if view.instances.isEmpty {
                Text("Nothing is running. Pick a server below and press s, or S to give it a port and options.")
                    .font(WorkbenchStyle.body)
                    .foregroundStyle(p.textFaint.color)
                    .padding(.vertical, KitTokens.Space.s3)
            }
            ForEach(Array(view.instances.enumerated()), id: \.element.key) { index, instance in
                ServerInstanceCard(instance: instance, focused: model.cursor == index,
                                   onStop: { model.stop(instance) },
                                   onOpen: { model.select(.instance(instance)); model.openFocused() })
                    .id(index)
                    .onTapGesture { model.select(.instance(instance)) }
            }
        }
    }

    private func registry(_ view: WorkbenchServers) -> some View {
        WorkbenchSection(title: "In the registry", count: view.kinds.count, color: tint) {
            ForEach(Array(view.kinds.enumerated()), id: \.element.id) { index, kind in
                let row = view.instances.count + index
                ServerKindCard(kind: kind, focused: model.cursor == row, tint: tint,
                               onStart: { model.select(.kind(kind)); model.start(kind.id, options: "") },
                               onOptions: { model.askStart(kind) })
                    .id(row)
                    .onTapGesture { model.select(.kind(kind)) }
                    .onTapGesture(count: 2) { model.inspect(kind.id) }
            }
        }
    }
}

/// One action on a card: a word in a capsule of its color.
private struct ServerButton: View {
    let title: String
    let symbol: String
    let color: Color
    var filled = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Label(title, systemImage: symbol)
                .font(WorkbenchStyle.ui(KitTokens.TypeScale.xs, weight: .semibold))
                .foregroundStyle(filled ? Theme.palette.accentOn.color : color)
                .padding(.horizontal, KitTokens.Space.s5)
                .padding(.vertical, KitTokens.Space.s3)
                .background(Capsule().fill(filled ? color : color.opacity(0.14)))
                .overlay(Capsule().stroke(color.opacity(filled ? 0 : 0.5)))
                .contentShape(Capsule())
        }
        .buttonStyle(.plain)
    }
}

private struct ServerInstanceCard: View {
    let instance: WorkbenchServers.Instance
    let focused: Bool
    let onStop: () -> Void
    let onOpen: () -> Void

    private var p: KitPalette { Theme.palette }

    private var color: Color {
        switch instance.status {
        case "listening": return p.good.color
        case "starting": return p.info.color
        case "failed": return p.bad.color
        default: return p.textFaint.color
        }
    }

    var body: some View {
        WorkbenchCard(tint: color) {
            VStack(alignment: .leading, spacing: KitTokens.Space.s5) {
                HStack(alignment: .center, spacing: KitTokens.Space.s5) {
                    if instance.status == "starting" {
                        ProgressView().controlSize(.small).frame(width: 14)
                    } else {
                        Circle().fill(color).frame(width: 12, height: 12)
                            .overlay(Circle().stroke(color.opacity(0.35), lineWidth: 5))
                    }
                    Text(instance.title)
                        .font(WorkbenchStyle.code(KitTokens.TypeScale.lg, weight: .semibold))
                        .foregroundStyle(p.text.color)
                    WorkbenchTag(text: instance.status, color: color)
                    if instance.by == "project" { WorkbenchTag(text: "started by the project", color: p.syntax.type.color) }
                    Spacer(minLength: KitTokens.Space.s4)
                    if instance.url?.hasPrefix("http") == true {
                        ServerButton(title: "Open", symbol: "globe", color: p.info.color, action: onOpen)
                            .modifier(FocusedKey(action: "lucaServers.open", on: focused))
                    }
                    ServerButton(title: instance.status == "failed" ? "Clear" : "Stop",
                                 symbol: instance.status == "failed" ? "xmark" : "stop.fill", color: p.bad.color, action: onStop)
                        .modifier(FocusedKey(action: "lucaServers.toggle", on: focused))
                }
                if let url = instance.url {
                    Text(url)
                        .font(WorkbenchStyle.code(KitTokens.TypeScale.sm))
                        .foregroundStyle(p.info.color)
                        .textSelection(.enabled)
                }
                if let error = instance.error {
                    Text(error)
                        .font(WorkbenchStyle.body)
                        .foregroundStyle(p.bad.color)
                        .fixedSize(horizontal: false, vertical: true)
                        .textSelection(.enabled)
                }
                HStack(alignment: .firstTextBaseline, spacing: KitTokens.Space.s6) {
                    Text(instance.optionsText)
                        .font(WorkbenchStyle.code(KitTokens.TypeScale.xs))
                        .foregroundStyle(p.textMuted.color)
                        .lineLimit(1)
                        .truncationMode(.tail)
                    ForEach(instance.state.prefix(4), id: \.name) { pair in
                        (Text(pair.name + " ").foregroundColor(p.textFaint.color) + Text(pair.value).foregroundColor(WorkbenchStyle.keyColor))
                            .font(WorkbenchStyle.code(KitTokens.TypeScale.xs))
                            .lineLimit(1)
                    }
                    Spacer(minLength: 0)
                }
            }
        }
        .overlay(RoundedRectangle(cornerRadius: KitTokens.Radius.lg).stroke(focused ? color : .clear, lineWidth: 1.5))
        .contentShape(Rectangle())
    }
}

private struct ServerKindCard: View {
    let kind: WorkbenchServers.Kind
    let focused: Bool
    let tint: Color
    let onStart: () -> Void
    let onOptions: () -> Void

    private var p: KitPalette { Theme.palette }

    var body: some View {
        WorkbenchCard {
            VStack(alignment: .leading, spacing: KitTokens.Space.s5) {
                HStack(alignment: .center, spacing: KitTokens.Space.s5) {
                    ThingGlyph(symbol: "server.rack", color: tint, size: 36)
                    VStack(alignment: .leading, spacing: KitTokens.Space.s1) {
                        HStack(spacing: KitTokens.Space.s4) {
                            Text(kind.id)
                                .font(WorkbenchStyle.code(KitTokens.TypeScale.md, weight: .semibold))
                                .foregroundStyle(p.text.color)
                            if let origin = kind.origin { WorkbenchTag(text: origin.tag, color: WorkbenchStyle.originColor(origin.kind)) }
                            if kind.running > 0 { WorkbenchTag(text: "\(kind.running) running", color: p.good.color) }
                        }
                        if !kind.summary.isEmpty {
                            docProse(kind.summary)
                                .font(WorkbenchStyle.body)
                                .foregroundStyle(p.textMuted.color)
                                .lineLimit(focused ? 4 : 2)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                    Spacer(minLength: KitTokens.Space.s4)
                    if focused {
                        ServerButton(title: "With options", symbol: "slider.horizontal.3", color: p.textMuted.color, action: onOptions)
                            .keyBadge("lucaServers.options")
                    }
                    ServerButton(title: "Start", symbol: "play.fill", color: p.good.color, filled: focused, action: onStart)
                        .modifier(FocusedKey(action: "lucaServers.toggle", on: focused))
                }
                if focused, !kind.options.isEmpty {
                    VStack(alignment: .leading, spacing: KitTokens.Space.s3) {
                        ForEach(kind.options, id: \.name) { option in
                            HStack(alignment: .firstTextBaseline, spacing: KitTokens.Space.s4) {
                                Text(option.name)
                                    .font(WorkbenchStyle.code(KitTokens.TypeScale.xs, weight: .semibold))
                                    .foregroundStyle(WorkbenchStyle.keyColor)
                                    .frame(width: 190, alignment: .leading)
                                Text(option.type)
                                    .font(WorkbenchStyle.code(KitTokens.TypeScale.xs))
                                    .foregroundStyle(WorkbenchStyle.typeNameColor(option.type))
                                    .frame(width: 90, alignment: .leading)
                                Text(option.description)
                                    .font(WorkbenchStyle.meta)
                                    .foregroundStyle(p.textMuted.color)
                                    .lineLimit(1)
                            }
                        }
                    }
                    .padding(KitTokens.Space.s5)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(RoundedRectangle(cornerRadius: KitTokens.Radius.md).fill(p.inset.color.opacity(0.7)))
                }
            }
        }
        .overlay(RoundedRectangle(cornerRadius: KitTokens.Radius.lg).stroke(focused ? tint : .clear, lineWidth: 1.5))
        .contentShape(Rectangle())
    }
}

/// The key badge only on the card in focus: the key acts on that one.
private struct FocusedKey: ViewModifier {
    let action: String
    let on: Bool
    func body(content: Content) -> some View {
        if on { content.keyBadge(action) } else { content }
    }
}
