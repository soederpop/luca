import SwiftUI

/// Looks shared by the console and command tiles: prose in the UI font,
/// code and values in the code font, colors with a meaning, and cards with
/// a soft background. Every color is a theme kit token.
@MainActor
enum WorkbenchStyle {
    /// Labels, titles, notes.
    static func ui(_ size: CGFloat = KitTokens.TypeScale.sm, weight: Font.Weight = .regular) -> Font {
        .system(size: size, weight: weight)
    }

    /// Code, paths, values.
    static func code(_ size: CGFloat = KitTokens.TypeScale.sm, weight: Font.Weight = .regular) -> Font {
        Theme.chrome(size, weight: weight)
    }

    // MARK: Type roles

    /// A tile's title: the helper's name, the project's name.
    static var title: Font { ui(KitTokens.TypeScale.xxl, weight: .semibold) }
    /// A card's or a row's name.
    static var heading: Font { ui(KitTokens.TypeScale.md, weight: .semibold) }
    /// Prose: descriptions, summaries, notes.
    static var body: Font { ui(KitTokens.TypeScale.sm) }
    /// The quiet line under a name.
    static var meta: Font { ui(KitTokens.TypeScale.xs) }
    /// Small labels: count pills, stack headers, group words. Smaller than
    /// the kit's smallest step on purpose: they label, they are not read.
    static func caption(weight: Font.Weight = .semibold) -> Font { ui(Size.caption, weight: weight) }

    // MARK: Space

    /// The spacing scale every workbench tile uses. Kit steps, named by role.
    enum Gap {
        /// Around a tile's content.
        static let page: CGFloat = KitTokens.Space.s8
        /// Between sections.
        static let section: CGFloat = KitTokens.Space.s8
        /// Inside a card, and between a section title and its content.
        static let card: CGFloat = KitTokens.Space.s6
        /// Between rows in a list.
        static let row: CGFloat = KitTokens.Space.s5
        /// Between things on one line.
        static let inline: CGFloat = KitTokens.Space.s4
        /// Between a name and its quiet line.
        static let tight: CGFloat = KitTokens.Space.s2
    }

    /// App-level sizes the kit has no token for.
    enum Size {
        static let caption: CGFloat = 15
        /// Content wider than this reads badly: center it in a wide tile.
        static let readable: CGFloat = 980
        /// One card stack alone never stretches wider than this.
        static let stackMax: CGFloat = 520
        /// A glyph tile beside a name.
        static let glyph: CGFloat = 34
    }

    // MARK: Color roles

    /// The color of a kind of thing, one hue each, used for its glyph, its
    /// stack header, its card accent and the title mark of its tile:
    /// features, clients, servers, commands, endpoints, assistants,
    /// selectors, docs. All theme colors, so every theme keeps them apart.
    static func thingColor(_ thing: String) -> Color {
        let key: String
        switch thing {
        case "features", "feature": key = "features"
        case "clients", "client": key = "clients"
        case "servers", "server": key = "servers"
        case "commands", "command": key = "commands"
        case "endpoints", "endpoint", "request", "tools", "tool": key = "endpoints"
        case "assistants", "assistant", "chat": key = "assistants"
        case "selectors", "selector": key = "selectors"
        case "docs", "doc", "models", "contentbase": key = "docs"
        case "plugins", "plugin": return Theme.palette.syntax.type.color
        default: return Theme.palette.textMuted.color
        }
        return thingColors()[key]?.color ?? Theme.palette.textMuted.color
    }

    /// Each kind of thing's color in this theme. Each kind asks for a
    /// theme hue first; some themes share one hue between two code roles
    /// (Dracula's functions and properties), so a kind whose hue is taken
    /// gets the next free one. The order is fixed, so a kind keeps its color.
    private static var thingCache: (KitPalette, [String: KitColor])?
    private static func thingColors() -> [String: KitColor] {
        let p = Theme.palette
        if let cache = thingCache, cache.0 == p { return cache.1 }
        let s = p.syntax
        let hues = p.hues
        func hue(_ i: Int) -> KitColor? { hues.indices.contains(i) ? hues[i] : nil }
        let wants: [(String, KitColor?)] = [
            ("features", s.function), ("clients", s.property), ("servers", s.type), ("commands", s.string),
            ("endpoints", s.keyword), ("assistants", hue(3)), ("selectors", s.number), ("docs", hue(7)),
        ]
        let spare = [s.function, s.property, s.type, s.string, s.keyword, s.number, p.info, p.warn, p.bad, p.good]
            + hues
        var used = Set<String>()
        var out: [String: KitColor] = [:]
        for (name, want) in wants {
            var pick = want
            if pick == nil || used.contains(pick!.hex.uppercased()) {
                pick = spare.first { !used.contains($0.hex.uppercased()) } ?? want
            }
            if let pick { out[name] = pick; used.insert(pick.hex.uppercased()) }
        }
        thingCache = (p, out)
        return out
    }

    /// The SF Symbol for a kind of thing.
    static func thingGlyph(_ thing: String) -> String {
        switch thing {
        case "features", "feature": return "puzzlepiece.extension"
        case "clients", "client": return "antenna.radiowaves.left.and.right"
        case "servers", "server": return "server.rack"
        case "commands", "command": return "terminal"
        case "endpoints", "endpoint": return "point.3.connected.trianglepath.dotted"
        case "assistants", "assistant": return "person.2"
        case "selectors", "selector": return "scope"
        case "docs", "doc": return "doc.text"
        case "contentbase": return "tablecells"
        default: return "cube"
        }
    }

    /// A type name in a signature or a schema (`string`, `number[]`,
    /// `Promise<boolean>`, `"a" | "b"`): its color by the base type.
    static func typeNameColor(_ text: String) -> Color {
        let s = Theme.palette.syntax
        var t = text.trimmingCharacters(in: .whitespaces).lowercased()
        if t.hasPrefix("promise<"), t.hasSuffix(">") { t = String(t.dropFirst(8).dropLast()) }
        if t.hasSuffix("[]") || t.hasPrefix("array") { return s.function.color }
        if t.hasPrefix("\"") || t.hasPrefix("'") || t.contains(" | ") || t == "enum" { return s.type.color }
        switch t {
        case "string": return s.string.color
        case "number", "integer", "bigint": return s.number.color
        case "boolean", "bool": return s.keyword.color
        case "void", "undefined", "null", "never", "unknown", "any", "": return Theme.palette.textFaint.color
        case "function": return s.function.color
        case "date": return s.property.color
        default: return Theme.palette.info.color
        }
    }

    /// A status word: live/running/done good or info, idle and stopped
    /// quiet, failed bad.
    static func statusColor(_ status: String) -> Color {
        let p = Theme.palette
        switch status.lowercased() {
        case "live", "on", "running", "ok", "shipped", "accepted", "active": return p.good.color
        case "starting", "loading", "updating", "calling", "exploring", "in progress": return p.info.color
        case "idle", "stopped", "off", "no instance", "superseded", "archived": return p.textFaint.color
        default:
            let c = Theme.statusColor(status)
            return c == p.textFaint.color ? p.textMuted.color : c
        }
    }

    /// A value's color by the type the host names.
    static func valueColor(_ type: String) -> Color {
        let s = Theme.palette.syntax
        switch type {
        case "string": return s.string.color
        case "number", "bigint": return s.number.color
        case "boolean": return s.keyword.color
        case "null", "undefined": return s.comment.color
        case "function": return s.function.color
        case "symbol": return s.type.color
        default: return Theme.palette.textBody.color
        }
    }

    /// Key names in a result tree.
    static var keyColor: Color { Theme.palette.syntax.property.color }
    /// A container's type name (`Array(3)`, `Map`).
    static var typeColor: Color { Theme.palette.syntax.type.color }
    /// What the user typed.
    static var inputColor: Color { Theme.palette.accent.color }

    /// A helper's origin, one hue each, so own, borrowed and plugin helpers
    /// read apart at a glance. Built in stays quiet.
    static func originColor(_ kind: String) -> Color {
        let s = Theme.palette.syntax
        switch kind {
        case "own": return Theme.palette.accent.color
        case "borrowed": return s.function.color
        case "plugin": return s.type.color
        case "home": return s.property.color
        default: return Theme.palette.textFaint.color
        }
    }

    /// Diff lines: added, removed, and the rest.
    static func diffColor(_ kind: String) -> Color {
        switch kind {
        case "add": return Theme.palette.good.color
        case "del": return Theme.palette.bad.color
        case "gap": return Theme.palette.textFaint.color
        default: return Theme.palette.textMuted.color
        }
    }

    /// A clash or another write that needs a second look.
    static var clashColor: Color { Theme.palette.warn.color }

    /// A doc model's or an assistant's own color, by the slot the host
    /// gives it, so a model reads the same in the index, the models view
    /// and a doc. A negative slot (`Base`) is quiet.
    static func slotColor(_ slot: Int) -> Color {
        let p = Theme.palette
        guard slot >= 0 else { return p.textMuted.color }
        let ring: [Color] = [p.accent.color, p.syntax.function.color, p.syntax.type.color, p.syntax.string.color,
                             p.syntax.number.color, p.syntax.keyword.color, p.syntax.property.color, p.info.color]
        return ring[slot % ring.count]
    }

    /// A stack's or card's `tone` as a color: `slot:<n>`, or a named one a
    /// project tool may send (`accent`, `good`, `warn`, `bad`, `info`,
    /// `muted`). Nil for anything else.
    static func toneColor(_ tone: String) -> Color? {
        let p = Theme.palette
        switch tone {
        case "accent": return p.accent.color
        case "good": return p.good.color
        case "warn": return p.warn.color
        case "bad": return p.bad.color
        case "info": return p.info.color
        case "muted": return p.textMuted.color
        default: break
        }
        if tone.hasPrefix("kind:") { return thingColor(String(tone.dropFirst(5))) }
        guard tone.hasPrefix("slot:"), let n = Int(tone.dropFirst(5)) else { return nil }
        return slotColor(n)
    }

    /// A tool a project or plugin declared: its own hue, apart from the
    /// built-in tools, so the two read apart in the overview and palette.
    static func declaredColor(_ originKind: String) -> Color {
        originKind == "plugin" ? Theme.palette.syntax.type.color : Theme.palette.syntax.keyword.color
    }

    /// A frontmatter field's color by the kind the host names.
    static func fieldColor(_ kind: String) -> Color {
        let s = Theme.palette.syntax
        switch kind {
        case "string": return s.string.color
        case "number": return s.number.color
        case "boolean": return s.keyword.color
        case "enum": return s.type.color
        case "array": return s.function.color
        case "date": return s.property.color
        case "object": return Theme.palette.info.color
        default: return Theme.palette.textMuted.color
        }
    }

    /// Who wrote a chat message: you, the assistant, or a tool.
    static func roleColor(_ role: String) -> Color {
        switch role {
        case "user": return Theme.palette.accent.color
        case "tool": return Theme.palette.syntax.type.color
        default: return Theme.palette.syntax.function.color
        }
    }

    /// A tool call's state: running, done or failed.
    static func toolStateColor(_ status: String) -> Color {
        switch status {
        case "running": return Theme.palette.info.color
        case "failed": return Theme.palette.bad.color
        default: return Theme.palette.good.color
        }
    }
}

/// A card: soft raised background, a hairline border, an optional color
/// bar on the left that says what the card is (an error, a run's state).
struct WorkbenchCard<Content: View>: View {
    var tint: Color?
    var padding: CGFloat = WorkbenchStyle.Gap.card
    @ViewBuilder let content: () -> Content

    var body: some View {
        content()
            .padding(.horizontal, padding + KitTokens.Space.s2)
            .padding(.vertical, padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: KitTokens.Radius.lg).fill(Theme.palette.raised.color.opacity(0.7)))
            .overlay(alignment: .leading) {
                if let tint {
                    UnevenRoundedRectangle(topLeadingRadius: KitTokens.Radius.lg, bottomLeadingRadius: KitTokens.Radius.lg)
                        .fill(tint)
                        .frame(width: 4)
                }
            }
            .overlay(RoundedRectangle(cornerRadius: KitTokens.Radius.lg).stroke(Theme.palette.border.color))
    }
}

/// A section header that stands apart: a short bar in the section's color,
/// the title in the UI font, a count pill and an optional quiet note.
struct WorkbenchSectionTitle: View {
    let title: String
    var note: String?
    var count: Int?
    var color: Color?

    var body: some View {
        let tint = color ?? Theme.palette.accent.color
        HStack(alignment: .center, spacing: KitTokens.Space.s4) {
            RoundedRectangle(cornerRadius: 2).fill(tint).frame(width: 4, height: 18)
            Text(title)
                .font(WorkbenchStyle.ui(KitTokens.TypeScale.md, weight: .semibold))
                .foregroundStyle(Theme.palette.text.color)
            if let count { CountPill(count: count, color: tint) }
            if let note {
                Text(note).font(WorkbenchStyle.meta).foregroundStyle(Theme.palette.textFaint.color).lineLimit(1)
            }
            Spacer(minLength: 0)
        }
        .padding(.bottom, KitTokens.Space.s2)
    }
}

/// A titled section: `WorkbenchSectionTitle` over its content.
struct WorkbenchSection<Content: View>: View {
    let title: String
    var note: String?
    var count: Int?
    var color: Color?
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: WorkbenchStyle.Gap.row) {
            WorkbenchSectionTitle(title: title, note: note, count: count, color: color)
            content()
        }
    }
}

/// A small rounded tag: `project`, `running`, `exit 0`.
struct WorkbenchTag: View {
    let text: String
    let color: Color

    var body: some View {
        Text(text)
            .font(WorkbenchStyle.caption())
            .foregroundStyle(color)
            .padding(.horizontal, KitTokens.Space.s4)
            .padding(.vertical, 3)
            .background(Capsule().fill(color.opacity(0.15)))
            .overlay(Capsule().stroke(color.opacity(0.25), lineWidth: 1))
    }
}

/// A count in a soft pill, beside a header.
struct CountPill: View {
    let count: Int
    var color: Color = Theme.palette.textMuted.color

    var body: some View {
        Text("\(count)")
            .font(WorkbenchStyle.ui(WorkbenchStyle.Size.caption, weight: .bold).monospacedDigit())
            .foregroundStyle(color)
            .padding(.horizontal, KitTokens.Space.s3 + 1)
            .padding(.vertical, 1)
            .background(Capsule().fill(color.opacity(0.16)))
    }
}

/// A kind's glyph in a soft square of its color: features, a doc, a tool.
struct ThingGlyph: View {
    let symbol: String
    let color: Color
    var size: CGFloat = WorkbenchStyle.Size.glyph

    var body: some View {
        Image(systemName: symbol)
            .font(.system(size: size * 0.48, weight: .semibold))
            .foregroundStyle(color)
            .frame(width: size, height: size)
            .background(RoundedRectangle(cornerRadius: size * 0.28).fill(color.opacity(0.16)))
            .overlay(RoundedRectangle(cornerRadius: size * 0.28).stroke(color.opacity(0.28), lineWidth: 1))
    }
}

/// A value's key and value rows: a flat JSON object as key/value lines,
/// nested ones indented under their key. Display only: the text is the
/// host's pretty JSON; anything that is not JSON shows as is.
struct ValueRows: View {
    let text: String

    var body: some View {
        if let value = Self.parse(text), case .object = value.kind {
            WorkbenchCard(padding: KitTokens.Space.s5) {
                VStack(alignment: .leading, spacing: 0) {
                    Self.rows(value, depth: 0)
                }
            }
        } else {
            Text(text.isEmpty ? " " : text)
                .font(WorkbenchStyle.code())
                .foregroundStyle(Theme.palette.textBody.color)
                .textSelection(.enabled)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(KitTokens.Space.s5)
                .background(RoundedRectangle(cornerRadius: KitTokens.Radius.md).fill(Theme.palette.inset.color))
        }
    }

    struct Node {
        enum Kind { case object([(String, Node)]), array([Node]), string(String), number(String), bool(Bool), null }
        let kind: Kind
    }

    static func parse(_ text: String) -> Node? {
        guard let data = text.data(using: .utf8),
              let any = try? JSONSerialization.jsonObject(with: data, options: [.fragmentsAllowed]) else { return nil }
        return node(any, order: keyOrder(text))
    }

    /// JSONSerialization drops key order; keep the host's by where each key
    /// first shows in the text.
    private static func keyOrder(_ text: String) -> (String) -> Int {
        { key in text.range(of: "\"\(key)\"").map { text.distance(from: text.startIndex, to: $0.lowerBound) } ?? Int.max }
    }

    private static func node(_ any: Any, order: (String) -> Int) -> Node {
        switch any {
        case let d as [String: Any]:
            let keys = d.keys.sorted { order($0) < order($1) }
            return Node(kind: .object(keys.map { ($0, node(d[$0]!, order: order)) }))
        case let a as [Any]: return Node(kind: .array(a.map { node($0, order: order) }))
        case let s as String: return Node(kind: .string(s))
        case let n as NSNumber:
            if CFGetTypeID(n) == CFBooleanGetTypeID() { return Node(kind: .bool(n.boolValue)) }
            return Node(kind: .number(n.stringValue))
        default: return Node(kind: .null)
        }
    }

    @MainActor @ViewBuilder
    static func rows(_ node: Node, depth: Int) -> some View {
        switch node.kind {
        case .object(let pairs):
            ForEach(Array(pairs.enumerated()), id: \.offset) { _, pair in
                AnyView(row(pair.0, pair.1, depth: depth))
            }
        case .array(let items):
            ForEach(Array(items.enumerated()), id: \.offset) { index, item in
                AnyView(row("\(index)", item, depth: depth))
            }
        default:
            leaf(node)
        }
    }

    @MainActor
    private static func row(_ key: String, _ value: Node, depth: Int) -> some View {
        let p = Theme.palette
        let nested: Bool = {
            switch value.kind {
            case .object(let pairs): return !pairs.isEmpty && depth < 3
            case .array(let items): return !items.isEmpty && depth < 3
            default: return false
            }
        }()
        return VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .firstTextBaseline, spacing: WorkbenchStyle.Gap.card) {
                Text(key)
                    .font(WorkbenchStyle.code(KitTokens.TypeScale.sm))
                    .foregroundStyle(WorkbenchStyle.keyColor)
                    .frame(minWidth: 140, alignment: .leading)
                if nested {
                    Text(summary(value)).font(WorkbenchStyle.code(KitTokens.TypeScale.xs)).foregroundStyle(p.textFaint.color)
                } else {
                    leaf(value)
                }
                Spacer(minLength: 0)
            }
            .padding(.vertical, KitTokens.Space.s3)
            .padding(.leading, CGFloat(depth) * 22)
            if nested {
                AnyView(rows(value, depth: depth + 1))
            }
        }
    }

    private static func summary(_ node: Node) -> String {
        switch node.kind {
        case .object(let pairs): return "{\(pairs.count) keys}"
        case .array(let items): return "[\(items.count)]"
        default: return ""
        }
    }

    @MainActor
    private static func leaf(_ node: Node) -> some View {
        let (text, type): (String, String) = {
            switch node.kind {
            case .string(let s): return ("\"\(s)\"", "string")
            case .number(let n): return (n, "number")
            case .bool(let b): return (b ? "true" : "false", "boolean")
            case .null: return ("null", "null")
            case .object: return ("{}", "object")
            case .array: return ("[]", "object")
            }
        }()
        return Text(text)
            .font(WorkbenchStyle.code(KitTokens.TypeScale.sm, weight: .medium))
            .foregroundStyle(WorkbenchStyle.valueColor(type))
            .textSelection(.enabled)
            .lineLimit(4)
    }
}

/// Where a helper comes from: its colored tag, the long label, and the
/// source file in the code font.
struct OriginLine: View {
    let origin: WorkbenchOrigin

    var body: some View {
        let p = Theme.palette
        VStack(alignment: .leading, spacing: KitTokens.Space.s3) {
            HStack(alignment: .firstTextBaseline, spacing: KitTokens.Space.s4) {
                WorkbenchTag(text: origin.tag, color: WorkbenchStyle.originColor(origin.kind))
                Text(origin.label).font(WorkbenchStyle.meta).foregroundStyle(p.textMuted.color).lineLimit(1)
            }
            if let file = origin.file {
                Text((file as NSString).abbreviatingWithTildeInPath)
                    .font(WorkbenchStyle.code(KitTokens.TypeScale.xs)).foregroundStyle(p.textFaint.color)
                    .lineLimit(1).truncationMode(.head).textSelection(.enabled)
            }
        }
        .padding(.top, KitTokens.Space.s2)
    }
}
