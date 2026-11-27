import Foundation

/// Making new things: a project (`luca bootstrap`) and a helper
/// (`luca scaffold`). Both run as command tiles, so the output is on screen
/// and the host does the work; the palette gathers what the form would ask.
extension Shell {
    /// `Space N`, `:bootstrap [path]`, the projects tile's `n`: a new Luca
    /// project. Asks for the folder, then which of the machine's plugins it
    /// loads (`LUCA_PLUGINS` in its `.env`), then runs `luca bootstrap` in a
    /// command tile; the project opens when the run ends well
    /// (`?then=open-project`). The host that runs it is the project in
    /// focus's, else the portfolio's.
    func bootstrapProject(path: String = "") {
        let typed = path.trimmingCharacters(in: .whitespaces)
        guard !typed.isEmpty else {
            return PaletteController.shared.ask("new project folder (~/code/my-project or /absolute/path)") { [weak self] in
                self?.bootstrapProject(path: $0)
            }
        }
        let home = FileManager.default.homeDirectoryForCurrentUser.path
        let folder = ProjectList.normalize(typed, home: home)
        guard folder.hasPrefix("/") else { return flash("Give a folder: ~/code/my-project or an absolute path") }
        if ProjectHub.shared.recent.contains(where: { $0.host == nil && $0.path == folder }) {
            return flash("\(typed) is a project already. Space p opens it")
        }
        let runner = impliedProject ?? PortfolioProject.id
        availablePlugins(via: runner) { [weak self] plugins in
            guard let self else { return }
            guard !plugins.isEmpty else { return self.runBootstrap(folder: folder, plugins: [], via: runner) }
            self.pickPlugins(plugins, chosen: [], folder: folder) { chosen in
                self.runBootstrap(folder: folder, plugins: chosen, via: runner)
            }
        }
    }

    /// The plugins folder is the machine's, so any running host can list
    /// it; with none running, the runner's host starts for the answer.
    private func availablePlugins(via runner: String, _ done: @escaping ([WorkbenchPlugins.Plugin]) -> Void) {
        let fetch: (WorkbenchClient?) -> Void = { client in
            guard let client else { return done([]) }
            Task { @MainActor in
                let reply = try? await client.plugins()
                done(reply?.plugins ?? [])
            }
        }
        if let client = ProjectHub.shared.anyClient() { return fetch(client) }
        flash("Starting a host to list the plugins…")
        ProjectHub.shared.withClient(runner, fetch)
    }

    /// A pick list that stays up: each row toggles a plugin and the list
    /// opens again; the first row makes the project with what is ticked.
    private func pickPlugins(_ plugins: [WorkbenchPlugins.Plugin], chosen: [String], folder: String, _ done: @escaping ([String]) -> Void) {
        let name = (folder as NSString).lastPathComponent
        let summary = chosen.isEmpty ? "with no plugins" : "with \(chosen.joined(separator: ", "))"
        var rows = [PaletteChoice(title: "Create \(name)", detail: summary) { done(chosen) }]
        for plugin in plugins {
            let on = chosen.contains(plugin.name)
            rows.append(PaletteChoice(title: (on ? "☑ " : "☐ ") + plugin.name, detail: plugin.addsText) { [weak self] in
                let next = on ? chosen.filter { $0 != plugin.name } : chosen + [plugin.name]
                self?.pickPlugins(plugins, chosen: next, folder: folder, done)
            })
        }
        PaletteController.shared.choose("plugins for \(name) · Enter ticks one · Create when done", rows)
    }

    private func runBootstrap(folder: String, plugins: [String], via runner: String) {
        var options = [
            TileURI.Option(name: "output", value: folder),
            // Its `luca setup` question needs a terminal; the run has none.
            TileURI.Option(name: "__extra__", value: "--no-setup"),
            TileURI.Option(name: "run", value: "1"),
            TileURI.Option(name: "then", value: "open-project"),
        ]
        if !plugins.isEmpty { options.insert(TileURI.Option(name: "use-plugins", value: plugins.joined(separator: ",")), at: 1) }
        _ = open(TileURI.luca(project: runner, tool: "command", id: "bootstrap", options: options), near: focusedId)
        flash("Bootstrapping \((folder as NSString).lastPathComponent)… it opens as a project when the run ends")
    }

    /// `Space S`, `:scaffold [type] [name]`: a new helper of the project.
    /// The host's form for `luca scaffold` says which types there are; the
    /// palette asks for the type and the name, then the command tile opens
    /// with both filled, so a description can go in before it runs. A good
    /// run opens the file it wrote and restarts the host (`?then=scaffold`).
    func scaffold(in project: String, type: String? = nil, name: String? = nil) {
        guard let host = ProjectHub.shared.client(project) else {
            _ = open(TileURI.luca(project: project, tool: "command", id: "scaffold"), near: focusedId)
            return flash("Starting the host: the scaffold form opens when it is up")
        }
        Task { @MainActor [weak self] in
            do {
                let form = try await host.command("scaffold")
                let types = form.fields.first { $0.name == "type" }?.options ?? form.subcommands.map(\.name)
                guard !types.isEmpty else { return self?.flash("This luca has no scaffold types") ?? () }
                let detail = { (type: String) in form.subcommands.first { $0.name == type }?.description ?? "" }
                let withType: (String) -> Void = { type in
                    if let name = name?.trimmingCharacters(in: .whitespaces), !name.isEmpty {
                        self?.openScaffold(project, type: type, name: name)
                    } else {
                        PaletteController.shared.ask("name of the new \(type) (kebab-case, like disk-cache)") {
                            self?.openScaffold(project, type: type, name: $0.trimmingCharacters(in: .whitespaces))
                        }
                    }
                }
                if let type, types.contains(type) { return withType(type) }
                if let type, !type.isEmpty { self?.flash("No scaffold type '\(type)'. Types: " + types.joined(separator: ", ")) }
                PaletteController.shared.choose("scaffold what", types.map { type in
                    PaletteChoice(title: type, detail: detail(type)) { withType(type) }
                })
            } catch {
                self?.flash(ErrorText.message(error))
            }
        }
    }

    private func openScaffold(_ project: String, type: String, name: String) {
        guard !name.isEmpty else { return flash("The \(type) needs a name") }
        let uri = TileURI.luca(project: project, tool: "command", id: "scaffold", options: [
            TileURI.Option(name: "type", value: type),
            TileURI.Option(name: "name", value: name),
            TileURI.Option(name: "then", value: "scaffold"),
        ])
        _ = open(uri, near: focusedId)
        let run = keymap.map.keyLabel(for: "lucaCommand.run") ?? "r"
        flash("Add a description if you like, then \(run) writes the \(type)")
    }
}
