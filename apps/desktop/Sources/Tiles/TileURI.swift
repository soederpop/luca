import Foundation

/// The address of a tile: `luca://<project>/<tool>/<id>?<options>` for a
/// workbench tool, `app://desktop/<kind>/<id>` for the app's own tiles (its
/// keymap and layout files, the projects tile). `authority` holds the
/// project id (or `desktop`) and `kind` the tool.
///
/// The id may hold slashes (`doc/goals/ux.md`, `file/src/a.ts`), so
/// everything after the kind is the id. Options keep their order, so a URI
/// prints back exactly as it was parsed. Parsing is by hand, not with
/// `URLComponents`. Any other scheme does not
/// parse.
struct TileURI: Hashable, Codable, CustomStringConvertible {
    /// `luca://` for workbench tools, `app://` for the app's own tiles.
    enum Scheme: String, Hashable, CaseIterable {
        case luca, app
        var prefix: String { rawValue + "://" }
    }

    var scheme: Scheme
    var authority: String
    var kind: String
    var id: String?
    var options: [Option]

    struct Option: Hashable, Codable {
        var name: String
        var value: String
    }

    static let lucaScheme = "luca://"
    /// The authority of every `app://` address.
    static let appAuthority = "desktop"

    init(authority: String, kind: String, id: String? = nil, options: [Option] = [], scheme: Scheme = .luca) {
        self.scheme = scheme
        self.authority = authority
        self.kind = kind
        self.id = id
        self.options = options
    }

    /// A workbench tool's address: `luca://<project>/<tool>/<id>`.
    static func luca(project: String, tool: String, id: String? = nil, options: [Option] = []) -> TileURI {
        TileURI(authority: project, kind: tool, id: id, options: options, scheme: .luca)
    }

    /// One of the app's own tiles: `app://desktop/<kind>/<id>`.
    static func app(_ kind: String, id: String? = nil) -> TileURI {
        TileURI(authority: appAuthority, kind: kind, id: id, scheme: .app)
    }

    /// The project a `luca://` address names. Nil for `app://`.
    var project: String? { scheme == .luca ? authority : nil }

    /// The id the kind registry knows this address by: `luca-<tool>` or
    /// `app-<kind>`, so a tool and an app tile of one name never meet.
    var kindKey: String { scheme.rawValue + "-" + kind }

    init?(_ text: String) {
        guard let found = Scheme.allCases.first(where: { text.hasPrefix($0.prefix) }) else { return nil }
        scheme = found
        var rest = String(text.dropFirst(found.prefix.count))
        var query: String?
        if let mark = rest.firstIndex(of: "?") {
            query = String(rest[rest.index(after: mark)...])
            rest = String(rest[..<mark])
        }
        let parts = rest.split(separator: "/", omittingEmptySubsequences: false).map(String.init)
        guard parts.count >= 2, !parts[0].isEmpty, !parts[1].isEmpty else { return nil }
        authority = Self.decode(parts[0])
        kind = Self.decode(parts[1])
        let idText = parts.dropFirst(2).joined(separator: "/")
        id = idText.isEmpty ? nil : Self.decode(idText)
        options = (query ?? "").split(separator: "&").compactMap { pair in
            let halves = pair.split(separator: "=", maxSplits: 1).map(String.init)
            guard let name = halves.first, !name.isEmpty else { return nil }
            return Option(name: Self.decode(name), value: Self.decode(halves.count > 1 ? halves[1] : ""))
        }
    }

    var description: String {
        var text = scheme.prefix + Self.encode(authority, keepSlash: false) + "/" + Self.encode(kind, keepSlash: false)
        if let id { text += "/" + Self.encode(id, keepSlash: true) }
        if !options.isEmpty {
            text += "?" + options.map { Self.encode($0.name, keepSlash: true) + "=" + Self.encodeValue($0.value) }
                .joined(separator: "&")
        }
        return text
    }

    func option(_ name: String) -> String? {
        options.first { $0.name == name }?.value
    }

    func with(option name: String, _ value: String?) -> TileURI {
        var copy = self
        copy.options.removeAll { $0.name == name }
        if let value { copy.options.append(Option(name: name, value: value)) }
        return copy
    }

    func with(id: String?) -> TileURI {
        var copy = self
        copy.id = id
        return copy
    }

    // MARK: Codable as a string, so state.json stays readable.

    init(from decoder: Decoder) throws {
        let text = try decoder.singleValueContainer().decode(String.self)
        guard let uri = TileURI(text) else {
            throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "not a luca:// or app:// address: \(text)"))
        }
        self = uri
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encode(description)
    }

    // MARK: Escaping. Only the characters that would break the parse.

    /// Values may hold `=` (`about=project/x`); only `&` and friends break them.
    private static func encodeValue(_ text: String) -> String {
        encode(text, keepSlash: true).replacingOccurrences(of: "%3D", with: "=")
    }

    private static func decode(_ text: String) -> String {
        text.removingPercentEncoding ?? text
    }

    private static func encode(_ text: String, keepSlash: Bool) -> String {
        var out = ""
        for scalar in text.unicodeScalars {
            let breaks = "%?&#=".unicodeScalars.contains(scalar)
                || (!keepSlash && scalar == "/")
                || CharacterSet.whitespacesAndNewlines.contains(scalar)
                || CharacterSet.controlCharacters.contains(scalar)
            if breaks {
                for byte in String(scalar).utf8 { out += String(format: "%%%02X", byte) }
            } else {
                out.unicodeScalars.append(scalar)
            }
        }
        return out
    }
}
