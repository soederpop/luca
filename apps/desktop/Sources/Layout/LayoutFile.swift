import Foundation
import CoreGraphics
import Yams

/// A saved workspace: `~/.luca/desktop/layouts/<name>.yml`.
///
/// Organized: `root` is the tree, with tile addresses at the leaves, and
/// `floating` holds tiles outside it. Free: `tiles`, each with a `frame`.
/// A frame is `[x, y, w, h]` as fractions of the screen, from the top left.
/// `params` names the `{param}` holes in the addresses. Pure, so save,
/// parse and build are tested without windows.
struct LayoutFile: Equatable {
    indirect enum Node: Equatable {
        case tile(String)
        case split(SplitAxis, Double, Node, Node)
        case stack([String], active: Int)
        /// The tiles under it act as one group.
        case group(Node)

        /// Leaf addresses in reading order, the same order as `LayoutNode.tiles`.
        var uris: [String] {
            switch self {
            case .tile(let uri): return [uri]
            case .split(_, _, let a, let b): return a.uris + b.uris
            case .stack(let uris, _): return uris
            case .group(let inner): return inner.uris
            }
        }

        func mapURIs(_ change: (String) throws -> String) rethrows -> Node {
            switch self {
            case .tile(let uri): return .tile(try change(uri))
            case .split(let axis, let ratio, let a, let b): return .split(axis, ratio, try a.mapURIs(change), try b.mapURIs(change))
            case .stack(let uris, let active): return .stack(try uris.map(change), active: active)
            case .group(let inner): return .group(try inner.mapURIs(change))
            }
        }
    }

    /// A tile with its own frame: every tile in free mode, a floating one in organized.
    struct Loose: Equatable {
        var uri: String
        var frame: [Double]
        /// Free mode: tiles with the same number are one group.
        var group: Int?
    }

    var name: String
    var mode: WorkspaceMode
    var params: [String] = []
    var root: Node?
    var floating: [Loose] = []
    var tiles: [Loose] = []

    /// Every address, in the order `build` hands out tile ids.
    var slots: [String] {
        mode == .organized ? (root?.uris ?? []) + floating.map(\.uri) : tiles.map(\.uri)
    }

    static func validName(_ name: String) -> Bool {
        !name.isEmpty && !name.hasPrefix(".") && name.range(of: #"^[A-Za-z0-9._-]+$"#, options: .regularExpression) != nil
    }
}

struct LayoutError: Error, LocalizedError, Equatable {
    let message: String
    init(_ message: String) { self.message = message }
    var errorDescription: String? { message }
}

// MARK: - Parse

extension LayoutFile {
    /// Read a layout file. Throws with the place that is wrong; nothing is
    /// half read.
    static func parse(_ text: String, name fallback: String = "") throws -> LayoutFile {
        let loaded: Any?
        do {
            loaded = try Yams.load(yaml: text)
        } catch {
            throw LayoutError("Not valid YAML: \(error)")
        }
        guard let map = normalized(loaded) as? [String: Any] else { throw LayoutError("A layout is a YAML map (name, mode, root or tiles)") }
        let known: Set<String> = ["name", "mode", "params", "root", "floating", "tiles"]
        if let extra = map.keys.first(where: { !known.contains($0) }) { throw LayoutError("Unknown key '\(extra)'") }

        let name = (map["name"].map { "\($0)" }) ?? fallback
        let modeText = (map["mode"] as? String) ?? (map["tiles"] != nil && map["root"] == nil ? "free" : "organized")
        guard let mode = WorkspaceMode(rawValue: modeText) else { throw LayoutError("mode is free or organized, not '\(modeText)'") }

        var params: [String] = []
        if let raw = map["params"] {
            guard let list = raw as? [Any] else { throw LayoutError("params is a list, like [project]") }
            params = list.map { "\($0)" }
        }

        var file = LayoutFile(name: name, mode: mode, params: params)
        switch mode {
        case .organized:
            if map["tiles"] != nil { throw LayoutError("An organized layout uses root, not tiles") }
            if let root = map["root"] { file.root = try node(root, at: "root") }
            file.floating = try looseList(map["floating"], at: "floating")
        case .free:
            if map["root"] != nil { throw LayoutError("A free layout uses tiles with frames, not root") }
            file.tiles = try looseList(map["tiles"], at: "tiles")
        }
        if file.slots.isEmpty { throw LayoutError("The layout has no tiles") }
        try file.checkHoles()
        return file
    }

    /// Yams gives `[AnyHashable: Any]` maps; the readers below want string keys.
    private static func normalized(_ value: Any?) -> Any? {
        if let map = value as? [AnyHashable: Any] {
            var out: [String: Any] = [:]
            for (key, inner) in map { out["\(key.base)"] = normalized(inner) }
            return out
        }
        if let list = value as? [Any] { return list.map { normalized($0) ?? NSNull() } }
        return value
    }

    private static func node(_ raw: Any, at path: String) throws -> Node {
        if let uri = raw as? String { return .tile(uri) }
        guard let map = raw as? [String: Any] else { throw LayoutError("\(path): a tile, split, stack or group") }
        if let uri = map["tile"] {
            guard let text = uri as? String else { throw LayoutError("\(path).tile is a luca:// address") }
            return .tile(text)
        }
        if let inner = map["group"] { return .group(try node(inner, at: "\(path).group")) }
        if let list = map["stack"] {
            guard let items = list as? [Any], !items.isEmpty else { throw LayoutError("\(path).stack is a list of tiles") }
            let uris = try items.enumerated().map { index, item -> String in
                if case .tile(let uri) = try node(item, at: "\(path).stack[\(index)]") { return uri }
                throw LayoutError("\(path).stack[\(index)]: a stack holds tiles only")
            }
            let active = (map["active"] as? Int) ?? 0
            guard uris.indices.contains(active) else { throw LayoutError("\(path).active is 0 to \(uris.count - 1)") }
            return .stack(uris, active: active)
        }
        if let axisText = map["split"] {
            guard let axis = SplitAxis(rawValue: "\(axisText)") else { throw LayoutError("\(path).split is horizontal or vertical") }
            guard let children = map["children"] as? [Any], children.count == 2 else {
                throw LayoutError("\(path): a split has two children")
            }
            let ratio = try number(map["ratio"], at: "\(path).ratio") ?? 0.5
            guard ratio > 0, ratio < 1 else { throw LayoutError("\(path).ratio is between 0 and 1") }
            return .split(axis, LayoutNode.clamp(ratio),
                          try node(children[0], at: "\(path).children[0]"),
                          try node(children[1], at: "\(path).children[1]"))
        }
        throw LayoutError("\(path): a tile, split, stack or group")
    }

    private static func looseList(_ raw: Any?, at path: String) throws -> [Loose] {
        guard let raw else { return [] }
        guard let items = raw as? [Any] else { throw LayoutError("\(path) is a list of tiles with frames") }
        return try items.enumerated().map { index, item in
            let at = "\(path)[\(index)]"
            guard let map = item as? [String: Any], let uri = map["tile"] as? String else { throw LayoutError("\(at): needs tile: <luca:// address>") }
            guard let frameRaw = map["frame"] as? [Any], frameRaw.count == 4 else { throw LayoutError("\(at).frame is [x, y, w, h]") }
            let frame = try frameRaw.enumerated().map { i, v in try number(v, at: "\(at).frame[\(i)]") ?? 0 }
            guard frame[2] > 0, frame[3] > 0 else { throw LayoutError("\(at).frame: width and height are above 0") }
            let group = try map["group"].map { g -> Int in
                guard let n = g as? Int else { throw LayoutError("\(at).group is a number") }
                return n
            }
            return Loose(uri: uri, frame: frame, group: group)
        }
    }

    private static func number(_ raw: Any?, at path: String) throws -> Double? {
        guard let raw else { return nil }
        if let d = raw as? Double { return d }
        if let i = raw as? Int { return Double(i) }
        throw LayoutError("\(path) is a number")
    }

    /// Every `{hole}` in an address is listed in `params`.
    private func checkHoles() throws {
        let listed = Set(params)
        for uri in slots {
            for hole in Self.holes(in: uri) where !listed.contains(hole) {
                throw LayoutError("\(uri) uses {\(hole)}, but params does not list it")
            }
        }
    }

    static func holes(in text: String) -> [String] {
        guard let regex = try? NSRegularExpression(pattern: #"\{([A-Za-z0-9_]+)\}"#) else { return [] }
        let range = NSRange(text.startIndex..., in: text)
        return regex.matches(in: text, range: range).compactMap { Range($0.range(at: 1), in: text).map { String(text[$0]) } }
    }
}

// MARK: - Params

extension LayoutFile {
    /// Fill the holes. Every param needs a value. Returns the addresses in
    /// slot order; one that does not read as a `luca://` or `app://` address
    /// (another scheme) is nil, so the caller skips that
    /// slot and keeps the rest.
    func resolve(_ values: [String: String]) throws -> (file: LayoutFile, uris: [TileURI?]) {
        let missing = params.filter { (values[$0] ?? "").isEmpty }
        if !missing.isEmpty { throw LayoutError("\(name) needs \(missing.joined(separator: ", "))") }
        let fill: (String) throws -> String = { text in
            var out = text
            for param in self.params { out = out.replacingOccurrences(of: "{\(param)}", with: values[param] ?? "") }
            return out
        }
        var copy = self
        copy.params = []
        copy.root = try root?.mapURIs(fill)
        copy.floating = try floating.map { var l = $0; l.uri = try fill(l.uri); return l }
        copy.tiles = try tiles.map { var l = $0; l.uri = try fill(l.uri); return l }
        return (copy, copy.slots.map { TileURI($0) })
    }
}

/// The params a layout can take from the tile in focus: its project.
enum LayoutParams {
    static func from(_ uri: TileURI) -> [String: String] {
        guard let project = uri.project else { return [:] }
        return ["project": project]
    }
}

// MARK: - Capture and build

extension LayoutFile {
    /// The workspace as a layout. Addresses are the tiles' own, so a saved
    /// layout is a snapshot; `{params}` come from editing the file.
    static func capture(_ ws: Workspace, name: String, uri: (UUID) -> TileURI?, area: CGRect) -> LayoutFile {
        var file = LayoutFile(name: name, mode: ws.mode)
        func text(_ id: UUID) -> String? { uri(id)?.description }
        switch ws.mode {
        case .organized:
            let groups = ws.groups.compactMap { group -> Set<UUID>? in
                let inTree = Set(group.filter { ws.tree?.contains($0) == true })
                return inTree.count >= 2 ? inTree : nil
            }
            file.root = ws.tree.flatMap { node($0, groups: groups, text: text) }
            file.floating = ws.tiles.filter { ws.floating.contains($0) }.compactMap { id in
                guard let address = text(id), let frame = ws.frames[id] else { return nil }
                return Loose(uri: address, frame: fraction(frame, of: area), group: nil)
            }
        case .free:
            file.tiles = ws.tiles.compactMap { id in
                guard let address = text(id), let frame = ws.frames[id] else { return nil }
                let group = ws.groups.firstIndex { $0.contains(id) }.map { $0 + 1 }
                return Loose(uri: address, frame: fraction(frame, of: area), group: group)
            }
        }
        return file
    }

    private static func node(_ tree: LayoutNode, groups: [Set<UUID>], text: (UUID) -> String?) -> Node? {
        if let group = groups.first(where: { $0 == Set(tree.tiles) }) {
            let rest = groups.filter { $0 != group }
            return inner(tree, groups: rest, text: text).map(Node.group)
        }
        return inner(tree, groups: groups, text: text)
    }

    private static func inner(_ tree: LayoutNode, groups: [Set<UUID>], text: (UUID) -> String?) -> Node? {
        switch tree {
        case .leaf(let id): return text(id).map(Node.tile)
        case .stack(let ids, let active):
            let uris = ids.compactMap(text)
            return uris.isEmpty ? nil : .stack(uris, active: min(max(active, 0), uris.count - 1))
        case .split(let axis, let ratio, let a, let b):
            switch (node(a, groups: groups, text: text), node(b, groups: groups, text: text)) {
            case (let x?, let y?): return .split(axis, ratio, x, y)
            case (let x?, nil): return x
            case (nil, let y?): return y
            case (nil, nil): return nil
            }
        }
    }

    /// A workspace from the layout. `ids` are the tile ids for `slots`, in
    /// order. `area` is the screen the fractions are of.
    func build(ids: [UUID], area: CGRect, gap: CGFloat) -> Workspace {
        var ws = Workspace()
        ws.mode = mode
        var next = ids.makeIterator()
        switch mode {
        case .organized:
            var groups: [[UUID]] = []
            ws.tree = root.flatMap { Self.tree($0, ids: &next, groups: &groups) }
            ws.groups = groups.filter { $0.count >= 2 }
            ws.tiles = ws.tree?.tiles ?? []
            for loose in floating {
                guard let id = next.next() else { break }
                ws.tiles.append(id)
                ws.floating.insert(id)
                ws.frames[id] = Self.rect(loose.frame, in: area)
            }
            ws.applyTree(in: area, gap: gap)
        case .free:
            var byGroup: [Int: [UUID]] = [:]
            for loose in tiles {
                guard let id = next.next() else { break }
                ws.tiles.append(id)
                ws.frames[id] = Self.rect(loose.frame, in: area)
                if let g = loose.group { byGroup[g, default: []].append(id) }
            }
            ws.groups = byGroup.keys.sorted().compactMap { byGroup[$0] }.filter { $0.count >= 2 }
        }
        ws.focused = ws.tiles.first
        return ws
    }

    private static func tree(_ node: Node, ids: inout IndexingIterator<[UUID]>, groups: inout [[UUID]]) -> LayoutNode? {
        switch node {
        case .tile: return ids.next().map(LayoutNode.leaf)
        case .stack(let uris, let active):
            let taken = uris.compactMap { _ in ids.next() }
            return taken.isEmpty ? nil : .stack(taken, active: min(active, taken.count - 1))
        case .group(let inner):
            let sub = tree(inner, ids: &ids, groups: &groups)
            if let sub { groups.append(sub.tiles) }
            return sub
        case .split(let axis, let ratio, let a, let b):
            let x = tree(a, ids: &ids, groups: &groups), y = tree(b, ids: &ids, groups: &groups)
            switch (x, y) {
            case (let x?, let y?): return .split(axis, ratio, x, y)
            case (let x?, nil): return x
            case (nil, let y?): return y
            case (nil, nil): return nil
            }
        }
    }

    /// Screen points to `[x, y, w, h]` fractions, y from the top.
    static func fraction(_ rect: CGRect, of area: CGRect) -> [Double] {
        let w = max(Double(area.width), 1), h = max(Double(area.height), 1)
        let values = [
            Double(rect.minX - area.minX) / w,
            Double(area.maxY - rect.maxY) / h,
            Double(rect.width) / w,
            Double(rect.height) / h,
        ]
        return values.map { ($0 * 100_000).rounded() / 100_000 }
    }

    static func rect(_ frame: [Double], in area: CGRect) -> CGRect {
        guard frame.count == 4 else { return area }
        let w = Double(area.width), h = Double(area.height)
        let width = (frame[2] * w).rounded(), height = (frame[3] * h).rounded()
        let x = (Double(area.minX) + frame[0] * w).rounded()
        let top = Double(area.maxY) - frame[1] * h
        return CGRect(x: x, y: (top - frame[3] * h).rounded(), width: width, height: height)
    }
}

// MARK: - Write

extension LayoutFile {
    /// The file text. Block YAML, keys in a fixed order, so a hand edit
    /// and a diff both read well.
    var yaml: String {
        var lines = [
            "# Luca Desktop layout. :layout load \(name) applies it; :layout edit \(name) opens this file.",
            "# Frames are [x, y, w, h], fractions of the screen from its top left.",
            "name: \(Self.scalar(name))",
            "mode: \(mode.rawValue)",
        ]
        if !params.isEmpty { lines.append("params: [\(params.map(Self.scalar).joined(separator: ", "))]") }
        switch mode {
        case .organized:
            if let root {
                lines.append("root:")
                lines += Self.lines(root).map { "  " + $0 }
            }
            if !floating.isEmpty {
                lines.append("floating:")
                lines += floating.flatMap(Self.lines)
            }
        case .free:
            lines.append("tiles:")
            lines += tiles.flatMap(Self.lines)
        }
        return lines.joined(separator: "\n") + "\n"
    }

    /// A node as the lines of a map.
    private static func lines(_ node: Node) -> [String] {
        switch node {
        case .tile(let uri): return ["tile: \(scalar(uri))"]
        case .group(let inner): return ["group:"] + lines(inner).map { "  " + $0 }
        case .stack(let uris, let active):
            var out = ["stack:"] + uris.map { "  - tile: \(scalar($0))" }
            if active != 0 { out.append("active: \(active)") }
            return out
        case .split(let axis, let ratio, let a, let b):
            return ["split: \(axis.rawValue)", "ratio: \(number(ratio))", "children:"]
                + item(lines(a)) + item(lines(b))
        }
    }

    private static func lines(_ loose: Loose) -> [String] {
        var out = ["tile: \(scalar(loose.uri))", "frame: [\(loose.frame.map(number).joined(separator: ", "))]"]
        if let group = loose.group { out.append("group: \(group)") }
        return item(out)
    }

    /// A map as a list item: `- ` on the first line, the rest under it.
    private static func item(_ map: [String]) -> [String] {
        map.enumerated().map { index, line in (index == 0 ? "  - " : "    ") + line }
    }

    private static func number(_ value: Double) -> String {
        let rounded = (value * 100_000).rounded() / 100_000
        if rounded == rounded.rounded() { return String(Int(rounded)) }
        return String(rounded)
    }

    /// Plain when YAML reads it back as the same string, else double quoted.
    static func scalar(_ text: String) -> String {
        let plain = text.range(of: #"^[A-Za-z0-9@{][^\s#,\[\]{}"']*$"#, options: .regularExpression) != nil
            && !text.hasPrefix("{") && !text.contains(": ")
            && !["true", "false", "yes", "no", "null", "on", "off", "~"].contains(text.lowercased())
            && Double(text) == nil
        if plain { return text }
        return "\"" + text.replacingOccurrences(of: "\\", with: "\\\\").replacingOccurrences(of: "\"", with: "\\\"") + "\""
    }
}
