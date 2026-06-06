# Consumer Binary Bundler Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Replace the current project-local `bundle-consumer-project` POC with a proper Luca-native consumer binary bundler that compiles cwd-oriented project binaries like `loopy`.

**Architecture:** Keep Luca's runtime layers intact (`Container` -> `NodeContainer` -> `AGIContainer`) and replace only the baked CLI command layer. Extract reusable CLI runner behavior from `src/cli/cli.ts`, add a built-in `src/commands/bundle.ts`, generate an isolated consumer entry/manifest, and compile it without writing generated artifacts into Luca `src/` or guessing a `lucaRoot` from `os.homedir()`.

**Tech Stack:** Bun, TypeScript, Luca container/commands/helpers registries, Bun compile, bun:test.

---

## Reference Documents

Read these first:

- `docs/ideas/cwd-oriented-consumer-binary-bundler.md` — alignment spec for the desired model.
- `src/cli/cli.ts` — current Luca CLI entrypoint and dispatch behavior.
- `src/commands/index.ts` — current baked Luca command side-effect imports.
- `src/commands/help.ts` — current help formatting and command source grouping.
- `src/command.ts` — command registry, module shapes, and grafting behavior.
- `src/node/container.ts` — cwd-oriented `NodeContainer` and `container.paths` behavior.
- `src/agi/container.server.ts` — AGI container layer and cwd-oriented docs root.
- `commands/bundle-consumer-project.ts` — POC to learn from, then retire.

## Implementation Rules

- Preserve cwd orientation. `container.paths.resolve(...)` and `container.cwd` are the project world.
- Do not introduce any `lucaRoot` path derived from `os.homedir()`.
- Do not write generated consumer artifacts under `src/cli/bundles/` or anywhere in Luca source.
- Local cwd `commands/` must be auto-discovered by compiled consumer binaries, same as normal `luca`.
- Local cwd features/clients/servers/endpoints/selectors are discovered only by userland (`luca.cli.ts`, commands, or explicit code), not by generic CLI boot.
- Keep runtime primitives available. Only replace the baked CLI command set.
- Prefer small shared modules over duplicated generated CLI code.
- Every code task must include a failing test first where practical.
- Commit after each completed task.

---

## Phase 1: Extract a Shared CLI Runner

### Task 1: Add tests for current CLI source classification behavior

**Objective:** Capture current command source grouping before extracting CLI runner code.

**Files:**
- Create: `test/cli-runner.test.ts`
- Read: `src/cli/cli.ts`
- Read: `src/commands/help.ts`

**Step 1: Write failing test scaffold**

Create `test/cli-runner.test.ts`:

```ts
import { describe, expect, it } from 'bun:test'

// This file starts as a placeholder for the CLI runner extraction.
// The real imports are added in Task 2 after src/cli/runner.ts exists.

describe('cli runner', () => {
  it('has a test file ready for runner extraction', () => {
    expect(true).toBe(true)
  })
})
```

**Step 2: Run test**

Run:

```sh
bun test test/cli-runner.test.ts
```

Expected: PASS. This task only creates the test file so future tasks have a known target.

**Step 3: Commit**

```sh
git add test/cli-runner.test.ts
git commit -m "test: add cli runner test scaffold"
```

---

### Task 2: Extract reusable CLI runner module

**Objective:** Move reusable boot/dispatch logic out of `src/cli/cli.ts` into `src/cli/runner.ts` without changing behavior.

**Files:**
- Create: `src/cli/runner.ts`
- Modify: `src/cli/cli.ts`
- Modify: `test/cli-runner.test.ts`

**Step 1: Write failing tests for pure helper functions**

Update `test/cli-runner.test.ts`:

```ts
import { describe, expect, it } from 'bun:test'
import { classifyCommandSources, resolveScriptCandidate } from '../src/cli/runner'

describe('cli runner', () => {
  it('classifies built-in, project, and user commands from snapshots', () => {
    const builtin = new Set(['help', 'describe'])
    const afterProject = new Set(['help', 'describe', 'workflow'])
    const afterUser = new Set(['help', 'describe', 'workflow', 'global-tool'])

    const result = classifyCommandSources(builtin, afterProject, afterUser)

    expect([...result.builtinCommands].sort()).toEqual(['describe', 'help'])
    expect([...result.projectCommands]).toEqual(['workflow'])
    expect([...result.userCommands]).toEqual(['global-tool'])
  })

  it('resolves script candidates in cwd order', () => {
    const checked: string[] = []
    const container = {
      paths: { resolve: (p: string) => `/cwd/${p}` },
      fs: {
        exists: (p: string) => {
          checked.push(p)
          return p === '/cwd/task.ts'
        },
      },
    }

    expect(resolveScriptCandidate('task', container as any)).toBe('/cwd/task.ts')
    expect(checked).toEqual(['/cwd/task', '/cwd/task.ts'])
  })
})
```

Run:

```sh
bun test test/cli-runner.test.ts
```

Expected: FAIL because `src/cli/runner.ts` does not exist.

**Step 2: Create `src/cli/runner.ts`**

Create the module with these exports:

```ts
import { homedir } from 'os'
import { join } from 'path'

export interface CommandSources {
  builtinCommands: Set<string>
  projectCommands: Set<string>
  userCommands: Set<string>
}

export interface RunCliOptions {
  binaryName?: string
  loadGlobalCli?: boolean
  discoverLocalCommands?: boolean
  discoverUserHelpers?: boolean
  implicitRun?: boolean
  onBeforeDispatch?: (container: any) => Promise<void> | void
}

export function classifyCommandSources(
  builtinCommands: Set<string>,
  afterProject: Set<string>,
  afterUser: Set<string>,
): CommandSources {
  return {
    builtinCommands,
    projectCommands: new Set([...afterProject].filter((n) => !builtinCommands.has(n))),
    userCommands: new Set([...afterUser].filter((n) => !builtinCommands.has(n) && !afterProject.has(n))),
  }
}

export function resolveScriptCandidate(ref: string, container: any): string | null {
  const candidates = [ref, `${ref}.ts`, `${ref}.js`, `${ref}.md`]
  for (const candidate of candidates) {
    const resolved = container.paths.resolve(candidate)
    if (container.fs.exists(resolved)) return resolved
  }
  return null
}

export async function loadCliModule(container: any, modulePath: string) {
  if (!container.fs.exists(modulePath)) return
  const helpers = container.feature('helpers') as any
  const exports = await helpers.loadModuleExports(modulePath)
  if (typeof exports?.main === 'function') await exports.main(container)
  if (typeof exports?.onStart === 'function') container.once('started', () => exports.onStart(container))
}

export async function discoverProjectCommands(container: any) {
  const helpers = container.feature('helpers') as any
  await helpers.discover('commands')
}

const DISCOVERABLE_USER_TYPES = ['features', 'clients', 'servers', 'commands', 'selectors'] as const

export async function discoverUserHelpers(container: any) {
  const lucaHome = join(homedir(), '.luca')
  const helpers = container.feature('helpers') as any
  for (const type of DISCOVERABLE_USER_TYPES) {
    const dir = join(lucaHome, type)
    if (container.fs.exists(dir)) await helpers.discover(type, { directory: dir })
  }
}

export async function runCli(container: any, options: RunCliOptions = {}) {
  const {
    loadGlobalCli: shouldLoadGlobalCli = true,
    discoverLocalCommands = true,
    discoverUserHelpers: shouldDiscoverUserHelpers = true,
    implicitRun = true,
  } = options

  const discovery = process.env.LUCA_COMMAND_DISCOVERY || ''
  const builtinCommands = new Set(container.commands.available as string[])

  if (shouldLoadGlobalCli) {
    await loadCliModule(container, join(homedir(), '.luca', 'luca.cli.ts'))
  }

  await loadCliModule(container, container.paths.resolve('luca.cli.ts'))

  if (discoverLocalCommands && discovery !== 'disable' && discovery !== 'no-local') {
    await discoverProjectCommands(container)
  }

  const afterProject = new Set(container.commands.available as string[])

  if (shouldDiscoverUserHelpers && discovery !== 'disable' && discovery !== 'no-home') {
    await discoverUserHelpers(container)
  }

  const afterUser = new Set(container.commands.available as string[])
  ;(container as any)._commandSources = classifyCommandSources(builtinCommands, afterProject, afterUser)

  if (options.onBeforeDispatch) await options.onBeforeDispatch(container)

  const commandName = container.argv._[0] as string

  if (container.argv.help && !commandName) {
    delete container.argv.help
    container.argv._.splice(0, 0, 'help')
    await container.command('help' as any).dispatch()
    return
  }

  if (commandName && container.commands.has(commandName)) {
    await container.command(commandName as any).dispatch()
    return
  }

  if (commandName && implicitRun && resolveScriptCandidate(commandName, container)) {
    container.argv._.splice(0, 0, 'run')
    await container.command('run' as any).dispatch()
    return
  }

  if (commandName) {
    const phrase = container.argv._.join(' ')
    const missingCommandHandler = container.state.get('missingCommandHandler') as any
    if (typeof missingCommandHandler === 'function') {
      await missingCommandHandler({ words: container.argv._, phrase }).catch((err: any) => {
        console.error(`Missing command handler error: ${err.message}`, err)
      })
      return
    }
  }

  container.argv._.splice(0, 0, 'help')
  await container.command('help' as any).dispatch()
}
```

**Step 3: Replace duplicated logic in `src/cli/cli.ts`**

Modify `src/cli/cli.ts` so it keeps version handling, imports container and built-in commands, then calls `runCli`.

Keep the `get loopy` easter egg for now by using `onBeforeDispatch` or by leaving the old missing-command block until later. If preserving it is noisy, explicitly move it to a follow-up task rather than mixing changes.

Minimal target shape:

```ts
#!/usr/bin/env bun
// @ts-ignore — bun resolves JSON imports at bundle time
import pkg from '../../package.json'
import { BUILD_SHA, BUILD_BRANCH, BUILD_DATE } from './build-info'

const args = process.argv.slice(2)
if (args.includes('--version') || args.includes('-v')) {
  console.log(`luca v${pkg.version} (${BUILD_BRANCH}@${BUILD_SHA}) built ${BUILD_DATE}`)
  console.log(`  npm: https://www.npmjs.com/package/luca`)
  console.log(`  git: https://github.com/soederpop/luca`)
  process.exit(0)
}

import container from 'luca/agi'
import '@/commands/index.js'
import { runCli } from './runner.js'

await runCli(container)
```

If this removes `get loopy`, note it in the commit message and plan follow-up.

**Step 4: Run tests**

Run:

```sh
bun test test/cli-runner.test.ts
bun test test/command.test.ts test/node-container.test.ts
bun run src/cli/cli.ts help | head -80
```

Expected:

- tests pass
- CLI help still lists built-in commands
- project commands still show when run in a project with `commands/`

**Step 5: Commit**

```sh
git add src/cli/runner.ts src/cli/cli.ts test/cli-runner.test.ts
git commit -m "refactor: extract reusable cli runner"
```

---

### Task 3: Make help output binary-name aware

**Objective:** Allow `help` to render `loopy` or another binary name instead of hard-coded `luca`.

**Files:**
- Modify: `src/commands/help.ts`
- Modify: `src/cli/runner.ts`
- Modify: `test/cli-runner.test.ts` or create `test/help-format.test.ts`

**Step 1: Write failing test**

Create `test/help-format.test.ts`:

```ts
import { describe, expect, it } from 'bun:test'
import { formatCommandHelp } from '../src/commands/help'

const colors = new Proxy({}, {
  get(_target, prop) {
    if (prop === 'cyan') {
      const fn: any = (s: string) => s
      fn.bold = (s: string) => s
      return fn
    }
    return (s: string) => s
  },
})

describe('help formatting', () => {
  it('uses supplied binary name for command help', () => {
    const Cmd = { commandDescription: 'Demo command', argsSchema: { shape: {} } }
    const text = formatCommandHelp('demo', Cmd, colors, { binaryName: 'loopy' })
    expect(text).toContain('loopy demo')
    expect(text).not.toContain('luca demo')
  })
})
```

Run:

```sh
bun test test/help-format.test.ts
```

Expected: FAIL because `formatCommandHelp` does not accept a binary name.

**Step 2: Update `src/commands/help.ts`**

Change `formatCommandHelp` signature:

```ts
export function formatCommandHelp(
  name: string,
  Cmd: any,
  colors: any,
  options: { binaryName?: string } = {},
): string {
  const binaryName = options.binaryName || 'luca'
  // replace hard-coded luca in this function with binaryName
}
```

In the default help command, read:

```ts
const binaryName = (container as any)._binaryName || 'luca'
```

Use `binaryName` for banner text, usage text, and command examples.

**Step 3: Update runner to set `_binaryName`**

In `runCli`:

```ts
;(container as any)._binaryName = options.binaryName || 'luca'
```

**Step 4: Run tests and smoke checks**

Run:

```sh
bun test test/help-format.test.ts test/cli-runner.test.ts
bun run src/cli/cli.ts help | head -40
```

Expected:

- tests pass
- normal Luca help still says `luca`

**Step 5: Commit**

```sh
git add src/commands/help.ts src/cli/runner.ts test/help-format.test.ts
git commit -m "feat: make cli help binary-name aware"
```

---

## Phase 2: Add Consumer Bundle Core

### Task 4: Create pure bundler planning utilities

**Objective:** Add testable pure utilities for discovering bundle inputs and generating import-safe identifiers.

**Files:**
- Create: `src/cli/bundle-utils.ts`
- Create: `test/bundle-utils.test.ts`

**Step 1: Write failing tests**

Create `test/bundle-utils.test.ts`:

```ts
import { describe, expect, it } from 'bun:test'
import { commandNameFromFile, safeIdent, normalizeTargets } from '../src/cli/bundle-utils'

describe('bundle utils', () => {
  it('derives command names from top-level command files', () => {
    expect(commandNameFromFile('/tmp/app/commands/workflow.ts')).toBe('workflow')
    expect(commandNameFromFile('/tmp/app/commands/comms-service.ts')).toBe('comms-service')
  })

  it('returns null for command index files', () => {
    expect(commandNameFromFile('/tmp/app/commands/index.ts')).toBe(null)
  })

  it('creates safe import identifiers', () => {
    expect(safeIdent('comms-service')).toBe('comms_service')
    expect(safeIdent('assistants/designer')).toBe('assistants_designer')
  })

  it('normalizes comma-separated targets', () => {
    expect(normalizeTargets('darwin-arm64, linux-x64,,')).toEqual(['darwin-arm64', 'linux-x64'])
  })
})
```

Run:

```sh
bun test test/bundle-utils.test.ts
```

Expected: FAIL because module does not exist.

**Step 2: Implement `src/cli/bundle-utils.ts`**

```ts
export function safeIdent(name: string): string {
  return name.replace(/[-./]/g, '_')
}

export function commandNameFromFile(file: string): string | null {
  const base = file.split('/').pop() || ''
  if (!base || base === 'index.ts') return null
  if (!base.endsWith('.ts')) return null
  return base.replace(/\.ts$/, '')
}

export function normalizeTargets(input: string): string[] {
  return input.split(',').map((s) => s.trim()).filter(Boolean)
}

export function quoteImportPath(path: string): string {
  return JSON.stringify(path)
}
```

**Step 3: Run tests**

```sh
bun test test/bundle-utils.test.ts
```

Expected: PASS.

**Step 4: Commit**

```sh
git add src/cli/bundle-utils.ts test/bundle-utils.test.ts
git commit -m "feat: add bundle utility helpers"
```

---

### Task 5: Generate consumer manifest text

**Objective:** Generate a manifest that statically imports selected consumer helpers and registers consumer command modules using the same supported shapes as regular discovery.

**Files:**
- Modify: `src/cli/bundle-utils.ts`
- Modify: `test/bundle-utils.test.ts`

**Step 1: Write failing test**

Append to `test/bundle-utils.test.ts`:

```ts
import { generateConsumerManifest } from '../src/cli/bundle-utils'

it('generates command imports and registrations', () => {
  const text = generateConsumerManifest({
    helperFiles: ['/app/features/workflow-service.ts'],
    commandFiles: [{ file: '/app/commands/workflow.ts', name: 'workflow' }],
  })

  expect(text).toContain("import '/app/features/workflow-service.ts'")
  expect(text).toContain("import * as _cmd_workflow from '/app/commands/workflow.ts'")
  expect(text).toContain("registerBundledCommand('workflow', _cmd_workflow)")
  expect(text).toContain("typeof commandModule.run === 'function'")
  expect(text).toContain("typeof commandModule.handler === 'function'")
  expect(text).toContain("typeof mod.default === 'function'")
})
```

Run:

```sh
bun test test/bundle-utils.test.ts
```

Expected: FAIL.

**Step 2: Implement generator**

Add types and function to `src/cli/bundle-utils.ts`:

```ts
export interface BundleCommandFile {
  file: string
  name: string
}

export interface ConsumerManifestInput {
  helperFiles: string[]
  commandFiles: BundleCommandFile[]
}

export function generateConsumerManifest(input: ConsumerManifestInput): string {
  const helperImports = input.helperFiles
    .map((file) => `import ${quoteImportPath(file)}`)
    .join('\n')

  const commandImports = input.commandFiles
    .map(({ file, name }) => `import * as _cmd_${safeIdent(name)} from ${quoteImportPath(file)}`)
    .join('\n')

  const registrations = input.commandFiles
    .map(({ name }) => `registerBundledCommand(${JSON.stringify(name)}, _cmd_${safeIdent(name)})`)
    .join('\n')

  return `import { Command, commands, graftModule, isNativeHelperClass } from 'luca'

${helperImports}

${commandImports}

function registerBundledCommand(name: string, mod: any) {
  if (commands.has(name)) return

  if (isNativeHelperClass(mod.default, Command)) {
    commands.register(name, mod.default)
    return
  }

  const commandModule = mod.default || mod

  if (typeof commandModule.run === 'function') {
    commands.register(name, graftModule(Command as any, commandModule, name, 'commands') as any)
    return
  }

  if (typeof commandModule.handler === 'function') {
    commands.register(name, graftModule(Command as any, {
      description: commandModule.description,
      argsSchema: commandModule.argsSchema,
      positionals: commandModule.positionals ?? mod.positionals,
      handler: commandModule.handler,
    }, name, 'commands') as any)
    return
  }

  if (typeof mod.default === 'function') {
    commands.register(name, graftModule(Command as any, {
      description: mod.description || '',
      argsSchema: mod.argsSchema,
      positionals: mod.positionals,
      handler: mod.default,
    }, name, 'commands') as any)
    return
  }
}

${registrations}
`
}
```

Do not add support for `export async function main` in this task unless command discovery supports it first. Keep parity with `CommandsRegistry.discover`.

**Step 3: Run tests**

```sh
bun test test/bundle-utils.test.ts
```

Expected: PASS.

**Step 4: Commit**

```sh
git add src/cli/bundle-utils.ts test/bundle-utils.test.ts
git commit -m "feat: generate consumer bundle manifest"
```

---

### Task 6: Generate consumer entrypoint text

**Objective:** Generate a consumer CLI entrypoint that imports `luca/agi`, imports the generated manifest, and calls the shared CLI runner without importing Luca's normal `src/commands/index.ts`.

**Files:**
- Modify: `src/cli/bundle-utils.ts`
- Modify: `test/bundle-utils.test.ts`

**Step 1: Write failing test**

Append:

```ts
import { generateConsumerEntry } from '../src/cli/bundle-utils'

it('generates consumer entry without luca command index import', () => {
  const text = generateConsumerEntry({ binaryName: 'loopy', manifestPath: './generated-consumer-manifest.ts' })

  expect(text).toContain("import container from 'luca/agi'")
  expect(text).toContain("import './generated-consumer-manifest.ts'")
  expect(text).toContain("import { runCli } from 'luca/cli/runner'")
  expect(text).toContain("binaryName: 'loopy'")
  expect(text).not.toContain('@/commands/index')
})
```

Run:

```sh
bun test test/bundle-utils.test.ts
```

Expected: FAIL.

**Step 2: Export runner path from package**

Modify `package.json` exports to expose the runner:

```json
"./cli/runner": {
  "default": "./src/cli/runner.ts"
}
```

**Step 3: Implement `generateConsumerEntry`**

Add:

```ts
export function generateConsumerEntry(options: { binaryName: string; manifestPath: string }): string {
  return `#!/usr/bin/env bun
import container from 'luca/agi'
import ${JSON.stringify(options.manifestPath)}
import { runCli } from 'luca/cli/runner'

await runCli(container, {
  binaryName: ${JSON.stringify(options.binaryName)},
  discoverLocalCommands: true,
})
`
}
```

If Bun cannot resolve `luca/cli/runner` during tests, update the export path or use a relative generated path only in the build command. Prefer package export because consumer build dirs should not know Luca source layout.

**Step 4: Run tests**

```sh
bun test test/bundle-utils.test.ts test/cli-runner.test.ts
```

Expected: PASS.

**Step 5: Commit**

```sh
git add package.json src/cli/bundle-utils.ts test/bundle-utils.test.ts
git commit -m "feat: generate consumer cli entrypoint"
```

---

## Phase 3: Built-in Bundle Command

### Task 7: Add built-in `bundle` command skeleton

**Objective:** Add `luca bundle` as a baked command with args, no compilation yet.

**Files:**
- Create: `src/commands/bundle.ts`
- Modify: `src/commands/index.ts`
- Create: `test/bundle-command.test.ts`

**Step 1: Write failing test**

Create `test/bundle-command.test.ts`:

```ts
import { describe, expect, it } from 'bun:test'
import '../src/commands/bundle'
import { commands } from '../src/command'

describe('bundle command', () => {
  it('registers as a built-in command', () => {
    expect(commands.has('bundle')).toBe(true)
    const Bundle = commands.lookup('bundle') as any
    expect(Bundle.commandDescription).toContain('Compile a Luca project')
  })
})
```

Run:

```sh
bun test test/bundle-command.test.ts
```

Expected: FAIL because command does not exist.

**Step 2: Create `src/commands/bundle.ts`**

```ts
import { z } from 'zod'
import { commands } from '../command.js'
import { CommandOptionsSchema } from '../schemas/base.js'
import type { ContainerContext } from '../container.js'

export const positionals = ['name']

export const argsSchema = CommandOptionsSchema.extend({
  name: z.string().describe('Name of the binary to produce, e.g. loopy'),
  source: z.string().default('.').describe('Path to the source Luca project, default cwd'),
  outDir: z.string().default('dist').describe('Directory to write compiled binaries'),
  targets: z.string().default('darwin-arm64').describe('Comma-separated Bun target platforms'),
  builtins: z.string().default('').describe('Optional comma-separated Luca built-in commands to include'),
  dryRun: z.boolean().default(false).describe('Generate bundle files but skip bun build'),
})

export async function bundleCommand(options: z.infer<typeof argsSchema>, context: ContainerContext) {
  const { container } = context
  const ui = container.feature('ui') as any
  ui.print.info(`Bundle command scaffold: ${options.name}`)
}

commands.registerHandler('bundle', {
  description: 'Compile a Luca project into a standalone consumer binary',
  argsSchema,
  handler: bundleCommand,
})
```

**Step 3: Import it in `src/commands/index.ts`**

Add:

```ts
import './bundle.js'
```

**Step 4: Run tests and CLI help**

```sh
bun test test/bundle-command.test.ts
bun run src/cli/cli.ts help | grep bundle
```

Expected: PASS and help lists bundle.

**Step 5: Commit**

```sh
git add src/commands/bundle.ts src/commands/index.ts test/bundle-command.test.ts
git commit -m "feat: add built-in bundle command scaffold"
```

---

### Task 8: Implement source helper discovery for bundle command

**Objective:** Discover source project helper/command files for bundling without using runtime auto-discovery side effects.

**Files:**
- Modify: `src/commands/bundle.ts`
- Modify: `src/cli/bundle-utils.ts`
- Modify: `test/bundle-utils.test.ts`

**Step 1: Write failing utility test**

Add to `test/bundle-utils.test.ts`:

```ts
import { shouldIncludeBundleFile } from '../src/cli/bundle-utils'

it('excludes generated and test files from bundles', () => {
  expect(shouldIncludeBundleFile('features/a.ts')).toBe(true)
  expect(shouldIncludeBundleFile('features/a.test.ts')).toBe(false)
  expect(shouldIncludeBundleFile('features/a.spec.ts')).toBe(false)
  expect(shouldIncludeBundleFile('features/introspection.generated.ts')).toBe(false)
})
```

Run:

```sh
bun test test/bundle-utils.test.ts
```

Expected: FAIL.

**Step 2: Implement exclusion utility**

Add:

```ts
export function shouldIncludeBundleFile(path: string): boolean {
  return path.endsWith('.ts')
    && !path.endsWith('.test.ts')
    && !path.endsWith('.spec.ts')
    && !path.includes('.generated')
}
```

**Step 3: Implement discovery in `bundle.ts`**

Add constants:

```ts
const SELF_REGISTERING_DIRS = ['features', 'clients', 'servers', 'endpoints', 'selectors'] as const
const COMMAND_DIRS = ['commands'] as const
```

In handler:

- resolve `source` with `container.paths.resolve(options.source)` unless absolute input already resolves correctly
- scan source helper dirs with `fs.walk`
- collect `helperFiles` from self-registering dirs
- collect top-level command files from `commands/`
- skip tests/generated/index files
- print counts

Use existing FS feature APIs as in the POC, but no `lucaRoot`.

**Step 4: Run dry command**

```sh
bun run src/cli/cli.ts bundle loopy --source /Users/jonathansoeder/@agentic-loop --dry-run
```

Expected: prints discovered helper and command counts, no compilation.

**Step 5: Commit**

```sh
git add src/commands/bundle.ts src/cli/bundle-utils.ts test/bundle-utils.test.ts
git commit -m "feat: discover consumer project bundle inputs"
```

---

### Task 9: Generate isolated build directory on dry run

**Objective:** `luca bundle --dry-run` writes `entry.ts`, `generated-consumer-manifest.ts`, and `package.json` into an isolated build dir under outDir.

**Files:**
- Modify: `src/commands/bundle.ts`
- Modify: `test/bundle-command.test.ts`

**Step 1: Write failing integration-style test**

In `test/bundle-command.test.ts`, add a temp workspace test using Bun temp dir APIs or `/tmp` with a unique suffix:

```ts
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import container from '../src/agi'

it('dry-run writes isolated generated bundle files', async () => {
  const root = mkdtempSync(join(tmpdir(), 'luca-bundle-test-'))
  mkdirSync(join(root, 'commands'))
  writeFileSync(join(root, 'commands', 'hello.ts'), `export default async function hello() { console.log('hi') }`)

  const outDir = join(root, 'out')
  const cmd = container.command('bundle' as any)
  await cmd.dispatch({ name: 'hello-bin', source: root, outDir, targets: 'darwin-arm64', dryRun: true }, 'headless')

  const buildDir = join(outDir, '.luca-bundle-build', 'hello-bin')
  expect(existsSync(join(buildDir, 'entry.ts'))).toBe(true)
  expect(existsSync(join(buildDir, 'generated-consumer-manifest.ts'))).toBe(true)
  expect(existsSync(join(buildDir, 'package.json'))).toBe(true)
  expect(readFileSync(join(buildDir, 'entry.ts'), 'utf8')).not.toContain('@/commands/index')
})
```

Run:

```sh
bun test test/bundle-command.test.ts
```

Expected: FAIL.

**Step 2: Implement build dir generation**

In `bundle.ts`:

- compute `outDir = container.paths.resolve(options.outDir)`
- compute `buildDir = container.paths.resolve(outDir, '.luca-bundle-build', options.name)`
- ensure folders exist
- write manifest with `generateConsumerManifest`
- write entry with `generateConsumerEntry`
- write package.json with explicit Luca runtime dependency

For first implementation, use local package dependency:

```ts
const lucaPackageSpec = options.runtime || 'luca'
```

Add `runtime` arg:

```ts
runtime: z.string().default('luca').describe('Luca package spec for generated build dir, e.g. luca or file:/path/to/luca')
```

Generated package:

```json
{
  "type": "module",
  "dependencies": {
    "luca": "<runtime>"
  }
}
```

**Step 3: Run tests**

```sh
bun test test/bundle-command.test.ts test/bundle-utils.test.ts
```

Expected: PASS.

**Step 4: Commit**

```sh
git add src/commands/bundle.ts test/bundle-command.test.ts
git commit -m "feat: generate isolated consumer bundle build files"
```

---

### Task 10: Compile generated consumer entry with Bun

**Objective:** Implement actual `bun install` and `bun build --compile` from isolated build dir.

**Files:**
- Modify: `src/commands/bundle.ts`

**Step 1: Add dry-run guard test**

Extend test from Task 9 to assert no binary exists on dry-run. Then add a separate real compile smoke test only if it can run quickly and reliably on current platform. If test cost is too high for unit tests, skip automated compile in `bun test` and verify manually in Step 4.

**Step 2: Implement compile path**

In `bundle.ts`, after generation:

```ts
if (options.dryRun) return

const install = await proc.execAndCapture('bun install', { cwd: buildDir, silent: false })
if (install.exitCode !== 0) throw new Error(`bun install failed:\n${install.stderr}`)

for (const target of targets) {
  const suffix = target === 'windows-x64' ? '.exe' : ''
  const outFile = container.paths.resolve(outDir, `${options.name}-${target}${suffix}`)
  const cmd = `bun build entry.ts --compile --target=bun-${target} --outfile ${JSON.stringify(outFile)}`
  const result = await proc.execAndCapture(cmd, { cwd: buildDir, silent: true })
  if (result.exitCode !== 0) throw new Error(`bun build failed for ${target}:\n${result.stderr}`)
}
```

Do not include `--external node-llama-cpp` until a failure proves it is needed. If it is needed, add an option or documented constant.

**Step 3: Run unit tests**

```sh
bun test test/bundle-command.test.ts test/bundle-utils.test.ts
```

Expected: PASS.

**Step 4: Manual smoke compile**

Run:

```sh
bun run src/cli/cli.ts bundle loopy \
  --source /Users/jonathansoeder/@agentic-loop \
  --outDir /tmp/loopy-bundle-plan-test \
  --targets darwin-arm64 \
  --runtime file:/Users/jonathansoeder/@luca
```

Expected:

- binary is produced at `/tmp/loopy-bundle-plan-test/loopy-darwin-arm64`
- generated files are under `/tmp/loopy-bundle-plan-test/.luca-bundle-build/loopy/`
- nothing is written under `/Users/jonathansoeder/@luca/src/cli/bundles/`

**Step 5: Commit**

```sh
git add src/commands/bundle.ts test/bundle-command.test.ts
git commit -m "feat: compile consumer bundle from isolated build dir"
```

---

## Phase 4: Consumer Binary Verification

### Task 11: Verify compiled binary command surface

**Objective:** Confirm compiled `loopy` shows baked Agentic Loop commands and does not import Luca's normal command index by default.

**Files:**
- No code changes expected unless verification fails.

**Step 1: Build loopy**

```sh
bun run src/cli/cli.ts bundle loopy \
  --source /Users/jonathansoeder/@agentic-loop \
  --outDir /tmp/loopy-bundle-plan-test \
  --targets darwin-arm64 \
  --runtime file:/Users/jonathensoeder/@luca
```

Correct typo if needed: use `/Users/jonathansoeder/@luca`.

**Step 2: Check help from clean cwd**

```sh
mkdir -p /tmp/loopy-clean-cwd
cd /tmp/loopy-clean-cwd
LUCA_COMMAND_DISCOVERY=disable /tmp/loopy-bundle-plan-test/loopy-darwin-arm64 help | head -120
```

Expected:

- usage says `loopy`
- baked Agentic Loop commands are present
- ordinary Luca commands like `bootstrap`, `scaffold`, `social` are absent unless explicitly included

**Step 3: Check baked features**

If `describe` was included as a builtin for this smoke build, run:

```sh
LUCA_COMMAND_DISCOVERY=disable /tmp/loopy-bundle-plan-test/loopy-darwin-arm64 describe features | grep -E 'workflowService|agenticLoop|communications'
```

Expected: bundled Agentic Loop features are present.

**Step 4: Commit verification note if docs changed**

If no code changed, no commit.

---

### Task 12: Verify local cwd commands are auto-discovered

**Objective:** Prove compiled consumer binary retains normal Luca cwd command extension behavior.

**Files:**
- No code changes expected unless verification fails.

**Step 1: Create temp cwd command**

```sh
rm -rf /tmp/loopy-local-command-test
mkdir -p /tmp/loopy-local-command-test/commands
cat > /tmp/loopy-local-command-test/commands/local-hello.ts <<'TS'
export const description = 'Local hello command'
export default async function localHello() {
  console.log('hello from cwd')
}
TS
```

**Step 2: Run help**

```sh
cd /tmp/loopy-local-command-test
/tmp/loopy-bundle-plan-test/loopy-darwin-arm64 help | grep local-hello
```

Expected: `local-hello` appears as a project/local command.

**Step 3: Dispatch command**

```sh
/tmp/loopy-bundle-plan-test/loopy-darwin-arm64 local-hello
```

Expected:

```txt
hello from cwd
```

---

### Task 13: Verify local features are not auto-discovered by generic CLI boot

**Objective:** Confirm feature discovery remains userland-controlled.

**Files:**
- No code changes expected unless verification fails.

**Step 1: Create temp cwd feature and command**

```sh
rm -rf /tmp/loopy-local-feature-test
mkdir -p /tmp/loopy-local-feature-test/features /tmp/loopy-local-feature-test/commands
cat > /tmp/loopy-local-feature-test/features/local-feature.ts <<'TS'
import { Feature, features } from 'luca'
export class LocalFeature extends Feature {
  static override description = 'Local feature should not auto-discover'
  static { features.register('localFeature', LocalFeature) }
}
TS
cat > /tmp/loopy-local-feature-test/commands/check-feature.ts <<'TS'
export default async function checkFeature(_options: any, { container }: any) {
  console.log(container.features.has('localFeature') ? 'feature-present' : 'feature-missing')
}
TS
```

**Step 2: Run command**

```sh
cd /tmp/loopy-local-feature-test
/tmp/loopy-bundle-plan-test/loopy-darwin-arm64 check-feature
```

Expected:

```txt
feature-missing
```

**Step 3: Add `luca.cli.ts` discovery**

```sh
cat > /tmp/loopy-local-feature-test/luca.cli.ts <<'TS'
export async function main(container: any) {
  await container.helpers.discover('features')
}
TS
```

**Step 4: Run command again**

```sh
/tmp/loopy-bundle-plan-test/loopy-darwin-arm64 check-feature
```

Expected:

```txt
feature-present
```

---

## Phase 5: Cleanup and Deprecation

### Task 14: Remove or deprecate project-local POC command

**Objective:** Avoid two competing bundling commands with different mental models.

**Files:**
- Modify or delete: `commands/bundle-consumer-project.ts`
- Modify: docs referencing bundling command if any

**Step 1: Decide remove vs wrapper**

Preferred: remove `commands/bundle-consumer-project.ts` from the Luca source repo root `commands/` because `src/commands/bundle.ts` is now baked.

Alternative: keep a tiny wrapper that prints migration guidance and delegates to `luca bundle`.

**Step 2: Search references**

```sh
rg "bundle-consumer-project|consumer binary|luca bundle" docs src commands test
```

Use Hermes `search_files` instead of shell `rg` if implementing through Hermes tools.

**Step 3: Update docs**

At minimum update:

- `docs/ideas/cwd-oriented-consumer-binary-bundler.md`
- any tutorial or idea doc that names `bundle-consumer-project`

**Step 4: Run tests**

```sh
bun test test/*.test.ts
bun run src/cli/cli.ts help | grep bundle
```

Expected: tests pass and only `bundle` is presented as the path forward.

**Step 5: Commit**

```sh
git add commands/bundle-consumer-project.ts docs src test
git commit -m "chore: retire consumer bundle poc command"
```

---

### Task 15: Full quality gate and binary compile smoke

**Objective:** Verify the repo and the feature are healthy.

**Files:**
- No planned code changes.

**Step 1: Run unit tests**

```sh
bun test test/*.test.ts
```

Expected: all pass.

**Step 2: Run typecheck**

```sh
bun run typecheck
```

Expected: pass. If generated build dirs under `/tmp` or `dist` pollute typecheck, fix excludes or output location.

**Step 3: Compile Luca**

```sh
bun run compile
```

Expected: `dist/luca` builds and includes the baked `bundle` command.

**Step 4: Use compiled Luca to build Loopy**

```sh
./dist/luca bundle loopy \
  --source /Users/jonathansoeder/@agentic-loop \
  --outDir /tmp/loopy-final-smoke \
  --targets darwin-arm64 \
  --runtime file:/Users/jonathensoeder/@luca
```

Correct typo if needed: use `/Users/jonathansoeder/@luca`.

Expected: `loopy-darwin-arm64` exists.

**Step 5: Verify final Loopy behavior**

```sh
cd /tmp
/tmp/loopy-final-smoke/loopy-darwin-arm64 help | head -100
```

Expected:

- usage says `loopy`
- baked Agentic Loop commands appear
- cwd local commands are still discoverable when present

**Step 6: Commit final fixes if any**

```sh
git status --short
git add <only files changed for this task>
git commit -m "fix: stabilize consumer binary bundling"
```

---

## Future Work: Loopy Asset Sync

Do not implement this as part of the generic bundler unless explicitly requested.

Loopy needs its own cwd asset initialization/sync command. That command should likely live in Agentic Loop source and be baked into the `loopy` binary.

Desired behavior:

```sh
mkdir my-loop
cd my-loop
loopy init
```

`loopy init` downloads from a known host into cwd:

```txt
workflows/
assistants/
docs/
config.yml or loopy.yml
```

Then normal cwd-oriented runtime behavior takes over.

Potential later tasks:

1. Define Loopy asset manifest format.
2. Publish workflow/static assets to known host.
3. Add baked `loopy init` command in Agentic Loop.
4. Add checksum/version checks.
5. Add `loopy update-assets` or `loopy sync`.

---

## Final Acceptance Checklist

- [ ] `bundle` is a built-in Luca command under `src/commands/`.
- [ ] `src/cli/cli.ts` uses a shared `runCli` runner.
- [ ] Consumer entrypoints use `runCli` and do not import `@/commands/index.js`.
- [ ] Generated consumer artifacts are isolated under outDir/temp, never Luca `src/`.
- [ ] No `os.homedir()`-derived `lucaRoot` exists.
- [ ] Compiled consumer binary help uses the consumer binary name.
- [ ] Compiled consumer binary auto-discovers cwd `commands/`.
- [ ] Compiled consumer binary does not auto-discover cwd features unless `luca.cli.ts` or a command asks for it.
- [ ] Compiled consumer binary can run from a clean cwd.
- [ ] `bun test test/*.test.ts` passes.
- [ ] `bun run typecheck` passes.
- [ ] `bun run compile` passes.
- [ ] Compiled `dist/luca` can compile a smoke `loopy` binary.
