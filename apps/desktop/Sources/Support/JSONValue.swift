import Foundation

// A JSON value of any shape: helper state and call arguments from the host.

enum JSONValue: Codable, Hashable {
    case string(String)
    case number(Double)
    case bool(Bool)
    case object([String: JSONValue])
    case array([JSONValue])
    case null

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() { self = .null; return }
        if let v = try? container.decode(Bool.self) { self = .bool(v); return }
        if let v = try? container.decode(Double.self) { self = .number(v); return }
        if let v = try? container.decode(String.self) { self = .string(v); return }
        if let v = try? container.decode([String: JSONValue].self) { self = .object(v); return }
        if let v = try? container.decode([JSONValue].self) { self = .array(v); return }
        throw DecodingError.dataCorruptedError(in: container, debugDescription: "Unsupported JSON value")
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .string(let v): try container.encode(v)
        case .number(let v): try container.encode(v)
        case .bool(let v): try container.encode(v)
        case .object(let v): try container.encode(v)
        case .array(let v): try container.encode(v)
        case .null: try container.encodeNil()
        }
    }

    var stringValue: String? {
        if case .string(let v) = self { return v }
        return nil
    }

    static func from(any value: Any) -> JSONValue? {
        switch value {
        case is NSNull: return .null
        case let s as String: return .string(s)
        case let b as Bool: return .bool(b)
        case let n as NSNumber:
            if CFGetTypeID(n) == CFBooleanGetTypeID() { return .bool(n.boolValue) }
            return .number(n.doubleValue)
        case let d as [String: Any]:
            var obj: [String: JSONValue] = [:]
            for (k, v) in d { obj[k] = from(any: v) ?? .null }
            return .object(obj)
        case let a as [Any]:
            return .array(a.map { from(any: $0) ?? .null })
        default: return nil
        }
    }

    func toAny() -> Any {
        switch self {
        case .string(let s): return s
        case .number(let n): return n
        case .bool(let b): return b
        case .null: return NSNull()
        case .object(let o): return o.mapValues { $0.toAny() }
        case .array(let a): return a.map { $0.toAny() }
        }
    }
}
