import Foundation

/// Where the app keeps its own files: `~/.luca/desktop/` (`keymap.yml`,
/// `state.json`, `layouts/`, `logs/`). `LUCA_DESKTOP_HOME` points a test run
/// somewhere else, so it does not touch the saved layout and keymap of the
/// app in daily use.
enum TilesPaths {
    private static var home: URL { FileManager.default.homeDirectoryForCurrentUser }
    private static func env(_ name: String) -> URL? {
        guard let value = ProcessInfo.processInfo.environment[name], !value.isEmpty else { return nil }
        return URL(fileURLWithPath: value, isDirectory: true)
    }

    static var root: URL { env("LUCA_DESKTOP_HOME") ?? home.appendingPathComponent(".luca/desktop", isDirectory: true) }

    static var keymap: URL { root.appendingPathComponent("keymap.yml") }
    static var state: URL { root.appendingPathComponent("state.json") }
    static var layouts: URL { root.appendingPathComponent("layouts", isDirectory: true) }
    static func layout(_ name: String) -> URL { layouts.appendingPathComponent("\(name).yml") }
    static var log: URL { root.appendingPathComponent("logs/luca-desktop.log") }

    static func ensureRoot() {
        try? FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    }
}
