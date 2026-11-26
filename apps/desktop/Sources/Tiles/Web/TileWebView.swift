import SwiftUI
import WebKit

/// A `TileWebView` with the host bridge, which tells the host its size.
struct HostedWebView: View {
    let url: URL
    var reloadTick = 0
    let host: WebTileHost
    var messageHandler: String?
    var onMessage: ([String: Any]) -> Void = { _ in }
    /// A content rule list for every load of the page (a canvas's lockdown).
    var ruleList: WKContentRuleList? = nil
    /// Which frame navigations go ahead. Nil lets any frame load.
    var frameRule: ((URL) -> Bool)? = nil

    var body: some View {
        GeometryReader { proxy in
            TileWebView(url: url, reloadTick: reloadTick, messageHandler: messageHandler, host: host, onMessage: onMessage, ruleList: ruleList, frameRule: frameRule)
                .onAppear { host.resized(proxy.size) }
                .onChange(of: proxy.size) { _, size in host.resized(size) }
        }
    }
}

/// A web view held to the origin it first loads: a link to another origin
/// is refused. A frame inside the page may load another origin; the page's
/// own `frame-src` policy says which. Page messages to `messageHandler`
/// arrive as dictionaries.
struct TileWebView: NSViewRepresentable {
    let url: URL
    var reloadTick = 0
    var messageHandler: String?
    /// The theme kit host bridge: live theme, size, focus and page keys.
    var host: WebTileHost?
    var onMessage: ([String: Any]) -> Void = { _ in }
    var ruleList: WKContentRuleList? = nil
    var frameRule: ((URL) -> Bool)? = nil

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeNSView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .nonPersistent()
        let controller = WKUserContentController()
        if let messageHandler { controller.add(WeakMessageHandler(context.coordinator), name: messageHandler) }
        if let host {
            host.install(in: controller, handler: context.coordinator)
            controller.addUserScript(WKUserScript(source: Self.groundScript, injectionTime: .atDocumentEnd, forMainFrameOnly: true))
        }
        if let ruleList { controller.add(ruleList) }
        config.userContentController = controller
        let webView = WKWebView(frame: .zero, configuration: config)
        host?.attach(webView)
        context.coordinator.host = host
        webView.navigationDelegate = context.coordinator
        webView.isInspectable = true
        webView.setValue(false, forKey: "drawsBackground")
        context.coordinator.onMessage = onMessage
        context.coordinator.origin = Self.origin(of: url)
        context.coordinator.frameRule = frameRule
        context.coordinator.loadedURL = url
        context.coordinator.reloadTick = reloadTick
        webView.load(URLRequest(url: url))
        return webView
    }

    func updateNSView(_ webView: WKWebView, context: Context) {
        let c = context.coordinator
        c.onMessage = onMessage
        c.origin = Self.origin(of: url)
        if c.loadedURL != url {
            c.loadedURL = url
            webView.load(URLRequest(url: url))
        } else if c.reloadTick != reloadTick {
            webView.reload()
        }
        c.reloadTick = reloadTick
    }

    static func dismantleNSView(_ webView: WKWebView, coordinator: Coordinator) {
        webView.configuration.userContentController.removeAllScriptMessageHandlers()
    }

    /// A page built with the kit gets the app's ground behind it; the kit
    /// itself never styles `body`. Other pages keep their own background.
    static let groundScript = """
    (function () {
      if (!document.querySelector('[class^="al-"], [class*=" al-"], [data-key]')) return
      var s = document.createElement('style')
      s.textContent = 'html, body { background: var(--al-ground); color: var(--al-text-body); }'
      document.head.appendChild(s)
    })();
    """

    static func origin(of url: URL) -> String {
        "\(url.scheme ?? "http")://\(url.host ?? ""):\(url.port ?? (url.scheme == "https" ? 443 : 80))"
    }

    /// Whether a navigation goes ahead. The page itself stays on its first
    /// origin. A frame inside it is the page's business.
    static func allows(_ url: URL, origin: String, mainFrame: Bool) -> Bool {
        if url.scheme == "about" || url.scheme == "blob" || url.scheme == "data" { return true }
        if !mainFrame { return true }
        return Self.origin(of: url) == origin
    }

    final class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
        var onMessage: ([String: Any]) -> Void = { _ in }
        var origin = ""
        var loadedURL: URL?
        var reloadTick = 0
        var frameRule: ((URL) -> Bool)?
        weak var host: WebTileHost?

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard let body = message.body as? [String: Any] else { return }
            if message.name == WebTileHost.handlerName {
                MainActor.assumeIsolated { host?.handle(body) }
                return
            }
            onMessage(body)
        }

        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping @MainActor @Sendable (WKNavigationActionPolicy) -> Void) {
            guard let url = navigationAction.request.url else { return decisionHandler(.cancel) }
            // No target frame is a new window, which is held like the page.
            let mainFrame = navigationAction.targetFrame?.isMainFrame ?? true
            if !mainFrame, let frameRule { return decisionHandler(frameRule(url) ? .allow : .cancel) }
            decisionHandler(TileWebView.allows(url, origin: origin, mainFrame: mainFrame) ? .allow : .cancel)
        }
    }
}

/// WKUserContentController keeps its handlers; this proxy keeps the
/// coordinator from living forever.
final class WeakMessageHandler: NSObject, WKScriptMessageHandler {
    weak var target: WKScriptMessageHandler?
    init(_ target: WKScriptMessageHandler) { self.target = target }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        target?.userContentController(userContentController, didReceive: message)
    }
}
