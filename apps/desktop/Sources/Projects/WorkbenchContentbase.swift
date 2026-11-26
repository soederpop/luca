import Foundation

// The host's shapes for the contentbase tile (`src/workbench/models.ts`),
// decoded as sent. The host writes model files, checks specs, coerces
// query values and shapes rows; the app only edits the spec and draws.

/// One frontmatter field as the editor holds it. `uid` is the app's own
/// row identity and is never sent.
struct ContentbaseFieldSpec: Codable, Equatable, Identifiable {
    var uid = UUID()
    var name: String
    /// string, number, boolean, date, enum or list.
    var type: String
    var required: Bool
    /// The default as text; empty for none. A list default is comma separated.
    var `default`: String
    var description: String
    var options: [String]
    var id: UUID { uid }

    enum CodingKeys: String, CodingKey { case name, type, required, `default`, description, options }

    static func blank() -> ContentbaseFieldSpec {
        ContentbaseFieldSpec(name: "", type: "string", required: false, default: "", description: "", options: [])
    }
}

/// One section: the heading in the document and what to pull out of it.
struct ContentbaseSectionSpec: Codable, Equatable, Identifiable {
    var uid = UUID()
    var key: String
    var heading: String
    var alternatives: [String]
    /// text, list or code.
    var extract: String
    var id: UUID { uid }

    enum CodingKeys: String, CodingKey { case key, heading, alternatives, extract }

    static func blank() -> ContentbaseSectionSpec {
        ContentbaseSectionSpec(key: "", heading: "", alternatives: [], extract: "text")
    }
}

struct ContentbaseModelSpec: Codable, Equatable {
    var name: String
    var prefix: String
    var description: String
    var fields: [ContentbaseFieldSpec]
    var sections: [ContentbaseSectionSpec]

    static func blank() -> ContentbaseModelSpec {
        ContentbaseModelSpec(name: "", prefix: "", description: "", fields: [], sections: [])
    }

    /// Same content, rows matched by position: the app's row ids do not count.
    func sameContent(as other: ContentbaseModelSpec) -> Bool {
        let encoder = JSONEncoder()
        encoder.outputFormatting = .sortedKeys
        return (try? encoder.encode(self)) == (try? encoder.encode(other))
    }
}

/// One model as the tile lists it (`GET /contentbase`, `GET /contentbase/model`).
struct ContentbaseModel: Decodable, Equatable, Identifiable {
    struct Section: Decodable, Equatable {
        let key: String
        let heading: String
        let alternatives: [String]
        /// text, list, code, or custom (the model's own function).
        let extract: String
    }
    struct Template: Decodable, Equatable {
        let file: String
        let fileDisplay: String
        let exists: Bool
    }
    let name: String
    let prefix: String
    let description: String
    let slot: Int
    let count: Int
    /// models-file, tile, workspace or builtin.
    let source: String
    let sourceText: String
    let file: String
    let fileDisplay: String
    let digest: String
    let editable: Bool
    let readOnlyNote: String?
    let spec: ContentbaseModelSpec
    let fields: [WorkbenchModelField]
    let sections: [Section]
    let relationships: [String]
    let template: Template
    var id: String { name }
}

struct ContentbaseOverview: Decodable, Equatable {
    struct LoadError: Decodable, Equatable, Identifiable {
        let file: String
        let fileDisplay: String
        let model: String?
        let message: String
        var id: String { file + "|" + (model ?? "") + "|" + message }
    }
    let rootDisplay: String
    let modelsDirDisplay: String
    let notice: String?
    let error: String?
    let fieldTypes: [String]
    let extractKinds: [String]
    let models: [ContentbaseModel]
    let loadErrors: [LoadError]
}

/// `POST /contentbase/preview`: the file a spec gives and what is wrong with it.
struct ContentbasePreview: Decodable, Equatable {
    let problems: [String]
    let file: String
    let fileDisplay: String
    let text: String
    let suggestedPrefix: String
}

struct ContentbaseSaved: Decodable, Equatable {
    let ok: Bool
    let view: ContentbaseModel?
    let loadError: String?
    let text: String
}

/// One where row. `op` is the DSL's operator without `$`.
struct ContentbaseFilter: Codable, Equatable, Identifiable {
    var uid = UUID()
    var path: String
    var op: String
    var value: String
    var id: UUID { uid }
    enum CodingKeys: String, CodingKey { case path, op, value }
}

struct ContentbaseSort: Codable, Equatable, Identifiable {
    var uid = UUID()
    var path: String
    /// asc or desc.
    var direction: String
    var id: UUID { uid }
    enum CodingKeys: String, CodingKey { case path, direction }
}

struct ContentbaseQueryRequest: Encodable {
    let model: String
    let filters: [ContentbaseFilter]
    let sort: [ContentbaseSort]
    let columns: [String]
    let limit: Int
    /// The DSL's where as JSON text; when set, the host runs it instead of `filters`.
    let `where`: String?
}

/// `POST /contentbase/query`. `ok: false` carries `error` (a 200, so the
/// tile shows it in place).
struct ContentbaseResult: Decodable, Equatable {
    struct Column: Decodable, Equatable, Identifiable {
        let key: String
        let title: String
        let kind: String
        var id: String { key }
    }
    struct Cell: Decodable, Equatable {
        let text: String?
        let kind: String
        let items: [String]
    }
    struct Row: Decodable, Equatable, Identifiable {
        let id: String
        let title: String
        let address: String
        let cells: [Cell]
    }
    struct Path: Decodable, Equatable, Identifiable {
        let key: String
        let kind: String
        let options: [String]
        var id: String { key }
    }
    let ok: Bool
    let error: String?
    let model: String?
    let slot: Int?
    let total: Int?
    let count: Int?
    let columns: [Column]?
    let rows: [Row]?
    let paths: [Path]?
    let ops: [String]?
    let whereText: String?
    let sortText: String?
    let code: String?
    let ms: Int?
}

extension WorkbenchClient {
    func contentbase() async throws -> ContentbaseOverview {
        try await get("/contentbase")
    }

    func contentbaseModel(_ name: String) async throws -> ContentbaseModel {
        var c = URLComponents()
        c.path = "/contentbase/model"
        c.queryItems = [URLQueryItem(name: "name", value: name)]
        return try await get(c.string ?? "/contentbase/model")
    }

    func contentbasePreview(_ spec: ContentbaseModelSpec, original: String?) async throws -> ContentbasePreview {
        struct Body: Encodable { let spec: ContentbaseModelSpec; let original: String? }
        return try await post("/contentbase/preview", Body(spec: spec, original: original))
    }

    /// Write the spec. A 409 (the file changed, or the name is taken) throws
    /// `WorkbenchError.http` with the host's line.
    func contentbaseSave(_ spec: ContentbaseModelSpec, original: String?, digest: String?) async throws -> ContentbaseSaved {
        struct Body: Encodable { let spec: ContentbaseModelSpec; let original: String?; let digest: String? }
        return try await post("/contentbase/save", Body(spec: spec, original: original, digest: digest))
    }

    func contentbaseDelete(_ name: String) async throws -> String {
        struct Answer: Decodable { let text: String }
        let answer: Answer = try await post("/contentbase/delete", ["name": name])
        return answer.text
    }

    func contentbaseQuery(_ request: ContentbaseQueryRequest) async throws -> ContentbaseResult {
        try await post("/contentbase/query", request)
    }
}
