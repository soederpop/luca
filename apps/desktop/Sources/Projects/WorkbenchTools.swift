import Foundation
import Combine

// A project's own tools, as the host shapes them. A project or a
// plugin it loads declares them in `workbench/`; the host reads the files,
// runs `data()` and actions, and sends display-ready shapes.

/// One key a tool declares for an action.
struct WorkbenchToolKey: Decodable, Equatable {
    let action: String
    let key: String
    let label: String
}

/// One tool in `GET /tools`.
struct WorkbenchToolInfo: Decodable, Equatable, Identifiable {
    let id: String
    let title: String
    let hint: String
    /// An SF Symbol the author picked, or nil for the default mark.
    let glyph: String?
    /// `page` or `view`.
    let kind: String
    let renderer: String?
    let page: String?
    /// The tile after `luca://<project>/`: `tool/<id>` or `page/<path>`.
    let address: String
    let origin: WorkbenchOrigin
    let fileDisplay: String
    let keys: [WorkbenchToolKey]

    /// The tile this tool opens in its project.
    func uri(project: String) -> TileURI? {
        TileURI(TileURI.lucaScheme + project + "/" + address)
    }
}

/// A declaration the host could not use: the file and why.
struct WorkbenchToolError: Decodable, Equatable, Identifiable {
    let file: String
    let fileDisplay: String
    let id: String?
    let origin: WorkbenchOrigin
    let error: String

    var rowId: String { fileDisplay + "#" + (id ?? "") }
}

/// `GET /tools`.
struct WorkbenchTools: Decodable, Equatable {
    let notice: String?
    let count: Int
    let tools: [WorkbenchToolInfo]
    let errors: [WorkbenchToolError]
}

/// `GET /tools/<id>`: the data, shaped for one renderer. `ok: false` carries
/// a readable `error` (a throwing `data()`, a bad shape, a broken file).
struct WorkbenchToolData: Decodable, Equatable {
    struct Card: Decodable, Equatable {
        let id: String
        let title: String
        let subtitle: String?
        let preview: String?
        let badge: String?
        let tone: String?
        /// `luca://…`, or a path after `luca://<project>/`. Nil: nothing to open.
        let address: String?
    }
    struct Stack: Decodable, Equatable {
        let id: String
        let title: String
        let tone: String?
        let count: Int
        let cards: [Card]
    }

    let ok: Bool
    let id: String
    var title: String? = nil
    var hint: String? = nil
    var origin: WorkbenchOrigin? = nil
    var fileDisplay: String? = nil
    var keys: [WorkbenchToolKey]? = nil
    var kind: String? = nil
    /// `stacks`, `tree` or `markdown` (a `table` comes as markdown).
    var renderer: String? = nil
    var stacks: [Stack]? = nil
    var tree: WorkbenchTreeNode? = nil
    var markdown: String? = nil
    var notice: String? = nil
    var error: String? = nil
    var ms: Int? = nil
}

/// One palette step an action asks for, or its end.
struct WorkbenchActionAnswer: Decodable, Equatable {
    struct Step: Decodable, Equatable {
        struct Item: Decodable, Equatable {
            let title: String
            let detail: String
        }
        /// `choose`, `ask` or `confirm`.
        let kind: String
        var title: String? = nil
        var items: [Item]? = nil
        var initial: String? = nil
        var question: String? = nil
        var yes: String? = nil
    }
    struct Result: Decodable, Equatable {
        let flash: String?
        let reload: Bool
        let open: String?
    }

    let ok: Bool
    var done: Bool? = nil
    var cancelled: Bool? = nil
    var token: String? = nil
    var step: Step? = nil
    var result: Result? = nil
    var error: String? = nil
}

/// The card an action is about: its stack and id. The host hands the
/// action the author's own card object for it.
struct WorkbenchActionTarget: Encodable, Equatable {
    let stack: String
    let card: String
}

extension WorkbenchClient {
    func tools() async throws -> WorkbenchTools {
        try await get("/tools")
    }

    func toolData(_ id: String, params: [TileURI.Option]) async throws -> WorkbenchToolData {
        var c = URLComponents()
        c.queryItems = params.map { URLQueryItem(name: $0.name, value: $0.value) }
        let query = params.isEmpty ? "" : "?" + (c.percentEncodedQuery ?? "")
        return try await get(Self.path("tools", id) + query)
    }

    func startAction(tool: String, action: String, params: [TileURI.Option], target: WorkbenchActionTarget?) async throws -> WorkbenchActionAnswer {
        struct Body: Encodable { let params: [String: String]; let target: WorkbenchActionTarget? }
        let dict = Dictionary(params.map { ($0.name, $0.value) }, uniquingKeysWith: { a, _ in a })
        return try await post(Self.path("tools", tool, "actions", action), Body(params: dict, target: target))
    }

    /// The answer to a step: a row index, the typed text, true or false.
    func answerAction(token: String, value: WorkbenchStepValue) async throws -> WorkbenchActionAnswer {
        struct Body: Encodable { let value: WorkbenchStepValue }
        return try await post(Self.path("tools", "actions", token, "answer"), Body(value: value))
    }

    func cancelAction(token: String) async throws -> WorkbenchActionAnswer {
        struct Empty: Encodable {}
        return try await post(Self.path("tools", "actions", token, "cancel"), Empty())
    }
}

/// What a palette step answers.
enum WorkbenchStepValue: Encodable, Equatable {
    case index(Int)
    case text(String)
    case yes(Bool)

    func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self {
        case .index(let i): try c.encode(i)
        case .text(let t): try c.encode(t)
        case .yes(let b): try c.encode(b)
        }
    }
}

/// The declared tools of each open project, as the host last sent them.
/// The overview, the palette and `Space w` read it. It refreshes when a
/// project's host comes up, and on `refresh` (a reload in a tool tile).
@MainActor
final class ProjectToolsStore: ObservableObject {
    static let shared = ProjectToolsStore()

    @Published private(set) var lists: [String: WorkbenchTools] = [:]
    @Published private(set) var errors: [String: String] = [:]
    private var watch: AnyCancellable?
    private var seen: [String: Int] = [:]
    private var tasks: [String: Task<Void, Never>] = [:]

    func start() {
        guard watch == nil else { return }
        watch = ProjectHub.shared.$clientRevision
            .receive(on: DispatchQueue.main)
            .sink { [weak self] revisions in
                guard let self else { return }
                for (project, revision) in revisions where self.seen[project] != revision {
                    self.seen[project] = revision
                    self.refresh(project)
                }
            }
    }

    func tools(_ project: String) -> [WorkbenchToolInfo] { lists[project]?.tools ?? [] }

    func refresh(_ project: String) {
        guard let client = ProjectHub.shared.client(project) else { return }
        tasks[project]?.cancel()
        tasks[project] = Task { [weak self] in
            do {
                let list = try await client.tools()
                guard !Task.isCancelled else { return }
                self?.lists[project] = list
                self?.errors[project] = nil
            } catch {
                guard !Task.isCancelled else { return }
                self?.errors[project] = ErrorText.message(error)
            }
        }
    }
}
