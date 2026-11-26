import Foundation
import Combine

/// The live keymap: the app's defaults with `keymap.yml` merged over them.
/// Reloads when the file changes. Every keys view surface reads `map`.
@MainActor
final class KeymapStore: ObservableObject {
    static let shared = KeymapStore()

    @Published private(set) var map: Keymap
    private var lastStamp: Date?
    private var timer: Timer?
    let fileURL: URL

    init(fileURL: URL = TilesPaths.keymap) {
        self.fileURL = fileURL
        map = Keymap.merged(defaults: DefaultKeymap.file, user: nil)
    }

    func start() {
        reload(force: true)
        // Editors save by replacing the file, which a file watcher loses, so
        // compare the modification date once a second instead.
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            MainActor.assumeIsolated { self?.reload(force: false) }
        }
    }

    func reload(force: Bool) {
        let stamp = (try? FileManager.default.attributesOfItem(atPath: fileURL.path))?[.modificationDate] as? Date
        guard force || stamp != lastStamp else { return }
        lastStamp = stamp
        let user = (try? String(contentsOf: fileURL, encoding: .utf8)).map(KeymapFile.init(parsing:))
        let next = Keymap.merged(defaults: DefaultKeymap.file, user: user)
        for warning in next.warnings { AppLogger.error("Keymap: \(warning)") }
        if next != map {
            map = next
            if !force { AppLogger.info("Keymap reloaded") }
        }
    }
}
