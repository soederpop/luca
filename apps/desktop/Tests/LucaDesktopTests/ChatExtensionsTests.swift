import XCTest
@testable import LucaDesktop

final class ChatExtensionsTests: XCTestCase {
    private let viewJSON = """
    {"features":[
      {"name":"fileTools","description":"Read and write files","builtIn":"some",
       "tools":[{"name":"readFile","description":"Read one","builtIn":true},{"name":"writeFile","description":"Write one"}],
       "options":[{"name":"mode","type":"string","description":"","enum":["a","b"],"default":"a"},
                  {"name":"limit","type":"integer","description":"","minimum":1,"maximum":10}]}],
     "extensions":[{"feature":"fileTools","only":["writeFile"],"folder":"/tmp/x","options":{"mode":"b"}},
                   {"feature":"made","source":"return {}","description":"invented"}]}
    """

    func testThePickerShapeDecodes() throws {
        let view = try JSONDecoder().decode(WorkbenchChatExtensions.self, from: Data(viewJSON.utf8))
        XCTAssertEqual(view.features[0].tools.map(\.name), ["readFile", "writeFile"])
        XCTAssertFalse(view.features[0].isBuiltIn)
        XCTAssertEqual(view.extensions[0].options?["mode"], .string("b"))
        XCTAssertTrue(view.extensions[1].isInvented)
        XCTAssertEqual(view.extensions[0].label, "fileTools · 1 tool · folder")
    }

    func testSettingsChangeOneThingAndEmptyRemovesIt() {
        let entry = WorkbenchChatExtension(feature: "fileTools", only: ["a"], folder: "/x")
        XCTAssertNil(entry.with(only: []).only)
        XCTAssertNil(entry.with(folder: "").folder)
        let set = entry.with(option: "mode", .string("a"))
        XCTAssertEqual(set.options, ["mode": .string("a")])
        XCTAssertNil(set.with(option: "mode", nil).options)
        // A list goes back to the host without view-only keys.
        let data = try! JSONEncoder().encode(entry)
        XCTAssertFalse(String(decoding: data, as: UTF8.self).contains("invented"))
    }

    func testOptionsParseTypedText() throws {
        let view = try JSONDecoder().decode(WorkbenchChatExtensions.self, from: Data(viewJSON.utf8))
        let mode = view.features[0].options[0], limit = view.features[0].options[1]
        XCTAssertEqual(mode.parse("b"), .string("b"))
        XCTAssertNil(mode.parse("c"))
        XCTAssertEqual(limit.parse("4"), .number(4))
        XCTAssertNil(limit.parse("4.5"))
        XCTAssertNil(limit.parse("11"))
    }

    func testTheChatFrameCarriesTheList() throws {
        let frame = try JSONDecoder().decode(WorkbenchEvent.self, from: Data("""
        {"type":"chat-extensions","assistant":"helper","conversationId":"c1","extensions":[{"feature":"fileTools"}]}
        """.utf8))
        XCTAssertEqual(frame.extensions?.map(\.feature), ["fileTools"])
    }
}
