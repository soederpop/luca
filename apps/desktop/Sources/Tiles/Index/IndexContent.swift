import SwiftUI
import Combine

/// What every card-stack index shares: the stacks, focus, filter and peek.
/// A kind fills the stacks (`loadStacks`), calls `reload()` when it has
/// something to load from, and adds its own keys (`performKind`).
///
/// An index never opens an item inside itself. `Enter` opens a new tile.
@MainActor
class IndexContent: TileContent {
    @Published var state = CardStackState()
    @Published private(set) var error: String?
    @Published private(set) var loaded = false
    /// `/` shows the filter field and gives it the keyboard.
    @Published var filtering = false
    @Published private(set) var filterTick = 0
    /// One line over the stacks: why the index is empty on purpose (the
    /// project has no docs folder) or why the host failed. A kind sets it.
    @Published var notice: String?

    /// The peek tile (`p`). It closes on the next move.
    private var peekTile: UUID?
    private var peekCard: String?
    private var loadTask: Task<Void, Never>?

    /// What an empty index says.
    var emptyNote: String { "Nothing here yet." }

    func loadStacks() async throws -> [IndexStack] { [] }

    /// The groups this index can show alone, in order (`own`, "This
    /// project"). Empty: no group bar.
    var groupOrder: [(id: String, label: String)] { [] }

    /// Show one group alone, or every card (nil). A group with no cards is not taken.
    func setGroup(_ group: String?) {
        if let group, !state.groups(order: groupOrder).contains(where: { $0.id == group }) {
            Shell.shared.flash("Nothing in that group here")
            return
        }
        state.group = group
        closePeek()
    }

    /// The next group, then every card again.
    func cycleGroup() {
        let groups = state.groups(order: groupOrder)
        guard !groups.isEmpty else { return }
        guard let now = state.group, let index = groups.firstIndex(where: { $0.id == now }) else { return setGroup(groups[0].id) }
        setGroup(index + 1 < groups.count ? groups[index + 1].id : nil)
    }

    /// A kind's own keys (`lucaRegistry.take`). False if not ours.
    func performKind(_ action: String) -> Bool { false }

    override func makeBody() -> AnyView {
        AnyView(IndexView(model: self))
    }

    /// Fetch again. Focus stays on the same card.
    func reload(quiet: Bool = false, then: (() -> Void)? = nil) {
        loadTask?.cancel()
        if !quiet { stateLabel = loaded ? "updating" : "loading" }
        loadTask = Task { [weak self] in
            do {
                let stacks = try await self?.loadStacks() ?? []
                guard let self, !Task.isCancelled else { return }
                self.state.setStacks(stacks)
                self.error = nil
                self.loaded = true
                self.stateLabel = "\(stacks.reduce(0) { $0 + $1.count })"
                then?()
            } catch {
                guard let self, !Task.isCancelled else { return }
                self.error = ErrorText.message(error)
                self.stateLabel = "error"
            }
        }
    }

    override func perform(_ action: String) -> Bool {
        switch action {
        case "index.down": moveFocus(.down)
        case "index.up": moveFocus(.up)
        case "index.left": moveFocus(.left)
        case "index.right": moveFocus(.right)
        case "index.open": openFocused()
        case "index.peek": peek()
        case "index.filter":
            filtering = true
            filterTick += 1
        case "index.reload": reload()
        default: return performKind(action)
        }
        return true
    }

    func moveFocus(_ direction: Direction) {
        state.move(direction)
        closePeek()
    }

    func select(_ cardId: String) {
        if state.focus(cardId: cardId), peekCard != cardId { closePeek() }
    }

    func openFocused() {
        guard let card = state.focusedCard else { return }
        // Opening the card that is peeking keeps that tile.
        if let peek = peekTile, peekCard == card.id, Shell.shared.tiles[peek] != nil {
            peekTile = nil
            peekCard = nil
            Shell.shared.focusTile(peek)
            return
        }
        closePeek()
        Shell.shared.open(card.uri)
    }

    /// `p`: a temporary tile beside the index. `p` again closes it.
    private func peek() {
        guard let card = state.focusedCard else { return }
        if peekCard == card.id, peekTile != nil { closePeek(); return }
        closePeek()
        peekTile = Shell.shared.open(card.uri, focus: false, near: tileId)
        peekCard = card.id
    }

    private func closePeek() {
        if let peek = peekTile, Shell.shared.tiles[peek] != nil { Shell.shared.close(peek) }
        peekTile = nil
        peekCard = nil
    }

    /// Enter or Esc in the filter: the filter stays, the keys go back to the cards.
    func endFilter() {
        filtering = false
        if let window = Shell.shared.tiles[tileId]?.controller?.window { window.makeFirstResponder(nil) }
        Shell.shared.setMode(.normal)
    }

    override func didLeaveInsert() {
        if filtering { endFilter() }
    }

    override func stop() {
        loadTask?.cancel()
        closePeek()
        super.stop()
    }
}

/// An error in words: the `error` field of a JSON reply when there is one
/// (the host answers `{error}`), else the error's own text.
enum ErrorText {
    static func message(_ error: Error) -> String {
        let text = error.localizedDescription
        if let brace = text.firstIndex(of: "{"),
           let data = String(text[brace...]).data(using: .utf8),
           let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let message = json["error"] as? String {
            return message
        }
        return text
    }
}
