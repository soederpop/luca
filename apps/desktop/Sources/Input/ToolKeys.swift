import Foundation

/// A key a project's tool declared for one of its actions, once the app
/// has checked it against its own keys.
struct DeclaredKey: Equatable {
    let action: String
    let spec: String
    let label: String
    let stroke: KeyStroke
}

/// Which declared keys a tool tile may use. Pure, so it is tested.
///
/// Rules: one stroke per key. A key that starts a shell chord (layout,
/// global, `Space`, `:`, `?`) or is `Esc` is never taken. A key the tile
/// kind or every tile already has (`j`, `r`, `f`, `g g`…) stays built in;
/// the clash is a warning in the tile. Of two same keys, the first wins.
enum ToolKeys {
    struct Resolved: Equatable {
        var keys: [DeclaredKey] = []
        var warnings: [String] = []
    }

    static func resolve(_ declared: [WorkbenchToolKey], keymap: Keymap, kind: String) -> Resolved {
        var out = Resolved()
        let builtIn = keymap.kindBindings(kind) + keymap.bindings(in: .tile)
        var taken = Set<KeyStroke>()
        for key in declared {
            guard let sequence = KeySequence(spec: key.key), sequence.strokes.count == 1, let stroke = sequence.strokes.first else {
                out.warnings.append("\(key.action): can't read key '\(key.key)'; use one key like a, A or Ctrl-x")
                continue
            }
            if stroke == KeyRouter.escape || stroke.mod || keymap.startsShellChord(stroke) {
                out.warnings.append("\(key.action): '\(key.key)' belongs to the app; pick another key")
                continue
            }
            if let clash = builtIn.first(where: { $0.keys?.strokes.first == stroke }) {
                out.warnings.append("\(key.action): '\(key.key)' is the built-in key for \(clash.label); the built-in wins")
                continue
            }
            guard taken.insert(stroke).inserted else {
                out.warnings.append("\(key.action): '\(key.key)' is declared twice; the first wins")
                continue
            }
            out.keys.append(DeclaredKey(action: key.action, spec: key.key, label: key.label, stroke: stroke))
        }
        return out
    }
}
