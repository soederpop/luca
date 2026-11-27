import Foundation
import Darwin

/// A msgpack-RPC line to a running Neovim over its `--listen` socket.
/// Replies and notifications arrive on the main actor.
final class NvimRPC: @unchecked Sendable {
    private let fd: Int32
    private let queue = DispatchQueue(label: "luca.nvim.rpc")
    private var source: DispatchSourceRead?
    private var pending: [UInt8] = []
    private var nextId: UInt64 = 1
    private var waiting: [UInt64: @MainActor (MsgPack?, MsgPack) -> Void] = [:]
    private let lock = NSLock()

    /// `(method, params)` for each notification nvim sends (`rpcnotify`).
    var onNotification: @MainActor (String, [MsgPack]) -> Void = { _, _ in }
    var onClose: @MainActor () -> Void = {}

    private init(fd: Int32) {
        self.fd = fd
    }

    /// Connects to a unix socket; nil while nothing listens there yet.
    static func connect(path: String) -> NvimRPC? {
        let fd = socket(AF_UNIX, SOCK_STREAM, 0)
        guard fd >= 0 else { return nil }
        var addr = sockaddr_un()
        addr.sun_family = sa_family_t(AF_UNIX)
        let bytes = Array(path.utf8)
        guard bytes.count < MemoryLayout.size(ofValue: addr.sun_path) else { close(fd); return nil }
        withUnsafeMutableBytes(of: &addr.sun_path) { raw in
            for (i, b) in bytes.enumerated() { raw[i] = b }
            raw[bytes.count] = 0
        }
        let ok = withUnsafePointer(to: &addr) {
            $0.withMemoryRebound(to: sockaddr.self, capacity: 1) {
                Darwin.connect(fd, $0, socklen_t(MemoryLayout<sockaddr_un>.size))
            }
        }
        guard ok == 0 else { close(fd); return nil }
        var on: Int32 = 1
        setsockopt(fd, SOL_SOCKET, SO_NOSIGPIPE, &on, socklen_t(MemoryLayout<Int32>.size))
        let rpc = NvimRPC(fd: fd)
        rpc.startReading()
        return rpc
    }

    private func startReading() {
        let source = DispatchSource.makeReadSource(fileDescriptor: fd, queue: queue)
        source.setEventHandler { [weak self] in self?.readAvailable() }
        source.setCancelHandler { [fd] in close(fd) }
        self.source = source
        source.resume()
    }

    private func readAvailable() {
        var buffer = [UInt8](repeating: 0, count: 65536)
        let n = read(fd, &buffer, buffer.count)
        if n <= 0 {
            source?.cancel()
            source = nil
            let done = onClose
            DispatchQueue.main.async { MainActor.assumeIsolated { done() } }
            return
        }
        pending.append(contentsOf: buffer[0..<n])
        var used = 0
        while used < pending.count {
            do {
                let (message, size) = try MsgPack.decode(pending, at: used)
                used += size
                handle(message)
            } catch is MsgPack.Incomplete {
                break
            } catch {
                // A stream that does not parse cannot be resynced.
                pending.removeAll()
                source?.cancel()
                return
            }
        }
        if used > 0 { pending.removeFirst(used) }
    }

    private func handle(_ message: MsgPack) {
        guard let parts = message.arrayValue, let type = parts.first?.intValue else { return }
        if type == 1, parts.count == 4, let id = parts[1].intValue {
            lock.lock()
            let callback = waiting.removeValue(forKey: UInt64(id))
            lock.unlock()
            let error: MsgPack? = parts[2] == .null ? nil : parts[2]
            let result = parts[3]
            if let callback {
                DispatchQueue.main.async { MainActor.assumeIsolated { callback(error, result) } }
            }
        } else if type == 2, parts.count == 3, let method = parts[1].stringValue {
            let params = parts[2].arrayValue ?? []
            let handler = onNotification
            DispatchQueue.main.async { MainActor.assumeIsolated { handler(method, params) } }
        }
    }

    /// Sends a request; `reply` gets `(error, result)` on the main actor.
    func request(_ method: String, _ params: [MsgPack], reply: (@MainActor (MsgPack?, MsgPack) -> Void)? = nil) {
        lock.lock()
        let id = nextId
        nextId += 1
        if let reply { waiting[id] = reply }
        lock.unlock()
        let message = MsgPack.array([.uint(0), .uint(id), .string(method), .array(params)])
        write(message.encoded())
    }

    private func write(_ data: Data) {
        queue.async { [fd] in
            data.withUnsafeBytes { raw in
                var offset = 0
                while offset < raw.count {
                    let n = Darwin.write(fd, raw.baseAddress! + offset, raw.count - offset)
                    if n <= 0 { return }
                    offset += n
                }
            }
        }
    }

    func disconnect() {
        queue.async { [weak self] in
            self?.source?.cancel()
            self?.source = nil
        }
    }

    /// The error text nvim sends back: `[type, message]`.
    static func errorText(_ error: MsgPack) -> String {
        if let parts = error.arrayValue, parts.count > 1, let text = parts[1].stringValue { return text }
        return error.stringValue ?? "\(error)"
    }
}
