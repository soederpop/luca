import Foundation
import WebKit

/// What a canvas page may reach: its host on loopback, other loopback
/// servers, Tailscale (`*.ts.net` and `100.64.0.0/10`), and unpkg. Nothing
/// else loads, whatever the page's code does.
///
/// The host's CSP header says the same; this content rule list is the layer
/// the page cannot touch. WebKit's `url-filter` has no `|`, so each host is
/// its own rule.
enum CanvasLockdown {
    static let identifier = "luca-canvas-v1"

    /// Host patterns, each after `^<scheme>://`.
    static let hostPatterns: [String] = [
        #"127\.0\.0\.1[:/]"#,
        #"localhost[:/]"#,
        #"\[::1\][:/]"#,
        #"[^/]*\.ts\.net[:/]"#,
        // 100.64.0.0/10, the Tailscale range, in parts.
        #"100\.6[4-9]\.[0-9]+\.[0-9]+[:/]"#,
        #"100\.[7-9][0-9]\.[0-9]+\.[0-9]+[:/]"#,
        #"100\.1[01][0-9]\.[0-9]+\.[0-9]+[:/]"#,
        #"100\.12[0-7]\.[0-9]+\.[0-9]+[:/]"#,
    ]

    /// Every allowed URL start, as a regular expression.
    static var allowedPatterns: [String] {
        var out: [String] = []
        for host in hostPatterns {
            out.append("^https?://" + host)
            out.append("^wss?://" + host)
        }
        out.append(#"^https://unpkg\.com/"#)
        out.append("^data:")
        out.append("^blob:")
        out.append("^about:")
        return out
    }

    /// The rule list: block everything, then let the allowed starts through.
    static var rulesJSON: String {
        var rules: [[String: Any]] = [["trigger": ["url-filter": ".*"], "action": ["type": "block"]]]
        for pattern in allowedPatterns {
            rules.append(["trigger": ["url-filter": pattern], "action": ["type": "ignore-previous-rules"]])
        }
        let data = (try? JSONSerialization.data(withJSONObject: rules, options: [.sortedKeys])) ?? Data("[]".utf8)
        return String(decoding: data, as: UTF8.self)
    }

    /// The same check in Swift, for frame navigations. Pure.
    static func allows(_ url: URL) -> Bool {
        let text = url.absoluteString
        return allowedPatterns.contains { text.range(of: $0, options: .regularExpression) != nil }
    }

    @MainActor private static var compiled: WKContentRuleList?
    @MainActor private static var compiling: Task<WKContentRuleList, Error>?

    /// The compiled rule list, made once per run.
    @MainActor
    static func ruleList() async throws -> WKContentRuleList {
        if let compiled { return compiled }
        if let compiling { return try await compiling.value }
        let json = rulesJSON
        let task = Task { @MainActor () throws -> WKContentRuleList in
            guard let store = WKContentRuleListStore.default() else { throw CanvasError.noRuleStore }
            return try await withCheckedThrowingContinuation { (done: CheckedContinuation<WKContentRuleList, Error>) in
                store.compileContentRuleList(forIdentifier: identifier, encodedContentRuleList: json) { list, error in
                    if let list { done.resume(returning: list) } else { done.resume(throwing: error ?? CanvasError.noRuleStore) }
                }
            }
        }
        compiling = task
        defer { compiling = nil }
        let list = try await task.value
        compiled = list
        return list
    }
}

enum CanvasError: LocalizedError {
    case noRuleStore
    var errorDescription: String? { "WebKit could not compile the canvas lockdown rules" }
}
