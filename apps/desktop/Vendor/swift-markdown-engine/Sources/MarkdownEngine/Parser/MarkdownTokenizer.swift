//
//  MarkdownTokenizer.swift
//  MarkdownEngine
//
//  Created by Luca Chen on 18.02.26.
//

// The token namespace. Tokens are produced by `parseTokensViaAST`
// (`BlockScopedTokenizer`): block structure + block-level tokens come from
// `BlockParser` + `BlockLevelTokenizer` (hand scanners, no regex), inline
// tokens from the AST (`InlineParser` → `InlineASTAdapter`). This file keeps
// only the code-block language helper.
import Foundation

// MARK: - Tokenizer
enum MarkdownTokenizer {

    // MARK: - Code Block Helpers

    static func extractLanguage(from token: MarkdownToken, in text: String) -> String? {
        guard token.kind == .codeBlock,
              let openingMarker = token.markerRanges.first,
              openingMarker.length > 4 else { return nil }

        let nsText = text as NSString
        guard NSMaxRange(openingMarker) <= nsText.length else { return nil }
        // The opening run can be longer than three backticks.
        var run = 0
        while run < openingMarker.length, nsText.character(at: openingMarker.location + run) == 0x60 { run += 1 }
        let langRange = NSRange(location: openingMarker.location + run, length: max(0, openingMarker.length - run - 1))

        let langString = nsText.substring(with: langRange).trimmingCharacters(in: .whitespacesAndNewlines)
        return langString.isEmpty ? nil : langString
    }
}
