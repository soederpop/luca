import AppKit
import SwiftUI

/// A borderless panel for the shell's own chrome (status line, keys panel,
/// which-key, palette). `keyable` panels can take the keyboard.
final class ShellPanel: NSPanel {
    var keyable = false
    /// A non-activating panel takes the keyboard even while another app is in
    /// front. A quiet check run must never do that: it would swallow what
    /// the person at the Mac is typing.
    override var canBecomeKey: Bool { keyable && !AppFocus.quiet }
    override var canBecomeMain: Bool { false }

    convenience init<Content: View>(keyable: Bool, level: NSWindow.Level, @ViewBuilder content: () -> Content) {
        self.init(contentRect: .zero, styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
        self.keyable = keyable
        isFloatingPanel = true
        self.level = AppFocus.level(level)
        isOpaque = false
        backgroundColor = .clear
        hasShadow = true
        hidesOnDeactivate = false
        isReleasedWhenClosed = false
        collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .ignoresCycle]
        contentView = NSHostingView(rootView: ThemedRoot(content: content())
            .environmentObject(Shell.shared)
            .environmentObject(KeymapStore.shared)
            .environmentObject(ProjectHub.shared))
    }
}

/// Redraws a panel when the colors change; panels hold no page state.
struct ThemedRoot<Content: View>: View {
    let content: Content
    @ObservedObject private var theme = ThemeSettings.shared

    var body: some View { content.id(theme.revision) }
}

// MARK: - Status line

/// The thin window along the bottom of the primary screen.
@MainActor
final class StatusLineController {
    static let shared = StatusLineController()
    private lazy var panel: ShellPanel = {
        let panel = ShellPanel(keyable: true, level: .statusBar) { StatusLineView() }
        // Hide with the app so the bar does not sit over other apps. AppKit
        // shows it again on reactivation. A quiet check run is never active,
        // so it keeps the bar for its screenshots.
        panel.hidesOnDeactivate = !AppFocus.quiet
        return panel
    }()

    func show() {
        reposition()
        panel.orderFrontRegardless()
    }

    func reposition() {
        guard let screen = NSScreen.screens.first else { return }
        let area = screen.visibleFrame
        let frame = CGRect(x: area.minX, y: area.minY, width: area.width, height: KitTokens.Layout.statusLine)
        if panel.frame != frame { panel.setFrame(frame, display: true) }
    }

    /// With no tile open, the status line takes the keyboard so the leader
    /// keys still work.
    func takeKeyIfIdle() {
        guard Shell.shared.focusedId == nil else { return }
        AppFocus.activate()
        panel.makeKeyAndOrderFront(nil)
    }
}

struct StatusLineView: View {
    @EnvironmentObject private var shell: Shell
    @EnvironmentObject private var hub: ProjectHub
    @EnvironmentObject private var keymap: KeymapStore

    private var palette: KitPalette { Theme.palette }

    var body: some View {
        HStack(spacing: KitTokens.Space.s6) {
            Text(shell.mode.label)
                .font(WorkbenchStyle.ui(KitTokens.TypeScale.xs, weight: .bold))
                .foregroundStyle(shell.mode == .normal ? palette.accentOn.color : palette.ground.color)
                .tracking(0.6)
                .padding(.horizontal, KitTokens.Space.s5)
                .frame(maxHeight: .infinity)
                .background(modeColor)
            Text(shell.workspace.mode.label)
                .font(WorkbenchStyle.ui(KitTokens.TypeScale.xs))
                .foregroundStyle(palette.textMuted.color)
            workspaces
            divider
            projects
            if let solo = shell.solo {
                Text("SOLO \(Shell.ownerName(solo))")
                    .font(WorkbenchStyle.ui(KitTokens.TypeScale.xs, weight: .bold))
                    .foregroundStyle(palette.warn.color)
            }
            if !shell.pendingDisplay.isEmpty {
                Text(shell.pendingDisplay)
                    .font(WorkbenchStyle.ui(KitTokens.TypeScale.sm, weight: .semibold))
                    .foregroundStyle(palette.accent.color)
            }
            Spacer(minLength: KitTokens.Space.s4)
            if let message = shell.message {
                Text(message)
                    .font(WorkbenchStyle.ui(KitTokens.TypeScale.xs))
                    .foregroundStyle(palette.textBody.color)
                    .lineLimit(1)
            } else if shell.keysView, let last = shell.lastKey {
                HStack(spacing: KitTokens.Space.s3) {
                    KeyCap(last.keys)
                    Text(last.label)
                        .font(WorkbenchStyle.ui(KitTokens.TypeScale.xs))
                        .foregroundStyle(palette.textMuted.color)
                }
            } else if shell.tiles.isEmpty, let palette = keymap.map.keyLabel(for: "palette.open") {
                Text("\(palette)  palette")
                    .font(WorkbenchStyle.ui(KitTokens.TypeScale.xs))
                    .foregroundStyle(Theme.palette.textFaint.color)
            }
        }
        .padding(.trailing, KitTokens.Space.s4)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(palette.inset.color)
        .overlay(alignment: .top) { Rectangle().fill(palette.border.color).frame(height: 1) }
    }

    private var modeColor: Color {
        switch shell.mode {
        case .normal: return palette.accent.color
        case .insert: return palette.info.color
        case .command: return palette.warn.color
        case .hint: return palette.warn.color
        case .resize: return palette.bad.color
        }
    }

    private var divider: some View {
        Rectangle().fill(palette.border.color).frame(width: 1, height: 18)
    }

    private var workspaces: some View {
        HStack(spacing: KitTokens.Space.s3) {
            ForEach(0..<9, id: \.self) { index in
                let ws = shell.workspaces[index]
                let isCurrent = index == shell.current
                if isCurrent || !ws.isEmpty {
                    // The number to press, then what is there, in its project's color.
                    let label = shell.workspaceLabel(index)
                    let tint = label?.owner.map { Theme.ownerColor($0) } ?? palette.accent.color
                    Button { shell.switchWorkspace(index) } label: {
                        HStack(spacing: KitTokens.Space.s2) {
                            Text("\(index + 1)")
                                .font(WorkbenchStyle.ui(KitTokens.TypeScale.xs, weight: .bold))
                            if let label {
                                Text(label.text)
                                    .font(WorkbenchStyle.ui(KitTokens.TypeScale.xs, weight: isCurrent ? .bold : .regular))
                                    .lineLimit(1)
                            }
                        }
                        .foregroundStyle(isCurrent ? palette.ground.color : tint)
                        .padding(.horizontal, KitTokens.Space.s4)
                        .frame(minWidth: 26)
                        .padding(.vertical, 2)
                        .background(Capsule().fill(isCurrent ? tint : tint.opacity(0.12)))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    /// The projects with tiles open: their color, name and host state.
    private var projects: some View {
        let open = Array(Set(shell.tiles.values.compactMap { ProjectHub.project(ofOwner: $0.owner) })).sorted()
        return HStack(spacing: KitTokens.Space.s5) {
            ForEach(open, id: \.self) { id in
                let status = hub.status[id] ?? .starting
                HStack(spacing: KitTokens.Space.s2) {
                    Circle().fill(Theme.ownerColor(ProjectHub.ownerId(id))).frame(width: 7, height: 7)
                    Text(hub.displayName(id))
                        .font(WorkbenchStyle.ui(KitTokens.TypeScale.xs, weight: .semibold))
                        .foregroundStyle(palette.text.color)
                    Text(status.label)
                        .font(WorkbenchStyle.ui(KitTokens.TypeScale.xs))
                        .foregroundStyle(hostColor(status))
                }
                .help(hostHelp(status))
            }
        }
    }

    /// Running good, starting info, failed bad, stopped faint.
    private func hostColor(_ status: HostStatus) -> Color {
        switch status {
        case .running: return palette.good.color
        case .starting: return palette.info.color
        case .failed: return palette.bad.color
        case .stopped: return palette.textFaint.color
        }
    }

    private func hostHelp(_ status: HostStatus) -> String {
        if case .failed(let line) = status { return line }
        return "workbench host: \(status.label)"
    }
}

// MARK: - Keys panel

/// The keys panel: layout and leader keys for the current mode. Part of
/// the keys view. Reads the live keymap.
@MainActor
final class KeysPanelController {
    static let shared = KeysPanelController()
    private lazy var panel = ShellPanel(keyable: false, level: .floating) { KeysPanelView() }

    static let width: CGFloat = 460
    static let margin: CGFloat = 12
    /// The strip organized mode leaves free on the primary screen while the
    /// keys view is on.
    static let reserved = width + margin

    func update() {
        guard Shell.shared.keysView else { panel.orderOut(nil); return }
        guard let screen = NSScreen.screens.first else { return }
        // The full height beside the tiles, above the status line.
        let height = screen.visibleFrame.height - KitTokens.Layout.statusLine - Self.margin * 2
        let size = CGSize(width: Self.width, height: height)
        let frame = CGRect(x: screen.visibleFrame.maxX - size.width - Self.margin, y: screen.visibleFrame.maxY - size.height - Self.margin, width: size.width, height: size.height)
        if panel.frame != frame { panel.setFrame(frame, display: true) }
        panel.orderFrontRegardless()
    }
}

struct KeysPanelView: View {
    @EnvironmentObject private var shell: Shell
    @EnvironmentObject private var keymap: KeymapStore

    /// One group of keys, with the color its caps wear: the tile kind's
    /// hue for the tile's keys, one hue per shell scope.
    struct Section {
        let title: String
        let rows: [KeyBinding]
        let color: Color
    }

    private var sections: [Section] {
        let map = keymap.map
        let p = Theme.palette
        var out: [Section] = []
        switch shell.mode {
        case .resize:
            out.append(Section(title: "Resize", rows: map.bindings(in: .resize), color: p.bad.color))
        case .normal:
            if let content = shell.focusedTile?.content, let host = content.webHost, !host.pageKeys.isEmpty {
                let rows = host.pageKeys.map { key in
                    KeyBinding(action: "page.\(key.spec)", keys: KeySequence([key.stroke]), spec: key.spec, label: key.label, scope: .kind, kind: content.kindId)
                }
                out.append(Section(title: "This page", rows: rows, color: Theme.kindColor(content.kindId)))
            }
            if let content = shell.focusedTile?.content, !content.declaredKeys.isEmpty {
                let rows = content.declaredKeys.map { key in
                    KeyBinding(action: "declared.\(key.action)", keys: KeySequence([key.stroke]), spec: key.spec, label: key.label, scope: .kind, kind: content.kindId)
                }
                out.append(Section(title: "This tool's actions", rows: rows, color: Theme.kindColor("luca-tool")))
            }
            if let kind = shell.focusedTile?.content.kindId {
                let rows = map.kindBindings(kind)
                if !rows.isEmpty { out.append(Section(title: "\(TileKinds.kind(kind)?.label ?? kind) tile", rows: rows, color: Theme.kindColor(kind))) }
            }
            out.append(Section(title: "Leader", rows: map.bindings(in: .leader), color: p.accent.color))
            out.append(Section(title: "Normal", rows: map.bindings(in: .normal) + map.bindings(in: .global), color: p.info.color))
        default:
            out.append(Section(title: "Any mode", rows: map.bindings(in: .global), color: p.info.color))
        }
        // Workspace keys fold into two rows.
        let layout = map.bindings(in: .layout).filter { !$0.action.hasPrefix("workspace.") }
        out.append(Section(title: "Layout · \(Shell.shared.workspace.mode.label)", rows: layout, color: p.syntax.type.color))
        return out
    }

    var body: some View {
        let p = Theme.palette
        VStack(alignment: .leading, spacing: WorkbenchStyle.Gap.card) {
            HStack(alignment: .firstTextBaseline, spacing: KitTokens.Space.s4) {
                Text("Keys")
                    .font(WorkbenchStyle.ui(KitTokens.TypeScale.lg, weight: .bold))
                    .foregroundStyle(p.text.color)
                Text(shell.mode.label.lowercased())
                    .font(WorkbenchStyle.caption())
                    .foregroundStyle(p.accent.color)
                Spacer()
                if let toggle = keymap.map.keyLabel(for: "keys.toggle.anywhere") {
                    KeyCap(toggle, small: true)
                    Text("hide").font(WorkbenchStyle.caption(weight: .regular)).foregroundStyle(p.textFaint.color)
                }
            }
            ScrollView {
                VStack(alignment: .leading, spacing: WorkbenchStyle.Gap.section - KitTokens.Space.s2) {
                    ForEach(sections, id: \.title) { section in
                        VStack(alignment: .leading, spacing: KitTokens.Space.s3) {
                            sectionTitle(section.title, color: section.color)
                            ForEach(section.rows, id: \.action) { row in
                                keyRow(row.display(modSymbol: keymap.map.modSymbol), row.label, color: section.color)
                            }
                        }
                    }
                    workspaceRows
                    VStack(alignment: .leading, spacing: KitTokens.Space.s3) {
                        sectionTitle("Also", color: p.textFaint.color)
                        keyRow("⌃w …", "a layout key, without \(keymap.map.modSymbol)", color: nil)
                        keyRow("Esc", "back to normal", color: nil)
                        keyRow("3 j", "a count repeats a key", color: nil)
                    }
                }
                .padding(.trailing, KitTokens.Space.s4)
            }
        }
        .padding(WorkbenchStyle.Gap.card + KitTokens.Space.s2)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(RoundedRectangle(cornerRadius: KitTokens.Radius.lg).fill(p.surface.color.opacity(0.97)))
        .overlay(RoundedRectangle(cornerRadius: KitTokens.Radius.lg).stroke(p.borderStrong.color))
    }

    private func sectionTitle(_ title: String, color: Color) -> some View {
        HStack(spacing: KitTokens.Space.s3) {
            Circle().fill(color).frame(width: 8, height: 8)
            Text(title)
                .font(WorkbenchStyle.ui(KitTokens.TypeScale.xs, weight: .semibold))
                .foregroundStyle(color)
        }
        .padding(.bottom, KitTokens.Space.s1)
    }

    private var workspaceRows: some View {
        let map = keymap.map
        let go = map.bindings(in: .layout).filter { $0.action.hasPrefix("workspace.go.") }
        let send = map.bindings(in: .layout).filter { $0.action.hasPrefix("workspace.send.") }
        let tint = Theme.palette.syntax.number.color
        return VStack(alignment: .leading, spacing: KitTokens.Space.s3) {
            sectionTitle("Workspaces", color: tint)
            keyCaps(go.map { $0.display(modSymbol: map.modSymbol) }, "go to", tint: tint)
            keyCaps(send.map { $0.display(modSymbol: map.modSymbol) }, "send tile to", tint: tint)
        }
    }

    private func keyRow(_ keys: String, _ label: String, color: Color?) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: KitTokens.Space.s5) {
            KeyCap(keys, small: true, tint: color).frame(width: 118, alignment: .leading)
            Text(label)
                .font(WorkbenchStyle.ui(KitTokens.TypeScale.xs))
                .foregroundStyle(Theme.palette.textBody.color)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private func keyCaps(_ keys: [String], _ label: String, tint: Color) -> some View {
        VStack(alignment: .leading, spacing: KitTokens.Space.s2) {
            Text(label).font(WorkbenchStyle.ui(KitTokens.TypeScale.xs)).foregroundStyle(Theme.palette.textBody.color)
            HStack(spacing: 3) { ForEach(keys, id: \.self) { KeyCap($0, small: true, tint: tint) } }
        }
    }
}

// MARK: - Which-key

/// After a pause on a chord, the keys that can come next.
@MainActor
final class WhichKeyController {
    static let shared = WhichKeyController()
    private lazy var panel = ShellPanel(keyable: false, level: .floating) { WhichKeyView() }

    func update() {
        let rows = Shell.shared.whichKey
        guard !rows.isEmpty, let screen = NSScreen.screens.first else { panel.orderOut(nil); return }
        let columns = 3
        let height = CGFloat((rows.count + columns - 1) / columns) * 30 + 56
        let width = min(1100, screen.visibleFrame.width - 40)
        let frame = CGRect(x: screen.visibleFrame.midX - width / 2, y: screen.visibleFrame.minY + KitTokens.Layout.statusLine + 12, width: width, height: height)
        panel.setFrame(frame, display: true)
        panel.orderFrontRegardless()
    }
}

struct WhichKeyView: View {
    @EnvironmentObject private var shell: Shell

    var body: some View {
        VStack(alignment: .leading, spacing: KitTokens.Space.s4) {
            Text(shell.pendingDisplay)
                .font(Theme.chrome(KitTokens.TypeScale.sm, weight: .bold))
                .foregroundStyle(Theme.palette.accent.color)
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), alignment: .leading), count: 3), alignment: .leading, spacing: 4) {
                ForEach(Array(shell.whichKey.enumerated()), id: \.offset) { _, row in
                    HStack(spacing: KitTokens.Space.s3) {
                        KeyCap(row.keys, tint: Theme.palette.accent.color)
                        Text(row.label).font(WorkbenchStyle.ui(KitTokens.TypeScale.xs)).foregroundStyle(Theme.palette.textBody.color).lineLimit(1)
                    }
                }
            }
        }
        .padding(KitTokens.Space.s5)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(RoundedRectangle(cornerRadius: KitTokens.Radius.lg).fill(Theme.palette.raised.color))
        .overlay(RoundedRectangle(cornerRadius: KitTokens.Radius.lg).stroke(Theme.palette.borderStrong.color))
    }
}
