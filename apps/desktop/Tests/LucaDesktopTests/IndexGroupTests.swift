import XCTest
@testable import LucaDesktop

final class IndexGroupTests: XCTestCase {
    private func card(_ id: String, _ group: String?) -> IndexCard {
        IndexCard(id: id, title: id, uri: TileURI("luca://p/helper/features/\(id)")!, group: group)
    }

    private var state: CardStackState {
        CardStackState(stacks: [
            IndexStack(id: "features", title: "features", cards: [card("fs", "builtin"), card("cart", "own"), card("git", "builtin")]),
            IndexStack(id: "clients", title: "clients", cards: [card("rest", "builtin")]),
            IndexStack(id: "commands", title: "commands", cards: [card("greet", "own"), card("deploy", "plugin")]),
        ])
    }

    private let order = [(id: "own", label: "This project"), (id: "borrowed", label: "Borrowed"), (id: "plugin", label: "Plugins"), (id: "builtin", label: "Built in")]

    func testGroupsAreCountedInOrderAndEmptyOnesLeftOut() {
        let groups = state.groups(order: order)
        XCTAssertEqual(groups.map(\.id), ["own", "plugin", "builtin"])
        XCTAssertEqual(groups.map(\.count), [2, 1, 3])
        XCTAssertEqual(state.total, 6)
    }

    func testAGroupShowsOnlyItsCardsAndDropsEmptyStacks() {
        var s = state
        s.group = "own"
        XCTAssertEqual(s.shown.map(\.id), ["features", "commands"])
        XCTAssertEqual(s.shown.flatMap(\.cards).map(\.id), ["cart", "greet"])
        XCTAssertEqual(s.focusedCard?.id, "cart")
        s.move(.right)
        XCTAssertEqual(s.focusedCard?.id, "greet")
        s.group = nil
        XCTAssertEqual(s.shown.count, 3)
    }

    func testTheTextFilterWorksInsideAGroup() {
        var s = state
        s.group = "builtin"
        s.filter = "gi"
        XCTAssertEqual(s.shown.flatMap(\.cards).map(\.id), ["git"])
        // The counts are of everything loaded, whatever is typed.
        XCTAssertEqual(s.groups(order: order).map(\.count), [2, 1, 3])
    }

    func testFocusMovesOffAStackTheGroupRemoved() {
        var s = state
        s.move(.right) // clients
        s.group = "own"
        XCTAssertNotNil(s.focusedCard)
        XCTAssertEqual(s.focusedCard?.group, "own")
    }
}
