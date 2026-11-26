import Foundation
import Combine

/// `GET /project`: what the project tile draws.
struct WorkbenchProject: Decodable, Equatable {
    struct Registry: Decodable, Equatable, Identifiable {
        let name: String
        let count: Int
        var id: String { name }
    }

    let name: String
    let cwd: String
    let lucaVersion: String
    let registries: [Registry]
}

/// `GET /registries`: the registry tile's card stacks, one per registry.
/// `address` is the card's tile after `luca://<project>/`.
struct WorkbenchStacks: Decodable, Equatable {
    struct Card: Decodable, Equatable {
        let id: String
        let title: String
        let subtitle: String
        let preview: String
        let badge: String?
        let address: String
        /// Where the helper comes from. Older hosts do not send it.
        var origin: WorkbenchOrigin? = nil
    }

    struct Stack: Decodable, Equatable {
        let id: String
        let title: String
        let cards: [Card]
    }

    let stacks: [Stack]
}

/// One row of a schema table: an option, a state key, a getter, a parameter.
struct WorkbenchField: Decodable, Equatable, Identifiable {
    let name: String
    let type: String
    let description: String
    let required: Bool?
    var id: String { name }
}

/// `GET /helper/<registry>/<id>`: what the inspector draws, as the host shapes it.
struct WorkbenchHelper: Decodable, Equatable {
    struct Method: Decodable, Equatable, Identifiable {
        let name: String
        let signature: String
        let description: String
        let params: [WorkbenchField]
        /// The return type as the host writes it (`Promise<string>`).
        var returns: String?
        let argsHint: String
        /// False: call at once, no argument prompt.
        let askArgs: Bool
        var id: String { name }
    }

    let registry: String
    let id: String
    let title: String
    let summary: String
    let markdown: String
    let events: [String]
    let live: Bool
    let stateText: String?
    let liveNote: String?
    let callable: Bool
    let optionFields: [WorkbenchField]
    let stateFields: [WorkbenchField]
    let getters: [WorkbenchField]
    let methods: [Method]
    var origin: WorkbenchOrigin? = nil
}

/// `POST /helper/<registry>/<id>/call`. `text` is the result to draw.
struct WorkbenchCallResult: Decodable, Equatable {
    let ok: Bool
    let call: String?
    let text: String?
    let type: String?
    let error: String?
    let ms: Int?
    let created: Bool?
}

/// One frame from the host socket (`/ws`): `hello`, `subscribed`, `state`,
/// `event`, and for command runs `run-start`, `run-output`, `run-exit`.
/// Fields a type does not use are nil. `text` is the state, the event's
/// arguments, a chunk of output or the exit line, as the host shapes them
/// for display; `at` is milliseconds since 1970.
struct WorkbenchEvent: Decodable, Equatable {
    let type: String
    let registry: String?
    let id: String?
    let name: String?
    let state: JSONValue?
    let args: JSONValue?
    let live: Bool?
    var text: String? = nil
    var at: Double? = nil
    var runId: String? = nil
    /// `stdout`, `stderr` or `note` on `run-output`.
    var stream: String? = nil
    var seq: Int? = nil
    var code: Int? = nil
    var stopped: Bool? = nil
    var display: String? = nil
    /// The serve child's state on a `serve` frame.
    var serve: WorkbenchServe? = nil
    /// Chat frames (`chat-start`, `chat-delta`, `chat-tool`, `chat-done`,
    /// `chat-error`): which conversation and turn. `text` is the user's
    /// message, the next piece of the reply, or the whole reply.
    var assistant: String? = nil
    var conversationId: String? = nil
    var turnId: String? = nil
    var tool: WorkbenchChatTool? = nil
    var aborted: Bool? = nil
    var error: String? = nil
    var ms: Double? = nil
    /// `chat-extensions`: the conversation's new list of added tools.
    var extensions: [WorkbenchChatExtension]? = nil
    /// `chat-settings`: the conversation's own settings, where the next turn
    /// goes, its model text and its title. `chat-reasoning` carries `text`.
    var settings: WorkbenchChatSettings? = nil
    var routing: WorkbenchChatRouting? = nil
    var modelText: String? = nil
    var title: String? = nil
    /// `chat-history`: the saved messages after a retry or a clear.
    var messages: [WorkbenchChatMessage]? = nil
    /// `canvas-snapshot`: the request to answer with `POST /canvases/<id>/snapshot`.
    var requestId: String? = nil
}

/// A canvas on the host (`GET /canvases/<id>`). `url` holds the page's key.
struct WorkbenchCanvas: Decodable, Equatable {
    let id: String
    let title: String
    let open: Bool
    let evals: Int
    let url: String

    /// The page key, from `url`.
    var key: String? { URLComponents(string: url)?.queryItems?.first(where: { $0.name == "key" })?.value }
}

/// One node of a console result, as the host shapes it: a leaf's value, or
/// a container's one-line preview and its children. `open` says to show it
/// open at first.
struct WorkbenchTreeNode: Decodable, Equatable {
    let key: String?
    let type: String
    let text: String
    let children: [WorkbenchTreeNode]?
    let more: Int?
    let open: Bool?
}

/// `POST /console`: one console entry's answer.
struct WorkbenchConsoleAnswer: Decodable, Equatable {
    struct Log: Decodable, Equatable {
        let level: String
        let text: String
    }

    let ok: Bool
    let entry: Int?
    let input: String?
    let type: String?
    let text: String?
    let tree: WorkbenchTreeNode?
    let logs: [Log]?
    let ms: Int?
    let error: String?
    let name: String?
    let stack: String?
    let hint: String?
    /// The docs of a `?name` entry, or of a helper that was the result.
    var doc: WorkbenchDocCard? = nil
}

/// The docs of one name, as the host shapes them: a method, a getter, a
/// helper with its members, a plain value. Drawn by `DocCardView`.
struct WorkbenchDocCard: Decodable, Equatable {
    struct Param: Decodable, Equatable {
        let name: String
        let type: String
        let description: String
        var required: Bool? = nil
    }
    struct Member: Decodable, Equatable {
        let name: String
        let kind: String
        let detail: String
        let summary: String
    }
    struct Owner: Decodable, Equatable {
        let registry: String
        let id: String
        let title: String
        /// `helper/features/fs`: the tile that shows all of it.
        let address: String
    }

    let title: String
    let kind: String
    var signature: String? = nil
    let summary: String
    var params: [Param]? = nil
    var returns: String? = nil
    var examples: [String]? = nil
    var owner: Owner? = nil
    var members: [Member]? = nil
    var value: String? = nil
    var type: String? = nil
    var documented: Bool? = nil
}

/// `GET /ai`: the project's AI environment, as the host reads it from Luca.
struct WorkbenchAi: Decodable, Equatable {
    struct Provider: Decodable, Equatable, Identifiable {
        let id: String
        let label: String
        let apiMode: String
        let model: String
        let baseURL: String
        /// `ready`, `needs key`, `no server`, `login`, `unknown`.
        let status: String
        let statusText: String
        /// `machine`, `project` or `built in`.
        let source: String
        let isDefault: Bool
    }
    struct Key: Decodable, Equatable, Identifiable {
        let env: String
        let label: String
        let set: Bool
        let `where`: String?
        let providers: [String]
        var id: String { env }
    }
    struct Check: Decodable, Equatable, Identifiable {
        let id: String
        let label: String
        let ok: Bool
        let detail: String
        /// The command that puts it in place: `luca setup --chat-model`.
        let fix: String?
    }
    struct Agent: Decodable, Equatable, Identifiable {
        let id: String
        let label: String
        let available: Bool
        let version: String
        let path: String
        let detail: String
    }
    struct Server: Decodable, Equatable, Identifiable {
        let baseURL: String
        let host: String
        let port: Int
        let title: String
        let source: String
        let models: [String]
        let latencyMs: Int
        let profileId: String?
        var id: String { baseURL }
    }
    struct ConfigFile: Decodable, Equatable, Identifiable {
        let kind: String
        let path: String
        let display: String
        let exists: Bool
        let providers: [String]
        var id: String { kind }
    }

    let defaultProvider: String?
    let defaultText: String
    let providers: [Provider]
    let keys: [Key]
    let local: [Check]
    let agents: [Agent]
    let servers: [Server]
    let scannedAt: Double?
    let configFiles: [ConfigFile]
    let envWarning: String?
}

/// The answer to a write in the AI tile: what changed, and the new view.
struct WorkbenchAiChange: Decodable, Equatable {
    var added: [String] = []
    let file: String
    let view: WorkbenchAi

    private enum CodingKeys: String, CodingKey { case added, file, view }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        added = try c.decodeIfPresent([String].self, forKey: .added) ?? []
        file = try c.decode(String.self, forKey: .file)
        view = try c.decode(WorkbenchAi.self, forKey: .view)
    }
}

/// `POST /prompt/targets`: what `luca prompt` can run a file with.
struct WorkbenchPromptTargets: Decodable, Equatable {
    struct Target: Decodable, Equatable {
        let id: String
        let label: String
        /// `assistant` or `agent`.
        let kind: String
        let detail: String
        let available: Bool
    }

    /// The file to pass, from the project folder.
    let file: String
    let defaultTarget: String
    let targets: [Target]
}

/// `GET /servers`: the servers of the registry and the instances that run.
struct WorkbenchServers: Decodable, Equatable {
    struct Option: Decodable, Equatable {
        let name: String
        let type: String
        let description: String
    }
    struct Kind: Decodable, Equatable {
        let id: String
        let title: String
        let summary: String
        let options: [Option]
        /// How to type the options, for the start prompt.
        let optionsHint: String
        let address: String
        let running: Int
        var origin: WorkbenchOrigin? = nil
    }
    struct Pair: Decodable, Equatable {
        let name: String
        let value: String
    }
    struct Instance: Decodable, Equatable {
        let key: String
        let id: String
        /// `express :3000`.
        let title: String
        /// `starting`, `listening`, `stopped`, `failed`.
        let status: String
        let port: Int?
        let host: String?
        let url: String?
        /// `workbench` (started from the tile) or `project` (the project's own code).
        let by: String
        let optionsText: String
        let state: [Pair]
        let error: String?
    }

    let kinds: [Kind]
    let instances: [Instance]
    /// `2 listening`, for the tile's title bar.
    let text: String
}

/// `POST /console/complete`: what the host knows at the caret.
struct WorkbenchCompletion: Decodable, Equatable {
    struct Item: Decodable, Equatable {
        let label: String
        let kind: String
        let detail: String
        let insert: String
        let doc: WorkbenchDocCard
    }
    struct Signature: Decodable, Equatable {
        let doc: WorkbenchDocCard
        let active: Int
    }

    /// The UTF-16 range of the input an accepted item replaces.
    let from: Int
    let to: Int
    let items: [Item]
    var signature: Signature? = nil
    /// The docs of the name the caret is on.
    var hover: WorkbenchDocCard? = nil
}

/// One field of a command's form (`GET /command/<id>`). The host reads the
/// command's `argsSchema` and `positionals`; `extra` is the free text of
/// more arguments.
struct WorkbenchCommandField: Decodable, Equatable, Identifiable {
    let name: String
    let flag: String
    let type: String
    let options: [String]?
    let `default`: String?
    let description: String
    let required: Bool
    let positional: Bool
    let position: Int?
    let extra: Bool?
    var id: String { name }
}

/// `GET /command/<id>`: what the command tile's form draws.
struct WorkbenchCommandForm: Decodable, Equatable {
    struct Example: Decodable, Equatable {
        let command: String
        let description: String
    }

    let id: String
    let title: String
    let summary: String
    let badge: String?
    let usage: String
    let fields: [WorkbenchCommandField]
    let examples: [Example]
    var origin: WorkbenchOrigin? = nil
}

/// One chunk of a run's output.
struct WorkbenchRunChunk: Decodable, Equatable {
    let seq: Int
    let stream: String
    let text: String
}

/// `POST /command/<id>/run` and `GET /runs/<runId>`: a run as the host keeps it.
struct WorkbenchRun: Decodable, Equatable {
    let runId: String
    let command: String
    let display: String
    let status: String
    let code: Int?
    let signal: String?
    let stopped: Bool
    /// `exit 0 · 1.2 s`, or `running`.
    let statusText: String
    let ms: Int
    let chunks: [WorkbenchRunChunk]
    let dropped: Int
}

/// The project's `luca serve` child, as the host keeps it (`GET /serve`,
/// `serve` frames). `text` is the line to show: `running on :3101`.
struct WorkbenchServe: Decodable, Equatable {
    /// `stopped`, `starting`, `running` or `failed`.
    let status: String
    let port: Int?
    let url: String?
    /// Its run: the log is `GET /runs/<runId>` and the run frames.
    let runId: String?
    let text: String
    let error: String?

    static let unknown = WorkbenchServe(status: "stopped", port: nil, url: nil, runId: nil, text: "stopped", error: nil)
}

/// One input of a request form: a path param, a query param or a body field.
struct WorkbenchRequestField: Decodable, Equatable, Identifiable {
    let name: String
    /// `path`, `query` or `body`.
    let `in`: String
    /// string, number, integer, boolean, enum, array, object.
    let type: String
    let required: Bool
    let description: String
    let `default`: String?
    let options: [String]?
    var id: String { `in` + ":" + name }
}

/// One route of the project's `endpoints/` (`GET /endpoints`).
struct WorkbenchRoute: Decodable, Equatable, Identifiable {
    /// `GET /users/:id`
    let id: String
    let method: String
    let path: String
    let openapiPath: String
    let summary: String
    let tags: [String]
    let file: String
    /// The request tile after `luca://<project>/`.
    let address: String
    let fields: [WorkbenchRequestField]
    let body: Bool
    let upload: Bool
    let rateLimit: String?
}

/// `GET /endpoints`: the endpoints tile, as the host shapes it.
struct WorkbenchEndpoints: Decodable, Equatable {
    struct Group: Decodable, Equatable, Identifiable {
        let tag: String
        let routes: [WorkbenchRoute]
        var id: String { tag }
    }

    struct LoadError: Decodable, Equatable, Identifiable {
        let file: String
        let error: String
        var id: String { file }
    }

    let dir: String?
    let dirDisplay: String?
    /// One line when there is nothing to list.
    let notice: String?
    let count: Int
    let groups: [Group]
    let errors: [LoadError]
    let server: WorkbenchServe
}

/// `GET /endpoints/route`: one route and the server's state.
struct WorkbenchRouteAnswer: Decodable, Equatable {
    let route: WorkbenchRoute
    let server: WorkbenchServe
}

/// `POST /endpoints/request`: the response as the host shapes it, or why
/// nothing was sent (`notRunning`, `missing`).
struct WorkbenchResponse: Decodable, Equatable {
    struct Header: Decodable, Equatable {
        let name: String
        let value: String
    }

    let ok: Bool
    let error: String?
    let notRunning: Bool?
    let missing: [String]?
    let method: String?
    let url: String?
    let status: Int?
    let statusText: String?
    /// `2xx` … `5xx`.
    let statusClass: String?
    let ms: Int?
    let headers: [Header]?
    let contentType: String?
    /// `json`, `text` or `empty`.
    let bodyKind: String?
    let text: String?
    let tree: WorkbenchTreeNode?
    let size: Int?
    let sizeText: String?
    /// The JSON body sent, pretty.
    let sent: String?
}

/// A form value the command tile sends: text, or a switch.
enum WorkbenchFormValue: Encodable, Equatable {
    case text(String)
    case flag(Bool)

    func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self {
        case .text(let s): try c.encode(s)
        case .flag(let b): try c.encode(b)
        }
    }
}

enum WorkbenchError: LocalizedError {
    case http(Int, String)
    case badResponse
    /// The project's host is not up (yet).
    case notRunning

    var errorDescription: String? {
        switch self {
        case .notRunning: return "The workbench host is not running"
        case let .http(status, message): return message.isEmpty ? "host answered \(status)" : "host answered \(status): \(message)"
        case .badResponse: return "host sent no HTTP response"
        }
    }
}

/// The HTTP and socket client for one project's host on 127.0.0.1. Every
/// request carries the host's token. Later tools add a method here per
/// route, and decode the host's shape as is.
final class WorkbenchClient: @unchecked Sendable {
    let port: Int
    let token: String
    /// Socket frames, delivered on the main queue.
    let events = PassthroughSubject<WorkbenchEvent, Never>()

    private let session: URLSession
    private var socket: URLSessionWebSocketTask?
    private let lock = NSLock()
    private var closed = false

    init(_ info: HostHandshake.Info) {
        port = info.port
        token = info.token
        let config = URLSessionConfiguration.ephemeral
        config.timeoutIntervalForRequest = 60
        config.connectionProxyDictionary = [:]
        session = URLSession(configuration: config)
    }

    var baseURL: URL { URL(string: "http://127.0.0.1:\(port)")! }

    /// `/helper/features/fs`, each part escaped.
    static func path(_ parts: String...) -> String {
        "/" + parts.map { $0.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed.subtracting(CharacterSet(charactersIn: "/"))) ?? $0 }
            .joined(separator: "/")
    }

    func request(_ method: String, _ path: String, body: Data? = nil) async throws -> Data {
        var request = URLRequest(url: URL(string: path, relativeTo: baseURL)!)
        request.httpMethod = method
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        if let body {
            request.httpBody = body
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw WorkbenchError.badResponse }
        guard (200..<300).contains(http.statusCode) else {
            let message = ((try? JSONSerialization.jsonObject(with: data)) as? [String: Any])?["error"] as? String
            throw WorkbenchError.http(http.statusCode, message ?? "")
        }
        return data
    }

    func get<T: Decodable>(_ path: String, as type: T.Type = T.self) async throws -> T {
        try JSONDecoder().decode(T.self, from: try await request("GET", path))
    }

    func post<T: Decodable, B: Encodable>(_ path: String, _ body: B, as type: T.Type = T.self) async throws -> T {
        try JSONDecoder().decode(T.self, from: try await request("POST", path, body: try JSONEncoder().encode(body)))
    }

    func project() async throws -> WorkbenchProject {
        try await get("/project")
    }

    func registries() async throws -> WorkbenchStacks {
        try await get("/registries")
    }

    func helper(registry: String, id: String) async throws -> WorkbenchHelper {
        try await get(Self.path("helper", registry, id))
    }

    /// Call a method. `args` is the text the user typed; the host reads it.
    func call(registry: String, id: String, method: String, args: String) async throws -> WorkbenchCallResult {
        try await post(Self.path("helper", registry, id, "call"), ["method": method, "args": args])
    }

    // MARK: AI

    func ai() async throws -> WorkbenchAi { try await get("/ai") }
    func aiDiscover() async throws -> WorkbenchAi { try await post("/ai/discover", [String: String]()) }
    func aiCheckAgents() async throws -> WorkbenchAi { try await post("/ai/agents", [String: String]()) }

    func aiAddServer(baseURL: String, target: String, model: String?) async throws -> WorkbenchAiChange {
        var body = ["baseURL": baseURL, "target": target]
        if let model { body["model"] = model }
        return try await post("/ai/providers/add", body)
    }

    /// The key goes to the host once, over localhost. The answer never has it.
    func aiSetKey(env: String, value: String) async throws -> WorkbenchAiChange {
        try await post("/ai/key", ["env": env, "value": value])
    }

    func promptTargets(doc: String?, file: String?) async throws -> WorkbenchPromptTargets {
        var body: [String: String] = [:]
        if let doc { body["doc"] = doc }
        if let file { body["file"] = file }
        return try await post("/prompt/targets", body)
    }

    // MARK: Canvases

    func canvas(_ id: String) async throws -> WorkbenchCanvas {
        try await get(Self.path("canvases", id))
    }

    /// Make a canvas without asking the app to open it (this tile is it).
    func createCanvas(id: String, title: String) async throws -> WorkbenchCanvas {
        struct Body: Encodable { let id: String; let title: String; let open: Bool }
        struct Answer: Decodable { let canvas: WorkbenchCanvas }
        let answer: Answer = try await post("/canvases", Body(id: id, title: title, open: false))
        return answer.canvas
    }

    /// The answer to a `canvas-snapshot` frame: the PNG, or an error so the host asks the page at once.
    func answerCanvasSnapshot(_ id: String, requestId: String, png: Data?, width: Int, height: Int) async throws {
        struct Body: Encodable { let requestId: String; let png: String?; let width: Int; let height: Int; let error: String? }
        let body = Body(requestId: requestId, png: png?.base64EncodedString(), width: width, height: height, error: png == nil ? "the tile is not on screen" : nil)
        _ = try await request("POST", Self.path("canvases", id, "snapshot"), body: try JSONEncoder().encode(body))
    }

    // MARK: Servers

    func servers() async throws -> WorkbenchServers {
        try await get("/servers")
    }

    /// Start a server of the registry. `options` is the text the user typed; the host reads it.
    func startServer(_ id: String, options: String) async throws -> WorkbenchServers.Instance {
        struct Answer: Decodable { let instance: WorkbenchServers.Instance }
        let answer: Answer = try await post("/servers/start", ["id": id, "options": options])
        return answer.instance
    }

    func stopServer(_ key: String) async throws {
        _ = try await request("POST", Self.path("servers", key, "stop"), body: Data("{}".utf8))
    }

    // MARK: Console

    /// One console entry. Entries of a session share their names.
    func console(_ code: String, session: String = "default") async throws -> WorkbenchConsoleAnswer {
        try await post("/console", ["code": code, "session": session])
    }

    /// Completions, the signature and the docs at `cursor` (a UTF-16 offset).
    func complete(_ code: String, cursor: Int, session: String = "default") async throws -> WorkbenchCompletion {
        struct Body: Encodable { let code: String; let cursor: Int; let session: String }
        return try await post("/console/complete", Body(code: code, cursor: cursor, session: session))
    }

    /// The docs of a name in the session, or of a helper by id (`features.fs.readFile`).
    func describe(_ target: String, session: String = "default") async throws -> WorkbenchDocCard {
        struct Answer: Decodable { let doc: WorkbenchDocCard }
        let answer: Answer = try await post("/console/describe", ["target": target, "session": session])
        return answer.doc
    }

    /// Drop a console session's names.
    func resetConsole(session: String = "default") async throws {
        _ = try await request("POST", "/console/reset", body: try JSONEncoder().encode(["session": session]))
    }

    // MARK: Commands

    func command(_ id: String) async throws -> WorkbenchCommandForm {
        try await get(Self.path("command", id))
    }

    /// Start a run. The host builds the command line from the values.
    func run(command id: String, values: [String: WorkbenchFormValue]) async throws -> WorkbenchRun {
        struct Body: Encodable { let values: [String: WorkbenchFormValue] }
        return try await post(Self.path("command", id, "run"), Body(values: values))
    }

    func run(_ runId: String) async throws -> WorkbenchRun {
        try await get(Self.path("runs", runId))
    }

    func stop(run runId: String) async throws {
        _ = try await request("POST", Self.path("runs", runId, "stop"), body: Data("{}".utf8))
    }

    // MARK: Endpoints

    func endpoints() async throws -> WorkbenchEndpoints {
        try await get("/endpoints")
    }

    func route(method: String, path: String) async throws -> WorkbenchRouteAnswer {
        var c = URLComponents()
        c.path = "/endpoints/route"
        c.queryItems = [URLQueryItem(name: "method", value: method), URLQueryItem(name: "path", value: path)]
        return try await get(c.string ?? "/endpoints/route")
    }

    /// Send one request through the host to the serve child. `values` are
    /// the texts typed; a non-empty `body` is sent as is instead of the body fields.
    func send(method: String, path: String, values: [String: String], body: String?) async throws -> WorkbenchResponse {
        struct Body: Encodable { let method: String; let path: String; let values: [String: String]; let body: String? }
        return try await post("/endpoints/request", Body(method: method, path: path, values: values, body: body))
    }

    func serve() async throws -> WorkbenchServe {
        try await get("/serve")
    }

    func startServe() async throws -> WorkbenchServe {
        try await post("/serve/start", [String: String]())
    }

    func stopServe() async throws -> WorkbenchServe {
        try await post("/serve/stop", [String: String]())
    }

    // MARK: Socket

    /// Open `/ws` once. Frames go to `events`. The host dies with its
    /// project, so there is no reconnect.
    func connect() {
        lock.lock()
        defer { lock.unlock() }
        guard socket == nil, !closed else { return }
        var request = URLRequest(url: URL(string: "ws://127.0.0.1:\(port)/ws")!)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        let task = session.webSocketTask(with: request)
        socket = task
        task.resume()
        receive(task)
    }

    /// Ask for a helper's `state` and `event` frames.
    func subscribe(registry: String, id: String) {
        connect()
        let text = (try? JSONSerialization.data(withJSONObject: ["type": "subscribe", "registry": registry, "id": id]))
            .flatMap { String(data: $0, encoding: .utf8) } ?? ""
        lock.lock()
        let task = socket
        lock.unlock()
        task?.send(.string(text)) { _ in }
    }

    private func receive(_ task: URLSessionWebSocketTask) {
        task.receive { [weak self] result in
            guard let self else { return }
            switch result {
            case .failure:
                self.lock.lock()
                if self.socket === task { self.socket = nil }
                self.lock.unlock()
            case .success(let message):
                let data: Data?
                switch message {
                case .string(let text): data = text.data(using: .utf8)
                case .data(let bytes): data = bytes
                @unknown default: data = nil
                }
                if let data, let event = try? JSONDecoder().decode(WorkbenchEvent.self, from: data) {
                    DispatchQueue.main.async { self.events.send(event) }
                }
                self.receive(task)
            }
        }
    }

    func close() {
        lock.lock()
        closed = true
        let task = socket
        socket = nil
        lock.unlock()
        task?.cancel(with: .goingAway, reason: nil)
        session.invalidateAndCancel()
    }
}
