import Foundation

/// Which physical key is `Mod`. Default is left Option, read from the
/// device-specific flag, so right Option still types characters.
enum ModKey: String, CaseIterable {
    case leftOption = "left-option"
    case rightOption = "right-option"
    case option
    case leftCommand = "left-command"
    case rightCommand = "right-command"
    case command
    case leftControl = "left-control"
    case control

    // Device-specific bits in NSEvent.modifierFlags.rawValue (IOKit NX_DEVICE*).
    static let deviceLeftControl: UInt = 0x0000_0001
    static let deviceLeftCommand: UInt = 0x0000_0008
    static let deviceRightCommand: UInt = 0x0000_0010
    static let deviceLeftOption: UInt = 0x0000_0020
    static let deviceRightOption: UInt = 0x0000_0040
    static let deviceRightControl: UInt = 0x0000_2000

    // Device-independent bits (NSEvent.ModifierFlags).
    static let flagShift: UInt = 1 << 17
    static let flagControl: UInt = 1 << 18
    static let flagOption: UInt = 1 << 19
    static let flagCommand: UInt = 1 << 20

    /// Is `Mod` held, given the raw modifier flags of an event?
    func isHeld(rawFlags raw: UInt) -> Bool {
        switch self {
        case .leftOption: return raw & Self.deviceLeftOption != 0
        case .rightOption: return raw & Self.deviceRightOption != 0
        case .option: return raw & Self.flagOption != 0
        case .leftCommand: return raw & Self.deviceLeftCommand != 0
        case .rightCommand: return raw & Self.deviceRightCommand != 0
        case .command: return raw & Self.flagCommand != 0
        case .leftControl: return raw & Self.deviceLeftControl != 0
        case .control: return raw & Self.flagControl != 0
        }
    }

    /// The plain modifier `Mod` takes over, so a stroke with Mod does not
    /// also read as Option (or Command, or Control) when only Mod is down.
    func consumes(_ plain: String, rawFlags raw: UInt) -> Bool {
        switch (self, plain) {
        case (.leftOption, "alt"): return raw & Self.deviceRightOption == 0
        case (.rightOption, "alt"): return raw & Self.deviceLeftOption == 0
        case (.option, "alt"): return true
        case (.leftCommand, "cmd"): return raw & Self.deviceRightCommand == 0
        case (.rightCommand, "cmd"): return raw & Self.deviceLeftCommand == 0
        case (.command, "cmd"): return true
        case (.leftControl, "ctrl"): return raw & Self.deviceRightControl == 0
        case (.control, "ctrl"): return true
        default: return false
        }
    }

    var symbol: String {
        switch self {
        case .leftOption, .rightOption, .option: return "⌥"
        case .leftCommand, .rightCommand, .command: return "⌘"
        case .leftControl, .control: return "⌃"
        }
    }
}

/// One key press, normalized so a binding and an event compare equal.
///
/// Letters are lowercase with `shift` set (`G` is Shift-g). Digits and the
/// named keys keep `shift`. Other symbols carry the character they type
/// (`?`, `:`), and their shift is dropped, because the character already
/// says it.
struct KeyStroke: Hashable, CustomStringConvertible {
    var key: String
    var mod = false
    var shift = false
    var ctrl = false
    var cmd = false
    /// Option that is not Mod (right Option, by default).
    var alt = false

    static let namedKeys: Set<String> = ["Space", "Enter", "Esc", "Tab", "Backspace", "Up", "Down", "Left", "Right"]

    init(key: String, mod: Bool = false, shift: Bool = false, ctrl: Bool = false, cmd: Bool = false, alt: Bool = false) {
        self.key = key
        self.mod = mod
        self.shift = shift
        self.ctrl = ctrl
        self.cmd = cmd
        self.alt = alt
        normalize()
    }

    private mutating func normalize() {
        if key.count == 1, let c = key.first {
            if c.isLetter {
                if c.isUppercase { shift = true }
                key = key.lowercased()
            } else if !c.isNumber {
                shift = false
            }
        }
    }

    /// Parse one token of a binding: `Mod-Shift-h`, `Ctrl-w`, `G`, `Space`, `?`.
    init?(token: String) {
        // The minus key alone.
        if token == "-" { self = KeyStroke(key: "-"); return }
        var parts = token.components(separatedBy: "-")
        // A trailing "-" means the minus key itself: "Mod--".
        if token.hasSuffix("--") { parts = Array(token.dropLast(2).components(separatedBy: "-")) + ["-"] }
        guard let last = parts.popLast(), !last.isEmpty else { return nil }
        var stroke = KeyStroke(key: Self.canonicalName(last))
        for part in parts {
            switch part.lowercased() {
            case "mod": stroke.mod = true
            case "shift", "s": stroke.shift = true
            case "ctrl", "control", "c": stroke.ctrl = true
            case "cmd", "command", "d": stroke.cmd = true
            case "alt", "opt", "option", "a": stroke.alt = true
            default: return nil
            }
        }
        stroke.normalize()
        self = stroke
    }

    private static func canonicalName(_ name: String) -> String {
        if name.count == 1 { return name }
        let lower = name.lowercased()
        let names: [String: String] = [
            "space": "Space", "enter": "Enter", "return": "Enter", "cr": "Enter", "esc": "Esc", "escape": "Esc",
            "tab": "Tab", "backspace": "Backspace", "bs": "Backspace", "up": "Up", "down": "Down",
            "left": "Left", "right": "Right",
        ]
        return names[lower] ?? name
    }

    /// A key name from a macOS virtual key code, for the keys whose
    /// character changes with modifiers (digits, letters) or has none.
    /// US layout.
    static let keyCodeNames: [UInt16: String] = [
        0: "a", 11: "b", 8: "c", 2: "d", 14: "e", 3: "f", 5: "g", 4: "h", 34: "i", 38: "j", 40: "k",
        37: "l", 46: "m", 45: "n", 31: "o", 35: "p", 12: "q", 15: "r", 1: "s", 17: "t", 32: "u", 9: "v",
        13: "w", 7: "x", 16: "y", 6: "z",
        18: "1", 19: "2", 20: "3", 21: "4", 23: "5", 22: "6", 26: "7", 28: "8", 25: "9", 29: "0",
        49: "Space", 36: "Enter", 76: "Enter", 53: "Esc", 48: "Tab", 51: "Backspace",
        126: "Up", 125: "Down", 123: "Left", 124: "Right",
    ]

    /// Build a stroke from an event's parts. `characters` is the event's
    /// `charactersIgnoringModifiers` (Option and Control are already ignored,
    /// Shift is not).
    static func from(keyCode: UInt16, characters: String?, rawFlags raw: UInt, modKey: ModKey) -> KeyStroke? {
        let mod = modKey.isHeld(rawFlags: raw)
        var shift = raw & ModKey.flagShift != 0
        var ctrl = raw & ModKey.flagControl != 0
        var cmd = raw & ModKey.flagCommand != 0
        var alt = raw & ModKey.flagOption != 0
        if mod {
            if modKey.consumes("alt", rawFlags: raw) { alt = false }
            if modKey.consumes("cmd", rawFlags: raw) { cmd = false }
            if modKey.consumes("ctrl", rawFlags: raw) { ctrl = false }
        }
        let key: String
        if let named = keyCodeNames[keyCode] {
            key = named
        } else if let characters, let first = characters.first {
            key = String(first)
            shift = false
        } else {
            return nil
        }
        return KeyStroke(key: key, mod: mod, shift: shift, ctrl: ctrl, cmd: cmd, alt: alt)
    }

    /// The same stroke with Mod added. `Ctrl-w h` runs whatever `Mod-h` runs.
    var withMod: KeyStroke {
        var copy = self
        copy.mod = true
        return copy
    }

    var description: String { display(modSymbol: "⌥") }

    /// How the keys view prints it: `⌥⇧h`, `⌃d`, `Space`, `G`.
    func display(modSymbol: String) -> String {
        var out = ""
        if ctrl { out += "⌃" }
        if alt { out += "⌥" }
        if mod { out += modSymbol }
        if cmd { out += "⌘" }
        let isLetter = key.count == 1 && key.first!.isLetter
        if shift && isLetter && !mod && !ctrl && !cmd && !alt {
            return out + key.uppercased()
        }
        if shift { out += "⇧" }
        return out + key
    }
}

/// A sequence of strokes: `Space Space`, `g g`, `Mod-h`.
struct KeySequence: Hashable, CustomStringConvertible {
    var strokes: [KeyStroke]

    init(_ strokes: [KeyStroke]) { self.strokes = strokes }

    /// Parse a binding string. Tokens are separated by spaces. Returns nil
    /// for `none` or an empty string, which unbinds an action.
    init?(spec: String) {
        let tokens = spec.split(separator: " ").map(String.init)
        guard !tokens.isEmpty, spec.lowercased() != "none" else { return nil }
        var strokes: [KeyStroke] = []
        for token in tokens {
            guard let stroke = KeyStroke(token: token) else { return nil }
            strokes.append(stroke)
        }
        self.strokes = strokes
    }

    var description: String { display(modSymbol: "⌥") }

    /// Single plain characters run together (`gg`, `]]`); anything else is
    /// spaced (`Space Space`, `⌃w h`).
    func display(modSymbol: String) -> String {
        let parts = strokes.map { $0.display(modSymbol: modSymbol) }
        let allPlain = strokes.count > 1 && parts.allSatisfy { $0.count == 1 }
        return parts.joined(separator: allPlain ? "" : " ")
    }

    func hasPrefix(_ prefix: [KeyStroke]) -> Bool {
        strokes.count >= prefix.count && Array(strokes.prefix(prefix.count)) == prefix
    }
}
