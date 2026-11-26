import SwiftUI

/// Run a markdown doc or file with `luca prompt`: pick who gets it (one of
/// the project's assistants, or Claude Code, Codex or Hermes), then a
/// command tile beside the doc runs `luca prompt <target> <file>` and
/// shows the output as it comes. The host says what can run it
/// (`POST /prompt/targets`).
@MainActor
enum PromptRunner {
    /// The address of the command tile that runs `file` with `target` at once.
    nonisolated static func address(project: String, target: String, file: String, dryRun: Bool = false) -> TileURI {
        var options: [TileURI.Option] = [.init(name: "target", value: target), .init(name: "files", value: file)]
        if dryRun { options.append(.init(name: "dry-run", value: "true")) }
        options.append(.init(name: "run", value: "1"))
        return TileURI.luca(project: project, tool: "command", id: "prompt", options: options)
    }

    /// The choices of the picker: what can run first, each with what it is.
    nonisolated static func choices(_ answer: WorkbenchPromptTargets) -> [(target: WorkbenchPromptTargets.Target, title: String, detail: String)] {
        let ordered = answer.targets.sorted { a, b in
            if a.available != b.available { return a.available }
            if (a.id == answer.defaultTarget) != (b.id == answer.defaultTarget) { return a.id == answer.defaultTarget }
            return false
        }
        return ordered.map { t in
            let kind = t.kind == "agent" ? "coding agent" : "assistant"
            let mark = t.id == answer.defaultTarget ? " · project default" : ""
            return (t, t.label, t.available ? "\(kind)\(mark)\(t.detail.isEmpty ? "" : " · " + t.detail)" : "\(kind) · \(t.detail)")
        }
    }

    /// Ask who runs it, then open the run beside `near`. Give `doc` (a doc id) or `file` (a project path).
    static func run(project: String, doc: String? = nil, file: String? = nil, near: UUID?, dryRun: Bool = false) {
        guard let host = ProjectHub.shared.client(project) else { return Shell.shared.flash("The workbench host is not running") }
        Task {
            do {
                let answer = try await host.promptTargets(doc: doc, file: file)
                let items = choices(answer).map { choice in
                    PaletteChoice(title: choice.title, detail: choice.detail) {
                        guard choice.target.available else { return Shell.shared.flash("\(choice.target.label) is not on this machine. See the AI tile (Space a)") }
                        _ = Shell.shared.open(address(project: project, target: choice.target.id, file: answer.file, dryRun: dryRun), near: near)
                    }
                }
                PaletteController.shared.choose(dryRun ? "show the prompt \(answer.file) becomes for" : "run \(answer.file) with", items)
            } catch {
                Shell.shared.flash(ErrorText.message(error))
            }
        }
    }
}
