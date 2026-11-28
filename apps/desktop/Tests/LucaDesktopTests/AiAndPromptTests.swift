import XCTest
@testable import LucaDesktop

final class AiAndPromptTests: XCTestCase {
    private let json = """
    {"defaultProvider":"openai","defaultText":"openai: what an assistant uses","providers":[
       {"id":"openai","label":"OpenAI","apiMode":"openai-chat-completions","model":"gpt-5.4-mini","baseURL":"https://api.openai.com/v1","status":"ready","statusText":"OPENAI_API_KEY is set","source":"built in","isDefault":true}],
     "keys":[{"env":"OPENAI_API_KEY","label":"OpenAI","set":true,"where":"this project's .env","providers":["openai"]},
             {"env":"ANTHROPIC_API_KEY","label":"Anthropic","set":false,"where":null,"providers":[]}],
     "local":[{"id":"chat","label":"Local chat model","ok":false,"detail":"not downloaded","fix":"luca setup --chat-model"},
              {"id":"binary","label":"llama-server","ok":true,"detail":"installed","fix":null}],
     "agents":[{"id":"claude","label":"Claude Code","available":true,"version":"2.1.0","path":"claude","detail":"works"},
               {"id":"hermes","label":"Hermes Agent","available":false,"version":"","path":"hermes","detail":"not found"}],
     "servers":[{"baseURL":"http://127.0.0.1:1234/v1","host":"127.0.0.1","port":1234,"title":"LM Studio on this Mac","source":"localhost","models":["qwen3"],"latencyMs":12,"profileId":null}],
     "scannedAt":1795633166016,
     "configFiles":[{"kind":"machine","path":"/x/model-providers.yml","display":"~/.luca/model-providers.yml","exists":false,"providers":[]}],
     "envWarning":null}
    """

    func testDecodesTheAiView() throws {
        let v = try JSONDecoder().decode(WorkbenchAi.self, from: Data(json.utf8))
        XCTAssertEqual(v.keys[0].where, "this project's .env")
        XCTAssertNil(v.keys[1].where)
        XCTAssertEqual(v.local[0].fix, "luca setup --chat-model")
        XCTAssertNil(v.servers[0].profileId)
        XCTAssertEqual(AiContent.label(v), "openai · 1 of 2 agents")
    }

    func testAChangeAnswerDecodesWithOrWithoutAdded() throws {
        let key = try JSONDecoder().decode(WorkbenchAiChange.self, from: Data("{\"ok\":true,\"env\":\"OPENAI_API_KEY\",\"file\":\"~/p/.env\",\"view\":\(json)}".utf8))
        XCTAssertEqual(key.added, [])
        XCTAssertEqual(key.file, "~/p/.env")
        let add = try JSONDecoder().decode(WorkbenchAiChange.self, from: Data("{\"ok\":true,\"added\":[\"local-1234\"],\"file\":\"f\",\"view\":\(json)}".utf8))
        XCTAssertEqual(add.added, ["local-1234"])
    }

    func testSetupOpensTheCommandWithItsFlagsAndDoesNotRunIt() {
        let uri = AiContent.setupAddress(project: "shop", fix: "luca setup --chat-model")
        XCTAssertEqual(uri.kindKey, "luca-command")
        XCTAssertEqual(uri.id, "setup")
        XCTAssertEqual(uri.option("chat-model"), "true")
        XCTAssertNil(uri.option("run"))
    }

    func testThePromptAddressRunsAtOnce() {
        let uri = PromptRunner.address(project: "shop", target: "claude", file: "docs/task.md")
        XCTAssertEqual(uri.kindKey, "luca-command")
        XCTAssertEqual(uri.id, "prompt")
        XCTAssertEqual(uri.option("target"), "claude")
        XCTAssertEqual(uri.option("files"), "docs/task.md")
        XCTAssertEqual(uri.option("run"), "1")
        XCTAssertNil(uri.option("dry-run"))
        XCTAssertEqual(PromptRunner.address(project: "shop", target: "claude", file: "a.md", dryRun: true).option("dry-run"), "true")
    }

    func testTargetsThatCanRunComeFirstAndTheDefaultLeads() throws {
        let answer = try JSONDecoder().decode(WorkbenchPromptTargets.self, from: Data("""
        {"file":"docs/task.md","defaultTarget":"codex","targets":[
          {"id":"researcher","label":"researcher","kind":"assistant","detail":"gpt-5.4-mini","available":true},
          {"id":"hermes","label":"Hermes Agent","kind":"agent","detail":"not found on this machine","available":false},
          {"id":"codex","label":"OpenAI Codex","kind":"agent","detail":"0.50","available":true}]}
        """.utf8))
        let choices = PromptRunner.choices(answer)
        XCTAssertEqual(choices.map(\.target.id), ["codex", "researcher", "hermes"])
        XCTAssertTrue(choices[0].detail.contains("project default"))
        XCTAssertTrue(choices[2].detail.contains("not found"))
    }

    func testKeys() {
        let map = Keymap.merged(defaults: DefaultKeymap.file, user: nil)
        XCTAssertEqual(TileURI("luca://shop/ai")?.kindKey, "luca-ai")
        XCTAssertEqual(map.binding(for: "luca.ai")?.scope, .leader)
        for action in ["lucaAi.scan", "lucaAi.add", "lucaAi.key", "lucaAi.agents", "lucaAi.setup", "lucaAi.reload", "lucaAi.restart"] {
            XCTAssertEqual(map.binding(for: action)?.kind, "luca-ai", action)
        }
        XCTAssertEqual(map.binding(for: "lucaDoc.prompt")?.kind, "luca-doc")
        XCTAssertEqual(map.binding(for: "lucaDoc.promptDry")?.kind, "luca-doc")
        XCTAssertEqual(map.binding(for: "lucaFile.prompt")?.kind, "luca-file")
    }
}

final class SetupTerminalTests: XCTestCase {
    func testSetupAddressIsItsOwnTerminalThatRunsLucaSetup() {
        let uri = TerminalContent.setupAddress(project: "lab")
        XCTAssertEqual(uri.description, "luca://lab/terminal/setup?run=setup")
        XCTAssertEqual(TileURI(uri.description), uri)
        XCTAssertEqual(uri.kindKey, "luca-terminal")
        XCTAssertEqual(TerminalContent.startCommands[uri.option("run") ?? ""], "luca setup")
    }

    func testOnlyNamedCommandsRun() {
        XCTAssertNil(TerminalContent.startCommands["rm -rf ~"])
    }

    func testFirstTimeUserTerminalsInstallThenSignIn() {
        let claude = TerminalContent.startCommands["claude"] ?? ""
        XCTAssertTrue(claude.contains("https://claude.ai/install.sh"))
        XCTAssertTrue(claude.contains("claude auth login"))
        let codex = TerminalContent.startCommands["codex"] ?? ""
        XCTAssertTrue(codex.contains("brew install --cask codex"))
        XCTAssertTrue(codex.contains("npm install -g @openai/codex"))
        XCTAssertTrue(codex.contains("codex login"))
        XCTAssertEqual(TerminalContent.startCommands["chat-model"], "luca setup --chat-model")
    }

    func testFirstTimeUserRunsTheGuideOnThePortfolioHost() {
        let uri = PortfolioProject.firstTimeUser
        XCTAssertEqual(uri.authority, PortfolioProject.id)
        XCTAssertEqual(uri.kindKey, "luca-chat")
        XCTAssertEqual(uri.option("assistant"), "guide:first-time-user")
    }
}
