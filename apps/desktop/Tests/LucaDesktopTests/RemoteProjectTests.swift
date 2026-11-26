import XCTest
@testable import LucaDesktop

final class RemoteProjectTests: XCTestCase {
    func testParsesHostAndFolder() {
        XCTAssertEqual(RemoteProject.parse("gpubox:~/@lab")?.host, "gpubox")
        XCTAssertEqual(RemoteProject.parse("gpubox:~/@lab/")?.path, "~/@lab")
        XCTAssertEqual(RemoteProject.parse("me@box.local:/srv/app")?.host, "me@box.local")
        XCTAssertEqual(RemoteProject.parse("gpubox:~")?.path, "~")
        // Local paths, and things ssh must never see as a host.
        XCTAssertNil(RemoteProject.parse("~/@lab"))
        XCTAssertNil(RemoteProject.parse("/tmp/a:b"))
        XCTAssertNil(RemoteProject.parse("gpubox:lab"))
        XCTAssertNil(RemoteProject.parse("-oProxyCommand=x:/tmp"))
        XCTAssertNil(RemoteProject.parse("a b:/tmp"))
        XCTAssertNil(RemoteProject.parse(":/tmp"))
    }

    func testQuotesForTheRemoteShell() {
        XCTAssertEqual(RemoteProject.quote("luca"), "luca")
        XCTAssertEqual(RemoteProject.quote("my app"), "'my app'")
        XCTAssertEqual(RemoteProject.quote("it's"), "'it'\\''s'")
        XCTAssertEqual(RemoteProject.quote("$(rm -rf x)"), "'$(rm -rf x)'")
        XCTAssertEqual(RemoteProject.cdArgument("~/my app"), "~/'my app'")
        XCTAssertEqual(RemoteProject.cdArgument("/srv/a;b"), "'/srv/a;b'")
        XCTAssertEqual(RemoteProject.cdArgument("~"), "~")
    }

    func testTheCommandKeepsTheHostAsTheProcessThatHoldsStdin() {
        let line = RemoteProject.remoteCommand(path: "~/@lab", words: ["luca", "workbench"])
        XCTAssertEqual(line, "exec \"${SHELL:-/bin/sh}\" -ilc 'cd ~/@lab && exec luca workbench'")
        let odd = RemoteProject.remoteCommand(path: "/srv/it's", words: ["bun", "/x y/cli.ts", "workbench"])
        XCTAssertTrue(odd.contains("exec bun"))
        XCTAssertFalse(odd.contains("cd /srv/it's "))
    }

    func testSshArguments() {
        let host = RemoteProject.hostArguments(host: "gpubox", path: "~/x", words: ["luca", "workbench"])
        XCTAssertTrue(host.contains("BatchMode=yes"))
        XCTAssertTrue(host.contains("-T"))
        XCTAssertEqual(host[host.count - 3], "--")
        XCTAssertEqual(host[host.count - 2], "gpubox")
        let tunnel = RemoteProject.tunnelArguments(host: "gpubox", localPort: 5001, remotePort: 6002)
        XCTAssertTrue(tunnel.contains("127.0.0.1:5001:127.0.0.1:6002"))
        XCTAssertTrue(tunnel.contains("ExitOnForwardFailure=yes"))
        XCTAssertTrue(tunnel.contains("-N"))
        XCTAssertEqual(tunnel.last, "gpubox")
        XCTAssertEqual(RemoteProject.shellArguments(host: "gpubox", path: "~/x").first, "-t")
    }

    func testHostCommandPerMachine() {
        let settings = """
        hostCommand: [bun, /local/cli.ts, workbench]
        hosts:
          gpubox:
            hostCommand: [bun, /home/me/luca/src/cli/cli.ts, workbench]
          dev: { hostCommand: "~/bin/luca workbench" }
        """
        XCTAssertEqual(RemoteProject.words(settings: settings, host: "gpubox"), ["bun", "/home/me/luca/src/cli/cli.ts", "workbench"])
        XCTAssertEqual(RemoteProject.words(settings: settings, host: "dev"), ["~/bin/luca", "workbench"])
        // The local override does not go to another machine.
        XCTAssertEqual(RemoteProject.words(settings: settings, host: "other"), ["luca", "workbench"])
        XCTAssertEqual(RemoteProject.words(settings: nil, host: "gpubox"), ["luca", "workbench"])
    }

    func testErrorsSayWhatToDo() {
        XCTAssertEqual(RemoteProject.explain(HostStartError.exited(255, "Permission denied (publickey)."), host: "gpubox"),
                       "ssh to gpubox failed: Permission denied (publickey).")
        XCTAssertTrue(RemoteProject.explain(HostStartError.exited(127, "zsh:1: command not found: luca"), host: "gpubox").contains("hosts.gpubox.hostCommand"))
        let old = RemoteProject.explain(HostStartError.exited(0, "(eval):1: can't change option: zle"), host: "gpubox")
        XCTAssertFalse(old.contains("zle"))
        XCTAssertTrue(old.hasPrefix("luca on gpubox started no workbench host (exit 0)"))
        XCTAssertTrue(old.contains("hosts.gpubox.hostCommand"))
        XCTAssertEqual(RemoteProject.explain(HostStartError.timedOut(90), host: "gpubox"), "Host printed no port in 90s")
    }

    func testHostsOfAnSshConfig() {
        let config = """
        Host gpubox buildbox
          HostName 100.1.2.3
        Host *
          ServerAliveInterval 30
        host box
        Host !bad *.internal
        Host gpubox
        """
        XCTAssertEqual(RemoteProject.hosts(inConfig: config), ["gpubox", "buildbox", "box"])
    }

    func testTheListKeepsLocalAndRemoteApart() {
        var list = ProjectList()
        let local = list.add(path: "/Users/me/lab", now: Date())
        let remote = list.add(host: "gpubox", path: "~/lab", now: Date())
        XCTAssertEqual(local.id, "lab")
        XCTAssertEqual(remote.id, "lab-gpubox")
        XCTAssertTrue(remote.isRemote)
        XCTAssertEqual(remote.place, "gpubox:~/lab")
        // The same host and folder is the same project; another host is another.
        XCTAssertEqual(list.add(host: "gpubox", path: "~/lab", now: Date()).id, "lab-gpubox")
        XCTAssertEqual(list.add(host: "dev", path: "~/lab", now: Date()).id, "lab-dev")
        XCTAssertEqual(list.projects.count, 3)
        XCTAssertNil(list.project(atPath: "~/lab"))
        // It survives the file, and an old file with no host still reads.
        let again = ProjectList.decode(list.encoded())
        XCTAssertEqual(again.project("lab-gpubox")?.host, "gpubox")
        let old = ProjectList.decode(Data("{\"projects\":[{\"id\":\"a\",\"path\":\"/a\"}]}".utf8))
        XCTAssertNil(old.project("a")?.host)
    }

    func testAFreePortIsFreeAndNothingAnswersOnIt() {
        guard let port = RemoteProject.freeLocalPort() else { return XCTFail("no port") }
        XCTAssertGreaterThan(port, 1023)
        XCTAssertFalse(RemoteProject.accepts(port: port))
    }
}
