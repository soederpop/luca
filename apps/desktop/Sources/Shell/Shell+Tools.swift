import AppKit

/// A project's own tools (declared in `workbench/`): `Space w` lists them in
/// the palette, and each opens as its page or `tool` tile.
extension Shell {
    /// `Space w`: this project's declared tools, fresh from the host.
    func pickTool(in project: String) {
        guard let host = ProjectHub.shared.client(project) else {
            openOrFocus(TileURI.luca(project: project, tool: "project"))
            return flash("Starting the host: its tools show in the overview")
        }
        Task { [weak self] in
            do {
                let list = try await host.tools()
                self?.showTools(list, project: project)
            } catch {
                self?.flash(ErrorText.message(error))
            }
        }
    }

    private func showTools(_ list: WorkbenchTools, project: String) {
        let name = ProjectHub.shared.displayName(project)
        guard !list.tools.isEmpty else {
            if !list.errors.isEmpty {
                openOrFocus(TileURI.luca(project: project, tool: "project"))
                return flash("\(name): \(list.errors.count) tool declaration\(list.errors.count == 1 ? "" : "s") failed; see the overview")
            }
            return flash(list.notice ?? "\(name) declares no tools")
        }
        PaletteController.shared.choose("\(name): its own tools", list.tools.map { tool in
            PaletteChoice(title: tool.title, detail: Self.toolDetail(tool)) { [weak self] in self?.openTool(tool, project: project) }
        })
    }

    /// `plugin · x · a hint`, for a palette row.
    nonisolated static func toolDetail(_ tool: WorkbenchToolInfo) -> String {
        [tool.origin.tag, tool.kind == "page" ? (tool.page ?? "page") : (tool.renderer ?? "view"), tool.hint]
            .filter { !$0.isEmpty }.joined(separator: " · ")
    }

    func openTool(_ tool: WorkbenchToolInfo, project: String) {
        guard let uri = tool.uri(project: project) else { return flash("Can't open \(tool.address)") }
        openOrFocus(uri)
    }
}
