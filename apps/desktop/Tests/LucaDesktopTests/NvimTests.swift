import XCTest
@testable import LucaDesktop

final class NvimTests: XCTestCase {
    func testMsgPackRoundTrips() throws {
        let value = MsgPack.array([
            .null, .bool(true), .uint(5), .uint(300), .uint(70_000), .uint(5_000_000_000),
            .int(-1), .int(-100), .int(-40_000), .int(-3_000_000_000),
            .double(1.5), .string("hé"), .string(String(repeating: "x", count: 300)),
            .binary(Data([1, 2, 3])), .array(Array(repeating: .uint(1), count: 20)),
            .map([(.string("a"), .uint(1))]),
        ])
        let bytes = [UInt8](value.encoded())
        let (decoded, used) = try MsgPack.decode(bytes)
        XCTAssertEqual(used, bytes.count)
        // Non-negative ints come back as uint; compare through the encoding.
        XCTAssertEqual(decoded.encoded(), value.encoded())
    }

    func testMsgPackWantsMoreBytes() {
        let bytes = [UInt8](MsgPack.string("hello world").encoded())
        XCTAssertThrowsError(try MsgPack.decode(Array(bytes.dropLast()))) { XCTAssertTrue($0 is MsgPack.Incomplete) }
    }

    func testLinesKeepTheBytes() {
        for text in ["", "a", "a\n", "a\nb", "a\nb\n", "\n", "\n\n", "x\r\ny\r\n"] {
            let (lines, eol) = NvimEditor.lines(of: text)
            let back = NvimEditor.text(lines: lines.arrayValue!.map { $0.stringValue! }, eol: eol)
            XCTAssertEqual(back, text, "round trip of \(text.debugDescription)")
        }
    }

    /// The setup Lua and the socket line against a real headless nvim.
    @MainActor
    func testSetupSyncsEditsAndSavesThroughTheApp() async throws {
        guard let nvim = NvimEditor.executable else { throw XCTSkip("no nvim on this Mac") }
        let socket = (NSTemporaryDirectory() as NSString).appendingPathComponent("luca-nvim-t\(UUID().uuidString.prefix(6)).sock")
        let process = Process()
        process.executableURL = URL(fileURLWithPath: nvim)
        process.arguments = ["--headless", "--clean", "-n", "--listen", socket]
        process.standardInput = FileHandle.nullDevice
        process.standardOutput = FileHandle.nullDevice
        process.standardError = FileHandle.nullDevice
        try process.run()
        defer { process.terminate(); unlink(socket) }

        var rpc: NvimRPC?
        for _ in 0..<200 {
            rpc = NvimRPC.connect(path: socket)
            if rpc != nil { break }
            try await Task.sleep(for: .milliseconds(25))
        }
        let line = try XCTUnwrap(rpc)
        var texts: [String] = []
        let saved = expectation(description: "save")
        let changed = expectation(description: "text")
        changed.assertForOverFulfill = false
        line.onNotification = { method, params in
            if method == "luca_text", let lines = params[0].arrayValue {
                texts.append(NvimEditor.text(lines: lines.map { $0.stringValue ?? "" }, eol: params[1].boolValue ?? true))
                changed.fulfill()
            }
            if method == "luca_save" { saved.fulfill() }
        }

        func call(_ method: String, _ params: [MsgPack]) async throws -> MsgPack {
            try await withCheckedThrowingContinuation { done in
                line.request(method, params) { error, result in
                    if let error { done.resume(throwing: NSError(domain: "nvim", code: 1, userInfo: [NSLocalizedDescriptionKey: NvimRPC.errorText(error)])) }
                    else { done.resume(returning: result) }
                }
            }
        }

        let info = try await call("nvim_get_api_info", [])
        let channel = try XCTUnwrap(info.arrayValue?.first?.intValue)
        let (lines, eol) = NvimEditor.lines(of: "# Title\nbody")
        _ = try await call("nvim_exec_lua", [.string(NvimEditor.setupLua), .array([
            .int(Int64(channel)), .string("luca://p/doc.md"), .string("markdown"), lines, .bool(eol),
        ])])

        let state = try await call("nvim_exec_lua", [.string("""
        return { vim.bo.buftype, vim.bo.filetype, vim.bo.modified, vim.api.nvim_buf_get_lines(0, 0, -1, false), vim.fn.undotree().seq_last }
        """), .array([])])
        let parts = try XCTUnwrap(state.arrayValue)
        XCTAssertEqual(parts[0].stringValue, "acwrite")
        XCTAssertEqual(parts[1].stringValue, "markdown")
        XCTAssertEqual(parts[2].boolValue, false)
        XCTAssertEqual(parts[3].arrayValue?.compactMap(\.stringValue), ["# Title", "body"])
        XCTAssertEqual(parts[4].intValue, 0, "the first fill is not an undo step")

        // An edit, then :w. Headless nvim fires no TextChanged on its own.
        _ = try await call("nvim_exec_lua", [.string("""
        vim.api.nvim_buf_set_lines(0, 1, 2, false, { 'edited' })
        vim.api.nvim_exec_autocmds('TextChanged', { buffer = 0 })
        vim.cmd('write')
        """), .array([])])
        await fulfillment(of: [changed, saved], timeout: 5)
        XCTAssertEqual(texts.last, "# Title\nedited")

        // A push from the app replaces the text and keeps the file a file.
        let (next, nextEol) = NvimEditor.lines(of: "pushed\n")
        _ = try await call("nvim_exec_lua", [.string("luca_desktop.set(...)"), .array([next, .bool(nextEol)])])
        let after = try await call("nvim_exec_lua", [.string("return { vim.api.nvim_buf_get_lines(0, 0, -1, false), vim.bo.eol }"), .array([])])
        XCTAssertEqual(after.arrayValue?[0].arrayValue?.compactMap(\.stringValue), ["pushed"])
        XCTAssertEqual(after.arrayValue?[1].boolValue, true)
        line.disconnect()
    }
}
