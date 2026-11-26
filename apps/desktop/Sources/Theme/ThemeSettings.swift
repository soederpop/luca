import AppKit
import Combine

/// The app's colors. With no named theme: the scheme, `dark` (the default),
/// `light`, or `system` to follow macOS (`:set dark|light|system`). A named
/// theme (`:theme monokai`, `Space T`) is one whole palette with its own
/// scheme, and wins until `:theme default` or a `:set`. Web tiles get the
/// colors through the host bridge with no reload; native tiles redraw.
@MainActor
final class ThemeSettings: ObservableObject {
    static let shared = ThemeSettings()

    enum Scheme: String { case dark, light, system }

    private static let key = "tiles.scheme"
    private static let themeKey = "tiles.theme"

    @Published private(set) var scheme: Scheme
    /// The named theme in use, or nil for the default look.
    @Published private(set) var themeId: String?
    /// The scheme in effect: the theme's own, or `system` read from macOS.
    @Published private(set) var isDark = true
    /// Goes up each time the colors change. Views that read the palette when
    /// they draw use it as their identity, so they redraw.
    @Published private(set) var revision = 0

    /// `Theme.palette` reads these from anywhere; they always match the
    /// published values.
    nonisolated(unsafe) static var currentDark = true
    nonisolated(unsafe) static var currentPalette = KitTokens.dark

    var theme: KitTheme? { themeId.flatMap { id in KitTokens.themes.first { $0.id == id } } }
    /// The name to show: the theme's, or the scheme.
    var themeLabel: String { theme?.label ?? "Default \(scheme.rawValue)" }

    private var appearanceWatch: NSKeyValueObservation?

    private init() {
        scheme = UserDefaults.standard.string(forKey: Self.key).flatMap(Scheme.init(rawValue:)) ?? .dark
        // A theme a later build no longer has falls back to the default.
        themeId = UserDefaults.standard.string(forKey: Self.themeKey).flatMap { id in KitTokens.themes.contains { $0.id == id } ? id : nil }
        update()
        appearanceWatch = NSApplication.shared.observe(\.effectiveAppearance) { _, _ in
            Task { @MainActor in ThemeSettings.shared.update() }
        }
    }

    /// A scheme is the default look, so it also leaves a named theme.
    func set(_ next: Scheme) {
        scheme = next
        UserDefaults.standard.set(next.rawValue, forKey: Self.key)
        setTheme(nil)
    }

    /// A named theme, or nil for the default look. False for an unknown name.
    @discardableResult
    func setTheme(_ id: String?) -> Bool {
        if let id, !KitTokens.themes.contains(where: { $0.id == id }) { return false }
        themeId = id
        UserDefaults.standard.set(id, forKey: Self.themeKey)
        update()
        return true
    }

    private func update() {
        let dark: Bool
        if let theme {
            dark = theme.dark
        } else {
            switch scheme {
            case .dark: dark = true
            case .light: dark = false
            case .system: dark = NSApplication.shared.effectiveAppearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua
            }
        }
        let palette = theme?.palette ?? KitTokens.palette(dark: dark)
        guard palette != Self.currentPalette || dark != isDark else { return }
        Self.currentDark = dark
        Self.currentPalette = palette
        isDark = dark
        revision += 1
        NotificationCenter.default.post(name: .tilesSchemeChanged, object: nil)
    }

    /// The live values a web page gets as `window.__AL_HOST__`: scheme,
    /// theme name, accent, text size and every color as `--al-*`, so the app
    /// wins over any `kit.css` the page loads. This is how a named theme
    /// reaches a page: `kit.css` holds only the default colors.
    func hostTheme() -> [String: Any] {
        let p = Self.currentPalette
        var vars: [String: String] = [
            "--al-ground": p.ground.hex, "--al-surface": p.surface.hex, "--al-raised": p.raised.hex,
            "--al-inset": p.inset.hex, "--al-border": p.border.hex, "--al-border-strong": p.borderStrong.hex,
            "--al-text": p.text.hex, "--al-text-body": p.textBody.hex, "--al-text-muted": p.textMuted.hex,
            "--al-text-faint": p.textFaint.hex, "--al-accent": p.accent.hex, "--al-accent-on": p.accentOn.hex,
            "--al-accent-soft": p.accentSoft.hex, "--al-good": p.good.hex, "--al-warn": p.warn.hex,
            "--al-bad": p.bad.hex, "--al-info": p.info.hex, "--al-idle": p.idle.hex,
            "--al-text-xs": "\(Int(KitTokens.TypeScale.xs))px", "--al-text-sm": "\(Int(KitTokens.TypeScale.sm))px",
            "--al-text-base": "\(Int(KitTokens.TypeScale.base))px", "--al-text-md": "\(Int(KitTokens.TypeScale.md))px",
            "--al-text-lg": "\(Int(KitTokens.TypeScale.lg))px", "--al-text-xl": "\(Int(KitTokens.TypeScale.xl))px",
            "--al-text-2xl": "\(Int(KitTokens.TypeScale.xxl))px", "--al-text-3xl": "\(Int(KitTokens.TypeScale.xxxl))px",
        ]
        for (index, color) in p.hues.enumerated() { vars["--al-hue-\(index + 1)"] = color.hex }
        let s = p.syntax
        for (name, color) in [("keyword", s.keyword), ("string", s.string), ("number", s.number), ("comment", s.comment),
                              ("property", s.property), ("type", s.type), ("function", s.function)] {
            vars["--al-syntax-\(name)"] = color.hex
        }
        vars["--al-shadow"] = p.shadow.hex
        return [
            "scheme": isDark ? "dark" : "light",
            "theme": themeId ?? "default",
            "accent": p.accent.hex,
            "textSize": Int(KitTokens.TypeScale.base),
            "vars": vars,
        ]
    }
}
