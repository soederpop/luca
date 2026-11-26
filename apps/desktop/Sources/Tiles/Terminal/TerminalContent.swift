import SwiftUI
import AppKit
import SwiftTerm

/// `luca://<project>/terminal`: a login shell in the project's folder
/// (SwiftTerm).
/// `i` gives it the keyboard. In Insert mode every key goes to the shell,
/// `Esc` too, except `Mod` keys and the app's few global keys; `Mod-Esc`
/// gives the keys back. A click into the shell switches to Insert on the
/// first key (the shell checks focus on every key). The shell lives as long
/// as the tile.
///
/// `?run=<name>` types one of `startCommands` into the new shell, so a
/// command that asks questions (`luca setup`) gets a real terminal. Only
/// those names run: a web page may open tiles of its project, and must not
/// get to type into a shell. The option is dropped once typed, so a restored
/// tile is a plain shell.
@MainActor
final class TerminalContent: TileContent, LocalProcessTerminalViewDelegate {
    static let kind = TileKind(id: "luca-terminal", label: "Terminal", glyph: "terminal") { uri, owner in
        TerminalContent(uri: uri, owner: owner)
    }

    let terminal = LocalProcessTerminalView(frame: .zero)
    @Published private(set) var exited: Int32?
    @Published private(set) var folder: String?
    private var started = false

    let projectId: String

    static let startCommands: [String: String] = [
        "setup": "luca setup",
    ]

    /// A terminal of its own (id `setup`) that runs `luca setup`.
    nonisolated static func setupAddress(project: String) -> TileURI {
        TileURI.luca(project: project, tool: "terminal", id: "setup", options: [.init(name: "run", value: "setup")])
    }

    init(uri: TileURI, owner: String) {
        projectId = uri.authority
        super.init(kindId: Self.kind.id, uri: uri, owner: owner, title: "terminal · " + ProjectHub.shared.displayName(uri.authority))
        terminal.font = NSFont.monospacedSystemFont(ofSize: KitTokens.TypeScale.sm, weight: .regular)
        terminal.processDelegate = self
        applyColors()
    }

    override func makeBody() -> AnyView { AnyView(TerminalTileView(model: self)) }

    /// The folder comes from the known projects; the shell needs no host.
    override func start() {
        launch()
    }

    private func launch() {
        guard !started else { return }
        guard let project = ProjectHub.shared.project(projectId) else {
            stateLabel = "no folder"
            return
        }
        let path = project.path
        var env = ProcessInfo.processInfo.environment
        env["TERM"] = "xterm-256color"
        env["COLORTERM"] = "truecolor"
        env["LANG"] = env["LANG"] ?? "en_US.UTF-8"
        if let host = project.host {
            // A project on another machine: a shell there, in its folder.
            started = true
            folder = project.place
            exited = nil
            terminal.startProcess(executable: "/usr/bin/ssh", args: RemoteProject.shellArguments(host: host, path: path),
                                  environment: env.map { "\($0.key)=\($0.value)" }, execName: "ssh")
            stateLabel = "ssh \(host)"
            typeStartCommand()
            return
        }
        guard FileManager.default.fileExists(atPath: path) else {
            stateLabel = "no folder"
            return
        }
        started = true
        folder = path
        exited = nil
        let shell = env["SHELL"].flatMap { FileManager.default.isExecutableFile(atPath: $0) ? $0 : nil } ?? "/bin/zsh"
        let name = "-" + (shell as NSString).lastPathComponent
        terminal.startProcess(executable: shell, args: [], environment: env.map { "\($0.key)=\($0.value)" }, execName: name, currentDirectory: path)
        stateLabel = (shell as NSString).lastPathComponent
        typeStartCommand()
    }

    /// The shell reads it once it is up: typed input waits in the terminal.
    private func typeStartCommand() {
        guard let name = uri.option("run") else { return }
        uri = uri.with(option: "run", nil)
        Shell.shared.scheduleSave()
        guard let command = Self.startCommands[name] else {
            return Shell.shared.flash("No start command '\(name)'. Known: \(Self.startCommands.keys.sorted().joined(separator: ", "))")
        }
        terminal.send(txt: command + "\n")
        // It is about to ask questions: give it the keyboard once its window is up.
        Task { @MainActor [weak self] in
            try? await Task.sleep(for: .milliseconds(300))
            guard let self, Shell.shared.focusedId == self.tileId, self.terminal.window != nil else { return }
            _ = self.perform("terminal.insert")
        }
    }

    private func applyColors() {
        let p = Theme.palette
        terminal.nativeBackgroundColor = NSColor(p.inset.color)
        terminal.nativeForegroundColor = NSColor(p.textBody.color)
        terminal.caretColor = NSColor(p.accent.color)
    }

    override var editorHasKeyboard: Bool { terminal.window?.firstResponder === terminal }

    /// `Esc` belongs to the shell (vim, less) while it has the keyboard.
    override func passesEscape() -> Bool { editorHasKeyboard }

    override func perform(_ action: String) -> Bool {
        switch action {
        case "terminal.insert":
            terminal.window?.makeFirstResponder(terminal)
            Shell.shared.syncTextMode()
        case "terminal.restart":
            if exited == nil {
                Shell.shared.flash("The shell is still running")
            } else {
                started = false
                launch()
            }
        default: return false
        }
        return true
    }

    override func stop() {
        if exited == nil, started { terminal.terminate() }
        super.stop()
    }

    // MARK: LocalProcessTerminalViewDelegate

    nonisolated func sizeChanged(source: LocalProcessTerminalView, newCols: Int, newRows: Int) {}

    nonisolated func setTerminalTitle(source: LocalProcessTerminalView, title: String) {
        Task { @MainActor in
            if !title.isEmpty { self.stateLabel = title }
        }
    }

    nonisolated func hostCurrentDirectoryUpdate(source: TerminalView, directory: String?) {}

    nonisolated func processTerminated(source: TerminalView, exitCode: Int32?) {
        Task { @MainActor in
            self.exited = exitCode ?? 0
            self.stateLabel = "exited \(exitCode ?? 0)"
            if self.editorHasKeyboard { Shell.shared.leaveEditor() }
        }
    }
}

private struct TerminalHost: NSViewRepresentable {
    let view: LocalProcessTerminalView
    func makeNSView(context: Context) -> LocalProcessTerminalView { view }
    func updateNSView(_ nsView: LocalProcessTerminalView, context: Context) {}
}

struct TerminalTileView: View {
    @ObservedObject var model: TerminalContent

    var body: some View {
        VStack(spacing: 0) {
            TerminalHost(view: model.terminal)
                .padding(KitTokens.Space.s5)
                .background(Theme.palette.inset.color)
            HStack(spacing: KitTokens.Space.s5) {
                Text(model.folder.map { ($0 as NSString).abbreviatingWithTildeInPath } ?? "no project folder")
                    .font(WorkbenchStyle.code(KitTokens.TypeScale.xs))
                    .lineLimit(1).truncationMode(.head)
                    .foregroundStyle(Theme.ownerColor(model.owner))
                Spacer()
                if let code = model.exited {
                    Text("exited \(code)").foregroundStyle(Theme.palette.warn.color)
                    Text("new shell").keyBadge("terminal.restart", leading: true)
                }
                Text("type").keyBadge("terminal.insert", leading: true)
                Text("back to Normal").keyBadge("terminal.leave", leading: true)
            }
            .font(WorkbenchStyle.ui(KitTokens.TypeScale.xs))
            .foregroundStyle(Color.kitMuted)
            .padding(.horizontal, KitTokens.Space.s6)
            .padding(.vertical, KitTokens.Space.s4)
        }
        .background(Theme.palette.surface.color)
    }
}
