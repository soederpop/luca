import XCTest
@testable import LucaDesktop

final class ShellRequestTests: XCTestCase {
    func testChooseTakesRowsAndPlainStrings() {
        let request = ShellRequest(["kind": "choose", "id": "r1", "title": "show which project",
                                    "items": [["title": "noir", "detail": "12 items", "value": ["any": 1]], "plain"]])
        XCTAssertEqual(request, .choose(id: "r1", title: "show which project",
                                        items: [.init(title: "noir", detail: "12 items"), .init(title: "plain", detail: "")]))
    }

    func testChooseNeedsAnIdAndRows() {
        XCTAssertNil(ShellRequest(["kind": "choose", "items": ["a"]]))
        XCTAssertNil(ShellRequest(["kind": "choose", "id": "r1", "items": [Any]()]))
    }

    func testChooseCapsTheList() {
        let request = ShellRequest(["kind": "choose", "id": "r1", "items": Array(repeating: "x", count: 900)])
        guard case .choose(_, _, let items) = request else { return XCTFail("not a choose") }
        XCTAssertEqual(items.count, ShellRequest.maxItems)
    }

    func testAskConfirmFlash() {
        XCTAssertEqual(ShellRequest(["kind": "ask", "id": "a", "title": "name", "initial": "x"]), .ask(id: "a", title: "name", initial: "x"))
        XCTAssertEqual(ShellRequest(["kind": "confirm", "id": "c", "question": "Delete?"]), .confirm(id: "c", question: "Delete?", yes: "Yes"))
        XCTAssertEqual(ShellRequest(["kind": "flash", "text": "Saved"]), .flash("Saved"))
        XCTAssertNil(ShellRequest(["kind": "flash", "text": ""]))
    }

    func testOtherKindsAreNotShellRequests() {
        XCTAssertNil(ShellRequest(["kind": "open", "uri": "luca://x/console"]))
        XCTAssertNil(ShellRequest(["kind": "nonsense"]))
    }

    func testReplyScript() {
        XCTAssertEqual(ShellRequest.replyScript(id: "r1", value: 2),
                       "window.dispatchEvent(new CustomEvent('al:reply',{detail:{\"id\":\"r1\",\"value\":2}}))")
        XCTAssertTrue(ShellRequest.replyScript(id: "r1", value: nil).contains("\"value\":null"))
    }
}
