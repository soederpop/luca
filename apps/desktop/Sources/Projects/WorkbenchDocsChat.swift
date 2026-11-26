import Foundation

// The host's shapes for docs, models, assistants and chat, decoded
// as sent. The host does the display work: titles, previews, field kinds,
// color slots, tool call text.

/// `GET /docs`: one stack per model, in the models file's order, `Base`
/// last as `Other`. `notice` when the project has no collection.
struct WorkbenchDocs: Decodable, Equatable {
    struct Card: Decodable, Equatable {
        let id: String
        let title: String
        let subtitle: String
        let preview: String
        let badge: String
        let address: String
    }
    struct Stack: Decodable, Equatable {
        let id: String
        let title: String
        /// The model's color slot; -1 for `Base`.
        let slot: Int
        let count: Int
        let cards: [Card]
    }
    let rootDisplay: String
    let notice: String?
    let error: String?
    let count: Int
    let stacks: [Stack]
}

/// One frontmatter field of a model (`GET /docs/models`).
struct WorkbenchModelField: Decodable, Equatable, Identifiable {
    let name: String
    /// string, number, boolean, enum, array, date, object or value.
    let kind: String
    let typeText: String
    let required: Bool
    let `default`: String?
    let description: String?
    let options: [String]
    var id: String { name }
}

struct WorkbenchModel: Decodable, Equatable, Identifiable {
    let name: String
    let prefix: String
    let description: String
    let count: Int
    let slot: Int
    let fields: [WorkbenchModelField]
    let sections: [String]
    let relationships: [String]
    var id: String { name }
}

struct WorkbenchModels: Decodable, Equatable {
    let rootDisplay: String
    let notice: String?
    let error: String?
    let models: [WorkbenchModel]
}

/// `GET /docs/item`: the exact file, its digest (for the save), and the
/// frontmatter as fields in the model's order, then any the model does not name.
struct WorkbenchDoc: Decodable, Equatable {
    struct Field: Decodable, Equatable, Identifiable {
        let name: String
        let kind: String
        let typeText: String
        /// Nil when the doc does not set it.
        let value: String?
        let items: [String]
        let extra: Bool
        let required: Bool
        let description: String?
        var id: String { name }
    }
    let id: String
    let model: String
    let slot: Int
    let title: String
    let path: String
    let pathDisplay: String
    let file: String
    let digest: String
    let size: Int
    let sizeText: String
    let fields: [Field]
}

/// `POST /docs/save`. A 409 carries `view` with the file as it is now.
struct WorkbenchDocSaved: Decodable, Equatable {
    let ok: Bool?
    let unchanged: Bool?
    let view: WorkbenchDoc?
    let text: String?
    let error: String?
}

/// A past conversation, from `conversationHistory`.
struct WorkbenchConversation: Decodable, Equatable, Identifiable {
    let conversationId: String
    let thread: String
    let assistant: String
    let title: String
    let messageCount: Int
    let updatedAt: String
    let updatedText: String
    var id: String { assistant + "|" + conversationId }
}

/// `GET /assistants`.
struct WorkbenchAssistants: Decodable, Equatable {
    struct Assistant: Decodable, Equatable, Identifiable {
        let id: String
        let name: String
        let description: String
        let model: String?
        let provider: String?
        let modelText: String
        let toolCount: Int
        let tools: [String]
        let source: String?
        let folderDisplay: String
        let conversationCount: Int
        let lastText: String
        let slot: Int
        let error: String?
    }
    let notice: String?
    let historyDir: String
    let assistants: [Assistant]
    let recent: [WorkbenchConversation]
}

struct WorkbenchConversations: Decodable, Equatable {
    let assistant: String
    let conversations: [WorkbenchConversation]
}

/// One tool call as the host shapes it: the arguments and the result as text.
struct WorkbenchChatTool: Decodable, Equatable, Identifiable {
    let id: String
    let name: String
    let argsText: String
    /// running, done or failed.
    let status: String
    let resultText: String?
    let ms: Int?
}

struct WorkbenchChatMessage: Decodable, Equatable, Identifiable {
    let id: String
    /// user or assistant.
    let role: String
    let text: String
    let tools: [WorkbenchChatTool]
    var aborted: Bool? = nil
    /// What the model thought on the way, as streamed. The host never saves
    /// it, so only turns this tile saw have it.
    var reasoning: String? = nil
}

/// A conversation's own provider, model and effort (`settings`), and where
/// the next turn goes with them (`routing`). Empty means the assistant's own.
struct WorkbenchChatSettings: Codable, Equatable {
    var provider: String? = nil
    var model: String? = nil
    var reasoningEffort: String? = nil

    var isEmpty: Bool { (provider ?? "").isEmpty && (model ?? "").isEmpty && (reasoningEffort ?? "").isEmpty }
}

struct WorkbenchChatRouting: Codable, Equatable {
    var provider: String
    var model: String
    var reasoningEffort: String
}

/// `GET /chat/models`: the picker's rows.
struct WorkbenchChatModels: Decodable, Equatable {
    struct Own: Decodable, Equatable { let provider: String; let model: String; let text: String }
    struct Choice: Decodable, Equatable {
        let provider: String
        let model: String
        let title: String
        let detail: String
        let ready: Bool
    }
    let settings: WorkbenchChatSettings
    let routing: WorkbenchChatRouting
    let own: Own
    let efforts: [String]
    let choices: [Choice]
}

/// `GET /chat/export`: the conversation as a markdown file.
struct WorkbenchChatExport: Decodable, Equatable {
    let title: String
    let filename: String
    let markdown: String
}

struct WorkbenchChatDeleted: Decodable, Equatable {
    let ok: Bool?
    var error: String? = nil
}

/// `POST /chat/open`: the conversation as saved, and the reply in flight if any.
struct WorkbenchChatView: Decodable, Equatable {
    struct Live: Decodable, Equatable {
        let turnId: String
        let user: String
        let text: String
        let tools: [WorkbenchChatTool]
        var reasoning: String? = nil
    }
    let ok: Bool?
    let error: String?
    let assistant: String?
    let conversationId: String?
    let thread: String?
    let title: String?
    let modelText: String?
    let tools: [String]?
    let messages: [WorkbenchChatMessage]?
    let busy: Bool?
    let live: Live?
    /// The tools added to this conversation only.
    var extensions: [WorkbenchChatExtension]? = nil
    /// Set on a tech support chat: the chat it may change.
    var target: WorkbenchChatTarget? = nil
    var settings: WorkbenchChatSettings? = nil
    var routing: WorkbenchChatRouting? = nil
}

struct WorkbenchChatTarget: Codable, Equatable {
    let assistant: String
    let conversationId: String
}

/// One set of tools added to a single conversation: a container feature
/// (all its tools, or `only` some), held to `folder` when set, made with
/// `options`. An invented set carries its `source`; the view's copy only
/// says `invented`.
struct WorkbenchChatExtension: Codable, Equatable {
    var feature: String
    var only: [String]? = nil
    var options: [String: JSONValue]? = nil
    var folder: String? = nil
    var source: String? = nil
    var description: String? = nil
    var invented: Bool? = nil

    var isInvented: Bool { source != nil || invented == true }

    /// A copy with one setting changed; nil or an empty value removes it.
    func with(only: [String]?) -> Self { var c = self; c.only = (only?.isEmpty ?? true) ? nil : only; return c }
    func with(folder: String?) -> Self { var c = self; c.folder = (folder?.isEmpty ?? true) ? nil : folder; return c }
    func with(option name: String, _ value: JSONValue?) -> Self {
        var c = self
        var options = c.options ?? [:]
        options[name] = value
        c.options = options.isEmpty ? nil : options
        return c
    }

    /// The text on the chat's header chip.
    var label: String {
        var text = feature
        if let only, !only.isEmpty { text += " · \(only.count) tool\(only.count == 1 ? "" : "s")" }
        if folder != nil { text += " · folder" }
        return text
    }
}

/// `GET /chat/extensions`: the features that have tools, and the list the conversation has.
struct WorkbenchChatExtensions: Decodable, Equatable {
    struct Feature: Decodable, Equatable {
        struct Tool: Decodable, Equatable {
            let name: String
            let description: String
            var builtIn: Bool? = nil
        }
        struct Option: Decodable, Equatable {
            let name: String
            let type: String
            let description: String
            var `default`: JSONValue? = nil
            var `enum`: [String]? = nil
            var minimum: Double? = nil
            var maximum: Double? = nil

            /// Typed text as this option's value, or nil when it does not fit.
            func parse(_ text: String) -> JSONValue? {
                let t = text.trimmingCharacters(in: .whitespacesAndNewlines)
                switch type {
                case "boolean":
                    if ["true", "yes", "on"].contains(t.lowercased()) { return .bool(true) }
                    if ["false", "no", "off"].contains(t.lowercased()) { return .bool(false) }
                    return nil
                case "integer", "number":
                    guard let n = Double(t), type == "number" || n.rounded() == n else { return nil }
                    if let minimum, n < minimum { return nil }
                    if let maximum, n > maximum { return nil }
                    return .number(n)
                default:
                    if let values = self.enum, !values.contains(t) { return nil }
                    return t.isEmpty ? nil : .string(t)
                }
            }
        }
        let name: String
        let description: String
        /// `all` when the assistant has every tool already, `some` for part.
        var builtIn: String? = nil
        let tools: [Tool]
        let options: [Option]

        var isBuiltIn: Bool { builtIn == "all" }
    }
    let features: [Feature]
    let extensions: [WorkbenchChatExtension]
}

struct WorkbenchChatExtensionsSaved: Decodable, Equatable {
    let ok: Bool?
    var extensions: [WorkbenchChatExtension]? = nil
    var error: String? = nil
}

struct WorkbenchChatSent: Decodable, Equatable {
    let ok: Bool?
    let turnId: String?
    let error: String?
}

extension WorkbenchClient {
    func docs() async throws -> WorkbenchDocs {
        try await get("/docs")
    }

    func models() async throws -> WorkbenchModels {
        try await get("/docs/models")
    }

    func doc(_ id: String) async throws -> WorkbenchDoc {
        var c = URLComponents()
        c.path = "/docs/item"
        c.queryItems = [URLQueryItem(name: "id", value: id)]
        return try await get(c.string ?? "/docs/item")
    }

    /// Save the whole file. Throws `WorkbenchDocConflict` when the file on
    /// disk is no longer the one with `digest`.
    func saveDoc(id: String, text: String, digest: String) async throws -> WorkbenchDocSaved {
        struct Body: Encodable { let id: String; let text: String; let digest: String }
        do {
            return try await post("/docs/save", Body(id: id, text: text, digest: digest))
        } catch WorkbenchError.http(409, _) {
            // The answer carries the file as it is now: read it again.
            throw WorkbenchDocConflict(current: try? await doc(id))
        }
    }

    func assistants() async throws -> WorkbenchAssistants {
        try await get("/assistants")
    }

    func conversations(assistant: String) async throws -> WorkbenchConversations {
        try await get(Self.path("assistants", assistant, "conversations"))
    }

    /// Open a conversation; `new` (or empty) starts a fresh one and the answer names it.
    /// `target` opens it as the tech support chat of another conversation.
    func openChat(assistant: String, conversationId: String, target: WorkbenchChatTarget? = nil) async throws -> WorkbenchChatView {
        struct Body: Encodable { let assistant: String; let conversationId: String; let target: WorkbenchChatTarget? }
        return try await post("/chat/open", Body(assistant: assistant, conversationId: conversationId, target: target))
    }

    func chatExtensions(assistant: String, conversationId: String) async throws -> WorkbenchChatExtensions {
        var c = URLComponents()
        c.path = "/chat/extensions"
        c.queryItems = [URLQueryItem(name: "assistant", value: assistant), URLQueryItem(name: "conversationId", value: conversationId)]
        return try await get(c.string ?? "/chat/extensions")
    }

    /// Replace the conversation's list. The host checks each entry builds; `ok: false` says why not.
    func setChatExtensions(assistant: String, conversationId: String, extensions: [WorkbenchChatExtension]) async throws -> WorkbenchChatExtensionsSaved {
        struct Body: Encodable { let assistant: String; let conversationId: String; let extensions: [WorkbenchChatExtension] }
        return try await post("/chat/extensions", Body(assistant: assistant, conversationId: conversationId, extensions: extensions))
    }

    func sendChat(assistant: String, conversationId: String, text: String) async throws -> WorkbenchChatSent {
        try await post("/chat/send", ["assistant": assistant, "conversationId": conversationId, "text": text])
    }

    func chatModels(assistant: String, conversationId: String) async throws -> WorkbenchChatModels {
        try await get(Self.chatQuery("/chat/models", assistant, conversationId))
    }

    func exportChat(assistant: String, conversationId: String) async throws -> WorkbenchChatExport {
        try await get(Self.chatQuery("/chat/export", assistant, conversationId))
    }

    /// Change this conversation's provider, model or effort. A nil field is
    /// left as it is; an empty one goes back to the assistant's own. Answers
    /// the conversation as it now is, or `ok: false` with the reason.
    func setChatSettings(assistant: String, conversationId: String, provider: String? = nil, model: String? = nil, reasoningEffort: String? = nil) async throws -> WorkbenchChatView {
        struct Body: Encodable { let assistant: String; let conversationId: String; let provider: String?; let model: String?; let reasoningEffort: String? }
        return try await chatPost("/chat/settings", Body(assistant: assistant, conversationId: conversationId, provider: provider, model: model, reasoningEffort: reasoningEffort))
    }

    /// Run the last turn again. It streams as a new turn.
    func retryChat(assistant: String, conversationId: String) async throws -> WorkbenchChatSent {
        try await chatPost("/chat/retry", ["assistant": assistant, "conversationId": conversationId])
    }

    func clearChat(assistant: String, conversationId: String) async throws -> WorkbenchChatView {
        try await chatPost("/chat/clear", ["assistant": assistant, "conversationId": conversationId])
    }

    func renameChat(assistant: String, conversationId: String, title: String) async throws -> WorkbenchChatView {
        try await chatPost("/chat/rename", ["assistant": assistant, "conversationId": conversationId, "title": title])
    }

    func deleteChat(assistant: String, conversationId: String) async throws -> WorkbenchChatDeleted {
        try await chatPost("/chat/delete", ["assistant": assistant, "conversationId": conversationId])
    }

    /// A refusal (409 while a reply runs, 400 for a bad value) throws;
    /// `ErrorText.message` reads the host's own words from it.
    private func chatPost<B: Encodable, T: Decodable>(_ path: String, _ body: B) async throws -> T {
        try await post(path, body)
    }

    private static func chatQuery(_ path: String, _ assistant: String, _ conversationId: String) -> String {
        var c = URLComponents()
        c.path = path
        c.queryItems = [URLQueryItem(name: "assistant", value: assistant), URLQueryItem(name: "conversationId", value: conversationId)]
        return c.string ?? path
    }

    func stopChat(assistant: String, conversationId: String) async throws {
        _ = try await request("POST", "/chat/stop", body: try JSONEncoder().encode(["assistant": assistant, "conversationId": conversationId]))
    }
}

/// The file changed on disk since it was loaded. `current` is the file now.
struct WorkbenchDocConflict: Error {
    let current: WorkbenchDoc?
}

// MARK: - Files in the project folder (the file tile)

/// `GET /files`: the project's files, relative, for the picker.
struct WorkbenchFiles: Decodable, Equatable {
    let files: [String]
    let truncated: Bool
}

extension WorkbenchClient {
    func files() async throws -> WorkbenchFiles {
        try await get("/files")
    }

    /// `GET /file?path=`: the file in a doc's shape (no model, no fields).
    func file(_ path: String) async throws -> WorkbenchDoc {
        var c = URLComponents()
        c.path = "/file"
        c.queryItems = [URLQueryItem(name: "path", value: path)]
        return try await get(c.string ?? "/file")
    }

    /// Save the whole file. Throws `WorkbenchDocConflict` when the file on
    /// disk is no longer the one with `digest`.
    func saveFile(path: String, text: String, digest: String) async throws -> WorkbenchDocSaved {
        struct Body: Encodable { let path: String; let text: String; let digest: String }
        do {
            return try await post("/file/save", Body(path: path, text: text, digest: digest))
        } catch WorkbenchError.http(409, _) {
            throw WorkbenchDocConflict(current: try? await file(path))
        }
    }
}
