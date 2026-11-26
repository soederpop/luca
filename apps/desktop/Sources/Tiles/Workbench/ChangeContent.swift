import SwiftUI

/// `luca://<project>/change?route=borrow&op=copy|borrow|unborrow&…`: a
/// change to `<project>` (the receiving project), shown before it is made.
/// The host plans it (`POST /<route>/preview`) and makes it on a confirm
/// (`POST /<route>/apply` with the preview's digest). After a write the
/// host restarts, so the registry shows the new helper.
///
/// The address holds the whole request (`ChangeRequest`), so a saved
/// layout reopens the same preview. Only the receiving project is written.
@MainActor
final class ChangeContent: WorkbenchContent {
    static let kind = TileKind(id: "luca-change", label: "Change", glyph: "arrow.triangle.branch") { uri, _ in
        ChangeContent(uri: uri)
    }

    @Published private(set) var request: ChangeRequest?
    @Published private(set) var change: WorkbenchChange?
    @Published private(set) var error: String?
    @Published private(set) var working = false
    @Published private(set) var applied: WorkbenchApplied?
    private var task: Task<Void, Never>?

    init(uri: TileURI) {
        request = ChangeRequest(uri: uri)
        super.init(kindId: Self.kind.id, uri: uri, title: "change · \(ProjectHub.shared.displayName(uri.authority))")
    }

    override func makeBody() -> AnyView { AnyView(ChangeView(model: self)) }

    override func hostChanged(_ client: WorkbenchClient?) {
        guard client != nil else { return }
        if request == nil { error = "Not a change address: \(uri)"; return }
        if applied == nil { preview() } else { stateLabel = "loaded" }
    }

    override func perform(_ action: String) -> Bool {
        switch action {
        case "lucaChange.apply": confirmApply()
        case "lucaChange.imports": toggleImports()
        case "lucaChange.overwrite": toggleOverwrite()
        case "lucaChange.reload": preview()
        case "lucaChange.restart": restartHost()
        case "lucaChange.registry": showInRegistry()
        default: return false
        }
        return true
    }

    func key(_ action: String) -> String { Shell.shared.keymap.map.keyLabel(for: action) ?? action }

    func preview() {
        guard let host, let request else { return }
        task?.cancel()
        working = true
        stateLabel = "planning"
        task = Task { [weak self] in
            do {
                let change = try await host.preview(request)
                guard let self, !Task.isCancelled else { return }
                self.change = change
                self.title = change.title
                self.error = nil
                self.working = false
                self.stateLabel = change.ok ? "ready" : change.blocked != nil ? "blocked" : "clashes"
            } catch {
                guard let self, !Task.isCancelled else { return }
                self.working = false
                self.error = ErrorText.message(error)
                self.stateLabel = "error"
            }
        }
    }

    private func toggleImports() {
        guard applied == nil, request?.op == "copy" else { return Shell.shared.flash("Only a hard copy has imports to include") }
        request?.withImports.toggle()
        preview()
    }

    private func toggleOverwrite() {
        guard applied == nil, var next = request else { return }
        if next.overwrite {
            next.overwrite = false
            request = next
            return preview()
        }
        guard let change, !change.clashes.isEmpty else { return Shell.shared.flash("Nothing clashes") }
        PaletteController.shared.confirm("Write over \(change.clashes.count) thing\(change.clashes.count == 1 ? "" : "s") that exist in \(ProjectHub.shared.displayName(projectId))?",
                                         yes: "Yes, plan to write over them") { [weak self] in
            next.overwrite = true
            self?.request = next
            self?.preview()
        }
    }

    private func confirmApply() {
        guard applied == nil else { return Shell.shared.flash("Done already") }
        guard let change else { return Shell.shared.flash("Still planning") }
        guard change.ok else { return Shell.shared.flash(change.blocked ?? "Clashes first: \(key("lucaChange.overwrite")) to write over them") }
        let n = change.files.filter { $0.action != "same" }.count
        PaletteController.shared.confirm("\(change.title): write \(n) change\(n == 1 ? "" : "s") to \(ProjectHub.shared.displayName(projectId))?",
                                         yes: "Yes, write") { [weak self] in self?.apply(change) }
    }

    private func apply(_ change: WorkbenchChange) {
        guard let host, var request else { return }
        request.digest = change.digest
        working = true
        stateLabel = "writing"
        Task { [weak self] in
            do {
                let done = try await host.apply(request)
                guard let self else { return }
                self.working = false
                self.applied = done
                self.stateLabel = "written"
                Shell.shared.flash(done.text)
                // The host loads helpers once: start it again, then show the new one.
                self.restartHost()
                self.showInRegistry()
            } catch {
                guard let self else { return }
                self.working = false
                self.error = ErrorText.message(error)
                self.stateLabel = "error"
                self.preview()
            }
        }
    }

    /// The receiving project's registry, on the helper's stack.
    func showInRegistry() {
        let stack = request?.registry
        Shell.shared.focusOrOpenTool(project: projectId, tool: "registry",
                                     options: stack.map { [.init(name: "stack", value: $0)] } ?? [])
    }

    override func stop() {
        task?.cancel()
        super.stop()
    }
}

struct ChangeView: View {
    @ObservedObject var model: ChangeContent

    private var p: KitPalette { Theme.palette }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: KitTokens.Space.s7) {
                WorkbenchHostLine(status: model.hostStatus)
                HStack(spacing: KitTokens.Space.s4) {
                    Text("into").font(WorkbenchStyle.ui(KitTokens.TypeScale.sm)).foregroundStyle(p.textFaint.color)
                    WorkbenchTag(text: ProjectHub.shared.displayName(model.projectId), color: WorkbenchStyle.originColor("own"))
                    if let path = model.project?.path {
                        Text(path).font(WorkbenchStyle.code(KitTokens.TypeScale.xs)).foregroundStyle(p.textFaint.color).lineLimit(1).truncationMode(.head)
                    }
                    Spacer(minLength: 0)
                    if model.working { ProgressView().controlSize(.small) }
                }
                if let error = model.error {
                    WorkbenchCard(tint: p.bad.color) {
                        Text(error).font(WorkbenchStyle.ui(KitTokens.TypeScale.sm)).foregroundStyle(p.bad.color).textSelection(.enabled)
                    }
                }
                if let done = model.applied { appliedCard(done) }
                if let change = model.change {
                    ChangePreview(change: change,
                                  applyKey: model.key("lucaChange.apply"),
                                  overwriteKey: model.key("lucaChange.overwrite"),
                                  importsKey: model.request?.op == "copy" ? model.key("lucaChange.imports") : nil,
                                  overwriting: model.request?.overwrite == true,
                                  withImports: model.request?.withImports == true)
                        .opacity(model.applied == nil ? 1 : 0.55)
                } else if model.hostStatus == .running, model.error == nil {
                    ProgressView().controlSize(.small)
                }
            }
            .padding(.horizontal, WorkbenchStyle.Gap.page)
            .padding(.vertical, WorkbenchStyle.Gap.page - KitTokens.Space.s2)
            .frame(maxWidth: WorkbenchStyle.Size.readable + 200, alignment: .leading)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(p.surface.color)
    }

    private func appliedCard(_ done: WorkbenchApplied) -> some View {
        WorkbenchCard(tint: p.good.color) {
            VStack(alignment: .leading, spacing: KitTokens.Space.s4) {
                HStack(spacing: KitTokens.Space.s4) {
                    Image(systemName: "checkmark.seal.fill").foregroundStyle(p.good.color)
                    Text("Written. The host is restarting to load it.")
                        .font(WorkbenchStyle.ui(KitTokens.TypeScale.md, weight: .semibold)).foregroundStyle(p.text.color)
                }
                ForEach(done.written, id: \.self) { path in
                    Text(path).font(WorkbenchStyle.code(KitTokens.TypeScale.xs)).foregroundStyle(p.textBody.color).textSelection(.enabled)
                }
            }
        }
    }
}
