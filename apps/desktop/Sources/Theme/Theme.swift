import SwiftUI

/// The look, from the generated kit tokens: the default dark palette unless
/// `:set light` or a named theme (`:theme`).
enum Theme {
    static var palette: KitPalette { ThemeSettings.currentPalette }

    /// A tile owner's color: each project has its own, the app's own tiles
    /// keep the accent.
    @MainActor static func ownerColor(_ owner: String) -> Color {
        ownerKitColor(owner)?.color ?? palette.accent.color
    }

    /// The project's color in the kit palette (its `hues` slots). Nil for an owner that is no project.
    @MainActor static func ownerKitColor(_ owner: String) -> KitColor? {
        let slots = palette.hues
        guard !slots.isEmpty, let project = ProjectHub.project(ofOwner: owner) else { return nil }
        let names = ProjectHub.shared.recent.map(\.id)
        let slot = OwnerColors.slots(names: names, count: slots.count)[project] ?? OwnerColors.index(project, slots: slots.count)
        return slots[slot]
    }

    /// A status word's color, the same mapping as the kit's `data-status`
    /// badges. Presentation only: the host says which status a card has.
    static func statusColor(_ status: String) -> Color {
        switch status.lowercased() {
        case "done", "completed", "approved": return palette.good.color
        case "running", "in_progress", "in progress", "building", "replying": return palette.info.color
        case "blocked", "waiting", "needs-review", "reviewing": return palette.warn.color
        case "failed", "error", "rejected": return palette.bad.color
        default: return palette.textFaint.color
        }
    }

    /// A hue for a tile kind, for its icon and its word in the palette, so
    /// kinds read apart at a glance. Kinds of one family share a hue. The
    /// hues are the theme's code colors: every theme has them and they are
    /// checked for contrast.
    @MainActor static func kindColor(_ kind: String) -> Color {
        let s = palette.syntax
        switch kind {
        case "luca-registry", "luca-helper", "luca-change": return WorkbenchStyle.thingColor("features")
        case "luca-plugins": return WorkbenchStyle.thingColor("plugins")
        case "luca-command": return WorkbenchStyle.thingColor("commands")
        case "luca-endpoints", "luca-request", "luca-page": return WorkbenchStyle.thingColor("endpoints")
        case "luca-servers": return WorkbenchStyle.thingColor("servers")
        case "luca-docs", "luca-models", "luca-doc", "luca-contentbase": return WorkbenchStyle.thingColor("docs")
        case "luca-assistants", "luca-assistant", "luca-chat", "luca-ai": return WorkbenchStyle.thingColor("assistants")
        case "luca-file", "app-file": return s.property.color
        case "luca-project", "app-projects": return s.type.color
        case "luca-tool": return s.keyword.color
        case "luca-console": return s.number.color
        case "luca-terminal": return s.string.color
        default: return palette.textMuted.color
        }
    }

    /// Chrome text is monospace. Document and chat text is proportional.
    static func chrome(_ size: CGFloat = KitTokens.TypeScale.sm, weight: Font.Weight = .regular) -> Font {
        .system(size: size, weight: weight, design: .monospaced)
    }

    static func body(_ size: CGFloat = KitTokens.TypeScale.md) -> Font {
        .system(size: size)
    }
}

extension Color {
    static var kitText: Color { Theme.palette.text.color }
    static var kitMuted: Color { Theme.palette.textMuted.color }
    static var kitFaint: Color { Theme.palette.textFaint.color }
}

/// One color slot per project. A project starts from the slot its id
/// hashes to, so it keeps its color across launches; when two want one
/// slot, the second (by id) takes the next free one, so projects on screen
/// differ while there are slots left. Pure, so the rule is tested.
@MainActor
enum OwnerColors {
    private static var cache: (key: String, slots: [String: Int])?

    /// The slot a name hashes to (FNV-1a), the same on every machine.
    nonisolated static func index(_ name: String, slots: Int) -> Int {
        guard slots > 0 else { return 0 }
        var hash: UInt32 = 2_166_136_261
        for byte in name.utf8 {
            hash ^= UInt32(byte)
            hash = hash &* 16_777_619
        }
        return Int(hash % UInt32(slots))
    }

    static func slots(names: [String], count: Int) -> [String: Int] {
        guard count > 0 else { return [:] }
        let sorted = Array(Set(names)).sorted()
        let key = "\(count)|" + sorted.joined(separator: "|")
        if let cache, cache.key == key { return cache.slots }
        var taken = Set<Int>()
        var out: [String: Int] = [:]
        for name in sorted {
            var slot = index(name, slots: count)
            if taken.count < count { while taken.contains(slot) { slot = (slot + 1) % count } }
            taken.insert(slot)
            out[name] = slot
        }
        cache = (key, out)
        return out
    }
}
