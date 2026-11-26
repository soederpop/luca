import XCTest
@testable import LucaDesktop

final class TileURITests: XCTestCase {
    /// Addresses the app opens, and layout templates, print back as parsed.
    static let examples = [
        "luca://luca/project",
        "luca://luca/registry?stack=features",
        "luca://luca/helper/features/fs",
        "luca://luca/doc/notes/ux.md?view=rich",
        "luca://luca/chat/new?assistant=helper",
        "luca://luca/request/GET/users/:id?id=4",
        "luca://luca/file/src/workbench/host.ts",
        "luca://luca/page/health?verbose=1",
        "luca://luca/page/https://example.com/x",
        "luca://luca/terminal",
        "luca://{project}/doc/{doc}?view=rich",
        "app://desktop/file/keymap.yml",
        "app://desktop/projects",
    ]

    func testEveryExampleRoundTrips() {
        for text in Self.examples {
            guard let uri = TileURI(text) else { return XCTFail("did not parse \(text)") }
            XCTAssertEqual(uri.description, text)
            XCTAssertEqual(TileURI(uri.description), uri)
        }
    }

    func testParts() throws {
        let doc = try XCTUnwrap(TileURI("luca://shop/doc/notes/ux.md?view=rich"))
        XCTAssertEqual(doc.authority, "shop")
        XCTAssertEqual(doc.kind, "doc")
        XCTAssertEqual(doc.id, "notes/ux.md")
        XCTAssertEqual(doc.option("view"), "rich")
        let page = try XCTUnwrap(TileURI("luca://shop/page/https://example.com/a/b"))
        XCTAssertEqual(page.id, "https://example.com/a/b")
        let index = try XCTUnwrap(TileURI("luca://shop/docs"))
        XCTAssertNil(index.id)
        XCTAssertEqual(index.kindKey, "luca-docs")
    }

    func testEscapesWhatWouldBreakTheParse() throws {
        let uri = TileURI(authority: "shop", kind: "doc", id: "notes/a?b&c.md", options: [.init(name: "q", value: "x&y")])
        XCTAssertEqual(TileURI(uri.description), uri)
    }

    func testRejectsOtherSchemes() {
        XCTAssertNil(TileURI("https://acme/ideas"))
        XCTAssertNil(TileURI("other://acme/ideas"))
        XCTAssertNil(TileURI("luca://acme"))
        XCTAssertNil(TileURI("luca:///docs"))
    }

    func testCodableAsString() throws {
        let uri = try XCTUnwrap(TileURI("luca://shop/chat/c1?assistant=helper"))
        let data = try JSONEncoder().encode([uri])
        XCTAssertEqual(String(data: data, encoding: .utf8), #"["luca:\/\/shop\/chat\/c1?assistant=helper"]"#)
        XCTAssertEqual(try JSONDecoder().decode([TileURI].self, from: data), [uri])
    }
}
