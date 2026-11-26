import Foundation
import Darwin

/// Why a host did not start. Each reads as one line in the tile.
enum HostStartError: LocalizedError, Equatable {
    case folderMissing(String)
    case commandNotFound(String)
    case launchFailed(String)
    case exited(Int32, String)
    case timedOut(Int)

    var errorDescription: String? {
        switch self {
        case .folderMissing(let path): return "Project folder is gone: \(path)"
        case .commandNotFound(let word):
            return "Host command not found: \(word). Set hostCommand in settings.yml or \(HostCommand.environmentName)."
        case .launchFailed(let why): return "Could not start the host: \(why)"
        case let .exited(code, last): return "Host exited (\(code))" + (last.isEmpty ? " before it was ready" : ": \(last)")
        case .timedOut(let seconds): return "Host printed no port in \(seconds)s"
        }
    }
}

/// One running `luca workbench` (or the configured command) for a project.
///
/// The host prints `{"port","token"}` first on stdout and exits when its
/// stdin closes, so this keeps the stdin pipe open for the host's whole
/// life. If the app dies, the pipe closes and the host goes with it.
/// stderr goes to `logs/hosts/<project>.log`; its last line explains a
/// failed start.
final class WorkbenchHostProcess: @unchecked Sendable {
    let projectId: String
    let folder: String
    let executable: String
    let arguments: [String]

    /// The host stopped after it was ready. Called on the main queue.
    var onExit: (@MainActor (Int32, String) -> Void)?

    private let process = Process()
    private let stdinPipe = Pipe()
    private let stdoutPipe = Pipe()
    private let stderrPipe = Pipe()
    private let lock = NSLock()
    private var stdoutBuffer = ""
    private var stderrTail = ""
    private var handshake: HostHandshake.Info?
    private var waiter: CheckedContinuation<HostHandshake.Info, Error>?
    private var startError: Error?
    private var stopping = false
    private var log: FileHandle?

    init(projectId: String, folder: String, executable: String, arguments: [String]) {
        self.projectId = projectId
        self.folder = folder
        self.executable = executable
        self.arguments = arguments
    }

    var pid: Int32 { process.processIdentifier }
    var isRunning: Bool { process.isRunning }

    func start(environment: [String: String], logFile: URL, timeout: Int = 90) async throws -> HostHandshake.Info {
        try? FileManager.default.createDirectory(at: logFile.deletingLastPathComponent(), withIntermediateDirectories: true)
        if !FileManager.default.fileExists(atPath: logFile.path) { FileManager.default.createFile(atPath: logFile.path, contents: nil) }
        log = try? FileHandle(forWritingTo: logFile)
        log?.seekToEndOfFile()
        writeLog("\n--- \(Date()) \(executable) \(arguments.joined(separator: " ")) in \(folder)\n")

        process.executableURL = URL(fileURLWithPath: executable)
        process.arguments = arguments
        process.currentDirectoryURL = URL(fileURLWithPath: folder, isDirectory: true)
        process.environment = environment
        process.standardInput = stdinPipe
        process.standardOutput = stdoutPipe
        process.standardError = stderrPipe

        stdoutPipe.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let data = handle.availableData
            guard let self else { return }
            if data.isEmpty { handle.readabilityHandler = nil; return }
            self.readStdout(data)
        }
        stderrPipe.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let data = handle.availableData
            guard let self else { return }
            if data.isEmpty { handle.readabilityHandler = nil; return }
            self.readStderr(data)
        }
        process.terminationHandler = { [weak self] process in
            self?.exited(process.terminationStatus)
        }

        do {
            try process.run()
        } catch {
            throw HostStartError.launchFailed(error.localizedDescription)
        }

        return try await withCheckedThrowingContinuation { continuation in
            lock.lock()
            if let handshake {
                lock.unlock()
                continuation.resume(returning: handshake)
                return
            }
            if let startError {
                lock.unlock()
                continuation.resume(throwing: startError)
                return
            }
            waiter = continuation
            lock.unlock()
            DispatchQueue.global().asyncAfter(deadline: .now() + .seconds(timeout)) { [weak self] in
                guard let self else { return }
                if self.fail(HostStartError.timedOut(timeout)) { self.stopNow(grace: 0.5) }
            }
        }
    }

    private func readStdout(_ data: Data) {
        let text = String(decoding: data, as: UTF8.self)
        lock.lock()
        guard handshake == nil else { lock.unlock(); writeLog(text); return }
        stdoutBuffer += text
        let (lines, rest) = HostHandshake.lines(stdoutBuffer)
        stdoutBuffer = rest
        var found: HostHandshake.Info?
        for line in lines {
            if found == nil, let info = HostHandshake.parse(line) { found = info } else { writeLog("stdout: \(line)\n") }
        }
        guard let found else { lock.unlock(); return }
        handshake = found
        let waiting = waiter
        waiter = nil
        lock.unlock()
        waiting?.resume(returning: found)
    }

    private func readStderr(_ data: Data) {
        let text = String(decoding: data, as: UTF8.self)
        writeLog(text)
        lock.lock()
        stderrTail = String((stderrTail + text).suffix(4000))
        lock.unlock()
    }

    /// The last line of stderr that says something.
    private var lastErrorLine: String {
        lock.lock()
        defer { lock.unlock() }
        let line = stderrTail.split(separator: "\n").map { $0.trimmingCharacters(in: .whitespaces) }.last { !$0.isEmpty } ?? ""
        return String(line.prefix(240))
    }

    /// Fail a start still waiting. True when it was waiting.
    @discardableResult
    private func fail(_ error: Error) -> Bool {
        lock.lock()
        guard handshake == nil, startError == nil else { lock.unlock(); return false }
        startError = error
        let waiting = waiter
        waiter = nil
        lock.unlock()
        waiting?.resume(throwing: error)
        return true
    }

    private func exited(_ code: Int32) {
        // Let the last stderr bytes land before reading them.
        Thread.sleep(forTimeInterval: 0.1)
        let last = lastErrorLine
        writeLog("--- exited \(code)\n")
        if fail(HostStartError.exited(code, last)) { return }
        lock.lock()
        let quiet = stopping
        lock.unlock()
        guard !quiet, let onExit else { return }
        DispatchQueue.main.async { MainActor.assumeIsolated { onExit(code, last) } }
    }

    /// Close stdin, which the host takes as "exit". If it is still running
    /// after `grace`, SIGTERM, then SIGKILL. Blocks for at most
    /// `grace + 1` seconds; call off the main thread unless quitting.
    func stopNow(grace: TimeInterval) {
        lock.lock()
        stopping = true
        lock.unlock()
        try? stdinPipe.fileHandleForWriting.close()
        guard waitForExit(grace) == false else { return finish() }
        if process.isRunning { process.terminate() }
        guard waitForExit(0.7) == false else { return finish() }
        if process.isRunning { kill(process.processIdentifier, SIGKILL) }
        _ = waitForExit(0.3)
        finish()
    }

    /// True when the process is gone within `seconds`.
    private func waitForExit(_ seconds: TimeInterval) -> Bool {
        guard process.processIdentifier > 0 else { return true }
        let end = Date().addingTimeInterval(seconds)
        while process.isRunning, Date() < end { Thread.sleep(forTimeInterval: 0.02) }
        return !process.isRunning
    }

    private func finish() {
        fail(HostStartError.exited(-1, "stopped"))
        stdoutPipe.fileHandleForReading.readabilityHandler = nil
        stderrPipe.fileHandleForReading.readabilityHandler = nil
        lock.lock()
        let handle = log
        log = nil
        lock.unlock()
        try? handle?.close()
    }

    private func writeLog(_ text: String) {
        guard let data = text.data(using: .utf8) else { return }
        log?.write(data)
    }
}
