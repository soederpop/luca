import AppKit
import SwiftUI
import JavaScriptCore
import MarkdownUI
import MarkdownEngine

/// What a piece of code is, for coloring. The colors follow the source
/// editor's (`editor/src/main.js`), so a block reads the same in every view.
enum SyntaxRole: UInt8, Sendable {
    case plain, keyword, string, number, comment, property, type, function, heading, muted, added, removed

    /// The role of a token inside these highlight.js scopes, outermost
    /// first. The innermost scope with a role wins; a dotted scope falls
    /// back to its parent (`title.function.invoke` to `title.function`).
    static func of(scopes: [String]) -> SyntaxRole {
        for scope in scopes.reversed() {
            var name = Substring(scope)
            while true {
                if let role = table[String(name)] { return role }
                guard let dot = name.lastIndex(of: ".") else { break }
                name = name[..<dot]
            }
        }
        return .plain
    }

    private static let table: [String: SyntaxRole] = {
        let groups: [(SyntaxRole, [String])] = [
            (.keyword, ["keyword", "doctag", "template-tag", "selector-tag", "variable.language", "meta.keyword"]),
            (.string, ["string", "regexp", "char.escape", "link"]),
            (.number, ["number", "literal", "symbol", "bullet", "variable.constant"]),
            (.comment, ["comment", "quote"]),
            (.property, ["attr", "attribute", "property", "selector-attr", "selector-class", "selector-id", "selector-pseudo", "variable", "template-variable"]),
            (.type, ["type", "title.class", "built_in", "name", "tag"]),
            (.function, ["title", "title.function"]),
            (.heading, ["section", "strong"]),
            (.muted, ["meta", "operator", "punctuation", "code", "formula"]),
            (.added, ["addition"]),
            (.removed, ["deletion"]),
            (.plain, ["subst", "params", "emphasis", "identifier"]),
        ]
        var out: [String: SyntaxRole] = [:]
        for (role, names) in groups { for name in names { out[name] = role } }
        return out
    }()

    func kitColor(_ p: KitPalette) -> KitColor {
        switch self {
        case .plain: return p.textBody
        case .keyword: return p.syntax.keyword
        case .string: return p.syntax.string
        case .number: return p.syntax.number
        case .comment: return p.syntax.comment
        case .property: return p.syntax.property
        case .type: return p.syntax.type
        case .function: return p.syntax.function
        case .heading: return p.text
        case .muted: return p.textMuted
        case .added: return p.good
        case .removed: return p.bad
        }
    }
}

/// highlight.js in JavaScriptCore: code in, colored runs out. One engine for
/// the preview (MarkdownUI) and the rich editor (swift-markdown-engine).
///
/// `Resources/highlight.min.js` is the full 11.11.1 build (every language),
/// the same file swift-markdown-engine ships. The script reads
/// `_emitter.rootNode`, which is private to highlight.js, so the file stays
/// pinned: a build without that tree gives plain text, never wrong colors.
final class CodeHighlighter: @unchecked Sendable {
    static let shared = CodeHighlighter()

    struct Run: Equatable {
        let range: NSRange
        let role: SyntaxRole
    }

    private final class Runs { let runs: [Run]; init(_ runs: [Run]) { self.runs = runs } }

    // A JSContext must not run two scripts at once.
    private let lock = NSLock()
    private var context: JSContext?
    private var tokenize: JSValue?
    private var loaded = false
    private let cache = NSCache<NSString, Runs>()

    init() {
        cache.countLimit = 256
        cache.totalCostLimit = 2_000_000
    }

    /// Load the script off the main thread at launch, so the first code
    /// block does not wait for it.
    func warm() {
        DispatchQueue.global(qos: .utility).async { [self] in
            lock.lock(); load(); lock.unlock()
        }
    }

    /// The colored runs of `code`, in order, covering all of it. Nil when
    /// the fence names no language highlight.js knows: such a block is
    /// often a file tree or program output, and a guessed language colors
    /// it at random.
    func runs(code: String, language: String?) -> [Run]? {
        // The info string's first word is the language (```ts title="x.ts").
        guard let name = language?.split(whereSeparator: \.isWhitespace).first?.lowercased(), !name.isEmpty else { return nil }
        guard code.utf16.count <= 200_000 else { return nil }
        let key = "\(name)|\(code)" as NSString
        if let hit = cache.object(forKey: key) { return hit.runs }

        lock.lock()
        load()
        context?.exception = nil
        let value = tokenize?.call(withArguments: [code, name])
        let failed = context?.exception != nil
        lock.unlock()

        guard !failed, let value, value.isString,
              let data = value.toString().data(using: .utf8),
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let length = object["length"] as? Int, length == code.utf16.count,
              let flat = object["tokens"] as? [Any], flat.count % 3 == 0 else { return nil }

        // Later tokens are narrower (a call inside plain text), so they win.
        var roles = [SyntaxRole](repeating: .plain, count: length)
        var index = 0
        while index < flat.count {
            guard let at = flat[index] as? Int, let count = flat[index + 1] as? Int,
                  let scopes = flat[index + 2] as? String, at >= 0, count >= 0, at + count <= length else { return nil }
            let role = SyntaxRole.of(scopes: scopes.split(separator: " ").map(String.init))
            for i in at..<(at + count) { roles[i] = role }
            index += 3
        }
        var runs: [Run] = []
        var start = 0
        while start < length {
            var end = start + 1
            while end < length, roles[end] == roles[start] { end += 1 }
            runs.append(Run(range: NSRange(location: start, length: end - start), role: roles[start]))
            start = end
        }
        cache.setObject(Runs(runs), forKey: key, cost: length)
        return runs
    }

    /// Call with the lock held.
    private func load() {
        guard !loaded else { return }
        loaded = true
        guard let url = Self.scriptURL, let source = try? String(contentsOf: url, encoding: .utf8),
              let context = JSContext() else { return }
        context.evaluateScript(source)
        context.evaluateScript(Self.tokenizeScript)
        guard context.exception == nil, let fn = context.objectForKeyedSubscript("__tilesTokenize"), fn.isObject else { return }
        self.context = context
        self.tokenize = fn
    }

    /// In the app bundle, else next to the sources (a debug build or a test).
    static var scriptURL: URL? {
        if let url = Bundle.main.url(forResource: "highlight.min", withExtension: "js") { return url }
        let local = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent().deletingLastPathComponent()
            .deletingLastPathComponent().deletingLastPathComponent()
            .appendingPathComponent("Resources/highlight.min.js")
        return FileManager.default.fileExists(atPath: local.path) ? local : nil
    }

    // Walks the token tree highlight.js builds its HTML from. The leaves
    // are the source text, so offsets are UTF-16 offsets into `code`.
    // highlight.js leaves most names and calls unscoped; in programming
    // languages the plain text is lexed for calls, members, operators and
    // punctuation. Data, markup and shell text is left as it is.
    private static let tokenizeScript = #"""
    var __tilesCode = ["python", "javascript", "typescript", "swift", "go", "rust", "java", "kotlin",
      "c", "cpp", "csharp", "objectivec", "ruby", "php", "scala", "dart", "lua", "elixir"]
      .map(function (n) { return hljs.getLanguage(n); }).filter(Boolean);
    var __tilesTokenize = function (code, language) {
      if (!hljs.getLanguage(language)) { return null; }
      var result = hljs.highlight(code, { language: language, ignoreIllegals: true });
      var root = result._emitter && result._emitter.rootNode;
      if (!root) { return null; }
      var tokens = [], position = 0;
      var isCode = function (n) { return __tilesCode.indexOf(hljs.getLanguage(n)) !== -1; };
      var isPlain = function (scopes) {
        for (var i = scopes.length - 1; i >= 0; i--) {
          if (scopes[i] === "subst") { return true; }
          if (scopes[i] !== "params" && scopes[i] !== "function" && scopes[i] !== "class") { return false; }
        }
        return true;
      };
      var lexeme = /([A-Za-z_$][A-Za-z0-9_$]*)|(=>|->|::|[-+*\/%&|^~!<>=?]+)|([()[\]{},;:.])/g;
      var lex = function (text, start, scopes) {
        lexeme.lastIndex = 0;
        var m;
        while ((m = lexeme.exec(text)) !== null) {
          var at = start + m.index;
          var scope = m[3] ? "punctuation" : m[2] ? "operator" : null;
          if (!scope) {
            var after = at + m[1].length;
            while (code[after] === " ") { after++; }
            scope = code[after] === "(" ? "title.function.invoke" : code[at - 1] === "." ? "property" : "identifier";
          }
          tokens.push(at, m[0].length, scopes.concat([scope]).join(" "));
        }
      };
      var walk = function (node, scopes, lexes) {
        for (var i = 0; i < node.children.length; i++) {
          var child = node.children[i];
          if (typeof child === "string") {
            if (child.length > 0) {
              if (scopes.length > 0) { tokens.push(position, child.length, scopes.join(" ")); }
              if (lexes && isPlain(scopes)) { lex(child, position, scopes); }
            }
            position += child.length;
          } else if (child.scope && child.scope.indexOf("language:") === 0) {
            walk(child, scopes, isCode(child.scope.slice(9)));
          } else {
            walk(child, child.scope ? scopes.concat([child.scope]) : scopes, lexes);
          }
        }
      };
      walk(root, [], isCode(result.language || language));
      return JSON.stringify({ length: position, tokens: tokens });
    };
    """#
}

// MARK: - Preview (MarkdownUI)

/// Code blocks in the preview, chats and item bodies. It carries the palette
/// so a `:set light` or a `:theme` gives new colors on the next draw.
struct TilesCodeSyntaxHighlighter: CodeSyntaxHighlighter {
    let palette: KitPalette

    func highlightCode(_ code: String, language: String?) -> Text {
        guard let runs = CodeHighlighter.shared.runs(code: code, language: language) else { return Text(code) }
        let source = code as NSString
        var out = AttributedString()
        for run in runs {
            var piece = AttributedString(source.substring(with: run.range))
            piece.foregroundColor = run.role.kitColor(palette).color
            if run.role == .comment { piece.inlinePresentationIntent = .emphasized }
            if run.role == .heading { piece.inlinePresentationIntent = .stronglyEmphasized }
            out.append(piece)
        }
        return Text(out)
    }
}

// MARK: - Rich editor (swift-markdown-engine)

extension Notification.Name {
    /// Posted when the app's colors change (a scheme or a theme). The rich editor drops its cached
    /// code colors on it.
    static let tilesSchemeChanged = Notification.Name("TilesSchemeChanged")
}

struct TilesEditorSyntaxHighlighter: SyntaxHighlighter {
    func codeFont(size: CGFloat) -> NSFont { .monospacedSystemFont(ofSize: size, weight: .regular) }

    func backgroundColor() -> NSColor { RichEditorTheme.ns(Theme.palette.inset) }

    func highlight(code: String, language: String?) -> NSAttributedString? {
        guard let runs = CodeHighlighter.shared.runs(code: code, language: language) else { return nil }
        let palette = Theme.palette
        let out = NSMutableAttributedString(string: code, attributes: [.foregroundColor: RichEditorTheme.ns(palette.textBody)])
        for run in runs where run.role != .plain {
            out.addAttribute(.foregroundColor, value: RichEditorTheme.ns(run.role.kitColor(palette)), range: run.range)
        }
        return out
    }

    var appearanceDidChangeNotification: Notification.Name? { .tilesSchemeChanged }
}
