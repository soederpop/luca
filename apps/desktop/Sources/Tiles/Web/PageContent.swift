import SwiftUI
import AppKit
import Combine

/// `luca://<project>/page/<path>?<query>`: a page the project's own
/// `luca serve` answers (`/health`, `/app/index.html?x=1`), or with a full
/// URL as the id (`luca://p/page/https://example.com/x`) any web page.
///
/// A serve path needs the serve child: the tile shows the server's state and
/// `s` starts it; the page loads once it runs. The page needs no bridge. A
/// field in it takes Insert mode like any web tile, `i` gives the page every
/// key until `Mod-Esc`, and a page that loads the kit gets its keys in the
/// keys view.
@MainActor
final class PageContent: WorkbenchContent {
    static let kind = TileKind(id: "luca-page", label: "Page", glyph: "globe") { uri, _ in
        PageContent(uri: uri)
    }

    /// The address for what was typed after `:page`: `health`, `/app?x=1`,
    /// or a URL. Pure, so it is tested.
    static func address(project: String, typed: String) -> TileURI {
        var path = typed.trimmingCharacters(in: .whitespaces)
        if path.hasPrefix("http://") || path.hasPrefix("https://") {
            return TileURI.luca(project: project, tool: "page", id: path)
        }
        var options: [TileURI.Option] = []
        if let mark = path.firstIndex(of: "?") {
            options = path[path.index(after: mark)...].split(separator: "&").compactMap { pair in
                let halves = pair.split(separator: "=", maxSplits: 1).map(String.init)
                guard let name = halves.first, !name.isEmpty else { return nil }
                return TileURI.Option(name: name, value: halves.count > 1 ? halves[1] : "")
            }
            path = String(path[..<mark])
        }
        while path.hasPrefix("/") { path.removeFirst() }
        return TileURI.luca(project: project, tool: "page", id: path.isEmpty ? nil : path, options: options)
    }

    /// The full URL an address names, when its id is one. Nil for a serve path.
    static func externalURL(_ uri: TileURI) -> URL? {
        guard let id = uri.id, id.hasPrefix("http://") || id.hasPrefix("https://") else { return nil }
        guard var c = URLComponents(string: id) else { return nil }
        if !uri.options.isEmpty {
            c.queryItems = (c.queryItems ?? []) + uri.options.map { URLQueryItem(name: $0.name, value: $0.value.isEmpty ? nil : $0.value) }
        }
        return c.url
    }

    /// The path and query on the server, from a tile address.
    static func path(for uri: TileURI) -> String {
        var allowed = CharacterSet.urlPathAllowed
        allowed.remove(charactersIn: "?#")
        var path = "/" + ((uri.id ?? "").addingPercentEncoding(withAllowedCharacters: allowed) ?? "")
        var query = URLComponents()
        query.queryItems = uri.options.map { URLQueryItem(name: $0.name, value: $0.value.isEmpty ? nil : $0.value) }
        if !uri.options.isEmpty, let text = query.percentEncodedQuery { path += "?" + text }
        return path
    }

    /// The page on a running server: its base URL plus the path. Pure.
    static func serveURL(base: String?, uri: TileURI) -> URL? {
        guard let base, !base.isEmpty else { return nil }
        let trimmed = base.hasSuffix("/") ? String(base.dropLast()) : base
        return URL(string: trimmed + path(for: uri))
    }

    @Published private(set) var url: URL?
    @Published private(set) var reloadTick = 0
    let serve = ServeMonitor()
    let web: WebTileHost
    private var serveWatch: AnyCancellable?

    var isExternal: Bool { Self.externalURL(uri) != nil }
    /// What the address names, for the header: `/health` or the URL.
    var target: String { Self.externalURL(uri)?.absoluteString ?? Self.path(for: uri) }

    init(uri: TileURI) {
        web = WebTileHost(project: uri.authority, tileId: UUID())
        let external = Self.externalURL(uri)
        super.init(kindId: Self.kind.id, uri: uri, title: external?.host ?? Self.path(for: uri))
        web.zoom = Self.savedZoom(uri)
        if let external { show(external); stateLabel = nil }
        serveWatch = serve.$serve
            .receive(on: DispatchQueue.main)
            .sink { [weak self] state in self?.serveChanged(state) }
    }

    override var tileId: UUID { didSet { web.setTile(tileId) } }
    override var webHost: WebTileHost? { web }
    override var editorHasKeyboard: Bool { web.hasKeyboard }
    override func passesEscape() -> Bool { web.pageHasKeys }
    override func didLeaveInsert() { web.blur() }

    override func makeBody() -> AnyView { AnyView(PageTileView(model: self, serve: serve)) }

    override func hostChanged(_ client: WorkbenchClient?) {
        guard !isExternal else { return }
        serve.attach(client)
    }

    /// The URL the tile names, before it is brought here from another machine.
    private var wanted: URL?

    /// Show a URL. A `localhost` URL of a project on another machine is that
    /// machine's: a tunnel brings its port here first.
    private func show(_ next: URL?) {
        guard next != wanted else { return }
        wanted = next
        guard let next, ProjectHub.shared.project(projectId)?.isRemote == true else { url = next; return }
        Task { [weak self] in
            guard let self else { return }
            let here = await ProjectHub.shared.reachable(self.projectId, url: next.absoluteString)
            guard self.wanted == next else { return }
            self.url = URL(string: here)
        }
    }

    private func serveChanged(_ state: WorkbenchServe) {
        guard !isExternal else { return }
        show(state.status == "running" ? Self.serveURL(base: state.url, uri: uri) : nil)
        stateLabel = state.status == "running" ? nil : "serve \(state.status)"
    }

    // MARK: Zoom

    /// The zoom is kept per page address on this Mac, not in the address.
    static let defaultZoom: CGFloat = 1
    private static let zoomKey = "page.zoom"

    static func savedZoom(_ uri: TileURI) -> CGFloat {
        let saved = UserDefaults.standard.dictionary(forKey: zoomKey)?[zoomId(uri)] as? Double
        return saved.map { CGFloat($0) } ?? defaultZoom
    }

    /// Project and path, without the query: `/app?x=1` zooms as `/app`.
    private static func zoomId(_ uri: TileURI) -> String { uri.authority + "/" + (uri.id ?? "") }

    private func setZoom(_ value: CGFloat) {
        let zoom = min(3, max(0.5, (value * 10).rounded() / 10))
        web.zoom = zoom
        var all = UserDefaults.standard.dictionary(forKey: Self.zoomKey) ?? [:]
        all[Self.zoomId(uri)] = Double(zoom)
        UserDefaults.standard.set(all, forKey: Self.zoomKey)
        Shell.shared.flash("Zoom \(Int((zoom * 100).rounded()))%")
    }

    override func perform(_ action: String) -> Bool {
        switch action {
        case "lucaPage.keys": web.takeKeys()
        case "lucaPage.reload": reloadTick += 1
        case "lucaPage.serve":
            if isExternal { Shell.shared.flash("This page is a URL, not a path on luca serve") }
            else if serve.running { Shell.shared.flash("luca serve is running") }
            else { serve.start() }
        case "lucaPage.zoom.in": setZoom(web.zoom + 0.1)
        case "lucaPage.zoom.out": setZoom(web.zoom - 0.1)
        case "lucaPage.zoom.reset": setZoom(Self.defaultZoom)
        case "lucaPage.browser":
            if let url { NSWorkspace.shared.open(url) } else { Shell.shared.flash("The page has no address yet") }
        case "lucaPage.copyURL":
            guard let url else { return true }
            NSPasteboard.general.clearContents()
            NSPasteboard.general.setString(url.absoluteString, forType: .string)
            Shell.shared.flash("Copied \(url.absoluteString)")
        default: return false
        }
        return true
    }
}

struct PageTileView: View {
    @ObservedObject var model: PageContent
    @ObservedObject var serve: ServeMonitor

    private var p: KitPalette { Theme.palette }

    var body: some View {
        VStack(spacing: 0) {
            header
            if let url = model.url {
                HostedWebView(url: url, reloadTick: model.reloadTick, host: model.web)
            } else {
                waiting
            }
        }
        .background(p.ground.color)
    }

    private var header: some View {
        HStack(spacing: KitTokens.Space.s4) {
            WorkbenchTag(text: model.isExternal ? "web" : "luca serve", color: model.isExternal ? WorkbenchStyle.typeColor : Theme.ownerColor(model.owner))
            Text(model.url?.absoluteString ?? model.target)
                .font(WorkbenchStyle.code(KitTokens.TypeScale.xs))
                .foregroundStyle(p.textMuted.color)
                .lineLimit(1).truncationMode(.middle)
                .textSelection(.enabled)
            Spacer(minLength: KitTokens.Space.s4)
            if !model.isExternal { ServeBadge(serve: serve.serve) }
        }
        .padding(.horizontal, KitTokens.Space.s6)
        .padding(.vertical, KitTokens.Space.s3)
        .background(p.surface.color)
        .overlay(alignment: .bottom) { Rectangle().fill(p.border.color).frame(height: 1) }
    }

    /// A serve path with the server not up: its state and how to start it.
    private var waiting: some View {
        VStack(alignment: .leading, spacing: KitTokens.Space.s5) {
            WorkbenchHostLine(status: model.hostStatus)
            WorkbenchCard(tint: WorkbenchStyle.color(.serve(serve.serve.status))) {
                VStack(alignment: .leading, spacing: KitTokens.Space.s4) {
                    Text(serve.serve.status == "starting" ? "Starting luca serve…" : "luca serve is not running")
                        .font(WorkbenchStyle.ui(KitTokens.TypeScale.md, weight: .semibold))
                        .foregroundStyle(p.text.color)
                    Text("The page \(model.target) loads as soon as the project's server is up.")
                        .font(WorkbenchStyle.ui(KitTokens.TypeScale.sm))
                        .foregroundStyle(p.textMuted.color)
                    if let error = serve.serve.error {
                        Text(error)
                            .font(WorkbenchStyle.code(KitTokens.TypeScale.xs))
                            .foregroundStyle(p.bad.color)
                            .lineLimit(6)
                            .textSelection(.enabled)
                    }
                    if serve.serve.status != "starting" {
                        Button { _ = model.perform("lucaPage.serve") } label: {
                            Text("Start luca serve")
                                .font(WorkbenchStyle.ui(KitTokens.TypeScale.sm, weight: .semibold))
                                .foregroundStyle(p.accentOn.color)
                                .padding(.horizontal, KitTokens.Space.s5)
                                .padding(.vertical, KitTokens.Space.s3)
                                .background(Capsule().fill(p.accent.color))
                        }
                        .buttonStyle(.plain)
                        .keyBadge("lucaPage.serve", leading: true)
                    }
                }
            }
            Spacer(minLength: 0)
        }
        .padding(KitTokens.Space.s7)
        .frame(maxWidth: 720, maxHeight: .infinity, alignment: .topLeading)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(p.surface.color)
    }
}
