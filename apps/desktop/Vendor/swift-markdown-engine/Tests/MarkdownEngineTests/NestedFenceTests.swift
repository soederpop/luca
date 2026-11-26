import Foundation
import Testing
@testable import MarkdownEngine

/// A fence closes only on a backtick run at least as long as its opener.
@Suite struct NestedFenceTests {
    private func fenced(_ text: String) -> [String] {
        BlockParser.parse(text).filter {
            if case .fencedCode = $0.kind { return true }
            return false
        }.map { (text as NSString).substring(with: $0.range) }
    }

    @Test func fourBackticksHoldThreeBacktickFences() {
        let inner = "# CRM\n\n```ts\nconst a = 1\n```\n\ntext\n"
        let text = "before\n\n````md\n\(inner)````\n\nafter\n"
        #expect(fenced(text) == ["````md\n\(inner)````\n"])
    }

    @Test func plainFenceStillCloses() {
        let text = "```ts\nconst a = 1\n```\n\nafter\n"
        #expect(fenced(text) == ["```ts\nconst a = 1\n```\n"])
    }

    @Test func longerRunClosesShorterOpener() {
        let text = "```\ncode\n````\nafter\n"
        #expect(fenced(text) == ["```\ncode\n````\n"])
    }

    @Test func tokenCoversTheWholeBlockAndFindsTheLanguage() {
        let text = "````md\n```ts\nx\n```\n````\n"
        let tokens = MarkdownTokenizer.parseTokensViaAST(in: text).filter { $0.kind == .codeBlock }
        #expect(tokens.count == 1)
        #expect(tokens.first?.range == NSRange(location: 0, length: (text as NSString).length - 1))
        #expect(tokens.first.flatMap { MarkdownTokenizer.extractLanguage(from: $0, in: text) } == "md")
    }
}
