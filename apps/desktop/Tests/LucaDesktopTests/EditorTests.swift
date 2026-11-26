import XCTest
import SwiftUI
import AppKit
import MarkdownEngine
@testable import LucaDesktop

/// The repo's `docs/` folder: real documents, not fixtures.
private let repoRoot = URL(fileURLWithPath: #filePath)
    .deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
    .deletingLastPathComponent().deletingLastPathComponent()

private func realDocs() -> [(id: String, text: String)] {
    let docs = repoRoot.appendingPathComponent("docs")
    let walker = FileManager.default.enumerator(at: docs, includingPropertiesForKeys: nil)
    var out: [(String, String)] = []
    while let url = walker?.nextObject() as? URL {
        guard url.pathExtension == "md", let text = try? String(contentsOf: url, encoding: .utf8) else { continue }
        let id = String(url.path.dropFirst(docs.path.count + 1).dropLast(3))
        out.append((id, text))
    }
    return out.sorted { $0.0 < $1.0 }
}

final class DocTextTests: XCTestCase {
    func testEveryDocSplitsAndJoinsByteExact() {
        let docs = realDocs()
        XCTAssertGreaterThan(docs.count, 100)
        var withFrontmatter = 0
        for doc in docs {
            let split = DocText(splitting: doc.text)
            XCTAssertEqual(Data(split.joined.utf8), Data(doc.text.utf8), doc.id)
            if !split.frontmatter.isEmpty { withFrontmatter += 1 }
            // The body never starts with a blank line: that is contentbase's cut too.
            XCTAssertFalse(split.body.hasPrefix("\n"), doc.id)
        }
        // The luca repo's docs: about a third carry frontmatter.
        XCTAssertGreaterThan(withFrontmatter, 40)
    }

    /// With `LUCA_DESKTOP_SERVER_BODIES` set to a JSON map of doc id to the server's
    /// `content`, the split body must match it.
    func testBodyMatchesTheServerContentWhenGiven() throws {
        guard let path = ProcessInfo.processInfo.environment["LUCA_DESKTOP_SERVER_BODIES"] else { throw XCTSkip("LUCA_DESKTOP_SERVER_BODIES not set") }
        let bodies = try JSONDecoder().decode([String: String].self, from: Data(contentsOf: URL(fileURLWithPath: path)))
        var checked = 0
        for doc in realDocs() {
            guard let server = bodies[doc.id] else { continue }
            XCTAssertEqual(DocText(splitting: doc.text).body, server, doc.id)
            checked += 1
        }
        XCTAssertGreaterThan(checked, 300)
    }

    func testEdgeCases() {
        XCTAssertEqual(DocText(splitting: "no frontmatter\n").body, "no frontmatter\n")
        XCTAssertEqual(DocText(splitting: "---\nunclosed: true\nbody").frontmatter, "")
        let crlf = DocText(splitting: "---\r\na: 1\r\n---\r\n\r\nBody\r\n")
        XCTAssertEqual(crlf.frontmatter, "---\r\na: 1\r\n---\r\n\r\n")
        XCTAssertEqual(crlf.body, "Body\r\n")
        let empty = DocText(splitting: "---\na: 1\n---\n")
        XCTAssertEqual(empty.body, "")
        XCTAssertEqual(empty.with(body: "New").joined, "---\na: 1\n---\nNew")
    }

    func testLineDiff() {
        let diff = LineDiff.lines("a\nb\nc", "a\nB\nc\nd")
        XCTAssertEqual(diff, [.same("a"), .added("B"), .removed("b"), .same("c"), .added("d")])
        XCTAssertEqual(LineDiff.unified("x", "x"), "")
    }
}

final class DocKeysTests: XCTestCase {
    func testCmdSSavesInEveryModeAndDocKeysAreBound() {
        let map = Keymap.merged(defaults: DefaultKeymap.file, user: nil)
        var router = KeyRouter(keymap: map)
        router.mode = .insert
        XCTAssertEqual(router.route(KeyStroke(key: "s", cmd: true), kind: "luca-doc"), .action("doc.save", count: nil))
        XCTAssertEqual(router.route(KeyStroke(key: "s", cmd: true), kind: "luca-file"), .action("doc.save", count: nil))
        router.mode = .normal
        XCTAssertEqual(router.route(KeyStroke(key: "e"), kind: "luca-doc"), .action("lucaDoc.rich", count: nil))
        XCTAssertEqual(router.route(KeyStroke(key: "E", shift: true), kind: "luca-doc"), .action("lucaDoc.source", count: nil))
        XCTAssertEqual(router.route(KeyStroke(key: "i"), kind: "luca-file"), .action("lucaFile.edit", count: nil))
        XCTAssertEqual(router.route(KeyStroke(key: "i"), kind: "app-file"), .action("appFile.edit", count: nil))
        XCTAssertTrue(map.warnings.isEmpty, map.warnings.joined(separator: "; "))
    }
}

/// The rich editor, on screen in an off-screen window: type one character
/// into real docs and check the buffer changed by that character only.
@MainActor
final class RichEditorTypingTests: XCTestCase {
    private func textView(in view: NSView) -> NSTextView? {
        if let tv = view as? NSTextView { return tv }
        for sub in view.subviews { if let tv = textView(in: sub) { return tv } }
        return nil
    }

    private func spin(until done: () -> Bool, timeout: TimeInterval = 2) {
        let end = Date().addingTimeInterval(timeout)
        while !done() && Date() < end { RunLoop.main.run(until: Date().addingTimeInterval(0.01)) }
    }

    func testOneTypedCharacterChangesOnlyThatCharacter() throws {
        _ = NSApplication.shared
        let docs = realDocs().filter { !DocText(splitting: $0.text).body.isEmpty }
        let picked = stride(from: 0, to: docs.count, by: max(1, docs.count / 60)).map { docs[$0] }
        XCTAssertGreaterThanOrEqual(picked.count, 50)
        var edits = 0
        for doc in picked {
            let buffer = WorkbenchDocBuffer()
            buffer.take(WorkbenchDoc(id: doc.id, model: "Base", slot: 0, title: doc.id, path: doc.id, pathDisplay: doc.id,
                                     file: doc.text, digest: "d", size: doc.text.utf8.count, sizeText: "", fields: []))
            let host = NSHostingView(rootView: WorkbenchRichEditor(buffer: buffer, focused: .constant(false), documentId: doc.id)
                .frame(width: 700, height: 500))
            let window = NSWindow(contentRect: NSRect(x: -4000, y: -4000, width: 700, height: 500), styleMask: [.borderless], backing: .buffered, defer: false)
            window.contentView = host
            window.orderFrontRegardless()
            defer { window.orderOut(nil); window.contentView = nil }
            spin(until: { self.textView(in: host) != nil })
            let tv = try XCTUnwrap(textView(in: host), doc.id)
            XCTAssertEqual(tv.string, buffer.body, "load \(doc.id)")

            let body = buffer.body as NSString
            let middle = body.range(of: "\n", options: [], range: NSRange(location: body.length / 2, length: body.length - body.length / 2))
            var spots = [body.length]
            if middle.location != NSNotFound, middle.location + 1 < body.length { spots.insert(middle.location + 1, at: 0) }
            for spot in spots {
                let before = buffer.raw
                let at = (buffer.text.frontmatter as NSString).length + spot
                tv.insertText("Z", replacementRange: NSRange(location: spot, length: 0))
                let expected = (before as NSString).replacingCharacters(in: NSRange(location: at, length: 0), with: "Z")
                spin(until: { buffer.raw == expected })
                XCTAssertEqual(buffer.raw, expected, "\(doc.id) at \(spot)")
                tv.insertText("", replacementRange: NSRange(location: spot, length: 1))
                spin(until: { buffer.raw == before })
                XCTAssertEqual(buffer.raw, before, "\(doc.id) undo at \(spot)")
                edits += 1
            }
        }
        XCTAssertGreaterThanOrEqual(edits, 100)
    }
}
