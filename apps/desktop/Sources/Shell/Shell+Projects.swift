import AppKit

/// Opening a project folder: `:open-project <path>`, `Space p` and the
/// palette's project rows. A project gets a workspace of its own, named for
/// it in the status line.
extension Shell {
    /// `:open-project <path>`. With no path, the list of known projects.
    func openProject(path: String) {
        guard !path.isEmpty else { return PaletteController.shared.show(.projects) }
        // `gpubox:x` with a path ssh cannot use is a typing slip, not a local folder.
        if RemoteProject.parse(path) == nil, let colon = path.firstIndex(of: ":"), !path.hasPrefix("/"), !path.hasPrefix("~"), !path[..<colon].contains("/") {
            return flash("For a project on another machine: host:~/folder or host:/absolute/path")
        }
        switch ProjectHub.shared.remember(path: path) {
        case .success(let project): goToProject(project.id)
        case .failure(let error): flash(error.errorDescription ?? "Could not open \(path)")
        }
    }

    /// `Space R`: a project on another machine. Pick one of the hosts of
    /// `~/.ssh/config` (or type one), then the folder there.
    func openRemoteProject() {
        let askPath: (String) -> Void = { [weak self] host in
            PaletteController.shared.ask("folder on \(host) · ~/project or /absolute/path") { path in
                self?.openProject(path: "\(host):\(path.trimmingCharacters(in: .whitespaces))")
            }
        }
        var items = RemoteProject.configuredHosts().map { host in
            PaletteChoice(title: host, detail: "from ~/.ssh/config") { askPath(host) }
        }
        items.append(PaletteChoice(title: "another host…", detail: "user@host, or a name ssh knows") {
            PaletteController.shared.ask("ssh host") { host in askPath(host.trimmingCharacters(in: .whitespaces)) }
        })
        PaletteController.shared.choose("open a project on which machine", items)
    }

    /// Its workspace when it has one. Else a free workspace (or this one,
    /// when all nine are in use) with the project tile.
    /// A new chat with lucaPortfolio, beside the tile in focus. Its host runs
    /// in `~/.luca/portfolio` (`PortfolioProject`), which the app installs.
    func openPortfolioChat() {
        _ = open(PortfolioProject.newChat, near: focusedId)
    }

    func goToProject(_ id: String) {
        let owner = ProjectHub.ownerId(id)
        let name = ProjectHub.shared.displayName(id)
        if let home = workspace(ofOwner: owner) {
            switchWorkspace(home)
            return flash("\(name): workspace \(home + 1)")
        }
        if let free = workspaces.indices.first(where: { workspaces[$0].isEmpty }) { switchWorkspace(free) }
        open(TileURI.luca(project: id, tool: "project"))
    }

    /// A workspace's name for the status line: the project most of its tiles
    /// belong to, or the layout it loaded. Nil for an empty workspace.
    func workspaceLabel(_ index: Int) -> (text: String, owner: String?)? {
        let ws = workspaces[index]
        guard !ws.isEmpty else { return nil }
        let owner = Self.mainOwner(ws.tiles.compactMap { tiles[$0]?.owner })
        if let layout = ws.layout?.name { return (layout, owner) }
        return owner.map { (Self.ownerName($0), $0) } ?? ("desktop", nil)
    }

    /// The owner with the most tiles. The app's own tiles do not count. A
    /// tie goes to the name first in the alphabet, so the label is stable.
    nonisolated static func mainOwner(_ owners: [String]) -> String? {
        var counts: [String: Int] = [:]
        for id in owners where id != appOwner { counts[id, default: 0] += 1 }
        return counts.max { a, b in a.value != b.value ? a.value < b.value : a.key > b.key }?.key
    }

    /// The workspace that is this project's: the one where it has the most
    /// tiles and is the main owner.
    func workspace(ofOwner owner: String) -> Int? {
        workspaces.indices
            .filter { index in Self.mainOwner(workspaces[index].tiles.compactMap { tiles[$0]?.owner }) == owner }
            .max { a, b in count(owner, in: a) < count(owner, in: b) }
    }

    private func count(_ owner: String, in index: Int) -> Int {
        workspaces[index].tiles.filter { tiles[$0]?.owner == owner }.count
    }

    /// `Space f`, `:file`: the project's files in the palette (`GET /files`);
    /// one opens in a file tile. With no host yet, the palette asks for a path.
    func pickFile(in project: String) {
        guard let host = ProjectHub.shared.client(project) else {
            PaletteController.shared.ask("file in \(ProjectHub.shared.displayName(project)) (a path in the folder)") { [weak self] path in
                self?.openOrFocus(FileContent.address(project: project, path: path))
            }
            return
        }
        Task { [weak self] in
            do {
                let list = try await host.files()
                guard !list.files.isEmpty else { self?.flash("No files in this project"); return }
                PaletteController.shared.choose("open a file" + (list.truncated ? " (first \(list.files.count))" : ""), list.files.map { path in
                    PaletteChoice(title: (path as NSString).lastPathComponent, detail: path) { [weak self] in
                        self?.openOrFocus(FileContent.address(project: project, path: path))
                    }
                })
            } catch {
                self?.flash(ErrorText.message(error))
            }
        }
    }

    /// `Space g`, `:page`: a path on the project's `luca serve`, or a full URL.
    func askPage(in project: String) {
        PaletteController.shared.ask("web page: a path on luca serve (/health) or a URL") { [weak self] typed in
            self?.openOrFocus(PageContent.address(project: project, typed: typed))
        }
    }
}

extension Shell {
    /// Focus the tile at this address if one is open, else open it.
    func openOrFocus(_ uri: TileURI) {
        if let open = tiles.values.first(where: { $0.uri == uri }) { focusTile(open.id) } else { self.open(uri) }
    }

    /// An assistant asked for a canvas: open it beside the tile in focus
    /// (the chat) and leave the keyboard there. An open one stays as it is.
    func showCanvas(_ uri: TileURI) {
        guard !tiles.values.contains(where: { $0.uri == uri }) else { return }
        if let focusedId { openBeside([uri], near: focusedId) } else { open(uri) }
    }

    /// lucaPortfolio sent copies to review: remember the receiving project
    /// (it may be one the app never opened), then one change tile per
    /// helper beside the lucaPortfolio chat. The keyboard stays where it is.
    func showReview(_ review: PortfolioReview) {
        // The portfolio sends real paths; a known project may be listed through a symlink.
        let real = URL(fileURLWithPath: review.target).resolvingSymlinksInPath().path
        let known = ProjectHub.shared.recent.first { !$0.isRemote && URL(fileURLWithPath: $0.path).resolvingSymlinksInPath().path == real }
        switch known.map({ .success($0) }) ?? ProjectHub.shared.remember(path: review.target) {
        case .failure(let error):
            flash(error.errorDescription ?? "Could not open \(review.target)")
        case .success(let project):
            let uris = review.changes
                .map { TileURI.luca(project: project.id, tool: "change", options: $0.options) }
                .filter { uri in !tiles.values.contains { $0.uri == uri } }
            guard !uris.isEmpty else { return }
            // Beside the lucaPortfolio chat, wherever the keyboard is now.
            let isChat = { (id: UUID) in self.tiles[id].map { $0.uri.project == PortfolioProject.id && $0.uri.kind == "chat" } ?? false }
            let chat = focusedId.flatMap { isChat($0) ? $0 : nil }
                ?? workspace.tiles.first(where: isChat)
                ?? tiles.keys.first(where: isChat)
            if let near = chat ?? focusedId { openBeside(uris, near: near) } else { uris.forEach { open($0) } }
        }
    }

    /// `Space r`: this project's registry. The project is the focused
    /// tile's, else the one this workspace shows; with neither, the
    /// palette asks which known project.
    func openRegistry() {
        withProject("registry of which project") { [weak self] project in
            self?.openOrFocus(TileURI.luca(project: project, tool: "registry"))
        }
    }

    /// `Space e`: this project's console.
    func openConsole() {
        withProject("console of which project") { [weak self] project in
            self?.openOrFocus(TileURI.luca(project: project, tool: "console"))
        }
    }

    /// `Space x`: the palette lists the project's commands; one opens its
    /// command tile. With no host running yet, the registry opens on its
    /// commands stack (which starts the host).
    func pickCommand() {
        withProject("run a command of which project") { [weak self] project in
            self?.pickCommand(in: project)
        }
    }

    func pickCommand(in project: String) {
        guard let host = ProjectHub.shared.client(project) else {
            openOrFocus(TileURI.luca(project: project, tool: "registry", options: [.init(name: "stack", value: "commands")]))
            return flash("Starting the host: pick a command in the registry")
        }
        Task { [weak self] in
            do {
                let reply = try await host.registries()
                let cards = reply.stacks.first { $0.id == "commands" }?.cards ?? []
                guard !cards.isEmpty else { self?.flash("This project has no commands"); return }
                PaletteController.shared.choose("run a command", cards.map { card in
                    PaletteChoice(title: card.title, detail: [card.badge, card.subtitle.isEmpty ? nil : card.subtitle].compactMap { $0 }.joined(separator: " · ")) { [weak self] in
                        guard let uri = TileURI(TileURI.lucaScheme + project + "/" + card.address) else { return }
                        self?.openOrFocus(uri)
                    }
                })
            } catch {
                self?.flash(ErrorText.message(error))
            }
        }
    }

    /// The project a project key means (`ProjectPick`); with none, the
    /// palette asks which known project.
    func withProject(_ prompt: String, _ run: @escaping (String) -> Void) {
        let here = workspaces[current].tiles.compactMap { tiles[$0]?.uri }
        if let project = ProjectPick.current(focused: focusedTile?.uri, workspace: here) { return run(project) }
        let known = ProjectHub.shared.recent
        guard !known.isEmpty else { return flash("No projects yet. Open one with :open-project <path>") }
        PaletteController.shared.choose(prompt, known.map { project in
            PaletteChoice(title: project.label, detail: project.path) { run(project.id) }
        })
    }
}

/// Which project a project key means. Pure, so it is tested.
enum ProjectPick {
    /// The focused tile's project; else the only project this workspace's
    /// tiles show. Nil when there is none, or more than one to choose from.
    static func current(focused: TileURI?, workspace: [TileURI]) -> String? {
        if let project = focused?.project { return project }
        var seen: [String] = []
        for uri in workspace { if let p = uri.project, !seen.contains(p) { seen.append(p) } }
        return seen.count == 1 ? seen[0] : nil
    }
}
