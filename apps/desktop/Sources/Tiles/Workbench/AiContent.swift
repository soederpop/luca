import SwiftUI
import Combine

/// `luca://<project>/ai`: the project's AI environment. Which model
/// providers its assistants can use and which is the default, the API keys
/// they need, the local models, the coding agents on this machine (Claude
/// Code, Codex, Hermes), and the model servers a scan finds on this Mac and
/// the tailnet. The host reads all of it from Luca (`GET /ai`).
///
/// `s` scans for servers, `a` adds a found one as a provider, `k` sets an
/// API key (into this project's `.env`), `c` checks the agents again, `x`
/// opens `luca setup` for a local model that is missing.
@MainActor
final class AiContent: WorkbenchContent {
    static let kind = TileKind(id: "luca-ai", label: "AI", glyph: "sparkles") { uri, _ in
        AiContent(uri: uri)
    }

    @Published private(set) var view: WorkbenchAi?
    @Published private(set) var error: String?
    @Published private(set) var scanning = false
    @Published private(set) var checking = false
    private var task: Task<Void, Never>?

    init(uri: TileURI) {
        super.init(kindId: Self.kind.id, uri: uri, title: "\(ProjectHub.shared.displayName(uri.authority)) AI")
    }

    override func makeBody() -> AnyView { AnyView(AiView(model: self)) }

    override func hostChanged(_ client: WorkbenchClient?) {
        if client != nil { reload() } else { task?.cancel(); view = nil }
    }

    override func perform(_ action: String) -> Bool {
        switch action {
        case "lucaAi.scan": scan()
        case "lucaAi.add": pickServer()
        case "lucaAi.key": pickKey()
        case "lucaAi.agents": checkAgents()
        case "lucaAi.setup": pickSetup()
        case "lucaAi.setupAll": _ = Shell.shared.open(TerminalContent.setupAddress(project: projectId), near: tileId)
        case "lucaAi.reload": reload()
        case "lucaAi.restart": restartHost()
        default: return false
        }
        return true
    }

    /// The tile's one line: the default provider, or that there is none.
    nonisolated static func label(_ view: WorkbenchAi) -> String {
        let agents = view.agents.filter(\.available).count
        return "\(view.defaultProvider ?? "no provider") · \(agents) of \(view.agents.count) agents"
    }

    private func take(_ view: WorkbenchAi) {
        self.view = view
        error = nil
        stateLabel = Self.label(view)
    }

    private func ask(_ work: @escaping (WorkbenchClient) async throws -> WorkbenchAi, done: (() -> Void)? = nil) {
        guard let host else { return Shell.shared.flash("The workbench host is not running") }
        task = Task { [weak self] in
            defer { done?() }
            do {
                let view = try await work(host)
                guard let self, !Task.isCancelled else { return }
                self.take(view)
            } catch {
                guard let self, !Task.isCancelled else { return }
                self.error = ErrorText.message(error)
                self.stateLabel = "error"
            }
        }
    }

    func reload() {
        if view == nil { stateLabel = "loading" }
        ask { try await $0.ai() }
    }

    /// Look for model servers on this Mac and the tailnet. A few seconds.
    func scan() {
        guard !scanning else { return }
        scanning = true
        stateLabel = "scanning"
        ask({ try await $0.aiDiscover() }) { [weak self] in self?.scanning = false }
    }

    func checkAgents() {
        guard !checking else { return }
        checking = true
        ask({ try await $0.aiCheckAgents() }) { [weak self] in self?.checking = false }
    }

    // MARK: Add a found server

    func pickServer() {
        guard let servers = view?.servers, !servers.isEmpty else { return Shell.shared.flash("No servers found yet. Press s to scan") }
        if servers.count == 1 { return pickModel(servers[0]) }
        PaletteController.shared.choose("add which server", servers.map { server in
            PaletteChoice(title: server.title, detail: "\(server.baseURL) · \(server.models.count) models") { [weak self] in self?.pickModel(server) }
        })
    }

    func pickModel(_ server: WorkbenchAi.Server) {
        guard !server.models.isEmpty else { return pickFile(server, model: nil) }
        if server.models.count == 1 { return pickFile(server, model: server.models[0]) }
        PaletteController.shared.choose("default model for \(server.title)", server.models.map { model in
            PaletteChoice(title: model, detail: "") { [weak self] in self?.pickFile(server, model: model) }
        })
    }

    private func pickFile(_ server: WorkbenchAi.Server, model: String?) {
        let files = view?.configFiles ?? []
        PaletteController.shared.choose("write the provider to", files.map { file in
            PaletteChoice(title: file.kind == "machine" ? "This Mac: every Luca project" : "This project only", detail: file.display) { [weak self] in
                self?.add(server, model: model, target: file.kind)
            }
        })
    }

    private func add(_ server: WorkbenchAi.Server, model: String?, target: String) {
        guard let host else { return }
        Task { [weak self] in
            do {
                let answer = try await host.aiAddServer(baseURL: server.baseURL, target: target, model: model)
                self?.take(answer.view)
                Shell.shared.flash("Added provider \(answer.added.joined(separator: ", ")) to \(answer.file)")
            } catch {
                Shell.shared.flash(ErrorText.message(error))
            }
        }
    }

    // MARK: Keys

    func pickKey() {
        guard let keys = view?.keys, !keys.isEmpty else { return }
        if keys.count == 1 { return askKey(keys[0]) }
        PaletteController.shared.choose("set which key", keys.map { key in
            PaletteChoice(title: key.env, detail: key.set ? "set in \(key.where ?? "the environment"): replace it" : "not set") { [weak self] in self?.askKey(key) }
        })
    }

    /// The key is typed into a hidden field and goes to the host once. It is not kept here.
    func askKey(_ key: WorkbenchAi.Key) {
        PaletteController.shared.ask("\(key.env) · saved to this project's .env", secret: true) { [weak self] value in
            guard let self, let host = self.host else { return }
            Task { [weak self] in
                do {
                    let answer = try await host.aiSetKey(env: key.env, value: value)
                    self?.take(answer.view)
                    Shell.shared.flash("\(key.env) saved to \(answer.file)")
                } catch {
                    Shell.shared.flash(ErrorText.message(error))
                }
            }
        }
    }

    // MARK: Setup

    /// `luca setup --chat-model` as the command tile's address, flags set, not yet run.
    nonisolated static func setupAddress(project: String, fix: String) -> TileURI {
        let flags = fix.split(separator: " ").filter { $0.hasPrefix("--") }.map { String($0.dropFirst(2)) }
        return TileURI.luca(project: project, tool: "command", id: "setup", options: flags.map { .init(name: $0, value: "true") })
    }

    func pickSetup() {
        let missing = (view?.local ?? []).filter { $0.fix != nil }
        guard !missing.isEmpty else { return Shell.shared.flash("Nothing to set up: the local models are in place") }
        PaletteController.shared.choose("set up", missing.map { check in
            PaletteChoice(title: check.label, detail: "\(check.fix ?? "") · opens the command, r runs it") { [weak self] in self?.openSetup(check) }
        })
    }

    func openSetup(_ check: WorkbenchAi.Check) {
        guard let fix = check.fix else { return }
        _ = Shell.shared.open(Self.setupAddress(project: projectId, fix: fix), near: tileId)
    }

    override func stop() {
        task?.cancel()
        super.stop()
    }
}

struct AiView: View {
    @ObservedObject var model: AiContent

    private var p: KitPalette { Theme.palette }
    private var tint: Color { WorkbenchStyle.thingColor("assistants") }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: WorkbenchStyle.Gap.section) {
                WorkbenchHostLine(status: model.hostStatus)
                if let error = model.error {
                    WorkbenchCard(tint: p.bad.color) {
                        Text(error).font(WorkbenchStyle.body).foregroundStyle(p.bad.color).textSelection(.enabled)
                    }
                }
                if let view = model.view {
                    header(view)
                    if let warning = view.envWarning {
                        WorkbenchCard(tint: p.warn.color) {
                            Label(warning, systemImage: "exclamationmark.triangle.fill")
                                .font(WorkbenchStyle.body).foregroundStyle(p.warn.color)
                        }
                    }
                    agents(view)
                    keys(view)
                    providers(view)
                    servers(view)
                    local(view)
                    files(view)
                } else if model.hostStatus == .running, model.error == nil {
                    ProgressView().controlSize(.small)
                }
            }
            .padding(.horizontal, WorkbenchStyle.Gap.page)
            .padding(.vertical, WorkbenchStyle.Gap.page - KitTokens.Space.s2)
            .frame(maxWidth: WorkbenchStyle.Size.readable + 100, alignment: .leading)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(p.surface.color)
    }

    private func header(_ view: WorkbenchAi) -> some View {
        HStack(alignment: .center, spacing: KitTokens.Space.s5) {
            ThingGlyph(symbol: "sparkles", color: tint, size: 44)
            VStack(alignment: .leading, spacing: KitTokens.Space.s2) {
                Text("AI").font(WorkbenchStyle.title).foregroundStyle(p.text.color)
                HStack(spacing: KitTokens.Space.s4) {
                    Text("Default provider").font(WorkbenchStyle.body).foregroundStyle(p.textMuted.color)
                    WorkbenchTag(text: view.defaultProvider ?? "none", color: view.defaultProvider == nil ? p.warn.color : p.good.color)
                }
                Text(view.defaultText)
                    .font(WorkbenchStyle.meta)
                    .foregroundStyle(p.textFaint.color)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
            action("Run luca setup", "wrench.and.screwdriver", view.defaultProvider == nil ? p.warn.color : p.syntax.number.color, key: "lucaAi.setupAll") {
                _ = Shell.shared.open(TerminalContent.setupAddress(project: model.projectId), near: model.tileId)
            }
        }
    }

    /// A row of equal cards that wraps.
    private func grid<Data: RandomAccessCollection, Card: View>(_ items: Data, min: CGFloat = 280, @ViewBuilder card: @escaping (Data.Element) -> Card) -> some View where Data.Element: Identifiable {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: min), spacing: WorkbenchStyle.Gap.row, alignment: .top)], alignment: .leading, spacing: WorkbenchStyle.Gap.row) {
            ForEach(items) { card($0) }
        }
    }

    private func dot(_ color: Color) -> some View {
        Circle().fill(color).frame(width: 10, height: 10).overlay(Circle().stroke(color.opacity(0.3), lineWidth: 4))
    }

    private func action(_ title: String, _ symbol: String, _ color: Color, key: String, busy: Bool = false, _ run: @escaping () -> Void) -> some View {
        Button(action: run) {
            HStack(spacing: KitTokens.Space.s3) {
                if busy { ProgressView().controlSize(.small) } else { Image(systemName: symbol) }
                Text(title)
            }
            .font(WorkbenchStyle.ui(KitTokens.TypeScale.xs, weight: .semibold))
            .foregroundStyle(color)
            .padding(.horizontal, KitTokens.Space.s5)
            .padding(.vertical, KitTokens.Space.s3)
            .background(Capsule().fill(color.opacity(0.14)))
            .overlay(Capsule().stroke(color.opacity(0.5)))
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .disabled(busy)
        .keyBadge(key)
    }

    private func sectionHead(_ title: String, count: Int?, color: Color, note: String? = nil, @ViewBuilder trailing: () -> some View) -> some View {
        HStack(alignment: .center, spacing: KitTokens.Space.s4) {
            WorkbenchSectionTitle(title: title, note: note, count: count, color: color)
            trailing()
        }
    }

    // MARK: Agents

    private func agents(_ view: WorkbenchAi) -> some View {
        VStack(alignment: .leading, spacing: WorkbenchStyle.Gap.row) {
            sectionHead("Coding agents", count: nil, color: p.syntax.keyword.color, note: "what luca prompt can hand a file to") {
                action("Check again", "arrow.clockwise", p.textMuted.color, key: "lucaAi.agents", busy: model.checking) { model.checkAgents() }
            }
            grid(view.agents) { agent in
                WorkbenchCard(tint: agent.available ? p.good.color : p.textFaint.color, padding: KitTokens.Space.s5) {
                    VStack(alignment: .leading, spacing: KitTokens.Space.s3) {
                        HStack(spacing: KitTokens.Space.s4) {
                            dot(agent.available ? p.good.color : p.textFaint.color)
                            Text(agent.label).font(WorkbenchStyle.heading).foregroundStyle(p.text.color)
                            Spacer(minLength: 0)
                            WorkbenchTag(text: agent.available ? "available" : "not found", color: agent.available ? p.good.color : p.textFaint.color)
                        }
                        if !agent.version.isEmpty {
                            Text(agent.version).font(WorkbenchStyle.code(KitTokens.TypeScale.xs)).foregroundStyle(p.textMuted.color).lineLimit(1)
                        }
                        Text(agent.detail).font(WorkbenchStyle.meta).foregroundStyle(p.textFaint.color).lineLimit(2)
                    }
                }
            }
        }
    }

    // MARK: Keys

    private func keys(_ view: WorkbenchAi) -> some View {
        VStack(alignment: .leading, spacing: WorkbenchStyle.Gap.row) {
            sectionHead("API keys", count: nil, color: p.warn.color, note: "saved to this project's .env") {
                action("Set a key", "key.fill", p.warn.color, key: "lucaAi.key") { model.pickKey() }
            }
            grid(view.keys) { key in
                Button { model.askKey(key) } label: {
                    WorkbenchCard(tint: key.set ? p.good.color : p.warn.color, padding: KitTokens.Space.s5) {
                        VStack(alignment: .leading, spacing: KitTokens.Space.s3) {
                            HStack(spacing: KitTokens.Space.s4) {
                                dot(key.set ? p.good.color : p.warn.color)
                                Text(key.label).font(WorkbenchStyle.heading).foregroundStyle(p.text.color)
                                Spacer(minLength: 0)
                                WorkbenchTag(text: key.set ? "set" : "not set", color: key.set ? p.good.color : p.warn.color)
                            }
                            Text(key.env).font(WorkbenchStyle.code(KitTokens.TypeScale.xs)).foregroundStyle(WorkbenchStyle.keyColor)
                            Text(key.set ? "from \(key.where ?? "the environment")" : "needed by \(key.providers.prefix(3).joined(separator: ", "))")
                                .font(WorkbenchStyle.meta).foregroundStyle(p.textFaint.color).lineLimit(1)
                        }
                    }
                }
                .buttonStyle(.plain)
            }
        }
    }

    // MARK: Providers

    private func statusColor(_ status: String) -> Color {
        switch status {
        case "ready": return p.good.color
        case "needs key": return p.warn.color
        case "login": return p.info.color
        default: return p.textFaint.color
        }
    }

    private func providers(_ view: WorkbenchAi) -> some View {
        WorkbenchSection(title: "Model providers", note: "what an assistant's provider: can name", count: view.providers.count, color: tint) {
            WorkbenchCard(padding: KitTokens.Space.s4) {
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(Array(view.providers.enumerated()), id: \.element.id) { index, provider in
                        if index > 0 { Rectangle().fill(p.border.color.opacity(0.6)).frame(height: 1) }
                        HStack(alignment: .firstTextBaseline, spacing: KitTokens.Space.s5) {
                            dot(statusColor(provider.status)).alignmentGuide(.firstTextBaseline) { $0[.bottom] - 3 }
                            VStack(alignment: .leading, spacing: KitTokens.Space.s1) {
                                HStack(spacing: KitTokens.Space.s4) {
                                    Text(provider.id).font(WorkbenchStyle.code(KitTokens.TypeScale.sm, weight: .semibold)).foregroundStyle(p.text.color)
                                        .lineLimit(1).fixedSize()
                                    if provider.isDefault { WorkbenchTag(text: "default", color: p.good.color) }
                                    if provider.source != "built in" {
                                        WorkbenchTag(text: provider.source == "machine" ? "this Mac" : "this project", color: WorkbenchStyle.originColor(provider.source == "machine" ? "home" : "own"))
                                    }
                                }
                                Text(provider.baseURL.isEmpty ? provider.label : provider.baseURL)
                                    .font(WorkbenchStyle.code(KitTokens.TypeScale.xs)).foregroundStyle(p.textFaint.color).lineLimit(1).truncationMode(.middle)
                            }
                            .frame(minWidth: 330, alignment: .leading)
                            Text(provider.model)
                                .font(WorkbenchStyle.code(KitTokens.TypeScale.xs)).foregroundStyle(p.syntax.string.color).lineLimit(1)
                            Spacer(minLength: KitTokens.Space.s4)
                            Text(provider.statusText)
                                .font(WorkbenchStyle.meta).foregroundStyle(statusColor(provider.status)).lineLimit(1)
                        }
                        .padding(.vertical, KitTokens.Space.s4)
                        .padding(.horizontal, KitTokens.Space.s3)
                    }
                }
            }
        }
    }

    // MARK: Servers

    private func servers(_ view: WorkbenchAi) -> some View {
        VStack(alignment: .leading, spacing: WorkbenchStyle.Gap.row) {
            sectionHead("Model servers found", count: view.scannedAt == nil ? nil : view.servers.count, color: p.info.color, note: "this Mac and your tailnet") {
                action(model.scanning ? "Scanning" : (view.scannedAt == nil ? "Scan" : "Scan again"), "dot.radiowaves.left.and.right", p.info.color, key: "lucaAi.scan", busy: model.scanning) { model.scan() }
                if !view.servers.isEmpty {
                    action("Add as a provider", "plus", p.good.color, key: "lucaAi.add") { model.pickServer() }
                }
            }
            if view.scannedAt == nil {
                Text("Press s to look for LM Studio, Ollama, llama.cpp and other OpenAI-compatible servers.")
                    .font(WorkbenchStyle.body).foregroundStyle(p.textFaint.color)
            } else if view.servers.isEmpty {
                Text("The scan found no model server.").font(WorkbenchStyle.body).foregroundStyle(p.textFaint.color)
            }
            ForEach(view.servers) { server in
                WorkbenchCard(tint: p.info.color) {
                    VStack(alignment: .leading, spacing: KitTokens.Space.s4) {
                        HStack(spacing: KitTokens.Space.s4) {
                            Text(server.title).font(WorkbenchStyle.heading).foregroundStyle(p.text.color)
                            if let id = server.profileId { WorkbenchTag(text: "provider \(id)", color: p.good.color) }
                            Spacer(minLength: 0)
                            Text("\(server.latencyMs) ms").font(WorkbenchStyle.meta).foregroundStyle(p.textFaint.color)
                            Button { model.pickModel(server) } label: {
                                Label("Add", systemImage: "plus").font(WorkbenchStyle.caption()).foregroundStyle(p.good.color)
                                    .padding(.horizontal, KitTokens.Space.s4).padding(.vertical, KitTokens.Space.s2)
                                    .background(Capsule().stroke(p.good.color.opacity(0.5)))
                            }
                            .buttonStyle(.plain)
                        }
                        Text(server.baseURL).font(WorkbenchStyle.code(KitTokens.TypeScale.xs)).foregroundStyle(p.info.color).textSelection(.enabled)
                        ModelTags(items: server.models, color: p.syntax.string.color)
                    }
                }
            }
        }
    }

    // MARK: Local models

    private func local(_ view: WorkbenchAi) -> some View {
        VStack(alignment: .leading, spacing: WorkbenchStyle.Gap.row) {
            sectionHead("On this Mac", count: nil, color: p.syntax.number.color, note: "local chat and embedding models") {
                if view.local.contains(where: { $0.fix != nil }) {
                    action("Set up", "arrow.down.circle", p.syntax.number.color, key: "lucaAi.setup") { model.pickSetup() }
                }
            }
            grid(view.local, min: 320) { check in
                WorkbenchCard(tint: check.ok ? p.good.color : p.textFaint.color, padding: KitTokens.Space.s5) {
                    VStack(alignment: .leading, spacing: KitTokens.Space.s3) {
                        HStack(spacing: KitTokens.Space.s4) {
                            Image(systemName: check.ok ? "checkmark.circle.fill" : "circle.dashed")
                                .foregroundStyle(check.ok ? p.good.color : p.textFaint.color)
                            Text(check.label).font(WorkbenchStyle.heading).foregroundStyle(p.text.color)
                            Spacer(minLength: 0)
                        }
                        Text(check.detail).font(WorkbenchStyle.meta).foregroundStyle(p.textMuted.color).lineLimit(2)
                            .fixedSize(horizontal: false, vertical: true)
                        if let fix = check.fix {
                            Button { model.openSetup(check) } label: {
                                Text(fix).font(WorkbenchStyle.code(KitTokens.TypeScale.xs)).foregroundStyle(p.syntax.number.color)
                                    .padding(.horizontal, KitTokens.Space.s4).padding(.vertical, KitTokens.Space.s2)
                                    .background(RoundedRectangle(cornerRadius: KitTokens.Radius.sm).fill(p.inset.color))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
        }
    }

    private func files(_ view: WorkbenchAi) -> some View {
        WorkbenchSection(title: "Where providers are declared", color: p.textMuted.color) {
            VStack(alignment: .leading, spacing: KitTokens.Space.s3) {
                ForEach(view.configFiles) { file in
                    HStack(alignment: .firstTextBaseline, spacing: KitTokens.Space.s4) {
                        Text(file.kind == "machine" ? "This Mac" : "This project")
                            .font(WorkbenchStyle.ui(KitTokens.TypeScale.xs, weight: .semibold)).foregroundStyle(p.textMuted.color)
                            .frame(width: 110, alignment: .leading)
                        Text(file.display).font(WorkbenchStyle.code(KitTokens.TypeScale.xs)).foregroundStyle(p.textBody.color).textSelection(.enabled)
                        Text(file.exists ? (file.providers.isEmpty ? "no providers" : file.providers.joined(separator: ", ")) : "not there yet")
                            .font(WorkbenchStyle.meta).foregroundStyle(p.textFaint.color).lineLimit(1)
                    }
                }
            }
        }
    }
}

/// Short tags on one or more lines: a server's models.
private struct ModelTags: View {
    let items: [String]
    let color: Color

    var body: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 200), spacing: KitTokens.Space.s3, alignment: .leading)], alignment: .leading, spacing: KitTokens.Space.s3) {
            ForEach(items, id: \.self) { item in
                Text(item)
                    .font(WorkbenchStyle.code(KitTokens.TypeScale.xs))
                    .foregroundStyle(color)
                    .lineLimit(1)
                    .truncationMode(.middle)
                    .padding(.horizontal, KitTokens.Space.s4)
                    .padding(.vertical, 3)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(RoundedRectangle(cornerRadius: KitTokens.Radius.sm).fill(color.opacity(0.1)))
            }
        }
    }
}
