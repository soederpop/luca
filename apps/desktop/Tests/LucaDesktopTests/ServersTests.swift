import XCTest
@testable import LucaDesktop

final class ServersTests: XCTestCase {
    private let json = """
    {"kinds":[{"id":"express","title":"servers.express","summary":"HTTP.","options":[{"name":"port","type":"number","description":"Port"}],
               "optionsHint":"empty for defaults, a port, or port=…","address":"helper/servers/express","running":1,
               "origin":{"kind":"builtin","tag":"built in","label":"built into Luca"}},
              {"id":"websocket","title":"servers.websocket","summary":"WS.","options":[],"optionsHint":"x","address":"helper/servers/websocket","running":0}],
     "instances":[{"key":"k1","id":"express","title":"express :3000","status":"listening","port":3000,"host":"127.0.0.1","url":"http://localhost:3000",
                   "by":"workbench","optionsText":"host=127.0.0.1","state":[{"name":"configured","value":"false"}],"error":null,"startedAt":1},
                  {"key":"k2","id":"express","title":"express","status":"failed","port":null,"host":null,"url":null,
                   "by":"workbench","optionsText":"port=1","state":[],"error":"port 1 is busy","startedAt":2}],
     "text":"1 listening"}
    """

    private func view() throws -> WorkbenchServers {
        try JSONDecoder().decode(WorkbenchServers.self, from: Data(json.utf8))
    }

    func testDecodesTheHostsView() throws {
        let v = try view()
        XCTAssertEqual(v.kinds[0].origin?.tag, "built in")
        XCTAssertNil(v.kinds[1].origin)
        XCTAssertEqual(v.instances[0].url, "http://localhost:3000")
        XCTAssertNil(v.instances[1].port)
        XCTAssertEqual(v.instances[1].error, "port 1 is busy")
    }

    func testRowsAreInstancesThenTheRegistry() throws {
        let v = try view()
        let rows = ServersContent.rows(v)
        XCTAssertEqual(rows.count, 4)
        guard case .instance(let first) = rows[0], case .kind(let third) = rows[2] else { return XCTFail("order") }
        XCTAssertEqual(first.key, "k1")
        XCTAssertEqual(third.id, "express")
        // A row is the same after a reload by its key or id, whatever else changed.
        XCTAssertTrue(ServersContent.same(rows[0], rows[0]))
        XCTAssertFalse(ServersContent.same(rows[0], rows[1]))
        XCTAssertFalse(ServersContent.same(rows[0], rows[2]))
    }

    func testAddressAndKeys() {
        XCTAssertEqual(TileURI("luca://shop/servers")?.kindKey, "luca-servers")
        let map = Keymap.merged(defaults: DefaultKeymap.file, user: nil)
        XCTAssertEqual(map.binding(for: "luca.servers")?.scope, .leader)
        for action in ["lucaServers.down", "lucaServers.up", "lucaServers.toggle", "lucaServers.options", "lucaServers.open", "lucaServers.inspect", "lucaServers.reload", "lucaServers.restart"] {
            XCTAssertEqual(map.binding(for: action)?.kind, "luca-servers", action)
        }
        XCTAssertEqual(map.binding(for: "lucaRegistry.servers")?.kind, "luca-registry")
    }
}
