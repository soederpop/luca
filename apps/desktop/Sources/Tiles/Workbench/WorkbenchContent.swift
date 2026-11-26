import SwiftUI
import Combine

/// The base of every workbench tool: a tile at `luca://<project>/<tool>/<id>`.
///
/// It holds its project's host through `ProjectHub` (the shell acquires and
/// releases it) and hands the subclass the host's client as it comes and
/// goes: override `hostChanged(_:)` to load. A new tool is a subclass, a
/// `TileKind` with id `luca-<tool>`, and one line in
/// `TileKinds.registerBuiltIns()`.
@MainActor
class WorkbenchContent: TileContent {
    let projectId: String
    @Published private(set) var hostStatus: HostStatus = .starting
    private(set) var host: WorkbenchClient?
    private var hostWatch: AnyCancellable?

    init(kindId: String, uri: TileURI, title: String) {
        projectId = uri.authority
        super.init(kindId: kindId, uri: uri, owner: ProjectHub.ownerId(uri.authority), title: title)
        stateLabel = HostStatus.starting.label
    }

    var hub: ProjectHub { ProjectHub.shared }
    var project: KnownProject? { hub.project(projectId) }

    /// A workbench tile watches its project's host.
    override func start() {
        hostWatch = WorkbenchHostWatch.watch(projectId) { [weak self] status, client in
            guard let self else { return }
            self.hostStatus = status
            if status != .running { self.stateLabel = status.label }
            if client !== self.host {
                self.host = client
                self.hostChanged(client)
            }
        }
    }

    override func stop() {
        hostWatch = nil
        host = nil
        hostChanged(nil)
        super.stop()
    }

    /// The host's client arrived, or went away (nil).
    func hostChanged(_ client: WorkbenchClient?) {}

    /// Start the project's host again. `R` in every tool by default.
    func restartHost() {
        hub.restart(projectId)
    }
}

/// Watch one project's host: its status, and its client each time a new
/// host comes up. For a tile that cannot subclass `WorkbenchContent` (a
/// card-stack index subclasses `IndexContent`).
@MainActor
enum WorkbenchHostWatch {
    static func watch(_ projectId: String, _ changed: @escaping (HostStatus, WorkbenchClient?) -> Void) -> AnyCancellable {
        let hub = ProjectHub.shared
        return hub.$status.map { $0[projectId] ?? .starting }
            .combineLatest(hub.$clientRevision.map { $0[projectId] ?? 0 })
            .removeDuplicates { $0 == $1 }
            .receive(on: DispatchQueue.main)
            .sink { status, _ in changed(status, hub.client(projectId)) }
    }
}

/// The line a workbench tile shows while its host is not running: starting,
/// or the one-line reason it failed.
struct WorkbenchHostLine: View {
    let status: HostStatus

    var body: some View {
        switch status {
        case .running:
            EmptyView()
        case .starting:
            HStack(spacing: KitTokens.Space.s3) {
                ProgressView().controlSize(.small)
                Text("Starting the workbench host…").foregroundStyle(Color.kitFaint)
            }
            .font(WorkbenchStyle.body)
        case .stopped:
            Text("Host stopped").font(WorkbenchStyle.body).foregroundStyle(Color.kitFaint)
        case .failed(let line):
            Text(line)
                .font(WorkbenchStyle.body)
                .foregroundStyle(Theme.palette.bad.color)
                .lineLimit(2)
                .textSelection(.enabled)
        }
    }
}
