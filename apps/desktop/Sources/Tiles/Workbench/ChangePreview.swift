import SwiftUI

/// A change the host would make, drawn as it sends it: a status line (ready,
/// clashes, blocked), clashes, what a borrow brings, notes, each file with
/// its diff, and the relative imports of a copy. Shared by the change tile
/// and the plugins tile. Nothing here decides anything.
struct ChangePreview: View {
    let change: WorkbenchChange
    /// The key hints in the status line, from the keymap.
    var applyKey: String
    var overwriteKey: String?
    var importsKey: String?
    var overwriting = false
    var withImports = false

    private var p: KitPalette { Theme.palette }

    var body: some View {
        VStack(alignment: .leading, spacing: KitTokens.Space.s7) {
            VStack(alignment: .leading, spacing: KitTokens.Space.s3) {
                Text(change.title)
                    .font(WorkbenchStyle.ui(KitTokens.TypeScale.xl, weight: .semibold))
                    .foregroundStyle(p.text.color)
                if !change.summary.isEmpty {
                    Text(change.summary).font(WorkbenchStyle.ui(KitTokens.TypeScale.sm)).foregroundStyle(p.textMuted.color)
                }
            }
            status
            if !change.clashes.isEmpty { clashes }
            if !change.helpers.isEmpty { helpers }
            if !change.notes.isEmpty { notes }
            if !change.files.isEmpty { files }
            if !change.imports.isEmpty { imports }
        }
    }

    private var status: some View {
        let (icon, color, text): (String, Color, String) = {
            if let blocked = change.blocked { return ("nosign", p.bad.color, blocked) }
            if change.needsOverwrite {
                let key = overwriteKey.map { " Press \($0) to write over them, after a look." } ?? ""
                return ("exclamationmark.triangle.fill", WorkbenchStyle.clashColor, "\(change.clashes.count) clash\(change.clashes.count == 1 ? "" : "es"). Nothing is written yet.\(key)")
            }
            let n = change.files.filter { $0.action != "same" }.count
            let over = overwriting ? " Clashes will be written over." : ""
            return ("checkmark.circle.fill", p.good.color, "Ready: \(n) change\(n == 1 ? "" : "s"). Press \(applyKey) to write.\(over)")
        }()
        return WorkbenchCard(tint: color) {
            HStack(alignment: .firstTextBaseline, spacing: KitTokens.Space.s4) {
                Image(systemName: icon).foregroundStyle(color)
                Text(text).font(WorkbenchStyle.ui(KitTokens.TypeScale.md, weight: .medium)).foregroundStyle(p.text.color)
                Spacer(minLength: 0)
            }
        }
    }

    private var clashes: some View {
        VStack(alignment: .leading, spacing: KitTokens.Space.s3) {
            WorkbenchSectionTitle(title: "Clashes", note: "\(change.clashes.count)")
            WorkbenchCard(tint: WorkbenchStyle.clashColor) {
                VStack(alignment: .leading, spacing: KitTokens.Space.s4) {
                    ForEach(change.clashes, id: \.self) { line in
                        HStack(alignment: .firstTextBaseline, spacing: KitTokens.Space.s4) {
                            Image(systemName: "exclamationmark.triangle").foregroundStyle(WorkbenchStyle.clashColor)
                            Text(line).font(WorkbenchStyle.ui(KitTokens.TypeScale.sm)).foregroundStyle(p.textBody.color)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                }
            }
        }
    }

    private var helpers: some View {
        VStack(alignment: .leading, spacing: KitTokens.Space.s3) {
            WorkbenchSectionTitle(title: "What it brings", note: "\(change.helpers.count)")
            FlowTags(tags: change.helpers, color: WorkbenchStyle.originColor("borrowed"))
        }
    }

    private var notes: some View {
        VStack(alignment: .leading, spacing: KitTokens.Space.s3) {
            ForEach(change.notes, id: \.self) { note in
                HStack(alignment: .firstTextBaseline, spacing: KitTokens.Space.s4) {
                    Image(systemName: "info.circle").foregroundStyle(p.info.color)
                    Text(note).font(WorkbenchStyle.ui(KitTokens.TypeScale.sm)).foregroundStyle(p.textBody.color)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
    }

    private var files: some View {
        VStack(alignment: .leading, spacing: KitTokens.Space.s4) {
            WorkbenchSectionTitle(title: "Files", note: "\(change.files.count)")
            ForEach(change.files) { file in FileDiffCard(file: file) }
        }
    }

    private var imports: some View {
        VStack(alignment: .leading, spacing: KitTokens.Space.s3) {
            WorkbenchSectionTitle(title: "Relative imports",
                                  note: importsKey.map { withImports ? "copied too · \($0) to leave them" : "not copied · \($0) to include them" })
            WorkbenchCard {
                VStack(alignment: .leading, spacing: KitTokens.Space.s5) {
                    ForEach(change.imports) { item in
                        VStack(alignment: .leading, spacing: KitTokens.Space.s2) {
                            HStack(alignment: .firstTextBaseline, spacing: KitTokens.Space.s4) {
                                WorkbenchTag(text: Self.importWord(item.action, withImports: withImports), color: Self.importColor(item.action, withImports: withImports))
                                Text(item.spec).font(WorkbenchStyle.code(KitTokens.TypeScale.sm, weight: .semibold)).foregroundStyle(p.text.color)
                                Image(systemName: "arrow.right").font(.system(size: 11)).foregroundStyle(p.textFaint.color)
                                Text(item.display).font(WorkbenchStyle.code(KitTokens.TypeScale.xs)).foregroundStyle(p.textMuted.color)
                                    .lineLimit(1).truncationMode(.head)
                            }
                            if let note = item.note {
                                Text(note).font(WorkbenchStyle.ui(KitTokens.TypeScale.xs)).foregroundStyle(p.textFaint.color)
                            }
                        }
                    }
                }
            }
        }
    }

    static func importWord(_ action: String, withImports: Bool) -> String {
        switch action {
        case "create": return withImports ? "copy" : "skip"
        case "clash": return "clash"
        case "same": return "there"
        default: return "outside"
        }
    }

    static func importColor(_ action: String, withImports: Bool) -> Color {
        switch action {
        case "create": return withImports ? Theme.palette.good.color : Theme.palette.textFaint.color
        case "clash": return WorkbenchStyle.clashColor
        case "same": return Theme.palette.info.color
        default: return Theme.palette.textFaint.color
        }
    }
}

/// One file of a change: what happens to it, its path, and its diff.
struct FileDiffCard: View {
    let file: WorkbenchPlannedFile

    private var p: KitPalette { Theme.palette }

    static func actionColor(_ action: String) -> Color {
        switch action {
        case "create": return Theme.palette.good.color
        case "overwrite": return WorkbenchStyle.clashColor
        case "edit": return Theme.palette.info.color
        case "delete": return Theme.palette.bad.color
        case "link": return WorkbenchStyle.originColor("plugin")
        default: return Theme.palette.textFaint.color
        }
    }

    var body: some View {
        WorkbenchCard(tint: Self.actionColor(file.action)) {
            VStack(alignment: .leading, spacing: KitTokens.Space.s4) {
                HStack(alignment: .firstTextBaseline, spacing: KitTokens.Space.s4) {
                    WorkbenchTag(text: file.action, color: Self.actionColor(file.action))
                    Text(file.display).font(WorkbenchStyle.code(KitTokens.TypeScale.sm, weight: .semibold)).foregroundStyle(p.text.color)
                        .lineLimit(1).truncationMode(.head).textSelection(.enabled)
                    Spacer(minLength: KitTokens.Space.s4)
                    if file.added > 0 { Text("+\(file.added)").font(WorkbenchStyle.code(KitTokens.TypeScale.xs, weight: .bold)).foregroundStyle(p.good.color) }
                    if file.removed > 0 { Text("−\(file.removed)").font(WorkbenchStyle.code(KitTokens.TypeScale.xs, weight: .bold)).foregroundStyle(p.bad.color) }
                }
                if let target = file.target {
                    HStack(spacing: KitTokens.Space.s3) {
                        Text("points at").font(WorkbenchStyle.ui(KitTokens.TypeScale.xs)).foregroundStyle(p.textFaint.color)
                        Text(target).font(WorkbenchStyle.code(KitTokens.TypeScale.xs)).foregroundStyle(p.textBody.color)
                    }
                }
                if let note = file.note {
                    Text(note).font(WorkbenchStyle.ui(KitTokens.TypeScale.xs)).foregroundStyle(p.textMuted.color)
                }
                if !file.lines.isEmpty { DiffBox(lines: file.lines) }
            }
        }
    }
}

/// Diff lines with a sign gutter and a soft wash for added and removed lines.
struct DiffBox: View {
    let lines: [WorkbenchDiffLine]

    private var p: KitPalette { Theme.palette }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(Array(lines.enumerated()), id: \.offset) { _, line in
                HStack(alignment: .firstTextBaseline, spacing: KitTokens.Space.s4) {
                    Text(sign(line.kind))
                        .font(WorkbenchStyle.code(KitTokens.TypeScale.xs, weight: .bold))
                        .foregroundStyle(WorkbenchStyle.diffColor(line.kind))
                        .frame(width: 14, alignment: .center)
                    Text(line.kind == "gap" ? line.text : (line.text.isEmpty ? " " : line.text))
                        .font(line.kind == "gap" ? WorkbenchStyle.ui(KitTokens.TypeScale.xs) : WorkbenchStyle.code(KitTokens.TypeScale.xs))
                        .foregroundStyle(line.kind == "same" ? p.textMuted.color : line.kind == "gap" ? p.textFaint.color : p.text.color)
                        .textSelection(.enabled)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .padding(.horizontal, KitTokens.Space.s4)
                .padding(.vertical, 3)
                .background(wash(line.kind))
            }
        }
        .padding(.vertical, KitTokens.Space.s3)
        .background(RoundedRectangle(cornerRadius: KitTokens.Radius.md).fill(p.inset.color))
        .clipShape(RoundedRectangle(cornerRadius: KitTokens.Radius.md))
    }

    private func sign(_ kind: String) -> String {
        switch kind {
        case "add": return "+"
        case "del": return "−"
        case "gap": return "⋯"
        default: return " "
        }
    }

    private func wash(_ kind: String) -> Color {
        switch kind {
        case "add": return p.good.color.opacity(0.13)
        case "del": return p.bad.color.opacity(0.13)
        default: return .clear
        }
    }
}

/// Tags that wrap onto more lines.
struct FlowTags: View {
    let tags: [String]
    let color: Color

    var body: some View {
        WrapLayout(spacing: KitTokens.Space.s3) {
            ForEach(tags, id: \.self) { tag in
                Text(tag)
                    .font(WorkbenchStyle.code(KitTokens.TypeScale.xs, weight: .semibold))
                    .foregroundStyle(color)
                    .padding(.horizontal, KitTokens.Space.s4)
                    .padding(.vertical, 3)
                    .background(Capsule().fill(color.opacity(0.14)))
            }
        }
    }
}

/// A plain flow layout: left to right, then the next line.
struct WrapLayout: Layout {
    var spacing: CGFloat

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? .infinity
        var x: CGFloat = 0, y: CGFloat = 0, row: CGFloat = 0, widest: CGFloat = 0
        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
            if x > 0, x + size.width > width { x = 0; y += row + spacing; row = 0 }
            x += size.width + spacing
            widest = max(widest, x - spacing)
            row = max(row, size.height)
        }
        return CGSize(width: min(widest, width), height: y + row)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX, y = bounds.minY, row: CGFloat = 0
        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
            if x > bounds.minX, x + size.width > bounds.maxX { x = bounds.minX; y += row + spacing; row = 0 }
            view.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
            x += size.width + spacing
            row = max(row, size.height)
        }
    }
}
