import SwiftUI
import AppKit
import Combine
import WebKit

/// `luca://<project>/canvas/<id>`: a page an assistant draws on.
///
/// The host serves the page and owns everything about it: its key, its saved
/// code, the link that evals in it. The tile only shows the page, locked down
/// by `CanvasLockdown`, and answers the host's `canvas-snapshot` frames with
/// a screenshot of the web view. An address with no canvas on the host makes
/// one, so a saved layout opens again after the host forgot it.
@MainActor
final class CanvasContent: WorkbenchContent {
    static let kind = TileKind(id: "luca-canvas", label: "Canvas", glyph: "paintbrush.pointed") { uri, _ in
        CanvasContent(uri: uri)
    }

    nonisolated static func address(project: String, id: String) -> TileURI {
        TileURI.luca(project: project, tool: "canvas", id: id)
    }

    /// `My Chart` -> `my-chart`, as the host makes ids. Pure.
    nonisolated static func slug(_ text: String) -> String {
        let lowered = text.lowercased()
        var out = ""
        var dash = false
        for ch in lowered {
            if ch.isASCII, ch.isLetter || ch.isNumber {
                if dash, !out.isEmpty { out.append("-") }
                out.append(ch)
                dash = false
            } else {
                dash = true
            }
        }
        return String(out.prefix(40))
    }

    /// The page on this machine: the client's base (a tunnel for a remote
    /// project) plus the canvas path and its key. Pure.
    nonisolated static func pageURL(base: URL, id: String, key: String) -> URL? {
        var c = URLComponents(url: base, resolvingAgainstBaseURL: false)
        c?.path = "/canvas/\(id)/"
        c?.queryItems = [URLQueryItem(name: "key", value: key)]
        return c?.url
    }

    @Published private(set) var url: URL?
    @Published private(set) var ruleList: WKContentRuleList?
    @Published private(set) var reloadTick = 0
    @Published private(set) var problem: String?
    let web: WebTileHost
    private var frames: AnyCancellable?
    private var loading: Task<Void, Never>?

    var canvasId: String { uri.id ?? "canvas" }

    init(uri: TileURI) {
        web = WebTileHost(project: uri.authority, tileId: UUID())
        super.init(kindId: Self.kind.id, uri: uri, title: uri.id ?? "Canvas")
    }

    override var tileId: UUID { didSet { web.setTile(tileId) } }
    override var webHost: WebTileHost? { web }
    override var editorHasKeyboard: Bool { web.hasKeyboard }
    override func passesEscape() -> Bool { web.pageHasKeys }
    override func didLeaveInsert() { web.blur() }

    override func makeBody() -> AnyView { AnyView(CanvasTileView(model: self)) }

    override func hostChanged(_ client: WorkbenchClient?) {
        frames = nil
        loading?.cancel()
        guard let client else { url = nil; return }
        frames = client.events
            .receive(on: DispatchQueue.main)
            .sink { [weak self] event in self?.handle(event, client: client) }
        loading = Task { [weak self] in await self?.load(client) }
    }

    private func load(_ client: WorkbenchClient) async {
        do {
            let rules = try await CanvasLockdown.ruleList()
            let view: WorkbenchCanvas
            do {
                view = try await client.canvas(canvasId)
            } catch WorkbenchError.http(404, _) {
                view = try await client.createCanvas(id: canvasId, title: canvasId)
            }
            guard !Task.isCancelled, client === host else { return }
            guard let key = view.key, let page = Self.pageURL(base: client.baseURL, id: view.id, key: key) else {
                problem = "The host gave no key for this canvas"
                return
            }
            ruleList = rules
            title = view.title
            problem = nil
            stateLabel = nil
            url = page
        } catch {
            guard !Task.isCancelled else { return }
            problem = error.localizedDescription
            stateLabel = "canvas failed"
        }
    }

    private func handle(_ event: WorkbenchEvent, client: WorkbenchClient) {
        guard event.id == canvasId else { return }
        switch event.type {
        case "canvas-snapshot":
            guard let requestId = event.requestId else { return }
            let id = canvasId
            Task { [weak self] in
                let shot = await self?.web.snapshotPNG()
                try? await client.answerCanvasSnapshot(id, requestId: requestId, png: shot?.data, width: shot?.width ?? 0, height: shot?.height ?? 0)
            }
        case "canvas-closed":
            url = nil
            problem = "The host removed this canvas"
        default:
            break
        }
    }

    override func perform(_ action: String) -> Bool {
        switch action {
        case "lucaCanvas.keys": web.takeKeys()
        case "lucaCanvas.reload": reloadTick += 1
        case "lucaCanvas.restart": restartHost()
        default: return false
        }
        return true
    }
}

struct CanvasTileView: View {
    @ObservedObject var model: CanvasContent

    private var p: KitPalette { Theme.palette }

    var body: some View {
        VStack(spacing: 0) {
            header
            if let url = model.url, let rules = model.ruleList {
                HostedWebView(url: url, reloadTick: model.reloadTick, host: model.web, ruleList: rules, frameRule: CanvasLockdown.allows)
            } else {
                waiting
            }
        }
        .background(p.ground.color)
    }

    private var header: some View {
        HStack(spacing: KitTokens.Space.s4) {
            WorkbenchTag(text: "canvas", color: Theme.ownerColor(model.owner))
            Text(model.title)
                .font(WorkbenchStyle.ui(KitTokens.TypeScale.sm, weight: .semibold))
                .foregroundStyle(p.text.color)
                .lineLimit(1)
            Text(model.canvasId)
                .font(WorkbenchStyle.code(KitTokens.TypeScale.xs))
                .foregroundStyle(p.textMuted.color)
                .lineLimit(1)
            Spacer(minLength: KitTokens.Space.s4)
            Text("localhost · tailscale · unpkg")
                .font(WorkbenchStyle.code(KitTokens.TypeScale.xs))
                .foregroundStyle(p.textMuted.color)
                .lineLimit(1)
        }
        .padding(.horizontal, KitTokens.Space.s6)
        .padding(.vertical, KitTokens.Space.s3)
        .background(p.surface.color)
        .overlay(alignment: .bottom) { Rectangle().fill(p.border.color).frame(height: 1) }
    }

    private var waiting: some View {
        VStack(alignment: .leading, spacing: KitTokens.Space.s5) {
            WorkbenchHostLine(status: model.hostStatus)
            if let problem = model.problem {
                Text(problem)
                    .font(WorkbenchStyle.code(KitTokens.TypeScale.xs))
                    .foregroundStyle(p.bad.color)
                    .lineLimit(6)
                    .textSelection(.enabled)
            }
            Spacer(minLength: 0)
        }
        .padding(KitTokens.Space.s7)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(p.surface.color)
    }
}
