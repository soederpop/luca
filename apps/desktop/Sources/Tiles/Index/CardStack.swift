import Foundation

/// One card in an index: a title, a few lines, and the address it opens.
struct IndexCard: Equatable, Identifiable {
    var id: String
    var title: String
    /// One short line under the title: a goal, an assistant, a path.
    var subtitle: String?
    /// The first lines of the item. The card in focus shows them.
    var preview: String?
    /// A short tag on the right: a status, `building`, `3 msgs`.
    var badge: String?
    var uri: TileURI
    /// When set, the badge is a colored tag in the workbench origin colors
    /// (`own`, `borrowed`, `plugin`, `home`, `builtin`), not a status word.
    var badgeTone: String? = nil
    /// A workbench color for this card alone (`slot:<n>`), over its stack's.
    var tone: String? = nil
    /// The subtitle is a path, a model name or a value: draw it in the code
    /// font. Prose subtitles stay in the UI font.
    var subtitleIsCode = false
    /// The group the card is in, for the index's group filter: a helper's
    /// origin (`own`, `borrowed`, `plugin`, `home`, `builtin`).
    var group: String? = nil
}

/// One choice of an index's group filter, with how many cards it has.
struct IndexGroup: Equatable, Identifiable {
    let id: String
    var label: String
    var count: Int
}

/// One stack: a status, an assistant, a folder.
struct IndexStack: Equatable, Identifiable {
    let id: String
    var title: String
    var cards: [IndexCard]
    /// A workbench color for the stack and its cards (`WorkbenchStyle.toneColor`):
    /// `slot:<n>` for a doc model or an assistant. Nil keeps the plain look.
    var tone: String? = nil

    var count: Int { cards.count }
}

/// Which card has focus in a card-stack index, and what the filter shows.
/// Pure, so the moves are tested without a window.
///
/// Rules: `j`/`k` move inside the stack and wrap at its ends. `h`/`l` move
/// to the next stack that has cards, and wrap at the ends. Each stack keeps
/// its own card position, so `l` then `h` comes back to the same card.
struct CardStackState: Equatable {
    /// Every stack as loaded, before the filter.
    private(set) var stacks: [IndexStack] = []
    var filter = "" { didSet { clamp() } }
    /// Show only the cards of this group (`own`). Nil: every card.
    var group: String? { didSet { clamp() } }
    private(set) var stackIndex = 0
    /// Card position per stack id.
    private var positions: [String: Int] = [:]

    init(stacks: [IndexStack] = []) {
        self.stacks = stacks
        stackIndex = stacks.firstIndex { !$0.cards.isEmpty } ?? 0
    }

    /// The stacks with the filter applied. Empty stacks stay, so the
    /// columns do not jump while you type.
    var shown: [IndexStack] {
        let query = filter.trimmingCharacters(in: .whitespaces).lowercased()
        // A group leaves out the stacks it empties: "this project" is often
        // two stacks of nine, and seven empty columns say nothing.
        let base = group.map { group in
            stacks.compactMap { stack -> IndexStack? in
                var copy = stack
                copy.cards = stack.cards.filter { $0.group == group }
                return copy.cards.isEmpty ? nil : copy
            }
        } ?? stacks
        guard !query.isEmpty else { return base }
        return base.map { stack in
            var copy = stack
            copy.cards = stack.cards.filter { card in
                [card.title, card.subtitle ?? "", card.preview ?? "", card.badge ?? ""]
                    .contains { $0.lowercased().contains(query) }
            }
            return copy
        }
    }

    /// The groups the loaded cards are in, in `order`, with their counts.
    /// The text filter does not change them.
    func groups(order: [(id: String, label: String)]) -> [IndexGroup] {
        var counts: [String: Int] = [:]
        for stack in stacks { for card in stack.cards { if let g = card.group { counts[g, default: 0] += 1 } } }
        return order.compactMap { item in counts[item.id].map { IndexGroup(id: item.id, label: item.label, count: $0) } }
    }

    var total: Int { stacks.reduce(0) { $0 + $1.count } }

    var focusedStack: IndexStack? {
        let all = shown
        return all.indices.contains(stackIndex) ? all[stackIndex] : nil
    }

    var cardIndex: Int? {
        guard let stack = focusedStack, !stack.cards.isEmpty else { return nil }
        return min(positions[stack.id] ?? 0, stack.cards.count - 1)
    }

    var focusedCard: IndexCard? {
        guard let stack = focusedStack, let index = cardIndex else { return nil }
        return stack.cards[index]
    }

    /// New data from the host. Focus stays on the same card when it is
    /// still there (in any stack), else on the same place.
    mutating func setStacks(_ next: [IndexStack]) {
        let keep = focusedCard?.id
        let keepStack = focusedStack?.id
        stacks = next
        if let keep {
            let all = shown
            for (s, stack) in all.enumerated() {
                if let c = stack.cards.firstIndex(where: { $0.id == keep }) {
                    stackIndex = s
                    positions[stack.id] = c
                    return
                }
            }
        }
        if let keepStack, let s = shown.firstIndex(where: { $0.id == keepStack }) { stackIndex = s }
        clamp()
    }

    /// Put focus on a card by id. False when no shown stack has it.
    @discardableResult
    mutating func focus(cardId: String) -> Bool {
        for (s, stack) in shown.enumerated() {
            if let c = stack.cards.firstIndex(where: { $0.id == cardId }) {
                stackIndex = s
                positions[stack.id] = c
                return true
            }
        }
        return false
    }

    mutating func move(_ direction: Direction) {
        let all = shown
        guard !all.isEmpty else { return }
        switch direction {
        case .down, .up:
            guard let stack = focusedStack, !stack.cards.isEmpty else { return }
            let count = stack.cards.count
            let now = cardIndex ?? 0
            let step = direction == .down ? 1 : -1
            positions[stack.id] = ((now + step) % count + count) % count
        case .left, .right:
            let step = direction == .right ? 1 : -1
            let count = all.count
            // The next stack with cards; if none has any, the next stack.
            var next = stackIndex
            for _ in 0..<count {
                next = ((next + step) % count + count) % count
                if !all[next].cards.isEmpty { break }
            }
            if all[next].cards.isEmpty { next = ((stackIndex + step) % count + count) % count }
            stackIndex = next
        }
    }

    private mutating func clamp() {
        let all = shown
        if all.isEmpty { stackIndex = 0; return }
        stackIndex = min(max(stackIndex, 0), all.count - 1)
        // A stack the filter emptied hands focus to the nearest one with cards.
        if all[stackIndex].cards.isEmpty, let near = Self.nearest(to: stackIndex, in: all) { stackIndex = near }
    }

    private static func nearest(to index: Int, in stacks: [IndexStack]) -> Int? {
        stacks.indices.filter { !stacks[$0].cards.isEmpty }.min { abs($0 - index) < abs($1 - index) }
    }

    // MARK: Width

    /// The narrowest a stack column may be.
    static let columnWidth: CGFloat = 230

    /// Which stacks fit across `width`. All of them in a wide tile. In a
    /// narrow one, as many as fit, keeping the one in focus on screen; one
    /// stack when only one fits.
    func visibleStackIndices(width: CGFloat) -> [Int] {
        let count = shown.count
        guard count > 0 else { return [] }
        let fit = max(1, Int(width / Self.columnWidth))
        if fit >= count { return Array(0..<count) }
        let start = min(max(0, stackIndex - fit / 2), count - fit)
        return Array(start..<(start + fit))
    }
}
