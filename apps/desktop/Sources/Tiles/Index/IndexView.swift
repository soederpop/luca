import SwiftUI

/// The card stacks. A wide tile shows every stack side by side; a narrow
/// one shows as many as fit, down to one, and keeps the stack in focus on
/// screen. The card in focus grows to show its first lines.
struct IndexView: View {
    @ObservedObject var model: IndexContent
    @FocusState private var filterFocused: Bool

    private var p: KitPalette { Theme.palette }

    var body: some View {
        VStack(spacing: 0) {
            if model.filtering || !model.state.filter.isEmpty { filterBar }
            let groups = model.state.groups(order: model.groupOrder)
            if !groups.isEmpty { groupBar(groups) }
            if let notice = model.notice {
                Text(notice)
                    .font(WorkbenchStyle.meta)
                    .foregroundStyle(p.warn.color)
                    .lineLimit(2)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, WorkbenchStyle.Gap.card)
                    .padding(.vertical, KitTokens.Space.s4)
            }
            if let error = model.error {
                Text(error)
                    .font(WorkbenchStyle.meta)
                    .foregroundStyle(p.bad.color)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, WorkbenchStyle.Gap.card)
                    .padding(.vertical, KitTokens.Space.s4)
            }
            GeometryReader { proxy in
                let state = model.state
                let shown = state.shown
                let visible = state.visibleStackIndices(width: proxy.size.width - WorkbenchStyle.Gap.card * 2)
                if !model.loaded && model.error == nil {
                    ProgressView().controlSize(.small).frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if shown.isEmpty {
                    Text(model.emptyNote)
                        .font(WorkbenchStyle.body)
                        .foregroundStyle(Color.kitFaint)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    HStack(alignment: .top, spacing: WorkbenchStyle.Gap.card) {
                        ForEach(visible, id: \.self) { index in
                            StackColumn(model: model, stack: shown[index], focused: index == state.stackIndex,
                                        focusedCard: index == state.stackIndex ? state.focusedCard?.id : nil)
                                // One stack alone keeps a readable width.
                                .frame(maxWidth: visible.count == 1 ? WorkbenchStyle.Size.stackMax : .infinity)
                        }
                    }
                    .padding(WorkbenchStyle.Gap.card)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                    .overlay(alignment: .bottomTrailing) {
                        if visible.count < shown.count {
                            Text("\(state.stackIndex + 1) of \(shown.count) stacks")
                                .font(WorkbenchStyle.meta)
                                .foregroundStyle(Color.kitFaint)
                                .padding(KitTokens.Space.s3)
                        }
                    }
                }
            }
        }
        .background(p.surface.color)
        .onChange(of: model.filterTick) { _, _ in filterFocused = true }
        // SwiftUI keeps its own focus state; drop it too, or the field takes
        // the keyboard back and the next card keys type into it.
        .onChange(of: model.filtering) { _, on in if !on { filterFocused = false } }
    }

    /// The groups as chips: every card, then each group with its count.
    private func groupBar(_ groups: [IndexGroup]) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: KitTokens.Space.s4) {
                GroupChip(label: "All", count: model.state.total, color: p.textMuted.color, on: model.state.group == nil) { model.setGroup(nil) }
                ForEach(groups) { group in
                    GroupChip(label: group.label, count: group.count, color: WorkbenchStyle.originColor(group.id),
                              on: model.state.group == group.id) { model.setGroup(group.id) }
                        .modifier(GroupKey(action: group.id == "own" || group.id == "plugin" ? "lucaRegistry.own" : nil))
                }
                Color.clear.frame(width: 1, height: 1).keyBadge("lucaRegistry.origin")
            }
            .padding(.horizontal, WorkbenchStyle.Gap.card)
            .padding(.top, KitTokens.Space.s5)
            .padding(.bottom, KitTokens.Space.s2)
        }
    }

    private var filterBar: some View {
        HStack(spacing: KitTokens.Space.s3) {
            Text("/")
                .font(Theme.chrome(KitTokens.TypeScale.sm, weight: .bold))
                .foregroundStyle(p.accent.color)
            TextField("filter cards", text: $model.state.filter)
                .textFieldStyle(.plain)
                .font(Theme.chrome(KitTokens.TypeScale.sm))
                .foregroundStyle(p.text.color)
                .focused($filterFocused)
                .onSubmit {
                    filterFocused = false
                    model.endFilter()
                }
            Spacer()
            Text("\(model.state.shown.reduce(0) { $0 + $1.count }) cards")
                .font(Theme.chrome(KitTokens.TypeScale.xs))
                .foregroundStyle(Color.kitFaint)
        }
        .padding(.horizontal, KitTokens.Space.s5)
        .frame(height: 38)
        .background(p.inset.color)
        .overlay(alignment: .bottom) { Rectangle().fill(p.border.color).frame(height: 1) }
        .keyBadge("index.filter")
    }
}

private struct GroupKey: ViewModifier {
    let action: String?
    func body(content: Content) -> some View {
        if let action { content.keyBadge(action) } else { content }
    }
}

/// One choice of the group bar. The one that is on is filled in its color.
private struct GroupChip: View {
    let label: String
    let count: Int
    let color: Color
    let on: Bool
    let action: () -> Void

    var body: some View {
        let p = Theme.palette
        Button(action: action) {
            HStack(spacing: KitTokens.Space.s3) {
                Circle().fill(color).frame(width: 8, height: 8)
                Text(label)
                    .font(WorkbenchStyle.ui(KitTokens.TypeScale.xs, weight: on ? .semibold : .regular))
                    .foregroundStyle(on ? p.text.color : p.textMuted.color)
                Text("\(count)")
                    .font(WorkbenchStyle.ui(WorkbenchStyle.Size.caption, weight: .bold).monospacedDigit())
                    .foregroundStyle(on ? color : p.textFaint.color)
            }
            .padding(.horizontal, KitTokens.Space.s5)
            .padding(.vertical, KitTokens.Space.s3)
            .background(Capsule().fill(on ? color.opacity(0.18) : p.inset.color.opacity(0.6)))
            .overlay(Capsule().stroke(on ? color.opacity(0.7) : p.border.color, lineWidth: on ? 1.5 : 1))
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
    }
}

private struct StackColumn: View {
    @ObservedObject var model: IndexContent
    let stack: IndexStack
    let focused: Bool
    let focusedCard: String?

    private var p: KitPalette { Theme.palette }
    private var tone: Color? { stack.tone.flatMap(WorkbenchStyle.toneColor) }

    var body: some View {
        VStack(alignment: .leading, spacing: WorkbenchStyle.Gap.row) {
            header
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: WorkbenchStyle.Gap.row) {
                        if stack.cards.isEmpty {
                            Text("Nothing here")
                                .font(WorkbenchStyle.meta)
                                .foregroundStyle(Color.kitFaint)
                                .padding(KitTokens.Space.s4)
                        }
                        ForEach(stack.cards) { card in
                            CardView(card: card, focused: card.id == focusedCard,
                                     tone: (card.tone ?? stack.tone).flatMap(WorkbenchStyle.toneColor))
                                .id(card.id)
                                .onTapGesture(count: 2) { model.select(card.id); model.openFocused() }
                                .onTapGesture { model.select(card.id) }
                                .modifier(CardHint(enabled: focused, card: card, model: model))
                        }
                    }
                    .padding(.horizontal, KitTokens.Space.s2)
                    .padding(.bottom, WorkbenchStyle.Gap.card)
                }
                .onChange(of: focusedCard) { _, id in
                    if let id { withAnimation(.easeOut(duration: KitTokens.Motion.fast)) { proxy.scrollTo(id, anchor: .center) } }
                }
            }
        }
        .padding(.horizontal, KitTokens.Space.s4)
        .padding(.top, KitTokens.Space.s5)
        .frame(minWidth: CardStackState.columnWidth - KitTokens.Space.s4, maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(
            RoundedRectangle(cornerRadius: KitTokens.Radius.lg)
                .fill(focused ? p.inset.color.opacity(0.9) : p.inset.color.opacity(0.45))
        )
        .overlay(
            RoundedRectangle(cornerRadius: KitTokens.Radius.lg)
                .stroke(focused ? (tone ?? p.accent.color).opacity(0.35) : p.border.color.opacity(0.6))
        )
    }

    /// The stack's name in its color, with a count pill.
    private var header: some View {
        HStack(spacing: KitTokens.Space.s4) {
            RoundedRectangle(cornerRadius: 2)
                .fill(tone ?? p.textFaint.color)
                .frame(width: 4, height: 18)
            Text(stack.title)
                .font(WorkbenchStyle.ui(KitTokens.TypeScale.md, weight: .semibold))
                .foregroundStyle(focused ? p.text.color : p.textBody.color)
                .lineLimit(1)
            CountPill(count: stack.count, color: tone ?? p.textMuted.color)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, KitTokens.Space.s3)
        .padding(.bottom, KitTokens.Space.s2)
    }
}

/// Hint mode reaches the cards of the stack in focus.
private struct CardHint: ViewModifier {
    let enabled: Bool
    let card: IndexCard
    let model: IndexContent

    func body(content: Content) -> some View {
        if enabled {
            content.hintTarget("card:\(card.id)", in: model.hints) { model.select(card.id); model.openFocused() }
        } else {
            content
        }
    }
}

private struct CardView: View {
    let card: IndexCard
    let focused: Bool
    /// The stack's color: a bar on the card's left edge.
    var tone: Color? = nil

    private var p: KitPalette { Theme.palette }

    /// The preview, unless it only repeats the subtitle.
    private var preview: String? {
        guard let preview = card.preview?.trimmingCharacters(in: .whitespacesAndNewlines), !preview.isEmpty else { return nil }
        // Hosts often send the summary as the subtitle and the same text,
        // longer, as the preview.
        if let subtitle = card.subtitle {
            let head = String(subtitle.prefix(28)).trimmingCharacters(in: CharacterSet(charactersIn: "….").union(.whitespaces))
            if !head.isEmpty, preview.hasPrefix(head) || subtitle.hasPrefix(preview) { return nil }
        }
        return preview
    }

    private var titleText: some View {
        Text(card.title)
            .font(WorkbenchStyle.ui(KitTokens.TypeScale.md, weight: .semibold))
            .foregroundStyle(focused ? p.text.color : p.textBody.color)
    }

    @ViewBuilder private var badgeTag: some View {
        if let badge = card.badge {
            WorkbenchTag(text: badge, color: badgeColor(badge))
                .lineLimit(1)
                .fixedSize()
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: KitTokens.Space.s3) {
            // Name and badge on one line when the whole name fits. In a narrow
            // column the badge drops under the name, so a long identifier
            // is not cut to a few letters or broken inside a word.
            ViewThatFits(in: .horizontal) {
                HStack(alignment: .firstTextBaseline, spacing: KitTokens.Space.s4) {
                    titleText.lineLimit(1).fixedSize()
                    Spacer(minLength: 0)
                    badgeTag
                }
                VStack(alignment: .leading, spacing: KitTokens.Space.s2) {
                    titleText.lineLimit(focused ? 3 : 1).truncationMode(.middle)
                    badgeTag
                }
            }
            if let subtitle = card.subtitle {
                // In focus, a prose subtitle gives way to the longer preview it starts.
                let full = focused && !card.subtitleIsCode && preview == nil ? (card.preview ?? subtitle) : subtitle
                Text(full.isEmpty ? subtitle : full)
                    .font(card.subtitleIsCode ? WorkbenchStyle.code(KitTokens.TypeScale.xs) : WorkbenchStyle.meta)
                    .foregroundStyle(card.subtitleIsCode ? p.textFaint.color : p.textMuted.color)
                    .lineLimit(card.subtitleIsCode ? 1 : (focused ? 6 : 2))
                    .truncationMode(card.subtitleIsCode ? .middle : .tail)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if let preview {
                Text(preview)
                    .font(WorkbenchStyle.meta)
                    .foregroundStyle(p.textMuted.color)
                    .lineLimit(focused ? 6 : 2)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, KitTokens.Space.s1)
            }
        }
        .padding(.vertical, KitTokens.Space.s5)
        .padding(.horizontal, KitTokens.Space.s5)
        .padding(.leading, tone == nil ? 0 : KitTokens.Space.s2)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: KitTokens.Radius.md)
                .fill(focused ? p.raised.color : p.surface.color)
        )
        .overlay(alignment: .leading) {
            if let tone {
                UnevenRoundedRectangle(topLeadingRadius: KitTokens.Radius.md, bottomLeadingRadius: KitTokens.Radius.md)
                    .fill(tone.opacity(focused ? 1 : 0.7))
                    .frame(width: 4)
            }
        }
        .overlay(
            RoundedRectangle(cornerRadius: KitTokens.Radius.md)
                .stroke(focused ? (tone ?? p.accent.color) : p.border.color, lineWidth: focused ? 1.5 : 1)
        )
        .shadow(color: focused ? p.shadow.color : .clear, radius: 8, y: 3)
        .contentShape(Rectangle())
        .animation(.easeOut(duration: KitTokens.Motion.fast), value: focused)
    }

    /// Origin tags in their origin color; status words in their status
    /// color; a card's own tone over both.
    private func badgeColor(_ badge: String) -> Color {
        if let origin = card.badgeTone { return WorkbenchStyle.originColor(origin) }
        if let own = card.tone.flatMap(WorkbenchStyle.toneColor), card.tone?.hasPrefix("slot:") == false { return own }
        return WorkbenchStyle.statusColor(badge)
    }
}
