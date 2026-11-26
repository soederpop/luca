import AppKit
import Combine
import WebKit

/// The host side of the theme kit's contract for one web tile (a page).
///
/// Before a page loads, `window.__AL_HOST__` holds `{ kind: 'tile', width,
/// height, focused, scheme, accent, textSize, project: { id, color }, vars }`.
/// After, each change fires `al:host` with the changed fields. The page
/// posts to the `alHost` handler: `{ kind: 'open', uri }` opens a tile,
/// `{ kind: 'keys', keys }` lists its keys for the shell and the keys view,
/// and `{ kind: 'editing', on }` (from the script below) says a page field
/// has the keyboard. A page may also ask for a shell element (`ShellRequest`):
/// the palette as a picker, a question, a confirm, a status-line note.
/// `__AL_HOST__.shell` lists what this app answers.
@MainActor
final class WebTileHost: ObservableObject {
    static let handlerName = "alHost"

    /// Page keys, newest binding first.
    @Published private(set) var pageKeys: [PageKey] = []
    /// A field in the page has the keyboard: the shell is in Insert mode.
    @Published private(set) var editing = false
    /// The user gave every key to the page (`i`): Insert mode, and `Esc`
    /// goes to the page too. For a page with its own keys or an editor the
    /// field check below can't see. `Mod-Esc` takes the keys back.
    @Published private(set) var pageHasKeys = false
    /// Either one: the shell is in Insert mode for this tile.
    var hasKeyboard: Bool { editing || pageHasKeys }
    /// The web area's size in points, debounced.
    @Published private(set) var size: CGSize = .zero

    /// The project the page belongs to: it may open that project's tiles only.
    let project: String
    private(set) var tileId: UUID
    private var webViews: [WeakWebView] = []
    private var focused = false
    private var bag = Set<AnyCancellable>()
    private var sizeTask: Task<Void, Never>?

    init(project: String, tileId: UUID) {
        self.project = project
        self.tileId = tileId
        Shell.shared.$focusedId
            .map { [weak self] id in id != nil && id == self?.tileId }
            .removeDuplicates()
            .sink { [weak self] on in
                guard let self else { return }
                self.focused = on
                self.push(["focused": on])
            }
            .store(in: &bag)
        ThemeSettings.shared.$revision
            .dropFirst()
            .removeDuplicates()
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in
                guard let self else { return }
                var changed = ThemeSettings.shared.hostTheme()
                changed["project"] = ["id": self.project, "color": self.projectColor]
                self.push(changed)
            }
            .store(in: &bag)
    }

    func setTile(_ id: UUID) { tileId = id }

    /// Page zoom, for a page that does not size its text from the app
    /// (`PageContent`). 1 leaves the page as it is.
    var zoom: CGFloat = 1 {
        didSet { for weak in webViews { weak.view?.pageZoom = zoom } }
    }

    var projectColor: String {
        (Theme.ownerKitColor(ProjectHub.ownerId(project)) ?? Theme.palette.accent).hex
    }

    /// Everything the page gets, for `window.__AL_HOST__`.
    var values: [String: Any] {
        var out = ThemeSettings.shared.hostTheme()
        out["kind"] = "tile"
        out["width"] = Int(size.width.rounded())
        out["height"] = Int(size.height.rounded())
        out["focused"] = focused
        out["project"] = ["id": project, "color": projectColor]
        out["shell"] = ShellRequest.names
        return out
    }

    // MARK: Web views

    /// Set up a new web view's configuration: the handler and the script
    /// that seeds `__AL_HOST__` on every load.
    func install(in controller: WKUserContentController, handler: WKScriptMessageHandler) {
        controller.add(WeakMessageHandler(handler), name: Self.handlerName)
        controller.addUserScript(seedScript())
        // Every frame: a field inside an iframe counts too.
        controller.addUserScript(WKUserScript(source: Self.editingScript, injectionTime: .atDocumentEnd, forMainFrameOnly: false))
    }

    /// A PNG of the page as it shows now, at most `maxWidth` points wide.
    /// Nil when no web view is on screen.
    func snapshotPNG(maxWidth: CGFloat = 1200) async -> (data: Data, width: Int, height: Int)? {
        let views = webViews.compactMap(\.view)
        guard let view = views.first(where: { $0.window != nil }) else { return nil }
        let config = WKSnapshotConfiguration()
        if view.bounds.width > maxWidth { config.snapshotWidth = NSNumber(value: Double(maxWidth)) }
        guard let image = try? await view.takeSnapshot(configuration: config),
              let cg = image.cgImage(forProposedRect: nil, context: nil, hints: nil),
              let png = NSBitmapImageRep(cgImage: cg).representation(using: .png, properties: [:])
        else { return nil }
        return (png, cg.width, cg.height)
    }

    func attach(_ webView: WKWebView) {
        webViews.removeAll { $0.view == nil || $0.view === webView }
        webViews.append(WeakWebView(view: webView))
        if zoom != 1 { webView.pageZoom = zoom }
    }

    private func seedScript() -> WKUserScript {
        WKUserScript(source: "window.__AL_HOST__ = \(Self.json(values));", injectionTime: .atDocumentStart, forMainFrameOnly: true)
    }

    /// Send changed fields to every live page, and reseed the next load.
    func push(_ changed: [String: Any]) {
        for weak in webViews {
            guard let view = weak.view else { continue }
            let controller = view.configuration.userContentController
            let scripts = controller.userScripts.filter { !$0.source.hasPrefix("window.__AL_HOST__ =") }
            controller.removeAllUserScripts()
            controller.addUserScript(seedScript())
            for script in scripts { controller.addUserScript(script) }
            let detail = Self.json(changed)
            view.evaluateJavaScript("(function(d){window.__AL_HOST__=Object.assign(window.__AL_HOST__||{},d);window.dispatchEvent(new CustomEvent('al:host',{detail:d}))})(\(detail))", completionHandler: nil)
        }
    }

    /// The tile's web area changed size. The page hears after 100 ms of quiet.
    func resized(_ next: CGSize) {
        guard next.width > 0, next.height > 0 else { return }
        sizeTask?.cancel()
        sizeTask = Task { [weak self] in
            try? await Task.sleep(for: .milliseconds(100))
            guard let self, !Task.isCancelled else { return }
            let rounded = CGSize(width: next.width.rounded(), height: next.height.rounded())
            guard rounded != self.size else { return }
            self.size = rounded
            self.push(["width": Int(rounded.width), "height": Int(rounded.height)])
        }
    }

    // MARK: Page messages

    /// The tile a page may open: a `luca://` address of its own project, or
    /// a bare tool path (`console`, `doc/notes/a.md`) under it. Nil for any
    /// other. Pure, so the rule is tested.
    nonisolated static func address(_ text: String, project: String) -> TileURI? {
        let trimmed = text.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return nil }
        if trimmed.contains("://") {
            guard let uri = TileURI(trimmed), uri.project == project else { return nil }
            return uri
        }
        let path = trimmed.hasPrefix("/") ? String(trimmed.dropFirst()) : trimmed
        return TileURI(TileURI.lucaScheme + project + "/" + path)
    }

    func handle(_ body: [String: Any]) {
        switch body["kind"] as? String {
        case "open":
            guard let text = body["uri"] as? String else { return }
            guard let uri = Self.address(text, project: project) else {
                return Shell.shared.flash("The page asked for \(text): a page opens only its own project's tiles")
            }
            if let open = Shell.shared.tiles.values.first(where: { $0.uri == uri }) { Shell.shared.focusTile(open.id) }
            else { Shell.shared.open(uri, near: tileId) }
        case "keys":
            pageKeys = PageKey.list(from: body["keys"])
            Shell.shared.pageKeysTick += 1
        case "editing":
            let on = body["on"] as? Bool ?? false
            if on != editing {
                editing = on
                Shell.shared.syncTextMode()
            }
        default:
            if let request = ShellRequest(body) { shell(request) }
        }
    }

    // MARK: Shell elements for the page

    /// Requests that wait for an answer.
    private var waiting = Set<String>()

    private func shell(_ request: ShellRequest) {
        switch request {
        case .flash(let text):
            Shell.shared.flash(text)
        case .choose(let id, let title, let items):
            guard begin(id) else { return }
            PaletteController.shared.choose(title, items.enumerated().map { index, item in
                PaletteChoice(title: item.title, detail: item.detail) { [weak self] in self?.reply(id, index) }
            })
            watchEnd(id)
        case .ask(let id, let title, let initial):
            guard begin(id) else { return }
            PaletteController.shared.ask(title, initial: initial) { [weak self] answer in self?.reply(id, answer) }
            watchEnd(id)
        case .confirm(let id, let question, let yes):
            guard begin(id) else { return }
            PaletteController.shared.choose(question, [
                PaletteChoice(title: "Cancel", detail: "do nothing") { [weak self] in self?.reply(id, false) },
                PaletteChoice(title: yes, detail: "") { [weak self] in self?.reply(id, true) },
            ])
            watchEnd(id)
        }
    }

    /// Only the tile in focus may take the keyboard. Any other gets null.
    private func begin(_ id: String) -> Bool {
        waiting.insert(id)
        guard focused else {
            reply(id, nil)
            return false
        }
        return true
    }

    /// Esc, or an empty answer: the page hears null. A pick closes the
    /// palette first and answers right after, so this waits one turn.
    private func watchEnd(_ id: String) {
        Shell.shared.palette.onEnd = { [weak self] in
            DispatchQueue.main.async { self?.reply(id, nil) }
        }
    }

    private func reply(_ id: String, _ value: Any?) {
        guard waiting.remove(id) != nil else { return }
        let script = ShellRequest.replyScript(id: id, value: value)
        for weak in webViews { weak.view?.evaluateJavaScript(script, completionHandler: nil) }
    }

    func key(for stroke: KeyStroke) -> PageKey? {
        pageKeys.first { $0.matches(stroke) }
    }

    func press(_ key: PageKey) {
        for weak in webViews { weak.view?.evaluateJavaScript(key.pressScript, completionHandler: nil) }
    }

    /// `i`: every key goes to the page until `Mod-Esc`.
    func takeKeys() {
        pageHasKeys = true
        if let view = webViews.compactMap(\.view).first(where: { $0.window != nil }) {
            view.window?.makeFirstResponder(view)
        }
        Shell.shared.syncTextMode()
    }

    /// `Esc` from a page field, or `Mod-Esc`: give the keyboard back to the shell.
    func blur() {
        editing = false
        pageHasKeys = false
        for weak in webViews { weak.view?.evaluateJavaScript("document.activeElement && document.activeElement.blur && document.activeElement.blur()", completionHandler: nil) }
    }

    /// Tells the host when a text field in the page has focus. It runs in
    /// every frame and looks through shadow roots. It sends each change
    /// with no memory of the last one: the frames do not know of each
    /// other, and the host drops a repeat.
    static let editingScript = """
    (function () {
      var h = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.alHost
      if (!h) return
      var roles = { textbox: 1, searchbox: 1, combobox: 1, spinbutton: 1 }
      var buttons = { button: 1, submit: 1, reset: 1, checkbox: 1, radio: 1, range: 1, color: 1, file: 1, image: 1 }
      var active = function () {
        var el = document.activeElement
        while (el && el.shadowRoot && el.shadowRoot.activeElement) el = el.shadowRoot.activeElement
        return el
      }
      var editable = function (el) {
        if (!el || el === document.body || el === document.documentElement) return false
        var t = el.tagName
        if (t === 'INPUT') return !buttons[(el.type || '').toLowerCase()]
        if (t === 'TEXTAREA' || t === 'SELECT' || el.isContentEditable) return true
        return !!roles[(el.getAttribute && el.getAttribute('role')) || '']
      }
      var tell = function () {
        var el = active()
        // The frame inside reports its own fields.
        if (el && (el.tagName === 'IFRAME' || el.tagName === 'FRAME')) return
        try { h.postMessage({ kind: 'editing', on: editable(el) }) } catch (_) {}
      }
      document.addEventListener('focusin', tell, true)
      document.addEventListener('focusout', function () { setTimeout(tell, 0) }, true)
      // A field with autofocus has focus before this script runs. A top
      // page with none says so, which clears the last page's state.
      if (window === window.top || editable(active())) tell()
    })();
    """

    static func json(_ value: Any) -> String {
        guard JSONSerialization.isValidJSONObject(value),
              let data = try? JSONSerialization.data(withJSONObject: value, options: [.sortedKeys]),
              let text = String(data: data, encoding: .utf8) else { return "{}" }
        return text
    }

    private struct WeakWebView {
        weak var view: WKWebView?
    }
}
