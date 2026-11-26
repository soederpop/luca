import Foundation

/// A key a web page bound with `studio.keys.bind` (or `data-key`). The page
/// sends its list to the host; the shell routes the key to the page in
/// Normal mode and the keys view lists it. Pure, so the parse is tested.
struct PageKey: Equatable {
    /// As the page wrote it: `b`, `Enter`, `ctrl+k`, `alt+shift+Enter`.
    let spec: String
    let label: String
    let stroke: KeyStroke

    /// The page's `key` (the DOM `KeyboardEvent.key`) and modifiers, for
    /// sending the press back as a `keydown`.
    let domKey: String
    let ctrl, alt, meta, shift: Bool

    init?(spec: String, label: String) {
        var parts = spec.components(separatedBy: "+")
        guard let last = parts.popLast() else { return nil }
        // "ctrl++" is the plus key.
        let key = last.isEmpty && spec.hasSuffix("+") ? "+" : last
        guard !key.isEmpty else { return nil }
        let mods = Set(parts.map { $0.lowercased() })
        ctrl = mods.contains("ctrl")
        alt = mods.contains("alt") || mods.contains("option")
        meta = mods.contains("meta") || mods.contains("cmd")
        // A single character already carries its shift ('K'), as in kit.js.
        shift = key.count > 1 && mods.contains("shift")
        domKey = key
        let names = [" ": "Space", "Escape": "Esc", "ArrowUp": "Up", "ArrowDown": "Down", "ArrowLeft": "Left",
                     "ArrowRight": "Right", "Enter": "Enter", "Tab": "Tab", "Backspace": "Backspace"]
        let strokeKey = names[key] ?? key
        if key.count > 1, names[key] == nil { return nil }
        stroke = KeyStroke(key: strokeKey, shift: shift || (key.count == 1 && key.first!.isUppercase), ctrl: ctrl, cmd: meta, alt: alt)
        self.spec = spec
        self.label = label
    }

    /// Does a key press hit this page key? A page's `alt` also takes left
    /// Option, which the shell reads as `Mod`.
    func matches(_ pressed: KeyStroke) -> Bool {
        if pressed == stroke { return true }
        guard alt, pressed.mod else { return false }
        var plain = pressed
        plain.mod = false
        plain.alt = true
        return plain == stroke
    }

    /// The page's list (`[{ key, label }]`, newest first). Keys the shell
    /// cannot read are left out; the first of two same keys wins, as in the page.
    static func list(from raw: Any?) -> [PageKey] {
        guard let items = raw as? [[String: Any]] else { return [] }
        var seen = Set<KeyStroke>()
        return items.compactMap { item in
            guard let spec = item["key"] as? String,
                  let key = PageKey(spec: spec, label: (item["label"] as? String) ?? spec),
                  seen.insert(key.stroke).inserted else { return nil }
            return key
        }
    }

    /// JavaScript that presses the key in the page, the way kit.js reads it.
    var pressScript: String {
        let detail: [String: Any] = ["key": domKey, "ctrlKey": ctrl, "altKey": alt, "metaKey": meta, "shiftKey": shift, "bubbles": true, "cancelable": true]
        let json = (try? JSONSerialization.data(withJSONObject: detail)).flatMap { String(data: $0, encoding: .utf8) } ?? "{}"
        return "document.dispatchEvent(new KeyboardEvent('keydown', \(json)))"
    }
}
