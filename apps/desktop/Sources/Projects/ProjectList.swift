import Foundation

/// A project folder the app knows. `id` is its name in `luca://` addresses.
struct KnownProject: Codable, Hashable, Identifiable {
    var id: String
    var path: String
    /// The name the host reported (`GET /project`), once seen. Only a label.
    var name: String?
    var lastOpened: Date?
    /// The machine the folder is on, as ssh knows it (an alias from
    /// `~/.ssh/config`, or `user@host`). Nil: this Mac.
    var host: String? = nil

    var isRemote: Bool { host != nil }
    var label: String { name ?? id }
    /// Where it is, for a list: `~/x`, or `gpubox:~/x`.
    var place: String { host.map { "\($0):\(path)" } ?? (path as NSString).abbreviatingWithTildeInPath }
}

/// `~/.luca/desktop/projects.json`: the folders opened before, newest
/// first. Pure, so the rules (ids, paths, order) are tested without a disk.
struct ProjectList: Codable, Equatable {
    var projects: [KnownProject] = []

    /// A broken or missing file is an empty list, never a crash.
    static func decode(_ data: Data?) -> ProjectList {
        guard let data, !data.isEmpty else { return ProjectList() }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return (try? decoder.decode(ProjectList.self, from: data)) ?? ProjectList()
    }

    func encoded() -> Data {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        return (try? encoder.encode(self)) ?? Data("{\"projects\":[]}".utf8)
    }

    /// Newest first. Never opened ones last, by id.
    var recent: [KnownProject] {
        projects.sorted { a, b in
            switch (a.lastOpened, b.lastOpened) {
            case let (x?, y?): return x != y ? x > y : a.id < b.id
            case (.some, nil): return true
            case (nil, .some): return false
            case (nil, nil): return a.id < b.id
            }
        }
    }

    func project(_ id: String) -> KnownProject? {
        projects.first { $0.id == id }
    }

    func project(atPath path: String) -> KnownProject? {
        projects.first { $0.path == path && $0.host == nil }
    }

    /// Remember a folder on another machine. The same host and folder keeps its id.
    @discardableResult
    mutating func add(host: String, path: String, now: Date) -> KnownProject {
        if let index = projects.firstIndex(where: { $0.host == host && $0.path == path }) {
            projects[index].lastOpened = now
            return projects[index]
        }
        let entry = KnownProject(id: RemoteProject.id(host: host, path: path, taken: Set(projects.map(\.id))), path: path, name: nil, lastOpened: now, host: host)
        projects.append(entry)
        return entry
    }

    /// Remember a folder (already normalized). The same folder keeps its id;
    /// a new one gets a free id from its folder name.
    @discardableResult
    mutating func add(path: String, now: Date) -> KnownProject {
        if let index = projects.firstIndex(where: { $0.path == path && $0.host == nil }) {
            projects[index].lastOpened = now
            return projects[index]
        }
        let entry = KnownProject(id: Self.freeId(for: path, taken: Set(projects.map(\.id) + [PortfolioProject.id])), path: path, name: nil, lastOpened: now)
        projects.append(entry)
        return entry
    }

    mutating func setName(_ name: String, for id: String) {
        guard let index = projects.firstIndex(where: { $0.id == id }), projects[index].name != name else { return }
        projects[index].name = name
    }

    /// `~/@luca` is `luca`. Only letters, digits, `-`, `_` and `.`, so the id
    /// needs no escaping in an address. A taken id gets `-2`, `-3`.
    static func freeId(for path: String, taken: Set<String>) -> String {
        let base = slug(URL(fileURLWithPath: path).lastPathComponent)
        guard taken.contains(base) else { return base }
        var n = 2
        while taken.contains("\(base)-\(n)") { n += 1 }
        return "\(base)-\(n)"
    }

    static func slug(_ name: String) -> String {
        var out = ""
        for c in name.lowercased() {
            if c.isLetter || c.isNumber || "-_.".contains(c) { out.append(c) }
            else if !out.isEmpty, out.last != "-" { out.append("-") }
        }
        while out.hasPrefix(".") || out.hasPrefix("-") { out.removeFirst() }
        while out.hasSuffix("-") { out.removeLast() }
        return out.isEmpty ? "project" : out
    }

    /// `~/x`, `~`, a relative path (from `base`), trailing slashes: one
    /// absolute, standardized path.
    static func normalize(_ path: String, home: String, base: String? = nil) -> String {
        var text = path.trimmingCharacters(in: .whitespacesAndNewlines)
        if (text.hasPrefix("\"") && text.hasSuffix("\"")) || (text.hasPrefix("'") && text.hasSuffix("'")), text.count >= 2 {
            text = String(text.dropFirst().dropLast())
        }
        if text == "~" { text = home }
        else if text.hasPrefix("~/") { text = home + String(text.dropFirst(1)) }
        if !text.hasPrefix("/") { text = (base ?? home) + "/" + text }
        var standard = (text as NSString).standardizingPath
        while standard.count > 1, standard.hasSuffix("/") { standard.removeLast() }
        return standard
    }
}
