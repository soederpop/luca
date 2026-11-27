import Foundation
import Combine
import Darwin

/// Where a project's host is.
enum HostStatus: Equatable {
    case stopped
    case starting
    case running
    /// One line for the tile.
    case failed(String)

    var label: String {
        switch self {
        case .stopped: return "stopped"
        case .starting: return "starting host"
        case .running: return "running"
        case .failed: return "host failed"
        }
    }
}

/// The project folders the app knows, and one workbench host per open
/// project, for `luca://` tiles.
///
/// A host lives while a tile holds its project (`acquire` / `release`). The
/// last release stops it a few seconds later, so a layout that swaps tiles
/// does not restart it. Quit stops every host (`stopAll`).
///
/// A tile is owned by `luca:<project>` (`ownerId`), so solo, workspace
/// names and colors go by project.
@MainActor
final class ProjectHub: ObservableObject {
    static let shared = ProjectHub()

    @Published private(set) var list = ProjectList()
    @Published private(set) var status: [String: HostStatus] = [:]
    /// Bumped whenever a project's client changes (new host, host gone).
    @Published private(set) var clientRevision: [String: Int] = [:]

    private var clients: [String: WorkbenchClient] = [:]
    /// Each host's `canvas-open` frames: an assistant made or used a canvas.
    /// On the portfolio host, also lucaPortfolio's copies to review.
    private var canvasWatch: [String: AnyCancellable] = [:]
    private var processes: [String: WorkbenchHostProcess] = [:]
    /// The ssh tunnels of remote projects: the host's own, then any other port brought here.
    private var tunnels: [String: [SSHTunnel]] = [:]
    private var refs: [String: Int] = [:]
    private var stopTasks: [String: Task<Void, Never>] = [:]
    private var startTasks: [String: Task<Void, Never>] = [:]
    private var attempts: [String: UUID] = [:]
    private var loginPath: String?
    private var loginPathRead = false

    nonisolated static let ownerPrefix = "luca:"
    /// How long a host outlives its last tile.
    static let idleStop: Duration = .seconds(5)

    nonisolated static func ownerId(_ project: String) -> String { ownerPrefix + project }

    nonisolated static func project(ofOwner owner: String) -> String? {
        owner.hasPrefix(ownerPrefix) ? String(owner.dropFirst(ownerPrefix.count)) : nil
    }

    static var file: URL { TilesPaths.root.appendingPathComponent("projects.json") }
    static var settings: URL { TilesPaths.root.appendingPathComponent("settings.yml") }

    private init() {}

    func start() {
        list = ProjectList.decode(try? Data(contentsOf: Self.file))
    }

    var recent: [KnownProject] { list.recent }

    /// A known project, or the portfolio (`PortfolioProject`), which is never in the list.
    func project(_ id: String) -> KnownProject? {
        id == PortfolioProject.id ? PortfolioProject.entry : list.project(id)
    }

    func displayName(_ id: String) -> String { project(id)?.label ?? id }

    func client(_ id: String) -> WorkbenchClient? { clients[id] }

    /// Any running host: for a question that is not about one project (the
    /// plugins folder is the machine's). The portfolio's first, as the one
    /// that is always known.
    func anyClient() -> WorkbenchClient? {
        clients[PortfolioProject.id] ?? clients.values.first
    }

    /// A client for the project, starting its host when none runs and
    /// holding it only while `run` works (the usual 5 s idle stop follows).
    /// Nil when the host does not come up in time.
    func withClient(_ id: String, timeout: Duration = .seconds(45), _ run: @escaping (WorkbenchClient?) -> Void) {
        if let client = clients[id] { return run(client) }
        acquire(id)
        Task { @MainActor [weak self] in
            let deadline = ContinuousClock.now + timeout
            var client: WorkbenchClient?
            while ContinuousClock.now < deadline {
                if let found = self?.clients[id] { client = found; break }
                if case .failed = self?.status[id] ?? .starting { break }
                try? await Task.sleep(for: .milliseconds(150))
            }
            run(client)
            self?.release(id)
        }
    }

    /// Remember a folder: `~/x`, relative to home, or absolute. The error is
    /// one line for the status line.
    func remember(path: String) -> Result<KnownProject, HostStartError> {
        // `gpubox:~/x`: a folder on another machine. It is checked when its host starts.
        if let remote = RemoteProject.parse(path) {
            let entry = list.add(host: remote.host, path: remote.path, now: Date())
            save()
            return .success(entry)
        }
        let home = FileManager.default.homeDirectoryForCurrentUser.path
        let full = ProjectList.normalize(path, home: home)
        var isDir: ObjCBool = false
        guard FileManager.default.fileExists(atPath: full, isDirectory: &isDir), isDir.boolValue else {
            return .failure(.folderMissing(full))
        }
        let entry = list.add(path: full, now: Date())
        save()
        return .success(entry)
    }

    /// The name the host reported, kept for labels.
    func noteName(_ name: String, for id: String) {
        guard id != PortfolioProject.id, list.project(id)?.name != name else { return }
        list.setName(name, for: id)
        save()
    }

    private func save() {
        TilesPaths.ensureRoot()
        try? list.encoded().write(to: Self.file, options: .atomic)
    }

    // MARK: Hosts

    func acquire(_ id: String) {
        refs[id, default: 0] += 1
        stopTasks[id]?.cancel()
        stopTasks[id] = nil
        if processes[id] == nil, startTasks[id] == nil { startHost(id) }
    }

    func release(_ id: String) {
        let left = max(0, (refs[id] ?? 0) - 1)
        refs[id] = left == 0 ? nil : left
        guard left == 0 else { return }
        stopTasks[id]?.cancel()
        stopTasks[id] = Task { [weak self] in
            try? await Task.sleep(for: Self.idleStop)
            guard !Task.isCancelled, let self, self.refs[id] == nil else { return }
            self.stopTasks[id] = nil
            self.stopHost(id)
        }
    }

    /// Stop and start again: after a settings change, or a host that died.
    func restart(_ id: String) {
        stopHost(id)
        if refs[id] != nil { startHost(id) }
    }

    private func startHost(_ id: String) {
        guard let entry = project(id) else {
            status[id] = .failed("Unknown project '\(id)'. Open its folder with :open-project <path>")
            return
        }
        status[id] = .starting
        let settings = try? String(contentsOf: Self.settings, encoding: .utf8)
        let words = HostCommand.words(settings: settings, environment: ProcessInfo.processInfo.environment)
        let logFile = TilesPaths.root.appendingPathComponent("logs/hosts/\(id).log")
        // A stop or restart makes this start stale: it then changes nothing.
        let attempt = UUID()
        attempts[id] = attempt
        startTasks[id] = Task { [weak self] in
            guard let self else { return }
            var started: WorkbenchHostProcess?
            do {
                let environment = await self.hostEnvironment()
                guard self.attempts[id] == attempt else { return }
                let process: WorkbenchHostProcess
                let program: String
                if let remote = entry.host {
                    // On another machine: ssh starts the host there and holds its stdin.
                    let remoteWords = RemoteProject.words(settings: settings, host: remote)
                    program = "/usr/bin/ssh"
                    process = WorkbenchHostProcess(projectId: id, folder: NSTemporaryDirectory(), executable: program,
                                                   arguments: RemoteProject.hostArguments(host: remote, path: entry.path, words: remoteWords))
                } else {
                    var isDir: ObjCBool = false
                    guard FileManager.default.fileExists(atPath: entry.path, isDirectory: &isDir), isDir.boolValue else {
                        throw HostStartError.folderMissing(entry.path)
                    }
                    let home = FileManager.default.homeDirectoryForCurrentUser.path
                    let search = (environment["PATH"] ?? "").split(separator: ":").map(String.init)
                    guard let first = words.first,
                          let found = HostCommand.executable(first, searchPath: search, home: home, isExecutable: { FileManager.default.isExecutableFile(atPath: $0) })
                    else { throw HostStartError.commandNotFound(words.first ?? "") }
                    program = found
                    process = WorkbenchHostProcess(projectId: id, folder: entry.path, executable: program, arguments: Array(words.dropFirst()))
                }
                started = process
                self.processes[id] = process
                process.onExit = { [weak self, weak process] code, last in
                    guard let self, let process, self.processes[id] === process else { return }
                    self.dropHost(id)
                    self.status[id] = .failed("Host stopped (\(code))" + (last.isEmpty ? "" : ": \(last)"))
                }
                AppLogger.info("Luca Desktop: starting host for \(id): \(program) \(process.arguments.joined(separator: " "))")
                var info = try await process.start(environment: environment, logFile: logFile)
                guard self.attempts[id] == attempt, self.processes[id] === process else { return }
                if let remote = entry.host {
                    // The host listens on that machine's loopback. Bring its port here.
                    let local = try await self.openTunnel(id, host: remote, remotePort: info.port, environment: environment, isHost: true)
                    guard self.attempts[id] == attempt, self.processes[id] === process else { return }
                    info = HostHandshake.Info(port: local, token: info.token)
                }
                self.startTasks[id] = nil
                let client = WorkbenchClient(info)
                client.connect()
                self.clients[id] = client
                self.canvasWatch[id] = client.events
                    .filter { $0.type == "canvas-open" || (id == PortfolioProject.id && $0.type == "event") }
                    .receive(on: DispatchQueue.main)
                    .sink { event in
                        if let review = PortfolioReview(event: event) { return Shell.shared.showReview(review) }
                        guard event.type == "canvas-open", let canvas = event.id else { return }
                        Shell.shared.showCanvas(CanvasContent.address(project: id, id: canvas))
                    }
                self.clientRevision[id, default: 0] += 1
                self.status[id] = .running
                AppLogger.info("Luca Desktop: host for \(id) on port \(info.port), pid \(process.pid)")
            } catch {
                if let started {
                    if self.processes[id] === started { self.processes[id] = nil }
                    DispatchQueue.global().async { started.stopNow(grace: 0.5) }
                }
                guard self.attempts[id] == attempt else { return }
                self.startTasks[id] = nil
                let line = entry.host.map { RemoteProject.explain(error, host: $0) } ?? (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
                self.closeTunnels(id)
                AppLogger.error("Luca Desktop: host for \(id) failed: \(line)")
                self.status[id] = .failed(line)
            }
        }
    }

    /// Open one tunnel for a project and keep it. `isHost`: the one the client uses; when it closes, the host is gone.
    private func openTunnel(_ id: String, host: String, remotePort: Int, environment: [String: String], isHost: Bool) async throws -> Int {
        guard let local = RemoteProject.freeLocalPort() else { throw HostStartError.launchFailed("no free local port for the tunnel") }
        let tunnel = SSHTunnel(host: host, localPort: local, remotePort: remotePort)
        try await tunnel.open(environment: environment)
        tunnels[id, default: []].append(tunnel)
        tunnel.onExit = { [weak self, weak tunnel] line in
            guard let self, let tunnel, self.tunnels[id]?.contains(where: { $0 === tunnel }) == true else { return }
            self.tunnels[id]?.removeAll { $0 === tunnel }
            guard isHost else { return }
            let process = self.processes[id]
            self.dropHost(id)
            self.status[id] = .failed("The link to \(host) closed" + (line.isEmpty ? "" : ": \(line)"))
            if let process { DispatchQueue.global().async { process.stopNow(grace: 0.5) } }
        }
        return local
    }

    private func closeTunnels(_ id: String) {
        let all = tunnels[id] ?? []
        tunnels[id] = nil
        for tunnel in all { tunnel.close() }
    }

    /// A port of a remote project's machine, here: for a page or a server it
    /// runs. A local project's port is already here. The tunnel lives as long as the host.
    func localPort(_ id: String, remotePort: Int) async throws -> Int {
        guard let entry = project(id), let host = entry.host else { return remotePort }
        if let open = tunnels[id]?.first(where: { $0.remotePort == remotePort }) { return open.localPort }
        return try await openTunnel(id, host: host, remotePort: remotePort, environment: await hostEnvironment(), isHost: false)
    }

    /// A URL of a remote project's own machine (`http://localhost:3000/x`), as a URL that works here.
    func reachable(_ id: String, url: String) async -> String {
        guard project(id)?.host != nil, var parts = URLComponents(string: url),
              let host = parts.host, ["localhost", "127.0.0.1", "0.0.0.0"].contains(host), let port = parts.port,
              let local = try? await localPort(id, remotePort: port) else { return url }
        parts.host = "127.0.0.1"
        parts.port = local
        return parts.string ?? url
    }

    private func dropHost(_ id: String) {
        closeTunnels(id)
        clients[id]?.close()
        clients[id] = nil
        canvasWatch[id] = nil
        processes[id] = nil
        clientRevision[id, default: 0] += 1
    }

    private func stopHost(_ id: String) {
        attempts[id] = nil
        startTasks[id]?.cancel()
        startTasks[id] = nil
        let process = processes[id]
        dropHost(id)
        status[id] = .stopped
        guard let process else { return }
        DispatchQueue.global().async { process.stopNow(grace: 2) }
    }

    /// Quit: every host, now. Blocks for at most about two seconds.
    func stopAll() {
        let all = Array(processes.values)
        attempts.removeAll()
        for task in startTasks.values { task.cancel() }
        startTasks.removeAll()
        for id in Array(processes.keys) { dropHost(id) }
        for id in Array(tunnels.keys) { closeTunnels(id) }
        let group = DispatchGroup()
        for process in all {
            group.enter()
            DispatchQueue.global().async { process.stopNow(grace: 1); group.leave() }
        }
        _ = group.wait(timeout: .now() + 3)
    }

    /// This process's environment with the login shell's PATH, since a GUI
    /// app starts with a short one. The shell is asked once.
    private func hostEnvironment() async -> [String: String] {
        if !loginPathRead {
            loginPathRead = true
            loginPath = await Task.detached { Self.readLoginPath() }.value
        }
        var env = ProcessInfo.processInfo.environment
        let home = FileManager.default.homeDirectoryForCurrentUser.path
        env["PATH"] = HostCommand.searchPath(loginPath: loginPath, environmentPath: env["PATH"], home: home).joined(separator: ":")
        return env
    }

    nonisolated private static func readLoginPath() -> String? {
        let shell = ProcessInfo.processInfo.environment["SHELL"].flatMap { $0.isEmpty ? nil : $0 } ?? "/bin/zsh"
        let process = Process()
        process.executableURL = URL(fileURLWithPath: shell)
        process.arguments = ["-ilc", HostCommand.loginShellScript]
        let out = Pipe()
        process.standardOutput = out
        process.standardError = FileHandle.nullDevice
        process.standardInput = FileHandle.nullDevice
        do { try process.run() } catch { return nil }
        let end = Date().addingTimeInterval(5)
        while process.isRunning, Date() < end { Thread.sleep(forTimeInterval: 0.05) }
        if process.isRunning { process.terminate(); return nil }
        // Not readToEnd: a process the profile started may hold the pipe open.
        let data = out.fileHandleForReading.availableData
        return HostCommand.loginPath(fromOutput: String(decoding: data, as: UTF8.self))
    }
}
