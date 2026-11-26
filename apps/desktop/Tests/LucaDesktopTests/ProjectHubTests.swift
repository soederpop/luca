import XCTest
@testable import LucaDesktop

final class ProjectListTests: XCTestCase {
    let now = Date(timeIntervalSince1970: 1_800_000_000)

    func testAddGivesAnIdFromTheFolderName() {
        var list = ProjectList()
        let entry = list.add(path: "/Users/me/@luca", now: now)
        XCTAssertEqual(entry.id, "luca")
        XCTAssertEqual(entry.path, "/Users/me/@luca")
        XCTAssertEqual(entry.lastOpened, now)
    }

    func testTheSameFolderKeepsItsIdAndMovesToTheFront() {
        var list = ProjectList()
        list.add(path: "/a/acme", now: now)
        list.add(path: "/a/south", now: now.addingTimeInterval(10))
        let again = list.add(path: "/a/acme", now: now.addingTimeInterval(20))
        XCTAssertEqual(again.id, "acme")
        XCTAssertEqual(list.projects.count, 2)
        XCTAssertEqual(list.recent.map(\.id), ["acme", "south"])
    }

    func testTwoFoldersWithOneNameGetDifferentIds() {
        var list = ProjectList()
        XCTAssertEqual(list.add(path: "/a/app", now: now).id, "app")
        XCTAssertEqual(list.add(path: "/b/app", now: now).id, "app-2")
        XCTAssertEqual(list.add(path: "/c/App", now: now).id, "app-3")
    }

    func testSlugKeepsOnlyAddressSafeCharacters() {
        XCTAssertEqual(ProjectList.slug("@luca"), "luca")
        XCTAssertEqual(ProjectList.slug("My Project (old)"), "my-project-old")
        XCTAssertEqual(ProjectList.slug(".hidden"), "hidden")
        XCTAssertEqual(ProjectList.slug("@@@"), "project")
        XCTAssertEqual(ProjectList.slug("v1.2_x"), "v1.2_x")
    }

    func testNormalize() {
        XCTAssertEqual(ProjectList.normalize("~/@luca/", home: "/Users/me"), "/Users/me/@luca")
        XCTAssertEqual(ProjectList.normalize("~", home: "/Users/me"), "/Users/me")
        XCTAssertEqual(ProjectList.normalize("code/x", home: "/Users/me"), "/Users/me/code/x")
        XCTAssertEqual(ProjectList.normalize("/a/b/../c//", home: "/Users/me"), "/a/c")
        XCTAssertEqual(ProjectList.normalize("  '/a/my dir'  ", home: "/h"), "/a/my dir")
    }

    func testFileRoundTripsAndABrokenFileIsEmpty() {
        var list = ProjectList()
        list.add(path: "/a/acme", now: now)
        list.setName("@me/acme", for: "acme")
        let back = ProjectList.decode(list.encoded())
        XCTAssertEqual(back, list)
        XCTAssertEqual(back.project("acme")?.label, "@me/acme")
        XCTAssertEqual(ProjectList.decode(Data("not json".utf8)), ProjectList())
        XCTAssertEqual(ProjectList.decode(nil), ProjectList())
    }

    func testReadsAHandWrittenFile() {
        let text = #"{"projects":[{"id":"x","path":"/x"},{"id":"y","path":"/y","lastOpened":"2027-01-15T08:00:00Z"}]}"#
        let list = ProjectList.decode(Data(text.utf8))
        XCTAssertEqual(list.recent.map(\.id), ["y", "x"])
        XCTAssertEqual(list.project("x")?.label, "x")
    }
}

final class HostCommandTests: XCTestCase {
    func testDefaultIsLucaWorkbench() {
        XCTAssertEqual(HostCommand.words(settings: nil, environment: [:]), ["luca", "workbench"])
        XCTAssertEqual(HostCommand.words(settings: "theme: dark\n", environment: [:]), ["luca", "workbench"])
    }

    func testSettingsListIsUsed() {
        let yaml = "hostCommand: [bun, /Users/me/@luca/src/cli/cli.ts, workbench]\n"
        XCTAssertEqual(HostCommand.words(settings: yaml, environment: [:]), ["bun", "/Users/me/@luca/src/cli/cli.ts", "workbench"])
        let block = "hostCommand:\n  - /opt/luca\n  - workbench\n"
        XCTAssertEqual(HostCommand.words(settings: block, environment: [:]), ["/opt/luca", "workbench"])
        XCTAssertEqual(HostCommand.words(settings: "hostCommand: luca workbench --x\n", environment: [:]), ["luca", "workbench", "--x"])
    }

    func testEnvironmentWins() {
        let yaml = "hostCommand: [luca, workbench]\n"
        let env = [HostCommand.environmentName: "bun  /x/cli.ts workbench"]
        XCTAssertEqual(HostCommand.words(settings: yaml, environment: env), ["bun", "/x/cli.ts", "workbench"])
        // An empty value does not count.
        XCTAssertEqual(HostCommand.words(settings: yaml, environment: [HostCommand.environmentName: "  "]), ["luca", "workbench"])
    }

    func testBrokenSettingsFallBack() {
        XCTAssertEqual(HostCommand.words(settings: "hostCommand: [", environment: [:]), ["luca", "workbench"])
        XCTAssertEqual(HostCommand.words(settings: "hostCommand: []", environment: [:]), ["luca", "workbench"])
    }

    func testExecutableSearchesThePathInOrder() {
        let present: Set<String> = ["/opt/homebrew/bin/luca", "/Users/me/.bun/bin/luca", "/Users/me/.bun/bin/bun"]
        let check: (String) -> Bool = { present.contains($0) }
        let search = ["/usr/bin", "/Users/me/.bun/bin", "/opt/homebrew/bin"]
        XCTAssertEqual(HostCommand.executable("luca", searchPath: search, home: "/Users/me", isExecutable: check), "/Users/me/.bun/bin/luca")
        XCTAssertNil(HostCommand.executable("nope", searchPath: search, home: "/Users/me", isExecutable: check))
        XCTAssertEqual(HostCommand.executable("~/.bun/bin/bun", searchPath: [], home: "/Users/me", isExecutable: check), "/Users/me/.bun/bin/bun")
        XCTAssertNil(HostCommand.executable("/missing/luca", searchPath: search, home: "/Users/me", isExecutable: check))
    }

    func testSearchPathPutsTheLoginShellFirstAndDropsRepeats() {
        let path = HostCommand.searchPath(loginPath: "/a:/b", environmentPath: "/usr/bin:/b", home: "/h")
        XCTAssertEqual(Array(path.prefix(3)), ["/a", "/b", "/usr/bin"])
        XCTAssertTrue(path.contains("/h/.bun/bin"))
        XCTAssertEqual(path.count, Set(path).count)
    }

    func testLoginPathIsReadBetweenTheMarkers() {
        let m = HostCommand.pathMarker
        XCTAssertEqual(HostCommand.loginPath(fromOutput: "Welcome!\n\(m)/a:/b\(m)"), "/a:/b")
        XCTAssertNil(HostCommand.loginPath(fromOutput: "no markers"))
        XCTAssertNil(HostCommand.loginPath(fromOutput: "\(m)\(m)"))
    }
}

final class HostHandshakeTests: XCTestCase {
    func testParsesTheFirstLine() {
        XCTAssertEqual(HostHandshake.parse(#"{"port":53122,"token":"abc123"}"#), .init(port: 53122, token: "abc123"))
        XCTAssertEqual(HostHandshake.parse("  {\"token\":\"t\",\"port\":1}\r\n"), .init(port: 1, token: "t"))
    }

    func testRefusesAnythingElse() {
        XCTAssertNil(HostHandshake.parse("[workbench] listening"))
        XCTAssertNil(HostHandshake.parse(#"{"port":0,"token":"t"}"#))
        XCTAssertNil(HostHandshake.parse(#"{"port":70000,"token":"t"}"#))
        XCTAssertNil(HostHandshake.parse(#"{"port":"8080","token":"t"}"#))
        XCTAssertNil(HostHandshake.parse(#"{"port":true,"token":"t"}"#))
        XCTAssertNil(HostHandshake.parse(#"{"port":8080,"token":""}"#))
        XCTAssertNil(HostHandshake.parse(#"{"port":8080}"#))
        XCTAssertNil(HostHandshake.parse("{not json"))
    }

    func testLinesKeepThePartialRest() {
        let (lines, rest) = HostHandshake.lines("noise\r\n{\"port\":1,\"token\":\"t\"}\npart")
        XCTAssertEqual(lines, ["noise", #"{"port":1,"token":"t"}"#])
        XCTAssertEqual(rest, "part")
        XCTAssertEqual(HostHandshake.lines("abc").lines, [])
    }
}

final class LucaURITests: XCTestCase {
    func testParsesAndPrintsBack() {
        for text in ["luca://luca/project", "luca://luca/helper/features/fs", "luca://my-app/console?view=log", "luca://luca/registry/features"] {
            guard let uri = TileURI(text) else { return XCTFail("did not parse \(text)") }
            XCTAssertEqual(uri.scheme, .luca)
            XCTAssertEqual(uri.description, text)
        }
    }

    func testFields() throws {
        let uri = try XCTUnwrap(TileURI("luca://luca/helper/features/fs"))
        XCTAssertEqual(uri.project, "luca")
        XCTAssertEqual(uri.kind, "helper")
        XCTAssertEqual(uri.id, "features/fs")
        XCTAssertEqual(uri.kindKey, "luca-helper")
        XCTAssertEqual(TileURI.luca(project: "luca", tool: "helper", id: "features/fs"), uri)
    }

    func testAppAddressesAndNoOtherScheme() throws {
        let uri = try XCTUnwrap(TileURI("app://desktop/file/layouts/a.yml"))
        XCTAssertEqual(uri.scheme, .app)
        XCTAssertNil(uri.project)
        XCTAssertEqual(uri.kindKey, "app-file")
        XCTAssertEqual(uri.id, "layouts/a.yml")
        XCTAssertEqual(TileURI.app("file", id: "layouts/a.yml"), uri)
        XCTAssertNil(TileURI("other://acme/project/x"), "only luca:// and app:// parse")
        XCTAssertNil(TileURI("http://acme/project"))
    }

    func testCodableKeepsTheScheme() throws {
        let uri = TileURI.luca(project: "luca", tool: "project")
        let data = try JSONEncoder().encode([uri])
        XCTAssertEqual(String(decoding: data, as: UTF8.self), #"["luca:\/\/luca\/project"]"#)
        XCTAssertEqual(try JSONDecoder().decode([TileURI].self, from: data), [uri])
    }

    func testOwnerIds() {
        XCTAssertEqual(ProjectHub.ownerId("luca"), "luca:luca")
        XCTAssertEqual(ProjectHub.project(ofOwner: "luca:luca"), "luca")
        XCTAssertNil(ProjectHub.project(ofOwner: "@acme"))
    }

    @MainActor
    func testWorkbenchKeysAreInTheKeymap() {
        let yaml = DefaultKeymap.yaml
        XCTAssertTrue(yaml.contains("palette.projects:"))
        XCTAssertTrue(yaml.contains("scope: kind.luca-project"))
    }
}
