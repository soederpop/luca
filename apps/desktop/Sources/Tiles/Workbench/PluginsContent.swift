import SwiftUI

/// `luca://<project>/plugins`: the plugins the project loads (the
/// `LUCA_PLUGINS` line in its `.env`), the plugins installed (folders and
/// links in the plugins folder) with what each adds, and the folders it
/// borrows in `luca.cli.ts`. `t` turns the row in focus on or off (or stops
/// a borrow), `l` links a project folder as a plugin. Each write is shown
/// first, here, and made on `a`. `o` opens what the plugin in focus adds, one
/// block per helper type with each name a link to its tile; `/` keeps only
/// the names with some text, across every plugin.
@MainActor
final class PluginsContent: WorkbenchContent {
    static let kind = TileKind(id: "luca-plugins", label: "Plugins", glyph: "puzzlepiece.extension") { uri, _ in
        PluginsContent(uri: uri)
    }

    /// One row the cursor can be on. Pure, so the order is tested.
    enum Row: Equatable, Identifiable {
        case plugin(WorkbenchPlugins.Plugin)
        case missing(WorkbenchPlugins.Missing)
        case borrowed(WorkbenchPlugins.Borrowed)

        var id: String {
            switch self {
            case .plugin(let p): return "plugin:" + p.name
            case .missing(let m): return "missing:" + m.entry
            case .borrowed(let b): return "borrowed:" + b.id
            }
        }

        /// The change `t` asks for on this row.
        var toggle: ChangeRequest {
            switch self {
            case .plugin(let p): return ChangeRequest(route: "plugins", op: p.on ? "off" : "on", name: p.name)
            case .missing(let m): return ChangeRequest(route: "plugins", op: "off", name: m.entry, entry: m.entry)
            case .borrowed(let b): return ChangeRequest(route: "borrow", op: "unborrow", id: b.id)
            }
        }
    }

    nonisolated static func rows(_ info: WorkbenchPlugins) -> [Row] {
        info.plugins.map(Row.plugin) + info.missing.map(Row.missing) + info.borrowed.map(Row.borrowed)
    }

    @Published private(set) var info: WorkbenchPlugins?
    @Published private(set) var error: String?
    @Published private(set) var cursor = 0
    /// A change waiting for `a`.
    @Published private(set) var pending: (request: ChangeRequest, change: WorkbenchChange)?
    @Published private(set) var working = false
    @Published private(set) var done: String?
    /// Plugins whose contents are open (`o`), and the `plugin:type` groups
    /// shown whole past the first page.
    @Published private(set) var expanded: Set<String> = []
    @Published private(set) var shownWhole: Set<String> = []
    /// `/`: only helper names with this text show, in every plugin.
    @Published var filter = ""
    private var task: Task<Void, Never>?

    /// Names per page of a type's list, before "more".
    static let pageSize = 40

    init(uri: TileURI) {
        super.init(kindId: Self.kind.id, uri: uri, title: "\(ProjectHub.shared.displayName(uri.authority)) plugins")
    }

    override func makeBody() -> AnyView { AnyView(PluginsView(model: self)) }

    var rows: [Row] { info.map(Self.rows) ?? [] }

    func key(_ action: String) -> String { Shell.shared.keymap.map.keyLabel(for: action) ?? action }

    override func hostChanged(_ client: WorkbenchClient?) {
        if client != nil { reload() }
    }

    override func perform(_ action: String) -> Bool {
        switch action {
        case "lucaPlugins.down": move(1)
        case "lucaPlugins.up": move(-1)
        case "lucaPlugins.toggle": toggleFocused()
        case "lucaPlugins.link": pickLink()
        case "lucaPlugins.open": toggleExpanded()
        case "lucaPlugins.filter": askFilter()
        case "lucaPlugins.apply": confirmApply()
        case "lucaPlugins.cancel":
            if pending == nil { return false }
            pending = nil
        case "lucaPlugins.reload": reload()
        case "lucaPlugins.restart": restartHost()
        default: return false
        }
        return true
    }

    override func runCommand(_ verb: String, _ rest: String) -> Bool {
        switch verb {
        case "link-plugin":
            guard !rest.isEmpty else { pickLink(); return true }
            let parts = rest.split(separator: " ").map(String.init)
            plan(ChangeRequest(route: "plugins", op: "link", name: parts.count > 1 ? parts[1] : nil, folder: parts[0]))
        case "filter":
            // `:filter <text>`; empty clears.
            filter = rest
        case "plugin":
            // `:plugin on|off <name>`
            let parts = rest.split(separator: " ").map(String.init)
            guard parts.count == 2, ["on", "off"].contains(parts[0]) else { Shell.shared.flash("Usage: plugin on|off <name>"); return true }
            plan(ChangeRequest(route: "plugins", op: parts[0], name: parts[1]))
        default:
            return false
        }
        return true
    }

    func select(_ index: Int) {
        guard !rows.isEmpty else { return }
        cursor = min(max(0, index), rows.count - 1)
    }

    private func move(_ delta: Int) { select(cursor + delta) }

    func reload() {
        guard let host else { return }
        task?.cancel()
        stateLabel = info == nil ? "loading" : "updating"
        task = Task { [weak self] in
            do {
                let info = try await host.plugins()
                guard let self, !Task.isCancelled else { return }
                self.info = info
                self.error = nil
                self.select(self.cursor)
                let on = info.plugins.filter(\.on).count
                self.stateLabel = "\(on) on · \(info.borrowed.count) borrowed"
            } catch {
                guard let self, !Task.isCancelled else { return }
                self.error = ErrorText.message(error)
                self.stateLabel = "error"
            }
        }
    }

    /// `o`: open or close what the plugin in focus adds.
    func toggleExpanded(_ name: String? = nil) {
        let target: String?
        if let name { target = name }
        else if rows.indices.contains(cursor), case .plugin(let p) = rows[cursor] { target = p.name }
        else { target = nil }
        guard let target else { return Shell.shared.flash("Put the cursor on a plugin first") }
        if expanded.contains(target) { expanded.remove(target) } else { expanded.insert(target) }
    }

    func isExpanded(_ plugin: WorkbenchPlugins.Plugin) -> Bool { expanded.contains(plugin.name) || !filter.isEmpty }

    func showWhole(_ plugin: WorkbenchPlugins.Plugin, type: String) { shownWhole.insert(plugin.name + ":" + type) }

    func isWhole(_ plugin: WorkbenchPlugins.Plugin, type: String) -> Bool { shownWhole.contains(plugin.name + ":" + type) }

    /// `/`: a filter on the names, asked in the palette; empty clears it.
    func askFilter() {
        PaletteController.shared.ask("show only helpers named like… (empty shows all)", initial: filter) { [weak self] text in
            self?.filter = text.trimmingCharacters(in: .whitespaces)
        }
    }

    /// Open the helper a name stands for: the inspector for a feature,
    /// client, server or selector, the command tile for a command. Only a
    /// plugin the host loaded has them in its registry.
    func open(_ plugin: WorkbenchPlugins.Plugin, type: String, name: String) {
        guard plugin.loaded else { return Shell.shared.flash("\(plugin.name) is not loaded: turn it on and restart the host first") }
        guard let uri = Self.address(project: projectId, type: type, name: name) else {
            return Shell.shared.flash("\(type) have no tile of their own")
        }
        Shell.shared.open(uri, near: tileId)
    }

    /// The tile a helper of a plugin opens as; nil for endpoints and
    /// assistants, which have none. Pure, so it is tested.
    nonisolated static func address(project: String, type: String, name: String) -> TileURI? {
        switch type {
        case "features", "clients", "servers", "selectors":
            return TileURI.luca(project: project, tool: "helper", id: type + "/" + name)
        case "commands":
            return TileURI.luca(project: project, tool: "command", id: name)
        default:
            return nil
        }
    }

    /// What a plugin adds, kept to the names that have the filter in them;
    /// a type with no match is left out. Pure, so it is tested.
    nonisolated static func adds(_ adds: [WorkbenchPlugins.Adds], matching filter: String) -> [WorkbenchPlugins.Adds] {
        let needle = filter.trimmingCharacters(in: .whitespaces).lowercased()
        guard !needle.isEmpty else { return adds }
        return adds.compactMap { group in
            let names = group.names.filter { $0.lowercased().contains(needle) }
            return names.isEmpty ? nil : WorkbenchPlugins.Adds(type: group.type, names: names)
        }
    }

    func toggleFocused() {
        guard rows.indices.contains(cursor) else { return Shell.shared.flash("Nothing in focus") }
        plan(rows[cursor].toggle)
    }

    func toggle(_ row: Row) {
        if let index = rows.firstIndex(of: row) { cursor = index }
        plan(row.toggle)
    }

    /// `l`: a known project folder (or another path) to link as a plugin.
    func pickLink() {
        guard ProjectHub.shared.project(projectId)?.isRemote != true else {
            return Shell.shared.flash("Linking a folder of this Mac into a project on another machine is not built yet")
        }
        Shell.shared.pickTarget(excluding: nil, prompt: "link which project folder as a plugin") { [weak self] project in
            guard let path = ProjectHub.shared.project(project)?.path else { return }
            self?.plan(ChangeRequest(route: "plugins", op: "link", folder: path))
        }
    }

    /// Ask the host for the plan; it shows at the top until `a` or `c`.
    func plan(_ request: ChangeRequest) {
        guard let host else { return Shell.shared.flash("The workbench host is not running") }
        done = nil
        working = true
        Task { [weak self] in
            do {
                let change = try await host.preview(request)
                guard let self else { return }
                self.working = false
                self.pending = (request, change)
            } catch {
                guard let self else { return }
                self.working = false
                self.error = ErrorText.message(error)
            }
        }
    }

    private func confirmApply() {
        guard let pending else { return Shell.shared.flash("Nothing to write. \(key("lucaPlugins.toggle")) on a row plans one.") }
        guard pending.change.ok else { return Shell.shared.flash(pending.change.blocked ?? "This change cannot be made") }
        PaletteController.shared.confirm("\(pending.change.title)?", yes: "Yes, write") { [weak self] in self?.apply() }
    }

    private func apply() {
        guard let host, let pending else { return }
        var request = pending.request
        request.digest = pending.change.digest
        working = true
        Task { [weak self] in
            do {
                let result = try await host.apply(request)
                guard let self else { return }
                self.working = false
                self.pending = nil
                self.done = result.text
                // The project loads plugins and borrows at start: restart, and the list reloads.
                self.restartHost()
            } catch {
                guard let self else { return }
                self.working = false
                self.error = ErrorText.message(error)
            }
        }
    }

    override func stop() {
        task?.cancel()
        super.stop()
    }
}

struct PluginsView: View {
    @ObservedObject var model: PluginsContent

    private var p: KitPalette { Theme.palette }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: KitTokens.Space.s7) {
                WorkbenchHostLine(status: model.hostStatus)
                if let error = model.error {
                    WorkbenchCard(tint: p.bad.color) {
                        Text(error).font(WorkbenchStyle.ui(KitTokens.TypeScale.sm)).foregroundStyle(p.bad.color).textSelection(.enabled)
                    }
                }
                if let done = model.done {
                    WorkbenchCard(tint: p.good.color) {
                        HStack(spacing: KitTokens.Space.s4) {
                            Image(systemName: "checkmark.seal.fill").foregroundStyle(p.good.color)
                            Text(done).font(WorkbenchStyle.ui(KitTokens.TypeScale.sm, weight: .medium)).foregroundStyle(p.text.color)
                        }
                    }
                }
                if let pending = model.pending {
                    VStack(alignment: .leading, spacing: KitTokens.Space.s4) {
                        ChangePreview(change: pending.change, applyKey: model.key("lucaPlugins.apply"))
                        Text("\(model.key("lucaPlugins.cancel")) to drop this change")
                            .font(WorkbenchStyle.ui(KitTokens.TypeScale.xs)).foregroundStyle(p.textFaint.color)
                    }
                    .padding(KitTokens.Space.s6)
                    .background(RoundedRectangle(cornerRadius: KitTokens.Radius.lg).fill(p.inset.color.opacity(0.6)))
                }
                if let info = model.info {
                    envCard(info)
                    pluginsSection(info)
                    if !info.missing.isEmpty { missingSection(info) }
                    borrowedSection(info)
                } else if model.hostStatus == .running, model.error == nil {
                    ProgressView().controlSize(.small)
                }
            }
            .padding(.horizontal, WorkbenchStyle.Gap.page)
            .padding(.vertical, WorkbenchStyle.Gap.page - KitTokens.Space.s2)
            .frame(maxWidth: WorkbenchStyle.Size.readable + 200, alignment: .leading)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(p.surface.color)
    }

    private func envCard(_ info: WorkbenchPlugins) -> some View {
        VStack(alignment: .leading, spacing: KitTokens.Space.s3) {
            WorkbenchSectionTitle(title: "Loaded by this project", note: info.envFile)
            WorkbenchCard(tint: WorkbenchStyle.originColor("plugin")) {
                VStack(alignment: .leading, spacing: KitTokens.Space.s3) {
                    Text(info.line ?? "no LUCA_PLUGINS line")
                        .font(WorkbenchStyle.code(KitTokens.TypeScale.sm, weight: .semibold))
                        .foregroundStyle(info.line == nil ? p.textFaint.color : p.text.color)
                        .textSelection(.enabled)
                    HStack(spacing: KitTokens.Space.s3) {
                        Text("plugins folder").font(WorkbenchStyle.ui(KitTokens.TypeScale.xs)).foregroundStyle(p.textFaint.color)
                        Text(info.pluginsDir).font(WorkbenchStyle.code(KitTokens.TypeScale.xs)).foregroundStyle(p.textMuted.color)
                        if !info.pluginsDirIsDefault { WorkbenchTag(text: "moved by LUCA_WORKBENCH_PLUGINS_DIR", color: WorkbenchStyle.clashColor) }
                    }
                }
            }
        }
    }

    private func pluginsSection(_ info: WorkbenchPlugins) -> some View {
        VStack(alignment: .leading, spacing: KitTokens.Space.s4) {
            WorkbenchSectionTitle(title: "Installed plugins", note: "\(info.plugins.filter(\.on).count) on · \(info.plugins.count) installed")
            if info.plugins.isEmpty {
                Text("No plugins in \(info.pluginsDir). \(model.key("lucaPlugins.link")) links a project folder as one.")
                    .font(WorkbenchStyle.ui(KitTokens.TypeScale.sm)).foregroundStyle(p.textFaint.color)
            } else {
                filterLine
            }
            ForEach(info.plugins) { plugin in
                row(.plugin(plugin)) {
                    VStack(alignment: .leading, spacing: KitTokens.Space.s4) {
                        HStack(alignment: .center, spacing: KitTokens.Space.s6) {
                            Switch(on: plugin.on) { model.toggle(.plugin(plugin)) }
                            VStack(alignment: .leading, spacing: KitTokens.Space.s2) {
                                HStack(alignment: .firstTextBaseline, spacing: KitTokens.Space.s4) {
                                    Text(plugin.name).font(WorkbenchStyle.ui(KitTokens.TypeScale.md, weight: .semibold)).foregroundStyle(p.text.color)
                                    if plugin.on != plugin.loaded {
                                        WorkbenchTag(text: plugin.on ? "on after a restart" : "still loaded until a restart", color: WorkbenchStyle.clashColor)
                                    }
                                    if plugin.isThisProject { WorkbenchTag(text: "this project", color: WorkbenchStyle.originColor("own")) }
                                }
                                HStack(spacing: KitTokens.Space.s3) {
                                    Image(systemName: plugin.link ? "link" : "folder").font(.system(size: 11)).foregroundStyle(p.textFaint.color)
                                    Text(plugin.target).font(WorkbenchStyle.code(KitTokens.TypeScale.xs)).foregroundStyle(p.textFaint.color)
                                        .lineLimit(1).truncationMode(.head)
                                }
                            }
                            Spacer(minLength: 0)
                        }
                        addsSummary(plugin)
                        if model.isExpanded(plugin) { addsDetail(plugin) }
                    }
                }
            }
        }
    }

    /// The filter in force, or how to set one.
    private var filterLine: some View {
        HStack(spacing: KitTokens.Space.s3) {
            if model.filter.isEmpty {
                BoundKey(action: "lucaPlugins.open")
                Text("opens what a plugin adds").font(WorkbenchStyle.meta).foregroundStyle(p.textFaint.color)
                BoundKey(action: "lucaPlugins.filter")
                Text("filters the names").font(WorkbenchStyle.meta).foregroundStyle(p.textFaint.color)
            } else {
                Image(systemName: "line.3.horizontal.decrease.circle.fill").font(.system(size: 12)).foregroundStyle(p.accent.color)
                Text("names like").font(WorkbenchStyle.meta).foregroundStyle(p.textMuted.color)
                Text(model.filter).font(WorkbenchStyle.code(KitTokens.TypeScale.xs, weight: .semibold)).foregroundStyle(p.text.color)
                Button { model.filter = "" } label: {
                    Text("clear").font(WorkbenchStyle.caption()).foregroundStyle(p.accent.color)
                }
                .buttonStyle(.plain)
            }
        }
    }

    /// One pill per type with its count; a click opens the plugin's contents.
    private func addsSummary(_ plugin: WorkbenchPlugins.Plugin) -> some View {
        HStack(spacing: KitTokens.Space.s3) {
            if plugin.adds.isEmpty {
                Text(plugin.addsText).font(WorkbenchStyle.ui(KitTokens.TypeScale.sm)).foregroundStyle(p.textFaint.color)
            }
            ForEach(plugin.adds, id: \.type) { group in
                Button { model.toggleExpanded(plugin.name) } label: {
                    HStack(spacing: KitTokens.Space.s2) {
                        Image(systemName: WorkbenchStyle.thingGlyph(group.type)).font(.system(size: 10, weight: .semibold))
                        Text("\(group.names.count)").font(WorkbenchStyle.ui(KitTokens.TypeScale.xs, weight: .bold).monospacedDigit())
                        Text(group.names.count == 1 ? String(group.type.dropLast()) : group.type).font(WorkbenchStyle.ui(KitTokens.TypeScale.xs, weight: .medium))
                    }
                    .foregroundStyle(WorkbenchStyle.thingColor(group.type))
                    .padding(.horizontal, KitTokens.Space.s4)
                    .padding(.vertical, 3)
                    .background(Capsule().fill(WorkbenchStyle.thingColor(group.type).opacity(0.12)))
                }
                .buttonStyle(.plain)
            }
            if plugin.entry != nil {
                WorkbenchTag(text: "\(plugin.entry ?? "") attach()", color: WorkbenchStyle.originColor("plugin"))
            }
            if !plugin.adds.isEmpty {
                Image(systemName: model.isExpanded(plugin) ? "chevron.down" : "chevron.right")
                    .font(.system(size: 10, weight: .semibold)).foregroundStyle(p.textFaint.color)
            }
        }
    }

    /// The names, one block per type, in the type's color; a name opens its
    /// tile when the plugin is loaded. Long lists stop at a page with "more".
    private func addsDetail(_ plugin: WorkbenchPlugins.Plugin) -> some View {
        let groups = PluginsContent.adds(plugin.adds, matching: model.filter)
        return VStack(alignment: .leading, spacing: KitTokens.Space.s5) {
            if groups.isEmpty {
                Text(model.filter.isEmpty ? "Nothing in its helper folders." : "No name like \"\(model.filter)\" in \(plugin.name).")
                    .font(WorkbenchStyle.ui(KitTokens.TypeScale.xs)).foregroundStyle(p.textFaint.color)
            }
            ForEach(groups, id: \.type) { group in
                let color = WorkbenchStyle.thingColor(group.type)
                let whole = model.isWhole(plugin, type: group.type) || group.names.count <= PluginsContent.pageSize
                let shown = whole ? group.names : Array(group.names.prefix(PluginsContent.pageSize))
                let total = plugin.adds.first { $0.type == group.type }?.names.count ?? group.names.count
                VStack(alignment: .leading, spacing: KitTokens.Space.s3) {
                    HStack(spacing: KitTokens.Space.s3) {
                        Image(systemName: WorkbenchStyle.thingGlyph(group.type)).font(.system(size: 11, weight: .semibold)).foregroundStyle(color)
                        Text(group.type).font(WorkbenchStyle.ui(KitTokens.TypeScale.xs, weight: .semibold)).foregroundStyle(color)
                        Text(group.names.count == total ? "\(total)" : "\(group.names.count) of \(total)")
                            .font(WorkbenchStyle.ui(KitTokens.TypeScale.xs).monospacedDigit()).foregroundStyle(p.textFaint.color)
                        if !plugin.loaded, PluginsContent.address(project: "p", type: group.type, name: "n") != nil {
                            Text("not loaded: names only").font(WorkbenchStyle.meta).foregroundStyle(p.textFaint.color)
                        }
                    }
                    WrapLayout(spacing: KitTokens.Space.s3) {
                        ForEach(shown, id: \.self) { name in
                            nameChip(name, color: color, opens: plugin.loaded && PluginsContent.address(project: "p", type: group.type, name: name) != nil) {
                                model.open(plugin, type: group.type, name: name)
                            }
                        }
                        if !whole {
                            Button { model.showWhole(plugin, type: group.type) } label: {
                                Text("+\(group.names.count - shown.count) more")
                                    .font(WorkbenchStyle.code(KitTokens.TypeScale.xs, weight: .semibold))
                                    .foregroundStyle(p.accent.color)
                                    .padding(.horizontal, KitTokens.Space.s4)
                                    .padding(.vertical, 3)
                                    .background(Capsule().stroke(p.accent.color.opacity(0.6)))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
        }
        .padding(.top, KitTokens.Space.s2)
        .padding(.leading, KitTokens.Space.s2)
    }

    private func nameChip(_ name: String, color: Color, opens: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(name)
                .font(WorkbenchStyle.code(KitTokens.TypeScale.xs, weight: .semibold))
                .foregroundStyle(opens ? color : p.textMuted.color)
                .padding(.horizontal, KitTokens.Space.s4)
                .padding(.vertical, 3)
                .background(Capsule().fill((opens ? color : p.textFaint.color).opacity(0.12)))
        }
        .buttonStyle(.plain)
        .help(opens ? "open \(name)" : name)
    }

    private func missingSection(_ info: WorkbenchPlugins) -> some View {
        VStack(alignment: .leading, spacing: KitTokens.Space.s4) {
            WorkbenchSectionTitle(title: "On, but not in the plugins folder", note: "\(info.missing.count)")
            ForEach(info.missing) { item in
                row(.missing(item)) {
                    HStack(spacing: KitTokens.Space.s6) {
                        Switch(on: true) { model.toggle(.missing(item)) }
                        VStack(alignment: .leading, spacing: KitTokens.Space.s2) {
                            Text(item.entry).font(WorkbenchStyle.code(KitTokens.TypeScale.sm, weight: .semibold)).foregroundStyle(p.text.color)
                            Text(item.note).font(WorkbenchStyle.ui(KitTokens.TypeScale.xs)).foregroundStyle(WorkbenchStyle.clashColor)
                        }
                    }
                }
            }
        }
    }

    private func borrowedSection(_ info: WorkbenchPlugins) -> some View {
        VStack(alignment: .leading, spacing: KitTokens.Space.s4) {
            WorkbenchSectionTitle(title: "Borrowed in luca.cli.ts", note: info.cliExists ? info.cliFile : "no luca.cli.ts")
            if info.borrowed.isEmpty {
                Text("No borrowed folders. take into… on a helper (\(Shell.shared.keymap.map.keyLabel(for: "lucaRegistry.take") ?? "t") in the registry) adds one.")
                    .font(WorkbenchStyle.ui(KitTokens.TypeScale.sm)).foregroundStyle(p.textFaint.color)
            }
            ForEach(info.borrowed) { item in
                row(.borrowed(item)) {
                    VStack(alignment: .leading, spacing: KitTokens.Space.s3) {
                        HStack(alignment: .firstTextBaseline, spacing: KitTokens.Space.s4) {
                            WorkbenchTag(text: item.type, color: WorkbenchStyle.originColor("borrowed"))
                            Text(item.display).font(WorkbenchStyle.code(KitTokens.TypeScale.sm, weight: .semibold)).foregroundStyle(p.text.color)
                                .lineLimit(1).truncationMode(.head)
                            Spacer(minLength: 0)
                            if !item.exists { WorkbenchTag(text: "folder missing", color: p.bad.color) }
                        }
                        if !item.helpers.isEmpty {
                            FlowTags(tags: item.helpers, color: WorkbenchStyle.originColor("borrowed"))
                        }
                        Text("\(model.key("lucaPlugins.toggle")) to stop borrowing: only the app's lines go")
                            .font(WorkbenchStyle.ui(KitTokens.TypeScale.xs)).foregroundStyle(p.textFaint.color)
                    }
                }
            }
        }
    }

    /// A row: a soft card, the accent border when the cursor is on it.
    private func row<Content: View>(_ row: PluginsContent.Row, @ViewBuilder _ content: () -> Content) -> some View {
        let focused = model.rows.firstIndex(of: row) == model.cursor
        return content()
            .padding(.horizontal, KitTokens.Space.s6)
            .padding(.vertical, KitTokens.Space.s5)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: KitTokens.Radius.lg).fill(focused ? p.raised.color : p.raised.color.opacity(0.55)))
            .overlay(RoundedRectangle(cornerRadius: KitTokens.Radius.lg).stroke(focused ? p.accent.color : p.border.color, lineWidth: focused ? 1.5 : 1))
            .contentShape(Rectangle())
            .onTapGesture { if let i = model.rows.firstIndex(of: row) { model.select(i) } }
    }
}

/// An on/off pill: green and filled when on, quiet when off.
private struct Switch: View {
    let on: Bool
    let action: () -> Void

    var body: some View {
        let p = Theme.palette
        Button(action: action) {
            HStack(spacing: KitTokens.Space.s3) {
                Circle().fill(on ? p.good.color : p.textFaint.color).frame(width: 9, height: 9)
                Text(on ? "on" : "off").font(WorkbenchStyle.ui(KitTokens.TypeScale.xs, weight: .bold))
                    .foregroundStyle(on ? p.good.color : p.textFaint.color)
            }
            .frame(width: 58)
            .padding(.vertical, KitTokens.Space.s3)
            .background(Capsule().fill((on ? p.good.color : p.textFaint.color).opacity(0.14)))
            .overlay(Capsule().stroke((on ? p.good.color : p.textFaint.color).opacity(0.5)))
        }
        .buttonStyle(.plain)
    }
}
