import Foundation
import CoreGraphics

enum WorkspaceMode: String, Codable {
    case free, organized

    var label: String { self == .free ? "free" : "organized" }
}

/// One of the nine workspaces: which tiles it holds and how they are placed.
///
/// Free mode: each tile's window frame is the truth, kept in `frames`.
/// Organized mode: `tree` sets every frame. Floating tiles sit outside the
/// tree and keep their own frame. This type is pure, so the layout rules
/// are tested without windows.
struct Workspace: Codable, Equatable {
    var mode: WorkspaceMode = .free
    /// Every tile on this workspace, in the order it opened.
    var tiles: [UUID] = []
    var tree: LayoutNode?
    var floating: Set<UUID> = []
    /// Last known frame of each tile, in screen points.
    var frames: [UUID: CGRect] = [:]
    var focused: UUID?
    /// `Mod-v` / `Mod-s`: where the next tile opens in organized mode.
    var nextSplit: SplitAxis?
    /// `Mod-z`: the zoomed tile (its whole group zooms with it), and in
    /// free mode each member's frame before the zoom.
    var zoomed: UUID?
    var zoomRestore: [UUID: CGRect] = [:]
    /// Tiles that act as one for move, close, zoom and send. A tile is in
    /// at most one group, and a group has two or more tiles.
    var groups: [[UUID]] = []
    /// The display this workspace tiles in organized mode (`NSScreenNumber`).
    var display: UInt32?
    /// The saved layout this workspace last loaded, so an edit to that file
    /// lands here, on the same tiles.
    var layout: LoadedLayout?

    var isEmpty: Bool { tiles.isEmpty }

    /// Free to organized, or back. Organized to free leaves every frame as
    /// the tree set it.
    mutating func toggleMode(in area: CGRect, gap: CGFloat) {
        zoomed = nil
        zoomRestore = [:]
        switch mode {
        case .free:
            let placed = tiles.compactMap { id in frames[id].map { (id, $0) } }
            tree = LayoutNode.build(from: placed, in: area)
            gatherGroups()
            floating = []
            mode = .organized
            applyTree(in: area, gap: gap)
        case .organized:
            tree = nil
            floating = []
            mode = .free
        }
    }

    /// Frames the tree gives its tiles. Writes them into `frames`.
    mutating func applyTree(in area: CGRect, gap: CGFloat, visible: ((UUID) -> Bool)? = nil) {
        guard mode == .organized, let tree else { return }
        let shown: LayoutNode?
        if let visible { shown = tree.filtered(visible) } else { shown = tree }
        guard let shown else { return }
        if let zoomed, shown.contains(zoomed) {
            // The zoomed tile's group fills the area as the subtree it is.
            let members = Set(self.members(of: zoomed)).intersection(shown.tiles)
            let block = shown.subtree(containing: members) ?? .leaf(zoomed)
            for (id, rect) in block.frames(in: area, gap: gap) { frames[id] = rect }
            return
        }
        for (id, rect) in shown.frames(in: area, gap: gap) { frames[id] = rect }
    }

    /// Tiles that should be on screen now.
    func visibleTiles(_ keep: (UUID) -> Bool = { _ in true }) -> [UUID] {
        switch mode {
        case .free:
            return tiles.filter(keep)
        case .organized:
            if let zoomed, keep(zoomed) {
                let block = tree?.filtered(keep)?.subtree(containing: Set(members(of: zoomed).filter(keep)))?.visibleTiles ?? [zoomed]
                return block + floating.filter { keep($0) && !block.contains($0) }.sorted { $0.uuidString < $1.uuidString }
            }
            let inTree = tree?.filtered(keep)?.visibleTiles ?? []
            return inTree + tiles.filter { floating.contains($0) && keep($0) }
        }
    }

    /// Add a tile. In organized mode it splits the focused tile's slot and
    /// ends any zoom, so the new tile is on screen in the tree.
    mutating func add(_ id: UUID, frame: CGRect) {
        tiles.append(id)
        frames[id] = frame
        if mode == .organized {
            if let tree, let target = focused, tree.contains(target) {
                let axis = nextSplit ?? Self.longerSide(frames[target] ?? frame)
                self.tree = tree.inserting(id, beside: target, axis: axis)
            } else if let tree, let last = tree.visibleTiles.last {
                self.tree = tree.inserting(id, beside: last, axis: nextSplit ?? .horizontal)
            } else {
                tree = .leaf(id)
            }
            nextSplit = nil
            // A zoom shows one slot only; the new tile would open as a loose
            // window over it. Zoom out so the split shows.
            zoomed = nil
            zoomRestore = [:]
        }
        focused = id
    }

    mutating func remove(_ id: UUID) {
        if var loaded = layout {
            loaded.slots = loaded.slots.filter { $0.value != id }
            layout = loaded
        }
        let index = tiles.firstIndex(of: id)
        tiles.removeAll { $0 == id }
        frames[id] = nil
        floating.remove(id)
        tree = tree?.removing(id)
        if zoomed == id { zoomed = nil; zoomRestore = [:] }
        zoomRestore[id] = nil
        groups = groups.map { $0.filter { $0 != id } }.filter { $0.count >= 2 }
        if focused == id {
            focused = index.flatMap { tiles.indices.contains($0 - 1) ? tiles[$0 - 1] : tiles.first } ?? tiles.last
        }
    }

    // MARK: Groups

    /// The tiles that act with `id`: its group, or just itself.
    func members(of id: UUID) -> [UUID] {
        groups.first { $0.contains(id) } ?? [id]
    }

    func isGrouped(_ id: UUID) -> Bool {
        groups.contains { $0.contains(id) }
    }

    /// `Mod-g <dir>`: put `id` and `other` (and their groups) in one group.
    /// In organized mode the other side moves next to this one, on the side
    /// it was, so the group is one subtree.
    mutating func join(_ id: UUID, with other: UUID, toward direction: Direction) {
        guard id != other, tiles.contains(id), tiles.contains(other) else { return }
        let mine = members(of: id), theirs = members(of: other)
        guard !mine.contains(other) else { return }
        groups.removeAll { $0.contains(id) || $0.contains(other) }
        groups.append(mine + theirs)
        guard mode == .organized, var tree else { return }
        // Floating tiles stay floating; only tree tiles gather.
        let moving = theirs.filter { tree.contains($0) }
        let anchorIds = Set(mine.filter { tree.contains($0) })
        guard !moving.isEmpty, !anchorIds.isEmpty else { return }
        var block: LayoutNode? = tree.subtree(containing: Set(moving))
        if let b = block, Set(b.tiles) != Set(moving) { block = LayoutNode.row(moving, axis: direction.axis.other) }
        for m in moving { if let next = tree.removing(m) { tree = next } }
        guard let anchor = tree.subtree(containing: anchorIds), let block else { return }
        self.tree = tree.insertingNode(block, beside: anchor, axis: direction.axis, after: direction.towardSecond)
    }

    /// `Mod-Shift-g`: break up the group `id` is in.
    mutating func ungroup(_ id: UUID) {
        groups.removeAll { $0.contains(id) }
    }

    /// After the tree is rebuilt, each group is made one subtree again.
    mutating func gatherGroups() {
        guard var tree else { return }
        for group in groups {
            let inTree = group.filter { tree.contains($0) }
            if inTree.count >= 2 { tree = tree.gathering(inTree) }
        }
        self.tree = tree
    }

    /// `Mod-z`: zoom the tile and its group to fill `area`, or back.
    mutating func toggleZoom(_ id: UUID, in area: CGRect, gap: CGFloat) {
        guard tiles.contains(id) else { return }
        let members = self.members(of: id)
        if mode == .organized {
            zoomed = (zoomed.map { self.members(of: $0).contains(id) } ?? false) ? nil : id
            return
        }
        if let z = zoomed, self.members(of: z).contains(id), !zoomRestore.isEmpty {
            for (m, frame) in zoomRestore where tiles.contains(m) { frames[m] = frame }
            zoomed = nil
            zoomRestore = [:]
            return
        }
        if zoomed != nil { for (m, frame) in zoomRestore where tiles.contains(m) { frames[m] = frame } }
        let current = Dictionary(uniqueKeysWithValues: members.compactMap { m in frames[m].map { (m, $0) } })
        zoomRestore = current
        zoomed = id
        for (m, rect) in Neighbors.fit(current, into: area.insetBy(dx: gap, dy: gap).integral) { frames[m] = rect }
    }

    /// `Mod-Shift-h/j/k/l` for a tile and its group. Organized: the group's
    /// subtree swaps places with the tile on that side. Free: the group,
    /// as one block, fills `half` (that half of its screen).
    mutating func moveGroup(of id: UUID, _ direction: Direction, half: CGRect, gap: CGFloat, visible: [UUID]) {
        let members = self.members(of: id)
        if mode == .organized, let tree, tree.contains(id) {
            let inTree = Set(members.filter { tree.contains($0) })
            guard let block = tree.subtree(containing: inTree) else { return }
            // The neighbor of the group's box, outside the group.
            var probe = frames.filter { visible.contains($0.key) && !inTree.contains($0.key) && tree.contains($0.key) }
            guard let box = Neighbors.bounds(inTree.compactMap { frames[$0] }) else { return }
            probe[id] = box
            guard let other = Neighbors.adjacent(to: id, direction, frames: probe, gap: gap),
                  let target = tree.slot(of: other) else { return }
            // A target slot that holds the group (a stack around it) can't swap.
            guard Set(target.tiles).isDisjoint(with: Set(block.tiles)) else { return }
            self.tree = tree.swappingNodes(block, target)
        } else {
            let current = Dictionary(uniqueKeysWithValues: members.compactMap { m in frames[m].map { (m, $0) } })
            for (m, rect) in Neighbors.fit(current, into: half) { frames[m] = rect }
            if let z = zoomed, members.contains(z) { zoomed = nil; zoomRestore = [:] }
        }
    }

    /// `Mod-Shift-Space`: take a tile out of the tree, or put it back next to
    /// the tile nearest its center.
    mutating func toggleFloat(_ id: UUID) {
        guard mode == .organized, tiles.contains(id) else { return }
        if floating.contains(id) {
            floating.remove(id)
            let frame = frames[id] ?? .zero
            let others = (tree?.visibleTiles ?? []).compactMap { other in frames[other].map { (other, $0) } }
            let nearest = others.min { lhs, rhs in
                Self.distance(lhs.1, frame) < Self.distance(rhs.1, frame)
            }
            if let tree, let (target, rect) = nearest {
                let axis = Self.longerSide(rect)
                let after = axis == .horizontal ? frame.midX >= rect.midX : frame.midY <= rect.midY
                self.tree = tree.inserting(id, beside: target, axis: axis, after: after)
            } else {
                tree = .leaf(id)
            }
        } else {
            floating.insert(id)
            tree = tree?.removing(id)
            if let frame = frames[id] {
                // Float out a little smaller, so it reads as lifted.
                frames[id] = frame.insetBy(dx: frame.width * 0.1, dy: frame.height * 0.1).integral
            }
        }
    }

    /// Mouse drop in organized mode: onto the middle of a tile swaps the two,
    /// onto an edge band splits there.
    mutating func drop(_ id: UUID, at point: CGPoint) {
        guard mode == .organized, let tree, tree.contains(id) else { return }
        // A drop can split a group's subtree; gather it again after.
        defer { gatherGroups() }
        let targets = tree.visibleTiles.filter { $0 != id }
        guard let target = targets.first(where: { frames[$0]?.contains(point) == true }),
              let rect = frames[target] else { return }
        let fx = (point.x - rect.minX) / max(rect.width, 1)
        let fy = (point.y - rect.minY) / max(rect.height, 1)
        let band: CGFloat = 0.25
        let edge: Direction?
        if fx < band { edge = .left } else if fx > 1 - band { edge = .right }
        else if fy > 1 - band { edge = .up } else if fy < band { edge = .down } else { edge = nil }
        if let edge, let without = tree.removing(id) {
            self.tree = without.inserting(id, beside: target, axis: edge.axis, after: edge.towardSecond)
        } else {
            self.tree = tree.swapping(id, target)
        }
    }

    /// Which tile focus moves to from `from`.
    func neighbor(of from: UUID, _ direction: Direction, gap: CGFloat, visible: [UUID]) -> UUID? {
        let shown = frames.filter { visible.contains($0.key) }
        if mode == .organized, tree?.contains(from) == true {
            let inTree = shown.filter { tree?.contains($0.key) == true }
            return Neighbors.adjacent(to: from, direction, frames: inTree, gap: gap)
        }
        return Neighbors.nearest(to: from, direction, frames: shown)
    }

    static func longerSide(_ rect: CGRect) -> SplitAxis {
        rect.width >= rect.height ? .horizontal : .vertical
    }

    private static func distance(_ a: CGRect, _ b: CGRect) -> CGFloat {
        hypot(a.midX - b.midX, a.midY - b.midY)
    }

    // MARK: Codable: CGRect as [x, y, w, h].

    private enum Keys: String, CodingKey { case mode, tiles, tree, floating, frames, focused, nextSplit, display, groups, layout }

    init() {}

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: Keys.self)
        mode = try c.decodeIfPresent(WorkspaceMode.self, forKey: .mode) ?? .free
        tiles = try c.decodeIfPresent([UUID].self, forKey: .tiles) ?? []
        tree = try c.decodeIfPresent(LayoutNode.self, forKey: .tree)
        floating = try c.decodeIfPresent(Set<UUID>.self, forKey: .floating) ?? []
        let raw = try c.decodeIfPresent([String: [Double]].self, forKey: .frames) ?? [:]
        for (key, v) in raw where v.count == 4 {
            if let id = UUID(uuidString: key) { frames[id] = CGRect(x: v[0], y: v[1], width: v[2], height: v[3]) }
        }
        focused = try c.decodeIfPresent(UUID.self, forKey: .focused)
        nextSplit = try c.decodeIfPresent(SplitAxis.self, forKey: .nextSplit)
        display = try c.decodeIfPresent(UInt32.self, forKey: .display)
        let known = Set(tiles)
        groups = (try c.decodeIfPresent([[UUID]].self, forKey: .groups) ?? [])
            .map { $0.filter(known.contains) }.filter { $0.count >= 2 }
        layout = try? c.decodeIfPresent(LoadedLayout.self, forKey: .layout)
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: Keys.self)
        try c.encode(mode, forKey: .mode)
        try c.encode(tiles, forKey: .tiles)
        try c.encodeIfPresent(tree, forKey: .tree)
        try c.encode(floating.sorted { $0.uuidString < $1.uuidString }, forKey: .floating)
        var raw: [String: [Double]] = [:]
        for (id, r) in frames {
            raw[id.uuidString] = [Double(r.minX), Double(r.minY), Double(r.width), Double(r.height)]
        }
        try c.encode(raw, forKey: .frames)
        try c.encodeIfPresent(focused, forKey: .focused)
        try c.encodeIfPresent(nextSplit, forKey: .nextSplit)
        try c.encodeIfPresent(display, forKey: .display)
        if !groups.isEmpty { try c.encode(groups, forKey: .groups) }
        try c.encodeIfPresent(layout, forKey: .layout)
    }
}

/// Which layout a workspace loaded, with what params, and which tile took
/// each slot (`<index>|<address>`), so applying it again keeps those tiles.
struct LoadedLayout: Codable, Equatable {
    var name: String
    var params: [String: String] = [:]
    var slots: [String: UUID] = [:]

    static func slotKey(_ index: Int, _ uri: TileURI) -> String { "\(index)|\(uri)" }
}
