import XCTest
import WebKit
@testable import LucaDesktop

/// The script that tells a web tile's host a page field has the keyboard.
@MainActor
final class PageEditingTests: XCTestCase {
    private final class Sink: NSObject, WKScriptMessageHandler {
        var states: [Bool] = []
        func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
            guard let body = message.body as? [String: Any], body["kind"] as? String == "editing",
                  let on = body["on"] as? Bool else { return }
            states.append(on)
        }
    }

    /// Load `html`, run `script`, and give the last state the page sent.
    /// `ready` is a JS test the page must pass first: an iframe's document
    /// loads after the main one, so a script that reaches into it must wait.
    private func lastState(html: String, ready: String = "true", then script: String = "") async throws -> Bool? {
        let sink = Sink()
        let config = WKWebViewConfiguration()
        config.userContentController.add(sink, name: WebTileHost.handlerName)
        config.userContentController.addUserScript(
            WKUserScript(source: WebTileHost.editingScript, injectionTime: .atDocumentEnd, forMainFrameOnly: false))
        let view = WKWebView(frame: NSRect(x: 0, y: 0, width: 400, height: 300), configuration: config)
        view.loadHTMLString(html, baseURL: nil)
        for _ in 0..<100 where sink.states.isEmpty { try await Task.sleep(for: .milliseconds(50)) }
        if !script.isEmpty {
            for _ in 0..<100 {
                if try await view.evaluateJavaScript("!!(\(ready))") as? Bool == true { break }
                try await Task.sleep(for: .milliseconds(50))
            }
            _ = try await view.evaluateJavaScript(script + "; 0")
            try await Task.sleep(for: .milliseconds(300))
        }
        return sink.states.last
    }

    func testPageWithNoFieldSaysNotEditing() async throws {
        let state = try await lastState(html: "<body><p>plain</p></body>")
        XCTAssertEqual(state, false)
    }

    func testFieldFocusedBeforeTheScriptRunsCounts() async throws {
        let state = try await lastState(html: "<body><input id=a><script>document.getElementById('a').focus()</script></body>")
        XCTAssertEqual(state, true)
    }

    func testFieldInsideAShadowRootCounts() async throws {
        let html = "<body><div id=host></div><script>var r=document.getElementById('host').attachShadow({mode:'open'});r.innerHTML='<input id=inner>'</script></body>"
        let state = try await lastState(html: html, then: "document.getElementById('host').shadowRoot.getElementById('inner').focus()")
        XCTAssertEqual(state, true)
    }

    func testRoleTextboxCountsAndAButtonDoesNot() async throws {
        let html = "<body><div id=box role=textbox tabindex=0></div><button id=go>go</button></body>"
        let box = try await lastState(html: html, then: "document.getElementById('box').focus()")
        XCTAssertEqual(box, true)
        let button = try await lastState(html: html, then: "document.getElementById('go').focus()")
        XCTAssertEqual(button, false)
    }

    func testFieldInsideAnIframeCounts() async throws {
        let html = "<body><iframe id=f srcdoc=\"<input id=a>\"></iframe></body>"
        let state = try await lastState(html: html, ready: "document.getElementById('f').contentDocument && document.getElementById('f').contentDocument.getElementById('a')", then: "var f=document.getElementById('f'); f.contentWindow.focus(); f.contentDocument.getElementById('a').focus()")
        XCTAssertEqual(state, true)
    }

    func testEveryWebTileHasThePageKeysKey() {
        let map = Keymap.merged(defaults: DefaultKeymap.file, user: nil)
        for action in ["lucaPage.keys", "terminal.leave"] {
            XCTAssertNotNil(map.binding(for: action), action)
        }
    }
}
