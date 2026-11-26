import Foundation

/// The input modes. The status line always shows the current one.
enum InputMode: String {
    case normal, insert, command, hint, resize

    var label: String { rawValue.uppercased() }
}

/// What the router decided for one key press.
enum RouteResult: Equatable {
    /// Run this action. `count` is a typed prefix (`2 Space i`).
    case action(String, count: Int?)
    /// Part of a chord. Wait for the next key.
    case pending
    /// Not ours: let the key reach the text field or the menu.
    case passThrough
    /// Ours, but it does nothing (a broken chord, an unbound key in resize).
    case swallow
    /// `Esc`. The shell decides what it leaves (insert, a chord, a panel).
    case escape
    /// A key typed in hint mode.
    case hint(KeyStroke)
}

/// One key router for the whole app. Pure: the shell feeds it strokes and
/// the mode, and acts on the result. Bindings come from the live keymap.
struct KeyRouter {
    var keymap: Keymap
    var mode: InputMode = .normal
    private(set) var pending: [KeyStroke] = []
    private(set) var count: Int?

    static let ctrlW = KeyStroke(key: "w", ctrl: true)
    static let escape = KeyStroke(key: "Esc")

    init(keymap: Keymap) { self.keymap = keymap }

    var isPending: Bool { !pending.isEmpty || count != nil }

    /// The half-typed chord, for the status line: `2 Space`, `g`.
    var pendingDisplay: String {
        var parts: [String] = []
        if let count { parts.append(String(count)) }
        if !pending.isEmpty { parts.append(KeySequence(pending).display(modSymbol: keymap.modSymbol)) }
        return parts.joined(separator: " ")
    }

    mutating func reset() {
        pending = []
        count = nil
    }

    /// Normal-mode scopes, most specific first. A tile kind's `y y` wins
    /// over the tile-wide one.
    private func normalBindings(kind: String?) -> [KeyBinding] {
        keymap.kindBindings(kind) + keymap.bindings(in: .tile)
            + keymap.bindings(in: .normal) + keymap.bindings(in: .leader)
    }

    /// Bindings that continue the pending chord, for the which-key panel.
    func continuations(kind: String?) -> [(keys: String, label: String)] {
        guard !pending.isEmpty else { return [] }
        if pending == [Self.ctrlW] {
            return keymap.bindings(in: .layout)
                .filter { $0.keys?.strokes.count == 1 && $0.keys?.strokes[0].mod == true }
                .map { b in
                    var stroke = b.keys!.strokes[0]
                    stroke.mod = false
                    return (stroke.display(modSymbol: keymap.modSymbol), b.label)
                }
        }
        var seen = Set<String>()
        return normalBindings(kind: kind).compactMap { b in
            guard let keys = b.keys, keys.strokes.count > pending.count, keys.hasPrefix(pending) else { return nil }
            let rest = KeySequence(Array(keys.strokes.dropFirst(pending.count))).display(modSymbol: keymap.modSymbol)
            guard seen.insert(rest).inserted else { return nil }
            return (rest, b.label)
        }
    }

    mutating func route(_ stroke: KeyStroke, kind: String?) -> RouteResult {
        // Layout and global keys work in every mode, and cut through a chord.
        if pending != [Self.ctrlW], let binding = single(stroke, in: [.global, .layout]) {
            let n = count
            reset()
            return .action(binding.action, count: n)
        }
        if stroke == Self.escape {
            reset()
            return .escape
        }
        switch mode {
        case .insert, .command:
            return .passThrough
        case .hint:
            return .hint(stroke)
        case .resize:
            if let binding = single(stroke, in: [.resize]) { return .action(binding.action, count: nil) }
            return .swallow
        case .normal:
            return routeNormal(stroke, kind: kind)
        }
    }

    private mutating func routeNormal(_ stroke: KeyStroke, kind: String?) -> RouteResult {
        // `Ctrl-w x` runs what `Mod-x` runs, for vim habit.
        if pending == [Self.ctrlW] {
            let n = count
            reset()
            if let binding = single(stroke.withMod, in: [.layout]) { return .action(binding.action, count: n) }
            return .swallow
        }
        let candidates = normalBindings(kind: kind)
        if pending.isEmpty, stroke == Self.ctrlW, !candidates.contains(where: { $0.keys?.strokes.first == stroke }) {
            pending = [stroke]
            return .pending
        }
        // A count: digits typed before a chord.
        if pending.isEmpty, stroke.key.count == 1, let digit = Int(stroke.key),
           !stroke.mod && !stroke.shift && !stroke.ctrl && !stroke.cmd && !stroke.alt,
           count != nil || digit != 0,
           !candidates.contains(where: { $0.keys?.strokes.first == stroke }) {
            count = (count ?? 0) * 10 + digit
            return .pending
        }

        let sequence = pending + [stroke]
        let matching = candidates.filter { $0.keys?.hasPrefix(sequence) == true }
        guard !matching.isEmpty else {
            let wasPending = isPending
            reset()
            return wasPending ? .swallow : .passThrough
        }
        let exacts = matching.filter { $0.keys?.strokes == sequence }
        let exact = exacts.first { $0.fromUser } ?? exacts.first
        let longer = matching.contains { ($0.keys?.strokes.count ?? 0) > sequence.count }
        if let exact, !longer {
            let n = count
            reset()
            return .action(exact.action, count: n)
        }
        pending = sequence
        return .pending
    }

    private func single(_ stroke: KeyStroke, in scopes: [KeyScope]) -> KeyBinding? {
        // The user's own binding wins a clash with a default.
        let all = scopes.flatMap { keymap.bindings(in: $0) }
            .filter { $0.keys?.strokes == [stroke] }
        return all.first { $0.fromUser } ?? all.first
    }
}
