import SwiftUI
import Combine

/// `luca://<project>/endpoints`: the routes in the project's `endpoints/`
/// folder, grouped by tag (or first path segment), and the project's
/// `luca serve` child with its log. The host reads the routes without the
/// server running (`GET /endpoints`), owns the child (`/serve/start`,
/// `/serve/stop`) and streams its log as run frames.
///
/// `j`/`k` move, `Enter` opens the request tile of the route in focus,
/// `s` starts or stops the server, `l` shows or hides its log.
/// `:request <METHOD> <path>` opens one route; `:serve start|stop`.
@MainActor
final class EndpointsContent: WorkbenchContent {
    static let kind = TileKind(id: "luca-endpoints", label: "Endpoints", glyph: "point.3.connected.trianglepath.dotted") { uri, _ in
        EndpointsContent(uri: uri)
    }

    /// The routes in the order the tile draws them. Pure, so it is tested.
    nonisolated static func rows(_ view: WorkbenchEndpoints) -> [WorkbenchRoute] {
        view.groups.flatMap(\.routes)
    }

    @Published private(set) var view: WorkbenchEndpoints?
    @Published private(set) var error: String?
    @Published private(set) var cursor = 0
    @Published var showLog = true
    let serve = ServeMonitor()
    private var task: Task<Void, Never>?
    private var serveWatch: AnyCancellable?

    init(uri: TileURI) {
        super.init(kindId: Self.kind.id, uri: uri, title: "\(ProjectHub.shared.displayName(uri.authority)) endpoints")
        serveWatch = serve.$serve.sink { [weak self] state in
            guard let self, self.view != nil else { return }
            self.stateLabel = "\(self.view?.count ?? 0) routes · \(state.text)"
        }
    }

    override func makeBody() -> AnyView { AnyView(EndpointsView(model: self, serve: serve)) }

    var rows: [WorkbenchRoute] { view.map(Self.rows) ?? [] }

    override func hostChanged(_ client: WorkbenchClient?) {
        serve.attach(client)
        if client != nil { reload() } else { task?.cancel() }
    }

    override func perform(_ action: String) -> Bool {
        switch action {
        case "lucaEndpoints.down": select(cursor + 1)
        case "lucaEndpoints.up": select(cursor - 1)
        case "lucaEndpoints.open": openFocused()
        case "lucaEndpoints.serve": serve.toggle()
        case "lucaEndpoints.log": showLog.toggle()
        case "lucaEndpoints.reload": reload()
        case "lucaEndpoints.restart": restartHost()
        default: return false
        }
        return true
    }

    override func runCommand(_ verb: String, _ rest: String) -> Bool {
        switch verb {
        case "serve":
            switch rest {
            case "start": serve.start()
            case "stop": serve.stop()
            default: serve.toggle()
            }
        case "request":
            let parts = rest.split(separator: " ").map(String.init)
            guard parts.count == 2 else { Shell.shared.flash("Usage: request <METHOD> <path>"); return true }
            guard let route = rows.first(where: { $0.method == parts[0].uppercased() && $0.path == parts[1] }) else {
                Shell.shared.flash("No route \(parts[0].uppercased()) \(parts[1])")
                return true
            }
            open(route)
        default:
            return false
        }
        return true
    }

    func select(_ index: Int) {
        guard !rows.isEmpty else { return }
        cursor = min(max(0, index), rows.count - 1)
    }

    func openFocused() {
        guard rows.indices.contains(cursor) else { return Shell.shared.flash("No route in focus") }
        open(rows[cursor])
    }

    func open(_ route: WorkbenchRoute) {
        if let index = rows.firstIndex(of: route) { cursor = index }
        guard let uri = TileURI(TileURI.lucaScheme + projectId + "/" + route.address) else { return }
        Shell.shared.openOrFocus(uri)
    }

    func reload() {
        guard let host else { return }
        task?.cancel()
        stateLabel = view == nil ? "loading" : "updating"
        task = Task { [weak self] in
            do {
                let view = try await host.endpoints()
                guard let self, !Task.isCancelled else { return }
                self.view = view
                self.error = nil
                self.serve.update(view.server)
                self.select(self.cursor)
                self.stateLabel = "\(view.count) routes · \(view.server.text)"
            } catch {
                guard let self, !Task.isCancelled else { return }
                self.error = ErrorText.message(error)
                self.stateLabel = "error"
            }
        }
    }

    override func stop() {
        task?.cancel()
        serve.attach(nil)
        super.stop()
    }
}

struct EndpointsView: View {
    @ObservedObject var model: EndpointsContent
    @ObservedObject var serve: ServeMonitor

    private var p: KitPalette { Theme.palette }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: KitTokens.Space.s8) {
                WorkbenchHostLine(status: model.hostStatus)
                if let error = model.error {
                    WorkbenchCard(tint: p.bad.color) {
                        Text(error).font(WorkbenchStyle.ui(KitTokens.TypeScale.sm)).foregroundStyle(p.bad.color).textSelection(.enabled)
                    }
                }
                if let view = model.view {
                    header(view)
                    if let notice = view.notice {
                        HStack(spacing: KitTokens.Space.s4) {
                            Image(systemName: "info.circle").foregroundStyle(p.textFaint.color)
                            Text(notice).font(WorkbenchStyle.ui(KitTokens.TypeScale.md)).foregroundStyle(p.textMuted.color)
                        }
                    }
                    if view.dir != nil { serverSection }
                    ForEach(view.groups) { group in groupSection(group) }
                    if !view.errors.isEmpty { errorsSection(view.errors) }
                } else if model.hostStatus == .running, model.error == nil {
                    ProgressView().controlSize(.small)
                }
            }
            .padding(.horizontal, WorkbenchStyle.Gap.page)
            .padding(.vertical, WorkbenchStyle.Gap.page - KitTokens.Space.s2)
            .frame(maxWidth: WorkbenchStyle.Size.readable + 200, alignment: .leading)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(p.surface.color)
    }

    private func header(_ view: WorkbenchEndpoints) -> some View {
        VStack(alignment: .leading, spacing: KitTokens.Space.s3) {
            HStack(alignment: .firstTextBaseline, spacing: KitTokens.Space.s4) {
                Text("Endpoints").font(WorkbenchStyle.ui(KitTokens.TypeScale.xl, weight: .semibold)).foregroundStyle(p.text.color)
                if let dir = view.dirDisplay {
                    Text(dir).font(WorkbenchStyle.code(KitTokens.TypeScale.sm)).foregroundStyle(p.textMuted.color)
                }
                Spacer(minLength: 0)
            }
            if view.count > 0 {
                HStack(spacing: KitTokens.Space.s3) {
                    Text("\(view.count) routes").font(WorkbenchStyle.ui(KitTokens.TypeScale.sm)).foregroundStyle(p.textMuted.color)
                    ForEach(methodCounts(view), id: \.0) { method, count in
                        HStack(spacing: KitTokens.Space.s2) {
                            Circle().fill(WorkbenchStyle.methodColor(method)).frame(width: 7, height: 7)
                            Text("\(count) \(method)").font(WorkbenchStyle.code(KitTokens.TypeScale.xs)).foregroundStyle(WorkbenchStyle.methodColor(method))
                        }
                    }
                }
            }
        }
    }

    private func methodCounts(_ view: WorkbenchEndpoints) -> [(String, Int)] {
        let rows = EndpointsContent.rows(view)
        return ["GET", "POST", "PUT", "PATCH", "DELETE"].compactMap { m in
            let n = rows.filter { $0.method == m }.count
            return n > 0 ? (m, n) : nil
        }
    }

    private var serverSection: some View {
        VStack(alignment: .leading, spacing: KitTokens.Space.s4) {
            WorkbenchSectionTitle(title: "Server", note: "luca serve, owned by this workbench")
            WorkbenchCard(tint: WorkbenchStyle.color(serve.tone)) {
                VStack(alignment: .leading, spacing: KitTokens.Space.s4) {
                    HStack(spacing: KitTokens.Space.s5) {
                        ServeBadge(serve: serve.serve)
                        if let url = serve.serve.url, serve.serve.status != "stopped" {
                            Text(url).font(WorkbenchStyle.code(KitTokens.TypeScale.sm)).foregroundStyle(p.textBody.color).textSelection(.enabled)
                        }
                        if serve.busy { ProgressView().controlSize(.small) }
                        Spacer(minLength: 0)
                        ServeButton(monitor: serve, action: "lucaEndpoints.serve", hints: model.hints)
                    }
                    if serve.serve.status == "failed", let error = serve.serve.error {
                        Text(error).font(WorkbenchStyle.code(KitTokens.TypeScale.xs)).foregroundStyle(p.bad.color).textSelection(.enabled)
                    }
                    if serve.serve.status == "stopped", serve.log.runId == nil {
                        Text("Start it to send requests from a route's request view.")
                            .font(WorkbenchStyle.ui(KitTokens.TypeScale.sm)).foregroundStyle(p.textFaint.color)
                    }
                }
            }
            if serve.log.runId != nil {
                HStack(spacing: KitTokens.Space.s3) {
                    Button { model.showLog.toggle() } label: {
                        HStack(spacing: KitTokens.Space.s3) {
                            Image(systemName: model.showLog ? "chevron.down" : "chevron.right").font(.system(size: 11, weight: .bold))
                            Text("Log").font(WorkbenchStyle.ui(KitTokens.TypeScale.sm, weight: .semibold))
                            if let status = serve.log.statusText {
                                Text(status).font(WorkbenchStyle.ui(KitTokens.TypeScale.xs)).foregroundStyle(p.textFaint.color)
                            }
                        }
                        .foregroundStyle(p.textMuted.color)
                        .padding(.trailing, KitTokens.Space.s5)
                    }
                    .buttonStyle(.plain)
                    .keyBadge("lucaEndpoints.log")
                    Spacer(minLength: 0)
                }
                if model.showLog {
                    RunTranscriptCard(transcript: serve.log, tint: WorkbenchStyle.color(serve.tone).opacity(0.6), lastLines: 60)
                }
            }
        }
    }

    private func groupSection(_ group: WorkbenchEndpoints.Group) -> some View {
        VStack(alignment: .leading, spacing: KitTokens.Space.s4) {
            WorkbenchSectionTitle(title: group.tag, note: "\(group.routes.count) route\(group.routes.count == 1 ? "" : "s")")
            VStack(alignment: .leading, spacing: KitTokens.Space.s3) {
                ForEach(group.routes) { route in row(route) }
            }
        }
    }

    private func row(_ route: WorkbenchRoute) -> some View {
        let focused = model.rows.firstIndex(of: route) == model.cursor
        let counts = Dictionary(grouping: route.fields, by: \.in).mapValues(\.count)
        return HStack(alignment: .center, spacing: KitTokens.Space.s6) {
            MethodPill(method: route.method, size: KitTokens.TypeScale.sm)
            VStack(alignment: .leading, spacing: KitTokens.Space.s2) {
                PathText(path: route.path, size: KitTokens.TypeScale.md)
                if !route.summary.isEmpty {
                    Text(route.summary).font(WorkbenchStyle.ui(KitTokens.TypeScale.sm)).foregroundStyle(p.textBody.color)
                }
            }
            Spacer(minLength: KitTokens.Space.s4)
            HStack(spacing: KitTokens.Space.s3) {
                ForEach(["path", "query", "body"], id: \.self) { place in
                    if let n = counts[place] { WorkbenchTag(text: "\(n) \(place)", color: p.textMuted.color) }
                }
                if route.upload { WorkbenchTag(text: "upload", color: p.warn.color) }
                if let limit = route.rateLimit { WorkbenchTag(text: limit, color: p.syntax.property.color) }
            }
            Text(route.file).font(WorkbenchStyle.code(KitTokens.TypeScale.xs)).foregroundStyle(p.textFaint.color).lineLimit(1)
            if focused {
                Image(systemName: "arrow.right.circle.fill").foregroundStyle(p.accent.color)
                    .keyBadge("lucaEndpoints.open", leading: true)
            }
        }
        .padding(.horizontal, KitTokens.Space.s6)
        .padding(.vertical, KitTokens.Space.s5)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: KitTokens.Radius.lg).fill(focused ? p.raised.color : p.raised.color.opacity(0.55)))
        .overlay(alignment: .leading) {
            UnevenRoundedRectangle(topLeadingRadius: KitTokens.Radius.lg, bottomLeadingRadius: KitTokens.Radius.lg)
                .fill(WorkbenchStyle.methodColor(route.method).opacity(focused ? 1 : 0.55))
                .frame(width: 3)
        }
        .overlay(RoundedRectangle(cornerRadius: KitTokens.Radius.lg).stroke(focused ? p.accent.color : p.border.color, lineWidth: focused ? 1.5 : 1))
        .contentShape(Rectangle())
        .onTapGesture(count: 2) { model.open(route) }
        .onTapGesture { if let i = model.rows.firstIndex(of: route) { model.select(i) } }
    }

    private func errorsSection(_ errors: [WorkbenchEndpoints.LoadError]) -> some View {
        VStack(alignment: .leading, spacing: KitTokens.Space.s4) {
            WorkbenchSectionTitle(title: "Files that did not load", note: "\(errors.count)")
            ForEach(errors) { item in
                WorkbenchCard(tint: p.bad.color) {
                    VStack(alignment: .leading, spacing: KitTokens.Space.s2) {
                        Text(item.file).font(WorkbenchStyle.code(KitTokens.TypeScale.sm, weight: .semibold)).foregroundStyle(p.text.color)
                        Text(item.error).font(WorkbenchStyle.code(KitTokens.TypeScale.xs)).foregroundStyle(p.bad.color).textSelection(.enabled)
                    }
                }
            }
        }
    }
}
