import XCTest
@testable import LucaDesktop

final class KeymapTests: XCTestCase {
    func testDefaultsParseWithNoWarnings() {
        let file = DefaultKeymap.file
        XCTAssertEqual(file.warnings, [])
        let map = Keymap.merged(defaults: file, user: nil)
        XCTAssertEqual(map.modKey, .leftOption)
        XCTAssertEqual(map.bindings.count, file.entries.count)
        XCTAssertTrue(map.bindings.allSatisfy { $0.isBound }, "\(map.bindings.filter { !$0.isBound }.map(\.action))")
    }

    /// Every layout key in the idea document has a default binding.
    func testEveryLayoutKeyInTheIdeaDocumentIsBound() {
        let map = Keymap.merged(defaults: DefaultKeymap.file, user: nil)
        let expected = ["⌥Space", "⌥⇧Space", "⌥h", "⌥j", "⌥k", "⌥l", "⌥⇧h", "⌥⇧j", "⌥⇧k", "⌥⇧l",
                        "⌥v", "⌥s", "⌥t", "⌥[", "⌥]", "⌥z", "⌥q", "⌥r", "⌥o", "⌥⇧o", "⌥g", "⌥⇧g"]
            + (1...9).map { "⌥\($0)" } + (1...9).map { "⌥⇧\($0)" }
        let shown = Set(map.bindings(in: .layout).map { $0.display(modSymbol: map.modSymbol) })
        for key in expected { XCTAssertTrue(shown.contains(key), "missing \(key)") }
    }

    func testUserFileRebindsOneActionOnly() {
        let user = KeymapFile(parsing: """
        # mine
        bindings:
          layout.focus.left: { key: "Mod-y" }
        """)
        XCTAssertEqual(user.warnings, [])
        let defaults = Keymap.merged(defaults: DefaultKeymap.file, user: nil)
        let merged = Keymap.merged(defaults: DefaultKeymap.file, user: user)

        XCTAssertEqual(merged.keyLabel(for: "layout.focus.left"), "⌥y")
        XCTAssertEqual(merged.binding(for: "layout.focus.left")?.label, "focus left")
        for binding in defaults.bindings where binding.action != "layout.focus.left" {
            XCTAssertEqual(merged.binding(for: binding.action)?.keys, binding.keys, binding.action)
            XCTAssertEqual(merged.binding(for: binding.action)?.label, binding.label, binding.action)
        }

        // The keys view data (the layout list) shows the new key.
        let row = merged.bindings(in: .layout).first { $0.action == "layout.focus.left" }
        XCTAssertEqual(row?.display(modSymbol: merged.modSymbol), "⌥y")

        // And the router runs it.
        var router = KeyRouter(keymap: merged)
        XCTAssertEqual(router.route(KeyStroke(key: "y", mod: true), kind: nil), .action("layout.focus.left", count: nil))
        XCTAssertEqual(router.route(KeyStroke(key: "h", mod: true), kind: nil), .passThrough)
    }

    func testBlockFormLabelAndUnbind() {
        let user = KeymapFile(parsing: """
        modifier: right-option
        bindings:
          lucaChat.stop:
            key: Ctrl-x
            label: "halt"
          layout.zoom: none
        """)
        XCTAssertEqual(user.warnings, [])
        let merged = Keymap.merged(defaults: DefaultKeymap.file, user: user)
        XCTAssertEqual(merged.modKey, .rightOption)
        XCTAssertEqual(merged.keyLabel(for: "lucaChat.stop"), "⌃x")
        XCTAssertEqual(merged.binding(for: "lucaChat.stop")?.label, "halt")
        XCTAssertNil(merged.keyLabel(for: "layout.zoom"))
    }

    func testUnknownActionIsAWarning() {
        let user = KeymapFile(parsing: "bindings:\n  no.such.thing: { key: x }\n")
        let merged = Keymap.merged(defaults: DefaultKeymap.file, user: user)
        XCTAssertEqual(merged.warnings, ["keymap.yml: no action named 'no.such.thing'"])
    }

    // MARK: Mod is left Option only

    func testLeftOptionIsModRightOptionIsNot() {
        let option = ModKey.flagOption
        let left = KeyStroke.from(keyCode: 4, characters: "h", rawFlags: option | ModKey.deviceLeftOption, modKey: .leftOption)
        XCTAssertEqual(left, KeyStroke(key: "h", mod: true))

        let right = KeyStroke.from(keyCode: 4, characters: "h", rawFlags: option | ModKey.deviceRightOption, modKey: .leftOption)
        XCTAssertEqual(right?.mod, false)
        XCTAssertEqual(right?.alt, true)

        // Right Option is not Mod, so the router lets it type.
        var router = KeyRouter(keymap: Keymap.merged(defaults: DefaultKeymap.file, user: nil))
        router.mode = .insert
        XCTAssertEqual(router.route(right!, kind: "luca-chat"), .passThrough)
        XCTAssertEqual(router.route(left!, kind: "luca-chat"), .action("layout.focus.left", count: nil))
    }

    func testModShiftDigitUsesTheKeyCode() {
        // Shift-1 types "!", but the binding is Mod-Shift-1.
        let raw = ModKey.flagOption | ModKey.deviceLeftOption | ModKey.flagShift
        let stroke = KeyStroke.from(keyCode: 18, characters: "!", rawFlags: raw, modKey: .leftOption)
        XCTAssertEqual(stroke, KeyStroke(key: "1", mod: true, shift: true))
    }

    func testQuestionMarkHasNoShift() {
        let stroke = KeyStroke.from(keyCode: 44, characters: "?", rawFlags: ModKey.flagShift, modKey: .leftOption)
        XCTAssertEqual(stroke, KeyStroke(token: "?"))
    }

    // MARK: Router

    func testLeaderChordAndCount() {
        var router = KeyRouter(keymap: Keymap.merged(defaults: DefaultKeymap.file, user: nil))
        XCTAssertEqual(router.route(KeyStroke(key: "2"), kind: nil), .pending)
        XCTAssertEqual(router.route(KeyStroke(key: "Space"), kind: nil), .pending)
        XCTAssertEqual(router.pendingDisplay, "2 Space")
        XCTAssertFalse(router.continuations(kind: nil).isEmpty)
        XCTAssertEqual(router.route(KeyStroke(key: "n"), kind: nil), .action("luca.chat", count: 2))
        XCTAssertFalse(router.isPending)
    }

    func testKindBindingWinsOverTileBinding() {
        var router = KeyRouter(keymap: Keymap.merged(defaults: DefaultKeymap.file, user: nil))
        XCTAssertEqual(router.route(KeyStroke(key: "j"), kind: "luca-plugins"), .action("lucaPlugins.down", count: nil))
        XCTAssertEqual(router.route(KeyStroke(key: "j"), kind: "luca-doc"), .action("tile.scroll.down", count: nil))
    }

    func testCtrlWReachesTheLayoutKeys() {
        var router = KeyRouter(keymap: Keymap.merged(defaults: DefaultKeymap.file, user: nil))
        XCTAssertEqual(router.route(KeyStroke(key: "w", ctrl: true), kind: nil), .pending)
        XCTAssertEqual(router.route(KeyStroke(key: "l"), kind: nil), .action("layout.focus.right", count: nil))
        router.mode = .insert
        XCTAssertEqual(router.route(KeyStroke(key: "w", ctrl: true), kind: nil), .passThrough)
    }

    func testInsertModePassesPlainKeysAndEscapeLeaves() {
        var router = KeyRouter(keymap: Keymap.merged(defaults: DefaultKeymap.file, user: nil))
        router.mode = .insert
        XCTAssertEqual(router.route(KeyStroke(key: "j"), kind: "luca-chat"), .passThrough)
        XCTAssertEqual(router.route(KeyStroke(key: "/", mod: true), kind: "luca-chat"), .action("keys.toggle.anywhere", count: nil))
        XCTAssertEqual(router.route(KeyStroke(key: "Esc"), kind: "luca-chat"), .escape)
    }

    func testUnboundKeyInNormalPassesThrough() {
        var router = KeyRouter(keymap: Keymap.merged(defaults: DefaultKeymap.file, user: nil))
        // Cmd-q must reach the menu.
        XCTAssertEqual(router.route(KeyStroke(key: "q", cmd: true), kind: nil), .passThrough)
        XCTAssertEqual(router.route(KeyStroke(key: "g"), kind: nil), .pending)
        XCTAssertEqual(router.route(KeyStroke(key: "x"), kind: nil), .swallow)
    }
}
