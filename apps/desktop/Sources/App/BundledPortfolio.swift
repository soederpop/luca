import Foundation
import CryptoKit

/// Installs the portfolio project the app ships (`Contents/Resources/portfolio/`)
/// at `~/.luca/portfolio`: a small Luca project holding `lucaPortfolio`, the
/// assistant of the projects tile, and the `portfolio` feature it uses.
///
/// File by file, not as one folder, because the user owns `portfolio.yml` and
/// may change anything else too. The manifest (`.luca-desktop-build.json`)
/// keeps the hash of each file as the app last wrote it. A file is written
/// when it is missing, or when it still has that hash (nobody changed it) and
/// the bundle has new content. A changed file is left alone. Files the bundle
/// no longer has stay where they are.
enum BundledPortfolio {
    static let manifestName = ".luca-desktop-build.json"

    static var bundled: URL? {
        Bundle.main.resourceURL?.appendingPathComponent("portfolio", isDirectory: true)
    }

    static var destination: URL {
        if let value = ProcessInfo.processInfo.environment["LUCA_DESKTOP_PORTFOLIO_HOME"], !value.isEmpty {
            return URL(fileURLWithPath: (value as NSString).expandingTildeInPath, isDirectory: true)
        }
        return FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent(".luca/portfolio", isDirectory: true)
    }

    enum Outcome: Equatable {
        case installed, updated, current, kept
    }

    static func installInBackground() {
        guard let source = bundled, FileManager.default.fileExists(atPath: source.path) else { return }
        let target = destination
        DispatchQueue.global(qos: .utility).async {
            do {
                let results = try install(from: source, to: target)
                let changed = results.filter { $0.value == .installed || $0.value == .updated }.keys.sorted()
                let kept = results.filter { $0.value == .kept }.keys.sorted()
                if !changed.isEmpty { AppLogger.info("Portfolio: wrote \(changed.joined(separator: ", ")) in \(target.path)") }
                if !kept.isEmpty { AppLogger.info("Portfolio: kept your changes to \(kept.joined(separator: ", "))") }
            } catch {
                AppLogger.error("Portfolio: install failed: \(error)")
            }
        }
    }

    /// The outcome per file, by path relative to the project.
    static func install(from source: URL, to target: URL) throws -> [String: Outcome] {
        let fm = FileManager.default
        try fm.createDirectory(at: target, withIntermediateDirectories: true)
        let manifestURL = target.appendingPathComponent(manifestName)
        var manifest = (try? JSONDecoder().decode([String: String].self, from: Data(contentsOf: manifestURL))) ?? [:]
        var results: [String: Outcome] = [:]

        for rel in files(in: source) {
            let from = source.appendingPathComponent(rel)
            let to = target.appendingPathComponent(rel)
            let data = try Data(contentsOf: from)
            let bundledHash = hash(data)
            if let existing = try? Data(contentsOf: to) {
                let installedHash = hash(existing)
                if installedHash == bundledHash {
                    manifest[rel] = bundledHash
                    results[rel] = .current
                    continue
                }
                guard manifest[rel] == installedHash else {
                    results[rel] = .kept
                    continue
                }
                try data.write(to: to, options: .atomic)
                results[rel] = .updated
            } else {
                try fm.createDirectory(at: to.deletingLastPathComponent(), withIntermediateDirectories: true)
                try data.write(to: to, options: .atomic)
                results[rel] = .installed
            }
            manifest[rel] = bundledHash
        }

        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        try encoder.encode(manifest).write(to: manifestURL, options: .atomic)
        return results
    }

    private static func files(in root: URL) -> [String] {
        guard let walker = FileManager.default.enumerator(at: root, includingPropertiesForKeys: [.isRegularFileKey]) else { return [] }
        let base = root.standardizedFileURL.path
        var out: [String] = []
        for case let url as URL in walker {
            guard (try? url.resourceValues(forKeys: [.isRegularFileKey]))?.isRegularFile == true,
                  url.lastPathComponent != ".DS_Store" else { continue }
            let path = url.standardizedFileURL.path
            guard path.hasPrefix(base + "/") else { continue }
            out.append(String(path.dropFirst(base.count + 1)))
        }
        return out.sorted()
    }

    private static func hash(_ data: Data) -> String {
        SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
    }
}

/// The portfolio as a project: `luca://luca-portfolio/…` tiles run on a host
/// in `~/.luca/portfolio`. It is never in `projects.json` or the projects list.
enum PortfolioProject {
    static let id = "luca-portfolio"
    static let assistant = "lucaPortfolio"

    static var entry: KnownProject {
        KnownProject(id: id, path: BundledPortfolio.destination.path, name: "Portfolio", lastOpened: nil)
    }

    /// A new chat with lucaPortfolio.
    static var newChat: TileURI {
        TileURI.luca(project: id, tool: "chat", id: "new", options: [TileURI.Option(name: "assistant", value: assistant)])
    }

    /// The first-time-user guide. It runs here so a new user needs no project:
    /// it checks the Mac for a model and helps install and sign in to one.
    static var firstTimeUser: TileURI {
        TileURI.luca(project: id, tool: "chat", id: "new", options: [TileURI.Option(name: "assistant", value: "guide:first-time-user")])
    }
}

/// lucaPortfolio's copies to review: the `review` event of the portfolio
/// feature on the portfolio host. Each change is a hard copy of one helper
/// into `target`, shown in a `luca-change` tile there. Nothing is written
/// until the human writes it in that tile.
struct PortfolioReview: Equatable {
    let target: String
    let changes: [ChangeRequest]

    init?(event: WorkbenchEvent) {
        guard event.type == "event", event.registry == "features", event.id == "portfolio", event.name == "review",
              case .array(let args)? = event.args, case .object(let body)? = args.first,
              case .string(let target)? = body["target"], target.hasPrefix("/"),
              case .array(let list)? = body["changes"] else { return nil }
        let changes: [ChangeRequest] = list.compactMap { item in
            guard case .object(let c) = item,
                  case .string(let registry)? = c["registry"], case .string(let id)? = c["id"],
                  case .string(let file)? = c["file"], case .string(let root)? = c["root"],
                  file.hasPrefix("/"), root.hasPrefix("/") else { return nil }
            return ChangeRequest(route: "borrow", op: "copy", registry: registry, id: id, file: file, root: root)
        }
        guard !changes.isEmpty else { return nil }
        self.target = target
        self.changes = changes
    }
}
