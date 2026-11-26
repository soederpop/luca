import XCTest
import AppKit
@testable import LucaDesktop

/// The app is a workbench only. Every kind is a workbench tool or an app
/// tile, and saved state with another scheme is skipped.
@MainActor
final class WorkbenchShellTests: XCTestCase {
    override func setUp() {
        super.setUp()
        TileKinds.registerBuiltIns()
    }

    private var map: Keymap { Keymap.merged(defaults: DefaultKeymap.file, user: nil) }

    func testOnlyWorkbenchAndAppKindsAreRegistered() {
        XCTAssertFalse(TileKinds.all.isEmpty)
        for (id, kind) in TileKinds.all {
            XCTAssertTrue(id.hasPrefix("luca-") || id.hasPrefix("app-"), "\(id) is not a workbench or app kind")
            XCTAssertFalse(kind.label.isEmpty, id)
            XCTAssertNotNil(NSImage(systemSymbolName: kind.glyph, accessibilityDescription: nil), "\(id): no SF Symbol \(kind.glyph)")
        }
        for id in ["luca-terminal", "luca-file", "luca-page", "app-file", "app-projects"] {
            XCTAssertNotNil(TileKinds.kind(id), id)
            XCTAssertFalse(map.bindings(in: .kind, kind: id).isEmpty, "\(id) has no keys of its own")
        }
        XCTAssertEqual(TileKinds.kind(for: TileURI("luca://shop/terminal")!)?.id, "luca-terminal")
        XCTAssertEqual(TileKinds.kind(for: TileURI.app("file", id: "keymap.yml"))?.id, "app-file")
    }

    func testKeysAreValidAndLeaderKeysAreUnique() {
        XCTAssertEqual(DefaultKeymap.file.warnings, [])
        for binding in map.bindings {
            if binding.scope == .kind, let kind = binding.kind {
                XCTAssertNotNil(TileKinds.kind(kind), "\(binding.action) is scoped to a kind that does not exist: \(kind)")
            }
        }
        let leader = map.bindings(in: .leader).compactMap { $0.keys?.display(modSymbol: map.modSymbol) }
        XCTAssertEqual(leader.count, Set(leader).count, "\(leader)")
        XCTAssertEqual(map.keyLabel(for: "luca.docs"), "Space d")
        XCTAssertEqual(map.keyLabel(for: "luca.assistants"), "Space c")
        XCTAssertEqual(map.keyLabel(for: "luca.chat"), "Space n")
        XCTAssertEqual(map.keyLabel(for: "palette.projects"), "Space p")
        XCTAssertEqual(map.keyLabel(for: "luca.terminal"), "Space t")
        XCTAssertEqual(map.keyLabel(for: "luca.file"), "Space f")
    }

    func testIndexKindsShareTheIndexKeys() {
        for id in Keymap.indexKinds {
            XCTAssertNotNil(TileKinds.kind(id), id)
            XCTAssertTrue(map.kindBindings(id).contains { $0.action == "index.open" }, id)
        }
    }

    /// In Insert mode the terminal's way out is a global key.
    func testTerminalLeaveIsRoutedInInsertMode() {
        var router = KeyRouter(keymap: map)
        router.mode = .insert
        guard let stroke = map.binding(for: "terminal.leave")?.keys?.strokes.first else { return XCTFail("unbound") }
        XCTAssertTrue(stroke.mod)
        XCTAssertEqual(router.route(stroke, kind: "luca-terminal"), .action("terminal.leave", count: nil))
        XCTAssertEqual(router.route(KeyStroke(key: "j"), kind: "luca-terminal"), .passThrough)
    }

    func testPageAddresses() {
        XCTAssertEqual(PageContent.address(project: "shop", typed: "health").description, "luca://shop/page/health")
        XCTAssertEqual(PageContent.address(project: "shop", typed: "/app/x?kiosk=1").description, "luca://shop/page/app/x?kiosk=1")
        XCTAssertEqual(PageContent.address(project: "shop", typed: "").description, "luca://shop/page")
        let web = PageContent.address(project: "shop", typed: "https://example.com/a?b=1")
        XCTAssertEqual(PageContent.externalURL(web)?.absoluteString, "https://example.com/a?b=1")
        XCTAssertNil(PageContent.externalURL(TileURI("luca://shop/page/health")!))
        XCTAssertEqual(PageContent.path(for: TileURI("luca://shop/page")!), "/")
        XCTAssertEqual(PageContent.path(for: TileURI("luca://shop/page/app?x=my%20tag")!), "/app?x=my%20tag")
        XCTAssertEqual(PageContent.serveURL(base: "http://127.0.0.1:3100/", uri: TileURI("luca://shop/page/health")!)?.absoluteString,
                       "http://127.0.0.1:3100/health")
        XCTAssertNil(PageContent.serveURL(base: nil, uri: TileURI("luca://shop/page/health")!))
    }

    func testPageStaysOnItsOriginButItsFramesMayLeave() {
        let origin = TileWebView.origin(of: URL(string: "http://127.0.0.1:3100/app")!)
        let other = URL(string: "http://example.com/x")!
        XCTAssertTrue(TileWebView.allows(URL(string: "http://127.0.0.1:3100/health")!, origin: origin, mainFrame: true))
        XCTAssertFalse(TileWebView.allows(other, origin: origin, mainFrame: true))
        XCTAssertTrue(TileWebView.allows(other, origin: origin, mainFrame: false))
    }

    func testFileAddressesAndAppFiles() throws {
        XCTAssertEqual(FileContent.address(project: "shop", path: "./src/a.ts").description, "luca://shop/file/src/a.ts")
        let folder = FileManager.default.temporaryDirectory.appendingPathComponent("luca-desktop-file-\(UUID().uuidString)")
        defer { try? FileManager.default.removeItem(at: folder) }
        let url = folder.appendingPathComponent("keymap.yml")
        let empty = try FileContent.readLocal(url, display: "keymap.yml")
        XCTAssertEqual(empty.file, "")
        XCTAssertEqual(empty.digest, "da39a3ee5e6b4b0d3255bfef95601890afd80709", "sha1 of no bytes, as the host gives it")
        let saved = try FileContent.saveLocal(url, display: "keymap.yml", text: "a: 1\n", digest: empty.digest)
        XCTAssertEqual(try String(contentsOf: url, encoding: .utf8), "a: 1\n")
        XCTAssertEqual(saved.view?.file, "a: 1\n")
        XCTAssertThrowsError(try FileContent.saveLocal(url, display: "keymap.yml", text: "b", digest: empty.digest)) { error in
            XCTAssertEqual((error as? WorkbenchDocConflict)?.current?.file, "a: 1\n")
        }
    }

    /// A `state.json` with tiles of another scheme: those are skipped, the rest load.
    func testSavedStateSkipsOtherSchemes() throws {
        let a = UUID(), b = UUID()
        let json = """
        {"version": 1, "current": 0, "keysView": true, "lastProject": "@acme",
         "tiles": [{"id": "\(a.uuidString)", "uri": "other://acme/ideas"}, {"id": "\(b.uuidString)", "uri": "luca://shop/console"}],
         "workspaces": []}
        """
        let state = try JSONDecoder().decode(SavedState.self, from: Data(json.utf8))
        XCTAssertEqual(state.tiles.map(\.id), [b])
        XCTAssertEqual(state.skipped, ["other://acme/ideas"])
        let again = try JSONDecoder().decode(SavedState.self, from: try JSONEncoder().encode(state))
        XCTAssertEqual(again.tiles.map(\.uri), [TileURI("luca://shop/console")!])
    }

    func testOwnersAndWorkspaceNames() {
        XCTAssertEqual(Shell.owner(of: TileURI("luca://shop/console")!), "luca:shop")
        XCTAssertEqual(Shell.owner(of: TileURI.app("projects")), Shell.appOwner)
        XCTAssertEqual(Shell.mainOwner(["luca:a", "luca:b", "luca:b", "app", "app", "app"]), "luca:b")
        XCTAssertEqual(Shell.mainOwner(["luca:b", "luca:a"]), "luca:a", "a tie goes to the first name")
        XCTAssertNil(Shell.mainOwner(["app"]))
    }

    func testProjectsOnScreenGetDifferentColorsWhileSlotsLast() {
        let names = ["luca", "shop", "acme", "site", "api", "docs", "tools", "web"]
        let slots = OwnerColors.slots(names: names, count: 8)
        XCTAssertEqual(Set(slots.values).count, 8)
        XCTAssertEqual(OwnerColors.slots(names: names.reversed(), count: 8), slots)
        XCTAssertEqual(OwnerColors.index("luca", slots: 8), OwnerColors.index("luca", slots: 8))
    }
}
