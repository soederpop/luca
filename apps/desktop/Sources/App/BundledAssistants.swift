import Foundation

/// Installs the assistants the app ships (`Contents/Resources/assistants/`)
/// into `~/.luca/assistants/`, where every Luca project discovers them.
///
/// Each bundled assistant carries a `.luca-desktop-build` stamp. The app
/// replaces an installed copy only when that copy has a stamp (so the app put
/// it there) and the stamp differs. A folder with no stamp was made by hand,
/// so the app leaves it alone. Delete the folder to get the bundled one back.
///
/// An installed folder that carries a stamp but is no longer in the bundle was
/// put there by an older build under a name the app has since dropped (the
/// assistant was `lucaExpert` before it was `lucaArchitect`). It is removed,
/// so a renamed assistant does not leave its old self behind to clash with a
/// user's own assistant of that name. A folder with no stamp is never removed.
enum BundledAssistants {
    static let stampName = ".luca-desktop-build"
    /// Names an older build installed that the bundle no longer ships.
    static let retiredNames: Set<String> = ["lucaExpert"]

    static var bundled: URL? {
        Bundle.main.resourceURL?.appendingPathComponent("assistants", isDirectory: true)
    }

    static var destination: URL {
        if let value = ProcessInfo.processInfo.environment["LUCA_DESKTOP_ASSISTANTS_HOME"], !value.isEmpty {
            return URL(fileURLWithPath: value, isDirectory: true)
        }
        return FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent(".luca/assistants", isDirectory: true)
    }

    enum Outcome: Equatable {
        case installed, updated, current, handMade, retired
    }

    /// Runs off the main thread: the copy is a few hundred small files.
    static func installInBackground() {
        guard let source = bundled, FileManager.default.fileExists(atPath: source.path) else { return }
        let target = destination
        DispatchQueue.global(qos: .utility).async {
            for (name, result) in install(from: source, to: target) {
                switch result {
                case .success(let outcome) where outcome == .installed || outcome == .updated:
                    AppLogger.info("Bundled assistant \(name): \(outcome) in \(target.path)")
                case .success(.handMade):
                    AppLogger.info("Bundled assistant \(name): left alone, \(target.path)/\(name) has no \(stampName)")
                case .success(.retired):
                    AppLogger.info("Bundled assistant \(name): removed, an older build installed it and the app no longer ships it")
                case .success:
                    break
                case .failure(let error):
                    AppLogger.error("Bundled assistant \(name): install failed: \(error)")
                }
            }
        }
    }

    static func install(from source: URL, to target: URL) -> [(String, Result<Outcome, Error>)] {
        let fm = FileManager.default
        guard let names = try? fm.contentsOfDirectory(atPath: source.path) else { return [] }
        let bundled = names.sorted().filter { !$0.hasPrefix(".") }
        let installs = bundled.map { name in
            (name, Result { try installOne(source.appendingPathComponent(name), into: target) })
        }
        let retirements = retiredNames.subtracting(bundled).sorted().compactMap { name -> (String, Result<Outcome, Error>)? in
            let folder = target.appendingPathComponent(name, isDirectory: true)
            // Only a folder the app stamped is the app's to remove.
            guard fm.fileExists(atPath: folder.path), stamp(folder) != nil else { return nil }
            return (name, Result { try fm.removeItem(at: folder); return .retired })
        }
        return installs + retirements
    }

    private static func stamp(_ folder: URL) -> String? {
        (try? String(contentsOf: folder.appendingPathComponent(stampName), encoding: .utf8))?
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private static func installOne(_ source: URL, into target: URL) throws -> Outcome {
        let fm = FileManager.default
        let dest = target.appendingPathComponent(source.lastPathComponent, isDirectory: true)
        let exists = fm.fileExists(atPath: dest.path)
        if exists {
            guard let installed = stamp(dest) else { return .handMade }
            if installed == stamp(source) { return .current }
        }

        // Copy beside the target first, so a failed copy never leaves half a folder.
        try fm.createDirectory(at: target, withIntermediateDirectories: true)
        let staging = target.appendingPathComponent(".\(source.lastPathComponent).installing-\(UUID().uuidString)")
        try fm.copyItem(at: source, to: staging)
        if exists {
            _ = try fm.replaceItemAt(dest, withItemAt: staging)
        } else {
            try fm.moveItem(at: staging, to: dest)
        }
        return exists ? .updated : .installed
    }
}
