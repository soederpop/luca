/**
 * luca.cli.ts — Project-level CLI customization
 *
 * This file is automatically loaded by the `luca` CLI before any command runs.
 * Use it to:
 *
 * - Discover project-level helpers (features, commands, endpoints)
 * - Register custom context variables accessible in `luca eval`
 * - Set up project-specific container configuration
 *
 * Exports:
 *   main(container)    — called at CLI startup, before command execution
 *   onStart(container) — called when the container's 'started' event fires
 *
 * Example:
 *   export async function main(container: any) {
 *     await container.helpers.discoverAll()
 *     container.addContext('myFeature', container.feature('myFeature'))
 *   }
 */

export async function main(container: any) {
  // Project helpers (commands/, features/, clients/, servers/, endpoints/) are
  // auto-discovered by the CLI before dispatch — no discoverAll() needed here.
  // (Opt out with LUCA_COMMAND_DISCOVERY=commands-only.)

  // Handle unknown commands gracefully instead of silently failing
  container.onMissingCommand(async ({ phrase }: { phrase: string }) => {
    container.command('help').dispatch()
  })

  // ───────────────────────────────────────────────────────────────────────────
  // Recipes — uncomment and adapt. main() runs once, before any command or
  // assistant starts, so it's the place to register machine-wide resources.
  // Each recipe has a `luca describe <name>.<method>` you can read for details.
  // ───────────────────────────────────────────────────────────────────────────

  // 1) Local model providers ──────────────────────────────────────────────────
  // Register self-hosted, OpenAI-compatible endpoints (LM Studio, Ollama, vLLM,
  // llama.cpp, a LAN GPU box) once here, then reference them by id from any
  // assistant's CORE.md frontmatter:  provider: chief
  // registerLocal defaults to the openai-chat-completions dialect and no auth —
  // you just give it a base URL and a default model. For a server that needs a
  // key, pass { apiKeyEnv: 'MY_KEY' } (read from the environment at call time).
  // → luca describe modelProviders.registerLocal
  //
  // const models = container.feature('modelProviders')
  // models.registerLocal('chief', 'http://chief:1234/v1', 'qwen2.5-32b')
  // models.registerLocal('dgx',   'http://192.168.1.50:8000/v1', 'llama-3.3-70b')

  // 2) Extra skill locations ──────────────────────────────────────────────────
  // Point the skills library at more folders of SKILL.md files — a shared team
  // repo, a sibling project. Locations persist to ~/.luca/skills.json by default;
  // pass { persist: false } for one that should live only for this process.
  // → luca describe skillsLibrary.addLocation
  //
  // await container.feature('skillsLibrary').addLocation(
  //   container.paths.resolve(container.os.homedir, 'work', 'shared-skills'),
  // )

  // 3) Extra assistant locations ──────────────────────────────────────────────
  // assistantsManager scans ~/.luca/assistants/ and ./assistants/ by default.
  // Add more folders (e.g. a shared assistants repo) and it re-runs discovery,
  // so `luca chat <name>` can find assistants that live outside this project.
  // → luca describe assistantsManager.addDiscoveryFolder
  //
  // await container.feature('assistantsManager').addDiscoveryFolder(
  //   container.paths.resolve(container.os.homedir, 'work', 'team-assistants'),
  // )

  // 4) Plugins ────────────────────────────────────────────────────────────────
  // A plugin is a folder of luca helpers (commands/features/servers/skills) with
  // an optional luca.plugin.ts. Drop one in ~/.luca/plugins/<name> and load it by
  // name, or give container.use() an absolute path. Loading is async, so await
  // container.start() before relying on the plugin's helpers. You can also load
  // plugins without editing this file via the LUCA_PLUGINS=name1,name2 env var.
  //
  // container.use('agentic-loop')  // resolves ~/.luca/plugins/agentic-loop
  // container.use(container.paths.resolve(container.os.homedir, 'dev', 'my-plugin'))
  // await container.start()
}
