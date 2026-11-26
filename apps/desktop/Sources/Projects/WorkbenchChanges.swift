import Foundation

/// Where a helper comes from, as the host works it out: `own`, `borrowed`,
/// `plugin`, `home` (`~/.luca`) or `builtin`. `tag` and `label` are drawn as sent.
struct WorkbenchOrigin: Decodable, Equatable {
    let kind: String
    let tag: String
    let label: String
    let file: String?
    let dir: String?
    let root: String?
    let plugin: String?
}

/// One line of a diff the host made.
struct WorkbenchDiffLine: Decodable, Equatable {
    /// `add`, `del`, `same`, `gap`.
    let kind: String
    let text: String
}

/// A file a change would write, with its diff.
struct WorkbenchPlannedFile: Decodable, Equatable, Identifiable {
    let path: String
    let display: String
    /// `create`, `overwrite`, `edit`, `delete`, `link`, `same`.
    let action: String
    let target: String?
    let lines: [WorkbenchDiffLine]
    let added: Int
    let removed: Int
    let note: String?
    var id: String { path }
}

/// A relative import a copied helper needs.
struct WorkbenchPlannedImport: Decodable, Equatable, Identifiable {
    let spec: String
    let from: String
    let path: String
    let display: String
    /// `create`, `same`, `clash`, `outside`.
    let action: String
    let note: String?
    var id: String { from + "→" + spec }
}

/// `POST /borrow/preview` and `/plugins/preview`: what a change would do.
struct WorkbenchChange: Decodable, Equatable {
    let op: String
    let title: String
    let summary: String
    let ok: Bool
    let blocked: String?
    let clashes: [String]
    let needsOverwrite: Bool
    let notes: [String]
    let files: [WorkbenchPlannedFile]
    let imports: [WorkbenchPlannedImport]
    let helpers: [String]
    let digest: String
}

/// The answer to an apply.
struct WorkbenchApplied: Decodable, Equatable {
    let ok: Bool
    let op: String
    let written: [String]
    let restart: Bool
    let text: String
}

/// `GET /plugins`.
struct WorkbenchPlugins: Decodable, Equatable {
    struct Adds: Decodable, Equatable {
        let type: String
        let names: [String]
    }

    struct Plugin: Decodable, Equatable, Identifiable {
        let name: String
        let path: String
        let display: String
        let link: Bool
        let target: String
        let isThisProject: Bool
        let entry: String?
        let on: Bool
        let loaded: Bool
        let entryValue: String
        let adds: [Adds]
        let addsText: String
        var id: String { name }
    }

    struct Missing: Decodable, Equatable, Identifiable {
        let entry: String
        let resolved: String?
        let note: String
        var id: String { entry }
    }

    struct Borrowed: Decodable, Equatable, Identifiable {
        let id: String
        let type: String
        let directory: String
        let display: String
        let exists: Bool
        let helpers: [String]
    }

    let envFile: String
    let envExists: Bool
    let line: String?
    let pluginsDir: String
    let pluginsDirIsDefault: Bool
    let loaded: [String]
    let plugins: [Plugin]
    let missing: [Missing]
    let cliFile: String
    let cliExists: Bool
    let borrowed: [Borrowed]
}

/// A change to ask the host for. The same request previews and applies;
/// it also rides in a change tile's address, so it round-trips through
/// `TileURI` options. Pure, so it is tested.
struct ChangeRequest: Equatable, Encodable {
    /// `borrow` (routes `/borrow/*`: ops copy, borrow, unborrow) or `plugins` (ops on, off, link).
    var route: String
    var op: String
    var registry: String?
    var id: String?
    var file: String?
    var root: String?
    var dir: String?
    var name: String?
    var entry: String?
    var folder: String?
    var overwrite: Bool = false
    var withImports: Bool = false
    /// Sent with an apply: the preview's digest.
    var digest: String?

    private enum CodingKeys: String, CodingKey {
        case op, registry, id, file, root, dir, name, entry, folder, overwrite, withImports, digest
    }

    static let fields = ["registry", "id", "file", "root", "dir", "name", "entry", "folder"]

    var options: [TileURI.Option] {
        var out = [TileURI.Option(name: "route", value: route), TileURI.Option(name: "op", value: op)]
        let values = [registry, id, file, root, dir, name, entry, folder]
        for (name, value) in zip(Self.fields, values) { if let value { out.append(.init(name: name, value: value)) } }
        return out
    }

    init(route: String, op: String, registry: String? = nil, id: String? = nil, file: String? = nil, root: String? = nil,
         dir: String? = nil, name: String? = nil, entry: String? = nil, folder: String? = nil) {
        self.route = route
        self.op = op
        self.registry = registry
        self.id = id
        self.file = file
        self.root = root
        self.dir = dir
        self.name = name
        self.entry = entry
        self.folder = folder
    }

    /// From a change tile's address. Nil without a route and an op.
    init?(uri: TileURI) {
        guard let route = uri.option("route"), let op = uri.option("op") else { return nil }
        self.init(route: route, op: op, registry: uri.option("registry"), id: uri.option("id"), file: uri.option("file"),
                  root: uri.option("root"), dir: uri.option("dir"), name: uri.option("name"), entry: uri.option("entry"),
                  folder: uri.option("folder"))
    }

    /// A hard copy of a helper, from its origin. Nil when it has no source file.
    static func copy(registry: String, id: String, origin: WorkbenchOrigin) -> ChangeRequest? {
        guard origin.kind != "builtin", let file = origin.file, let root = origin.root else { return nil }
        return ChangeRequest(route: "borrow", op: "copy", registry: registry, id: id, file: file, root: root)
    }

    /// A borrow of the folder a helper lives in.
    static func borrow(registry: String, origin: WorkbenchOrigin) -> ChangeRequest? {
        guard origin.kind != "builtin", let dir = origin.dir else { return nil }
        return ChangeRequest(route: "borrow", op: "borrow", registry: registry, dir: dir)
    }
}

extension WorkbenchClient {
    func preview(_ change: ChangeRequest) async throws -> WorkbenchChange {
        try await post("/\(change.route)/preview", change)
    }

    func apply(_ change: ChangeRequest) async throws -> WorkbenchApplied {
        try await post("/\(change.route)/apply", change)
    }

    func plugins() async throws -> WorkbenchPlugins {
        try await get("/plugins")
    }
}
