import XCTest
import WebKit
@testable import LucaDesktop

final class CanvasTests: XCTestCase {
    func testLockdownLetsLocalTailnetAndUnpkgThrough() {
        let allowed = [
            "http://127.0.0.1:49500/canvas/demo/?key=x",
            "ws://127.0.0.1:49500/canvas/demo/link",
            "http://localhost:3000/data",
            "ws://localhost:4000/",
            "http://[::1]:3000/",
            "https://gpubox.example.ts.net/api",
            "http://gpubox.example.ts.net:8001/v1",
            "http://100.64.0.1:1234/v1",
            "http://100.101.2.3/",
            "http://100.127.255.255:80/",
            "https://unpkg.com/d3@7?module",
            "data:image/png;base64,AAAA",
            "blob:http://127.0.0.1:49500/abc",
            "about:blank",
        ]
        for text in allowed {
            XCTAssertTrue(CanvasLockdown.allows(URL(string: text)!), text)
        }
    }

    func testLockdownBlocksEverythingElse() {
        let blocked = [
            "https://example.com/",
            "https://esm.sh/d3@7",
            "https://cdn.jsdelivr.net/npm/d3",
            "http://unpkg.com/d3",
            "https://unpkg.com.evil.com/x",
            "http://127.0.0.1.evil.com/x",
            "http://localhost.evil.com/x",
            "http://100.63.0.1/",
            "http://100.128.0.1/",
            "http://192.168.1.10:3000/",
            "https://ts.net.evil.com/",
        ]
        for text in blocked {
            XCTAssertFalse(CanvasLockdown.allows(URL(string: text)!), text)
        }
    }

    /// WebKit's url-filter has no alternation; a `|` makes the whole list fail to compile.
    func testRulesUseNoAlternation() throws {
        for pattern in CanvasLockdown.allowedPatterns { XCTAssertFalse(pattern.contains("|"), pattern) }
        let rules = try JSONSerialization.jsonObject(with: Data(CanvasLockdown.rulesJSON.utf8)) as! [[String: Any]]
        XCTAssertEqual((rules.first?["action"] as? [String: String])?["type"], "block")
        XCTAssertEqual(rules.count, CanvasLockdown.allowedPatterns.count + 1)
    }

    @MainActor
    func testRulesCompileInWebKit() async throws {
        let list = try await CanvasLockdown.ruleList()
        XCTAssertEqual(list.identifier, CanvasLockdown.identifier)
    }

    func testSlugAndPageURL() {
        XCTAssertEqual(CanvasContent.slug("My Sales Chart!"), "my-sales-chart")
        XCTAssertEqual(CanvasContent.slug("  "), "")
        let url = CanvasContent.pageURL(base: URL(string: "http://127.0.0.1:5123")!, id: "demo", key: "abc")
        XCTAssertEqual(url?.absoluteString, "http://127.0.0.1:5123/canvas/demo/?key=abc")
        XCTAssertEqual(CanvasContent.address(project: "luca", id: "demo").description, "luca://luca/canvas/demo")
    }

    func testCanvasShapesDecode() throws {
        let canvas = try JSONDecoder().decode(WorkbenchCanvas.self, from: Data("""
        {"id":"demo","title":"Demo","open":true,"width":640,"height":480,"evals":2,"createdAt":"2026-11-25T00:00:00Z",
         "url":"http://127.0.0.1:49500/canvas/demo/?key=73c463cc791a48969253b41ca40730c8"}
        """.utf8))
        XCTAssertEqual(canvas.key, "73c463cc791a48969253b41ca40730c8")
        let frame = try JSONDecoder().decode(WorkbenchEvent.self, from: Data("""
        {"type":"canvas-snapshot","id":"demo","requestId":"r1","at":1}
        """.utf8))
        XCTAssertEqual(frame.requestId, "r1")
        XCTAssertEqual(frame.id, "demo")
    }

    @MainActor
    func testCanvasKindIsRegistered() {
        TileKinds.registerBuiltIns()
        XCTAssertNotNil(TileKinds.kind(for: CanvasContent.address(project: "p", id: "c")))
    }
}
