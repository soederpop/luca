import Foundation

/// What the console shows about the code being typed: the completion list,
/// the call the caret is in, and the docs in focus. The host decides what
/// there is to show; this decides what is on screen. Pure, so it is tested.
struct ConsoleAssist: Equatable {
    private(set) var completion: WorkbenchCompletion?
    /// True while the completion list is on screen.
    private(set) var open = false
    private(set) var selection = 0

    var items: [WorkbenchCompletion.Item] { completion?.items ?? [] }
    var selected: WorkbenchCompletion.Item? { open && items.indices.contains(selection) ? items[selection] : nil }
    var signature: WorkbenchCompletion.Signature? { completion?.signature }

    /// The docs to show beside the input: the item picked in the list, else
    /// the call the caret is in, else the name the caret is on.
    var focusDoc: WorkbenchDocCard? {
        selected?.doc ?? signature?.doc ?? completion?.hover
    }

    /// The letters typed so far of the name being completed.
    func prefix(in text: String, caret: Int) -> String {
        guard let completion, completion.from <= caret else { return "" }
        let ns = text as NSString
        guard caret <= ns.length else { return "" }
        return ns.substring(with: NSRange(location: completion.from, length: caret - completion.from))
    }

    /// A new answer from the host. `show` says the list may open: the user
    /// just typed part of a name, or asked for it.
    mutating func apply(_ completion: WorkbenchCompletion, show: Bool) {
        self.completion = completion
        open = show && !completion.items.isEmpty
        // Typing narrows the list: the best match is the first one.
        selection = 0
    }

    mutating func close() {
        open = false
        selection = 0
    }

    mutating func clear() {
        completion = nil
        close()
    }

    /// Down and up in the list. They wrap.
    mutating func move(_ delta: Int) {
        guard open, !items.isEmpty else { return }
        selection = (selection + delta + items.count) % items.count
    }

    mutating func select(_ index: Int) {
        if open, items.indices.contains(index) { selection = index }
    }

    /// Take the picked item: the new text and where the caret goes. Offsets
    /// are UTF-16, as the host's are.
    func accept(in text: String) -> (text: String, caret: Int)? {
        guard let completion, let item = selected else { return nil }
        let ns = text as NSString
        guard completion.from >= 0, completion.from <= completion.to, completion.to <= ns.length else { return nil }
        let out = ns.replacingCharacters(in: NSRange(location: completion.from, length: completion.to - completion.from), with: item.insert)
        return (out, completion.from + (item.insert as NSString).length)
    }

    /// True when a key just typed may open the list: part of a name, a dot,
    /// or the quote that starts a helper id.
    static func opens(after text: String, caret: Int) -> Bool {
        let ns = text as NSString
        guard caret > 0, caret <= ns.length else { return false }
        let ch = ns.substring(with: NSRange(location: caret - 1, length: 1))
        guard let scalar = ch.unicodeScalars.first else { return false }
        if CharacterSet.alphanumerics.contains(scalar) || ch == "_" || ch == "$" || ch == "." { return true }
        if ch == "'" || ch == "\"" {
            // Only the opening quote of `feature('`, `client("`, `server('`.
            let before = ns.substring(to: caret - 1)
            return before.hasSuffix("feature(") || before.hasSuffix("client(") || before.hasSuffix("server(")
        }
        return false
    }
}

/// What `Enter` and a new line do in the console's input.
enum ConsoleSyntax {
    /// False while a bracket, a quote or a template is still open, so
    /// `Enter` adds a line instead of running half an expression.
    static func isComplete(_ code: String) -> Bool {
        var stack: [Character] = []
        var quote: Character?
        var lineComment = false
        var blockComment = false
        var previous: Character = " "
        let pairs: [Character: Character] = [")": "(", "]": "[", "}": "{"]
        var escaped = false
        // The code alone, comments left out and a string as one quote, for the last-character test.
        var bare = ""
        for ch in code {
            defer { previous = ch }
            if lineComment { if ch == "\n" { lineComment = false; bare.append(ch) }; continue }
            if blockComment { if previous == "*", ch == "/" { blockComment = false }; continue }
            if let q = quote {
                if escaped { escaped = false; continue }
                if ch == "\\" { escaped = true; continue }
                if ch == q { quote = nil }
                // A plain string ends at the line's end; the syntax error is the host's to report.
                else if ch == "\n", q != "`" { quote = nil }
                continue
            }
            if previous == "/", ch == "/" { lineComment = true; bare.removeLast(); continue }
            if previous == "/", ch == "*" { blockComment = true; bare.removeLast(); continue }
            bare.append(ch)
            if ch == "\"" || ch == "'" || ch == "`" { quote = ch; continue }
            if ch == "(" || ch == "[" || ch == "{" { stack.append(ch); continue }
            if let open = pairs[ch] {
                // A stray closer: let the host say what is wrong.
                guard stack.last == open else { return true }
                stack.removeLast()
            }
        }
        if blockComment || quote == "`" { return false }
        if !stack.isEmpty { return false }
        // A line that ends in an operator or a dot goes on.
        let trimmed = bare.trimmingCharacters(in: .whitespacesAndNewlines)
        if let last = trimmed.last, ".,=+-*&|".contains(last), !trimmed.hasSuffix("++"), !trimmed.hasSuffix("--") { return false }
        if trimmed.hasSuffix("=>") { return false }
        return true
    }

    /// The spaces a new line starts with: the line's own, two more after an
    /// opening bracket.
    static func indent(after text: String, caret: Int) -> String {
        let ns = text as NSString
        let head = ns.substring(to: min(max(caret, 0), ns.length))
        let line = head.split(separator: "\n", omittingEmptySubsequences: false).last.map(String.init) ?? ""
        var indent = String(line.prefix { $0 == " " || $0 == "\t" })
        if let last = line.trimmingCharacters(in: .whitespaces).last, "{[(".contains(last) { indent += "  " }
        return indent
    }
}
