import Foundation
import CoreGraphics

/// How a split lays out its two children.
/// `horizontal`: side by side, first on the left.
/// `vertical`: one above the other, first on top.
enum SplitAxis: String, Codable {
    case horizontal, vertical

    var other: SplitAxis { self == .horizontal ? .vertical : .horizontal }
}

/// A key direction. Frames are AppKit screen frames, so `up` is larger y.
enum Direction: String, Codable, CaseIterable {
    case left, down, up, right

    var axis: SplitAxis { (self == .left || self == .right) ? .horizontal : .vertical }
    /// True when this direction points at the second child of a split.
    var towardSecond: Bool { self == .right || self == .down }
}

/// The organized-mode tree, the same as i3 or bspwm: splits, stacks, leaves.
indirect enum LayoutNode: Equatable {
    case leaf(UUID)
    case split(SplitAxis, Double, LayoutNode, LayoutNode)
    /// Several tiles in one slot. Only `active` is on screen.
    case stack([UUID], active: Int)

    static let minRatio = 0.1
    static let maxRatio = 0.9

    /// Every tile in the tree, in reading order.
    var tiles: [UUID] {
        switch self {
        case .leaf(let id): return [id]
        case .split(_, _, let a, let b): return a.tiles + b.tiles
        case .stack(let ids, _): return ids
        }
    }

    func contains(_ id: UUID) -> Bool { tiles.contains(id) }

    /// Tiles that are on screen: every leaf, and the active tile of each stack.
    var visibleTiles: [UUID] {
        switch self {
        case .leaf(let id): return [id]
        case .split(_, _, let a, let b): return a.visibleTiles + b.visibleTiles
        case .stack(let ids, let active): return ids.isEmpty ? [] : [ids[min(max(active, 0), ids.count - 1)]]
        }
    }

    // MARK: Frames

    /// A frame for every tile. The whole rect is inset by `gap`, and children
    /// are `gap` apart. Stacked tiles share their slot.
    func frames(in rect: CGRect, gap: CGFloat) -> [UUID: CGRect] {
        var out: [UUID: CGRect] = [:]
        place(in: rect.insetBy(dx: gap, dy: gap), gap: gap, into: &out)
        return out
    }

    private func place(in rect: CGRect, gap: CGFloat, into out: inout [UUID: CGRect]) {
        switch self {
        case .leaf(let id):
            out[id] = rect.integral
        case .stack(let ids, _):
            for id in ids { out[id] = rect.integral }
        case .split(let axis, let ratio, let a, let b):
            let (first, second) = Self.divide(rect, axis: axis, ratio: ratio, gap: gap)
            a.place(in: first, gap: gap, into: &out)
            b.place(in: second, gap: gap, into: &out)
        }
    }

    static func divide(_ rect: CGRect, axis: SplitAxis, ratio: Double, gap: CGFloat) -> (CGRect, CGRect) {
        let r = CGFloat(min(max(ratio, minRatio), maxRatio))
        switch axis {
        case .horizontal:
            let usable = max(0, rect.width - gap)
            let w = (usable * r).rounded()
            return (CGRect(x: rect.minX, y: rect.minY, width: w, height: rect.height),
                    CGRect(x: rect.minX + w + gap, y: rect.minY, width: usable - w, height: rect.height))
        case .vertical:
            // First child on top: AppKit y grows upward.
            let usable = max(0, rect.height - gap)
            let h = (usable * r).rounded()
            return (CGRect(x: rect.minX, y: rect.maxY - h, width: rect.width, height: h),
                    CGRect(x: rect.minX, y: rect.minY, width: rect.width, height: usable - h))
        }
    }

    // MARK: Edits. Each returns a new tree; nil means the tree is now empty.

    func removing(_ id: UUID) -> LayoutNode? {
        switch self {
        case .leaf(let leaf):
            return leaf == id ? nil : self
        case .stack(let ids, let active):
            let kept = ids.filter { $0 != id }
            if kept.isEmpty { return nil }
            if kept.count == 1 { return .leaf(kept[0]) }
            return .stack(kept, active: min(active, kept.count - 1))
        case .split(let axis, let ratio, let a, let b):
            let na = a.removing(id), nb = b.removing(id)
            switch (na, nb) {
            case (nil, nil): return nil
            case (let x?, nil): return x
            case (nil, let y?): return y
            case (let x?, let y?): return .split(axis, ratio, x, y)
            }
        }
    }

    /// Put `newId` next to `target`, splitting the target's slot. A target
    /// inside a stack splits the whole stack.
    func inserting(_ newId: UUID, beside target: UUID, axis: SplitAxis, after: Bool = true) -> LayoutNode {
        switch self {
        case .leaf(let id) where id == target:
            return Self.pair(self, .leaf(newId), axis: axis, after: after)
        case .stack(let ids, _) where ids.contains(target):
            return Self.pair(self, .leaf(newId), axis: axis, after: after)
        case .split(let ax, let ratio, let a, let b):
            if a.contains(target) { return .split(ax, ratio, a.inserting(newId, beside: target, axis: axis, after: after), b) }
            if b.contains(target) { return .split(ax, ratio, a, b.inserting(newId, beside: target, axis: axis, after: after)) }
            return self
        default:
            return self
        }
    }

    private static func pair(_ existing: LayoutNode, _ new: LayoutNode, axis: SplitAxis, after: Bool) -> LayoutNode {
        after ? .split(axis, 0.5, existing, new) : .split(axis, 0.5, new, existing)
    }

    func swapping(_ x: UUID, _ y: UUID) -> LayoutNode {
        func swap(_ id: UUID) -> UUID { id == x ? y : (id == y ? x : id) }
        switch self {
        case .leaf(let id): return .leaf(swap(id))
        case .stack(let ids, let active): return .stack(ids.map(swap), active: active)
        case .split(let axis, let ratio, let a, let b): return .split(axis, ratio, a.swapping(x, y), b.swapping(x, y))
        }
    }

    /// `Mod-t`: the split that holds `id` becomes a stack of its tiles, and a
    /// stack becomes a row again.
    func togglingStack(at id: UUID) -> LayoutNode {
        switch self {
        case .leaf:
            return self
        case .stack(let ids, _) where ids.contains(id):
            return Self.row(ids, axis: .horizontal)
        case .stack:
            return self
        case .split(let axis, let ratio, let a, let b):
            // The innermost split whose child is the leaf itself.
            if a == .leaf(id) || b == .leaf(id) {
                let ids = tiles
                return .stack(ids, active: ids.firstIndex(of: id) ?? 0)
            }
            if a.contains(id) { return .split(axis, ratio, a.togglingStack(at: id), b) }
            if b.contains(id) { return .split(axis, ratio, a, b.togglingStack(at: id)) }
            return self
        }
    }

    /// `Mod-e`: the innermost split that holds `id` turns side by side into
    /// stacked, and back. The ratio and child order stay.
    func rotatingSplit(at id: UUID) -> LayoutNode {
        guard case .split(let axis, let ratio, let a, let b) = self, contains(id) else { return self }
        let inA = a.contains(id)
        if case .split = inA ? a : b {
            return inA ? .split(axis, ratio, a.rotatingSplit(at: id), b) : .split(axis, ratio, a, b.rotatingSplit(at: id))
        }
        return .split(axis.other, ratio, a, b)
    }

    /// Evenly sized chain of tiles along one axis.
    static func row(_ ids: [UUID], axis: SplitAxis) -> LayoutNode {
        guard let first = ids.first else { return .stack([], active: 0) }
        if ids.count == 1 { return .leaf(first) }
        return .split(axis, 1.0 / Double(ids.count), .leaf(first), row(Array(ids.dropFirst()), axis: axis))
    }

    /// `Mod-[` / `Mod-]`: move the stack that holds `id` to its next tile.
    /// Returns the tree and the tile now in front.
    func cyclingStack(at id: UUID, by step: Int) -> (LayoutNode, UUID?) {
        switch self {
        case .stack(let ids, let active) where ids.contains(id):
            let next = ((active + step) % ids.count + ids.count) % ids.count
            return (.stack(ids, active: next), ids[next])
        case .split(let axis, let ratio, let a, let b):
            if a.contains(id) { let (na, f) = a.cyclingStack(at: id, by: step); return (.split(axis, ratio, na, b), f) }
            if b.contains(id) { let (nb, f) = b.cyclingStack(at: id, by: step); return (.split(axis, ratio, a, nb), f) }
            return (self, nil)
        default:
            return (self, nil)
        }
    }

    /// Bring `id` to the front of its stack, if it is in one.
    func activating(_ id: UUID) -> LayoutNode {
        switch self {
        case .stack(let ids, _) where ids.contains(id):
            return .stack(ids, active: ids.firstIndex(of: id) ?? 0)
        case .split(let axis, let ratio, let a, let b):
            return .split(axis, ratio, a.activating(id), b.activating(id))
        default:
            return self
        }
    }

    /// Resize mode: grow the tile toward `direction` by moving the nearest
    /// split edge on that side.
    func resizing(_ id: UUID, toward direction: Direction, by delta: Double) -> LayoutNode {
        guard case .split(let axis, let ratio, let a, let b) = self else { return self }
        let inA = a.contains(id), inB = b.contains(id)
        guard inA || inB else { return self }
        // Deeper splits get the first chance, so the closest edge moves.
        let child = inA ? a : b
        let resizedChild = child.resizing(id, toward: direction, by: delta)
        if resizedChild != child {
            return inA ? .split(axis, ratio, resizedChild, b) : .split(axis, ratio, a, resizedChild)
        }
        guard axis == direction.axis else { return self }
        // The edge between a and b is on a's far side and b's near side.
        if inA && direction.towardSecond {
            return .split(axis, Self.clamp(ratio + delta), a, b)
        }
        if inB && !direction.towardSecond {
            return .split(axis, Self.clamp(ratio - delta), a, b)
        }
        return self
    }

    /// `Mod-Shift-r`: the nearest split of `axis` around `id` shares its
    /// space evenly, so the tile is half as wide (horizontal) or half as
    /// tall (vertical) as that split. No split of that axis: the tree stays.
    func halving(_ id: UUID, axis: SplitAxis) -> LayoutNode {
        halved(id, axis: axis) ?? self
    }

    private func halved(_ id: UUID, axis: SplitAxis) -> LayoutNode? {
        guard case .split(let ax, let ratio, let a, let b) = self else { return nil }
        let inA = a.contains(id), inB = b.contains(id)
        guard inA || inB else { return nil }
        // The innermost split of that axis wins, even one already at 0.5.
        if let inner = (inA ? a : b).halved(id, axis: axis) {
            return inA ? .split(ax, ratio, inner, b) : .split(ax, ratio, a, inner)
        }
        return ax == axis ? .split(ax, 0.5, a, b) : nil
    }

    /// The axes of the splits that hold `id`, innermost first, each once.
    /// Empty for a tile alone in the tree or alone in a stack; one axis
    /// when "half" is unambiguous; both when the shell has to ask.
    func splitAxes(around id: UUID) -> [SplitAxis] {
        guard case .split(let ax, _, let a, let b) = self else { return [] }
        let inA = a.contains(id), inB = b.contains(id)
        guard inA || inB else { return [] }
        var axes = (inA ? a : b).splitAxes(around: id)
        if !axes.contains(ax) { axes.append(ax) }
        return axes
    }

    /// `=`: every split shares its space by tile count.
    func balanced() -> LayoutNode {
        switch self {
        case .split(let axis, _, let a, let b):
            let na = a.balanced(), nb = b.balanced()
            let wa = Double(na.weight(along: axis)), wb = Double(nb.weight(along: axis))
            return .split(axis, wa / (wa + wb), na, nb)
        default:
            return self
        }
    }

    /// How many slots this node takes along an axis, for balancing.
    private func weight(along axis: SplitAxis) -> Int {
        switch self {
        case .leaf, .stack: return 1
        case .split(let ax, _, let a, let b):
            return ax == axis ? a.weight(along: axis) + b.weight(along: axis) : max(a.weight(along: axis), b.weight(along: axis))
        }
    }

    /// Only the tiles `keep` accepts. The tree reflows around the rest.
    func filtered(_ keep: (UUID) -> Bool) -> LayoutNode? {
        switch self {
        case .leaf(let id): return keep(id) ? self : nil
        case .stack(let ids, let active):
            let shown = active < ids.count ? ids[active] : nil
            let kept = ids.filter(keep)
            if kept.isEmpty { return nil }
            if kept.count == 1 { return .leaf(kept[0]) }
            return .stack(kept, active: shown.flatMap { kept.firstIndex(of: $0) } ?? 0)
        case .split(let axis, let ratio, let a, let b):
            switch (a.filtered(keep), b.filtered(keep)) {
            case (nil, nil): return nil
            case (let x?, nil): return x
            case (nil, let y?): return y
            case (let x?, let y?): return .split(axis, ratio, x, y)
            }
        }
    }

    static func clamp(_ ratio: Double) -> Double { min(max(ratio, minRatio), maxRatio) }

    // MARK: Subtrees, for groups

    /// The smallest node that holds every tile in `ids`. Nil when one is missing.
    func subtree(containing ids: Set<UUID>) -> LayoutNode? {
        guard !ids.isEmpty, ids.isSubset(of: Set(tiles)) else { return nil }
        if case .split(_, _, let a, let b) = self {
            if let inA = a.subtree(containing: ids) { return inA }
            if let inB = b.subtree(containing: ids) { return inB }
        }
        return self
    }

    /// The slot a tile sits in: its leaf, or the stack that holds it.
    func slot(of id: UUID) -> LayoutNode? {
        switch self {
        case .leaf(let leaf): return leaf == id ? self : nil
        case .stack(let ids, _): return ids.contains(id) ? self : nil
        case .split(_, _, let a, let b): return a.slot(of: id) ?? b.slot(of: id)
        }
    }

    /// Swap two disjoint subtrees in place. Tiles are unique, so a node is
    /// found by equality.
    func swappingNodes(_ x: LayoutNode, _ y: LayoutNode) -> LayoutNode {
        if self == x { return y }
        if self == y { return x }
        if case .split(let axis, let ratio, let a, let b) = self {
            return .split(axis, ratio, a.swappingNodes(x, y), b.swappingNodes(x, y))
        }
        return self
    }

    /// Put a whole subtree next to `target`, splitting the target's place.
    func insertingNode(_ new: LayoutNode, beside target: LayoutNode, axis: SplitAxis, after: Bool) -> LayoutNode {
        if self == target { return Self.pair(self, new, axis: axis, after: after) }
        if case .split(let ax, let ratio, let a, let b) = self {
            return .split(ax, ratio,
                          a.insertingNode(new, beside: target, axis: axis, after: after),
                          b.insertingNode(new, beside: target, axis: axis, after: after))
        }
        return self
    }

    /// Make the tiles in `ids` one subtree: when other tiles sit between
    /// them, the rest move in a row next to the first.
    func gathering(_ ids: [UUID]) -> LayoutNode {
        let set = Set(ids)
        guard let first = ids.first, let sub = subtree(containing: set) else { return self }
        if Set(sub.tiles) == set { return self }
        let others = ids.dropFirst()
        var tree: LayoutNode? = self
        for id in others { tree = tree?.removing(id) }
        guard let base = tree, let anchor = base.slot(of: first) else { return self }
        return base.insertingNode(Self.row(Array(others), axis: .vertical), beside: anchor, axis: .horizontal, after: true)
    }

    // MARK: Building from free frames

    /// Free to organized. Cut the tiles into two groups along the widest gap
    /// between their centers, and recurse, so each tile keeps its place
    /// relative to the others. The cut sits between the two groups' edges.
    static func build(from frames: [(UUID, CGRect)], in rect: CGRect) -> LayoutNode? {
        guard !frames.isEmpty else { return nil }
        if frames.count == 1 { return .leaf(frames[0].0) }

        var best: (axis: SplitAxis, score: CGFloat, first: [(UUID, CGRect)], second: [(UUID, CGRect)], cut: CGFloat)?
        for axis in [SplitAxis.horizontal, .vertical] {
            // Horizontal cuts sort left to right; vertical ones top to bottom.
            let sorted = frames.sorted { lhs, rhs in
                axis == .horizontal ? lhs.1.midX < rhs.1.midX : lhs.1.midY > rhs.1.midY
            }
            let span = axis == .horizontal ? max(rect.width, 1) : max(rect.height, 1)
            for i in 1..<sorted.count {
                let first = Array(sorted[..<i]), second = Array(sorted[i...])
                let gap: CGFloat
                let cut: CGFloat
                if axis == .horizontal {
                    gap = second[0].1.midX - first[first.count - 1].1.midX
                    let leftEdge = first.map { $0.1.maxX }.max() ?? 0
                    let rightEdge = second.map { $0.1.minX }.min() ?? 0
                    cut = leftEdge <= rightEdge ? (leftEdge + rightEdge) / 2
                        : (first[first.count - 1].1.midX + second[0].1.midX) / 2
                } else {
                    gap = first[first.count - 1].1.midY - second[0].1.midY
                    let topLow = first.map { $0.1.minY }.min() ?? 0
                    let bottomHigh = second.map { $0.1.maxY }.max() ?? 0
                    cut = bottomHigh <= topLow ? (topLow + bottomHigh) / 2
                        : (first[first.count - 1].1.midY + second[0].1.midY) / 2
                }
                let score = gap / span
                if best == nil || score > best!.score {
                    best = (axis, score, first, second, cut)
                }
            }
        }
        guard let best else { return nil }
        let ratio: Double
        let firstRect: CGRect, secondRect: CGRect
        if best.axis == .horizontal {
            ratio = clamp(Double((best.cut - rect.minX) / max(rect.width, 1)))
        } else {
            ratio = clamp(Double((rect.maxY - best.cut) / max(rect.height, 1)))
        }
        (firstRect, secondRect) = divide(rect, axis: best.axis, ratio: ratio, gap: 0)
        guard let a = build(from: best.first, in: firstRect), let b = build(from: best.second, in: secondRect) else { return nil }
        return .split(best.axis, ratio, a, b)
    }
}

// MARK: - Stored shape, readable like the layout files:
// { split: horizontal, ratio, children: [..] } | { tile } | { stack: [..], active }

extension LayoutNode: Codable {
    private enum Keys: String, CodingKey { case split, ratio, children, tile, stack, active }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: Keys.self)
        if let tile = try c.decodeIfPresent(UUID.self, forKey: .tile) {
            self = .leaf(tile)
        } else if let ids = try c.decodeIfPresent([UUID].self, forKey: .stack) {
            self = .stack(ids, active: try c.decodeIfPresent(Int.self, forKey: .active) ?? 0)
        } else {
            let axis = try c.decode(SplitAxis.self, forKey: .split)
            let children = try c.decode([LayoutNode].self, forKey: .children)
            guard children.count == 2 else {
                throw DecodingError.dataCorruptedError(forKey: .children, in: c, debugDescription: "a split has two children")
            }
            self = .split(axis, try c.decodeIfPresent(Double.self, forKey: .ratio) ?? 0.5, children[0], children[1])
        }
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: Keys.self)
        switch self {
        case .leaf(let id):
            try c.encode(id, forKey: .tile)
        case .stack(let ids, let active):
            try c.encode(ids, forKey: .stack)
            try c.encode(active, forKey: .active)
        case .split(let axis, let ratio, let a, let b):
            try c.encode(axis, forKey: .split)
            try c.encode(ratio, forKey: .ratio)
            try c.encode([a, b], forKey: .children)
        }
    }
}
