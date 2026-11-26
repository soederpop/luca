import SwiftUI

// MARK: - Hint mode

/// The controls in one tile that hint mode can reach. Each control
/// registers an action; in hint mode it gets a letter label.
@MainActor
final class HintRegistry: ObservableObject {
    private var actions: [String: () -> Void] = [:]
    private var order: [String] = []
    /// Label per target while hinting. Empty when not hinting.
    @Published private(set) var labels: [String: String] = [:]
    @Published private(set) var typed = ""

    static let alphabet = Array("asdfghjklqwertyuiopzxcvbnm").map(String.init)

    var isHinting: Bool { !labels.isEmpty }

    func register(_ id: String, action: @escaping () -> Void) {
        if actions[id] == nil { order.append(id) }
        actions[id] = action
    }

    func unregister(_ id: String) {
        actions[id] = nil
        order.removeAll { $0 == id }
    }

    /// Label every target. False when the tile has none.
    func begin() -> Bool {
        let ids = order.filter { actions[$0] != nil }
        guard !ids.isEmpty else { return false }
        let letters = Self.alphabet
        var out: [String: String] = [:]
        if ids.count <= letters.count {
            for (i, id) in ids.enumerated() { out[id] = letters[i] }
        } else {
            for (i, id) in ids.enumerated() { out[id] = letters[i / letters.count % letters.count] + letters[i % letters.count] }
        }
        labels = out
        typed = ""
        return true
    }

    enum Outcome { case fired, narrowed, missed }

    func type(_ key: String) -> Outcome {
        let next = typed + key
        let matches = labels.filter { $0.value.hasPrefix(next) }
        if matches.isEmpty { return .missed }
        if matches.count == 1, let (id, label) = matches.first, label == next {
            end()
            actions[id]?()
            return .fired
        }
        typed = next
        return .narrowed
    }

    func end() {
        labels = [:]
        typed = ""
    }
}

struct HintAnchorKey: PreferenceKey {
    static let defaultValue: [String: Anchor<CGRect>] = [:]
    static func reduce(value: inout [String: Anchor<CGRect>], nextValue: () -> [String: Anchor<CGRect>]) {
        value.merge(nextValue()) { $1 }
    }
}

private struct HintTarget: ViewModifier {
    let id: String
    let registry: HintRegistry
    let action: () -> Void

    func body(content: Content) -> some View {
        content
            .anchorPreference(key: HintAnchorKey.self, value: .bounds) { [id: $0] }
            .onAppear { registry.register(id, action: action) }
            .onDisappear { registry.unregister(id) }
    }
}

/// Draws the hint labels over a tile.
struct HintOverlay: View {
    @ObservedObject var registry: HintRegistry
    let anchors: [String: Anchor<CGRect>]

    var body: some View {
        GeometryReader { proxy in
            ForEach(Array(registry.labels.keys.sorted()), id: \.self) { id in
                if let anchor = anchors[id], let label = registry.labels[id] {
                    let rect = proxy[anchor]
                    Text(label)
                        .font(Theme.chrome(KitTokens.TypeScale.sm, weight: .bold))
                        .foregroundStyle(Theme.palette.accentOn.color)
                        .padding(.horizontal, 4)
                        .padding(.vertical, 1)
                        .background(RoundedRectangle(cornerRadius: KitTokens.Radius.sm).fill(Theme.palette.warn.color))
                        .opacity(label.hasPrefix(registry.typed) ? 1 : 0.25)
                        .position(x: rect.minX + 8, y: rect.minY + 6)
                }
            }
        }
        .allowsHitTesting(false)
    }
}

// MARK: - Key badges

/// A key badge next to a control that has a binding. Shows only with the
/// keys view on, and reads the live keymap, so a rebinding shows here too.
private struct KeyBadge: ViewModifier {
    let action: String
    let leading: Bool
    @EnvironmentObject private var keymap: KeymapStore
    @EnvironmentObject private var shell: Shell

    func body(content: Content) -> some View {
        let label = shell.keysView ? keymap.map.keyLabel(for: action) : nil
        if leading {
            // In a row at a window edge (the header), beside the control.
            HStack(spacing: KitTokens.Space.s2) {
                if let label { KeyCap(label, small: true, tint: Theme.palette.accent.color).allowsHitTesting(false) }
                content
            }
        } else {
            content.overlay(alignment: .topTrailing) {
                if let label {
                    KeyCap(label, small: true, tint: Theme.palette.accent.color)
                        .background(RoundedRectangle(cornerRadius: KitTokens.Radius.sm + 1).fill(Theme.palette.surface.color))
                        .offset(x: 8, y: -10)
                        .allowsHitTesting(false)
                }
            }
        }
    }
}

/// One key, drawn as a small cap. Quiet by default: the key's text in the
/// body color on a soft cap. A tint colors it (a scope in the keys view).
struct KeyCap: View {
    let text: String
    var small = false
    var tint: Color?

    init(_ text: String, small: Bool = false, tint: Color? = nil) {
        self.text = text
        self.small = small
        self.tint = tint
    }

    var body: some View {
        let p = Theme.palette
        let color = tint ?? p.textBody.color
        Text(text)
            .font(Theme.chrome(small ? WorkbenchStyle.Size.caption : KitTokens.TypeScale.xs, weight: .semibold))
            .foregroundStyle(color)
            .padding(.horizontal, small ? 5 : 7)
            .padding(.vertical, small ? 1 : 2)
            .background(
                RoundedRectangle(cornerRadius: KitTokens.Radius.sm + 1)
                    .fill(tint.map { $0.opacity(0.14) } ?? p.raised.color)
                    .overlay(RoundedRectangle(cornerRadius: KitTokens.Radius.sm + 1)
                        .stroke(tint.map { $0.opacity(0.35) } ?? p.borderStrong.color, lineWidth: 1))
            )
            .fixedSize()
    }
}

/// The key bound to an action, always shown, from the live keymap (a
/// rebinding shows here too). Nothing when the action has no key.
struct BoundKey: View {
    let action: String
    var tint: Color?
    /// Draw it only while the keys view (`?`) is open, like `.keyBadge`.
    var withKeysView = false
    @EnvironmentObject private var keymap: KeymapStore
    @EnvironmentObject private var shell: Shell

    var body: some View {
        if !withKeysView || shell.keysView, let label = keymap.map.keyLabel(for: action) {
            KeyCap(label, small: true, tint: tint)
        }
    }
}

extension View {
    /// Let hint mode reach this control.
    func hintTarget(_ id: String, in registry: HintRegistry, action: @escaping () -> Void) -> some View {
        modifier(HintTarget(id: id, registry: registry, action: action))
    }

    /// Show the key bound to `action` next to this control in the keys view.
    func keyBadge(_ action: String, leading: Bool = false) -> some View {
        modifier(KeyBadge(action: action, leading: leading))
    }
}
