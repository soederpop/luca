import Foundation

/// The msgpack values Neovim's RPC uses. Ext values (buffer, window and
/// tabpage handles) keep their raw bytes; this app never sends them back.
enum MsgPack: Equatable {
    case null
    case bool(Bool)
    case int(Int64)
    case uint(UInt64)
    case double(Double)
    case string(String)
    case binary(Data)
    case array([MsgPack])
    case map([(MsgPack, MsgPack)])
    case ext(Int8, Data)

    static func == (a: MsgPack, b: MsgPack) -> Bool {
        switch (a, b) {
        case (.null, .null): return true
        case let (.bool(x), .bool(y)): return x == y
        case let (.int(x), .int(y)): return x == y
        case let (.uint(x), .uint(y)): return x == y
        case let (.double(x), .double(y)): return x == y
        case let (.string(x), .string(y)): return x == y
        case let (.binary(x), .binary(y)): return x == y
        case let (.array(x), .array(y)): return x == y
        case let (.map(x), .map(y)): return x.count == y.count && zip(x, y).allSatisfy { $0.0 == $1.0 && $0.1 == $1.1 }
        case let (.ext(t1, d1), .ext(t2, d2)): return t1 == t2 && d1 == d2
        default: return false
        }
    }

    var intValue: Int? {
        switch self {
        case .int(let v): return Int(v)
        case .uint(let v): return Int(v)
        default: return nil
        }
    }

    var stringValue: String? {
        switch self {
        case .string(let s): return s
        case .binary(let d): return String(decoding: d, as: UTF8.self)
        default: return nil
        }
    }

    var arrayValue: [MsgPack]? {
        if case .array(let a) = self { return a }
        return nil
    }

    var boolValue: Bool? {
        switch self {
        case .bool(let b): return b
        case .int(let v): return v != 0
        case .uint(let v): return v != 0
        default: return nil
        }
    }

    // MARK: Encode

    func encoded() -> Data {
        var out = Data()
        encode(into: &out)
        return out
    }

    func encode(into out: inout Data) {
        switch self {
        case .null: out.append(0xc0)
        case .bool(let b): out.append(b ? 0xc3 : 0xc2)
        case .int(let v):
            if v >= 0 { MsgPack.uint(UInt64(v)).encode(into: &out) }
            else if v >= -32 { out.append(UInt8(bitPattern: Int8(v))) }
            else if v >= Int64(Int8.min) { out.append(0xd0); out.append(UInt8(bitPattern: Int8(v))) }
            else if v >= Int64(Int16.min) { out.append(0xd1); Self.put(UInt16(bitPattern: Int16(v)), &out) }
            else if v >= Int64(Int32.min) { out.append(0xd2); Self.put(UInt32(bitPattern: Int32(v)), &out) }
            else { out.append(0xd3); Self.put(UInt64(bitPattern: v), &out) }
        case .uint(let v):
            if v < 0x80 { out.append(UInt8(v)) }
            else if v <= 0xff { out.append(0xcc); out.append(UInt8(v)) }
            else if v <= 0xffff { out.append(0xcd); Self.put(UInt16(v), &out) }
            else if v <= 0xffff_ffff { out.append(0xce); Self.put(UInt32(v), &out) }
            else { out.append(0xcf); Self.put(v, &out) }
        case .double(let d): out.append(0xcb); Self.put(d.bitPattern, &out)
        case .string(let s):
            let bytes = Data(s.utf8)
            let n = bytes.count
            if n < 32 { out.append(0xa0 | UInt8(n)) }
            else if n <= 0xff { out.append(0xd9); out.append(UInt8(n)) }
            else if n <= 0xffff { out.append(0xda); Self.put(UInt16(n), &out) }
            else { out.append(0xdb); Self.put(UInt32(n), &out) }
            out.append(bytes)
        case .binary(let d):
            let n = d.count
            if n <= 0xff { out.append(0xc4); out.append(UInt8(n)) }
            else if n <= 0xffff { out.append(0xc5); Self.put(UInt16(n), &out) }
            else { out.append(0xc6); Self.put(UInt32(n), &out) }
            out.append(d)
        case .array(let a):
            let n = a.count
            if n < 16 { out.append(0x90 | UInt8(n)) }
            else if n <= 0xffff { out.append(0xdc); Self.put(UInt16(n), &out) }
            else { out.append(0xdd); Self.put(UInt32(n), &out) }
            for v in a { v.encode(into: &out) }
        case .map(let m):
            let n = m.count
            if n < 16 { out.append(0x80 | UInt8(n)) }
            else if n <= 0xffff { out.append(0xde); Self.put(UInt16(n), &out) }
            else { out.append(0xdf); Self.put(UInt32(n), &out) }
            for (k, v) in m { k.encode(into: &out); v.encode(into: &out) }
        case .ext(let type, let d):
            out.append(0xc7); out.append(UInt8(d.count)); out.append(UInt8(bitPattern: type)); out.append(d)
        }
    }

    private static func put<T: FixedWidthInteger>(_ v: T, _ out: inout Data) {
        var be = v.bigEndian
        withUnsafeBytes(of: &be) { out.append(contentsOf: $0) }
    }

    // MARK: Decode

    struct Incomplete: Error {}
    struct Invalid: Error { let byte: UInt8 }

    /// One value from the front of `bytes`, and how many bytes it took.
    /// Throws `Incomplete` when more bytes are needed.
    static func decode(_ bytes: [UInt8], at start: Int = 0) throws -> (MsgPack, Int) {
        var i = start
        let v = try read(bytes, &i)
        return (v, i - start)
    }

    private static func need(_ bytes: [UInt8], _ i: Int, _ n: Int) throws {
        if i + n > bytes.count { throw Incomplete() }
    }

    private static func uint(_ bytes: [UInt8], _ i: inout Int, _ n: Int) throws -> UInt64 {
        try need(bytes, i, n)
        var v: UInt64 = 0
        for k in 0..<n { v = (v << 8) | UInt64(bytes[i + k]) }
        i += n
        return v
    }

    private static func raw(_ bytes: [UInt8], _ i: inout Int, _ n: Int) throws -> [UInt8] {
        try need(bytes, i, n)
        let slice = Array(bytes[i..<(i + n)])
        i += n
        return slice
    }

    private static func read(_ bytes: [UInt8], _ i: inout Int) throws -> MsgPack {
        try need(bytes, i, 1)
        let b = bytes[i]
        i += 1
        switch b {
        case 0x00...0x7f: return .uint(UInt64(b))
        case 0x80...0x8f: return try map(bytes, &i, Int(b & 0x0f))
        case 0x90...0x9f: return try array(bytes, &i, Int(b & 0x0f))
        case 0xa0...0xbf: return .string(String(decoding: try raw(bytes, &i, Int(b & 0x1f)), as: UTF8.self))
        case 0xc0: return .null
        case 0xc2: return .bool(false)
        case 0xc3: return .bool(true)
        case 0xc4, 0xc5, 0xc6:
            let n = Int(try uint(bytes, &i, 1 << Int(b - 0xc4)))
            return .binary(Data(try raw(bytes, &i, n)))
        case 0xc7, 0xc8, 0xc9:
            let n = Int(try uint(bytes, &i, 1 << Int(b - 0xc7)))
            let type = Int8(bitPattern: UInt8(try uint(bytes, &i, 1)))
            return .ext(type, Data(try raw(bytes, &i, n)))
        case 0xca:
            return .double(Double(Float(bitPattern: UInt32(try uint(bytes, &i, 4)))))
        case 0xcb: return .double(Double(bitPattern: try uint(bytes, &i, 8)))
        case 0xcc: return .uint(try uint(bytes, &i, 1))
        case 0xcd: return .uint(try uint(bytes, &i, 2))
        case 0xce: return .uint(try uint(bytes, &i, 4))
        case 0xcf: return .uint(try uint(bytes, &i, 8))
        case 0xd0: return .int(Int64(Int8(bitPattern: UInt8(try uint(bytes, &i, 1)))))
        case 0xd1: return .int(Int64(Int16(bitPattern: UInt16(try uint(bytes, &i, 2)))))
        case 0xd2: return .int(Int64(Int32(bitPattern: UInt32(try uint(bytes, &i, 4)))))
        case 0xd3: return .int(Int64(bitPattern: try uint(bytes, &i, 8)))
        case 0xd4, 0xd5, 0xd6, 0xd7, 0xd8:
            let type = Int8(bitPattern: UInt8(try uint(bytes, &i, 1)))
            return .ext(type, Data(try raw(bytes, &i, 1 << Int(b - 0xd4))))
        case 0xd9, 0xda, 0xdb:
            let n = Int(try uint(bytes, &i, 1 << Int(b - 0xd9)))
            return .string(String(decoding: try raw(bytes, &i, n), as: UTF8.self))
        case 0xdc: return try array(bytes, &i, Int(try uint(bytes, &i, 2)))
        case 0xdd: return try array(bytes, &i, Int(try uint(bytes, &i, 4)))
        case 0xde: return try map(bytes, &i, Int(try uint(bytes, &i, 2)))
        case 0xdf: return try map(bytes, &i, Int(try uint(bytes, &i, 4)))
        case 0xe0...0xff: return .int(Int64(Int8(bitPattern: b)))
        default: throw Invalid(byte: b)
        }
    }

    private static func array(_ bytes: [UInt8], _ i: inout Int, _ n: Int) throws -> MsgPack {
        var out: [MsgPack] = []
        out.reserveCapacity(min(n, 1024))
        for _ in 0..<n { out.append(try read(bytes, &i)) }
        return .array(out)
    }

    private static func map(_ bytes: [UInt8], _ i: inout Int, _ n: Int) throws -> MsgPack {
        var out: [(MsgPack, MsgPack)] = []
        for _ in 0..<n {
            let k = try read(bytes, &i)
            out.append((k, try read(bytes, &i)))
        }
        return .map(out)
    }
}
