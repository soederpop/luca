import Foundation
import CoreGraphics

/// Which tile is "to the left" (or below, above, right) of another.
enum Neighbors {
    /// Free mode: the nearest tile whose center lies in that direction.
    /// Distance off the line counts double, so a tile straight across wins
    /// over a closer one far off to the side.
    static func nearest(to id: UUID, _ direction: Direction, frames: [UUID: CGRect]) -> UUID? {
        guard let from = frames[id] else { return nil }
        var best: (UUID, CGFloat)?
        // Tiles inside the 45 degree cone win. Past them, anything on that side.
        var bestOutside: (UUID, CGFloat)?
        for (other, rect) in frames where other != id {
            let dx = rect.midX - from.midX
            let dy = rect.midY - from.midY
            let along: CGFloat, across: CGFloat
            switch direction {
            case .left: along = -dx; across = abs(dy)
            case .right: along = dx; across = abs(dy)
            case .up: along = dy; across = abs(dx)
            case .down: along = -dy; across = abs(dx)
            }
            guard along > 1 else { continue }
            let score = along + 2 * across
            if along >= across {
                if best == nil || score < best!.1 || (score == best!.1 && other.uuidString < best!.0.uuidString) {
                    best = (other, score)
                }
            } else if bestOutside == nil || score < bestOutside!.1 {
                bestOutside = (other, score)
            }
        }
        return (best ?? bestOutside)?.0
    }

    /// Organized mode: the tile that shares the edge on that side, with the
    /// most overlap. The tree leaves `gap` between tiles, so edges within
    /// `gap + 2` points count as touching. Falls back to `nearest`.
    static func adjacent(to id: UUID, _ direction: Direction, frames: [UUID: CGRect], gap: CGFloat) -> UUID? {
        guard let from = frames[id] else { return nil }
        let tolerance = gap + 2
        var best: (UUID, CGFloat)?
        for (other, rect) in frames where other != id {
            let touching: Bool
            let overlap: CGFloat
            switch direction {
            case .left:
                touching = abs(from.minX - rect.maxX) <= tolerance
                overlap = min(from.maxY, rect.maxY) - max(from.minY, rect.minY)
            case .right:
                touching = abs(rect.minX - from.maxX) <= tolerance
                overlap = min(from.maxY, rect.maxY) - max(from.minY, rect.minY)
            case .up:
                touching = abs(rect.minY - from.maxY) <= tolerance
                overlap = min(from.maxX, rect.maxX) - max(from.minX, rect.minX)
            case .down:
                touching = abs(from.minY - rect.maxY) <= tolerance
                overlap = min(from.maxX, rect.maxX) - max(from.minX, rect.minX)
            }
            guard touching, overlap > 0 else { continue }
            if best == nil || overlap > best!.1 { best = (other, overlap) }
        }
        return best?.0 ?? nearest(to: id, direction, frames: frames)
    }

    /// The box around some frames.
    static func bounds(_ frames: [CGRect]) -> CGRect? {
        guard let first = frames.first else { return nil }
        return frames.dropFirst().reduce(first) { $0.union($1) }
    }

    /// Scale a set of frames, as one block, into `rect`. Each keeps its
    /// place inside the block. A group moves and zooms this way in free mode.
    static func fit(_ frames: [UUID: CGRect], into rect: CGRect) -> [UUID: CGRect] {
        guard let box = bounds(Array(frames.values)), box.width > 0, box.height > 0 else { return frames }
        let sx = rect.width / box.width, sy = rect.height / box.height
        return frames.mapValues { f in
            CGRect(x: rect.minX + (f.minX - box.minX) * sx, y: rect.minY + (f.minY - box.minY) * sy,
                   width: f.width * sx, height: f.height * sy).integral
        }
    }

    /// `Mod-Shift-h/j/k/l` in free mode: that half of the screen.
    static func half(of screen: CGRect, _ direction: Direction, gap: CGFloat) -> CGRect {
        let r = screen.insetBy(dx: gap, dy: gap)
        switch direction {
        case .left: return CGRect(x: r.minX, y: r.minY, width: (r.width - gap) / 2, height: r.height).integral
        case .right: return CGRect(x: r.midX + gap / 2, y: r.minY, width: (r.width - gap) / 2, height: r.height).integral
        case .up: return CGRect(x: r.minX, y: r.midY + gap / 2, width: r.width, height: (r.height - gap) / 2).integral
        case .down: return CGRect(x: r.minX, y: r.minY, width: r.width, height: (r.height - gap) / 2).integral
        }
    }
}
