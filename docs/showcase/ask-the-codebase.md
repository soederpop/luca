# Ask the Luca codebase a question

A runnable document that turns the framework's own source into a prompt.

It finds the luca install nearest to *this file* (walking up for `node_modules/luca`,
falling back to the framework repo itself), lets you pick which slices of source and
docs to load, estimates the token cost before you spend it, discovers whatever
OpenAI-compatible model server is running on your machine or tailnet, and renders the
answer as markdown in your terminal.

```sh skip
luca run docs/showcase/ask-the-codebase.md
```

Built for a long-context local model. The full hand-written source plus the docs is
roughly 790k tokens, so a 1M-window model can hold the whole framework at once.

## Find the luca install

`process.argv` carries the path of the document being run, so the search starts from
where this file actually lives rather than from wherever you happened to invoke the CLI.
A consumer project gets `node_modules/luca`; inside the framework repo the walk finds the
repo root instead. Either way the answer is a directory with `src/container.ts` in it.

Note the asymmetry: the published npm package ships `src/` but **not** `docs/` (they are
in `.npmignore`), so a consumer install can offer source-only bundles. Running this doc
from a checkout of the framework gets the docs too.

```ts
docPath = process.argv.find(a => a.endsWith('.md')) || container.paths.join('docs/showcase/ask-the-codebase.md')
searchFrom = container.paths.dirname(container.paths.resolve(docPath))

function isLucaRoot(dir) {
  return fs.exists(container.paths.resolve(dir, 'src', 'container.ts'))
}

// Collect every candidate on the way up, then prefer the one that carries docs/.
// A checkout of the framework outranks a published copy sitting in node_modules,
// which matters when you run this doc from inside the luca repo itself — the repo
// often has a stale self-install one level down.
candidates = []
for (let dir = searchFrom, i = 0; i < 12; i++) {
  if (isLucaRoot(dir)) candidates.push(dir)
  const installed = container.paths.resolve(dir, 'node_modules', 'luca')
  if (fs.exists(installed) && isLucaRoot(installed)) candidates.push(installed)
  const parent = container.paths.dirname(dir)
  if (parent === dir) break
  dir = parent
}

if (!candidates.length) throw new Error(`No luca source found walking up from ${searchFrom}`)

lucaRoot = candidates.find(dir => fs.exists(container.paths.resolve(dir, 'docs', 'apis'))) || candidates[0]

hasDocs = fs.exists(container.paths.resolve(lucaRoot, 'docs', 'apis'))
;({ lucaRoot, hasDocs, startedFrom: searchFrom })
```

## Define the bundles

Each bundle is a named set of files. The core group is listed by hand and ordered
deliberately: the container, then the base classes every helper extends, then the
primitives. It is only ~42k tokens and belongs in every bundle — it is the part that
explains how the rest fits together.

The rest are directory walks. Every `*generated*.ts` is excluded: those are build
artifacts derived from the JSDoc and zod schemas in the files you are already sending, and
they total 1.9M tokens on their own, enough to blow any context window.

The token numbers are estimates at 4.1 characters per token, which is what cl100k_base
actually measured across this repo's TypeScript and markdown alike.

```ts
CHARS_PER_TOKEN = 4.1

CORE_FILES = [
  'src/container.ts', 'src/node/container.ts', 'src/agi/container.server.ts',
  'src/helper.ts', 'src/feature.ts', 'src/client.ts', 'src/server.ts',
  'src/node/feature.ts', 'src/agi/feature.ts',
  'src/registry.ts', 'src/state.ts', 'src/bus.ts', 'src/entity.ts', 'src/selector.ts',
  'src/command.ts', 'src/endpoint.ts', 'src/node.ts', 'src/graft.ts',
  'src/hash-object.ts', 'src/browser.ts',
]

function collect(dirs, exts) {
  const out = []
  for (const dir of dirs) {
    const abs = container.paths.resolve(lucaRoot, dir)
    if (!fs.exists(abs)) continue
    for (const file of fs.walk(abs, { files: true, directories: false }).files) {
      if (/generated/.test(file)) continue
      if (exts && !exts.some(e => file.endsWith(e))) continue
      out.push(file)
    }
  }
  return out.sort()
}

BUNDLES = {
  core: {
    label: 'Core framework — container, base classes, primitives',
    files: CORE_FILES.map(f => container.paths.resolve(lucaRoot, f)).filter(f => fs.exists(f)),
  },
  features: {
    label: 'Node features — every container.feature() implementation',
    files: collect(['src/node/features'], ['.ts']),
  },
  clientsServers: {
    label: 'Clients and servers — rest, websocket, express, and friends',
    files: collect(['src/clients', 'src/servers', 'src/node/clients', 'src/node/servers'], ['.ts']),
  },
  agi: {
    label: 'AGI features — assistants, conversations, models, embeddings',
    files: collect(['src/agi/features'], ['.ts']),
  },
  cliWeb: {
    label: 'CLI, web, and react layers',
    files: collect(['src/cli', 'src/commands', 'src/web', 'src/react'], ['.ts', '.tsx']),
  },
  examples: {
    label: 'docs/examples — runnable multi-helper composition patterns',
    files: hasDocs ? collect(['docs/examples'], ['.md', '.ts']) : [],
  },
  tutorials: {
    label: 'docs/tutorials — long-form guides',
    files: hasDocs ? collect(['docs/tutorials'], ['.md']) : [],
  },
  apis: {
    label: 'docs/apis — generated API reference (overlaps the JSDoc in the source)',
    files: hasDocs ? collect(['docs/apis'], ['.md']) : [],
  },
}

// Read once, measure once. Everything downstream works off this cache.
for (const [name, bundle] of Object.entries(BUNDLES)) {
  bundle.chars = 0
  bundle.contents = bundle.files.map(file => {
    const body = fs.readFile(file, 'utf8').toString()
    bundle.chars += body.length
    return { path: container.paths.relative(lucaRoot, file), body }
  })
  bundle.tokens = Math.round(bundle.chars / CHARS_PER_TOKEN)
}

console.log(ui.markdown([
  '| bundle | files | est. tokens |',
  '|---|---:|---:|',
  ...Object.entries(BUNDLES).map(([name, b]) =>
    `| \`${name}\` — ${b.label} | ${b.files.length} | ${b.tokens.toLocaleString()} |`),
].join('\n')))

hasDocs ? 'source + docs available' : 'source only — this install has no docs/ (npm strips it)'
```

## Choose what to send, and what to ask

The default selection is the one worth defaulting to: core, features, clients/servers, and
the examples. That lands near 386k tokens, which leaves most of a 1M window free for the
conversation, and long-context models degrade well before they are full.

`apis` is off by default on purpose. It is 202k tokens generated from the same JSDoc
already present in the feature source, so including both pays twice for one set of facts
and risks the model trusting a stale rendering over the real code.

```ts
answers = await ui.wizard([
  {
    type: 'checkbox',
    name: 'bundles',
    message: 'Which slices should the model see?',
    choices: Object.entries(BUNDLES)
      .filter(([, b]) => b.files.length > 0)
      .map(([name, b]) => ({
        name: `${name.padEnd(15)} ${String(b.tokens.toLocaleString()).padStart(9)} tokens  ${b.label}`,
        value: name,
        checked: ['core', 'features', 'clientsServers', 'examples'].includes(name),
      })),
    validate: (picked) => picked.length > 0 || 'Pick at least one',
  },
  {
    type: 'input',
    name: 'question',
    message: 'What do you want to know about the codebase?',
    validate: (input) => input.trim().length > 0 || 'Ask something',
  },
])

selected = answers.bundles.map(name => BUNDLES[name])
question = answers.question.trim()
estimated = selected.reduce((sum, b) => sum + b.tokens, 0)

if (estimated > 900_000) {
  console.log(ui.colors.yellow(`⚠  ~${estimated.toLocaleString()} tokens — over a 1M window once the answer is budgeted for. Consider dropping a bundle.`))
}

;({ question, bundles: answers.bundles, estimatedTokens: estimated }) 
```

## Build the prompt

The codebase goes in the system prompt and the question goes in the user message. That
split is what makes the expensive half cacheable: ask a second question against the same
bundle and a provider with prompt caching bills the source once.

Each file is fenced and labelled with its path relative to the luca root, so the model can
cite `src/node/features/fs.ts` and you can go straight there.

```ts
function renderFile({ path, body }) {
  const lang = path.endsWith('.md') ? 'markdown' : path.endsWith('.tsx') ? 'tsx' : 'ts'
  return `### ${path}\n\n\`\`\`${lang}\n${body}\n\`\`\``
}

systemPrompt = [
  'You are an expert on the Luca framework (Lightweight Universal Conversational Architecture).',
  'Below is its actual source code and documentation. Answer strictly from what you see here.',
  'Cite the file paths you relied on. If the answer is not in the provided files, say so plainly',
  'rather than inventing an API.',
  '',
  '# Luca source bundle',
  '',
  ...selected.flatMap(bundle => [
    `## ${bundle.label}`,
    '',
    ...bundle.contents.map(renderFile),
    '',
  ]),
].join('\n')

;({
  files: selected.reduce((n, b) => n + b.files.length, 0),
  promptChars: systemPrompt.length,
  estimatedTokens: Math.round(systemPrompt.length / CHARS_PER_TOKEN),
})
```

## Pick a model

`modelProviders.discover()` probes the well-known LLM ports on localhost and on every
online tailscale peer, then registers each live server as a usable provider profile. A host
that is not listening is silently omitted, so this is safe to run anywhere.

Anything with a big context window is the right pick here. A 1M-window local model can
take the whole bundle; a 128k model needs you to go back and select less.

```ts
providers = container.feature('modelProviders')
discovered = await providers.discover({ register: true })

choices = discovered.flatMap(server =>
  (server.models || []).map(model => ({
    name: `${model}  ${ui.colors.dim(`${server.hint || server.baseURL} → ${server.profileId}`)}`,
    value: { provider: server.profileId, model },
  }))
)

if (!choices.length) {
  console.log(ui.colors.yellow('No local model servers found. Falling back to the container default provider.'))
}

choice = choices.length
  ? (await ui.wizard([{ type: 'list', name: 'target', message: 'Which model should answer?', choices, pageSize: 15 }])).target
  : { provider: undefined, model: undefined }

choice
```

## Ask, and render the answer

`ui.markdown()` runs the reply through marked-terminal, so headings, lists, and fenced code
in the model's response come back styled instead of raw. The answer is left in `answer` for
a follow-up, which is what `--console` is for: `luca run <doc> --console` drops you into a
REPL holding every variable this document built, so you can call `assistant.ask()` again
without re-reading a single file.

```ts
assistant = container.feature('assistant', {
  systemPrompt,
  provider: choice.provider,
  model: choice.model,
  temperature: 0.2,
  maxTokens: 4096,
})

console.log(ui.colors.dim(`\nAsking ${choice.model || 'the default model'}…\n`))

started = Date.now()
answer = await assistant.ask(question)
elapsed = ((Date.now() - started) / 1000).toFixed(1)

console.log(ui.markdown(`## ${question}\n\n${answer}`))
console.log(ui.colors.dim(`\n${elapsed}s · ${choice.provider || 'default'} · ${choice.model || 'default model'}\n`))

// leading semicolon: a bare template literal after a call expression would
// otherwise parse as a tagged template
;`answered in ${elapsed}s`
```

## Ask a follow-up

Run with `--console` and the source stays loaded in memory. Every question after the first
costs nothing to prepare.

```ts skip
// in the REPL that --console opens:
await assistant.ask('Now show me how a Feature declares its options schema.')
```
