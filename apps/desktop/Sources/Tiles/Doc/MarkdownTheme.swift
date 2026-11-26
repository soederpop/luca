import SwiftUI
import MarkdownUI

extension View {
    /// The app's look for a `Markdown` view: the kit theme and colored code.
    /// Use this, not `markdownTheme` alone, so every tile reads the same.
    @MainActor func tilesMarkdown() -> some View {
        self.markdownTheme(.tiles)
            .markdownCodeSyntaxHighlighter(TilesCodeSyntaxHighlighter(palette: Theme.palette))
    }
}

extension MarkdownUI.Theme {
    /// Markdown in the kit's colors. Document text is proportional.
    /// Computed on each draw, so it follows `:set dark|light` and `:theme`. Every color
    /// comes from the palette: the GitHub theme's own colors follow macOS,
    /// not the app scheme.
    @MainActor static var tiles: MarkdownUI.Theme {
        let p = Theme.palette
        let rule = p.borderStrong.color
        return MarkdownUI.Theme()
            .text {
                ForegroundColor(p.textBody.color)
                BackgroundColor(nil)
                FontSize(KitTokens.TypeScale.md)
            }
            .strong { FontWeight(.semibold); ForegroundColor(p.text.color) }
            .emphasis { FontStyle(.italic) }
            .strikethrough { StrikethroughStyle(.single); ForegroundColor(p.textFaint.color) }
            .link { ForegroundColor(p.accent.color); UnderlineStyle(.init(pattern: .dot)) }
            .code {
                FontFamilyVariant(.monospaced)
                FontSize(.em(0.88))
                ForegroundColor(p.syntax.string.color)
                BackgroundColor(p.raised.color)
            }
            .heading1 { configuration in
                VStack(alignment: .leading, spacing: 0) {
                    configuration.label
                        .relativePadding(.bottom, length: .em(0.25))
                        .relativeLineSpacing(.em(0.1))
                        .markdownTextStyle { FontWeight(.bold); FontSize(.em(1.7)); ForegroundColor(p.accent.color) }
                    Rectangle().fill(rule).frame(height: 1)
                }
                .markdownMargin(top: 8, bottom: 16)
            }
            .heading2 { configuration in
                VStack(alignment: .leading, spacing: 0) {
                    configuration.label
                        .relativePadding(.bottom, length: .em(0.25))
                        .relativeLineSpacing(.em(0.1))
                        .markdownTextStyle { FontWeight(.semibold); FontSize(.em(1.35)); ForegroundColor(p.syntax.function.color) }
                    Rectangle().fill(p.border.color).frame(height: 1)
                }
                .markdownMargin(top: 28, bottom: 14)
            }
            .heading3 { configuration in
                configuration.label
                    .relativeLineSpacing(.em(0.1))
                    .markdownMargin(top: 22, bottom: 10)
                    .markdownTextStyle { FontWeight(.semibold); FontSize(.em(1.14)); ForegroundColor(p.syntax.type.color) }
            }
            .heading4 { configuration in
                configuration.label
                    .markdownMargin(top: 18, bottom: 8)
                    .markdownTextStyle { FontWeight(.semibold); ForegroundColor(p.text.color) }
            }
            .heading5 { configuration in
                configuration.label
                    .markdownMargin(top: 16, bottom: 8)
                    .markdownTextStyle { FontWeight(.semibold); FontSize(.em(0.9)); ForegroundColor(p.textMuted.color) }
            }
            .heading6 { configuration in
                configuration.label
                    .markdownMargin(top: 16, bottom: 8)
                    .markdownTextStyle { FontWeight(.semibold); FontSize(.em(0.9)); ForegroundColor(p.textFaint.color) }
            }
            .paragraph { configuration in
                configuration.label
                    .fixedSize(horizontal: false, vertical: true)
                    .relativeLineSpacing(.em(0.28))
                    .markdownMargin(top: 0, bottom: 14)
            }
            .blockquote { configuration in
                HStack(spacing: 0) {
                    RoundedRectangle(cornerRadius: 2)
                        .fill(p.accent.color)
                        .frame(width: 3)
                    configuration.label
                        .markdownTextStyle { ForegroundColor(p.textMuted.color) }
                        .relativePadding(.horizontal, length: .em(0.9))
                        .padding(.vertical, KitTokens.Space.s3)
                }
                .fixedSize(horizontal: false, vertical: true)
                .background(p.accentSoft.color.opacity(0.35))
                .clipShape(RoundedRectangle(cornerRadius: KitTokens.Radius.sm))
                .markdownMargin(top: 0, bottom: 14)
            }
            .codeBlock { configuration in
                CodeBlockView(configuration: configuration, palette: p)
                    .markdownMargin(top: 0, bottom: 14)
            }
            .listItem { configuration in
                configuration.label.markdownMargin(top: .em(0.3))
            }
            .taskListMarker { configuration in
                Image(systemName: configuration.isCompleted ? "checkmark.square.fill" : "square")
                    .foregroundStyle(configuration.isCompleted ? p.accent.color : p.textFaint.color)
                    .imageScale(.small)
                    .relativeFrame(minWidth: .em(1.5), alignment: .trailing)
            }
            .table { configuration in
                configuration.label
                    .fixedSize(horizontal: false, vertical: true)
                    .markdownTableBorderStyle(.init(color: rule))
                    .markdownTableBackgroundStyle(.alternatingRows(p.surface.color, p.inset.color, header: p.raised.color))
                    .markdownMargin(top: 0, bottom: 14)
            }
            .tableCell { configuration in
                configuration.label
                    .markdownTextStyle {
                        if configuration.row == 0 {
                            FontWeight(.semibold)
                            ForegroundColor(p.text.color)
                        }
                        FontSize(.em(0.92))
                        BackgroundColor(nil)
                    }
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.vertical, KitTokens.Space.s3)
                    .padding(.horizontal, KitTokens.Space.s5)
                    .relativeLineSpacing(.em(0.2))
            }
            .thematicBreak {
                Rectangle().fill(rule).frame(height: 1)
                    .markdownMargin(top: 22, bottom: 22)
            }
            .image { configuration in
                configuration.label
                    .clipShape(RoundedRectangle(cornerRadius: KitTokens.Radius.md))
                    .markdownMargin(top: 0, bottom: 14)
            }
    }
}

/// A fenced block: the language on top when the fence names one, then the
/// code. Long lines scroll sideways instead of wrapping.
private struct CodeBlockView: View {
    let configuration: CodeBlockConfiguration
    let palette: KitPalette

    private var language: String? {
        configuration.language?.split(whereSeparator: \.isWhitespace).first.map(String.init)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if let language, !language.isEmpty {
                Text(language.lowercased())
                    .font(Theme.chrome(KitTokens.TypeScale.xs * 0.8, weight: .medium))
                    .foregroundStyle(palette.textFaint.color)
                    .padding(.horizontal, KitTokens.Space.s5)
                    .padding(.vertical, KitTokens.Space.s2)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(palette.raised.color.opacity(0.55))
                Rectangle().fill(palette.border.color).frame(height: 1)
            }
            ScrollView(.horizontal) {
                configuration.label
                    .fixedSize(horizontal: false, vertical: true)
                    .relativeLineSpacing(.em(0.22))
                    .markdownTextStyle {
                        FontFamilyVariant(.monospaced)
                        FontSize(.em(0.86))
                        ForegroundColor(palette.textBody.color)
                        BackgroundColor(nil)
                    }
                    .padding(KitTokens.Space.s5)
            }
        }
        .background(palette.inset.color)
        .clipShape(RoundedRectangle(cornerRadius: KitTokens.Radius.md))
        .overlay(RoundedRectangle(cornerRadius: KitTokens.Radius.md).strokeBorder(palette.border.color, lineWidth: 1))
    }
}
