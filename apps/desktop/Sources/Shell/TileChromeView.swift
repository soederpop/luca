import SwiftUI

/// Everything around a tile's body: the 22pt header, the focus border, the
/// key strip and the hint labels.
struct TileChromeView: View {
    let tile: Tile
    @ObservedObject var content: TileContent
    @ObservedObject var hints: HintRegistry
    @EnvironmentObject private var shell: Shell
    @EnvironmentObject private var keymap: KeymapStore
    @ObservedObject private var theme = ThemeSettings.shared

    private var focused: Bool { shell.focusedId == tile.id }
    private var palette: KitPalette { Theme.palette }
    /// Each project's tiles wear that project's color: the header band, the
    /// name, the border and a light wash over the body.
    private var ownerColor: Color { Theme.ownerColor(tile.owner) }

    var body: some View {
        VStack(spacing: 0) {
            header
            // Native bodies read the palette when they draw, so a color
            // change rebuilds them. A web body keeps its page: the host
            // bridge tells the page instead, with no reload.
            content.body
                .id(content.webHost == nil ? theme.revision : -1)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            if shell.keysView {
                KeyStrip(kind: content.kindId, mode: focused ? shell.mode : .normal, ownsEscape: focused && content.passesEscape())
            }
        }
        .background(palette.surface.color)
        .overlayPreferenceValue(HintAnchorKey.self) { anchors in
            HintOverlay(registry: hints, anchors: anchors)
        }
        .overlay {
            // The project's color over the whole tile, light enough to read through.
            Rectangle().fill(ownerColor.opacity(0.045)).allowsHitTesting(false)
        }
        .overlay {
            // Other tiles dim a little.
            Rectangle().fill(Color.black.opacity(focused ? 0 : 0.14)).allowsHitTesting(false)
        }
        .clipShape(RoundedRectangle(cornerRadius: KitTokens.Radius.md))
        .overlay(
            RoundedRectangle(cornerRadius: KitTokens.Radius.md)
                .strokeBorder(focused ? ownerColor : ownerColor.opacity(0.3), lineWidth: KitTokens.Layout.focusRing)
        )
        .overlay {
            // A group: a dashed line in the project color, inside the focus ring.
            if shell.group(of: tile.id) != nil {
                RoundedRectangle(cornerRadius: KitTokens.Radius.md)
                    .inset(by: KitTokens.Layout.focusRing + 1)
                    .stroke(ownerColor.opacity(0.85), style: StrokeStyle(lineWidth: 1.5, dash: [5, 4]))
                    .allowsHitTesting(false)
            }
        }
        .animation(.easeOut(duration: KitTokens.Motion.fast), value: focused)
    }

    private var header: some View {
        HStack(spacing: KitTokens.Space.s3) {
            Text(Shell.ownerName(tile.owner))
                .font(WorkbenchStyle.ui(WorkbenchStyle.Size.caption, weight: .bold))
                .foregroundStyle(palette.ground.color)
                .lineLimit(1)
                .fixedSize()
                .padding(.horizontal, KitTokens.Space.s3 + 1)
                .padding(.vertical, 2)
                .background(Capsule().fill(ownerColor))
            Image(systemName: tile.kind?.glyph ?? "square")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Theme.kindColor(content.kindId))
                .padding(.leading, KitTokens.Space.s2)
            Text(content.title)
                .font(WorkbenchStyle.ui(KitTokens.TypeScale.sm, weight: focused ? .semibold : .medium))
                .foregroundStyle(focused ? palette.text.color : palette.textMuted.color)
                .lineLimit(1)
                .truncationMode(.middle)
            Spacer(minLength: KitTokens.Space.s4)
            if let note = shell.headerNote(for: tile.id) {
                Text(note)
                    .font(WorkbenchStyle.meta)
                    .foregroundStyle(palette.info.color)
            }
            if let state = content.stateLabel {
                Text(state)
                    .font(WorkbenchStyle.caption(weight: .medium))
                    .foregroundStyle(WorkbenchStyle.statusColor(state))
                    .lineLimit(1)
            }
            Button {
                shell.close(tile.id)
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(palette.textFaint.color)
                    .frame(width: 22, height: 22)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .keyBadge("layout.close", leading: true)
            .hintTarget("tile.close", in: hints) { shell.close(tile.id) }
        }
        .padding(.horizontal, KitTokens.Space.s4)
        .frame(height: KitTokens.Layout.tileHeader + 4)
        .background(TileDragHandle(tileId: tile.id))
        .background(ownerColor.opacity(focused ? 0.16 : 0.07))
        .background(palette.raised.color)
        .overlay(alignment: .bottom) { Rectangle().fill(focused ? ownerColor.opacity(0.7) : palette.border.color).frame(height: 1) }
    }
}

/// The keys that work in this tile right now, from the live keymap.
struct KeyStrip: View {
    let kind: String
    let mode: InputMode
    /// `Esc` goes to the tile's editor (a terminal, a page with every key).
    var ownsEscape = false
    @EnvironmentObject private var keymap: KeymapStore

    private var rows: [(String, String)] {
        let map = keymap.map
        let sym = map.modSymbol
        switch mode {
        case .insert, .command:
            // There `Esc` belongs to the editor; its own key leaves.
            var out = ownsEscape && mode == .insert
                ? [(map.keyLabel(for: "terminal.leave") ?? "Esc", "normal mode")]
                : [("Esc", "normal mode")]
            if let keys = map.keyLabel(for: "keys.toggle.anywhere") { out.append((keys, "keys view")) }
            return out
        case .resize:
            return [("Esc", "done")] + map.bindings(in: .resize).map { ($0.display(modSymbol: sym), $0.label) }
        case .hint:
            return [("Esc", "cancel"), ("a-z", "type a label")]
        case .normal:
            let kindRows = map.kindBindings(kind)
            let taken = Set(kindRows.compactMap(\.keys))
            let tileRows = map.bindings(in: .tile).filter { !taken.contains($0.keys!) }
            return (kindRows + tileRows).map { ($0.display(modSymbol: sym), $0.label) }
        }
    }

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: KitTokens.Space.s6) {
                ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
                    HStack(spacing: KitTokens.Space.s3) {
                        KeyCap(row.0, small: true)
                        Text(row.1)
                            .font(WorkbenchStyle.caption(weight: .regular))
                            .foregroundStyle(Theme.palette.textFaint.color)
                            .lineLimit(1)
                    }
                }
            }
            .padding(.horizontal, KitTokens.Space.s5)
        }
        .frame(height: 36)
        .background(Theme.palette.inset.color)
        .overlay(alignment: .top) { Rectangle().fill(Theme.palette.border.color).frame(height: 1) }
    }
}
