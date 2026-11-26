import XCTest
@testable import LucaDesktop

/// The contentbase tile: the host's shapes, the spec the form sends, keys.
final class ContentbaseTests: XCTestCase {
    private let overviewJSON = """
    {"rootDisplay":"p/docs","modelsDirDisplay":"p/docs/models","notice":null,"error":null,
     "fieldTypes":["string","number","boolean","date","enum","list"],"extractKinds":["text","list","code"],
     "loadErrors":[{"file":"docs/models/bad.md","fileDisplay":"p/docs/models/bad.md","model":"Bad","message":"nope is not defined"}],
     "models":[{"name":"Customer","prefix":"customers","description":"A company","slot":0,"count":1,"source":"tile",
       "sourceText":"this tile · p/docs/models/customer.md","file":"docs/models/customer.md","fileDisplay":"p/docs/models/customer.md",
       "digest":"abc","editable":true,"readOnlyNote":null,
       "spec":{"name":"Customer","prefix":"customers","description":"A company",
         "fields":[{"name":"tier","type":"enum","required":false,"default":"free","description":"","options":["free","paid"]}],
         "sections":[{"key":"notes","heading":"Notes","alternatives":[],"extract":"text"}]},
       "fields":[{"name":"tier","kind":"enum","typeText":"enum(free, paid)","required":false,"default":"free","description":null,"options":["free","paid"]}],
       "sections":[{"key":"notes","heading":"Notes","alternatives":[],"extract":"text"}],"relationships":[],
       "template":{"file":"docs/models/customer.template.md","fileDisplay":"p/docs/models/customer.template.md","exists":false}}]}
    """

    func testTheOverviewDecodes() throws {
        let o = try JSONDecoder().decode(ContentbaseOverview.self, from: Data(overviewJSON.utf8))
        let m = o.models[0]
        XCTAssertTrue(m.editable)
        XCTAssertEqual(m.spec.fields[0].options, ["free", "paid"])
        XCTAssertEqual(m.sections[0].extract, "text")
        XCTAssertEqual(o.loadErrors[0].model, "Bad")
    }

    func testTheSpecIsSentWithoutRowIdsAndComparesByContent() throws {
        let o = try JSONDecoder().decode(ContentbaseOverview.self, from: Data(overviewJSON.utf8))
        let a = o.models[0].spec
        let b = try JSONDecoder().decode(ContentbaseModelSpec.self, from: try JSONEncoder().encode(a))
        XCTAssertNotEqual(a.fields[0].uid, b.fields[0].uid)
        XCTAssertTrue(a.sameContent(as: b))
        let sent = String(data: try JSONEncoder().encode(a), encoding: .utf8) ?? ""
        XCTAssertFalse(sent.contains("uid"))
        var c = b
        c.fields[0].required = true
        XCTAssertFalse(a.sameContent(as: c))
    }

    func testAQueryResultAndItsErrorDecode() throws {
        let ok = """
        {"ok":true,"model":"Note","slot":0,"total":2,"offset":0,"limit":200,"count":2,
         "columns":[{"key":"meta.tags","title":"tags","kind":"array"}],
         "rows":[{"id":"notes/a","title":"Alpha","address":"doc/notes/a","cells":[{"text":"[\\"a\\"]","kind":"array","items":["a"]}]}],
         "paths":[{"key":"meta.status","kind":"enum","options":["draft","done"]}],"ops":["eq"],
         "whereText":"{}","sortText":"{}","code":"await x","ms":3}
        """
        let r = try JSONDecoder().decode(ContentbaseResult.self, from: Data(ok.utf8))
        XCTAssertEqual(r.rows?[0].cells[0].items, ["a"])
        XCTAssertEqual(r.paths?[0].options, ["draft", "done"])
        let bad = try JSONDecoder().decode(ContentbaseResult.self, from: Data(#"{"ok":false,"error":"Unknown operator: $nope"}"#.utf8))
        XCTAssertFalse(bad.ok)
        XCTAssertEqual(bad.error, "Unknown operator: $nope")
    }

    func testOperatorsReadAsWords() {
        XCTAssertEqual(ContentbaseContent.opLabel("eq"), "is")
        XCTAssertEqual(ContentbaseContent.opLabel("notIn"), "is none of")
        XCTAssertEqual(ContentbaseContent.opLabel("gte"), "≥")
    }

    @MainActor func testTheKindAndItsKeysAreRegistered() throws {
        TileKinds.registerBuiltIns()
        let uri = try XCTUnwrap(TileURI("luca://shop/contentbase?model=Customer&pane=query"))
        XCTAssertEqual(TileKinds.kind(for: uri)?.id, "luca-contentbase")
        let map = Keymap.merged(defaults: DefaultKeymap.file, user: nil)
        let keys = map.kindBindings("luca-contentbase").map(\.action)
        for action in ["lucaContentbase.new", "lucaContentbase.query", "lucaContentbase.addField", "lucaContentbase.addFilter", "lucaContentbase.template"] {
            XCTAssertTrue(keys.contains(action), action)
        }
        XCTAssertNotNil(map.keyLabel(for: "luca.contentbase"))
    }
}
