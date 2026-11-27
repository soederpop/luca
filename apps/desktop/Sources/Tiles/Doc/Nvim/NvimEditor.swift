import AppKit
import SwiftTerm

/// The source view as real Neovim: the user's own `nvim` (config, plugins)
/// drawn by SwiftTerm, with a second line to the same process over its
/// `--listen` socket. The app's buffer stays the one source of truth: nvim
/// edits a scratch buffer (`buftype=acwrite`) that the app fills, every
/// change comes back as `luca_text`, and `:w` is the app's save
/// (`BufWriteCmd`), so the digest and conflict flow still apply.
@MainActor
final class NvimEditor: NSObject, LocalProcessTerminalViewDelegate {
    let terminal = LocalProcessTerminalView(frame: .zero)
    private let socketPath: String
    private var rpc: NvimRPC?
    /// The text nvim holds, so a change nvim made is not pushed back.
    private var nvimText: String
    private var ready = false
    private let name: String
    private let language: String
    nonisolated(unsafe) private var pid: pid_t = 0

    var onText: (String) -> Void = { _ in }
    var onSave: () -> Void = {}
    /// `Esc` in Normal mode: nvim has no use for it, the app takes it back.
    var onEscape: () -> Void = {}
    /// The process ended: `:q` (0), or a crash or a bad config (not 0).
    var onExit: (Int32) -> Void = { _ in }

    /// `LUCA_DESKTOP_NVIM` wins, else the first `nvim` on the login PATH
    /// and the usual install places.
    static var executable: String? {
        let env = ProcessInfo.processInfo.environment
        if let path = env["LUCA_DESKTOP_NVIM"], FileManager.default.isExecutableFile(atPath: path) { return path }
        for dir in searchPath {
            let path = (dir as NSString).appendingPathComponent("nvim")
            if FileManager.default.isExecutableFile(atPath: path) { return path }
        }
        return nil
    }

    private static var searchPath: [String] {
        HostCommand.searchPath(loginPath: nil, environmentPath: ProcessInfo.processInfo.environment["PATH"],
                               home: FileManager.default.homeDirectoryForCurrentUser.path)
    }

    init(text: String, language: String, name: String) {
        nvimText = text
        self.language = language
        self.name = name
        // sun_path holds 104 bytes: keep the name short.
        let dir = (NSTemporaryDirectory() as NSString).standardizingPath
        socketPath = (dir as NSString).appendingPathComponent("luca-nvim-\(UUID().uuidString.prefix(8)).sock")
        super.init()
        terminal.font = NSFont.monospacedSystemFont(ofSize: KitTokens.TypeScale.sm, weight: .regular)
        terminal.processDelegate = self
        applyColors()
    }

    deinit {
        if pid != 0 { kill(pid, SIGTERM) }
        unlink(socketPath)
    }

    /// Starts nvim in `folder` (its working directory) and connects once
    /// the socket is up. False when there is no nvim to run.
    @discardableResult
    func start(folder: String?) -> Bool {
        guard let nvim = Self.executable else { return false }
        var env = ProcessInfo.processInfo.environment
        env["TERM"] = "xterm-256color"
        env["COLORTERM"] = "truecolor"
        env["LANG"] = env["LANG"] ?? "en_US.UTF-8"
        env["PATH"] = Self.searchPath.joined(separator: ":")
        // An nvim started from a :terminal inside nvim would talk to the parent.
        env.removeValue(forKey: "NVIM")
        env.removeValue(forKey: "NVIM_LISTEN_ADDRESS")
        let cwd = folder.flatMap { FileManager.default.fileExists(atPath: $0) ? $0 : nil }
            ?? FileManager.default.homeDirectoryForCurrentUser.path
        unlink(socketPath)
        terminal.startProcess(executable: nvim, args: ["-n", "--listen", socketPath],
                              environment: env.map { "\($0.key)=\($0.value)" }, execName: "nvim", currentDirectory: cwd)
        pid = terminal.process?.shellPid ?? 0
        Task { @MainActor [weak self] in await self?.connect() }
        return true
    }

    private func connect() async {
        for _ in 0..<200 {
            if let rpc = NvimRPC.connect(path: socketPath) {
                self.rpc = rpc
                rpc.onNotification = { [weak self] method, params in self?.notified(method, params) }
                rpc.request("nvim_get_api_info", []) { [weak self] _, result in
                    guard let self, let channel = result.arrayValue?.first?.intValue else { return }
                    self.setUp(channel: channel)
                }
                return
            }
            if pid == 0 { return }
            try? await Task.sleep(for: .milliseconds(25))
        }
        AppLogger.error("nvim: no socket at \(socketPath) after 5 s")
    }

    private func setUp(channel: Int) {
        let (lines, eol) = Self.lines(of: nvimText)
        rpc?.request("nvim_exec_lua", [.string(Self.setupLua), .array([
            .int(Int64(channel)), .string(name), .string(Self.filetype(for: language)), lines, .bool(eol),
        ])]) { [weak self] error, _ in
            if let error {
                AppLogger.error("nvim setup: \(NvimRPC.errorText(error))")
                return
            }
            self?.ready = true
        }
    }

    /// A change from elsewhere (the rich view, a reload). Kept as one
    /// change in nvim's undo, with the cursor where it was.
    func setText(_ text: String) {
        guard text != nvimText else { return }
        nvimText = text
        guard ready else { return }
        let (lines, eol) = Self.lines(of: text)
        rpc?.request("nvim_exec_lua", [.string("luca_desktop.set(...)"), .array([lines, .bool(eol)])])
    }

    var hasFocus: Bool { terminal.window?.firstResponder === terminal }

    func focus() {
        terminal.window?.makeFirstResponder(terminal)
    }

    func stop() {
        rpc?.disconnect()
        rpc = nil
        if pid != 0, terminal.process?.running == true { terminal.terminate() }
    }

    private func notified(_ method: String, _ params: [MsgPack]) {
        switch method {
        case "luca_text":
            guard params.count == 2, let lines = params[0].arrayValue else { return }
            let text = Self.text(lines: lines.map { $0.stringValue ?? "" }, eol: params[1].boolValue ?? true)
            guard text != nvimText else { return }
            nvimText = text
            onText(text)
        case "luca_save": onSave()
        case "luca_escape": onEscape()
        default: break
        }
    }

    func applyColors() {
        let p = Theme.palette
        terminal.nativeBackgroundColor = NSColor(p.inset.color)
        terminal.nativeForegroundColor = NSColor(p.textBody.color)
        terminal.caretColor = NSColor(p.accent.color)
        terminal.installColors(p.terminalColors(dark: ThemeSettings.currentDark).map {
            SwiftTerm.Color(red: UInt16($0.red * 65535), green: UInt16($0.green * 65535), blue: UInt16($0.blue * 65535))
        })
    }

    // MARK: Text <-> lines

    /// nvim holds lines plus `eol` (the file ends in a newline). A file
    /// with no final newline is `noeol`, so the bytes come back the same.
    nonisolated static func lines(of text: String) -> (MsgPack, Bool) {
        var parts = text.components(separatedBy: "\n")
        var eol = false
        if parts.count > 1, parts.last == "" {
            parts.removeLast()
            eol = true
        }
        return (.array(parts.map { .string($0) }), eol)
    }

    nonisolated static func text(lines: [String], eol: Bool) -> String {
        lines.joined(separator: "\n") + (eol ? "\n" : "")
    }

    /// The source editor's language names are nvim filetypes already.
    nonisolated static func filetype(for language: String) -> String {
        language
    }

    /// Runs once per nvim: a scratch buffer of its own (a start screen
    /// plugin may own the first one), filled from the app, its changes,
    /// writes and Normal-mode `Esc` sent back on the channel.
    static let setupLua = """
    local chan, name, ft, lines, eol = ...
    local M = {}
    _G.luca_desktop = M
    local buf = vim.api.nvim_create_buf(true, false)
    vim.api.nvim_set_current_buf(buf)
    pcall(vim.api.nvim_buf_set_name, buf, name)
    vim.bo[buf].buftype = 'acwrite'
    vim.bo[buf].swapfile = false
    vim.bo[buf].bufhidden = 'hide'
    local function send()
      vim.rpcnotify(chan, 'luca_text', vim.api.nvim_buf_get_lines(buf, 0, -1, false), vim.bo[buf].eol)
    end
    function M.set(next_lines, next_eol)
      local cur = vim.api.nvim_buf_get_lines(buf, 0, -1, false)
      if vim.deep_equal(cur, next_lines) and vim.bo[buf].eol == next_eol then return end
      local view = vim.api.nvim_get_current_buf() == buf and vim.fn.winsaveview() or nil
      vim.api.nvim_buf_set_lines(buf, 0, -1, false, next_lines)
      vim.bo[buf].eol = next_eol
      if view then pcall(vim.fn.winrestview, view) end
    end
    -- The first fill is not an edit: `u` must not undo to an empty buffer.
    local levels = vim.bo[buf].undolevels
    vim.bo[buf].undolevels = -1
    M.set(lines, eol)
    vim.bo[buf].undolevels = levels
    vim.bo[buf].modified = false
    vim.bo[buf].filetype = ft
    vim.api.nvim_create_autocmd({ 'TextChanged', 'TextChangedI', 'TextChangedP' }, { buffer = buf, callback = send })
    vim.api.nvim_create_autocmd('BufWriteCmd', { buffer = buf, callback = function()
      send()
      vim.rpcnotify(chan, 'luca_save')
      vim.bo[buf].modified = false
    end })
    vim.keymap.set('n', '<Esc>', function()
      vim.cmd('nohlsearch')
      vim.rpcnotify(chan, 'luca_escape')
    end, { buffer = buf, desc = 'Luca Desktop: back to the app' })
    """

    // MARK: LocalProcessTerminalViewDelegate

    nonisolated func sizeChanged(source: LocalProcessTerminalView, newCols: Int, newRows: Int) {}
    nonisolated func setTerminalTitle(source: LocalProcessTerminalView, title: String) {}
    nonisolated func hostCurrentDirectoryUpdate(source: TerminalView, directory: String?) {}

    nonisolated func processTerminated(source: TerminalView, exitCode: Int32?) {
        Task { @MainActor in
            self.pid = 0
            self.ready = false
            self.rpc?.disconnect()
            self.rpc = nil
            unlink(self.socketPath)
            self.onExit(exitCode ?? 0)
        }
    }
}
