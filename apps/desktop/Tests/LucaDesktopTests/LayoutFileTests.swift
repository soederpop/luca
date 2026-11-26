import XCTest
@testable import LucaDesktop

final class LayoutFileTests: XCTestCase {
    let area = CGRect(x: 0, y: 24, width: 1440, height: 876)
    let gap: CGFloat = 6

    private func uris(_ ids: [UUID], _ names: [String]) -> [UUID: TileURI] {
        Dictionary(uniqueKeysWithValues: zip(ids, names.map { TileURI($0)! }))
    }

    /// Save writes the file text; load reads that text and builds a
    /// workspace on the same ids.
    private func roundTrip(_ ws: Workspace, _ addresses: [UUID: TileURI]) throws -> (LayoutFile, Workspace) {
        let saved = LayoutFile.capture(ws, name: "x", uri: { addresses[$0] }, area: area)
        let text = saved.yaml
        let loaded = try LayoutFile.parse(text, name: "x")
        XCTAssertEqual(loaded, saved, "parse(yaml) == capture\n\(text)")
        let (resolved, uris) = try loaded.resolve([:])
        let byURI = Dictionary(addresses.map { ($0.value, $0.key) }, uniquingKeysWith: { a, _ in a })
        let ids = uris.map { byURI[$0!]! }
        return (loaded, resolved.build(ids: ids, area: area, gap: gap))
    }

    func testOrganizedSaveThenLoadGivesTheSameTree() throws {
        let ids = (0..<5).map { _ in UUID() }
        let addresses = uris(ids, [
            "luca://acme/chat/s1?assistant=gpubox",
            "luca://acme/canvas/r1?chat=s1",
            "luca://acme/project/report-tools",
            "luca://acme/doc/projects/report-tools/overview.md?view=rich",
            "luca://acme-site/ideas",
        ])
        var ws = Workspace()
        ws.mode = .organized
        ws.tree = .split(.horizontal, 0.38,
                         .split(.vertical, 0.6, .leaf(ids[0]), .leaf(ids[1])),
                         .split(.vertical, 0.5, .leaf(ids[2]), .stack([ids[3], ids[4]], active: 1)))
        ws.tiles = ids
        ws.groups = [[ids[0], ids[1]]]
        ws.applyTree(in: area, gap: gap)

        let (file, built) = try roundTrip(ws, addresses)
        XCTAssertEqual(built.mode, .organized)
        XCTAssertEqual(built.tree, ws.tree)
        XCTAssertEqual(built.groups, ws.groups)
        XCTAssertEqual(built.frames, ws.frames)
        if case .split(_, _, .group, _)? = file.root {} else { XCTFail("the chat and canvas are a group node") }
    }

    func testOrganizedFloatingTileKeepsItsFrame() throws {
        let ids = (0..<3).map { _ in UUID() }
        let addresses = uris(ids, ["luca://acme/ideas", "luca://acme/projects", "luca://acme/chats"])
        var ws = Workspace()
        ws.mode = .organized
        ws.tree = .split(.horizontal, 0.5, .leaf(ids[0]), .leaf(ids[1]))
        ws.tiles = ids
        ws.floating = [ids[2]]
        ws.frames[ids[2]] = CGRect(x: 300, y: 200, width: 500, height: 400)
        ws.applyTree(in: area, gap: gap)

        let (_, built) = try roundTrip(ws, addresses)
        XCTAssertEqual(built.tree, ws.tree)
        XCTAssertEqual(built.floating, [ids[2]])
        XCTAssertEqual(built.frames, ws.frames)
    }

    func testFreeSaveThenLoadGivesTheSameFrames() throws {
        let ids = (0..<3).map { _ in UUID() }
        let addresses = uris(ids, ["luca://acme/chat/s1?assistant=gpubox", "luca://acme/canvas/r1", "luca://acme/ideas"])
        var ws = Workspace()
        ws.add(ids[0], frame: CGRect(x: 40, y: 300, width: 700, height: 560))
        ws.add(ids[1], frame: CGRect(x: 746, y: 300, width: 650, height: 560))
        ws.add(ids[2], frame: CGRect(x: 211, y: 37, width: 333, height: 241))
        ws.groups = [[ids[0], ids[1]]]

        let (file, built) = try roundTrip(ws, addresses)
        XCTAssertEqual(file.mode, .free)
        XCTAssertEqual(built.mode, .free)
        XCTAssertEqual(built.tiles, ws.tiles)
        XCTAssertEqual(built.frames, ws.frames)
        XCTAssertEqual(built.groups, ws.groups)
    }

    func testFramesAreFractionsFromTheTopLeft() {
        let top = CGRect(x: area.minX, y: area.maxY - 100, width: area.width / 2, height: 100)
        let f = LayoutFile.fraction(top, of: area)
        XCTAssertEqual(f[0], 0)
        XCTAssertEqual(f[1], 0)
        XCTAssertEqual(f[2], 0.5)
        XCTAssertEqual(LayoutFile.rect(f, in: area), top)
    }

    // MARK: Templates

    let cockpit = """
    mode: organized
    # ~/.luca/desktop/layouts/project-cockpit.yml
    name: project-cockpit
    params: [project, doc]
    root:
      split: horizontal
      ratio: 0.38
      children:
        - group:
            split: vertical
            ratio: 0.6
            children:
              - tile: luca://{project}/chat/new?assistant=helper
              - tile: luca://{project}/console
        - split: vertical
          ratio: 0.5
          children:
            - tile: luca://{project}/project
            - stack:
                - tile: luca://{project}/doc/{doc}?view=rich
                - tile: luca://{project}/terminal
    """

    func testTemplateResolvesFromTheTileInFocus() throws {
        let file = try LayoutFile.parse(cockpit)
        XCTAssertEqual(file.params, ["project", "doc"])
        let focused = TileURI("luca://shop/registry")!
        var values = LayoutParams.from(focused)
        XCTAssertEqual(values["project"], "shop")
        values["doc"] = "notes/a"

        let (_, uris) = try file.resolve(values)
        XCTAssertEqual(uris.map { $0?.description }, [
            "luca://shop/chat/new?assistant=helper",
            "luca://shop/console",
            "luca://shop/project",
            "luca://shop/doc/notes/a?view=rich",
            "luca://shop/terminal",
        ])
        let ids = uris.map { _ in UUID() }
        let ws = try file.resolve(values).file.build(ids: ids, area: area, gap: gap)
        XCTAssertEqual(ws.groups, [[ids[0], ids[1]]])
        XCTAssertEqual(ws.tree?.tiles, ids)
    }

    func testParamsComeFromTheFocusedProject() {
        XCTAssertEqual(LayoutParams.from(TileURI("luca://shop/doc/notes/a?view=rich")!), ["project": "shop"])
        XCTAssertEqual(LayoutParams.from(TileURI.app("file", id: "keymap.yml")), [:])
    }

    /// A tile of another scheme does not parse: that slot is nil, the
    /// rest resolve, so the shell skips one tile and loads the others.
    func testAnOtherSchemeIsASkippedSlotNotAnError() throws {
        let file = try LayoutFile.parse("mode: organized\nroot:\n  split: horizontal\n  children:\n    - tile: other://acme/ideas\n    - tile: luca://shop/console\n")
        let (_, uris) = try file.resolve([:])
        XCTAssertEqual(uris.map { $0?.description }, [nil, "luca://shop/console"])
    }

    func testMissingParamIsAnErrorNotAHalfLayout() throws {
        let file = try LayoutFile.parse(cockpit)
        XCTAssertThrowsError(try file.resolve(["project": "shop"])) { error in
            XCTAssertEqual((error as? LayoutError)?.message, "project-cockpit needs doc")
        }
    }

    func testBrokenFilesThrow() {
        let broken = [
            "mode: organized\nroot:\n  split: horizontal\n  children:\n    - tile: luca://a/ideas\n",
            "mode: organized\nroot: [unclosed\n",
            "mode: sideways\nroot:\n  tile: luca://a/ideas\n",
            "mode: organized\nroot:\n  tile: luca://{project}/ideas\n",
            "mode: free\ntiles:\n  - tile: luca://a/ideas\n    frame: [0, 0, 0.5]\n",
            "mode: organized\nroot:\n  split: horizontal\n  ratio: 1.5\n  children:\n    - tile: luca://a/ideas\n    - tile: luca://a/projects\n",
            "mode: organized\n",
            "- just a list\n",
        ]
        for text in broken {
            XCTAssertThrowsError(try LayoutFile.parse(text), text)
        }
    }

    func testBadAddressIsANilSlot() throws {
        let file = try LayoutFile.parse("mode: organized\nroot:\n  tile: not-an-address\n")
        XCTAssertEqual(try file.resolve([:]).uris, [nil])
    }

    func testScalarsQuoteWhenYAMLWouldMisread() {
        XCTAssertEqual(LayoutFile.scalar("luca://acme/ideas"), "luca://acme/ideas")
        XCTAssertEqual(LayoutFile.scalar("yes"), "\"yes\"")
        XCTAssertEqual(LayoutFile.scalar("a: b"), "\"a: b\"")
        XCTAssertEqual(LayoutFile.scalar("luca://{project}/docs"), "\"luca://{project}/docs\"")
    }
}

/// What a page may open: its own project's tiles only.
final class PageOpenPolicyTests: XCTestCase {
    func testAnotherProjectOrTheAppIsRefused() {
        XCTAssertNil(WebTileHost.address("luca://other/console", project: "shop"))
        XCTAssertNil(WebTileHost.address("app://desktop/file/keymap.yml", project: "shop"))
        XCTAssertNil(WebTileHost.address("other://shop/ideas", project: "shop"))
        XCTAssertNil(WebTileHost.address("", project: "shop"))
    }

    func testOwnProjectAndBarePathsAreAllowed() {
        XCTAssertEqual(WebTileHost.address("luca://shop/console", project: "shop"), TileURI("luca://shop/console"))
        XCTAssertEqual(WebTileHost.address("doc/notes/a.md", project: "shop"), TileURI("luca://shop/doc/notes/a.md"))
        XCTAssertEqual(WebTileHost.address("/endpoints", project: "shop"), TileURI("luca://shop/endpoints"))
    }
}

final class PageKeyTests: XCTestCase {
    func testSpecsReadLikeKitJS() {
        XCTAssertEqual(PageKey(spec: "b", label: "Buy")?.stroke, KeyStroke(key: "b"))
        XCTAssertEqual(PageKey(spec: "K", label: "")?.stroke, KeyStroke(key: "k", shift: true))
        XCTAssertEqual(PageKey(spec: "Enter", label: "")?.stroke, KeyStroke(key: "Enter"))
        XCTAssertEqual(PageKey(spec: "ctrl+k", label: "")?.stroke, KeyStroke(key: "k", ctrl: true))
        XCTAssertEqual(PageKey(spec: "alt+shift+Enter", label: "")?.stroke, KeyStroke(key: "Enter", shift: true, alt: true))
        XCTAssertEqual(PageKey(spec: "ArrowUp", label: "")?.stroke, KeyStroke(key: "Up"))
        XCTAssertNil(PageKey(spec: "F13", label: ""))
    }

    func testListKeepsTheNewestOfTwoSameKeys() {
        let keys = PageKey.list(from: [["key": "b", "label": "new"], ["key": "b", "label": "old"], ["key": "x"]])
        XCTAssertEqual(keys.map(\.label), ["new", "x"])
    }

    func testAltAlsoTakesLeftOptionAsMod() {
        let key = PageKey(spec: "alt+p", label: "")!
        XCTAssertTrue(key.matches(KeyStroke(key: "p", mod: true)))
        XCTAssertFalse(PageKey(spec: "p", label: "")!.matches(KeyStroke(key: "p", mod: true)))
    }

    func testPageKeysNeverTakeShellChords() {
        let map = Keymap.merged(defaults: DefaultKeymap.file, user: nil)
        XCTAssertTrue(map.startsShellChord(KeyStroke(key: "Space")))
        XCTAssertTrue(map.startsShellChord(KeyStroke(key: ":")))
        XCTAssertFalse(map.startsShellChord(KeyStroke(key: "b")))
    }

    func testPressScriptSendsTheDOMKey() {
        let script = PageKey(spec: "ctrl+k", label: "")!.pressScript
        XCTAssertTrue(script.contains("\"key\":\"k\""))
        XCTAssertTrue(script.contains("\"ctrlKey\":true"))
    }
}
