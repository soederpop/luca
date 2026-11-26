import SwiftUI

/// How a kind of name looks in the console: its color and its glyph. A
/// helper takes its registry's color, so `fs` is the same green here as in
/// the registry tile.
@MainActor
enum DocKind {
    static func color(_ kind: String, registry: String? = nil) -> Color {
        let p = Theme.palette
        switch kind {
        case "helper": return registry.map(WorkbenchStyle.thingColor) ?? p.syntax.function.color
        case "container": return p.accent.color
        case "method", "function": return p.syntax.function.color
        case "getter", "property": return p.syntax.property.color
        case "class": return p.syntax.type.color
        case "keyword": return p.syntax.keyword.color
        case "value": return p.syntax.number.color
        default: return p.textMuted.color
        }
    }

    static func glyph(_ kind: String, registry: String? = nil) -> String {
        switch kind {
        case "helper": return registry.map(WorkbenchStyle.thingGlyph) ?? "puzzlepiece.extension"
        case "container": return "shippingbox"
        case "method", "function": return "function"
        case "getter": return "arrow.turn.down.right"
        case "property": return "circle.grid.2x1"
        case "class": return "square.stack.3d.up"
        case "keyword": return "textformat"
        case "value": return "cube"
        case "global": return "globe"
        default: return "circle"
        }
    }

    static func color(of doc: WorkbenchDocCard) -> Color { color(doc.kind, registry: doc.kind == "helper" ? doc.owner?.registry : nil) }
    static func glyph(of doc: WorkbenchDocCard) -> String { glyph(doc.kind, registry: doc.kind == "helper" ? doc.owner?.registry : nil) }
}

/// Prose from Luca's docs: `code` and **bold** drawn as such.
@MainActor
func docProse(_ text: String) -> Text {
    let options = AttributedString.MarkdownParsingOptions(interpretedSyntax: .inlineOnlyPreservingWhitespace)
    guard var out = try? AttributedString(markdown: text, options: options) else { return Text(text) }
    for run in out.runs where run.inlinePresentationIntent?.contains(.code) == true {
        out[run.range].foregroundColor = Theme.palette.syntax.string.color
    }
    return Text(out)
}

/// `name(param: type, …) → returns` in color, the argument at the caret
/// marked. Built from the doc's parts, so every type has its type color.
@MainActor
func docSignature(_ doc: WorkbenchDocCard, active: Int? = nil, size: CGFloat = KitTokens.TypeScale.sm) -> Text {
    let p = Theme.palette
    let faint = p.textFaint.color
    func code(_ s: String, _ color: Color, weight: Font.Weight = .regular) -> Text {
        Text(s).font(WorkbenchStyle.code(size, weight: weight)).foregroundColor(color)
    }
    guard doc.kind == "method" || doc.kind == "function" || doc.kind == "class", let params = doc.params else {
        // A getter's or a helper's one line: `name: type`.
        let line = doc.signature ?? doc.title
        if let colon = line.range(of: ": ") {
            return code(String(line[..<colon.lowerBound]), DocKind.color(of: doc), weight: .semibold) + code(": ", faint)
                + code(String(line[colon.upperBound...]), WorkbenchStyle.typeNameColor(String(line[colon.upperBound...])))
        }
        return code(line, DocKind.color(of: doc), weight: .semibold)
    }
    let name = doc.title.split(separator: ".").last.map(String.init) ?? doc.title
    var text = code(doc.kind == "class" ? "new \(name)" : name, DocKind.color(of: doc), weight: .semibold) + code("(", faint)
    for (index, param) in params.enumerated() {
        if index > 0 { text = text + code(", ", faint) }
        let on = index == active || (active ?? -1) >= params.count && index == params.count - 1 && param.name.hasPrefix("...")
        let optional = param.required == true || doc.documented != true ? "" : "?"
        var piece = code(param.name + optional, on ? p.text.color : p.textMuted.color, weight: on ? .bold : .regular)
        if on { piece = piece.underline(true, color: p.accent.color) }
        text = text + piece
        if !param.type.isEmpty, param.type != "unknown" {
            text = text + code(": ", faint) + code(param.type, WorkbenchStyle.typeNameColor(param.type))
        }
    }
    text = text + code(")", faint)
    if let returns = doc.returns, !returns.isEmpty, returns != "unknown" {
        text = text + code("  →  ", faint) + code(returns, WorkbenchStyle.typeNameColor(returns))
    }
    return text
}

/// The docs of one name. `compact` is the short form beside the completion
/// list; the full form is the docs pane and a `?name` entry.
struct DocCardView: View {
    let doc: WorkbenchDocCard
    var compact = false
    /// The argument the caret is at, when this is the call being typed.
    var active: Int? = nil
    /// A member was clicked: show its docs.
    var onMember: ((String) -> Void)? = nil
    /// The owner's name was clicked: show the helper's docs.
    var onOwner: (() -> Void)? = nil
    /// Open the helper's inspector tile.
    var onInspect: (() -> Void)? = nil
    /// True in the docs pane, where `o` opens the inspector.
    var showsKey = false

    private var p: KitPalette { Theme.palette }
    private var tint: Color { DocKind.color(of: doc) }
    private var gap: CGFloat { compact ? KitTokens.Space.s5 : KitTokens.Space.s7 }

    var body: some View {
        VStack(alignment: .leading, spacing: gap) {
            header
            if hasSignature {
                docSignature(doc, active: active)
                    .lineSpacing(4)
                    .fixedSize(horizontal: false, vertical: true)
                    .textSelection(.enabled)
                    .padding(KitTokens.Space.s5)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(RoundedRectangle(cornerRadius: KitTokens.Radius.md).fill(p.inset.color))
                    .overlay(RoundedRectangle(cornerRadius: KitTokens.Radius.md).stroke(tint.opacity(0.25)))
            }
            if let value = doc.value, doc.kind != "helper" {
                labeled("Now") {
                    Text(value)
                        .font(WorkbenchStyle.code(KitTokens.TypeScale.sm))
                        .foregroundStyle(WorkbenchStyle.valueColor(doc.type ?? ""))
                        .lineLimit(compact ? 2 : 6)
                        .textSelection(.enabled)
                }
            }
            if !doc.summary.isEmpty {
                docProse(doc.summary)
                    .font(WorkbenchStyle.ui(KitTokens.TypeScale.sm))
                    .foregroundStyle(p.textBody.color)
                    .lineSpacing(5)
                    .lineLimit(compact ? 7 : nil)
                    .fixedSize(horizontal: false, vertical: true)
                    .textSelection(.enabled)
            } else if doc.documented == false, doc.kind == "method" || doc.kind == "function" || doc.kind == "getter" {
                Text("No docs written for this. The names come from the live object.")
                    .font(WorkbenchStyle.meta)
                    .foregroundStyle(p.textFaint.color)
            }
            if let params = doc.params, params.contains(where: { !$0.description.isEmpty }) || (active != nil && !params.isEmpty) {
                paramsView(params)
            }
            if let returns = doc.returns, !returns.isEmpty, returns != "unknown", doc.kind == "method" {
                labeled("Returns") {
                    Text(returns)
                        .font(WorkbenchStyle.code(KitTokens.TypeScale.sm))
                        .foregroundStyle(WorkbenchStyle.typeNameColor(returns))
                        .textSelection(.enabled)
                }
            }
            if let examples = doc.examples, !examples.isEmpty {
                examplesView(compact ? Array(examples.prefix(1)) : examples)
            }
            if !compact, let members = doc.members, !members.isEmpty {
                membersView("Methods", members.filter { $0.kind == "method" || $0.kind == "function" })
                membersView(doc.kind == "helper" || doc.kind == "container" ? "Getters" : "Properties", members.filter { $0.kind != "method" && $0.kind != "function" })
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var hasSignature: Bool {
        if doc.kind == "helper" || doc.kind == "container" || doc.kind == "keyword" || doc.kind == "global" { return false }
        return doc.signature != nil
    }

    private var header: some View {
        HStack(alignment: .center, spacing: KitTokens.Space.s5) {
            ThingGlyph(symbol: DocKind.glyph(of: doc), color: tint, size: compact ? 30 : 40)
            VStack(alignment: .leading, spacing: KitTokens.Space.s2) {
                Text(doc.title)
                    .font(WorkbenchStyle.code(compact ? KitTokens.TypeScale.md : KitTokens.TypeScale.lg, weight: .semibold))
                    .foregroundStyle(p.text.color)
                    .lineLimit(2)
                    .truncationMode(.middle)
                    .textSelection(.enabled)
                HStack(spacing: KitTokens.Space.s4) {
                    WorkbenchTag(text: kindWord, color: tint)
                    if let owner = doc.owner, doc.kind != "helper" {
                        Button { onOwner?() } label: {
                            HStack(spacing: KitTokens.Space.s2) {
                                Image(systemName: WorkbenchStyle.thingGlyph(owner.registry)).font(.system(size: 12, weight: .semibold))
                                Text(owner.title).font(WorkbenchStyle.caption())
                            }
                            .foregroundStyle(WorkbenchStyle.thingColor(owner.registry))
                        }
                        .buttonStyle(.plain)
                        .disabled(onOwner == nil)
                    }
                    if doc.kind == "helper", let value = doc.value {
                        WorkbenchTag(text: value, color: value.hasPrefix("live") ? p.good.color : p.textFaint.color)
                    }
                    if !compact, doc.owner != nil, let onInspect {
                        Button(action: onInspect) {
                            Label("Inspector", systemImage: "arrow.up.forward.square")
                                .font(WorkbenchStyle.caption())
                                .foregroundStyle(p.textMuted.color)
                                .padding(.horizontal, KitTokens.Space.s4)
                                .padding(.vertical, 3)
                                .background(Capsule().stroke(p.border.color))
                        }
                        .buttonStyle(.plain)
                        .modifier(InspectKey(on: showsKey))
                    }
                }
            }
            Spacer(minLength: 0)
        }
    }

    private var kindWord: String {
        switch doc.kind {
        case "helper": return doc.owner.map { String($0.registry.dropLast()) } ?? "helper"
        case "function" where doc.documented == false: return "function"
        default: return doc.kind
        }
    }

    private func labeled<Content: View>(_ label: String, @ViewBuilder _ content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: KitTokens.Space.s3) {
            Text(label.uppercased())
                .font(WorkbenchStyle.ui(13, weight: .bold))
                .kerning(0.8)
                .foregroundStyle(p.textFaint.color)
            content()
        }
    }

    private func paramsView(_ params: [WorkbenchDocCard.Param]) -> some View {
        labeled("Arguments") {
            VStack(alignment: .leading, spacing: KitTokens.Space.s2) {
                ForEach(Array(params.enumerated()), id: \.offset) { index, param in
                    let on = index == active
                    VStack(alignment: .leading, spacing: KitTokens.Space.s2) {
                        HStack(alignment: .firstTextBaseline, spacing: KitTokens.Space.s4) {
                            Text(param.name)
                                .font(WorkbenchStyle.code(KitTokens.TypeScale.sm, weight: .semibold))
                                .foregroundStyle(on ? p.text.color : p.syntax.property.color)
                            if param.type != "unknown", !param.type.isEmpty {
                                Text(param.type)
                                    .font(WorkbenchStyle.code(KitTokens.TypeScale.xs))
                                    .foregroundStyle(WorkbenchStyle.typeNameColor(param.type))
                                    .lineLimit(2)
                            }
                            Spacer(minLength: 0)
                            if doc.documented == true {
                                Text(param.required == true ? "required" : "optional")
                                    .font(WorkbenchStyle.ui(13, weight: .semibold))
                                    .foregroundStyle(param.required == true ? p.warn.color : p.textFaint.color)
                            }
                        }
                        if !param.description.isEmpty {
                            docProse(param.description)
                                .font(WorkbenchStyle.ui(KitTokens.TypeScale.xs))
                                .foregroundStyle(p.textMuted.color)
                                .lineSpacing(3)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                    .padding(.horizontal, KitTokens.Space.s5)
                    .padding(.vertical, KitTokens.Space.s4)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(RoundedRectangle(cornerRadius: KitTokens.Radius.md).fill(on ? p.accent.color.opacity(0.14) : p.inset.color.opacity(0.6)))
                    .overlay(RoundedRectangle(cornerRadius: KitTokens.Radius.md).stroke(on ? p.accent.color.opacity(0.6) : .clear))
                }
            }
        }
    }

    private func examplesView(_ examples: [String]) -> some View {
        labeled(examples.count == 1 ? "Example" : "Examples") {
            VStack(alignment: .leading, spacing: KitTokens.Space.s4) {
                ForEach(Array(examples.enumerated()), id: \.offset) { _, example in
                    TilesCodeSyntaxHighlighter(palette: p).highlightCode(example, language: "typescript")
                        .font(WorkbenchStyle.code(KitTokens.TypeScale.xs))
                        .lineSpacing(4)
                        .lineLimit(compact ? 6 : nil)
                        .fixedSize(horizontal: false, vertical: true)
                        .textSelection(.enabled)
                        .padding(KitTokens.Space.s5)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(RoundedRectangle(cornerRadius: KitTokens.Radius.md).fill(p.inset.color))
                        .overlay(alignment: .leading) {
                            UnevenRoundedRectangle(topLeadingRadius: KitTokens.Radius.md, bottomLeadingRadius: KitTokens.Radius.md)
                                .fill(p.syntax.string.color.opacity(0.6)).frame(width: 3)
                        }
                }
            }
        }
    }

    @ViewBuilder private func membersView(_ title: String, _ members: [WorkbenchDocCard.Member]) -> some View {
        if !members.isEmpty {
            VStack(alignment: .leading, spacing: KitTokens.Space.s4) {
                HStack(spacing: KitTokens.Space.s4) {
                    Text(title.uppercased())
                        .font(WorkbenchStyle.ui(13, weight: .bold))
                        .kerning(0.8)
                        .foregroundStyle(p.textFaint.color)
                    CountPill(count: members.count, color: DocKind.color(members[0].kind))
                }
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(Array(members.enumerated()), id: \.offset) { _, member in
                        DocMemberRow(member: member) { onMember?(member.name) }
                    }
                }
            }
        }
    }
}

private struct InspectKey: ViewModifier {
    let on: Bool
    func body(content: Content) -> some View {
        if on { content.keyBadge("lucaConsole.inspect") } else { content }
    }
}

private struct DocMemberRow: View {
    let member: WorkbenchDocCard.Member
    let action: () -> Void
    @State private var hovered = false

    var body: some View {
        let p = Theme.palette
        Button(action: action) {
            VStack(alignment: .leading, spacing: KitTokens.Space.s1) {
                (Text(member.name).font(WorkbenchStyle.code(KitTokens.TypeScale.sm, weight: .medium)).foregroundColor(DocKind.color(member.kind))
                    + Text(member.detail.isEmpty ? "" : " " + member.detail).font(WorkbenchStyle.code(KitTokens.TypeScale.xs)).foregroundColor(p.textFaint.color))
                    .lineLimit(1)
                    .truncationMode(.tail)
                if !member.summary.isEmpty {
                    Text(member.summary)
                        .font(WorkbenchStyle.ui(KitTokens.TypeScale.xs))
                        .foregroundStyle(p.textMuted.color)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                }
            }
            .padding(.horizontal, KitTokens.Space.s4)
            .padding(.vertical, KitTokens.Space.s4)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: KitTokens.Radius.md).fill(hovered ? p.raised.color : .clear))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .onHover { hovered = $0 }
    }
}

/// The completion list, and beside it the docs of the picked item when the
/// docs pane is not there to show them.
struct ConsoleCompletionPopup: View {
    let assist: ConsoleAssist
    let prefix: String
    let showsDetail: Bool
    let onPick: (Int) -> Void

    static let listWidth: CGFloat = 400
    static let detailWidth: CGFloat = 460
    private static let rowHeight: CGFloat = 38
    private var p: KitPalette { Theme.palette }

    var body: some View {
        HStack(alignment: .bottom, spacing: KitTokens.Space.s4) {
            list
            if showsDetail, let item = assist.selected {
                ScrollView {
                    DocCardView(doc: item.doc, compact: true).padding(KitTokens.Space.s6)
                }
                .frame(width: Self.detailWidth)
                .frame(maxHeight: 420)
                .fixedSize(horizontal: false, vertical: true)
                .background(panel)
            }
        }
    }

    private var panel: some View {
        RoundedRectangle(cornerRadius: KitTokens.Radius.lg)
            .fill(p.raised.color)
            .overlay(RoundedRectangle(cornerRadius: KitTokens.Radius.lg).stroke(p.borderStrong.color))
            .shadow(color: p.shadow.color, radius: 18, y: 6)
    }

    private var list: some View {
        let items = assist.items
        let shown = min(items.count, 9)
        return VStack(spacing: 0) {
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 2) {
                        ForEach(Array(items.enumerated()), id: \.offset) { index, item in
                            row(item, selected: index == assist.selection)
                                .id(index)
                                .onTapGesture { onPick(index) }
                        }
                    }
                    .padding(KitTokens.Space.s3)
                }
                .frame(height: CGFloat(shown) * (Self.rowHeight + 2) + KitTokens.Space.s3 * 2)
                .onChange(of: assist.selection) { _, index in proxy.scrollTo(index) }
            }
            Rectangle().fill(p.border.color).frame(height: 1)
            HStack(spacing: KitTokens.Space.s5) {
                keyHint("↑↓", "move")
                keyHint("Tab", "take")
                keyHint("Esc", "close")
                Spacer(minLength: 0)
                Text("\(assist.selection + 1) of \(items.count)")
                    .font(WorkbenchStyle.ui(13).monospacedDigit())
                    .foregroundStyle(p.textFaint.color)
            }
            .padding(.horizontal, KitTokens.Space.s5)
            .padding(.vertical, KitTokens.Space.s3)
        }
        .frame(width: Self.listWidth)
        .background(panel)
    }

    private func keyHint(_ key: String, _ word: String) -> some View {
        HStack(spacing: KitTokens.Space.s2) {
            Text(key)
                .font(WorkbenchStyle.code(12, weight: .semibold))
                .foregroundStyle(p.textMuted.color)
                .padding(.horizontal, 5)
                .padding(.vertical, 1)
                .background(RoundedRectangle(cornerRadius: 4).fill(p.inset.color))
                .overlay(RoundedRectangle(cornerRadius: 4).stroke(p.border.color))
            Text(word).font(WorkbenchStyle.ui(13)).foregroundStyle(p.textFaint.color)
        }
    }

    private func row(_ item: WorkbenchCompletion.Item, selected: Bool) -> some View {
        let registry = item.kind == "helper" ? item.doc.owner?.registry : nil
        let color = DocKind.color(item.kind, registry: registry)
        return HStack(spacing: KitTokens.Space.s4) {
            Image(systemName: DocKind.glyph(item.kind, registry: registry))
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(color)
                .frame(width: 24, height: 24)
                .background(RoundedRectangle(cornerRadius: 6).fill(color.opacity(0.16)))
            label(item.label, color: selected ? p.text.color : p.textBody.color)
                .lineLimit(1)
                .layoutPriority(1)
            Text(item.detail)
                .font(item.kind == "helper" ? WorkbenchStyle.ui(KitTokens.TypeScale.xs) : WorkbenchStyle.code(KitTokens.TypeScale.xs))
                .foregroundStyle(p.textFaint.color)
                .lineLimit(1)
                .truncationMode(.tail)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, KitTokens.Space.s4)
        .frame(height: Self.rowHeight)
        .background(RoundedRectangle(cornerRadius: KitTokens.Radius.md).fill(selected ? p.accent.color.opacity(0.2) : .clear))
        .overlay(RoundedRectangle(cornerRadius: KitTokens.Radius.md).stroke(selected ? p.accent.color.opacity(0.55) : .clear))
        .contentShape(Rectangle())
    }

    /// The label with the typed letters marked.
    private func label(_ text: String, color: Color) -> Text {
        let font = WorkbenchStyle.code(KitTokens.TypeScale.sm, weight: .medium)
        guard !prefix.isEmpty, let range = text.range(of: prefix, options: [.caseInsensitive]) else {
            return Text(text).font(font).foregroundColor(color)
        }
        return Text(text[..<range.lowerBound]).font(font).foregroundColor(color)
            + Text(text[range]).font(WorkbenchStyle.code(KitTokens.TypeScale.sm, weight: .bold)).foregroundColor(p.accent.color)
            + Text(text[range.upperBound...]).font(font).foregroundColor(color)
    }
}

/// The call the caret is in, over the input: the signature with the
/// argument at the caret marked, and that argument's own line.
struct ConsoleSignatureStrip: View {
    let signature: WorkbenchCompletion.Signature

    var body: some View {
        let p = Theme.palette
        let doc = signature.doc
        let params = doc.params ?? []
        let param = params.indices.contains(signature.active) ? params[signature.active] : nil
        VStack(alignment: .leading, spacing: KitTokens.Space.s3) {
            docSignature(doc, active: signature.active)
                .lineLimit(3)
                .fixedSize(horizontal: false, vertical: true)
            if let param, !param.description.isEmpty {
                (Text(param.name).font(WorkbenchStyle.code(KitTokens.TypeScale.xs, weight: .semibold)).foregroundColor(p.accent.color)
                    + Text("  ").font(WorkbenchStyle.ui(KitTokens.TypeScale.xs))
                    + docProse(param.description).font(WorkbenchStyle.ui(KitTokens.TypeScale.xs)).foregroundColor(p.textMuted.color))
                    .lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(.horizontal, KitTokens.Space.s6)
        .padding(.vertical, KitTokens.Space.s4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: KitTokens.Radius.md).fill(p.raised.color))
        .overlay(alignment: .leading) {
            UnevenRoundedRectangle(topLeadingRadius: KitTokens.Radius.md, bottomLeadingRadius: KitTokens.Radius.md)
                .fill(p.syntax.function.color).frame(width: 4)
        }
        .overlay(RoundedRectangle(cornerRadius: KitTokens.Radius.md).stroke(p.border.color))
    }
}
