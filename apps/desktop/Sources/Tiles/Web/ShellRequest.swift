import Foundation

/// A page asking for a shell element through the `alHost` handler: the
/// palette as a picker, a one-line question, a confirm, a status-line note.
/// The page side is any script that posts to `alHost`.
///
/// The shell knows nothing about what the page picks from. It shows the
/// rows and sends back which one: `al:reply` with `{ id, value }`, where the
/// value is a row index, the typed text, true or false, or null for Esc.
/// Pure, so the parse is tested without a web view.
enum ShellRequest: Equatable {
    struct Choice: Equatable {
        let title: String
        let detail: String
    }

    case choose(id: String, title: String, items: [Choice])
    case ask(id: String, title: String, initial: String)
    case confirm(id: String, question: String, yes: String)
    case flash(String)

    /// What a page may ask for. Seeded into `__AL_HOST__.shell`, so a page
    /// can tell an older app from this one.
    static let names = ["choose", "ask", "confirm", "flash", "open", "keys"]

    static let maxItems = 500
    static let maxText = 300

    init?(_ body: [String: Any]) {
        let text: (String) -> String? = { key in
            (body[key] as? String).map { String($0.prefix(Self.maxText)) }
        }
        switch body["kind"] as? String {
        case "flash":
            guard let line = text("text"), !line.isEmpty else { return nil }
            self = .flash(line)
        case "choose":
            guard let id = text("id"), let raw = body["items"] as? [Any] else { return nil }
            let items: [Choice] = raw.prefix(Self.maxItems).map { item in
                if let title = item as? String { return Choice(title: String(title.prefix(Self.maxText)), detail: "") }
                let row = item as? [String: Any] ?? [:]
                return Choice(title: String(((row["title"] as? String) ?? "").prefix(Self.maxText)),
                              detail: String(((row["detail"] as? String) ?? "").prefix(Self.maxText)))
            }
            guard !items.isEmpty else { return nil }
            self = .choose(id: id, title: text("title") ?? "choose", items: items)
        case "ask":
            guard let id = text("id") else { return nil }
            self = .ask(id: id, title: text("title") ?? "", initial: text("initial") ?? "")
        case "confirm":
            guard let id = text("id"), let question = text("question"), !question.isEmpty else { return nil }
            self = .confirm(id: id, question: question, yes: text("yes") ?? "Yes")
        default:
            return nil
        }
    }

    /// JavaScript that hands the answer to the page.
    static func replyScript(id: String, value: Any?) -> String {
        let detail: [String: Any] = ["id": id, "value": value ?? NSNull()]
        let data = try? JSONSerialization.data(withJSONObject: detail, options: [.sortedKeys])
        let json = data.flatMap { String(data: $0, encoding: .utf8) } ?? "{}"
        return "window.dispatchEvent(new CustomEvent('al:reply',{detail:\(json)}))"
    }
}
