import Foundation

/// A document file cut in two: the frontmatter block and the body. Text
/// only: the app never reads or writes the YAML inside the block.
///
/// `frontmatter + body` is always the file again, byte for byte. The cut is
/// where contentbase puts it: the body starts after the closing `---` line
/// and any blank lines after it, which is a document's `content` with
/// leading newlines removed.
struct DocText: Equatable {
    var frontmatter: String
    var body: String

    var joined: String { frontmatter + body }

    init(frontmatter: String, body: String) {
        self.frontmatter = frontmatter
        self.body = body
    }

    init(splitting raw: String) {
        let cut = Self.bodyStart(raw)
        frontmatter = String(raw.utf8[..<cut])!
        body = String(raw.utf8[cut...])!
    }

    /// The same file with a new body. The frontmatter text is kept as is.
    func with(body: String) -> DocText {
        DocText(frontmatter: frontmatter, body: body)
    }

    /// Where the body starts. Works on UTF-8 so a cut never lands inside a
    /// character, and `\r\n` files cut the same as `\n` ones.
    private static func bodyStart(_ raw: String) -> String.UTF8View.Index {
        let bytes = raw.utf8
        let start = bytes.startIndex
        guard let first = lineEnd(bytes, from: start),
              String(bytes[start..<first.content]) == "---" else { return start }
        var cursor = first.next
        while cursor < bytes.endIndex {
            guard let line = lineEnd(bytes, from: cursor) else { break }
            if String(bytes[cursor..<line.content]) == "---" {
                var after = line.next
                // Blank lines between the block and the body belong to the block.
                while after < bytes.endIndex {
                    let byte = bytes[after]
                    if byte == UInt8(ascii: "\n") { after = bytes.index(after: after); continue }
                    if byte == UInt8(ascii: "\r"), bytes.index(after: after) < bytes.endIndex,
                       bytes[bytes.index(after: after)] == UInt8(ascii: "\n") {
                        after = bytes.index(after, offsetBy: 2)
                        continue
                    }
                    break
                }
                return after
            }
            cursor = line.next
        }
        // An opening `---` with no closing one is all body.
        return start
    }

    /// End of the line at `from`: where its text stops (before `\r\n` or
    /// `\n`) and where the next line starts. Nil at the end of the text.
    private static func lineEnd(_ bytes: String.UTF8View, from: String.UTF8View.Index) -> (content: String.UTF8View.Index, next: String.UTF8View.Index)? {
        guard from < bytes.endIndex else { return nil }
        var index = from
        while index < bytes.endIndex {
            if bytes[index] == UInt8(ascii: "\n") {
                var content = index
                if content > from, bytes[bytes.index(before: content)] == UInt8(ascii: "\r") {
                    content = bytes.index(before: content)
                }
                return (content, bytes.index(after: index))
            }
            index = bytes.index(after: index)
        }
        return (bytes.endIndex, bytes.endIndex)
    }
}

/// A line diff between two texts, for the conflict view ("mine" against
/// "theirs"). Plain LCS: docs are small enough.
enum LineDiff {
    enum Line: Equatable {
        case same(String)
        case removed(String)
        case added(String)
    }

    static func lines(_ old: String, _ new: String) -> [Line] {
        let a = old.components(separatedBy: "\n")
        let b = new.components(separatedBy: "\n")
        // Trim the shared start and end first; most edits are small.
        var head = 0
        while head < a.count, head < b.count, a[head] == b[head] { head += 1 }
        var tail = 0
        while tail < a.count - head, tail < b.count - head, a[a.count - 1 - tail] == b[b.count - 1 - tail] { tail += 1 }
        let midA = Array(a[head..<(a.count - tail)])
        let midB = Array(b[head..<(b.count - tail)])

        var table = Array(repeating: Array(repeating: 0, count: midB.count + 1), count: midA.count + 1)
        if !midA.isEmpty && !midB.isEmpty {
            for i in stride(from: midA.count - 1, through: 0, by: -1) {
                for j in stride(from: midB.count - 1, through: 0, by: -1) {
                    table[i][j] = midA[i] == midB[j] ? table[i + 1][j + 1] + 1 : max(table[i + 1][j], table[i][j + 1])
                }
            }
        }
        var out = a[..<head].map(Line.same)
        var i = 0, j = 0
        while i < midA.count || j < midB.count {
            if i < midA.count, j < midB.count, midA[i] == midB[j] {
                out.append(.same(midA[i])); i += 1; j += 1
            } else if j < midB.count, i == midA.count || table[i][j + 1] >= table[i + 1][j] {
                out.append(.added(midB[j])); j += 1
            } else {
                out.append(.removed(midA[i])); i += 1
            }
        }
        out += a[(a.count - tail)...].map(Line.same)
        return out
    }

    /// Unified-style text: changed lines with three lines of context.
    static func unified(_ old: String, _ new: String, context: Int = 3) -> String {
        let all = lines(old, new)
        let changed = all.indices.filter { if case .same = all[$0] { return false }; return true }
        guard !changed.isEmpty else { return "" }
        var keep = Set<Int>()
        for index in changed {
            for k in max(0, index - context)...min(all.count - 1, index + context) { keep.insert(k) }
        }
        var out: [String] = []
        var last = -1
        for index in keep.sorted() {
            if last >= 0, index > last + 1 { out.append("…") }
            switch all[index] {
            case .same(let text): out.append("  " + text)
            case .removed(let text): out.append("- " + text)
            case .added(let text): out.append("+ " + text)
            }
            last = index
        }
        return out.joined(separator: "\n")
    }
}
