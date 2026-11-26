import XCTest
@testable import LucaDesktop

final class GroupTests: XCTestCase {
    let screen = CGRect(x: 0, y: 0, width: 1800, height: 1000)
    let gap: CGFloat = 6

    /// Three tiles side by side, organized: A | B | C.
    private func organizedRow() -> (Workspace, UUID, UUID, UUID) {
        var ws = Workspace()
        let a = UUID(), b = UUID(), c = UUID()
        ws.add(a, frame: CGRect(x: 0, y: 0, width: 580, height: 1000))
        ws.add(b, frame: CGRect(x: 600, y: 0, width: 580, height: 1000))
        ws.add(c, frame: CGRect(x: 1200, y: 0, width: 580, height: 1000))
        ws.toggleMode(in: screen, gap: gap)
        return (ws, a, b, c)
    }

    private func leftToRight(_ ws: Workspace) -> [UUID] {
        ws.visibleTiles().sorted { ws.frames[$0]!.minX < ws.frames[$1]!.minX }
    }

    func testJoinInOrganizedModeMakesTheGroupOneSubtree() {
        var (ws, a, b, c) = organizedRow()
        ws.join(a, with: c, toward: .right)
        XCTAssertEqual(ws.members(of: c), [a, c])
        XCTAssertEqual(Set(ws.tree!.subtree(containing: [a, c])!.tiles), [a, c], "nothing sits between the members")
        XCTAssertEqual(Set(ws.tree!.tiles), [a, b, c])
        ws.applyTree(in: screen, gap: gap)
        XCTAssertEqual(leftToRight(ws), [a, c, b], "C lands right of A, where it was asked to go")
    }

    func testGroupMoveInOrganizedModeMovesEveryMember() {
        var (ws, a, b, c) = organizedRow()
        ws.join(a, with: b, toward: .right)
        ws.applyTree(in: screen, gap: gap)
        ws.moveGroup(of: a, .right, half: .zero, gap: gap, visible: ws.visibleTiles())
        ws.applyTree(in: screen, gap: gap)
        XCTAssertEqual(leftToRight(ws), [c, a, b], "the group swaps with its neighbor as one block")
    }

    func testGroupMoveInFreeModeFitsTheWholeGroupIntoTheHalf() {
        var ws = Workspace()
        let a = UUID(), b = UUID(), c = UUID()
        ws.add(a, frame: CGRect(x: 100, y: 100, width: 400, height: 400))
        ws.add(b, frame: CGRect(x: 520, y: 100, width: 400, height: 400))
        ws.add(c, frame: CGRect(x: 1300, y: 600, width: 300, height: 300))
        ws.join(a, with: b, toward: .right)
        let half = Neighbors.half(of: screen, .right, gap: gap)
        let cBefore = ws.frames[c]
        ws.moveGroup(of: b, .right, half: half, gap: gap, visible: ws.visibleTiles())
        XCTAssertTrue(half.insetBy(dx: -1, dy: -1).contains(ws.frames[a]!))
        XCTAssertTrue(half.insetBy(dx: -1, dy: -1).contains(ws.frames[b]!))
        XCTAssertLessThan(ws.frames[a]!.minX, ws.frames[b]!.minX, "members keep their places in the block")
        XCTAssertEqual(ws.frames[c], cBefore, "a tile outside the group stays")
    }

    func testGroupZoomInOrganizedModeShowsOnlyTheGroupAndBack() {
        var (ws, a, b, c) = organizedRow()
        ws.join(b, with: c, toward: .right)
        ws.toggleZoom(c, in: screen, gap: gap)
        XCTAssertEqual(Set(ws.visibleTiles()), [b, c])
        ws.applyTree(in: screen, gap: gap)
        let box = ws.frames[b]!.union(ws.frames[c]!)
        XCTAssertEqual(box, screen.insetBy(dx: gap, dy: gap).integral, "the group fills the workspace")
        ws.toggleZoom(b, in: screen, gap: gap)
        XCTAssertNil(ws.zoomed)
        XCTAssertEqual(Set(ws.visibleTiles()), [a, b, c])
    }

    func testGroupZoomInFreeModeRestoresEveryFrame() {
        var ws = Workspace()
        let a = UUID(), b = UUID()
        ws.add(a, frame: CGRect(x: 100, y: 100, width: 400, height: 300))
        ws.add(b, frame: CGRect(x: 520, y: 100, width: 400, height: 300))
        ws.join(a, with: b, toward: .right)
        let before = ws.frames
        ws.toggleZoom(a, in: screen, gap: gap)
        XCTAssertGreaterThan(ws.frames[a]!.width, 400)
        XCTAssertGreaterThan(ws.frames[b]!.width, 400)
        ws.toggleZoom(b, in: screen, gap: gap)
        XCTAssertEqual(ws.frames, before)
    }

    func testClosingAMemberDissolvesATwoTileGroup() {
        var (ws, a, b, c) = organizedRow()
        ws.join(a, with: b, toward: .right)
        ws.join(b, with: c, toward: .right)
        XCTAssertEqual(Set(ws.members(of: a)), [a, b, c], "joining into a group grows it")
        for m in ws.members(of: a) { ws.remove(m) }
        XCTAssertTrue(ws.tiles.isEmpty)
        XCTAssertTrue(ws.groups.isEmpty)
        XCTAssertNil(ws.tree)
    }

    func testUngroupAndRemoveKeepGroupsValid() {
        var (ws, a, b, c) = organizedRow()
        ws.join(a, with: b, toward: .right)
        ws.remove(b)
        XCTAssertTrue(ws.groups.isEmpty, "a group of one is no group")
        ws.join(a, with: c, toward: .right)
        ws.ungroup(c)
        XCTAssertFalse(ws.isGrouped(a))
    }

    func testGroupsSurviveSaveAndLoad() throws {
        var (ws, a, b, _) = organizedRow()
        ws.join(a, with: b, toward: .right)
        let data = try JSONEncoder().encode(ws)
        let back = try JSONDecoder().decode(Workspace.self, from: data)
        XCTAssertEqual(back.groups, [[a, b]])
    }

    func testSoloThenUnsoloGivesBackTheSameTree() {
        var (ws, a, b, c) = organizedRow()
        ws.join(b, with: c, toward: .right)
        ws.applyTree(in: screen, gap: gap)
        let tree = ws.tree, frames = ws.frames
        // Solo hides B's project: A and C reflow.
        let keep: (UUID) -> Bool = { $0 != b }
        ws.applyTree(in: screen, gap: gap, visible: keep)
        XCTAssertEqual(Set(ws.visibleTiles(keep)), [a, c])
        XCTAssertGreaterThan(ws.frames[c]!.width, frames[c]!.width, "the tree reflows around the hidden tile")
        XCTAssertEqual(ws.tree, tree, "solo never edits the tree")
        ws.applyTree(in: screen, gap: gap)
        XCTAssertEqual(ws.tree, tree)
        XCTAssertEqual(ws.frames, frames, "un-solo gives back the same shape")
    }
}
