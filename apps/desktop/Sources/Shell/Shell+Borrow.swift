import AppKit

/// A helper seen in one project, on its way to another (`take into…`).
struct TakeSource: Equatable {
    let project: String
    let registry: String
    let id: String
    let origin: WorkbenchOrigin?

    var title: String { "\(registry).\(id)" }
}

/// `take into…`: the palette asks for the receiving project, then the way
/// (hard copy, or borrow through `luca.cli.ts`), and a change tile in the
/// receiving project shows the plan. Only that project is written.
extension Shell {
    func takeInto(_ source: TakeSource, target: String? = nil, way: String? = nil) {
        guard let origin = source.origin else { return flash("The host sent no origin for \(source.title). Restart it (R).") }
        guard origin.kind != "builtin" else { return flash("\(source.title) is built into Luca: every project has it") }
        guard let target else {
            return pickTarget(excluding: source.project, prompt: "take \(source.title) into which project") { [weak self] project in
                self?.takeInto(source, target: project, way: way)
            }
        }
        guard target != source.project else { return flash("\(source.title) is in that project already") }
        // The files are on two machines: a copy needs scp, and a borrowed folder must be on the same disk.
        guard ProjectHub.shared.project(target)?.isRemote != true, ProjectHub.shared.project(source.project)?.isRemote != true else {
            return flash("Taking a helper between machines is not built yet. Both projects must be on this Mac")
        }
        guard let way else {
            let name = ProjectHub.shared.displayName(target)
            return PaletteController.shared.choose("\(source.title) into \(name): which way", [
                PaletteChoice(title: "hard copy", detail: "copy its file into \(name)'s own \(source.registry)/ (a preview first)") { [weak self] in
                    self?.takeInto(source, target: target, way: "copy")
                },
                PaletteChoice(title: "borrow through luca.cli.ts", detail: "read \(origin.dir.map { ($0 as NSString).abbreviatingWithTildeInPath } ?? "its folder") live: every \(source.registry) in it") { [weak self] in
                    self?.takeInto(source, target: target, way: "borrow")
                },
            ])
        }
        let request = way == "borrow"
            ? ChangeRequest.borrow(registry: source.registry, origin: origin)
            : ChangeRequest.copy(registry: source.registry, id: source.id, origin: origin)
        guard let request else { return flash("\(source.title) has no source file to take") }
        openOrFocus(TileURI.luca(project: target, tool: "change", options: request.options))
    }

    /// `:take <project> [copy|borrow]` in a registry or helper tile.
    func takeCommand(_ source: TakeSource?, _ rest: String) {
        guard let source else { return flash("No helper in focus") }
        let words = rest.split(separator: " ").map(String.init)
        guard let first = words.first else { return takeInto(source) }
        let known = ProjectHub.shared.recent
        guard let project = known.first(where: { $0.id == first || $0.label == first }) else {
            return flash("No known project '\(first)'. Open it with :open-project <path>")
        }
        let way = words.count > 1 ? (words[1] == "borrow" ? "borrow" : "copy") : nil
        takeInto(source, target: project.id, way: way)
    }

    /// Known projects but one, and `another folder…`, which asks for a path
    /// and remembers it.
    func pickTarget(excluding: String?, prompt: String, _ run: @escaping (String) -> Void) {
        var items = ProjectHub.shared.recent.filter { $0.id != excluding && !$0.isRemote }.map { project in
            PaletteChoice(title: project.label, detail: project.place) { run(project.id) }
        }
        items.append(PaletteChoice(title: "another folder…", detail: "type the path of a Luca project") { [weak self] in
            PaletteController.shared.ask("path of the project folder") { path in
                switch ProjectHub.shared.remember(path: path) {
                case .success(let project): run(project.id)
                case .failure(let error): self?.flash(error.errorDescription ?? "Could not open \(path)")
                }
            }
        })
        PaletteController.shared.choose(prompt, items)
    }

    /// Focus a tool of a project that is open already (any options), else
    /// open it with these options.
    func focusOrOpenTool(project: String, tool: String, options: [TileURI.Option] = []) {
        if let open = tiles.values.first(where: { $0.uri.project == project && $0.uri.kind == tool && $0.uri.id == nil }) {
            return focusTile(open.id)
        }
        open(TileURI.luca(project: project, tool: tool, options: options))
    }

    /// `Space h`: this project's endpoints and its server.
    func openEndpoints() {
        withProject("endpoints of which project") { [weak self] project in
            self?.focusOrOpenTool(project: project, tool: "endpoints")
        }
    }

    /// `Space o`, `Space d`, `Space D`, `Space c`, `Space t`: one of this project's tools, focused
    /// when it is open.
    func openProjectTool(_ tool: String, prompt: String) {
        withProject(prompt) { [weak self] project in
            self?.focusOrOpenTool(project: project, tool: tool)
        }
    }

    /// `Space b`: this project's plugins and borrowed folders.
    func openPlugins() {
        withProject("plugins of which project") { [weak self] project in
            self?.focusOrOpenTool(project: project, tool: "plugins")
        }
    }
}
