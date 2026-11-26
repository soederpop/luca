import XCTest
@testable import LucaDesktop

final class EndpointsTests: XCTestCase {
    private let endpointsJSON = """
    {"dir":"/p/endpoints","dirDisplay":"endpoints/","notice":null,"count":3,
     "groups":[
      {"tag":"users","routes":[
        {"id":"GET /users","method":"GET","path":"/users","openapiPath":"/users","summary":"List","tags":["users"],"file":"endpoints/users.ts","address":"request/GET/users",
         "fields":[{"name":"q","in":"query","type":"string","required":false,"description":"Part of a name","default":null},
                   {"name":"limit","in":"query","type":"number","required":false,"description":"","default":"10"}],
         "body":false,"upload":false,"rateLimit":null},
        {"id":"POST /users","method":"POST","path":"/users","openapiPath":"/users","summary":"Add","tags":["users"],"file":"endpoints/users.ts","address":"request/POST/users",
         "fields":[{"name":"role","in":"body","type":"enum","required":false,"description":"","default":"member","options":["admin","member"]}],
         "body":true,"upload":false,"rateLimit":"10 per 1 s"}]},
      {"tag":"/health","routes":[
        {"id":"GET /health","method":"GET","path":"/health","openapiPath":"/health","summary":"","tags":[],"file":"endpoints/health.ts","address":"request/GET/health",
         "fields":[],"body":false,"upload":false,"rateLimit":null}]}],
     "errors":[{"file":"endpoints/broken.ts","error":"Unexpected token"}],
     "server":{"status":"running","port":3100,"url":"http://localhost:3100","runId":"run-1","text":"running on :3100","error":null}}
    """

    func testEndpointsDecodeAndRowsKeepTheGroupOrder() throws {
        let view = try JSONDecoder().decode(WorkbenchEndpoints.self, from: Data(endpointsJSON.utf8))
        XCTAssertEqual(view.groups.map(\.tag), ["users", "/health"])
        XCTAssertEqual(EndpointsContent.rows(view).map(\.id), ["GET /users", "POST /users", "GET /health"])
        XCTAssertEqual(view.groups[0].routes[1].fields[0].options, ["admin", "member"])
        XCTAssertEqual(view.groups[0].routes[1].rateLimit, "10 per 1 s")
        XCTAssertEqual(view.errors.first?.file, "endpoints/broken.ts")
        XCTAssertEqual(view.server.text, "running on :3100")
        XCTAssertEqual(view.server.port, 3100)
    }

    func testANoEndpointsProjectDecodes() throws {
        let json = """
        {"dir":null,"dirDisplay":null,"notice":"This project has no endpoints/ folder.","count":0,"groups":[],"errors":[],
         "server":{"status":"stopped","port":null,"url":null,"runId":null,"text":"stopped","error":null}}
        """
        let view = try JSONDecoder().decode(WorkbenchEndpoints.self, from: Data(json.utf8))
        XCTAssertNil(view.dir)
        XCTAssertEqual(view.notice, "This project has no endpoints/ folder.")
        XCTAssertTrue(EndpointsContent.rows(view).isEmpty)
    }

    func testAResponseDecodesWithItsTreeOrWhyNothingWasSent() throws {
        let ok = """
        {"ok":true,"method":"GET","url":"/users?q=a","status":200,"statusText":"OK","statusClass":"2xx","ms":4,
         "headers":[{"name":"content-type","value":"application/json"}],"contentType":"application/json","bodyKind":"json",
         "text":"{}","tree":{"type":"Object","text":"{count: 1}","children":[{"key":"count","type":"number","text":"1"}],"open":true},
         "size":11,"sizeText":"11 B","sent":null}
        """
        let r = try JSONDecoder().decode(WorkbenchResponse.self, from: Data(ok.utf8))
        XCTAssertEqual(r.status, 200)
        XCTAssertEqual(r.tree?.children?.first?.key, "count")
        XCTAssertEqual(HTTPTone.status(r.statusClass), .good)

        let stopped = try JSONDecoder().decode(WorkbenchResponse.self, from: Data(#"{"ok":false,"notRunning":true,"error":"The server is not running"}"#.utf8))
        XCTAssertEqual(stopped.notRunning, true)
        let missing = try JSONDecoder().decode(WorkbenchResponse.self, from: Data(#"{"ok":false,"missing":["name"],"error":"required: name"}"#.utf8))
        XCTAssertEqual(missing.missing, ["name"])
    }

    func testAServeFrameDecodes() throws {
        let json = #"{"type":"serve","serve":{"status":"failed","port":3100,"url":null,"runId":"run-2","text":"failed: boom","error":"boom"},"at":1}"#
        let frame = try JSONDecoder().decode(WorkbenchEvent.self, from: Data(json.utf8))
        XCTAssertEqual(frame.serve?.status, "failed")
        XCTAssertEqual(frame.serve?.error, "boom")
        XCTAssertNil(frame.runId)
    }

    func testRequestAddressesRoundTrip() {
        XCTAssertEqual(RequestAddress.parse("GET/users/:id")?.method, "GET")
        XCTAssertEqual(RequestAddress.parse("get/users/:id")?.path, "/users/:id")
        XCTAssertEqual(RequestAddress.parse("POST/")?.path, "/")
        XCTAssertNil(RequestAddress.parse("users"))
        XCTAssertNil(RequestAddress.parse(nil))
        XCTAssertEqual(RequestAddress.id(method: "delete", path: "/users/:id"), "DELETE/users/:id")
        let uri = TileURI("luca://shop/request/GET/users/:id")
        XCTAssertEqual(uri?.kindKey, "luca-request")
        XCTAssertEqual(uri?.id, "GET/users/:id")
        XCTAssertEqual(uri?.description, "luca://shop/request/GET/users/:id")
    }

    func testEachMethodStatusAndServerStateHasItsTone() {
        XCTAssertEqual(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"].map { HTTPTone.method($0) }, [.info, .good, .warn, .special, .bad, .faint])
        XCTAssertEqual(["2xx", "3xx", "4xx", "5xx", nil].map { HTTPTone.status($0) }, [.good, .info, .warn, .bad, .faint])
        XCTAssertEqual(["running", "starting", "failed", "stopped"].map { HTTPTone.serve($0) }, [.good, .info, .bad, .faint])
    }

    func testTheEndpointKeysAreInTheDefaultKeymap() {
        let map = Keymap.merged(defaults: DefaultKeymap.file, user: nil)
        let endpoints = ["lucaEndpoints.down", "lucaEndpoints.up", "lucaEndpoints.open", "lucaEndpoints.serve", "lucaEndpoints.log",
                         "lucaEndpoints.reload", "lucaEndpoints.restart"]
        let request = ["lucaRequest.send", "lucaRequest.serve", "lucaRequest.edit", "lucaRequest.headers", "lucaRequest.view",
                       "lucaRequest.clear", "lucaRequest.endpoints", "lucaRequest.restart"]
        for action in endpoints + request + ["luca.endpoints"] {
            let binding = map.binding(for: action)
            XCTAssertNotNil(binding, action)
            XCTAssertFalse(binding?.label.isEmpty ?? true, action)
        }
        for action in endpoints { XCTAssertEqual(map.binding(for: action)?.kind, "luca-endpoints", action) }
        for action in request { XCTAssertEqual(map.binding(for: action)?.kind, "luca-request", action) }
        XCTAssertEqual(map.binding(for: "luca.endpoints")?.scope, .leader)
        XCTAssertEqual(map.binding(for: "luca.endpoints")?.spec, "Space h")
    }

    @MainActor func testTheKindsAreRegistered() {
        TileKinds.registerBuiltIns()
        XCTAssertNotNil(TileKinds.kind(for: TileURI.luca(project: "shop", tool: "endpoints")))
        XCTAssertNotNil(TileKinds.kind(for: TileURI.luca(project: "shop", tool: "request", id: "GET/users")))
    }
}
