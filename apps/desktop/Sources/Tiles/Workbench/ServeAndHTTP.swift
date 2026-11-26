import SwiftUI
import Combine

/// What a color means in the endpoints and request tiles. Pure, so the
/// mapping is tested; `WorkbenchStyle.color(_:)` turns it into a kit token.
enum HTTPTone: String, Equatable {
    case info, good, warn, special, bad, faint

    /// One hue per method, so a list of routes reads at a glance.
    static func method(_ method: String) -> HTTPTone {
        switch method.uppercased() {
        case "GET": return .info
        case "POST": return .good
        case "PUT": return .warn
        case "PATCH": return .special
        case "DELETE": return .bad
        default: return .faint
        }
    }

    /// `2xx` good, `3xx` info, `4xx` warn, `5xx` bad.
    static func status(_ statusClass: String?) -> HTTPTone {
        switch statusClass {
        case "2xx": return .good
        case "3xx": return .info
        case "4xx": return .warn
        case "5xx": return .bad
        default: return .faint
        }
    }

    /// The serve child: running good, starting info, failed bad, stopped quiet.
    static func serve(_ status: String) -> HTTPTone {
        switch status {
        case "running": return .good
        case "starting": return .info
        case "failed": return .bad
        default: return .faint
        }
    }
}

/// The request tile's address id: `GET/users/:id` is `GET` and `/users/:id`.
enum RequestAddress {
    static func parse(_ id: String?) -> (method: String, path: String)? {
        guard let id, let slash = id.firstIndex(of: "/") else { return nil }
        let method = String(id[..<slash]).uppercased()
        guard !method.isEmpty else { return nil }
        return (method, String(id[slash...]))
    }

    static func id(method: String, path: String) -> String {
        method.uppercased() + (path.hasPrefix("/") ? path : "/" + path)
    }
}

extension WorkbenchStyle {
    static func color(_ tone: HTTPTone) -> Color {
        let p = Theme.palette
        switch tone {
        case .info: return p.info.color
        case .good: return p.good.color
        case .warn: return p.warn.color
        case .special: return p.syntax.type.color
        case .bad: return p.bad.color
        case .faint: return p.textFaint.color
        }
    }

    static func methodColor(_ method: String) -> Color { color(.method(method)) }
}

/// A method in its own color: `GET` on a soft pill of the same hue.
struct MethodPill: View {
    let method: String
    var size: CGFloat = KitTokens.TypeScale.xs

    var body: some View {
        let color = WorkbenchStyle.methodColor(method)
        Text(method.uppercased())
            .font(WorkbenchStyle.code(size, weight: .bold))
            .foregroundStyle(color)
            .frame(minWidth: size * 3.6)
            .padding(.horizontal, KitTokens.Space.s3)
            .padding(.vertical, 3)
            .background(RoundedRectangle(cornerRadius: KitTokens.Radius.md).fill(color.opacity(0.15)))
            .overlay(RoundedRectangle(cornerRadius: KitTokens.Radius.md).stroke(color.opacity(0.35)))
    }
}

/// A route path in the code font, its `:params` in the key color.
struct PathText: View {
    let path: String
    var size: CGFloat = KitTokens.TypeScale.sm
    var weight: Font.Weight = .semibold

    var body: some View {
        let parts = path.split(separator: "/", omittingEmptySubsequences: false).map(String.init)
        var text = Text("")
        for (index, part) in parts.enumerated() {
            if index > 0 { text = text + Text("/").foregroundColor(Theme.palette.textFaint.color) }
            text = text + Text(part).foregroundColor(part.hasPrefix(":") ? WorkbenchStyle.keyColor : Theme.palette.text.color)
        }
        return text.font(WorkbenchStyle.code(size, weight: weight))
    }
}

/// The project's `luca serve` child, as the endpoints and request tiles
/// see it: the host's state from `serve` frames, and its log from the run
/// frames of that run. The host owns the child; this only asks.
@MainActor
final class ServeMonitor: ObservableObject {
    @Published private(set) var serve = WorkbenchServe.unknown
    @Published private(set) var log = RunTranscript()
    @Published private(set) var asking = false
    private var watch: AnyCancellable?
    private var host: WorkbenchClient?

    var running: Bool { serve.status == "running" }
    var busy: Bool { asking || serve.status == "starting" }
    var tone: HTTPTone { .serve(serve.status) }

    func attach(_ client: WorkbenchClient?) {
        host = client
        watch = nil
        guard let client else {
            serve = .unknown
            if log.running { log.hostGone() }
            return
        }
        client.connect()
        watch = client.events.sink { [weak self] frame in self?.take(frame) }
        Task { [weak self] in
            if let state = try? await client.serve() { self?.update(state) }
        }
    }

    /// The host's state, from a load or a frame.
    func update(_ state: WorkbenchServe) {
        serve = state
        if let runId = state.runId, runId != log.runId { resync(runId) }
    }

    private func take(_ frame: WorkbenchEvent) {
        if frame.type == "serve", let state = frame.serve { return update(state) }
        guard let runId = frame.runId, runId == serve.runId else { return }
        if runId != log.runId { return resync(runId) }
        let whole = log.take(frame)
        if !whole || frame.type == "run-exit" { resync(runId) }
    }

    private func resync(_ runId: String) {
        guard let host else { return }
        Task { [weak self] in
            guard let run = try? await host.run(runId), let self, self.serve.runId == runId else { return }
            if self.log.runId == runId { self.log.replace(with: run) } else { self.log = RunTranscript(run) }
        }
    }

    func start() {
        guard let host else { return Shell.shared.flash("The workbench host is not running") }
        asking = true
        Task { [weak self] in
            do { self?.update(try await host.startServe()) } catch { Shell.shared.flash(ErrorText.message(error)) }
            self?.asking = false
        }
    }

    func stop() {
        guard let host else { return }
        asking = true
        Task { [weak self] in
            do { self?.update(try await host.stopServe()) } catch { Shell.shared.flash(ErrorText.message(error)) }
            self?.asking = false
        }
    }

    /// `s`: start when stopped or failed, stop when starting or running.
    func toggle() {
        if serve.status == "running" || serve.status == "starting" { stop() } else { start() }
    }
}

/// The server's state on one line: a dot and the host's text, in the state's color.
struct ServeBadge: View {
    let serve: WorkbenchServe

    var body: some View {
        let color = WorkbenchStyle.color(.serve(serve.status))
        HStack(spacing: KitTokens.Space.s3) {
            Circle().fill(color).frame(width: 9, height: 9)
                .overlay(Circle().stroke(color.opacity(0.35), lineWidth: 4))
            Text(serve.status == "failed" ? "failed" : serve.text)
                .font(WorkbenchStyle.ui(KitTokens.TypeScale.sm, weight: .semibold))
                .foregroundStyle(color)
        }
        .padding(.horizontal, KitTokens.Space.s5)
        .padding(.vertical, KitTokens.Space.s3)
        .background(Capsule().fill(color.opacity(0.12)))
    }
}

/// Start or stop, as the state allows, with the tile's key on it.
struct ServeButton: View {
    @ObservedObject var monitor: ServeMonitor
    let action: String
    let hints: HintRegistry

    var body: some View {
        let p = Theme.palette
        let on = monitor.serve.status == "running" || monitor.serve.status == "starting"
        let color = on ? p.bad.color : p.good.color
        Button { monitor.toggle() } label: {
            Label(on ? "Stop server" : "Start server", systemImage: on ? "stop.fill" : "play.fill")
                .font(WorkbenchStyle.ui(KitTokens.TypeScale.sm, weight: .semibold))
                .padding(.horizontal, KitTokens.Space.s6)
                .padding(.vertical, KitTokens.Space.s3)
                .background(Capsule().fill(color.opacity(0.16)))
                .overlay(Capsule().stroke(color.opacity(0.45)))
                .foregroundStyle(color)
        }
        .buttonStyle(.plain)
        .disabled(monitor.asking)
        .keyBadge(action)
        .hintTarget(action, in: hints) { monitor.toggle() }
    }
}

/// A run's output in a card: the command line on top, stdout in the body
/// color, stderr in warn, notes in bad. Shared by the command and endpoints tiles.
struct RunTranscriptCard: View {
    let transcript: RunTranscript
    let tint: Color
    /// Show only the last lines (a long-running server's log).
    var lastLines: Int?

    var body: some View {
        let p = Theme.palette
        WorkbenchCard(tint: tint) {
            VStack(alignment: .leading, spacing: KitTokens.Space.s3) {
                HStack(alignment: .firstTextBaseline, spacing: KitTokens.Space.s3) {
                    Text("$").foregroundStyle(p.textFaint.color)
                    Text(transcript.display).foregroundStyle(WorkbenchStyle.inputColor).textSelection(.enabled)
                }
                .font(WorkbenchStyle.code(KitTokens.TypeScale.sm, weight: .semibold))
                Rectangle().fill(p.border.color).frame(height: 1)
                ForEach(shown) { segment in
                    Text(segment.text.hasSuffix("\n") ? String(segment.text.dropLast()) : segment.text)
                        .font(WorkbenchStyle.code(KitTokens.TypeScale.sm))
                        .foregroundStyle(segment.stream == "stderr" ? p.warn.color : segment.stream == "note" ? p.bad.color : p.textBody.color)
                        .lineSpacing(3)
                        .textSelection(.enabled)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                if transcript.segments.isEmpty {
                    Text(transcript.running ? "No output yet" : "No output")
                        .font(WorkbenchStyle.ui(KitTokens.TypeScale.xs)).foregroundStyle(p.textFaint.color)
                }
            }
        }
    }

    /// The segments, cut to the last lines when asked.
    private var shown: [RunTranscript.Segment] {
        guard let lastLines else { return transcript.segments }
        var left = lastLines
        var out: [RunTranscript.Segment] = []
        for segment in transcript.segments.reversed() {
            guard left > 0 else { break }
            let lines = segment.text.split(separator: "\n", omittingEmptySubsequences: false)
            let count = segment.text.hasSuffix("\n") ? lines.count - 1 : lines.count
            if count <= left {
                out.append(segment)
                left -= count
            } else {
                var cut = segment
                cut.text = lines.suffix(left + (segment.text.hasSuffix("\n") ? 1 : 0)).joined(separator: "\n")
                out.append(cut)
                left = 0
            }
        }
        return out.reversed()
    }
}
