import AppKit

/// Saved layouts (`:layout save|load|edit`, `Space l`) and color themes.
extension Shell {
    // MARK: - Layout files

    static func layoutNames() -> [String] {
        let files = (try? FileManager.default.contentsOfDirectory(at: TilesPaths.layouts, includingPropertiesForKeys: nil)) ?? []
        return files.filter { $0.pathExtension == "yml" }.map { $0.deletingPathExtension().lastPathComponent }.sorted()
    }

    static func readLayout(_ name: String) throws -> LayoutFile {
        guard LayoutFile.validName(name) else { throw LayoutError("Layout names are letters, digits, . _ and -") }
        let url = TilesPaths.layout(name)
        guard let text = try? String(contentsOf: url, encoding: .utf8) else { throw LayoutError("No layout '\(name)' in \(TilesPaths.layouts.path)") }
        return try LayoutFile.parse(text, name: name)
    }

    /// `:layout save|load|edit <name>`, `:layout` alone opens the picker.
    func runLayoutCommand(_ rest: String) {
        let words = rest.split(separator: " ").map(String.init)
        guard let verb = words.first else { return pickLayout() }
        let name = words.count > 1 ? words[1] : ""
        switch verb {
        case "save", "load", "edit":
            guard LayoutFile.validName(name) else { return flash("Usage: layout \(verb) <name> (letters, digits, . _ -)") }
            if verb == "save" { saveLayout(name) }
            else if verb == "edit" { editLayout(name) }
            else { loadLayout(name, given: Self.params(Array(words.dropFirst(2)))) }
        case "list", "pick": pickLayout()
        default:
            // `:layout x` loads x.
            if LayoutFile.validName(verb), Self.layoutNames().contains(verb) { loadLayout(verb, given: Self.params(Array(words.dropFirst()))) }
            else { flash("Usage: layout save|load|edit <name>") }
        }
    }

    /// `project=luca` after the name.
    private static func params(_ words: [String]) -> [String: String] {
        var out: [String: String] = [:]
        for word in words {
            let halves = word.split(separator: "=", maxSplits: 1).map(String.init)
            if halves.count == 2 { out[halves[0]] = halves[1] }
        }
        return out
    }

    /// The current workspace, as a layout file. The workspace then counts as
    /// having loaded it, so `:layout edit` lands here.
    func saveLayout(_ name: String) {
        let ws = workspace
        guard !ws.isEmpty else { return flash("Nothing to save: this workspace has no tiles") }
        let file = LayoutFile.capture(ws, name: name, uri: { self.tiles[$0]?.uri }, area: organizedArea(for: current))
        do {
            try FileManager.default.createDirectory(at: TilesPaths.layouts, withIntermediateDirectories: true)
            try file.yaml.write(to: TilesPaths.layout(name), atomically: true, encoding: .utf8)
        } catch {
            return flash("Can't write \(TilesPaths.layout(name).path): \(error.localizedDescription)")
        }
        let ids = ws.mode == .organized ? (ws.tree?.tiles ?? []) + ws.tiles.filter { ws.floating.contains($0) } : ws.tiles
        var slots: [String: UUID] = [:]
        for (index, id) in ids.enumerated() { if let uri = tiles[id]?.uri { slots[LoadedLayout.slotKey(index, uri)] = id } }
        workspaces[current].layout = LoadedLayout(name: name, params: [:], slots: slots)
        scheduleSave()
        flash("Saved layout \(name): \(file.slots.count) tiles, \(ws.mode.label)")
    }

    /// Open the file in a source tile. A new name starts from this workspace,
    /// or from an example when the workspace is empty.
    func editLayout(_ name: String) {
        let url = TilesPaths.layout(name)
        if !FileManager.default.fileExists(atPath: url.path) {
            if workspace.isEmpty {
                try? FileManager.default.createDirectory(at: TilesPaths.layouts, withIntermediateDirectories: true)
                try? Self.exampleLayout(name).write(to: url, atomically: true, encoding: .utf8)
            } else {
                saveLayout(name)
            }
        }
        openOrFocus(TileURI.app("file", id: "layouts/\(name).yml"))
    }

    private static func exampleLayout(_ name: String) -> String {
        """
        # Luca Desktop layout. :layout load \(name) applies it. {project} comes
        # from the tile in focus; the palette asks when there is none.
        name: \(name)
        mode: organized
        params: [project]
        root:
          split: horizontal
          ratio: 0.42
          children:
            - tile: luca://{project}/project
            - split: vertical
              ratio: 0.5
              children:
                - tile: luca://{project}/console
                - tile: luca://{project}/terminal

        """
    }

    /// `Space l`: every saved layout. Enter loads it.
    func pickLayout() {
        let names = Self.layoutNames()
        guard !names.isEmpty else { return flash("No layouts yet. :layout save <name> makes one.") }
        let items = names.map { name -> PaletteChoice in
            let detail: String
            if let file = try? Self.readLayout(name) {
                detail = file.mode.label + " · \(file.slots.count) tiles" + (file.params.isEmpty ? "" : " · takes \(file.params.joined(separator: ", "))")
            } else {
                detail = "does not parse"
            }
            return PaletteChoice(title: name, detail: detail) { [weak self] in self?.loadLayout(name, given: [:]) }
        }
        PaletteController.shared.choose("load a layout", items)
    }

    /// `Space T`, `:theme`: the default look and every named theme.
    func pickTheme() {
        let settings = ThemeSettings.shared
        let mark = { (on: Bool) in on ? " · in use" : "" }
        var items = [PaletteChoice(title: "Default", detail: "follows :set dark | light | system" + mark(settings.themeId == nil)) { [weak self] in
            settings.setTheme(nil)
            self?.flash("Theme: \(settings.themeLabel)")
        }]
        for theme in KitTokens.themes {
            items.append(PaletteChoice(title: theme.label, detail: (theme.dark ? "dark" : "light") + mark(settings.themeId == theme.id)) { [weak self] in
                settings.setTheme(theme.id)
                self?.flash("Theme: \(theme.label)")
            })
        }
        PaletteController.shared.choose("color theme", items)
    }

    /// `:layout load`. Params come from `given`, then the tile in focus, and
    /// the palette asks for the rest. A file that does not parse changes nothing.
    func loadLayout(_ name: String, given: [String: String]) {
        let file: LayoutFile
        do { file = try Self.readLayout(name) } catch { return flash("Layout \(name): \(error.localizedDescription)") }
        var values = focusedTile.map { LayoutParams.from($0.uri) } ?? [:]
        values.merge(given) { _, new in new }
        values = values.filter { file.params.contains($0.key) }
        askParams(file, values: values) { [weak self] values in
            guard let self else { return }
            switch self.apply(file, values: values, to: self.current, leftovers: .moveAway) {
            case .success(let note): self.flash(note)
            case .failure(let error): self.flash("Layout \(name): \(error.message). Nothing changed.")
            }
        }
    }

    private func askParams(_ file: LayoutFile, values: [String: String], then done: @escaping ([String: String]) -> Void) {
        guard let missing = file.params.first(where: { (values[$0] ?? "").isEmpty }) else { return done(values) }
        PaletteController.shared.ask("layout \(file.name): \(missing)") { [weak self] answer in
            var next = values
            next[missing] = answer.trimmingCharacters(in: .whitespaces)
            self?.askParams(file, values: next, then: done)
        }
    }

    /// A layout file was saved in a source tile: every workspace that loaded
    /// it takes the new version, on the tiles it has.
    func layoutFileSaved(_ url: URL) {
        guard url.deletingLastPathComponent().standardizedFileURL == TilesPaths.layouts.standardizedFileURL else { return }
        let name = url.deletingPathExtension().lastPathComponent
        let targets = workspaces.indices.filter { workspaces[$0].layout?.name == name }
        guard !targets.isEmpty else { return }
        let file: LayoutFile
        do { file = try Self.readLayout(name) } catch { return flash("Layout \(name): \(error.localizedDescription). Nothing changed.") }
        for index in targets {
            let values = workspaces[index].layout?.params ?? [:]
            if case .failure(let error) = apply(file, values: values, to: index, leftovers: .float) {
                flash("Layout \(name): \(error.message). Nothing changed.")
                return
            }
        }
        flash("Layout \(name) updated")
    }

    enum Leftovers {
        /// `:layout load`: tiles the layout does not name go to an empty workspace.
        case moveAway
        /// A re-apply after an edit: they stay, loose, so the editor stays put.
        case float
    }

    /// Put a layout on a workspace. Open tiles with the same address are
    /// kept (and the tile that had a slot last time keeps it), others open.
    /// Fails before changing anything when the layout does not resolve.
    @discardableResult
    func apply(_ file: LayoutFile, values: [String: String], to index: Int, leftovers: Leftovers) -> Result<String, LayoutError> {
        let resolved: LayoutFile
        let uris: [TileURI?]
        do { (resolved, uris) = try file.resolve(values) } catch let error as LayoutError { return .failure(error) } catch { return .failure(LayoutError("\(error)")) }

        let old = workspaces[index]
        let prior = old.layout?.name == file.name ? old.layout?.slots ?? [:] : [:]
        var free = old.tiles
        var ids: [UUID] = []
        var created: [(UUID, TileURI)] = []
        var skipped: [UUID] = []
        var skippedKinds = Set<String>()
        var slots: [String: UUID] = [:]
        for (slot, address) in uris.enumerated() {
            // An address that no longer parses (another scheme) or names no kind is skipped; the rest still load.
            guard let uri = address, TileKinds.kind(for: uri) != nil else {
                let placeholder = UUID()
                ids.append(placeholder)
                skipped.append(placeholder)
                let text = resolved.slots.indices.contains(slot) ? resolved.slots[slot] : "?"
                skippedKinds.insert(address?.kind ?? text)
                AppLogger.info("Luca Desktop: layout \(file.name) skips \(text): no such tile here")
                continue
            }
            let key = LoadedLayout.slotKey(slot, uri)
            let reuse = prior[key].flatMap { free.contains($0) ? $0 : nil }
                ?? free.first { tiles[$0]?.uri == uri }
            if let reuse {
                free.removeAll { $0 == reuse }
                ids.append(reuse)
                slots[key] = reuse
            } else {
                let id = UUID()
                ids.append(id)
                created.append((id, uri))
                slots[key] = id
            }
        }
        guard skipped.count < ids.count else { return .failure(LayoutError("Luca Desktop has no tile for \(skippedKinds.sorted().joined(separator: ", "))")) }

        var built = resolved.build(ids: ids, area: organizedArea(for: index), gap: Self.gap)
        for id in skipped { built.remove(id) }
        built.display = old.display
        built.layout = LoadedLayout(name: file.name, params: values, slots: slots)
        if built.focused == nil || skipped.contains(built.focused!) { built.focused = built.tiles.first }

        // Tiles the layout does not name.
        var movedTo: Int?
        if !free.isEmpty {
            let empty = leftovers == .moveAway ? workspaces.indices.first { $0 != index && workspaces[$0].isEmpty } : nil
            for id in free {
                let frame = old.frames[id] ?? Self.primaryArea.insetBy(dx: 200, dy: 120)
                if let empty {
                    workspaces[empty].add(id, frame: frame)
                    movedTo = empty
                } else {
                    built.tiles.append(id)
                    built.frames[id] = frame
                    if built.mode == .organized { built.floating.insert(id) }
                }
            }
            if let empty {
                for group in old.groups where group.allSatisfy(free.contains) { workspaces[empty].groups.append(group) }
                workspaces[empty].focused = free.first
            }
        }

        // The tile in focus keeps it when it stays here (the editor of the
        // layout file, after a save).
        if let f = old.focused, built.tiles.contains(f) { built.focused = f }

        for (id, uri) in created {
            guard let content = makeContent(uri) else { continue }
            attach(Tile(id: id, content: content), frame: built.frames[id] ?? Self.primaryArea)
        }
        workspaces[index] = built
        applyLayout(animated: true)
        if index == current, let focus = built.focused { focusTile(focus) }
        scheduleSave()

        var note = "Layout \(file.name): \(built.tiles.count - (movedTo == nil ? free.count : 0)) tiles"
        if !created.isEmpty { note += ", \(created.count) new" }
        if !skipped.isEmpty { note += ". Skipped \(skipped.count) unknown tile\(skipped.count == 1 ? "" : "s")" }
        if let movedTo { note += ". \(free.count) other tiles moved to workspace \(movedTo + 1)" }
        else if !free.isEmpty { note += ". \(free.count) other tiles left loose" }
        return .success(note)
    }
}
