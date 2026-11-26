import Foundation
import Yams

/// The command that starts a project's workbench host, and how its words
/// become a program to run. Pure, so every rule is tested.
///
/// Order: `LUCA_DESKTOP_HOST_COMMAND` (space separated) wins, then
/// `hostCommand` in `~/.luca/desktop/settings.yml` (a list of strings),
/// then `luca workbench`.
enum HostCommand {
    static let defaultWords = ["luca", "workbench"]
    static let environmentName = "LUCA_DESKTOP_HOST_COMMAND"

    static func words(settings: String?, environment: [String: String]) -> [String] {
        if let text = environment[environmentName] {
            let words = split(text)
            if !words.isEmpty { return words }
        }
        if let settings, let words = settingsWords(settings), !words.isEmpty { return words }
        return defaultWords
    }

    /// `hostCommand: [bun, /x/cli.ts, workbench]`. A plain string is split on
    /// spaces too. Nil when the file has no usable key.
    static func settingsWords(_ yaml: String) -> [String]? {
        guard let root = (try? Yams.load(yaml: yaml)) as? [String: Any], let value = root["hostCommand"] else { return nil }
        if let list = value as? [Any] {
            let words = list.compactMap { item -> String? in
                if let s = item as? String { return s }
                if let n = item as? NSNumber { return n.stringValue }
                return nil
            }.filter { !$0.isEmpty }
            return words.isEmpty ? nil : words
        }
        if let text = value as? String {
            let words = split(text)
            return words.isEmpty ? nil : words
        }
        return nil
    }

    static func split(_ text: String) -> [String] {
        text.split(whereSeparator: { $0 == " " || $0 == "\t" || $0 == "\n" }).map(String.init)
    }

    /// The program for a command's first word. A word with a `/` is a path
    /// (`~/` expands); a bare name is looked up in `searchPath`, in order.
    static func executable(_ word: String, searchPath: [String], home: String, isExecutable: (String) -> Bool) -> String? {
        var name = word
        if name.hasPrefix("~/") { name = home + String(name.dropFirst(1)) }
        if name.contains("/") { return isExecutable(name) ? name : nil }
        for dir in searchPath where !dir.isEmpty {
            let candidate = (dir as NSString).appendingPathComponent(name)
            if isExecutable(candidate) { return candidate }
        }
        return nil
    }

    /// Where to look for `luca` and `bun`. A GUI app starts with a short
    /// PATH, so the login shell's PATH comes first, then this process's,
    /// then the places bun and Homebrew install to.
    static func searchPath(loginPath: String?, environmentPath: String?, home: String) -> [String] {
        let extra = ["\(home)/.bun/bin", "\(home)/.local/bin", "/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin"]
        var seen = Set<String>()
        var out: [String] = []
        for dir in (loginPath ?? "").split(separator: ":").map(String.init)
            + (environmentPath ?? "").split(separator: ":").map(String.init) + extra
        where !dir.isEmpty && !seen.contains(dir) {
            seen.insert(dir)
            out.append(dir)
        }
        return out
    }

    /// The marker the login shell prints the PATH between, so a chatty
    /// shell profile does not spoil the read.
    static let pathMarker = "__LUCA_DESKTOP_PATH__"

    static var loginShellScript: String { "printf '\(pathMarker)%s\(pathMarker)' \"$PATH\"" }

    static func loginPath(fromOutput output: String) -> String? {
        guard let start = output.range(of: pathMarker),
              let end = output.range(of: pathMarker, range: start.upperBound..<output.endIndex) else { return nil }
        let path = String(output[start.upperBound..<end.lowerBound])
        return path.isEmpty ? nil : path
    }
}

/// The host's first stdout line: `{"port":N,"token":"..."}`.
enum HostHandshake {
    struct Info: Equatable, Sendable {
        let port: Int
        let token: String
    }

    /// Nil for any line that is not the handshake (a project script may
    /// print before the host does).
    static func parse(_ line: String) -> Info? {
        let text = line.trimmingCharacters(in: .whitespacesAndNewlines)
        guard text.hasPrefix("{"), let data = text.data(using: .utf8),
              let object = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
              let token = object["token"] as? String, !token.isEmpty else { return nil }
        let port: Int?
        if let n = object["port"] as? NSNumber, CFGetTypeID(n) != CFBooleanGetTypeID() { port = n.intValue }
        else { port = nil }
        guard let port, (1...65535).contains(port) else { return nil }
        return Info(port: port, token: token)
    }

    /// Split a stdout buffer into whole lines and the rest still to come.
    static func lines(_ buffer: String) -> (lines: [String], rest: String) {
        var parts = buffer.components(separatedBy: "\n")
        let rest = parts.removeLast()
        return (parts.map { $0.hasSuffix("\r") ? String($0.dropLast()) : $0 }, rest)
    }
}
