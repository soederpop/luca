import AppKit

/// For checking the app by hand without a keyboard: with
/// `LUCA_DESKTOP_DEBUG_KEYS` set, post those keys to the app after launch. They
/// go through the same monitor and router as real keys, with the same
/// device flags (Mod is left Option).
///
/// Tokens are separated by `|`: a key in keymap syntax (`Mod-h`, `Space`,
/// `G`, `?`), `type:<text>`, `wait:<seconds>`, `shot:<name>`, and `quit`,
/// which quits the app the normal way (hosts stop, state saves).
/// Example: `LUCA_DESKTOP_DEBUG_KEYS='Space|Space|wait:1|type:registry|Enter'`.
@MainActor
enum DebugKeys {
    static func runIfAsked() {
        guard let script = ProcessInfo.processInfo.environment["LUCA_DESKTOP_DEBUG_KEYS"], !script.isEmpty else { return }
        let tokens = script.components(separatedBy: "|")
        Task {
            try? await Task.sleep(for: .seconds(1.5))
            for token in tokens {
                if token.hasPrefix("wait:") {
                    try? await Task.sleep(for: .seconds(Double(token.dropFirst(5)) ?? 0.5))
                    continue
                }
                if token == "quit" {
                    NSApp.terminate(nil)
                    continue
                }
                if token.hasPrefix("shot:") {
                    snapshot(String(token.dropFirst(5)))
                    continue
                }
                if token.hasPrefix("type:"), AppFocus.quiet, PaletteController.shared.isActive {
                    // A quiet run has no key window, so the palette's field gets
                    // no key events: put the text in its query.
                    Shell.shared.palette.query += String(token.dropFirst(5))
                    continue
                }
                if token.hasPrefix("type:"), AppFocus.quiet, Shell.shared.focusedTile?.content.typeForCheck(String(token.dropFirst(5))) == true {
                    continue
                }
                if token.hasPrefix("do:") {
                    // An action by id, bound to a key or not.
                    Shell.shared.perform(String(token.dropFirst(3)), count: nil)
                    continue
                }
                if token.hasPrefix("type:") {
                    for c in token.dropFirst(5) {
                        let s = String(c)
                        let stroke = KeyStroke(key: c == " " ? "Space" : s)
                        post(stroke, characters: s)
                        try? await Task.sleep(for: .milliseconds(30))
                    }
                    continue
                }
                guard let stroke = KeyStroke(token: token) else {
                    AppLogger.error("Debug keys: can't read '\(token)'")
                    continue
                }
                post(stroke, characters: nil)
                try? await Task.sleep(for: .milliseconds(200))
            }
        }
    }

    /// `shot:<name>`: the app's visible windows, drawn where they are on the
    /// primary screen, as one picture at `<LUCA_DESKTOP_HOME>/shots/<name>.png`. The
    /// app draws its own views, so this works while its windows are behind
    /// another app's. A web view comes out blank.
    private static func snapshot(_ name: String) {
        guard let screen = NSScreen.screens.first else { return }
        let folder = TilesPaths.root.appendingPathComponent("shots")
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        let size = screen.frame.size
        guard let canvas = NSBitmapImageRep(
            bitmapDataPlanes: nil, pixelsWide: Int(size.width), pixelsHigh: Int(size.height), bitsPerSample: 8,
            samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0),
            let context = NSGraphicsContext(bitmapImageRep: canvas) else { return }
        NSGraphicsContext.saveGraphicsState()
        NSGraphicsContext.current = context
        NSColor.black.setFill()
        NSRect(origin: .zero, size: size).fill()
        // Back to front, so a panel over a tile draws over it.
        // Panels (status line, keys, palette) are not in `orderedWindows`.
        let ordered = Array(NSApp.orderedWindows.reversed())
        let panels = NSApp.windows.filter { window in !ordered.contains { $0 === window } }
        for window in ordered + panels where window.isVisible {
            guard let view = window.contentView, let rep = view.bitmapImageRepForCachingDisplay(in: view.bounds) else { continue }
            view.cacheDisplay(in: view.bounds, to: rep)
            rep.draw(in: window.frame.offsetBy(dx: -screen.frame.minX, dy: -screen.frame.minY))
        }
        NSGraphicsContext.restoreGraphicsState()
        try? canvas.representation(using: .png, properties: [:])?.write(to: folder.appendingPathComponent("\(name).png"))
    }

    private static let symbolCodes: [String: (UInt16, Bool)] = [
        "/": (44, false), "?": (44, true), ";": (41, false), ":": (41, true), "[": (33, false), "]": (30, false),
        "=": (24, false), "-": (27, false), ",": (43, false), ".": (47, false),
    ]

    private static func post(_ stroke: KeyStroke, characters: String?) {
        var code: UInt16 = 0
        var shift = stroke.shift
        if let match = KeyStroke.keyCodeNames.first(where: { $0.value == stroke.key })?.key {
            code = match
        } else if let (symbol, needsShift) = symbolCodes[stroke.key] {
            code = symbol
            shift = shift || needsShift
        }
        var raw: UInt = 0
        if stroke.mod { raw |= ModKey.flagOption | ModKey.deviceLeftOption }
        if stroke.alt { raw |= ModKey.flagOption | ModKey.deviceRightOption }
        if shift { raw |= ModKey.flagShift }
        if stroke.ctrl { raw |= ModKey.flagControl | ModKey.deviceLeftControl }
        if stroke.cmd { raw |= ModKey.flagCommand | ModKey.deviceLeftCommand }
        let named: [String: String] = ["Space": " ", "Enter": "\r", "Esc": "\u{1b}", "Tab": "\t", "Backspace": "\u{7f}"]
        var chars = characters ?? named[stroke.key] ?? stroke.key
        if characters == nil, shift, chars.count == 1, chars.first!.isLetter { chars = chars.uppercased() }
        if stroke.ctrl, chars.count == 1, let ascii = chars.unicodeScalars.first?.value, ascii >= 97, ascii <= 122 {
            chars = String(UnicodeScalar(ascii - 96)!)
        }
        let window = NSApp.keyWindow
        guard let event = NSEvent.keyEvent(
            with: .keyDown, location: .zero, modifierFlags: NSEvent.ModifierFlags(rawValue: raw),
            timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window?.windowNumber ?? 0,
            context: nil, characters: chars, charactersIgnoringModifiers: characters ?? named[stroke.key] ?? stroke.key,
            isARepeat: false, keyCode: code
        ) else { return }
        NSApp.postEvent(event, atStart: false)
    }
}

/// Every place the app brings itself forward goes through here. With
/// `LUCA_DESKTOP_NO_ACTIVATE` set, a check run (`LUCA_DESKTOP_DEBUG_KEYS`) never takes the
/// keyboard from the app you are typing in and keeps its windows behind
/// every other app's. Look at it with the `shot:<name>` token.
@MainActor
enum AppFocus {
    static let quiet = ProcessInfo.processInfo.environment["LUCA_DESKTOP_NO_ACTIVATE"] != nil

    /// A quiet run keeps every window under the other apps' windows, so it
    /// covers nothing on the screen of the person at the Mac.
    static func level(_ level: NSWindow.Level) -> NSWindow.Level {
        quiet ? NSWindow.Level(rawValue: Int(CGWindowLevelForKey(.desktopIconWindow)) + 1) : level
    }

    static func activate() {
        if !quiet { NSApp.activate() }
    }

    /// Show a tile window. A window of an app that is not frontmost only
    /// comes forward with `orderFrontRegardless`.
    static func front(_ window: NSWindow) {
        if quiet { window.orderFrontRegardless() } else { window.orderFront(nil) }
    }
}
