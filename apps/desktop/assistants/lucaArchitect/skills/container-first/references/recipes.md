# evalCode recipes

Each recipe is one `evalCode` call. Every snippet ends with a named value (`out`), never with a bare `({ ... })`: a line that starts with `(` continues the line before it, and the snippet becomes a call to the wrong thing. Change the patterns and names; keep the shape. `fs`, `grep`, `proc`, `fileManager`, `modelProviders`, `skillsLibrary` and every enabled feature are in scope by bare name; anything else is `container.feature('name')`.

## Orient in a project

What is this project, what does it already have, what changed recently.

```ts
const yaml = container.feature('yaml')
const git = container.feature('git')
const read = async (p: string) => (fs.existsSync(p) ? await fs.readFileAsync(p) : null)
const [pkg, claudeMd, commits] = await Promise.all([
  fs.readJsonAsync('package.json').catch(() => null),
  read('CLAUDE.md') ?? read('AGENTS.md'),
  git.getLatestChanges(5).catch(() => []),
])
const own = {
  features: fs.glob('features/*.ts'),
  commands: fs.glob('commands/*.ts'),
  endpoints: fs.glob('endpoints/**/*.ts'),
  clients: fs.glob('clients/*.ts'),
  servers: fs.glob('servers/*.ts'),
  assistants: fs.glob('assistants/*/CORE.md').map(p => p.split('/')[1]),
}
const facts = { cwd: container.cwd, name: pkg?.name, scripts: Object.keys(pkg?.scripts || {}), own, rules: claudeMd?.slice(0, 1500), commits: commits.map(c => c.title) }
container.addContext('facts', facts)
facts
```

## Does the container already do this?

Before you write a helper. Search names and descriptions, then read the one that fits.

```ts
const want = /cache|ttl/i
const hits = container.features.available.filter(id => want.test(id))
const docs = Object.fromEntries(hits.map(id => [id, container.feature(id).introspectAsText().slice(0, 1200)]))
const out = { hits, clients: container.clients.available, servers: container.servers.available, docs }
out
```

## Find code

Files, definitions and usages in one call.

```ts
const name = 'DiskCache'
const [defs, uses, files] = await Promise.all([
  grep.definitions(name, { include: '*.ts', exclude: 'node_modules' }),
  grep.search({ pattern: name, include: '*.ts', exclude: ['node_modules', 'dist'], maxResults: 30 }),
  Promise.resolve(fs.glob(['features/**/*.ts', 'src/**/*.ts'], { exclude: ['node_modules', '*.test.ts'] })),
])
const out = { defs: defs.map(m => `${m.file}:${m.line}`), uses: uses.map(m => `${m.file}:${m.line} ${m.content.trim()}`), fileCount: files.length }
out
```

Open work left in the code:

```ts
(await grep.todos({ include: '*.ts', exclude: 'node_modules' })).map(m => `${m.file}:${m.line} ${m.content.trim()}`)
```

## Read several files at once

```ts
const paths = fs.glob('commands/*.ts')
const texts = await Promise.all(paths.map(async p => [p, await fs.readFileAsync(p)]))
Object.fromEntries(texts.map(([p, t]) => [p, { lines: t.split('\n').length, exports: [...t.matchAll(/^export (?:const|function|async function) (\w+)/gm)].map(m => m[1]) }]))
```

## Parse config files

```ts
const yaml = container.feature('yaml')
const load = async (p: string) => (fs.existsSync(p) ? yaml.parse(await fs.readFileAsync(p)) : null)
const [options, env] = await Promise.all([load('assistants/options.yml'), fs.existsSync('.env') ? fs.readFileAsync('.env') : ''])
const out = { options, envKeys: env.split('\n').map(l => l.split('=')[0]).filter(k => k && !k.startsWith('#')) }
out
```

Never return the values of `.env`. Keys only.

## What a helper does right now

Live state, options and the methods you can call.

```ts
const f = container.feature('fileManager')
const out = { state: f.state.current, options: f.options, methods: f.$methods, getters: f.$getters, docs: f.introspectAsText().slice(0, 2000) }
out
```

## Run a command and keep the result next to the facts

```ts
const [{ stdout: status }, { stdout: branch }] = await Promise.all([
  proc.spawnAndCapture('git', ['status', '--short']),
  proc.spawnAndCapture('git', ['branch', '--show-current']),
])
const out = { branch: branch.trim(), changed: status.trim().split('\n').filter(Boolean) }
out
```

## Keep a work list across calls

Build it once, then move through it in later snippets.

```ts
const work = container.entity('work', {}).extend({
  start(items: string[]) { this.setState({ todo: items, done: [] }) },
  next() { const [head, ...rest] = this.state.get('todo') || []; if (head) { this.setState({ todo: rest, done: [...(this.state.get('done') || []), head] }); this.emit('took', head) } return head },
  get left() { return (this.state.get('todo') || []).length },
})
work.start(fs.glob('endpoints/**/*.ts'))
container.addContext('work', work)
const out = { left: work.left, first: work.next() }
out
```

Later: `work.next()`, `work.left`.

## Watch events while you work

```ts
const seen: string[] = []
const fm = container.feature('fileManager')
fm.on('file:change', (e: any) => seen.push(e.path))
container.addContext('seenChanges', seen)
await fm.start(); fm.watch()
'watching; read `seenChanges` in a later snippet, call fileManager.stopWatching() when done'
```

## State that must survive the process

```ts
const notes = container.store('luca-expert-notes', { schema: z.object({ entries: z.array(z.string()).default([]) }) })
await notes.update(s => { s.entries.push(`${new Date().toISOString()} started refactor`) })
const out = { path: notes.path, ...(await notes.read()) }
out
```

## Prototype a feature method before you write the file

Define the class in the snippet, use it, then write the file once the behavior is right.

```ts
const { Feature } = require('luca')
class WordCount extends Feature {
  static { Feature.register(this, 'wordCountProto') }
  async count(p: string) { const t = await fs.readFileAsync(p); return t.split(/\s+/).filter(Boolean).length }
}
const wc = container.feature('wordCountProto')
const out = { readme: await wc.count('README.md').catch(e => e.message), registered: container.features.available.includes('wordCountProto') }
out
```

A helper in a file is seen only by a new process: after you write `features/word-count.ts`, prove it with `runLucaCommand` `eval "container.feature('wordCount').count('README.md')"`.

## Hand long work to another process

Write a script, start it in the background, keep working, read the result when it ends. The script talks back through a store.

```ts
const script = `
export default async function main({ container }) {
  const progress = container.store('job-wordcount', { schema: z.object({ done: z.number().default(0), total: z.number().default(0), result: z.record(z.string(), z.number()).default({}) }) })
  const files = container.fs.glob('**/*.md', { exclude: ['node_modules'] })
  await progress.update(s => { s.total = files.length; s.done = 0; s.result = {} })
  for (const f of files) {
    const words = (await container.fs.readFileAsync(f)).split(/\s+/).length
    await progress.update(s => { s.done++; s.result[f] = words })
  }
}
`
await fs.ensureFolderAsync('.luca/scripts')
await fs.writeFileAsync('.luca/scripts/wordcount.ts', script)
const pm = container.feature('processManager')
const job = pm.spawn('luca', ['run', '.luca/scripts/wordcount.ts'], { cwd: container.cwd })
container.addContext('job', job)
const out = { pid: job.pid, status: job.status }
out
```

Later, in another snippet:

```ts
const progress = container.store('job-wordcount', { schema: z.object({ done: z.number().default(0), total: z.number().default(0), result: z.record(z.string(), z.number()).default({}) }) })
const p = await progress.read()
const out = { done: p.done, total: p.total, job: job.status, top: Object.entries(p.result).sort((a, b) => b[1] - a[1]).slice(0, 5) }
out
```

`z` is in scope inside `luca run` scripts and `luca eval`, the same as in `evalCode`.

## A second copy of an assistant in its own process

For a question you want answered on the side, with its own history, without touching your conversation.

```ts skip
const script = `
export default async function main({ container }) {
  const manager = container.feature('assistantsManager')
  await manager.discover()
  const helper = await manager.create('lucaArchitect', { cached: false, historyMode: 'lifecycle' })
  const answer = await helper.ask(process.env.QUESTION || 'Which features of this project have no tests? Answer in five lines.')
  await container.fs.writeFileAsync('.luca/scripts/side-answer.md', answer)
}
`
await fs.ensureFolderAsync('.luca/scripts')
await fs.writeFileAsync('.luca/scripts/side-question.ts', script)
const { stdout, stderr, exitCode } = await proc.spawnAndCapture('luca', ['run', '.luca/scripts/side-question.ts'], { cwd: container.cwd, environment: { QUESTION: 'List the commands in this project.' } })
const out = { exitCode, answer: fs.existsSync('.luca/scripts/side-answer.md') ? await fs.readFileAsync('.luca/scripts/side-answer.md') : stderr.slice(-800) }
out
```

This makes real model calls, so the fence is marked `skip` for `luca run`. For a prompt that lives in a markdown file, `runLucaCommand` with `prompt <assistant> <file.md> --out-file out.md` does the same.

## Another project

The same snippet, run in that project's own process:

```json
{ "args": "eval \"fs.glob('features/*.ts').map(p => [p, fs.statSync(p).size])\"", "cwd": "/abs/path/to/project" }
```

Keep the code on one line and use single quotes inside; the shell takes the outer double quotes.
