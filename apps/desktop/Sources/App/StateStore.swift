import Foundation

/// What `state.json` holds: every workspace and every tile's address.
struct SavedState: Codable {
    struct SavedTile: Codable {
        let id: UUID
        let uri: TileURI
    }

    var version = 1
    var current: Int
    var keysView: Bool
    var tiles: [SavedTile]
    var workspaces: [Workspace]
    /// Addresses the file held that do not parse any more (an address of
    /// another scheme). Not written back.
    var skipped: [String] = []

    enum CodingKeys: String, CodingKey { case version, current, keysView, tiles, workspaces }

    init(current: Int, keysView: Bool, tiles: [SavedTile], workspaces: [Workspace]) {
        self.current = current
        self.keysView = keysView
        self.tiles = tiles
        self.workspaces = workspaces
    }

    /// A tile whose address does not parse is skipped, never the whole file:
    /// its workspace then drops it (`Shell.restore`).
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        version = try c.decodeIfPresent(Int.self, forKey: .version) ?? 1
        current = try c.decodeIfPresent(Int.self, forKey: .current) ?? 0
        keysView = try c.decodeIfPresent(Bool.self, forKey: .keysView) ?? true
        workspaces = try c.decodeIfPresent([Workspace].self, forKey: .workspaces) ?? []
        struct Raw: Decodable { let id: UUID; let uri: String }
        var kept: [SavedTile] = []
        for raw in try c.decodeIfPresent([Raw].self, forKey: .tiles) ?? [] {
            if let uri = TileURI(raw.uri) { kept.append(SavedTile(id: raw.id, uri: uri)) } else { skipped.append(raw.uri) }
        }
        tiles = kept
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(version, forKey: .version)
        try c.encode(current, forKey: .current)
        try c.encode(keysView, forKey: .keysView)
        try c.encode(tiles, forKey: .tiles)
        try c.encode(workspaces, forKey: .workspaces)
    }
}

/// Reads and writes `~/.luca/desktop/state.json`.
enum StateStore {
    static func load(from url: URL = TilesPaths.state) -> SavedState? {
        guard let data = try? Data(contentsOf: url) else { return nil }
        do {
            return try JSONDecoder().decode(SavedState.self, from: data)
        } catch {
            AppLogger.error("Luca Desktop: can't read \(url.path): \(error.localizedDescription)")
            return nil
        }
    }

    static func save(_ state: SavedState, to url: URL = TilesPaths.state) {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        do {
            try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
            try encoder.encode(state).write(to: url, options: .atomic)
        } catch {
            AppLogger.error("Luca Desktop: can't write \(url.path): \(error.localizedDescription)")
        }
    }
}
