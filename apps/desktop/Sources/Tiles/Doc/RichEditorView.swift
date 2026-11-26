import SwiftUI
import AppKit
import MarkdownEngine

/// The engine's look, from the kit tokens.
enum RichEditorTheme {
    static func ns(_ c: KitColor, alpha: Double? = nil) -> NSColor {
        NSColor(srgbRed: c.red, green: c.green, blue: c.blue, alpha: alpha ?? c.alpha)
    }

    @MainActor static var configuration: MarkdownEditorConfiguration {
        let p = Theme.palette
        var config = MarkdownEditorConfiguration.default
        config.theme = MarkdownEditorTheme(
            bodyText: ns(p.textBody),
            mutedText: ns(p.textMuted),
            disabledText: ns(p.textFaint),
            headingMarker: ns(p.textFaint),
            link: ns(p.accent),
            incompleteLink: ns(p.info),
            findMatchHighlight: ns(p.warn, alpha: 0.35),
            findCurrentMatchHighlight: ns(p.warn, alpha: 0.65),
            latexLightModeText: ns(p.text),
            latexDarkModeText: ns(p.text),
            strikethroughColor: ns(p.textMuted),
            highlightColor: ns(p.accentSoft)
        )
        config.services.syntaxHighlighter = TilesEditorSyntaxHighlighter()
        config.codeBlock = CodeBlockStyle(fontSizeScale: 0.86, paragraphSpacing: 4, horizontalIndent: KitTokens.Space.s5)
        config.inlineCode = InlineCodeStyle(fontSizeScale: 0.88)
        // The preview's column, so a doc does not reflow between views.
        config.readingWidth = 820
        config.textInsets = TextInsets(horizontal: KitTokens.Space.s7, vertical: KitTokens.Space.s6)
        config.scrollers = .vertical
        // Typed text is what lands on disk: no smart quotes or autocorrect.
        config.spellChecking = SpellCheckingPolicy(
            continuousSpellChecking: false,
            grammarChecking: false,
            automaticSpellingCorrection: false,
            automaticQuoteSubstitution: false
        )
        return config
    }
}
