import SwiftUI
import Combine

/// `luca://<project>/command/<id>`: run one command. The form comes from the
/// host (`GET /command/<id>`, read from the command's `argsSchema` and
/// `positionals`), the host builds the command line and runs it as a child
/// `luca <id> …` in the project folder, and its output comes over the socket
/// (`run-output`, `run-exit`) into the transcript.
///
/// `r` runs, `Ctrl-c` stops, `i` goes to the first field, `Enter` in a field
/// runs. `:arg <name> <value>` sets a field from the command line. Address
/// options prefill the form: `luca://luca/command/describe?target=fs`;
/// `&run=1` runs it at once.
/// Closing the tile stops a run it started.
@MainActor
final class CommandContent: WorkbenchContent {
    static let kind = TileKind(id: "luca-command", label: "Command", glyph: "terminal") { uri, _ in
        CommandContent(uri: uri)
    }

    let commandId: String
    @Published private(set) var form: WorkbenchCommandForm?
    @Published private(set) var error: String?
    @Published var values: [String: WorkbenchFormValue] = [:]
    @Published private(set) var transcript = RunTranscript()
    @Published private(set) var starting = false
    @Published private(set) var focusTick = 0
    /// The form is on screen. An address that runs at once (`run=1`) starts
    /// with it away, so the output is what you see; `f` brings it back.
    @Published var showForm: Bool
    private var loadTask: Task<Void, Never>?
    private var frameWatch: AnyCancellable?
    /// Frames that came before the run's id did (the socket can beat the answer).
    private var early: [WorkbenchEvent] = []
    private var prefilled = false

    init(uri: TileURI) {
        commandId = uri.id ?? ""
        showForm = uri.option("run") != "1"
        super.init(kindId: Self.kind.id, uri: uri, title: "luca \(uri.id ?? "command")")
    }

    override func makeBody() -> AnyView { AnyView(CommandView(model: self)) }

    var running: Bool { starting || transcript.running }

    override func hostChanged(_ client: WorkbenchClient?) {
        loadTask?.cancel()
        frameWatch = nil
        guard let client else {
            if transcript.running { transcript.hostGone() }
            return
        }
        client.connect()
        frameWatch = client.events
            .filter { $0.runId != nil }
            .sink { [weak self] frame in self?.take(frame) }
        load(client)
    }

    override func perform(_ action: String) -> Bool {
        switch action {
        case "lucaCommand.run": run()
        case "lucaCommand.stop": stopRun()
        case "lucaCommand.edit":
            showForm = true
            focusTick += 1
        case "lucaCommand.form": showForm.toggle()
        case "lucaCommand.clear":
            if transcript.running { Shell.shared.flash("Still running. Ctrl-c stops it") } else { transcript = RunTranscript() }
        case "lucaCommand.restart": restartHost()
        case "lucaCommand.registry":
            Shell.shared.openOrFocus(TileURI.luca(project: projectId, tool: "registry", options: [.init(name: "stack", value: "commands")]))
        default: return false
        }
        return true
    }

    override func runCommand(_ verb: String, _ rest: String) -> Bool {
        switch verb {
        case "arg":
            let parts = rest.split(separator: " ", maxSplits: 1).map(String.init)
            guard let name = parts.first else { Shell.shared.flash("Usage: arg <name> <value>"); return true }
            guard let field = form?.fields.first(where: { $0.name == name || $0.flag == "--\(name)" }) else {
                Shell.shared.flash("\(title) has no field '\(name)'")
                return true
            }
            set(field, text: parts.count > 1 ? parts[1] : "")
        case "run": run()
        case "stop": stopRun()
        default: return false
        }
        return true
    }

    func set(_ field: WorkbenchCommandField, text: String) {
        if field.type == "boolean" {
            values[field.name] = .flag(["true", "on", "yes", "1", ""].contains(text.lowercased()))
        } else if text.isEmpty {
            values[field.name] = nil
        } else {
            values[field.name] = .text(text)
        }
    }

    func text(_ field: WorkbenchCommandField) -> String {
        if case .text(let s) = values[field.name] { return s }
        return ""
    }

    func flag(_ field: WorkbenchCommandField) -> Bool {
        if case .flag(let b) = values[field.name] { return b }
        return field.default == "true"
    }

    private func load(_ client: WorkbenchClient) {
        stateLabel = form == nil ? "loading" : stateLabel
        loadTask = Task { [weak self] in
            guard let self else { return }
            do {
                let form = try await client.command(self.commandId)
                guard !Task.isCancelled else { return }
                self.form = form
                self.error = nil
                self.title = form.title
                if !self.prefilled {
                    self.prefilled = true
                    for option in self.uri.options {
                        if let field = form.fields.first(where: { $0.name == option.name }) { self.set(field, text: option.value) }
                    }
                    // `?run=1`: run at once with what the address filled in.
                    if self.uri.option("run") == "1" { self.run() }
                }
                if !self.transcript.running { self.stateLabel = self.transcript.statusText }
            } catch {
                guard !Task.isCancelled else { return }
                self.error = ErrorText.message(error)
                self.stateLabel = "error"
            }
        }
    }

    func run() {
        guard let host else { return Shell.shared.flash("The workbench host is not running") }
        guard form != nil else { return Shell.shared.flash("Still loading") }
        guard !running else { return Shell.shared.flash("Already running. Ctrl-c stops it") }
        starting = true
        early = []
        stateLabel = "starting"
        let values = values
        Task { [weak self] in
            do {
                let run = try await host.run(command: self?.commandId ?? "", values: values)
                guard let self else { return }
                self.starting = false
                self.transcript = RunTranscript(run)
                let early = self.early
                self.early = []
                for frame in early where frame.runId == run.runId { self.apply(frame) }
                self.stateLabel = self.transcript.statusText
            } catch {
                guard let self else { return }
                self.starting = false
                self.early = []
                self.stateLabel = "error"
                Shell.shared.flash(ErrorText.message(error))
            }
        }
    }

    func stopRun() {
        guard let host, let runId = transcript.runId, transcript.running else { return Shell.shared.flash("Nothing running") }
        Task {
            do { try await host.stop(run: runId) } catch { Shell.shared.flash(ErrorText.message(error)) }
        }
    }

    private func take(_ frame: WorkbenchEvent) {
        if frame.runId == transcript.runId { return apply(frame) }
        if starting, early.count < 1000 { early.append(frame) }
    }

    private func apply(_ frame: WorkbenchEvent) {
        let whole = transcript.take(frame)
        stateLabel = transcript.statusText
        // A missed frame, or the end: read the run as the host keeps it.
        if !whole || frame.type == "run-exit" { resync() }
        if frame.type == "run-exit", frame.code == 0, frame.stopped != true { afterSuccess() }
    }

    /// `?then=`: what a run that exits 0 leads to, once. `open-project` opens
    /// the folder the `output` field names as a project (bootstrap);
    /// `scaffold` opens the file the output says it wrote and restarts the
    /// host, so the registry lists the new helper. The option goes once used,
    /// as does `run`, so a restored tile only shows the form.
    private func afterSuccess() {
        guard let then = uri.option("then") else { return }
        uri = uri.with(option: "then", nil).with(option: "run", nil)
        Shell.shared.scheduleSave()
        switch then {
        case "open-project":
            guard let field = form?.fields.first(where: { $0.name == "output" }) else { return }
            let path = text(field)
            guard !path.isEmpty else { return }
            Shell.shared.openProject(path: path)
        case "scaffold":
            let output = transcript.segments.map(\.text).joined()
            if let path = Self.scaffoldedPath(in: output) {
                Shell.shared.open(FileContent.address(project: projectId, path: path), near: tileId)
            }
            restartHost()
        default:
            Shell.shared.flash("Unknown then=\(then)")
        }
    }

    /// The file `luca scaffold` says it wrote, from its output: `✓ Wrote
    /// feature scaffold to features/x.ts`, or for an assistant `Scaffolded
    /// assistant "x" in assistants/x/` (its CORE.md). Pure, so it is tested.
    nonisolated static func scaffoldedPath(in output: String) -> String? {
        if let m = output.firstMatch(of: #/Wrote \w+ scaffold to (\S+)/#) { return String(m.1) }
        if let m = output.firstMatch(of: #/Scaffolded assistant "[^"]*" in (\S+?)/?\s/#) { return String(m.1) + "/CORE.md" }
        return nil
    }

    private func resync() {
        guard let host, let runId = transcript.runId else { return }
        Task { [weak self] in
            guard let run = try? await host.run(runId), let self, self.transcript.runId == runId else { return }
            self.transcript.replace(with: run)
            self.stateLabel = self.transcript.statusText
        }
    }

    override func stop() {
        if transcript.running, let host, let runId = transcript.runId {
            Task { try? await host.stop(run: runId) }
        }
        loadTask?.cancel()
        frameWatch = nil
        super.stop()
    }
}

/// A run's output as the tile shows it: chunks in `seq` order, merged into
/// segments of one stream. Pure, so it is tested.
struct RunTranscript: Equatable {
    struct Segment: Equatable, Identifiable {
        let id: Int
        let stream: String
        var text: String
    }

    private(set) var runId: String?
    private(set) var display = ""
    private(set) var segments: [Segment] = []
    private(set) var nextSeq = 0
    private(set) var running = false
    /// The host's line: `running`, `exit 0 · 1.2 s`, `stopped · 3 s`.
    private(set) var statusText: String?
    private(set) var code: Int?
    private(set) var stopped = false
    /// Chunks the host let go to stay in budget.
    private(set) var dropped = 0

    init() {}

    init(_ run: WorkbenchRun) { replace(with: run) }

    mutating func replace(with run: WorkbenchRun) {
        runId = run.runId
        display = run.display
        segments = []
        nextSeq = run.dropped
        dropped = run.dropped
        for chunk in run.chunks where chunk.seq >= nextSeq {
            append(stream: chunk.stream, text: chunk.text)
            nextSeq = chunk.seq + 1
        }
        running = run.status == "running"
        statusText = run.statusText
        code = run.code
        stopped = run.stopped
    }

    /// Apply a socket frame of this run. False when a chunk was missed: read the run again.
    mutating func take(_ frame: WorkbenchEvent) -> Bool {
        guard frame.runId == runId else { return true }
        switch frame.type {
        case "run-output":
            guard let seq = frame.seq else { return true }
            if seq < nextSeq { return true }
            if seq > nextSeq { return false }
            append(stream: frame.stream ?? "stdout", text: frame.text ?? "")
            nextSeq = seq + 1
        case "run-exit":
            running = false
            code = frame.code
            stopped = frame.stopped ?? false
            statusText = frame.text
        default:
            break
        }
        return true
    }

    /// The host went away with the run in it.
    mutating func hostGone() {
        running = false
        statusText = "host stopped"
    }

    private mutating func append(stream: String, text: String) {
        if let last = segments.last, last.stream == stream {
            segments[segments.count - 1].text += text
        } else {
            segments.append(Segment(id: segments.count, stream: stream, text: text))
        }
    }
}

struct CommandView: View {
    @ObservedObject var model: CommandContent
    @FocusState private var focused: String?

    private var p: KitPalette { Theme.palette }

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                VStack(alignment: .leading, spacing: KitTokens.Space.s7) {
                    WorkbenchHostLine(status: model.hostStatus)
                    if let error = model.error {
                        Text(error).font(WorkbenchStyle.ui(KitTokens.TypeScale.sm)).foregroundStyle(p.bad.color).lineLimit(3)
                    }
                    header
                    if let form = model.form {
                        if model.showForm { formSection(form) }
                        runBar
                        output
                    } else if model.hostStatus == .running, model.error == nil {
                        ProgressView().controlSize(.small)
                    }
                    Color.clear.frame(height: 1).id("end")
                }
                .padding(.horizontal, WorkbenchStyle.Gap.page)
                .padding(.vertical, WorkbenchStyle.Gap.page - KitTokens.Space.s2)
                .frame(maxWidth: WorkbenchStyle.Size.readable + 200, alignment: .leading)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .onChange(of: model.transcript.nextSeq) { _, _ in
                if model.transcript.running { proxy.scrollTo("end", anchor: .bottom) }
            }
        }
        .background(p.surface.color)
        .onChange(of: model.focusTick) { _, _ in
            focused = model.form?.fields.first(where: { $0.type != "boolean" && $0.options == nil })?.name
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: KitTokens.Space.s3) {
            HStack(alignment: .firstTextBaseline, spacing: KitTokens.Space.s4) {
                Text(model.form?.title ?? "luca \(model.commandId)")
                    .font(WorkbenchStyle.code(KitTokens.TypeScale.xl, weight: .semibold))
                    .foregroundStyle(p.text.color)
                if let origin = model.form?.origin {
                    WorkbenchTag(text: origin.tag, color: WorkbenchStyle.originColor(origin.kind))
                } else if model.form?.badge == "project" {
                    WorkbenchTag(text: "project", color: p.accent.color)
                } else if model.form != nil {
                    WorkbenchTag(text: "built in", color: p.textMuted.color)
                }
                Spacer(minLength: 0)
            }
            if let form = model.form {
                if !form.summary.isEmpty {
                    Text(form.summary).font(WorkbenchStyle.ui(KitTokens.TypeScale.md)).foregroundStyle(p.textBody.color)
                }
                Text(form.usage).font(WorkbenchStyle.code(KitTokens.TypeScale.xs)).foregroundStyle(p.textFaint.color).textSelection(.enabled)
            }
        }
    }

    private func formSection(_ form: WorkbenchCommandForm) -> some View {
        let positional = form.fields.filter(\.positional)
        let flags = form.fields.filter { !$0.positional }
        return VStack(alignment: .leading, spacing: KitTokens.Space.s6) {
            if !positional.isEmpty { fieldsCard("Arguments", positional) }
            if !flags.isEmpty { fieldsCard("Flags", flags) }
        }
    }

    private func fieldsCard(_ title: String, _ fields: [WorkbenchCommandField]) -> some View {
        VStack(alignment: .leading, spacing: KitTokens.Space.s3) {
            WorkbenchSectionTitle(title: title, note: "\(fields.filter(\.required).count) required")
            WorkbenchCard {
                Grid(alignment: .leadingFirstTextBaseline, horizontalSpacing: KitTokens.Space.s6, verticalSpacing: KitTokens.Space.s6) {
                    ForEach(fields) { field in
                        GridRow {
                            VStack(alignment: .trailing, spacing: KitTokens.Space.s1) {
                                Text(field.extra == true ? "more" : field.positional ? field.name : field.flag)
                                    .font(WorkbenchStyle.code(KitTokens.TypeScale.sm, weight: field.required ? .semibold : .regular))
                                    .foregroundStyle(field.required ? p.text.color : p.textMuted.color)
                                Text(field.required ? "required" : field.type == "unknown" ? "optional" : field.type)
                                    .font(WorkbenchStyle.ui(KitTokens.TypeScale.xs, weight: field.required ? .semibold : .regular))
                                    .foregroundStyle(field.required ? p.warn.color : p.textFaint.color)
                            }
                            .gridColumnAlignment(.trailing)
                            VStack(alignment: .leading, spacing: KitTokens.Space.s2) {
                                control(field)
                                if !field.description.isEmpty {
                                    Text(field.description).font(WorkbenchStyle.ui(KitTokens.TypeScale.xs)).foregroundStyle(p.textMuted.color)
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    @ViewBuilder private func control(_ field: WorkbenchCommandField) -> some View {
        if field.type == "boolean" {
            Toggle("", isOn: Binding(get: { model.flag(field) }, set: { model.values[field.name] = .flag($0) }))
                .labelsHidden()
                .toggleStyle(.switch)
                .controlSize(.small)
                .tint(p.accent.color)
        } else if let options = field.options {
            let current = model.text(field)
            // A Menu with a drawn label: a system Picker ignores the font.
            Menu {
                Button("—") { model.values[field.name] = nil }
                ForEach(options, id: \.self) { option in
                    Button(option) { model.values[field.name] = .text(option) }
                }
            } label: {
                HStack(spacing: KitTokens.Space.s3) {
                    Text(current.isEmpty ? (field.default ?? "—") : current)
                        .foregroundStyle(current.isEmpty ? p.textFaint.color : WorkbenchStyle.valueColor("string"))
                    Image(systemName: "chevron.up.chevron.down").font(.system(size: 12)).foregroundStyle(p.textMuted.color)
                }
                .font(WorkbenchStyle.code(KitTokens.TypeScale.sm))
                .padding(.horizontal, KitTokens.Space.s4)
                .padding(.vertical, KitTokens.Space.s3)
                .background(RoundedRectangle(cornerRadius: KitTokens.Radius.md).fill(p.inset.color))
            }
            .menuStyle(.button)
            .buttonStyle(.plain)
            .fixedSize()
        } else {
            TextField(field.default ?? (field.extra == true ? "--flag value" : field.type), text: Binding(
                get: { model.text(field) },
                set: { model.set(field, text: $0) }))
                .textFieldStyle(.plain)
                .font(WorkbenchStyle.code(KitTokens.TypeScale.sm))
                .foregroundStyle(WorkbenchStyle.valueColor(field.type == "number" ? "number" : "string"))
                .focused($focused, equals: field.name)
                .onSubmit { model.run() }
                .padding(.horizontal, KitTokens.Space.s4)
                .padding(.vertical, KitTokens.Space.s3)
                .background(RoundedRectangle(cornerRadius: KitTokens.Radius.md).fill(p.inset.color))
                .overlay(RoundedRectangle(cornerRadius: KitTokens.Radius.md)
                    .stroke(focused == field.name ? p.accent.color.opacity(0.7) : (field.required && model.text(field).isEmpty ? p.warn.color.opacity(0.5) : p.border.color)))
                .frame(maxWidth: 460, alignment: .leading)
        }
    }

    private var runBar: some View {
        HStack(spacing: KitTokens.Space.s5) {
            Button { model.run() } label: {
                Label("Run", systemImage: "play.fill")
                    .font(WorkbenchStyle.ui(KitTokens.TypeScale.sm, weight: .semibold))
                    .padding(.horizontal, KitTokens.Space.s6)
                    .padding(.vertical, KitTokens.Space.s3)
                    .background(Capsule().fill(model.running ? p.inset.color : p.accent.color))
                    .foregroundStyle(model.running ? p.textFaint.color : p.accentOn.color)
            }
            .buttonStyle(.plain)
            .disabled(model.running)
            .keyBadge("lucaCommand.run")
            .hintTarget("lucaCommand.run", in: model.hints) { model.run() }
            if model.transcript.running {
                Button { model.stopRun() } label: {
                    Label("Stop", systemImage: "stop.fill")
                        .font(WorkbenchStyle.ui(KitTokens.TypeScale.sm, weight: .semibold))
                        .padding(.horizontal, KitTokens.Space.s6)
                        .padding(.vertical, KitTokens.Space.s3)
                        .background(Capsule().fill(p.bad.color.opacity(0.15)))
                        .foregroundStyle(p.bad.color)
                }
                .buttonStyle(.plain)
                .keyBadge("lucaCommand.stop")
                .hintTarget("lucaCommand.stop", in: model.hints) { model.stopRun() }
            }
            if model.starting || model.transcript.running { ProgressView().controlSize(.small) }
            Spacer(minLength: 0)
            if let status = model.transcript.statusText {
                WorkbenchTag(text: status, color: statusColor)
            }
        }
    }

    private var statusColor: Color {
        let t = model.transcript
        if t.running { return p.info.color }
        if t.stopped { return p.warn.color }
        return t.code == 0 ? p.good.color : p.bad.color
    }

    @ViewBuilder private var output: some View {
        let t = model.transcript
        if t.runId != nil {
            VStack(alignment: .leading, spacing: KitTokens.Space.s3) {
                WorkbenchSectionTitle(title: "Output", note: t.dropped > 0 ? "\(t.dropped) earlier chunks dropped" : nil)
                RunTranscriptCard(transcript: t, tint: statusColor)
            }
        }
    }
}
