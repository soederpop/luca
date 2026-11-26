import XCTest
@testable import LucaDesktop

final class CardStackTests: XCTestCase {
    private func card(_ id: String, _ title: String? = nil) -> IndexCard {
        IndexCard(id: id, title: title ?? id, uri: TileURI.luca(project: "shop", tool: "doc", id: id))
    }

    /// spark: a b c · exploring: (empty) · ready: d e
    private func sample() -> CardStackState {
        CardStackState(stacks: [
            IndexStack(id: "spark", title: "spark", cards: [card("a"), card("b"), card("c")]),
            IndexStack(id: "exploring", title: "exploring", cards: []),
            IndexStack(id: "ready", title: "ready", cards: [card("d"), card("e", "Second ready idea")]),
        ])
    }

    func testJAndKMoveInsideTheStackAndWrap() {
        var state = sample()
        XCTAssertEqual(state.focusedCard?.id, "a")
        state.move(.down); XCTAssertEqual(state.focusedCard?.id, "b")
        state.move(.down); XCTAssertEqual(state.focusedCard?.id, "c")
        state.move(.down); XCTAssertEqual(state.focusedCard?.id, "a", "j on the last card wraps to the first")
        state.move(.up); XCTAssertEqual(state.focusedCard?.id, "c", "k on the first card wraps to the last")
    }

    func testHAndLSkipEmptyStacksWrapAndKeepEachStacksPlace() {
        var state = sample()
        state.move(.down) // b
        state.move(.right)
        XCTAssertEqual(state.focusedStack?.id, "ready", "l skips the empty stack")
        XCTAssertEqual(state.focusedCard?.id, "d")
        state.move(.down) // e
        state.move(.right)
        XCTAssertEqual(state.focusedStack?.id, "spark", "l on the last stack wraps to the first")
        XCTAssertEqual(state.focusedCard?.id, "b", "a stack keeps its own card position")
        state.move(.left)
        XCTAssertEqual(state.focusedCard?.id, "e")
    }

    func testFilterNarrowsCardsAndMovesFocusToAStackWithCards() {
        var state = sample()
        state.filter = "second"
        XCTAssertEqual(state.shown.map(\.count), [0, 0, 1])
        XCTAssertEqual(state.focusedCard?.id, "e")
        state.filter = ""
        XCTAssertEqual(state.shown.map(\.count), [3, 0, 2])
    }

    func testNewDataKeepsFocusOnTheSameCard() {
        var state = sample()
        state.move(.right) // d
        // d moved from ready to spark on the host.
        state.setStacks([
            IndexStack(id: "spark", title: "spark", cards: [card("a"), card("d")]),
            IndexStack(id: "ready", title: "ready", cards: [card("e")]),
        ])
        XCTAssertEqual(state.focusedCard?.id, "d")
        XCTAssertEqual(state.focusedStack?.id, "spark")
    }

    func testWideShowsEveryStackNarrowShowsOne() {
        var state = sample()
        XCTAssertEqual(state.visibleStackIndices(width: 1200), [0, 1, 2])
        XCTAssertEqual(state.visibleStackIndices(width: 300), [0], "a narrow tile shows one stack")
        state.move(.right)
        XCTAssertEqual(state.visibleStackIndices(width: 300), [2], "the one in focus")
        XCTAssertEqual(state.visibleStackIndices(width: 470).count, 2)
        XCTAssertTrue(state.visibleStackIndices(width: 470).contains(2))
    }
}
