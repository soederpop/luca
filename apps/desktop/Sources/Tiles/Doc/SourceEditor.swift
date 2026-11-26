import SwiftUI
import WebKit
import Combine

/// The text a source editor edits: a workbench doc's or file's
/// `WorkbenchDocBuffer`. The editor reads the whole file,
/// follows its changes, and writes back what the page types.
@MainActor
protocol SourceEditorText: AnyObject {
    var editorText: String { get }
    var editorTextChanges: AnyPublisher<String, Never> { get }
    func editorSetText(_ text: String)
}

/// Which view a doc tile shows.
enum DocEditorView: String {
    case preview, rich, source
}

/// The `source` view: CodeMirror 6 with vim keys in a web view. The page is
/// one built file (`Resources/source-editor.html`, from `editor/`), loaded
/// from disk with no network. Text flows both ways through the doc buffer.
@MainActor
final class SourceEditorController: NSObject, WKScriptMessageHandler {
    let webView: WKWebView
    private let buffer: SourceEditorText
    private let language: String
    private var ready = false
    /// The text the page holds, so a buffer change the page made is not sent back.
    private var pageText: String?
    private var watch: AnyCancellable?

    /// The page's vim mode: `normal`, `insert`, `visual`, `replace`, or `off`.
    private(set) var vimMode = "normal"
    var onSave: () -> Void = {}
    var onClose: () -> Void = {}
    /// `Esc` with nothing left for the page to cancel (vim Normal, or vim off).
    var onEscape: () -> Void = {}
    var onVimChanged: (Bool) -> Void = { _ in }

    /// Kept across launches: `:set vim` and `:set novim`.
    static var vimDefault: Bool {
        get { UserDefaults.standard.object(forKey: "tiles.source.vim") as? Bool ?? true }
        set { UserDefaults.standard.set(newValue, forKey: "tiles.source.vim") }
    }

    init(buffer: SourceEditorText, language: String) {
        self.buffer = buffer
        self.language = language
        let config = WKWebViewConfiguration()
        let controller = WKUserContentController()
        config.userContentController = controller
        webView = EditorWebView(frame: .zero, configuration: config)
        super.init()
        controller.add(WeakMessageHandler(self), name: "tiles")
        webView.setValue(false, forKey: "drawsBackground")
        if let url = Self.pageURL, let html = try? String(contentsOf: url, encoding: .utf8) {
            webView.loadHTMLString(html, baseURL: nil)
        } else {
            webView.loadHTMLString("<body style='color:#c66;font:13px monospace;padding:16px'>source-editor.html is missing from the app bundle. Rebuild it with scripts/build-app.sh.</body>", baseURL: nil)
        }
        watch = buffer.editorTextChanges
            .receive(on: DispatchQueue.main)
            .sink { [weak self] text in self?.push(text) }
    }

    /// The built page: in the app bundle, else next to the sources (a
    /// debug build or a test run).
    static var pageURL: URL? {
        if let url = Bundle.main.url(forResource: "source-editor", withExtension: "html") { return url }
        let local = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent().deletingLastPathComponent()
            .deletingLastPathComponent().deletingLastPathComponent()
            .appendingPathComponent("Resources/source-editor.html")
        return FileManager.default.fileExists(atPath: local.path) ? local : nil
    }

    /// CodeMirror's language for a path, by extension.
    static func language(for path: String) -> String {
        switch (path as NSString).pathExtension.lowercased() {
        case "yml", "yaml": return "yaml"
        case "ts", "tsx", "mts": return "typescript"
        case "js", "jsx", "mjs", "cjs": return "javascript"
        case "json": return "json"
        case "swift": return "swift"
        case "md", "markdown": return "markdown"
        case "css": return "css"
        case "html", "htm": return "html"
        default: return "markdown"
        }
    }

    /// True when the page has the keyboard.
    var hasFocus: Bool {
        guard let responder = webView.window?.firstResponder as? NSView else { return false }
        return responder === webView || responder.isDescendant(of: webView)
    }

    func focus() {
        webView.window?.makeFirstResponder(webView)
        run("tilesEditor.focus()")
    }

    func setVim(_ on: Bool) {
        Self.vimDefault = on
        run("tilesEditor.setVim(\(on))")
        vimMode = on ? "normal" : "off"
    }

    private func push(_ text: String) {
        guard ready, text != pageText else { return }
        pageText = text
        run("tilesEditor.setText(\(Self.json(text)))")
    }

    private func load() {
        pageText = buffer.editorText
        let args: [String: Any] = [
            "text": buffer.editorText,
            "language": language,
            "vim": Self.vimDefault,
            "vars": Self.themeVars,
            "scheme": ThemeSettings.currentDark ? "dark" : "light",
        ]
        guard let data = try? JSONSerialization.data(withJSONObject: args),
              let json = String(data: data, encoding: .utf8) else { return }
        run("tilesEditor.load(\(json))")
    }

    private func run(_ script: String) {
        webView.evaluateJavaScript(script) { _, error in
            if let error { AppLogger.error("source editor: \(error.localizedDescription)") }
        }
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any], let kind = body["kind"] as? String else { return }
        switch kind {
        case "ready":
            ready = true
            load()
        case "change":
            guard let text = body["text"] as? String else { return }
            pageText = text
            buffer.editorSetText(text)
        case "save": onSave()
        case "close": onClose()
        case "escape": onEscape()
        case "vim":
            let on = body["on"] as? Bool ?? true
            Self.vimDefault = on
            onVimChanged(on)
        case "mode":
            vimMode = body["mode"] as? String ?? "normal"
        default: break
        }
    }

    /// The kit's colors as the `--al-*` variables the page reads.
    static var themeVars: [String: String] {
        let p = Theme.palette
        let pairs: [(String, KitColor)] = [
            ("ground", p.ground), ("surface", p.surface), ("raised", p.raised), ("inset", p.inset),
            ("border", p.border), ("border-strong", p.borderStrong), ("text", p.text),
            ("text-body", p.textBody), ("text-muted", p.textMuted), ("text-faint", p.textFaint),
            ("accent", p.accent), ("accent-on", p.accentOn), ("accent-soft", p.accentSoft),
            ("good", p.good), ("warn", p.warn), ("bad", p.bad), ("info", p.info),
            ("syntax-keyword", p.syntax.keyword), ("syntax-string", p.syntax.string), ("syntax-number", p.syntax.number),
            ("syntax-comment", p.syntax.comment), ("syntax-property", p.syntax.property), ("syntax-type", p.syntax.type),
            ("syntax-function", p.syntax.function),
        ]
        return Dictionary(uniqueKeysWithValues: pairs.map { ("--al-\($0.0)", $0.1.hex) })
    }

    static func json(_ text: String) -> String {
        guard let data = try? JSONSerialization.data(withJSONObject: [text]),
              let array = String(data: data, encoding: .utf8) else { return "\"\"" }
        return String(array.dropFirst().dropLast())
    }

    /// For tests and the manual check: the page's own text.
    func pageContents() async -> String? {
        try? await webView.evaluateJavaScript("tilesEditor.text()") as? String
    }

    /// For tests: type keys as vim would see them.
    func sendKeys(_ keys: String) {
        run("tilesEditor.keys(\(Self.json(keys)))")
    }
}

/// The web view never takes `Mod` keys: the app's key monitor sees them first
/// and swallows any it does not bind, so left Option never types into the page.
final class EditorWebView: WKWebView {
    override var acceptsFirstResponder: Bool { true }
}

struct SourceEditorView: NSViewRepresentable {
    let controller: SourceEditorController

    func makeNSView(context: Context) -> WKWebView { controller.webView }
    func updateNSView(_ nsView: WKWebView, context: Context) {}
}
