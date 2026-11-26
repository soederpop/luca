import SwiftUI
import Combine
import MarkdownUI

/// `luca://<project>/helper/<registry>/<id>`: the inspector for one helper.
/// It draws what the host's `GET /helper/<registry>/<id>` sends (docs,
/// schemas, methods), the live state and events from the host socket, and
/// the last method call. `m` calls a method: the palette picks it and asks
/// for its arguments, the host runs it and shapes the result.
@MainActor
final class HelperContent: WorkbenchContent {
    static let kind = TileKind(id: "luca-helper", label: "Helper", glyph: "cube") { uri, _ in
        HelperContent(uri: uri)
    }

    /// The last method call, as the host answered it.
    struct CallShown: Equatable {
        let call: String
        let ok: Bool
        let text: String
        let detail: String
    }

    let address: HelperAddress?
    @Published private(set) var info: WorkbenchHelper?
    @Published private(set) var error: String?
    /// The live state from the last socket frame, else from the last load.
    @Published private(set) var stateText: String?
    @Published private(set) var events = HelperEventLog()
    @Published private(set) var lastCall: CallShown?
    @Published private(set) var calling: String?
    private var loadTask: Task<Void, Never>?
    private var frameWatch: AnyCancellable?

    init(uri: TileURI) {
        address = HelperAddress(uri.id ?? "")
        super.init(kindId: Self.kind.id, uri: uri, title: address?.title ?? "helper")
    }

    override func makeBody() -> AnyView { AnyView(HelperView(model: self)) }

    override func hostChanged(_ client: WorkbenchClient?) {
        loadTask?.cancel()
        frameWatch = nil
        guard let client, let address else {
            if address == nil { error = "Not a helper address: \(uri)" }
            return
        }
        frameWatch = client.events
            .filter { $0.registry == address.registry && $0.id == address.id }
            .sink { [weak self] frame in self?.take(frame) }
        client.subscribe(registry: address.registry, id: address.id)
        load(client)
    }

    override func perform(_ action: String) -> Bool {
        switch action {
        case "lucaHelper.call": pickMethod()
        case "lucaHelper.reload":
            if let host { load(host) } else { restartHost() }
        case "lucaHelper.restart": restartHost()
        case "lucaHelper.clearEvents": events.clear()
        case "lucaHelper.take": Shell.shared.takeInto(takeSource ?? TakeSource(project: projectId, registry: address?.registry ?? "", id: address?.id ?? "", origin: nil))
        case "lucaHelper.registry":
            Shell.shared.openOrFocus(TileURI.luca(project: projectId, tool: "registry",
                                                  options: address.map { [.init(name: "stack", value: $0.registry)] } ?? []))
        default: return false
        }
        return true
    }

    /// This helper and where it comes from, once loaded.
    var takeSource: TakeSource? {
        guard let address, let info else { return nil }
        return TakeSource(project: projectId, registry: address.registry, id: address.id, origin: info.origin)
    }

    override func runCommand(_ verb: String, _ rest: String) -> Bool {
        guard verb == "take" else { return false }
        Shell.shared.takeCommand(takeSource, rest)
        return true
    }

    private func take(_ frame: WorkbenchEvent) {
        switch frame.type {
        case "state":
            if let text = frame.text { stateText = text }
        case "event":
            events.add(name: frame.name ?? "event", text: frame.text ?? "",
                       at: frame.at.map { Date(timeIntervalSince1970: $0 / 1000) } ?? Date())
        default:
            break
        }
    }

    private func load(_ client: WorkbenchClient) {
        guard let address else { return }
        loadTask?.cancel()
        stateLabel = info == nil ? "loading" : "updating"
        loadTask = Task { [weak self] in
            do {
                let info = try await client.helper(registry: address.registry, id: address.id)
                guard let self, !Task.isCancelled else { return }
                self.info = info
                self.stateText = info.stateText
                self.error = nil
                self.title = info.title
                self.stateLabel = info.live ? "live" : "no instance"
            } catch {
                guard let self, !Task.isCancelled else { return }
                self.error = ErrorText.message(error)
                self.stateLabel = "error"
            }
        }
    }

    /// `m`: the palette lists the methods, then asks for the arguments.
    func pickMethod() {
        guard let info else { return Shell.shared.flash("Still loading") }
        guard info.callable else { return Shell.shared.flash(info.liveNote ?? "This helper has no instance to call") }
        guard !info.methods.isEmpty else { return Shell.shared.flash("\(info.title) lists no methods") }
        let items = info.methods.map { method in
            PaletteChoice(title: method.signature, detail: method.description) { [weak self] in self?.ask(method) }
        }
        PaletteController.shared.choose("call a method on \(info.title)", items)
    }

    func ask(_ method: WorkbenchHelper.Method) {
        guard method.askArgs else { return call(method, args: "") }
        PaletteController.shared.ask("\(method.signature) · \(method.argsHint)") { [weak self] text in
            self?.call(method, args: text)
        }
    }

    private func call(_ method: WorkbenchHelper.Method, args: String) {
        guard let host, let address else { return Shell.shared.flash("The workbench host is not running") }
        calling = method.name
        Task { [weak self] in
            do {
                let answer = try await host.call(registry: address.registry, id: address.id, method: method.name, args: args)
                guard let self else { return }
                self.calling = nil
                self.lastCall = Self.shown(answer, method: method.name)
                // A call may have made the instance; its state comes with the reload.
                if answer.created == true || self.info?.live == false { self.load(host) }
            } catch {
                guard let self else { return }
                self.calling = nil
                self.lastCall = CallShown(call: method.name, ok: false, text: ErrorText.message(error), detail: "")
            }
        }
    }

    nonisolated static func shown(_ answer: WorkbenchCallResult, method: String) -> CallShown {
        var detail: [String] = []
        if let type = answer.type { detail.append(type) }
        if let ms = answer.ms { detail.append("\(ms) ms") }
        if answer.created == true { detail.append("created the instance") }
        return CallShown(call: answer.call ?? method, ok: answer.ok,
                         text: answer.ok ? (answer.text ?? "") : (answer.error ?? "failed"),
                         detail: detail.joined(separator: " · "))
    }

    override func stop() {
        loadTask?.cancel()
        frameWatch = nil
        super.stop()
    }
}

/// `features/fs` in a helper address: the registry, then the helper id.
struct HelperAddress: Equatable {
    let registry: String
    let id: String

    init?(_ text: String) {
        guard let slash = text.firstIndex(of: "/") else { return nil }
        registry = String(text[..<slash])
        id = String(text[text.index(after: slash)...])
        guard !registry.isEmpty, !id.isEmpty else { return nil }
    }

    var title: String { "\(registry).\(id)" }
}

/// The events the inspector has seen, newest first, at most `limit`.
struct HelperEventLog: Equatable {
    struct Entry: Equatable, Identifiable {
        let id: Int
        let name: String
        let text: String
        let at: Date
    }

    static let limit = 40
    private(set) var entries: [Entry] = []
    private var next = 0

    mutating func add(name: String, text: String, at: Date) {
        entries.insert(Entry(id: next, name: name, text: text, at: at), at: 0)
        next += 1
        if entries.count > Self.limit { entries.removeLast(entries.count - Self.limit) }
    }

    mutating func clear() { entries = [] }
}

struct HelperView: View {
    @ObservedObject var model: HelperContent

    private var p: KitPalette { Theme.palette }
    private var registry: String { model.address?.registry ?? "" }
    /// The registry's color: the title mark, method names, section bars.
    private var tint: Color { WorkbenchStyle.thingColor(registry) }

    private static let clock: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "HH:mm:ss"
        return f
    }()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: WorkbenchStyle.Gap.section) {
                WorkbenchHostLine(status: model.hostStatus)
                if let error = model.error {
                    WorkbenchCard(tint: p.bad.color) {
                        Text(error).font(WorkbenchStyle.body).foregroundStyle(p.bad.color).lineLimit(3)
                    }
                }
                header
                if let info = model.info {
                    callSection
                    stateSection(info)
                    eventsSection
                    methodsSection(info)
                    if !info.getters.isEmpty { fieldsSection("Getters", info.getters) }
                    if !info.optionFields.isEmpty { fieldsSection("Options", info.optionFields) }
                    if !info.stateFields.isEmpty { fieldsSection("State schema", info.stateFields) }
                    WorkbenchSection(title: "Docs", color: p.textFaint.color) {
                        Markdown(info.markdown).tilesMarkdown().textSelection(.enabled)
                    }
                } else if model.hostStatus == .running, model.error == nil {
                    ProgressView().controlSize(.small)
                }
            }
            .padding(.horizontal, WorkbenchStyle.Gap.page)
            .padding(.vertical, WorkbenchStyle.Gap.page - KitTokens.Space.s2)
            .frame(maxWidth: WorkbenchStyle.Size.readable, alignment: .leading)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(p.surface.color)
    }

    private var header: some View {
        HStack(alignment: .top, spacing: WorkbenchStyle.Gap.card) {
            ThingGlyph(symbol: WorkbenchStyle.thingGlyph(registry), color: tint, size: 48)
            VStack(alignment: .leading, spacing: KitTokens.Space.s3) {
                HStack(alignment: .firstTextBaseline, spacing: KitTokens.Space.s4) {
                    Text(model.address?.id ?? model.info?.title ?? "helper")
                        .font(WorkbenchStyle.title)
                        .foregroundStyle(p.text.color)
                        .lineLimit(1)
                    Text(registry)
                        .font(WorkbenchStyle.ui(KitTokens.TypeScale.sm, weight: .medium))
                        .foregroundStyle(tint)
                    Spacer(minLength: 0)
                    if let info = model.info {
                        WorkbenchTag(text: info.live ? "● live" : "no instance", color: info.live ? p.good.color : p.textMuted.color)
                    }
                }
                if let summary = model.info?.summary, !summary.isEmpty {
                    Text(summary).font(WorkbenchStyle.body).foregroundStyle(p.textBody.color)
                        .fixedSize(horizontal: false, vertical: true)
                }
                if let origin = model.info?.origin { OriginLine(origin: origin) }
            }
        }
    }

    @ViewBuilder private var callSection: some View {
        if let name = model.calling {
            HStack(spacing: KitTokens.Space.s4) {
                ProgressView().controlSize(.small)
                Text("calling \(name)…").font(WorkbenchStyle.body).foregroundStyle(p.textMuted.color)
            }
        } else if let call = model.lastCall {
            WorkbenchSection(title: "Last call", note: call.detail, color: call.ok ? p.good.color : p.bad.color) {
                WorkbenchCard(tint: call.ok ? p.good.color : p.bad.color) {
                    VStack(alignment: .leading, spacing: KitTokens.Space.s4) {
                        Text(call.call).font(WorkbenchStyle.code(KitTokens.TypeScale.sm, weight: .semibold))
                            .foregroundStyle(call.ok ? tint : p.bad.color)
                            .lineLimit(2)
                        if call.ok {
                            ValueRows(text: call.text)
                        } else {
                            Text(call.text).font(WorkbenchStyle.code()).foregroundStyle(p.bad.color).textSelection(.enabled)
                        }
                    }
                }
            }
        }
    }

    private func stateSection(_ info: WorkbenchHelper) -> some View {
        WorkbenchSection(title: "Live state", color: p.good.color) {
            if let text = model.stateText {
                ValueRows(text: text)
            } else {
                Text(info.liveNote ?? "No instance yet.")
                    .font(WorkbenchStyle.body).foregroundStyle(p.textMuted.color)
            }
        }
    }

    private var eventsSection: some View {
        WorkbenchSection(title: "Events", count: model.events.entries.count, color: p.info.color) {
            if model.events.entries.isEmpty {
                if let names = model.info?.events, !names.isEmpty {
                    HStack(alignment: .firstTextBaseline, spacing: KitTokens.Space.s3) {
                        Text("Waiting for").font(WorkbenchStyle.body).foregroundStyle(p.textMuted.color)
                        ForEach(names.prefix(6), id: \.self) { name in
                            WorkbenchTag(text: name, color: eventColor(name))
                        }
                        if names.count > 6 { Text("…").foregroundStyle(p.textFaint.color) }
                    }
                } else {
                    Text("No events declared. Any it emits show here.")
                        .font(WorkbenchStyle.body).foregroundStyle(p.textMuted.color)
                }
            } else {
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(Array(model.events.entries.enumerated()), id: \.element.id) { index, entry in
                        eventRow(entry, last: index == model.events.entries.count - 1)
                    }
                }
            }
        }
    }

    /// One event on the timeline: a dot on the line, the time, the name in
    /// its own color, and what it carried.
    private func eventRow(_ entry: HelperEventLog.Entry, last: Bool) -> some View {
        let color = eventColor(entry.name)
        return HStack(alignment: .top, spacing: WorkbenchStyle.Gap.row) {
            VStack(spacing: 0) {
                Circle().fill(color).frame(width: 10, height: 10).padding(.top, 7)
                if !last { Rectangle().fill(p.border.color).frame(width: 2).frame(maxHeight: .infinity) }
            }
            .frame(width: 12)
            Text(Self.clock.string(from: entry.at))
                .font(WorkbenchStyle.code(KitTokens.TypeScale.xs))
                .foregroundStyle(p.textFaint.color)
                .padding(.top, 2)
            VStack(alignment: .leading, spacing: KitTokens.Space.s2) {
                Text(entry.name).font(WorkbenchStyle.ui(KitTokens.TypeScale.sm, weight: .semibold)).foregroundStyle(color)
                if !entry.text.isEmpty {
                    Text(entry.text).font(WorkbenchStyle.code(KitTokens.TypeScale.xs)).foregroundStyle(p.textBody.color)
                        .lineLimit(3).textSelection(.enabled)
                }
            }
            .padding(.bottom, WorkbenchStyle.Gap.row)
            Spacer(minLength: 0)
        }
        .fixedSize(horizontal: false, vertical: true)
    }

    /// An event name keeps one color: the slot its name hashes to.
    private func eventColor(_ name: String) -> Color {
        WorkbenchStyle.slotColor(OwnerColors.index(name, slots: 8))
    }

    private func methodsSection(_ info: WorkbenchHelper) -> some View {
        WorkbenchSection(title: "Methods", count: info.methods.count, color: tint) {
            WorkbenchCard(padding: KitTokens.Space.s4) {
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(Array(info.methods.enumerated()), id: \.element.id) { index, method in
                        if index > 0 { Rectangle().fill(p.border.color).frame(height: 1) }
                        Button { model.ask(method) } label: {
                            VStack(alignment: .leading, spacing: KitTokens.Space.s3) {
                                signature(method)
                                    .multilineTextAlignment(.leading)
                                    .fixedSize(horizontal: false, vertical: true)
                                if !method.description.isEmpty {
                                    Text(method.description)
                                        .font(WorkbenchStyle.body)
                                        .foregroundStyle(p.textMuted.color)
                                        .lineLimit(3)
                                        .multilineTextAlignment(.leading)
                                        .fixedSize(horizontal: false, vertical: true)
                                }
                            }
                            .padding(.vertical, WorkbenchStyle.Gap.row)
                            .padding(.horizontal, KitTokens.Space.s2)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .disabled(!info.callable)
                    }
                }
            }
        }
    }

    /// `name(param: type, …) → returns`: the name in the registry's color,
    /// parameter names dim, types in their type colors.
    private func signature(_ method: WorkbenchHelper.Method) -> Text {
        let size = KitTokens.TypeScale.sm
        var text = Text(method.name).font(WorkbenchStyle.code(size, weight: .semibold)).foregroundColor(tint)
        text = text + Text("(").font(WorkbenchStyle.code(size)).foregroundColor(p.textFaint.color)
        for (i, param) in method.params.enumerated() {
            if i > 0 { text = text + Text(", ").font(WorkbenchStyle.code(size)).foregroundColor(p.textFaint.color) }
            let optional = param.required == false ? "?" : ""
            text = text + Text(param.name + optional).font(WorkbenchStyle.code(size)).foregroundColor(p.textMuted.color)
            if !param.type.isEmpty, param.type != "unknown" {
                text = text + Text(": ").font(WorkbenchStyle.code(size)).foregroundColor(p.textFaint.color)
                    + Text(param.type).font(WorkbenchStyle.code(size)).foregroundColor(WorkbenchStyle.typeNameColor(param.type))
            }
        }
        text = text + Text(")").font(WorkbenchStyle.code(size)).foregroundColor(p.textFaint.color)
        if let returns = method.returns, !returns.isEmpty, returns != "unknown" {
            text = text + Text("  →  ").font(WorkbenchStyle.code(size)).foregroundColor(p.textFaint.color)
                + Text(returns).font(WorkbenchStyle.code(size)).foregroundColor(WorkbenchStyle.typeNameColor(returns))
        }
        return text
    }

    private func fieldsSection(_ title: String, _ fields: [WorkbenchField]) -> some View {
        WorkbenchSection(title: title, count: fields.count, color: p.syntax.property.color) {
            WorkbenchCard(padding: KitTokens.Space.s4) {
                Grid(alignment: .leadingFirstTextBaseline, horizontalSpacing: WorkbenchStyle.Gap.card, verticalSpacing: 0) {
                    ForEach(Array(fields.enumerated()), id: \.element.id) { index, field in
                        if index > 0 {
                            Rectangle().fill(p.border.color).frame(height: 1).gridCellColumns(3)
                        }
                        GridRow {
                            HStack(spacing: KitTokens.Space.s2) {
                                Text(field.name).font(WorkbenchStyle.code(KitTokens.TypeScale.sm, weight: .medium))
                                    .foregroundStyle(p.text.color)
                                if field.required == true {
                                    Text("*").font(WorkbenchStyle.code(KitTokens.TypeScale.sm, weight: .bold)).foregroundStyle(p.warn.color)
                                }
                            }
                            Text(field.type.isEmpty ? "any" : field.type)
                                .font(WorkbenchStyle.code(KitTokens.TypeScale.xs, weight: .medium))
                                .foregroundStyle(WorkbenchStyle.typeNameColor(field.type))
                                .lineLimit(1)
                            Text(field.description.isEmpty ? " " : field.description)
                                .font(WorkbenchStyle.body)
                                .foregroundStyle(p.textMuted.color)
                                .fixedSize(horizontal: false, vertical: true)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                        .padding(.vertical, WorkbenchStyle.Gap.row)
                    }
                }
                .padding(.horizontal, KitTokens.Space.s2)
            }
        }
    }
}
