import XCTest
@testable import LucaDesktop

final class LayoutTests: XCTestCase {
    let screen = CGRect(x: 0, y: 0, width: 1920, height: 1080)
    let gap: CGFloat = 6

    private func workspace(_ frames: [CGRect]) -> (Workspace, [UUID]) {
        var ws = Workspace()
        let ids = frames.map { _ in UUID() }
        for (id, frame) in zip(ids, frames) { ws.add(id, frame: frame) }
        return (ws, ids)
    }

    /// Free to organized keeps each tile's center within one tile width of
    /// where it was.
    private func assertCentersKept(_ frames: [CGRect], file: StaticString = #filePath, line: UInt = #line) {
        var (ws, ids) = workspace(frames)
        let before = ws.frames
        ws.toggleMode(in: screen, gap: gap)
        XCTAssertEqual(ws.mode, .organized, file: file, line: line)
        XCTAssertEqual(Set(ws.tree?.tiles ?? []), Set(ids), file: file, line: line)
        for id in ids {
            let old = before[id]!, new = ws.frames[id]!
            let moved = hypot(new.midX - old.midX, new.midY - old.midY)
            XCTAssertLessThanOrEqual(moved, old.width, "tile moved \(Int(moved))pt, wider than its \(Int(old.width))pt", file: file, line: line)
        }
        // No two organized tiles overlap.
        for (i, a) in ids.enumerated() {
            for b in ids[(i + 1)...] {
                XCTAssertFalse(ws.frames[a]!.intersects(ws.frames[b]!), file: file, line: line)
            }
        }
    }

    func testFreeToOrganizedTwoTiles() {
        assertCentersKept([
            CGRect(x: 80, y: 120, width: 760, height: 800),
            CGRect(x: 1000, y: 160, width: 820, height: 760),
        ])
    }

    func testFreeToOrganizedThreeTiles() {
        assertCentersKept([
            CGRect(x: 40, y: 80, width: 900, height: 900),       // left, tall
            CGRect(x: 1000, y: 560, width: 860, height: 460),    // top right
            CGRect(x: 1020, y: 60, width: 840, height: 420),     // bottom right
        ])
    }

    func testFreeToOrganizedFiveTiles() {
        assertCentersKept([
            CGRect(x: 20, y: 560, width: 600, height: 480),
            CGRect(x: 660, y: 580, width: 600, height: 460),
            CGRect(x: 1300, y: 600, width: 580, height: 440),
            CGRect(x: 40, y: 40, width: 900, height: 460),
            CGRect(x: 980, y: 30, width: 900, height: 480),
        ])
    }

    func testFreeToOrganizedOverlappingTiles() {
        // Dragged anywhere: they overlap. Still no tile goes far.
        assertCentersKept([
            CGRect(x: 100, y: 100, width: 800, height: 700),
            CGRect(x: 500, y: 300, width: 800, height: 700),
            CGRect(x: 900, y: 200, width: 800, height: 700),
        ])
    }

    func testOrganizedToFreeChangesNoFrame() {
        var (ws, _) = workspace([
            CGRect(x: 80, y: 120, width: 760, height: 800),
            CGRect(x: 1000, y: 160, width: 820, height: 760),
            CGRect(x: 300, y: 40, width: 500, height: 300),
        ])
        ws.toggleMode(in: screen, gap: gap)
        let organized = ws.frames
        ws.toggleMode(in: screen, gap: gap)
        XCTAssertEqual(ws.mode, .free)
        XCTAssertEqual(ws.frames, organized)
        XCTAssertNil(ws.tree)
    }

    func testTreeFramesHaveTheGap() {
        let a = UUID(), b = UUID()
        let frames = LayoutNode.split(.horizontal, 0.5, .leaf(a), .leaf(b)).frames(in: screen, gap: gap)
        XCTAssertEqual(frames[a]!.minX, 6)
        XCTAssertEqual(frames[b]!.minX - frames[a]!.maxX, 6)
        XCTAssertEqual(frames[b]!.maxX, 1914)
        XCTAssertEqual(frames[a]!.maxY, 1074)
    }

    // MARK: Focus by direction

    func testFreeFocusPicksNearestInDirection() {
        let me = UUID(), nearRight = UUID(), farRight = UUID(), left = UUID(), offAxis = UUID()
        let frames: [UUID: CGRect] = [
            me: CGRect(x: 800, y: 400, width: 300, height: 300),
            nearRight: CGRect(x: 1200, y: 420, width: 300, height: 300),
            farRight: CGRect(x: 1600, y: 400, width: 300, height: 300),
            left: CGRect(x: 100, y: 400, width: 300, height: 300),
            offAxis: CGRect(x: 1150, y: 900, width: 200, height: 150),
        ]
        XCTAssertEqual(Neighbors.nearest(to: me, .right, frames: frames), nearRight)
        XCTAssertEqual(Neighbors.nearest(to: me, .left, frames: frames), left)
        XCTAssertEqual(Neighbors.nearest(to: me, .up, frames: frames), offAxis)
        XCTAssertNil(Neighbors.nearest(to: me, .down, frames: frames))
    }

    func testOrganizedFocusPicksTreeNeighbor() {
        // [ a | [ b / c ] ]: right of a is whichever of b and c shares more
        // of a's edge. Left of c is a, up from c is b.
        let a = UUID(), b = UUID(), c = UUID()
        var ws = Workspace()
        ws.mode = .organized
        ws.tiles = [a, b, c]
        ws.tree = .split(.horizontal, 0.5, .leaf(a), .split(.vertical, 0.7, .leaf(b), .leaf(c)))
        ws.applyTree(in: screen, gap: gap)
        let all = [a, b, c]
        XCTAssertEqual(ws.neighbor(of: a, .right, gap: gap, visible: all), b)
        XCTAssertEqual(ws.neighbor(of: c, .left, gap: gap, visible: all), a)
        XCTAssertEqual(ws.neighbor(of: c, .up, gap: gap, visible: all), b)
        XCTAssertEqual(ws.neighbor(of: b, .down, gap: gap, visible: all), c)
        XCTAssertNil(ws.neighbor(of: a, .left, gap: gap, visible: all))
    }

    func testOrganizedNeighborIsTheTreeNeighborNotTheNearestCenter() {
        // a is a thin column on the left; b is huge on the right; c is a
        // small tile under a. Right of c, the shared edge is b's.
        let a = UUID(), b = UUID(), c = UUID()
        var ws = Workspace()
        ws.mode = .organized
        ws.tiles = [a, b, c]
        ws.tree = .split(.horizontal, 0.2, .split(.vertical, 0.5, .leaf(a), .leaf(c)), .leaf(b))
        ws.applyTree(in: screen, gap: gap)
        XCTAssertEqual(ws.neighbor(of: c, .right, gap: gap, visible: [a, b, c]), b)
        XCTAssertEqual(ws.neighbor(of: c, .up, gap: gap, visible: [a, b, c]), a)
    }

    // MARK: Tree edits

    func testRemoveCollapsesTheSplit() {
        let a = UUID(), b = UUID()
        XCTAssertEqual(LayoutNode.split(.horizontal, 0.5, .leaf(a), .leaf(b)).removing(a), .leaf(b))
    }

    func testStackToggleAndCycle() {
        let a = UUID(), b = UUID()
        let tree = LayoutNode.split(.horizontal, 0.5, .leaf(a), .leaf(b))
        let stacked = tree.togglingStack(at: b)
        XCTAssertEqual(stacked, .stack([a, b], active: 1))
        XCTAssertEqual(stacked.visibleTiles, [b])
        let (cycled, front) = stacked.cyclingStack(at: b, by: 1)
        XCTAssertEqual(front, a)
        XCTAssertEqual(cycled.visibleTiles, [a])
        XCTAssertEqual(Set(cycled.togglingStack(at: a).visibleTiles), [a, b])
    }

    func testRotateFlipsInnermostSplit() {
        let a = UUID(), b = UUID(), c = UUID()
        let tree = LayoutNode.split(.horizontal, 0.4, .leaf(a), .split(.vertical, 0.3, .leaf(b), .leaf(c)))
        XCTAssertEqual(tree.rotatingSplit(at: c), .split(.horizontal, 0.4, .leaf(a), .split(.horizontal, 0.3, .leaf(b), .leaf(c))))
        XCTAssertEqual(tree.rotatingSplit(at: a), .split(.vertical, 0.4, .leaf(a), .split(.vertical, 0.3, .leaf(b), .leaf(c))))
        XCTAssertEqual(LayoutNode.leaf(a).rotatingSplit(at: a), .leaf(a))
    }

    func testDropOnMiddleSwapsAndOnEdgeSplits() {
        let a = UUID(), b = UUID(), c = UUID()
        var ws = Workspace()
        ws.mode = .organized
        ws.tiles = [a, b, c]
        ws.tree = .split(.horizontal, 0.5, .leaf(a), .split(.vertical, 0.5, .leaf(b), .leaf(c)))
        ws.applyTree(in: screen, gap: gap)
        let center = CGPoint(x: ws.frames[b]!.midX, y: ws.frames[b]!.midY)
        ws.drop(a, at: center)
        XCTAssertEqual(ws.tree, .split(.horizontal, 0.5, .leaf(b), .split(.vertical, 0.5, .leaf(a), .leaf(c))))

        ws.applyTree(in: screen, gap: gap)
        let bRect = ws.frames[b]!
        ws.drop(c, at: CGPoint(x: bRect.minX + 5, y: bRect.midY))
        // c split b's slot on its left.
        XCTAssertEqual(ws.tree?.tiles, [c, b, a])
    }

    func testFloatOutAndBack() {
        var (ws, ids) = workspace([
            CGRect(x: 80, y: 120, width: 760, height: 800),
            CGRect(x: 1000, y: 160, width: 820, height: 760),
        ])
        ws.toggleMode(in: screen, gap: gap)
        ws.toggleFloat(ids[1])
        XCTAssertEqual(ws.tree, .leaf(ids[0]))
        XCTAssertTrue(ws.floating.contains(ids[1]))
        ws.toggleFloat(ids[1])
        XCTAssertEqual(Set(ws.tree?.tiles ?? []), Set(ids))
        XCTAssertTrue(ws.floating.isEmpty)
    }

    func testResizeMovesTheNearestEdge() {
        let a = UUID(), b = UUID()
        let tree = LayoutNode.split(.horizontal, 0.5, .leaf(a), .leaf(b))
        guard case .split(_, let grown, _, _) = tree.resizing(a, toward: .right, by: 0.05) else { return XCTFail() }
        XCTAssertEqual(grown, 0.55, accuracy: 0.0001)
        guard case .split(_, let shrunk, _, _) = tree.resizing(b, toward: .left, by: 0.05) else { return XCTFail() }
        XCTAssertEqual(shrunk, 0.45, accuracy: 0.0001)
        XCTAssertEqual(tree.resizing(a, toward: .up, by: 0.05), tree)
    }

    func testHalvingSetsTheNearestSplitOfThatAxis() {
        let a = UUID(), b = UUID(), c = UUID()
        // a | (b over c): c is in a vertical split inside a horizontal one.
        let tree = LayoutNode.split(.horizontal, 0.7, .leaf(a), .split(.vertical, 0.3, .leaf(b), .leaf(c)))
        XCTAssertEqual(tree.halving(c, axis: .vertical), .split(.horizontal, 0.7, .leaf(a), .split(.vertical, 0.5, .leaf(b), .leaf(c))))
        XCTAssertEqual(tree.halving(c, axis: .horizontal), .split(.horizontal, 0.5, .leaf(a), .split(.vertical, 0.3, .leaf(b), .leaf(c))))
        // a has no vertical split around it: nothing changes.
        XCTAssertEqual(tree.halving(a, axis: .vertical), tree)
        XCTAssertEqual(tree.halving(a, axis: .horizontal), .split(.horizontal, 0.5, .leaf(a), .split(.vertical, 0.3, .leaf(b), .leaf(c))))
        // A tile not in the tree, and a lone leaf, change nothing.
        XCTAssertEqual(tree.halving(UUID(), axis: .horizontal), tree)
        XCTAssertEqual(LayoutNode.leaf(a).halving(a, axis: .horizontal), .leaf(a))
        // Two horizontal splits: the inner one moves, not the outer.
        let nested = LayoutNode.split(.horizontal, 0.6, .leaf(a), .split(.horizontal, 0.5, .leaf(b), .leaf(c)))
        XCTAssertEqual(nested.halving(c, axis: .horizontal), nested)
        XCTAssertEqual(nested.halving(a, axis: .horizontal), .split(.horizontal, 0.5, .leaf(a), .split(.horizontal, 0.5, .leaf(b), .leaf(c))))
    }

    func testSplitAxesAroundATile() {
        let a = UUID(), b = UUID(), c = UUID(), d = UUID()
        let tree = LayoutNode.split(.horizontal, 0.5, .leaf(a), .split(.vertical, 0.5, .leaf(b), .stack([c, d], active: 0)))
        XCTAssertEqual(tree.splitAxes(around: a), [.horizontal])
        XCTAssertEqual(tree.splitAxes(around: b), [.vertical, .horizontal])
        XCTAssertEqual(tree.splitAxes(around: c), [.vertical, .horizontal])
        XCTAssertEqual(tree.splitAxes(around: UUID()), [])
        XCTAssertEqual(LayoutNode.leaf(a).splitAxes(around: a), [])
        XCTAssertEqual(LayoutNode.stack([c, d], active: 1).splitAxes(around: d), [])
        let row = LayoutNode.row([a, b, c], axis: .horizontal)
        XCTAssertEqual(row.splitAxes(around: c), [.horizontal])
    }

    func testSoloFilterReflows() {
        let a = UUID(), b = UUID(), c = UUID()
        let tree = LayoutNode.split(.horizontal, 0.5, .leaf(a), .split(.vertical, 0.5, .leaf(b), .leaf(c)))
        XCTAssertEqual(tree.filtered { $0 != b }, .split(.horizontal, 0.5, .leaf(a), .leaf(c)))
    }

    func testWorkspaceCodableRoundTrip() throws {
        var (ws, _) = workspace([
            CGRect(x: 80, y: 120, width: 760, height: 800),
            CGRect(x: 1000, y: 160, width: 820, height: 760),
        ])
        ws.toggleMode(in: screen, gap: gap)
        let data = try JSONEncoder().encode(ws)
        XCTAssertEqual(try JSONDecoder().decode(Workspace.self, from: data), ws)
    }

    /// Enter on a card in an organized workspace opens it in the index's
    /// place: same slot in the tree, same group, same focus.
    func testReplaceTakesTheSlot() {
        var (ws, ids) = workspace([CGRect(x: 0, y: 0, width: 800, height: 600), CGRect(x: 900, y: 0, width: 800, height: 600)])
        ws.toggleMode(in: screen, gap: gap)
        ws.groups = [ids]
        ws.focused = ids[0]
        let before = ws.tree!.frames(in: screen, gap: gap)[ids[0]]
        let new = UUID()
        ws.replace(ids[0], with: new)
        XCTAssertEqual(ws.tiles, [new, ids[1]])
        XCTAssertEqual(ws.focused, new)
        XCTAssertEqual(ws.groups, [[new, ids[1]]])
        XCTAssertFalse(ws.tree!.contains(ids[0]))
        XCTAssertEqual(ws.tree!.frames(in: screen, gap: gap)[new], before)
        XCTAssertNil(ws.frames[ids[0]])
        XCTAssertNotNil(ws.frames[new])
    }
}
