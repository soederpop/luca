import SwiftUI
import Combine

/// `luca://<project>/request/<METHOD>/<path>`: send one route a request.
/// The form is the route's path params, query params and body fields, as
/// the host reads them from the endpoint's schema. The host sends the
/// request to its serve child and shapes the answer (status, time,
/// headers, the body as a tree or text); this tile only draws it.
///
/// `r` (or `Enter` in a field) sends, `s` starts or stops the server, `i`
/// goes to the first field, `h` shows the headers, `v` switches the body
/// between tree and text, `x` clears, `u` goes up to the endpoints.
/// `:arg <name> <value>` sets a field, `:body <json>` sends that body as is.
/// Sending with the server stopped asks to start it, then sends.
@MainActor
final class RequestContent: WorkbenchContent {
    static let kind = TileKind(id: "luca-request", label: "Request", glyph: "paperplane") { uri, _ in
        RequestContent(uri: uri)
    }

    let method: String
    let path: String
    @Published private(set) var route: WorkbenchRoute?
    @Published private(set) var error: String?
    @Published var values: [String: String] = [:]
    @Published var rawBody = ""
    @Published private(set) var response: WorkbenchResponse?
    @Published private(set) var sending = false
    @Published var showHeaders = false
    @Published var bodyAsText = false
    @Published private(set) var focusTick = 0
    let serve = ServeMonitor()
    private var loadTask: Task<Void, Never>?
    /// Send once the server is up (a send asked to start it).
    private var sendWhenRunning = false
    private var serveWatch: AnyCancellable?
    private var prefilled = false

    init(uri: TileURI) {
        let parsed = RequestAddress.parse(uri.id)
        method = parsed?.method ?? "GET"
        path = parsed?.path ?? "/"
        super.init(kindId: Self.kind.id, uri: uri, title: "\(parsed?.method ?? "?") \(parsed?.path ?? uri.id ?? "")")
        serveWatch = serve.$serve.sink { [weak self] state in self?.serveChanged(state) }
    }

    override func makeBody() -> AnyView { AnyView(RequestView(model: self, serve: serve)) }

    override func hostChanged(_ client: WorkbenchClient?) {
        loadTask?.cancel()
        serve.attach(client)
        guard let client else { sending = false; return }
        load(client)
    }

    override func perform(_ action: String) -> Bool {
        switch action {
        case "lucaRequest.send": send()
        case "lucaRequest.serve": serve.toggle()
        case "lucaRequest.edit": focusTick += 1
        case "lucaRequest.headers": showHeaders.toggle()
        case "lucaRequest.view": bodyAsText.toggle()
        case "lucaRequest.clear": response = nil
        case "lucaRequest.endpoints": Shell.shared.focusOrOpenTool(project: projectId, tool: "endpoints")
        case "lucaRequest.restart": restartHost()
        default: return false
        }
        return true
    }

    override func runCommand(_ verb: String, _ rest: String) -> Bool {
        switch verb {
        case "arg":
            let parts = rest.split(separator: " ", maxSplits: 1).map(String.init)
            guard let name = parts.first else { Shell.shared.flash("Usage: arg <name> <value>"); return true }
            guard route?.fields.contains(where: { $0.name == name }) == true else {
                Shell.shared.flash("\(title) has no field '\(name)'")
                return true
            }
            values[name] = parts.count > 1 ? parts[1] : ""
        case "body": rawBody = rest
        case "send": send()
        case "serve":
            switch rest {
            case "start": serve.start()
            case "stop": serve.stop()
            default: serve.toggle()
            }
        default: return false
        }
        return true
    }

    private func load(_ client: WorkbenchClient) {
        stateLabel = route == nil ? "loading" : stateLabel
        loadTask = Task { [weak self] in
            guard let self else { return }
            do {
                let answer = try await client.route(method: self.method, path: self.path)
                guard !Task.isCancelled else { return }
                self.route = answer.route
                self.error = nil
                self.serve.update(answer.server)
                if !self.prefilled {
                    self.prefilled = true
                    for option in self.uri.options where option.name == "body" { self.rawBody = option.value }
                    for option in self.uri.options where answer.route.fields.contains(where: { $0.name == option.name }) {
                        self.values[option.name] = option.value
                    }
                }
                if self.response == nil { self.stateLabel = answer.server.text }
            } catch {
                guard !Task.isCancelled else { return }
                self.error = ErrorText.message(error)
                self.stateLabel = "error"
            }
        }
    }

    private func serveChanged(_ state: WorkbenchServe) {
        if response == nil, route != nil { stateLabel = state.text }
        guard sendWhenRunning else { return }
        if state.status == "running" {
            sendWhenRunning = false
            // `@Published` calls this before it stores the new state: send on the next turn, when `serve.serve` reads running.
            DispatchQueue.main.async { [weak self] in self?.send() }
        } else if state.status == "failed" {
            sendWhenRunning = false
        }
    }

    func send() {
        guard let host else { return Shell.shared.flash("The workbench host is not running") }
        guard route != nil else { return Shell.shared.flash("Still loading") }
        guard !sending else { return }
        if serve.serve.status == "starting" {
            sendWhenRunning = true
            return Shell.shared.flash("The server is starting: the request goes when it is up")
        }
        sending = true
        stateLabel = "sending"
        let values = values.filter { !$0.value.isEmpty }
        let body = rawBody.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : rawBody
        Task { [weak self] in
            do {
                let answer = try await host.send(method: self?.method ?? "GET", path: self?.path ?? "/", values: values, body: body)
                guard let self else { return }
                self.sending = false
                if answer.notRunning == true {
                    self.stateLabel = "server stopped"
                    return self.askToStart()
                }
                if answer.ok {
                    self.response = answer
                    self.stateLabel = "\(answer.status ?? 0) \(answer.statusText ?? "") · \(answer.ms ?? 0) ms"
                } else {
                    self.stateLabel = "not sent"
                    Shell.shared.flash(answer.error ?? "Not sent")
                }
            } catch {
                guard let self else { return }
                self.sending = false
                self.stateLabel = "error"
                Shell.shared.flash(ErrorText.message(error))
            }
        }
    }

    private func askToStart() {
        PaletteController.shared.confirm("The server is not running. Start it and send?", yes: "Yes, start the server") { [weak self] in
            guard let self else { return }
            self.sendWhenRunning = true
            self.serve.start()
        }
    }

    override func stop() {
        loadTask?.cancel()
        serve.attach(nil)
        super.stop()
    }
}

struct RequestView: View {
    @ObservedObject var model: RequestContent
    @ObservedObject var serve: ServeMonitor
    @FocusState private var focused: String?

    private var p: KitPalette { Theme.palette }

    var body: some View {
        ScrollViewReader { proxy in
        ScrollView {
            VStack(alignment: .leading, spacing: KitTokens.Space.s8) {
                WorkbenchHostLine(status: model.hostStatus)
                if let error = model.error {
                    WorkbenchCard(tint: p.bad.color) {
                        Text(error).font(WorkbenchStyle.ui(KitTokens.TypeScale.sm)).foregroundStyle(p.bad.color).textSelection(.enabled)
                    }
                }
                header
                if let route = model.route {
                    serverLine
                    formSection(route)
                    sendBar
                    if let response = model.response { responseSection(response).id("response") }
                } else if model.hostStatus == .running, model.error == nil {
                    ProgressView().controlSize(.small)
                }
            }
            .padding(.horizontal, WorkbenchStyle.Gap.page)
            .padding(.vertical, WorkbenchStyle.Gap.page - KitTokens.Space.s2)
            .frame(maxWidth: WorkbenchStyle.Size.readable + 200, alignment: .leading)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .onChange(of: model.response) { _, response in
            if response != nil { withAnimation(.easeOut(duration: 0.2)) { proxy.scrollTo("response", anchor: .top) } }
        }
        }
        .background(p.surface.color)
        .onChange(of: model.focusTick) { _, _ in
            focused = model.route?.fields.first(where: { $0.type != "enum" && $0.type != "boolean" })?.id
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: KitTokens.Space.s3) {
            HStack(alignment: .center, spacing: KitTokens.Space.s5) {
                MethodPill(method: model.method, size: KitTokens.TypeScale.md)
                PathText(path: model.path, size: KitTokens.TypeScale.xl)
                Spacer(minLength: 0)
            }
            if let route = model.route {
                if !route.summary.isEmpty {
                    Text(route.summary).font(WorkbenchStyle.ui(KitTokens.TypeScale.md)).foregroundStyle(p.textBody.color)
                }
                HStack(spacing: KitTokens.Space.s4) {
                    Text(route.file).font(WorkbenchStyle.code(KitTokens.TypeScale.xs)).foregroundStyle(p.textFaint.color)
                    ForEach(route.tags, id: \.self) { WorkbenchTag(text: $0, color: p.accent.color) }
                    if let limit = route.rateLimit { WorkbenchTag(text: limit, color: p.syntax.property.color) }
                }
            }
        }
    }

    private var serverLine: some View {
        WorkbenchCard(tint: WorkbenchStyle.color(serve.tone)) {
            VStack(alignment: .leading, spacing: KitTokens.Space.s3) {
                HStack(spacing: KitTokens.Space.s5) {
                    ServeBadge(serve: serve.serve)
                    if serve.busy { ProgressView().controlSize(.small) }
                    if !serve.running, !serve.busy {
                        Text("Requests go to this project's luca serve. Start it first.")
                            .font(WorkbenchStyle.ui(KitTokens.TypeScale.sm)).foregroundStyle(p.textMuted.color)
                    } else if let url = serve.serve.url {
                        Text(url).font(WorkbenchStyle.code(KitTokens.TypeScale.sm)).foregroundStyle(p.textBody.color)
                    }
                    Spacer(minLength: 0)
                    ServeButton(monitor: serve, action: "lucaRequest.serve", hints: model.hints)
                }
                if serve.serve.status == "failed", let error = serve.serve.error {
                    Text(error).font(WorkbenchStyle.code(KitTokens.TypeScale.xs)).foregroundStyle(p.bad.color).textSelection(.enabled)
                }
            }
        }
    }

    @ViewBuilder private func formSection(_ route: WorkbenchRoute) -> some View {
        let groups: [(String, String, [WorkbenchRequestField])] = [
            ("Path", "path", route.fields.filter { $0.in == "path" }),
            ("Query", "query", route.fields.filter { $0.in == "query" }),
            ("Body", "body", route.fields.filter { $0.in == "body" }),
        ]
        VStack(alignment: .leading, spacing: KitTokens.Space.s7) {
            ForEach(groups, id: \.1) { title, _, fields in
                if !fields.isEmpty { fieldsCard(title, fields) }
            }
            if route.body { rawBodyCard(route) }
            if route.fields.isEmpty, !route.body {
                Text("This route takes no parameters.").font(WorkbenchStyle.ui(KitTokens.TypeScale.sm)).foregroundStyle(p.textFaint.color)
            }
            if route.upload {
                Text("This route takes file uploads; the form sends only the other fields.")
                    .font(WorkbenchStyle.ui(KitTokens.TypeScale.sm)).foregroundStyle(p.warn.color)
            }
        }
    }

    private func fieldsCard(_ title: String, _ fields: [WorkbenchRequestField]) -> some View {
        VStack(alignment: .leading, spacing: KitTokens.Space.s3) {
            WorkbenchSectionTitle(title: title, note: fields.contains(where: \.required) ? "\(fields.filter(\.required).count) required" : nil)
            WorkbenchCard {
                Grid(alignment: .leadingFirstTextBaseline, horizontalSpacing: KitTokens.Space.s6, verticalSpacing: KitTokens.Space.s6) {
                    ForEach(fields) { field in
                        GridRow {
                            VStack(alignment: .trailing, spacing: KitTokens.Space.s1) {
                                Text(field.name)
                                    .font(WorkbenchStyle.code(KitTokens.TypeScale.sm, weight: field.required ? .semibold : .regular))
                                    .foregroundStyle(field.required ? p.text.color : p.textMuted.color)
                                Text(field.required ? "required · \(field.type)" : field.type)
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

    private func binding(_ field: WorkbenchRequestField) -> Binding<String> {
        Binding(get: { model.values[field.name] ?? "" }, set: { model.values[field.name] = $0 })
    }

    @ViewBuilder private func control(_ field: WorkbenchRequestField) -> some View {
        let options = field.options ?? (field.type == "boolean" ? ["true", "false"] : nil)
        if let options {
            let current = model.values[field.name] ?? ""
            Menu {
                Button("—") { model.values[field.name] = "" }
                ForEach(options, id: \.self) { option in
                    Button(option) { model.values[field.name] = option }
                }
            } label: {
                HStack(spacing: KitTokens.Space.s3) {
                    Text(current.isEmpty ? (field.default ?? "—") : current)
                        .foregroundStyle(current.isEmpty ? p.textFaint.color : WorkbenchStyle.valueColor(field.type == "boolean" ? "boolean" : "string"))
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
            let empty = (model.values[field.name] ?? "").isEmpty
            TextField(field.default ?? field.type, text: binding(field))
                .textFieldStyle(.plain)
                .font(WorkbenchStyle.code(KitTokens.TypeScale.sm))
                .foregroundStyle(WorkbenchStyle.valueColor(field.type == "number" || field.type == "integer" ? "number" : "string"))
                .focused($focused, equals: field.id)
                .onSubmit { model.send() }
                .padding(.horizontal, KitTokens.Space.s4)
                .padding(.vertical, KitTokens.Space.s3)
                .background(RoundedRectangle(cornerRadius: KitTokens.Radius.md).fill(p.inset.color))
                .overlay(RoundedRectangle(cornerRadius: KitTokens.Radius.md)
                    .stroke(focused == field.id ? p.accent.color.opacity(0.7) : (field.required && empty ? p.warn.color.opacity(0.5) : p.border.color)))
                .frame(maxWidth: 460, alignment: .leading)
        }
    }

    private func rawBodyCard(_ route: WorkbenchRoute) -> some View {
        VStack(alignment: .leading, spacing: KitTokens.Space.s3) {
            WorkbenchSectionTitle(title: "Raw JSON body", note: "when set, sent as is instead of the body fields")
            TextField("{ … }", text: $model.rawBody, axis: .vertical)
                .lineLimit(1...8)
                .textFieldStyle(.plain)
                .font(WorkbenchStyle.code(KitTokens.TypeScale.sm))
                .foregroundStyle(WorkbenchStyle.valueColor("string"))
                .focused($focused, equals: "__body__")
                .padding(.horizontal, KitTokens.Space.s5)
                .padding(.vertical, KitTokens.Space.s4)
                .background(RoundedRectangle(cornerRadius: KitTokens.Radius.md).fill(p.inset.color))
                .overlay(RoundedRectangle(cornerRadius: KitTokens.Radius.md).stroke(focused == "__body__" ? p.accent.color.opacity(0.7) : p.border.color))
        }
    }

    private var sendBar: some View {
        HStack(spacing: KitTokens.Space.s5) {
            Button { model.send() } label: {
                Label("Send", systemImage: "paperplane.fill")
                    .font(WorkbenchStyle.ui(KitTokens.TypeScale.sm, weight: .semibold))
                    .padding(.horizontal, KitTokens.Space.s6)
                    .padding(.vertical, KitTokens.Space.s3)
                    .background(Capsule().fill(model.sending ? p.inset.color : p.accent.color))
                    .foregroundStyle(model.sending ? p.textFaint.color : p.accentOn.color)
            }
            .buttonStyle(.plain)
            .disabled(model.sending)
            .keyBadge("lucaRequest.send")
            .hintTarget("lucaRequest.send", in: model.hints) { model.send() }
            if model.sending { ProgressView().controlSize(.small) }
            Spacer(minLength: 0)
        }
    }

    private func responseSection(_ r: WorkbenchResponse) -> some View {
        let tone = WorkbenchStyle.color(.status(r.statusClass))
        return VStack(alignment: .leading, spacing: KitTokens.Space.s4) {
            WorkbenchSectionTitle(title: "Response", note: nil)
            WorkbenchCard(tint: tone) {
                VStack(alignment: .leading, spacing: KitTokens.Space.s5) {
                    HStack(alignment: .firstTextBaseline, spacing: KitTokens.Space.s5) {
                        Text("\(r.status ?? 0)").font(WorkbenchStyle.code(KitTokens.TypeScale.xxl, weight: .bold)).foregroundStyle(tone)
                        Text(r.statusText ?? "").font(WorkbenchStyle.ui(KitTokens.TypeScale.md, weight: .semibold)).foregroundStyle(tone)
                        Spacer(minLength: 0)
                        stat("time", "\(r.ms ?? 0) ms")
                        stat("size", r.sizeText ?? "")
                    }
                    HStack(spacing: KitTokens.Space.s4) {
                        MethodPill(method: r.method ?? model.method)
                        Text(r.url ?? "").font(WorkbenchStyle.code(KitTokens.TypeScale.sm)).foregroundStyle(p.textBody.color).textSelection(.enabled)
                    }
                    if let sent = r.sent {
                        VStack(alignment: .leading, spacing: KitTokens.Space.s2) {
                            Text("Sent").font(WorkbenchStyle.ui(KitTokens.TypeScale.xs, weight: .semibold)).foregroundStyle(p.textMuted.color)
                            Text(sent).font(WorkbenchStyle.code(KitTokens.TypeScale.xs)).foregroundStyle(p.textMuted.color).textSelection(.enabled)
                        }
                    }
                }
            }
            headersCard(r)
            bodyCard(r, tone: tone)
        }
    }

    private func stat(_ label: String, _ value: String) -> some View {
        VStack(alignment: .trailing, spacing: 0) {
            Text(value).font(WorkbenchStyle.code(KitTokens.TypeScale.sm, weight: .semibold)).foregroundStyle(p.text.color)
            Text(label).font(WorkbenchStyle.ui(KitTokens.TypeScale.xs)).foregroundStyle(p.textFaint.color)
        }
    }

    private func headersCard(_ r: WorkbenchResponse) -> some View {
        let headers = r.headers ?? []
        return VStack(alignment: .leading, spacing: KitTokens.Space.s3) {
            Button { model.showHeaders.toggle() } label: {
                HStack(spacing: KitTokens.Space.s3) {
                    Image(systemName: model.showHeaders ? "chevron.down" : "chevron.right").font(.system(size: 11, weight: .bold))
                    Text("Headers").font(WorkbenchStyle.ui(KitTokens.TypeScale.sm, weight: .semibold))
                    Text("\(headers.count)").font(WorkbenchStyle.ui(KitTokens.TypeScale.xs)).foregroundStyle(p.textFaint.color)
                }
                .foregroundStyle(p.textMuted.color)
                .padding(.trailing, KitTokens.Space.s5)
            }
            .buttonStyle(.plain)
            .keyBadge("lucaRequest.headers")
            if model.showHeaders {
                WorkbenchCard {
                    Grid(alignment: .leadingFirstTextBaseline, horizontalSpacing: KitTokens.Space.s6, verticalSpacing: KitTokens.Space.s3) {
                        ForEach(Array(headers.enumerated()), id: \.offset) { _, h in
                            GridRow {
                                Text(h.name).foregroundStyle(WorkbenchStyle.keyColor).gridColumnAlignment(.trailing)
                                Text(h.value).foregroundStyle(p.textBody.color).textSelection(.enabled)
                            }
                            .font(WorkbenchStyle.code(KitTokens.TypeScale.xs))
                        }
                    }
                }
            }
        }
    }

    private func bodyCard(_ r: WorkbenchResponse, tone: Color) -> some View {
        VStack(alignment: .leading, spacing: KitTokens.Space.s3) {
            HStack(spacing: KitTokens.Space.s4) {
                Text("Body").font(WorkbenchStyle.ui(KitTokens.TypeScale.sm, weight: .semibold)).foregroundStyle(p.textMuted.color)
                if let type = r.contentType, !type.isEmpty {
                    Text(type).font(WorkbenchStyle.code(KitTokens.TypeScale.xs)).foregroundStyle(p.textFaint.color)
                }
                Spacer(minLength: 0)
                if r.tree != nil {
                    Button { model.bodyAsText.toggle() } label: {
                        Text(model.bodyAsText ? "as a tree" : "as text").font(WorkbenchStyle.ui(KitTokens.TypeScale.xs, weight: .semibold))
                            .foregroundStyle(p.accent.color)
                            .padding(.trailing, KitTokens.Space.s5)
                    }
                    .buttonStyle(.plain)
                    .keyBadge("lucaRequest.view")
                }
            }
            WorkbenchCard(tint: tone.opacity(0.5)) {
                if r.bodyKind == "empty" {
                    Text("No body").font(WorkbenchStyle.ui(KitTokens.TypeScale.sm)).foregroundStyle(p.textFaint.color)
                } else if let tree = r.tree, tree.children != nil, !model.bodyAsText {
                    ConsoleTreeRow(node: tree)
                        .id("\(r.url ?? "")·\(r.ms ?? 0)·\(r.size ?? 0)")
                } else {
                    Text(r.text ?? "")
                        .font(WorkbenchStyle.code(KitTokens.TypeScale.sm))
                        .foregroundStyle(r.bodyKind == "json" ? WorkbenchStyle.valueColor(r.tree?.type ?? "string") : p.textBody.color)
                        .lineSpacing(3)
                        .textSelection(.enabled)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
    }
}
