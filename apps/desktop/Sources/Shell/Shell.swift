import AppKit
import Combine

/// The window manager. Owns the tiles, the nine workspaces, the input mode
/// and the key router, and turns key actions into window changes.
@MainActor
final class Shell: ObservableObject {
    static let shared = Shell()

    struct LastKey: Equatable {
        let keys: String
        let label: String
    }

    @Published private(set) var tiles: [UUID: Tile] = [:]
    @Published var workspaces: [Workspace] = Array(repeating: Workspace(), count: 9)
    @Published private(set) var current = 0
    @Published private(set) var focusedId: UUID?
    @Published private(set) var mode: InputMode = .normal
    /// The keys view. On at first launch; the choice is saved.
    @Published private(set) var keysView = true
    @Published private(set) var pendingDisplay = ""
    @Published private(set) var lastKey: LastKey?
    /// A short note in the status line (an error, "next tile opens right").
    @Published private(set) var message: String?
    /// Solo: only this owner's (project's) tiles are on screen.
    @Published private(set) var solo: String?
    /// The which-key rows, after a pause on a chord.
    @Published private(set) var whichKey: [(keys: String, label: String)] = []
    /// `Mod-g` was pressed: the next direction key picks the tile to group with.
    @Published private(set) var groupPending = false

    let keymap = KeymapStore.shared
    let palette = PaletteModel()

    private var router: KeyRouter
    private var hintTile: UUID?
    private var whichKeyTask: Task<Void, Never>?
    private var messageTask: Task<Void, Never>?
    private var saveTask: Task<Void, Never>?
    private var cancellables = Set<AnyCancellable>()
    private var restoring = false
    private var groupSyncTask: Task<Void, Never>?
    /// Bumped when a web tile's page keys change, so the keys view redraws.
    @Published var pageKeysTick = 0
    /// The tile whose window is the parent of its group's child windows.
    private var groupParents: [UUID: UUID] = [:]

    static let gap = KitTokens.Layout.tileGap

    private init() {
        router = KeyRouter(keymap: KeymapStore.shared.map)
        keymap.$map
            .sink { [weak self] map in
                self?.router.keymap = map
                if let warning = map.warnings.first { self?.flash(warning) }
            }
            .store(in: &cancellables)
    }

    var focusedTile: Tile? { focusedId.flatMap { tiles[$0] } }
    var workspace: Workspace { workspaces[current] }

    // MARK: - Opening and closing

    /// Open a tile for an address. Returns its id, or nil for an unknown kind.
    /// `near` opens it beside that tile (on that tile's workspace), and
    /// `group` puts the two in one group.
    @discardableResult
    func open(_ uri: TileURI, workspace index: Int? = nil, focus: Bool = true, near: UUID? = nil, group: Bool = false) -> UUID? {
        guard let content = makeContent(uri) else {
            flash("No tile '\(uri.kind)' in Luca Desktop")
            return nil
        }
        let tile = Tile(id: UUID(), content: content)
        let nearWs = near.flatMap { workspaceIndex(of: $0) }
        let ws = nearWs ?? index ?? current
        var frame = newTileFrame(in: ws)
        if let near, nearWs != nil {
            if let beside = workspaces[ws].frames[near] { frame = Self.besideFrame(beside, size: frame.size) }
            // Organized mode splits the slot of the tile in focus.
            workspaces[ws].focused = near
        }
        attach(tile, frame: frame)
        workspaces[ws].add(tile.id, frame: frame)
        if let near, nearWs != nil, group {
            workspaces[ws].join(near, with: tile.id, toward: .right)
        }
        if !focus, let near, nearWs != nil { workspaces[ws].focused = near }
        if ws == current {
            // Solo hides other projects' tiles; a new one would open as a
            // loose window over them, or not show at all. Solo ends instead.
            if let solo, tile.owner != solo {
                self.solo = nil
                flash("Solo off: \(Self.ownerName(tile.owner)) opened")
            }
            applyLayout(animated: true)
            if focus { focusTile(tile.id) }
        }
        scheduleSave()
        return tile.id
    }

    /// The content for an address, with its owner: `luca:<project>` for
    /// `luca://`, `app` for `app://`. Nil for an unknown kind.
    func makeContent(_ uri: TileURI) -> TileContent? {
        guard let kind = TileKinds.kind(for: uri) else { return nil }
        return kind.make(uri, Self.owner(of: uri))
    }

    nonisolated static let appOwner = "app"

    nonisolated static func owner(of uri: TileURI) -> String {
        uri.project.map(ProjectHub.ownerId) ?? appOwner
    }

    /// The name a tile's header and the status line show for its owner.
    static func ownerName(_ owner: String) -> String {
        ProjectHub.project(ofOwner: owner).map { ProjectHub.shared.displayName($0) } ?? "desktop"
    }

    /// A tile holds its project's host while it is open.
    private func hold(_ owner: String) {
        if let project = ProjectHub.project(ofOwner: owner) { ProjectHub.shared.acquire(project) }
    }

    private func letGo(_ owner: String) {
        if let project = ProjectHub.project(ofOwner: owner) { ProjectHub.shared.release(project) }
    }

    /// Wire a tile's window and host. Used by open and by restore.
    func attach(_ tile: Tile, frame: CGRect) {
        tiles[tile.id] = tile
        tile.controller = TileWindowController(tile: tile, frame: frame)
        hold(tile.owner)
        tile.content.start()
        tile.content.$uri
            .dropFirst()
            .sink { [weak self] _ in self?.scheduleSave() }
            .store(in: &cancellables)
    }

    func close(_ id: UUID) {
        guard let tile = tiles[id], let ws = workspaceIndex(of: id) else { return }
        detachGroupWindows()
        tile.content.stop()
        tile.controller?.close()
        tile.controller = nil
        tiles[id] = nil
        letGo(tile.owner)
        workspaces[ws].remove(id)
        if ws == current {
            applyLayout(animated: true)
            if let next = workspaces[ws].focused, visibleTiles.contains(next) { focusTile(next) }
            else { focusedId = nil; StatusLineController.shared.takeKeyIfIdle() }
        }
        scheduleSave()
    }

    /// Free-mode frames for `count` tiles in one column beside `anchor`,
    /// stacked top to bottom, the anchor's height. The column goes right of
    /// the anchor, else left of it. When neither side has room, the anchor
    /// gives up its right half, so neither covers the other.
    static func columnBeside(_ anchor: CGRect, screen: CGRect, count: Int, width wanted: CGFloat) -> (anchor: CGRect, column: [CGRect]) {
        let width = min(wanted, max(360, anchor.width))
        var kept = anchor
        var column: CGRect
        if screen.maxX - (anchor.maxX + gap) >= width {
            column = CGRect(x: anchor.maxX + gap, y: anchor.minY, width: width, height: anchor.height)
        } else if anchor.minX - gap - screen.minX >= width {
            column = CGRect(x: anchor.minX - gap - width, y: anchor.minY, width: width, height: anchor.height)
        } else {
            let half = ((anchor.width - gap) / 2).rounded(.down)
            kept.size.width = half
            column = CGRect(x: anchor.minX + half + gap, y: anchor.minY, width: anchor.width - half - gap, height: anchor.height)
        }
        let n = max(1, count)
        let height = ((column.height - gap * CGFloat(n - 1)) / CGFloat(n)).rounded(.down)
        let rows = (0..<n).map { i in
            CGRect(x: column.minX, y: column.maxY - CGFloat(i + 1) * height - CGFloat(i) * gap, width: column.width, height: height).integral
        }
        return (kept.integral, rows)
    }

    /// Open tiles beside `near` without taking the keyboard from it: in a
    /// free workspace as one column (`columnBeside`), in an organized one
    /// as splits of its slot.
    func openBeside(_ uris: [TileURI], near: UUID) {
        guard let ws = workspaceIndex(of: near), workspaces[ws].mode == .free,
              let anchor = workspaces[ws].frames[near] else {
            for uri in uris { open(uri, focus: false, near: near) }
            return
        }
        let ids = uris.compactMap { open($0, focus: false, near: near) }
        guard !ids.isEmpty else { return }
        let screen = Self.screen(containing: anchor)?.visibleFrame ?? Self.primaryArea
        let width = max(760, min(1280, Self.primaryArea.width * 0.5))
        let placed = Self.columnBeside(anchor, screen: screen, count: ids.count, width: width)
        workspaces[ws].frames[near] = placed.anchor
        for (id, frame) in zip(ids, placed.column) { workspaces[ws].frames[id] = frame }
        if ws == current { applyLayout(animated: true) }
        scheduleSave()
    }

    /// A free-mode frame to the right of `rect`, or to its left when the
    /// screen ends, the same height.
    static func besideFrame(_ rect: CGRect, size: CGSize) -> CGRect {
        let screen = screen(containing: rect)?.visibleFrame ?? primaryArea
        let width = min(size.width, max(360, rect.width))
        var frame = CGRect(x: rect.maxX + gap, y: rect.minY, width: width, height: rect.height)
        if frame.maxX > screen.maxX { frame.origin.x = max(screen.minX, rect.minX - gap - width) }
        return frame.integral
    }

    private func newTileFrame(in ws: Int) -> CGRect {
        // Half the screen wide, so an index shows a few stacks at the app's
        // text size. Never smaller than the old fixed size.
        let whole = Self.primaryArea
        let size = CGSize(width: max(760, min(1280, whole.width * 0.5)), height: max(620, min(1000, whole.height * 0.72)))
        if let focused = workspaces[ws].focused, let rect = workspaces[ws].frames[focused] {
            // Cascade from the tile in focus, kept on its screen.
            let screen = Self.screen(containing: rect)?.visibleFrame ?? Self.primaryArea
            var frame = CGRect(x: rect.minX + 32, y: rect.maxY - 32 - size.height, width: size.width, height: size.height)
            if frame.maxX > screen.maxX { frame.origin.x = screen.minX + 40 }
            if frame.minY < screen.minY { frame.origin.y = screen.maxY - size.height - 40 }
            return frame.integral
        }
        let area = Self.primaryArea
        return CGRect(x: area.midX - size.width / 2, y: area.midY - size.height / 2, width: size.width, height: size.height).integral
    }

    // MARK: - Focus

    func focusTile(_ id: UUID) {
        guard let tile = tiles[id], let ws = workspaceIndex(of: id) else { return }
        if ws != current { switchWorkspace(ws) }
        if workspaces[ws].mode == .organized, workspaces[ws].tree?.contains(id) == true {
            // Bring it to the front of its stack.
            workspaces[ws].tree = workspaces[ws].tree?.activating(id)
            applyLayout(animated: false)
        }
        workspaces[ws].focused = id
        focusedId = id
        AppFocus.activate()
        tile.controller?.window.makeKeyAndOrderFront(nil)
    }

    func tileDidBecomeKey(_ id: UUID) {
        guard let ws = workspaceIndex(of: id), ws == current else { return }
        if focusedId != id {
            focusedId = id
            workspaces[ws].focused = id
            if mode == .hint || mode == .resize { setMode(.normal) }
        }
    }

    private var visibleTiles: [UUID] {
        workspace.visibleTiles(soloFilter)
    }

    private var soloFilter: (UUID) -> Bool {
        guard let solo else { return { _ in true } }
        return { [tiles] id in tiles[id]?.owner == solo }
    }

    private func focus(_ direction: Direction) {
        guard let from = focusedId else { return }
        if let next = workspace.neighbor(of: from, direction, gap: Self.gap, visible: visibleTiles) {
            focusTile(next)
        }
    }

    // MARK: - Layout

    /// Set every window's frame and visibility from the workspaces.
    func applyLayout(animated: Bool) {
        // Children follow a parent's frame; while the shell sets frames
        // itself they must not, or they land twice and save the wrong place.
        detachGroupWindows()
        let area = organizedArea(for: current)
        workspaces[current].applyTree(in: area, gap: Self.gap, visible: solo == nil ? nil : soloFilter)
        let shown = Set(visibleTiles)
        for (index, ws) in workspaces.enumerated() {
            for id in ws.tiles {
                guard let controller = tiles[id]?.controller else { continue }
                if index == current, shown.contains(id) {
                    if let frame = ws.frames[id] { controller.setFrame(frame, animated: animated && !restoring) }
                    // Free tiles get a soft shadow; organized ones sit flat.
                    controller.window.hasShadow = ws.mode == .free || ws.floating.contains(id)
                    if !controller.window.isVisible { AppFocus.front(controller.window) }
                    if ws.floating.contains(id) { AppFocus.front(controller.window) }
                } else if controller.window.isVisible {
                    controller.window.orderOut(nil)
                }
            }
        }
        scheduleGroupSync(after: animated ? KitTokens.Motion.fast + 0.08 : 0)
        StatusLineController.shared.reposition()
    }

    /// The rect organized mode tiles: the workspace's display, minus the
    /// status line on the primary screen.
    func organizedArea(for index: Int) -> CGRect {
        let screen = workspaces[index].display.flatMap(Self.screen(number:)) ?? NSScreen.screens.first
        guard let screen else { return CGRect(x: 0, y: 0, width: 1440, height: 900) }
        var area = screen.visibleFrame
        if screen == NSScreen.screens.first {
            area.origin.y += KitTokens.Layout.statusLine
            area.size.height -= KitTokens.Layout.statusLine
            // The keys panel sits on the right of this screen: tile beside it,
            // not under it.
            if keysView { area.size.width -= KeysPanelController.reserved }
        }
        return area
    }

    static var primaryArea: CGRect {
        guard let screen = NSScreen.screens.first else { return CGRect(x: 0, y: 0, width: 1440, height: 900) }
        var area = screen.visibleFrame
        area.origin.y += KitTokens.Layout.statusLine
        area.size.height -= KitTokens.Layout.statusLine
        return area
    }

    static func screen(number: UInt32) -> NSScreen? {
        NSScreen.screens.first { $0.displayNumber == number }
    }

    static func screen(containing rect: CGRect) -> NSScreen? {
        let center = CGPoint(x: rect.midX, y: rect.midY)
        return NSScreen.screens.first { $0.frame.contains(center) }
            ?? NSScreen.screens.max { $0.frame.intersection(rect).area < $1.frame.intersection(rect).area }
    }

    private func toggleMode() {
        var ws = workspaces[current]
        if ws.mode == .free {
            // Organized mode tiles the display the tile in focus is on.
            let anchor = ws.focused.flatMap { ws.frames[$0] }
            ws.display = (anchor.flatMap(Self.screen(containing:)) ?? NSScreen.screens.first)?.displayNumber
            workspaces[current].display = ws.display
        }
        let area = organizedArea(for: current)
        ws.toggleMode(in: area, gap: Self.gap)
        workspaces[current] = ws
        applyLayout(animated: true)
        flash("Workspace \(current + 1): \(ws.mode.label)")
        scheduleSave()
    }

    /// `Mod-Shift-h/j/k/l`. A grouped tile moves with its whole group.
    private func move(_ direction: Direction) {
        guard let id = focusedId else { return }
        detachGroupWindows()
        var ws = workspaces[current]
        if ws.mode == .organized, ws.tree?.contains(id) == true, !ws.isGrouped(id) {
            guard let other = ws.neighbor(of: id, direction, gap: Self.gap, visible: visibleTiles) else { return }
            ws.tree = ws.tree?.swapping(id, other)
        } else {
            // Free (or floating): snap to that half of its screen.
            let box = Neighbors.bounds(ws.members(of: id).compactMap { ws.frames[$0] }) ?? .zero
            let screen = Self.screen(containing: box) ?? NSScreen.screens.first
            var area = screen?.visibleFrame ?? Self.primaryArea
            if screen == NSScreen.screens.first {
                area.origin.y += KitTokens.Layout.statusLine
                area.size.height -= KitTokens.Layout.statusLine
            }
            ws.moveGroup(of: id, direction, half: Neighbors.half(of: area, direction, gap: Self.gap), gap: Self.gap, visible: visibleTiles)
            if ws.mode == .free || ws.floating.contains(id) {
                for m in ws.members(of: id) { if let frame = ws.frames[m] { tiles[m]?.controller?.setFrame(frame, animated: true) } }
            }
        }
        workspaces[current] = ws
        applyLayout(animated: true)
        scheduleSave()
    }

    /// `Mod-z`: the tile and its group fill the workspace (organized) or
    /// the tile's screen (free), and back.
    private func zoom() {
        guard let id = focusedId else { return }
        detachGroupWindows()
        var ws = workspaces[current]
        let screen = Self.screen(containing: ws.frames[id] ?? .zero)
        let area = screen.map { $0 == NSScreen.screens.first ? Self.primaryArea : $0.visibleFrame } ?? Self.primaryArea
        ws.toggleZoom(id, in: area, gap: Self.gap)
        workspaces[current] = ws
        if ws.mode == .free {
            for m in ws.members(of: id) { if let frame = ws.frames[m] { tiles[m]?.controller?.setFrame(frame, animated: true) } }
        }
        applyLayout(animated: true)
        scheduleSave()
    }

    private func resize(_ direction: Direction, grow: Bool) {
        guard let id = focusedId else { return }
        var ws = workspaces[current]
        if ws.mode == .organized, let tree = ws.tree, tree.contains(id) {
            ws.tree = tree.resizing(id, toward: direction, by: grow ? 0.05 : -0.05)
            workspaces[current] = ws
            applyLayout(animated: true)
        } else if var frame = ws.frames[id] {
            let step: CGFloat = grow ? 40 : -40
            switch direction {
            case .left: frame.origin.x -= step; frame.size.width += step
            case .right: frame.size.width += step
            case .up: frame.size.height += step
            case .down: frame.origin.y -= step; frame.size.height += step
            }
            guard frame.width >= 220, frame.height >= 120 else { return }
            ws.frames[id] = frame
            workspaces[current] = ws
            tiles[id]?.controller?.setFrame(frame, animated: true)
        }
        scheduleSave()
    }

    /// `Space X`: ask, then close every tile on all nine workspaces.
    func confirmBlankSlate() {
        guard !tiles.isEmpty else { return flash("Already a blank slate") }
        let count = tiles.count
        PaletteController.shared.confirm("Close all \(count) tile\(count == 1 ? "" : "s") on every workspace? Saved layouts stay.", yes: "Close everything") { [weak self] in
            self?.blankSlate()
        }
    }

    /// Back to the first-launch state: nine empty workspaces, workspace 1.
    /// The keymap and the saved layouts are files, so they are not touched.
    func blankSlate() {
        for id in Array(tiles.keys) { close(id) }
        // Fresh workspaces too: an empty one still holds its mode and layout.
        workspaces = Array(repeating: Workspace(), count: 9)
        solo = nil
        current = 0
        focusedId = nil
        applyLayout(animated: false)
        StatusLineController.shared.takeKeyIfIdle()
        flash("Blank slate")
        scheduleSave()
    }

    func switchWorkspace(_ index: Int) {
        guard index != current, workspaces.indices.contains(index) else { return }
        current = index
        applyLayout(animated: false)
        if let id = workspaces[index].focused ?? visibleTiles.first, tiles[id] != nil {
            focusedId = id
            AppFocus.activate()
            tiles[id]?.controller?.window.makeKeyAndOrderFront(nil)
        } else {
            focusedId = nil
            StatusLineController.shared.takeKeyIfIdle()
        }
        scheduleSave()
    }

    /// Send a tile, with its group, to another workspace. The group stays a group.
    private func send(_ id: UUID, to index: Int) {
        guard index != current, workspaces[current].frames[id] != nil else { return }
        let members = workspaces[current].members(of: id)
        for m in members {
            guard let frame = workspaces[current].frames[m] else { continue }
            workspaces[current].remove(m)
            workspaces[index].add(m, frame: frame)
        }
        if members.count > 1 {
            workspaces[index].groups.removeAll { !Set($0).isDisjoint(with: members) }
            workspaces[index].groups.append(members)
            workspaces[index].gatherGroups()
        }
        applyLayout(animated: true)
        if let next = workspaces[current].focused, tiles[next] != nil { focusTile(next) } else { focusedId = nil }
        flash("Sent to workspace \(index + 1)")
        scheduleSave()
    }

    func workspaceIndex(of id: UUID) -> Int? {
        workspaces.firstIndex { $0.tiles.contains(id) }
    }

    /// Stack position for the header: `2/3`. Nil outside a stack.
    func headerNote(for id: UUID) -> String? {
        guard let ws = workspaceIndex(of: id), let tree = workspaces[ws].tree else { return nil }
        func find(_ node: LayoutNode) -> String? {
            switch node {
            case .stack(let ids, let active) where ids.contains(id):
                return "\(min(active, ids.count - 1) + 1)/\(ids.count)"
            case .split(_, _, let a, let b): return find(a) ?? find(b)
            default: return nil
            }
        }
        if workspaces[ws].floating.contains(id) { return "float" }
        return find(tree)
    }

    // MARK: - Window events

    func tileWindowMoved(_ id: UUID, frame: CGRect) {
        guard let ws = workspaceIndex(of: id) else { return }
        let w = workspaces[ws]
        guard w.mode == .free || w.floating.contains(id) else { return }
        workspaces[ws].frames[id] = frame
        if let z = w.zoomed, w.members(of: z).contains(id) { workspaces[ws].zoomed = nil; workspaces[ws].zoomRestore = [:] }
        scheduleSave()
    }

    /// A tile in the tree was resized by its edge: the tree wins.
    func tileWindowEndedResize(_ id: UUID) {
        guard let ws = workspaceIndex(of: id), ws == current,
              workspaces[ws].mode == .organized, !workspaces[ws].floating.contains(id) else { return }
        applyLayout(animated: true)
    }

    /// Organized mode: a drag onto another tile swaps the two, onto an edge
    /// splits there. Off any tile, the tile goes back to its slot.
    func tileDragEnded(_ id: UUID, at point: CGPoint) {
        guard let ws = workspaceIndex(of: id), workspaces[ws].mode == .organized,
              !workspaces[ws].floating.contains(id) else { return }
        workspaces[ws].drop(id, at: point)
        applyLayout(animated: true)
        scheduleSave()
    }

    // MARK: - Modes

    func setMode(_ next: InputMode) {
        if mode == .hint, next != .hint, let id = hintTile { tiles[id]?.content.hints.end(); hintTile = nil }
        router.mode = next
        router.reset()
        if mode != next { mode = next }
        pendingDisplay = ""
        hideWhichKey()
    }

    /// Insert when a text field has the keyboard, Normal when not. The other
    /// modes are entered and left by keys only.
    func syncTextMode(window: NSWindow? = nil) {
        guard mode == .normal || mode == .insert else { return }
        if PaletteController.shared.isActive { return }
        // The event's own window first: keyWindow is nil while the app is
        // not frontmost, which would drop typed letters into Normal mode.
        let target = window ?? NSApp.keyWindow ?? focusedTile?.controller?.window
        let textFocused = target?.firstResponder is NSTextView || (focusedTile?.content.editorHasKeyboard ?? false)
        if textFocused && mode == .normal { setMode(.insert) }
        if !textFocused && mode == .insert { setMode(.normal) }
    }

    func toggleKeysView() {
        keysView.toggle()
        KeysPanelController.shared.update()
        applyLayout(animated: true)
        flash(keysView ? "Keys view on" : "Keys view off")
        scheduleSave()
    }

    func flash(_ text: String) {
        message = text
        messageTask?.cancel()
        messageTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(4))
            guard !Task.isCancelled else { return }
            self?.message = nil
        }
    }

    // MARK: - Keys

    /// Every key down in the app comes here first. True when it was used.
    func handle(_ event: NSEvent) -> Bool {
        // A system sheet or alert owns its own keys.
        if NSApp.modalWindow != nil { return false }
        let raw = UInt(event.modifierFlags.rawValue)
        guard let stroke = KeyStroke.from(keyCode: event.keyCode, characters: event.charactersIgnoringModifiers, rawFlags: raw, modKey: keymap.map.modKey) else { return false }
        if groupPending {
            groupPending = false
            hideWhichKey()
            if let direction = groupDirection(for: stroke) { groupWithNeighbor(direction) } else { flash("Group cancelled") }
            return true
        }

        if PaletteController.shared.isActive {
            if mode != .command { setMode(.command) }
            if PaletteController.shared.handle(stroke) { return true }
            if case .action(let id, let count) = router.route(stroke, kind: nil), id == "keys.toggle.anywhere" {
                perform(id, count: count)
                return true
            }
            return false
        }
        if mode == .command { setMode(.normal) }
        syncTextMode(window: event.window)

        // Shift-Return adds a line in a chat composer or the console. Without this, the
        // SwiftUI field treats Shift-Return like Return and sends the message.
        if event.keyCode == 36 || event.keyCode == 76,
           event.modifierFlags.intersection(.deviceIndependentFlagsMask) == .shift,
           ["luca-chat", "luca-console"].contains(focusedTile?.content.kindId ?? ""),
           let editor = event.window?.firstResponder as? NSTextView {
            editor.insertNewlineIgnoringFieldEditor(nil)
            return true
        }

        // A paste goes to the tile first, when it has a use for the pasteboard.
        if stroke.cmd, stroke.key == "v", !stroke.shift, !stroke.ctrl, !stroke.mod,
           let tile = focusedTile, tile.content.paste(NSPasteboard.general) {
            return true
        }

        // The source editor's `Esc` belongs to the page (vim Insert, the `:`
        // line). The page hands it back when it has no use for it.
        if stroke == KeyRouter.escape, !router.isPending, let tile = focusedTile, tile.content.passesEscape() {
            return false
        }

        // A web page's own keys (`data-key`) win over tile
        // keys in that tile, but not over the leader, `:`, `?` or `Esc`.
        if mode == .normal, !router.isPending, stroke != KeyRouter.escape,
           let host = focusedTile?.content.webHost, let key = host.key(for: stroke),
           !keymap.map.startsShellChord(stroke) {
            host.press(key)
            lastKey = LastKey(keys: stroke.display(modSymbol: keymap.map.modSymbol), label: key.label)
            return true
        }

        // A project tool's declared keys. `ToolKeys` already left out every
        // key the app or the tile kind has, so these never shadow one.
        if mode == .normal, !router.isPending, stroke != KeyRouter.escape,
           let content = focusedTile?.content, let key = content.declaredKeys.first(where: { $0.stroke == stroke }),
           !keymap.map.startsShellChord(stroke) {
            content.pressDeclared(key)
            lastKey = LastKey(keys: stroke.display(modSymbol: keymap.map.modSymbol), label: key.label)
            return true
        }

        let kind = focusedTile?.content.kindId
        let result = router.route(stroke, kind: kind)
        defer { pendingDisplay = router.pendingDisplay }
        switch result {
        case .action(let id, let count):
            hideWhichKey()
            record(stroke: stroke, action: id)
            perform(id, count: count)
            return true
        case .pending:
            scheduleWhichKey()
            return true
        case .passThrough:
            // `Mod` keys belong to the app, never to an editor page.
            if stroke.mod, focusedTile?.content.editorHasKeyboard == true { return true }
            return false
        case .swallow:
            hideWhichKey()
            return true
        case .escape:
            hideWhichKey()
            escape()
            return true
        case .hint(let key):
            guard let id = hintTile, let tile = tiles[id] else { setMode(.normal); return true }
            switch tile.content.hints.type(key.key) {
            case .fired: setMode(.normal)
            case .narrowed: break
            case .missed: flash("No hint '\(key.key)'")
            }
            return true
        }
    }

    private func record(stroke: KeyStroke, action: String) {
        let binding = keymap.map.binding(for: action)
        let keys = binding?.display(modSymbol: keymap.map.modSymbol) ?? stroke.display(modSymbol: keymap.map.modSymbol)
        lastKey = LastKey(keys: keys, label: binding?.label ?? action)
    }

    private func escape() {
        switch mode {
        case .insert:
            // Leave the text field. The tile keeps focus.
            if let window = NSApp.keyWindow ?? focusedTile?.controller?.window { window.makeFirstResponder(nil) }
            focusedTile?.content.didLeaveInsert()
            setMode(.normal)
        case .hint, .resize, .command:
            setMode(.normal)
        case .normal:
            setMode(.normal)
        }
    }

    /// A tile's editor gave the keys back (the source tile's `Esc` in vim
    /// Normal): leave it and go to Normal mode, as `Esc` from a text field does.
    func leaveEditor() {
        if let window = focusedTile?.controller?.window ?? NSApp.keyWindow { window.makeFirstResponder(nil) }
        focusedTile?.content.didLeaveInsert()
        setMode(.normal)
    }

    private func scheduleWhichKey() {
        whichKeyTask?.cancel()
        let kind = focusedTile?.content.kindId
        whichKeyTask = Task { [weak self] in
            try? await Task.sleep(for: .milliseconds(450))
            guard let self, !Task.isCancelled, self.router.isPending else { return }
            self.whichKey = self.router.continuations(kind: kind)
            WhichKeyController.shared.update()
        }
    }

    private func hideWhichKey() {
        whichKeyTask?.cancel()
        if !whichKey.isEmpty {
            whichKey = []
            WhichKeyController.shared.update()
        }
    }

    // MARK: - Actions

    /// Run an action by id. Layout and shell actions are here; anything else
    /// goes to the tile in focus.
    func perform(_ action: String, count: Int?) {
        let parts = action.split(separator: ".").map(String.init)
        let direction = parts.last.flatMap(Direction.init(rawValue:))
        let focused = focusedId

        switch action {
        case "layout.mode.toggle": toggleMode()
        case "layout.float.toggle":
            guard let id = focused, workspace.mode == .organized else { return flash("Float works in organized mode") }
            workspaces[current].toggleFloat(id)
            applyLayout(animated: true)
            scheduleSave()
        case _ where action.hasPrefix("layout.focus."): if let direction { focus(direction) }
        case _ where action.hasPrefix("layout.move."): if let direction { move(direction) }
        case "layout.split.right", "layout.split.below":
            guard workspace.mode == .organized else { return flash("No tree in free mode") }
            workspaces[current].nextSplit = action.hasSuffix("right") ? .horizontal : .vertical
            flash(action.hasSuffix("right") ? "Next tile opens to the right" : "Next tile opens below")
        case "layout.stack.toggle":
            guard let id = focused, workspace.mode == .organized, let tree = workspace.tree else { return flash("No tree in free mode") }
            workspaces[current].tree = tree.togglingStack(at: id)
            applyLayout(animated: true)
            scheduleSave()
        case "layout.split.rotate":
            guard let id = focused, workspace.mode == .organized, let tree = workspace.tree else { return flash("No tree in free mode") }
            let rotated = tree.rotatingSplit(at: id)
            guard rotated != tree else { return flash("This tile is not in a split") }
            workspaces[current].tree = rotated
            applyLayout(animated: true)
            scheduleSave()
        case "layout.stack.prev", "layout.stack.next":
            guard let id = focused, workspace.mode == .organized, let tree = workspace.tree else { return flash("No tree in free mode") }
            let (next, front) = tree.cyclingStack(at: id, by: action.hasSuffix("next") ? 1 : -1)
            workspaces[current].tree = next
            applyLayout(animated: false)
            if let front { focusTile(front) }
            scheduleSave()
        case "layout.zoom": zoom()
        case "layout.close":
            guard let id = focused else { return }
            for m in workspace.members(of: id) { close(m) }
        case "layout.group":
            guard focused != nil else { return }
            groupPending = true
            whichKey = groupDirections()
            WhichKeyController.shared.update()
            flash("Group with which tile? \(whichKey.map(\.keys).joined(separator: " "))")
        case "layout.ungroup":
            guard let id = focused, workspace.isGrouped(id) else { return flash("This tile is not in a group") }
            workspaces[current].ungroup(id)
            applyLayout(animated: true)
            flash("Ungrouped")
            scheduleSave()
        case "layout.solo.pick":
            pickSolo()
        case "layout.resize":
            guard focused != nil else { return }
            setMode(.resize)
        case "layout.solo":
            setSolo(solo != nil ? nil : focusedTile?.owner)
        case _ where action.hasPrefix("workspace.go."):
            if let n = Int(parts.last ?? "") { switchWorkspace(n - 1) }
        case _ where action.hasPrefix("workspace.send."):
            if let n = Int(parts.last ?? ""), let id = focused { send(id, to: n - 1) }

        case "keys.toggle", "keys.toggle.anywhere": toggleKeysView()
        case "command.open": PaletteController.shared.show(.command)
        case "palette.open": PaletteController.shared.show(.all)
        case "palette.projects": PaletteController.shared.show(.projects)
        case "projects.open": openOrFocus(TileURI.app("projects"))
        case "luca.project": openProjectTool("project", prompt: "which project")
        case "luca.registry": openRegistry()
        case "luca.console": openConsole()
        case "luca.command": pickCommand()
        case "luca.plugins": openPlugins()
        case "luca.endpoints": openEndpoints()
        case "projects.remote": openRemoteProject()
        case "luca.ai": openProjectTool("ai", prompt: "AI setup of which project")
        case "luca.servers": openProjectTool("servers", prompt: "servers of which project")
        case "luca.docs": openProjectTool("docs", prompt: "docs of which project")
        case "luca.models": openProjectTool("models", prompt: "doc models of which project")
        case "luca.contentbase": openProjectTool("contentbase", prompt: "contentbase of which project")
        case "luca.assistants": openProjectTool("assistants", prompt: "assistants of which project")
        case "luca.chat": withProject("new chat in which project") { WorkbenchChat.pickAssistant(project: $0) }
        case "luca.scaffold": withProject("scaffold a helper in which project") { [weak self] in self?.scaffold(in: $0) }
        case "projects.new": bootstrapProject()
        case "luca.terminal": openProjectTool("terminal", prompt: "terminal in which project")
        case "luca.file": withProject("a file of which project") { [weak self] in self?.pickFile(in: $0) }
        case "luca.page": withProject("a web page of which project") { [weak self] in self?.askPage(in: $0) }
        case "luca.tools": withProject("tools of which project") { [weak self] in self?.pickTool(in: $0) }
        case "layouts.pick": pickLayout()
        case "theme.pick": pickTheme()
        case "layout.blank": confirmBlankSlate()

        case "tile.scroll.down": focusedTile?.controller?.scroll(.lines(count ?? 1))
        case "tile.scroll.up": focusedTile?.controller?.scroll(.lines(-(count ?? 1)))
        case "tile.page.down": focusedTile?.controller?.scroll(.halfPages(count ?? 1))
        case "tile.page.up": focusedTile?.controller?.scroll(.halfPages(-(count ?? 1)))
        case "tile.top": focusedTile?.controller?.scroll(.top)
        case "tile.bottom": focusedTile?.controller?.scroll(.bottom)
        case "tile.copyLink":
            guard let tile = focusedTile else { return }
            NSPasteboard.general.clearContents()
            NSPasteboard.general.setString(tile.uri.description, forType: .string)
            flash("Copied \(tile.uri)")
        case "hint.start":
            guard let tile = focusedTile else { return }
            if tile.content.hints.begin() {
                hintTile = tile.id
                setMode(.hint)
            } else {
                flash("Nothing to hint in this tile")
            }

        case "resize.left", "resize.down", "resize.up", "resize.right":
            if let direction { resize(direction, grow: true) }
        case "resize.shrink.left", "resize.shrink.down", "resize.shrink.up", "resize.shrink.right":
            if let direction { resize(direction, grow: false) }
        case "resize.balance":
            if workspace.mode == .organized, let tree = workspace.tree {
                workspaces[current].tree = tree.balanced()
                applyLayout(animated: true)
                scheduleSave()
            }

        case "terminal.leave":
            // The terminal, and a web tile that has every key (`i`).
            if focusedTile?.content.editorHasKeyboard == true { leaveEditor() }

        default:
            if let tile = focusedTile, tile.content.perform(action) { return }
            flash("'\(keymap.map.binding(for: action)?.label ?? action)' does nothing here")
        }
    }

    // MARK: - Groups

    /// The keys that may follow `Mod-g`: the focus keys, with or without Mod,
    /// so a rebinding of focus moves these too.
    private func groupDirections() -> [(keys: String, label: String)] {
        Direction.allCases.compactMap { d in
            guard var stroke = keymap.map.binding(for: "layout.focus.\(d.rawValue)")?.keys?.strokes.first else { return nil }
            stroke.mod = false
            return (stroke.display(modSymbol: keymap.map.modSymbol), "group with the tile \(d == .left ? "to the left" : d == .right ? "to the right" : d == .up ? "above" : "below")")
        }
    }

    private func groupDirection(for stroke: KeyStroke) -> Direction? {
        Direction.allCases.first { d in
            guard let bound = keymap.map.binding(for: "layout.focus.\(d.rawValue)")?.keys?.strokes.first else { return false }
            return bound == stroke || bound == stroke.withMod
        }
    }

    private func groupWithNeighbor(_ direction: Direction) {
        guard let id = focusedId,
              let other = workspace.neighbor(of: id, direction, gap: Self.gap, visible: visibleTiles) else { return flash("No tile that way") }
        workspaces[current].join(id, with: other, toward: direction)
        applyLayout(animated: true)
        flash("Grouped \(workspace.members(of: id).count) tiles")
        scheduleSave()
    }

    /// The group a tile is in, on its workspace. Nil when it has none.
    func group(of id: UUID) -> [UUID]? {
        guard let ws = workspaceIndex(of: id), workspaces[ws].isGrouped(id) else { return nil }
        return workspaces[ws].members(of: id)
    }

    /// Put two open tiles in one group (a companion that opened earlier).
    func join(_ id: UUID, with other: UUID) {
        guard let ws = workspaceIndex(of: id), workspaceIndex(of: other) == ws else { return }
        workspaces[ws].join(id, with: other, toward: .right)
        if ws == current { applyLayout(animated: true) }
        scheduleSave()
    }

    /// Free mode: the group's other tiles are child windows of one member,
    /// so a drag moves them all. Organized mode, a hidden member or no
    /// group: plain windows, as the tree sets every frame itself.
    private func detachGroupWindows() {
        groupSyncTask?.cancel()
        for (child, parent) in groupParents {
            if let c = tiles[child]?.controller?.window, let p = tiles[parent]?.controller?.window { p.removeChildWindow(c) }
        }
        groupParents = [:]
    }

    /// Attach once the frames have landed (after the move animation).
    private func scheduleGroupSync(after delay: Double) {
        groupSyncTask?.cancel()
        groupSyncTask = Task { [weak self] in
            if delay > 0 { try? await Task.sleep(for: .seconds(delay)) }
            guard !Task.isCancelled else { return }
            self?.syncGroupWindows()
        }
    }

    private func syncGroupWindows() {
        let ws = workspaces[current]
        let shown = Set(visibleTiles)
        var wanted: [UUID: UUID] = [:]
        if ws.mode == .free {
            for group in ws.groups where group.allSatisfy(shown.contains) {
                let parent = groupParents[group[0]].flatMap { group.contains($0) ? $0 : nil } ?? group[0]
                for m in group where m != parent { wanted[m] = parent }
            }
        }
        for (child, parent) in groupParents where wanted[child] != parent {
            if let c = tiles[child]?.controller?.window, let p = tiles[parent]?.controller?.window { p.removeChildWindow(c) }
        }
        for (child, parent) in wanted where groupParents[child] != parent {
            if let c = tiles[child]?.controller?.window, let p = tiles[parent]?.controller?.window { p.addChildWindow(c, ordered: .above) }
        }
        groupParents = wanted
    }

    /// A drag is starting on a grouped tile: make it the group's parent
    /// window, so the rest follow it whichever member is dragged.
    func tileDragWillBegin(_ id: UUID) {
        guard let ws = workspaceIndex(of: id), ws == current, workspaces[ws].mode == .free, workspaces[ws].isGrouped(id) else { return }
        let group = workspaces[ws].members(of: id)
        for (child, parent) in groupParents where group.contains(child) {
            if let c = tiles[child]?.controller?.window, let p = tiles[parent]?.controller?.window { p.removeChildWindow(c) }
            groupParents[child] = nil
        }
        groupParents[id] = nil
        for m in group where m != id {
            if let c = tiles[m]?.controller?.window, let p = tiles[id]?.controller?.window { p.addChildWindow(c, ordered: .above) }
            groupParents[m] = id
        }
    }

    // MARK: - Solo

    private func setSolo(_ owner: String?) {
        solo = owner
        if let owner, let focused = focusedTile, focused.owner != owner {
            if let first = visibleTiles.first { focusTile(first) } else { focusedId = nil }
        }
        applyLayout(animated: true)
        flash(solo.map { "Solo: \(Self.ownerName($0))" } ?? "Solo off")
    }

    /// `Mod-Shift-o`: pick which project to solo, from those with tiles open.
    private func pickSolo() {
        let owners = Array(Set(tiles.values.map(\.owner))).sorted { Self.ownerName($0) < Self.ownerName($1) }
        guard !owners.isEmpty else { return flash("No tiles open") }
        var items = owners.map { id in
            PaletteChoice(title: Self.ownerName(id), detail: solo == id ? "solo now" : "\(tiles.values.filter { $0.owner == id }.count) tiles") { [weak self] in
                self?.setSolo(id)
            }
        }
        if solo != nil { items.insert(PaletteChoice(title: "Show every project", detail: "solo off") { [weak self] in self?.setSolo(nil) }, at: 0) }
        PaletteController.shared.choose("solo which project", items)
    }

    // MARK: - Commands (`:`)

    func runCommand(_ line: String) {
        let words = line.trimmingCharacters(in: .whitespaces).split(separator: " ", maxSplits: 1).map(String.init)
        guard let verb = words.first else { return }
        let rest = words.count > 1 ? words[1].trimmingCharacters(in: .whitespaces) : ""
        // The tile in focus first: a doc takes `:w`, a chat `:say`.
        if let tile = focusedTile, tile.content.runCommand(verb, rest) { return }
        switch verb {
        case "q", "close": perform("layout.close", count: nil)
        case "blank": perform("layout.blank", count: nil)
        case "open", "o":
            guard let uri = TileURI(rest) else { return flash("Not a luca:// or app:// address: \(rest)") }
            open(uri)
        case "open-project", "project":
            openProject(path: rest)
        case "ws", "workspace":
            if let n = Int(rest), (1...9).contains(n) { switchWorkspace(n - 1) } else { flash("Workspaces are 1 to 9") }
        case "mode":
            let target = WorkspaceMode(rawValue: rest)
            if target == nil || target != workspace.mode { toggleMode() }
        case "keys": toggleKeysView()
        case "set":
            guard let scheme = ThemeSettings.Scheme(rawValue: rest) else { return flash("Usage: set dark | light | system (or vim | novim in a doc)") }
            ThemeSettings.shared.set(scheme)
            flash("Scheme: \(scheme.rawValue)")
        case "theme":
            guard !rest.isEmpty else { return pickTheme() }
            let id = rest.lowercased().replacingOccurrences(of: " ", with: "-")
            guard ThemeSettings.shared.setTheme(id == "default" ? nil : id) else {
                return flash("No theme '\(rest)'. Try: default, " + KitTokens.themes.map(\.id).joined(separator: ", "))
            }
            flash("Theme: \(ThemeSettings.shared.themeLabel)")
        case "solo": perform("layout.solo", count: nil)
        case "projects": openOrFocus(TileURI.app("projects"))
        case "portfolio": openPortfolioChat()
        case "file", "f":
            withProject("a file of which project") { [weak self] project in
                if rest.isEmpty { self?.pickFile(in: project) } else { self?.openOrFocus(FileContent.address(project: project, path: rest)) }
            }
        case "page":
            withProject("a web page of which project") { [weak self] project in
                if rest.isEmpty { self?.askPage(in: project) } else { self?.openOrFocus(PageContent.address(project: project, typed: rest)) }
            }
        case "canvas":
            withProject("a canvas of which project") { [weak self] project in
                let id = CanvasContent.slug(rest)
                self?.openOrFocus(CanvasContent.address(project: project, id: id.isEmpty ? "canvas" : id))
            }
        case "guide", "tour":
            // A scripted chat the host runs with no model: the assistant is `guide:<id>`.
            withProject("the guide in which project") { [weak self] project in
                let id = rest.isEmpty ? "onboarding" : CanvasContent.slug(rest)
                _ = self?.open(WorkbenchChat.newChat(project: project, assistant: "guide:" + id), near: self?.focusedId)
            }
        case "bootstrap", "new-project":
            bootstrapProject(path: rest)
        case "scaffold":
            // `:scaffold [type] [name]`
            withProject("scaffold a helper in which project") { [weak self] project in
                let words = rest.split(separator: " ").map(String.init)
                self?.scaffold(in: project, type: words.first, name: words.count > 1 ? words[1] : nil)
            }
        case "new-doc":
            // `:new-doc [Model] [title]`: the docs tile's `n` from the command line.
            withProject("a new document in which project") { [weak self] project in
                LucaDocsContent.newDocument(project: project, typed: rest, near: self?.focusedId)
            }
        case "chat", "assistant":
            // `:chat` picks an assistant; `:chat <name>` starts a chat with it. Tab completes the name.
            withProject("new chat in which project") { [weak self] project in
                if rest.isEmpty { WorkbenchChat.pickAssistant(project: project) }
                else { _ = self?.open(WorkbenchChat.newChat(project: project, assistant: rest), near: self?.focusedId) }
            }
        case "edit-assistant":
            // `:edit-assistant <name>` opens the assistant editor; with no name the palette picks one. Tab completes the name.
            withProject("edit an assistant of which project") { [weak self] project in
                if rest.isEmpty { WorkbenchChat.pickAssistant(project: project, toEdit: true) }
                else { _ = self?.open(AssistantEditorContent.address(project: project, assistant: rest), near: self?.focusedId) }
            }
        case "terminal", "term":
            openProjectTool("terminal", prompt: "terminal in which project")
        case "setup":
            withProject("run luca setup in which project") { [weak self] project in
                _ = self?.open(TerminalContent.setupAddress(project: project), near: self?.focusedId)
            }
        case "keymap":
            if rest == "edit" { return openFile("keymap.yml") }
            keymap.reload(force: true)
            flash("Keymap reloaded from \(TilesPaths.keymap.path)")
        case "edit", "e":
            guard !rest.isEmpty else { return flash("Usage: edit keymap | <file under \(TilesPaths.root.path)>") }
            openFile(rest == "keymap" ? "keymap.yml" : rest)
        case "layout":
            runLayoutCommand(rest)
        default:
            if keymap.map.binding(for: verb) != nil { perform(verb, count: nil) }
            else { flash("Unknown command: \(verb)") }
        }
    }

    /// One of the app's own files in a source tile: the keymap, a layout.
    private func openFile(_ path: String) {
        openOrFocus(TileURI.app("file", id: path))
    }

    // MARK: - Save and restore

    func scheduleSave() {
        guard !restoring else { return }
        saveTask?.cancel()
        saveTask = Task { [weak self] in
            try? await Task.sleep(for: .milliseconds(500))
            guard !Task.isCancelled else { return }
            self?.saveNow()
        }
    }

    func saveNow() {
        saveTask?.cancel()
        let saved = SavedState(
            current: current,
            keysView: keysView,
            tiles: tiles.values.map { SavedState.SavedTile(id: $0.id, uri: $0.uri) }.sorted { $0.id.uuidString < $1.id.uuidString },
            workspaces: workspaces
        )
        StateStore.save(saved)
    }

    func restore() {
        guard let saved = StateStore.load() else {
            // First launch: keys view on, and the projects tile, which says
            // how to open a project.
            keysView = true
            open(TileURI.app("projects"))
            return
        }
        restoring = true
        defer { restoring = false }
        keysView = saved.keysView
        for text in saved.skipped { AppLogger.info("Luca Desktop: state.json: skipped \(text): not an address this app opens") }
        let uris = Dictionary(saved.tiles.map { ($0.id, $0.uri) }, uniquingKeysWith: { a, _ in a })
        var restored = saved.workspaces
        while restored.count < 9 { restored.append(Workspace()) }
        restored = Array(restored.prefix(9))
        for (index, ws) in restored.enumerated() {
            for id in ws.tiles {
                guard let uri = uris[id], let content = makeContent(uri) else {
                    if let uri = uris[id] { AppLogger.info("Luca Desktop: state.json: skipped \(uri): no such tile") }
                    restored[index].remove(id)
                    continue
                }
                let frame = Self.onScreen(ws.frames[id] ?? Self.primaryArea.insetBy(dx: 200, dy: 120))
                restored[index].frames[id] = frame
                attach(Tile(id: id, content: content), frame: frame)
            }
        }
        // A workspace whose every tile was skipped starts fresh, so it does
        // not keep the name of a layout it no longer shows.
        for index in restored.indices where restored[index].tiles.isEmpty { restored[index] = Workspace() }
        workspaces = restored
        current = min(max(saved.current, 0), 8)
        applyLayout(animated: false)
        if let id = workspace.focused, tiles[id] != nil {
            focusedId = id
            tiles[id]?.controller?.window.makeKeyAndOrderFront(nil)
        }
        AppLogger.info("Luca Desktop: restored \(tiles.count) tiles")
        // Nothing left (every saved tile was skipped): the projects tile.
        if tiles.isEmpty {
            restoring = false
            open(TileURI.app("projects"))
        }
    }

    /// A saved frame on a display that is gone moves to the primary screen.
    static func onScreen(_ frame: CGRect) -> CGRect {
        if NSScreen.screens.contains(where: { $0.visibleFrame.intersection(frame).area > frame.area * 0.3 }) { return frame }
        let area = primaryArea
        let size = CGSize(width: min(frame.width, area.width), height: min(frame.height, area.height))
        return CGRect(x: area.midX - size.width / 2, y: area.midY - size.height / 2, width: size.width, height: size.height).integral
    }
}

extension CGRect {
    var area: CGFloat { isNull ? 0 : width * height }
}

extension NSScreen {
    var displayNumber: UInt32? {
        (deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as? NSNumber)?.uint32Value
    }
}
