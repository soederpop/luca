import Foundation

/// Where a binding works.
enum KeyScope: String, CaseIterable {
    /// Every mode. The `Mod` keys.
    case layout
    /// Every mode, not layout (`Mod-/`).
    case global
    /// Normal mode, anywhere (`?`, `:`).
    case normal
    /// Normal mode, after the leader (`Space`).
    case leader
    /// Normal mode, in any tile.
    case tile
    /// Resize mode.
    case resize
    /// Normal mode, in a tile of that kind. Named `kind.<id>` in the file.
    case kind
    /// Normal mode, in any index tile (the card stacks).
    case index

    var isEveryMode: Bool { self == .layout || self == .global }
}

/// One binding: a key, an action id and a label. The keys view prints these
/// and nothing else, so a rebinding shows everywhere at once.
struct KeyBinding: Equatable {
    let action: String
    var keys: KeySequence?
    var spec: String
    var label: String
    var scope: KeyScope
    /// The tile kind for `.kind` bindings.
    var kind: String?
    /// True when the user's file set this binding's key.
    var fromUser = false

    var isBound: Bool { keys != nil }

    func display(modSymbol: String) -> String {
        keys?.display(modSymbol: modSymbol) ?? "—"
    }
}

/// The merged keymap: defaults from the app, the user's file over them.
struct Keymap: Equatable {
    var modKey: ModKey = .leftOption
    /// Ordered as in the defaults, so the keys view reads the same each time.
    private(set) var bindings: [KeyBinding] = []
    /// Problems in the user's file, shown once in the status line.
    var warnings: [String] = []

    init(bindings: [KeyBinding] = [], modKey: ModKey = .leftOption) {
        self.bindings = bindings
        self.modKey = modKey
    }

    var modSymbol: String { modKey.symbol }

    func binding(for action: String) -> KeyBinding? {
        bindings.first { $0.action == action }
    }

    /// The key label the keys view shows for an action, or nil if unbound.
    func keyLabel(for action: String) -> String? {
        guard let binding = binding(for: action), binding.isBound else { return nil }
        return binding.display(modSymbol: modSymbol)
    }

    func bindings(in scope: KeyScope, kind: String? = nil) -> [KeyBinding] {
        bindings.filter { $0.scope == scope && (scope != .kind || $0.kind == kind) && $0.isBound }
    }

    /// True when the stroke is a layout or global key, or starts a
    /// Normal-mode or leader binding (`Space`, `:`, `?`). A page key never
    /// takes those.
    func startsShellChord(_ stroke: KeyStroke) -> Bool {
        let scopes: [KeyScope] = [.layout, .global, .normal, .leader]
        return scopes.contains { scope in bindings(in: scope).contains { $0.keys?.strokes.first == stroke } }
    }

    /// Kinds that are card-stack indexes and so take the `index` keys.
    static let indexKinds: Set<String> = ["luca-registry", "luca-docs", "luca-assistants", "luca-tool"]

    /// The keys a tile of this kind adds in Normal mode: its own, then the
    /// shared index keys. Its own win a clash.
    func kindBindings(_ kind: String?) -> [KeyBinding] {
        let own = bindings(in: .kind, kind: kind)
        guard let kind else { return own }
        if Self.indexKinds.contains(kind) { return own + bindings(in: .index) }
        return own
    }

    /// Defaults first; a user entry with the same action id replaces the key
    /// and, if given, the label. A user entry for an unknown action is
    /// reported and ignored.
    static func merged(defaults: KeymapFile, user: KeymapFile?) -> Keymap {
        var map = Keymap(bindings: defaults.entries.compactMap { $0.binding(fromUser: false) })
        map.modKey = defaults.modifier.flatMap(ModKey.init(rawValue:)) ?? .leftOption
        map.warnings = defaults.warnings
        guard let user else { return map }
        map.warnings += user.warnings
        if let name = user.modifier {
            if let key = ModKey(rawValue: name) { map.modKey = key }
            else { map.warnings.append("keymap.yml: unknown modifier '\(name)'") }
        }
        for entry in user.entries {
            guard let index = map.bindings.firstIndex(where: { $0.action == entry.action }) else {
                map.warnings.append("keymap.yml: no action named '\(entry.action)'")
                continue
            }
            var binding = map.bindings[index]
            if let spec = entry.key {
                let keys = KeySequence(spec: spec)
                if keys == nil, !spec.isEmpty, spec.lowercased() != "none" {
                    map.warnings.append("keymap.yml: can't read key '\(spec)' for \(entry.action)")
                    continue
                }
                binding.keys = keys
                binding.spec = spec
                binding.fromUser = true
            }
            if let label = entry.label { binding.label = label }
            map.bindings[index] = binding
        }
        return map
    }
}

// MARK: - The file

/// A parsed `keymap.yml`. The format is a small, fixed part of YAML:
///
/// ```yaml
/// modifier: left-option
/// bindings:
///   layout.focus.left: { key: "Mod-h", label: "focus left", scope: layout }
///   lucaChat.stop:
///     key: Ctrl-c
/// ```
///
/// There is no YAML library in the app, and this shape is all the keymap
/// needs. Anything else is reported as a warning, not guessed at.
struct KeymapFile {
    struct Entry {
        let action: String
        var key: String?
        var label: String?
        var scope: String?

        func binding(fromUser: Bool) -> KeyBinding? {
            guard let key else { return nil }
            let scopeName = scope ?? "normal"
            let kindScope = scopeName.hasPrefix("kind.")
            guard let scope = kindScope ? .kind : KeyScope(rawValue: scopeName) else { return nil }
            return KeyBinding(
                action: action,
                keys: KeySequence(spec: key),
                spec: key,
                label: label ?? action,
                scope: scope,
                kind: kindScope ? String(scopeName.dropFirst("kind.".count)) : nil,
                fromUser: fromUser
            )
        }
    }

    var modifier: String?
    var entries: [Entry] = []
    var warnings: [String] = []

    init(parsing text: String) {
        var inBindings = false
        var current: Entry?
        var entryIndent = 0
        func flush() {
            if let current { entries.append(current) }
            current = nil
        }
        for (number, rawLine) in text.components(separatedBy: .newlines).enumerated() {
            let line = Self.stripComment(rawLine)
            guard !line.trimmingCharacters(in: .whitespaces).isEmpty else { continue }
            let indent = line.prefix { $0 == " " }.count
            let body = line.trimmingCharacters(in: .whitespaces)
            guard let colon = Self.firstColon(body) else {
                warnings.append("keymap.yml line \(number + 1): expected 'name: value'")
                continue
            }
            let name = Self.unquote(String(body[..<colon]).trimmingCharacters(in: .whitespaces))
            let value = String(body[body.index(after: colon)...]).trimmingCharacters(in: .whitespaces)

            if indent == 0 {
                flush()
                inBindings = name == "bindings"
                if name == "modifier" { modifier = Self.unquote(value) }
                else if !inBindings { warnings.append("keymap.yml line \(number + 1): unknown setting '\(name)'") }
                continue
            }
            guard inBindings else { continue }

            if var entry = current, indent > entryIndent {
                // A field line under a block-form entry.
                Self.set(name, value: Self.unquote(value), on: &entry)
                current = entry
                continue
            }
            flush()
            entryIndent = indent
            var entry = Entry(action: name)
            if value.hasPrefix("{") {
                guard value.hasSuffix("}") else {
                    warnings.append("keymap.yml line \(number + 1): unclosed '{'")
                    continue
                }
                for pair in Self.splitFlow(String(value.dropFirst().dropLast())) {
                    guard let c = Self.firstColon(pair) else { continue }
                    let field = Self.unquote(String(pair[..<c]).trimmingCharacters(in: .whitespaces))
                    let fieldValue = Self.unquote(String(pair[pair.index(after: c)...]).trimmingCharacters(in: .whitespaces))
                    Self.set(field, value: fieldValue, on: &entry)
                }
                entries.append(entry)
            } else if value.isEmpty {
                current = entry
            } else {
                // `action: Mod-h` is shorthand for the key alone.
                entry.key = Self.unquote(value)
                entries.append(entry)
            }
        }
        flush()
    }

    private static func set(_ field: String, value: String, on entry: inout Entry) {
        switch field {
        case "key": entry.key = value
        case "label": entry.label = value
        case "scope": entry.scope = value
        default: break
        }
    }

    /// A `#` starts a comment unless it is inside quotes.
    private static func stripComment(_ line: String) -> String {
        var quote: Character?
        var out = ""
        for c in line {
            if let q = quote {
                if c == q { quote = nil }
            } else if c == "\"" || c == "'" {
                quote = c
            } else if c == "#" {
                break
            }
            out.append(c)
        }
        return out
    }

    /// The first `:` outside quotes that is followed by a space or the end.
    /// Keys like `":"` and `Mod-;` hold colons of their own.
    private static func firstColon(_ text: String) -> String.Index? {
        var quote: Character?
        var index = text.startIndex
        while index < text.endIndex {
            let c = text[index]
            if let q = quote {
                if c == q { quote = nil }
            } else if c == "\"" || c == "'" {
                quote = c
            } else if c == ":" {
                let next = text.index(after: index)
                if next == text.endIndex || text[next] == " " { return index }
            }
            index = text.index(after: index)
        }
        return nil
    }

    /// Split `a: 1, b: "x, y"` on commas outside quotes.
    private static func splitFlow(_ text: String) -> [String] {
        var parts: [String] = []
        var quote: Character?
        var current = ""
        for c in text {
            if let q = quote {
                if c == q { quote = nil }
                current.append(c)
            } else if c == "\"" || c == "'" {
                quote = c
                current.append(c)
            } else if c == "," {
                parts.append(current)
                current = ""
            } else {
                current.append(c)
            }
        }
        if !current.trimmingCharacters(in: .whitespaces).isEmpty { parts.append(current) }
        return parts
    }

    private static func unquote(_ text: String) -> String {
        guard text.count >= 2, let first = text.first, first == text.last, first == "\"" || first == "'" else { return text }
        var inner = String(text.dropFirst().dropLast())
        if first == "\"" { inner = inner.replacingOccurrences(of: "\\\"", with: "\"").replacingOccurrences(of: "\\\\", with: "\\") }
        return inner
    }
}
