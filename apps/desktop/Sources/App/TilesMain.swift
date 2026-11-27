import AppKit

enum TilesMain {
    @MainActor static func run() {
        let app = NSApplication.shared
        let delegate = AppDelegate()
        app.delegate = delegate
        app.setActivationPolicy(.regular)
        withExtendedLifetime(delegate) { app.run() }
    }
}

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate {
    private var keyMonitor: Any?
    private var modeTimer: Timer?
    private var lastQuitPress: Date?
    private var lastHidePress: Date?
    private static let quitWindow: TimeInterval = 1.5

    func applicationDidFinishLaunching(_ notification: Notification) {
        TilesPaths.ensureRoot()
        AppLogger.info("Luca Desktop: launch")
        NSApp.appearance = NSAppearance(named: .darkAqua)
        NSApp.mainMenu = Self.makeMenu()

        TileKinds.registerBuiltIns()
        _ = ThemeSettings.shared
        CodeHighlighter.shared.warm()
        KeymapStore.shared.start()
        ProjectHub.shared.start()
        ProjectToolsStore.shared.start()
        BundledAssistants.installInBackground()
        BundledPortfolio.installInBackground()

        let shell = Shell.shared
        StatusLineController.shared.show()
        shell.restore()
        KeysPanelController.shared.update()

        // One key router for the whole app: every key down passes through it.
        keyMonitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { event in
            MainActor.assumeIsolated { Shell.shared.handle(event) ? nil : event }
        }
        // A click into or out of a text field changes Insert and Normal.
        modeTimer = Timer.scheduledTimer(withTimeInterval: 0.25, repeats: true) { _ in
            MainActor.assumeIsolated { Shell.shared.syncTextMode() }
        }
        NotificationCenter.default.addObserver(forName: NSApplication.didChangeScreenParametersNotification, object: nil, queue: .main) { _ in
            MainActor.assumeIsolated {
                Shell.shared.applyLayout(animated: false)
                KeysPanelController.shared.update()
            }
        }
        AppFocus.activate()
        if shell.focusedId == nil { StatusLineController.shared.takeKeyIfIdle() }
        DebugKeys.runIfAsked()
    }

    func applicationWillTerminate(_ notification: Notification) {
        Shell.shared.saveNow()
        // Every workbench host goes with the app.
        ProjectHub.shared.stopAll()
        AppLogger.info("Luca Desktop: quit")
    }

    /// Cmd-Q quits only on a second press inside the window, because one
    /// stray press closed the app too often. A click on the menu item quits
    /// at once. Log out and restart do not come through here.
    @objc func quitGuarded(_ sender: Any?) {
        guard Self.secondPress(&lastQuitPress, note: "Press Cmd-Q again to quit") else { return }
        NSApp.terminate(sender)
    }

    /// Cmd-H the same way: one stray press hides every tile, which is as
    /// disruptive as a quit in a keyboard-first app.
    @objc func hideGuarded(_ sender: Any?) {
        guard Self.secondPress(&lastHidePress, note: "Press Cmd-H again to hide") else { return }
        NSApp.hide(sender)
    }

    /// True when the action may run: a menu click, or a key press within
    /// `quitWindow` of the last one. A first key press flashes `note`.
    private static func secondPress(_ last: inout Date?, note: String) -> Bool {
        let fromKey = NSApp.currentEvent?.type == .keyDown
        let now = Date()
        if fromKey, last.map({ now.timeIntervalSince($0) > quitWindow }) ?? true {
            last = now
            Shell.shared.flash(note)
            return false
        }
        last = nil
        return true
    }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        if let tile = Shell.shared.focusedTile { tile.controller?.window.makeKeyAndOrderFront(nil) }
        else { StatusLineController.shared.takeKeyIfIdle() }
        return false
    }

    /// Quit, plus the Edit menu, without which Cmd-C and Cmd-V do nothing in
    /// text fields.
    private static func makeMenu() -> NSMenu {
        let main = NSMenu()
        let appItem = NSMenuItem()
        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "About Luca Desktop", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "Hide Luca Desktop", action: #selector(AppDelegate.hideGuarded(_:)), keyEquivalent: "h")
        appMenu.addItem(withTitle: "Quit Luca Desktop", action: #selector(AppDelegate.quitGuarded(_:)), keyEquivalent: "q")
        appItem.submenu = appMenu
        main.addItem(appItem)

        let editItem = NSMenuItem()
        let edit = NSMenu(title: "Edit")
        edit.addItem(withTitle: "Undo", action: Selector(("undo:")), keyEquivalent: "z")
        edit.addItem(withTitle: "Redo", action: Selector(("redo:")), keyEquivalent: "Z")
        edit.addItem(.separator())
        edit.addItem(withTitle: "Cut", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        edit.addItem(withTitle: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        edit.addItem(withTitle: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        edit.addItem(withTitle: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
        editItem.submenu = edit
        main.addItem(editItem)
        return main
    }
}
