import Foundation
import Darwin
import Yams

/// A project on another machine, reached over SSH.
///
/// The app starts the same host there (`ssh <host> … luca workbench`) and
/// keeps its stdin open, so the host stops when the project closes or the
/// link drops. The host still listens on that machine's 127.0.0.1 only; a
/// second `ssh -N -L` brings its port to a free port here, and the client
/// talks to that. The token guards every request as before.
///
/// `<host>` is passed to ssh as typed, so an alias from `~/.ssh/config`
/// brings its own user, key, port and ProxyJump. ssh runs in batch mode: a
/// host that would ask for a password fails with one line and never hangs.
enum RemoteProject {
    /// `gpubox:~/@lab`, `me@box:/srv/app`: the host and the folder there.
    /// Nil for a local path. Pure, so every rule is tested.
    static func parse(_ text: String) -> (host: String, path: String)? {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let colon = trimmed.firstIndex(of: ":") else { return nil }
        let host = String(trimmed[..<colon])
        var path = String(trimmed[trimmed.index(after: colon)...]).trimmingCharacters(in: .whitespaces)
        // A host has no slash and no space; a local path with a colon in it does.
        guard !host.isEmpty, !host.hasPrefix("-"), host.allSatisfy({ $0.isLetter || $0.isNumber || "-_.@".contains($0) }) else { return nil }
        guard path == "~" || path.hasPrefix("~/") || path.hasPrefix("/") else { return nil }
        while path.count > 1, path.hasSuffix("/") { path.removeLast() }
        return (host, path)
    }

    /// The id of a remote project: the folder's name and the host, `lab-gpubox`.
    static func id(host: String, path: String, taken: Set<String>) -> String {
        let folder = ProjectList.slug((path as NSString).lastPathComponent)
        let machine = ProjectList.slug(host.split(separator: "@").last.map(String.init) ?? host)
        let base = "\(folder == "project" && path == "~" ? "home" : folder)-\(machine)"
        guard taken.contains(base) else { return base }
        var n = 2
        while taken.contains("\(base)-\(n)") { n += 1 }
        return "\(base)-\(n)"
    }

    /// One word for a POSIX shell.
    static func quote(_ word: String) -> String {
        if !word.isEmpty, word.allSatisfy({ $0.isLetter || $0.isNumber || "-_./=:@%+,".contains($0) }) { return word }
        return "'" + word.replacingOccurrences(of: "'", with: "'\\''") + "'"
    }

    /// The folder as a `cd` argument: a leading `~` stays for the remote shell to expand.
    static func cdArgument(_ path: String) -> String {
        if path == "~" { return "~" }
        if path.hasPrefix("~/") { return "~/" + quote(String(path.dropFirst(2))) }
        return quote(path)
    }

    /// What ssh runs there. A login, interactive shell reads the profile
    /// that puts `luca` and `bun` on the PATH; `exec` leaves the host as the
    /// process that holds stdin.
    static func remoteCommand(path: String, words: [String]) -> String {
        let inner = "cd \(cdArgument(path)) && exec \(words.map(quote).joined(separator: " "))"
        return "exec \"${SHELL:-/bin/sh}\" -ilc \(quote(inner))"
    }

    static let sshOptions = ["-o", "BatchMode=yes", "-o", "ConnectTimeout=10", "-o", "ServerAliveInterval=15", "-o", "ServerAliveCountMax=3"]

    /// `ssh` arguments that start the host. No tty: stdin is the host's life line.
    static func hostArguments(host: String, path: String, words: [String]) -> [String] {
        sshOptions + ["-T", "--", host, remoteCommand(path: path, words: words)]
    }

    /// `ssh` arguments that bring `remotePort` there to `localPort` here.
    static func tunnelArguments(host: String, localPort: Int, remotePort: Int) -> [String] {
        sshOptions + ["-o", "ExitOnForwardFailure=yes", "-N", "-T", "-L", "127.0.0.1:\(localPort):127.0.0.1:\(remotePort)", "--", host]
    }

    /// `ssh -t` arguments for a shell in the folder, for the terminal tile.
    static func shellArguments(host: String, path: String) -> [String] {
        ["-t", "--", host, "cd \(cdArgument(path)) && exec \"${SHELL:-/bin/sh}\" -l"]
    }

    /// The host command for one machine: `hosts: { gpubox: { hostCommand: [...] } }`
    /// in settings.yml, else `luca workbench`. The local override does not apply there.
    static func words(settings: String?, host: String) -> [String] {
        guard let settings, let root = (try? Yams.load(yaml: settings)) as? [String: Any],
              let hosts = root["hosts"] as? [String: Any], let entry = hosts[host] as? [String: Any],
              let value = entry["hostCommand"] else { return HostCommand.defaultWords }
        if let list = value as? [Any] {
            let words = list.compactMap { ($0 as? String) ?? ($0 as? NSNumber)?.stringValue }.filter { !$0.isEmpty }
            return words.isEmpty ? HostCommand.defaultWords : words
        }
        if let text = value as? String {
            let words = HostCommand.split(text)
            return words.isEmpty ? HostCommand.defaultWords : words
        }
        return HostCommand.defaultWords
    }

    /// A start that failed, in words that say what to do.
    static func explain(_ error: Error, host: String) -> String {
        guard case let HostStartError.exited(code, raw) = error else {
            return (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
        // An interactive shell with no terminal complains on its way in. That is not the reason.
        let noise = ["can't change option: zle", "no job control", "cannot set terminal process group"]
        let last = noise.contains(where: raw.contains) ? "" : raw
        switch code {
        case 255: return "ssh to \(host) failed" + (last.isEmpty ? "" : ": \(last)")
        case 127: return "No luca on \(host)" + (last.isEmpty ? "" : " (\(last))") + ". Set hosts.\(host).hostCommand in settings.yml"
        default:
            // An older luca prints its help and exits 0: it has no `workbench` command.
            return "luca on \(host) started no workbench host (exit \(code))" + (last.isEmpty ? "" : ": \(last)")
                + ". It may be older than `luca workbench`: update it, or set hosts.\(host).hostCommand in settings.yml"
        }
    }

    /// The concrete `Host` names of an ssh config text. Patterns (`*`, `?`, `!`) are left out. Pure.
    static func hosts(inConfig text: String) -> [String] {
        var out: [String] = []
        for raw in text.split(separator: "\n") {
            let line = raw.trimmingCharacters(in: .whitespaces)
            guard line.lowercased().hasPrefix("host "), !line.lowercased().hasPrefix("hostname") else { continue }
            for name in line.dropFirst(5).split(whereSeparator: { $0 == " " || $0 == "\t" }).map(String.init)
            where !name.contains("*") && !name.contains("?") && !name.hasPrefix("!") && !out.contains(name) {
                out.append(name)
            }
        }
        return out
    }

    /// The hosts of `~/.ssh/config` and the files it includes (one level).
    static func configuredHosts() -> [String] {
        let dir = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent(".ssh")
        guard let text = try? String(contentsOf: dir.appendingPathComponent("config"), encoding: .utf8) else { return [] }
        var all = hosts(inConfig: text)
        for raw in text.split(separator: "\n") {
            let line = raw.trimmingCharacters(in: .whitespaces)
            guard line.lowercased().hasPrefix("include ") else { continue }
            for pattern in line.dropFirst(8).split(separator: " ").map(String.init) {
                var path = pattern.hasPrefix("~/") ? FileManager.default.homeDirectoryForCurrentUser.path + String(pattern.dropFirst(1)) : pattern
                if !path.hasPrefix("/") { path = dir.appendingPathComponent(path).path }
                var result = glob_t()
                defer { globfree(&result) }
                guard glob(path, 0, nil, &result) == 0 else { continue }
                for index in 0..<Int(result.gl_matchc) {
                    guard let found = result.gl_pathv[index], let included = try? String(contentsOfFile: String(cString: found), encoding: .utf8) else { continue }
                    for name in hosts(inConfig: included) where !all.contains(name) { all.append(name) }
                }
            }
        }
        return all
    }

    /// A port nothing listens on here, for the near end of a tunnel.
    static func freeLocalPort() -> Int? {
        let fd = socket(AF_INET, SOCK_STREAM, 0)
        guard fd >= 0 else { return nil }
        defer { close(fd) }
        var address = sockaddr_in()
        address.sin_len = UInt8(MemoryLayout<sockaddr_in>.size)
        address.sin_family = sa_family_t(AF_INET)
        address.sin_addr.s_addr = inet_addr("127.0.0.1")
        address.sin_port = 0
        let bound = withUnsafePointer(to: &address) { $0.withMemoryRebound(to: sockaddr.self, capacity: 1) { bind(fd, $0, socklen_t(MemoryLayout<sockaddr_in>.size)) } }
        guard bound == 0 else { return nil }
        var length = socklen_t(MemoryLayout<sockaddr_in>.size)
        let named = withUnsafeMutablePointer(to: &address) { $0.withMemoryRebound(to: sockaddr.self, capacity: 1) { getsockname(fd, $0, &length) } }
        guard named == 0 else { return nil }
        return Int(UInt16(bigEndian: address.sin_port))
    }

    /// True when something accepts a connection on 127.0.0.1:`port`.
    static func accepts(port: Int) -> Bool {
        let fd = socket(AF_INET, SOCK_STREAM, 0)
        guard fd >= 0 else { return false }
        defer { close(fd) }
        var address = sockaddr_in()
        address.sin_len = UInt8(MemoryLayout<sockaddr_in>.size)
        address.sin_family = sa_family_t(AF_INET)
        address.sin_addr.s_addr = inet_addr("127.0.0.1")
        address.sin_port = UInt16(port).bigEndian
        return withUnsafePointer(to: &address) { $0.withMemoryRebound(to: sockaddr.self, capacity: 1) { connect(fd, $0, socklen_t(MemoryLayout<sockaddr_in>.size)) } } == 0
    }
}

/// One `ssh -N -L`: a port on another machine, here.
final class SSHTunnel: @unchecked Sendable {
    let host: String
    let localPort: Int
    let remotePort: Int
    /// The tunnel closed on its own. Called on the main queue with ssh's last line.
    var onExit: (@MainActor (String) -> Void)?

    private let process = Process()
    private let stderrPipe = Pipe()
    private let lock = NSLock()
    private var tail = ""
    private var stopping = false

    init(host: String, localPort: Int, remotePort: Int) {
        self.host = host
        self.localPort = localPort
        self.remotePort = remotePort
    }

    private var lastLine: String {
        lock.lock()
        defer { lock.unlock() }
        return String((tail.split(separator: "\n").map { $0.trimmingCharacters(in: .whitespaces) }.last { !$0.isEmpty } ?? "").prefix(240))
    }

    /// Start ssh and wait until the near end accepts. Throws with ssh's own line.
    func open(environment: [String: String], timeout: TimeInterval = 15) async throws {
        process.executableURL = URL(fileURLWithPath: "/usr/bin/ssh")
        process.arguments = RemoteProject.tunnelArguments(host: host, localPort: localPort, remotePort: remotePort)
        process.environment = environment
        process.standardInput = FileHandle.nullDevice
        process.standardOutput = FileHandle.nullDevice
        process.standardError = stderrPipe
        stderrPipe.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let data = handle.availableData
            guard let self else { return }
            if data.isEmpty { handle.readabilityHandler = nil; return }
            self.lock.lock()
            self.tail = String((self.tail + String(decoding: data, as: UTF8.self)).suffix(2000))
            self.lock.unlock()
        }
        process.terminationHandler = { [weak self] _ in
            guard let self else { return }
            self.lock.lock()
            let quiet = self.stopping
            self.lock.unlock()
            guard !quiet, let onExit = self.onExit else { return }
            let line = self.lastLine
            DispatchQueue.main.async { MainActor.assumeIsolated { onExit(line) } }
        }
        do { try process.run() } catch { throw HostStartError.launchFailed("ssh: \(error.localizedDescription)") }
        let end = Date().addingTimeInterval(timeout)
        while Date() < end {
            if !process.isRunning { throw HostStartError.launchFailed("tunnel to \(host) failed" + (lastLine.isEmpty ? "" : ": \(lastLine)")) }
            if RemoteProject.accepts(port: localPort) { return }
            try await Task.sleep(for: .milliseconds(80))
        }
        close()
        throw HostStartError.launchFailed("tunnel to \(host) did not open in \(Int(timeout))s")
    }

    func close() {
        lock.lock()
        stopping = true
        lock.unlock()
        stderrPipe.fileHandleForReading.readabilityHandler = nil
        if process.isRunning { process.terminate() }
    }
}
