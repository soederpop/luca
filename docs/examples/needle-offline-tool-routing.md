---
title: 'Needle: offline extraction, routing, and speculative prefetch'
tags:
  - needle
  - tool-calling
  - extraction
  - sqlite
  - routing
  - composition
lastTested: '2026-09-19'
lastTestPassed: true
---

# Needle: offline extraction, routing, and speculative prefetch

The `needle` feature runs [Cactus Needle 3](https://cactuscompute.com/needle) locally — a 35MB
foundation model that maps `(query, tool list)` → one JSON function call at ~1000 tok/s on
~75MB of RAM, fully offline. It is **not a chat model**: it never writes prose, it picks tools
and fills arguments. That makes it perfect for three composition patterns this doc walks
through with one scenario, a support inbox:

1. **Extraction pipeline** — unstructured emails → typed rows → `sqlite`
2. **Confidence-gated routing** — dispatch simple intents without an LLM (and the gotcha that makes a `no_action` tool mandatory)
3. **Speculative prefetch** — pre-run the read-only tool needle predicts, so a real LLM answers in one round trip instead of two

Run `luca describe needle` for the full API. First use auto-downloads the engine binary and
weights from Hugging Face (~36MB, one time).

## Setup — install and pick a port range

One needle server is bound to one tool set at startup, so the feature spawns a detached server
per tool set, on a port hashed from the tools. Give examples and tests their own `basePort`
range so they never collide with (or reuse) an app's servers.

```ts
needle = container.feature('needle', { basePort: 8560, portRange: 8 })
await needle.install() // no-op when already downloaded
console.log('needle ready:', needle.ready, '— weights at', needle.weightsPath)
```

## Extract — unstructured emails into a queryable table

`needle.extract(text, schema)` is sugar over a single-tool agent whose parameters are your
schema: grammar-constrained decoding fills the fields, and you get a calibrated confidence per
document. Below the schema is plain JSON Schema; a zod object schema works too and is validated
on the way out. Same store-choice heuristic as always: the moment you want to *query* the
results, they belong in `sqlite`.

```ts
messages = [
  { from: 'ana@example.com',  body: 'Your sync app deleted three days of my notes after the 2.4 update. I need those back NOW — this is my thesis work.' },
  { from: 'ben@example.com',  body: 'Hi! Small thing: the dark theme makes the settings icons almost invisible. Not urgent at all, just figured you should know.' },
  { from: 'cleo@example.com', body: 'Order #7741 arrived with a cracked screen. Requesting a replacement or a refund of the $349 I paid.' },
]

ticketSchema = {
  type: 'object',
  properties: {
    product: { type: 'string', description: 'Which product or feature the message is about' },
    problem: { type: 'string', description: 'One-sentence summary of the problem' },
    urgent:  { type: 'boolean', description: 'Whether the sender needs an immediate response' },
  },
  required: ['product', 'problem', 'urgent'],
}

dbPath = container.paths.resolve(os.tmpdir, `needle-tickets-${Date.now()}.sqlite`)
db = container.feature('sqlite', { path: dbPath })
db.db.exec(`CREATE TABLE tickets (id INTEGER PRIMARY KEY, sender TEXT, product TEXT, problem TEXT, urgent INTEGER, confidence REAL)`)

for (const msg of messages) {
  const { data, confidence } = await needle.extract(msg.body, ticketSchema)
  await db.sql`INSERT INTO tickets (sender, product, problem, urgent, confidence)
    VALUES (${msg.from}, ${data.product}, ${data.problem}, ${data.urgent ? 1 : 0}, ${confidence})`
}

urgentRows = await db.sql`SELECT sender, problem FROM tickets WHERE urgent = 1`
console.log(`extracted ${messages.length} tickets; urgent:`, urgentRows.map(r => r.sender))
if (urgentRows.length === 0 || urgentRows.length === messages.length) {
  throw new Error('expected extraction to separate urgent from non-urgent tickets')
}
```

## Route — dispatch simple intents without an LLM

`needle.agent(tools)` spawns (or reuses — the port is derived from the tool-set hash, shared
across every luca process) a server bound to these tools. **The gotcha that shapes the tool
set:** needle *always* dispatches some call, even for off-topic input — "tell me a joke" will
cheerfully pick `get_weather` at high confidence. Any tool set facing open-ended input needs an
explicit `no_action` escape hatch; the confidence score alone will not save you.

```ts
router = await needle.agent([
  { name: 'search_tickets', description: 'Search existing support tickets.',
    parameters: { type: 'object', properties: { query: { type: 'string', description: 'What to search tickets for' } }, required: ['query'] } },
  { name: 'create_ticket', description: 'Open a new support ticket.',
    parameters: { type: 'object', properties: { problem: { type: 'string', description: 'The problem to file' } }, required: ['problem'] } },
  { name: 'no_action', description: 'Use when the request matches no other tool.',
    parameters: { type: 'object', properties: {} } },
])

// `fresh: true` resets the server's conversation state — needle is multi-turn
// by default, and this server is shared, so one-shot routing should always reset.
routed = await router.complete('open a ticket: exports fail with a 500 since this morning', { fresh: true })
console.log('routed →', routed.function_calls[0], `(confidence ${routed.confidence.toFixed(2)})`)
if (routed.function_calls[0]?.name !== 'create_ticket') throw new Error('expected create_ticket')
```

## Prefetch — speculate on read-only tools, answer in one LLM round trip

The full pattern: needle predicts the tool call in ~30ms, you pre-run it **only if the tool is
read-only** and confidence clears a bar, and inject the result into the LLM prompt — the model
answers in one round trip instead of prompt → tool call → tool result → answer. A wrong guess
costs nothing (the LLM ignores irrelevant context); a pre-run *write* would be a side effect
the user never asked for, which is why the allowlist below is the load-bearing line.

```ts
READ_ONLY = new Set(['search_tickets'])
handlers = {
  // Toy search: any meaningful query word appearing in the ticket text counts as a hit
  search_tickets: async ({ query }) => {
    const words = query.toLowerCase().split(/\W+/).filter(w => w.length >= 4)
    const rows = await db.sql`SELECT sender, product, problem FROM tickets`
    return rows.filter(r => words.some(w => `${r.product} ${r.problem}`.toLowerCase().includes(w)))
  },
}

// Needle condenses the user's words into the argument ('cracked screen' here) —
// match on words, not the full string, when a needle-filled arg feeds a search.
userQuery = 'did anyone report a cracked screen?'
guess = await router.complete(userQuery, { fresh: true })
call = guess.function_calls[0]

prompt = userQuery
if (call && READ_ONLY.has(call.name) && guess.confidence > 0.85) {
  const data = await handlers[call.name](call.arguments)
  prompt += `\n\nLikely-relevant data (pre-fetched ${call.name}): ${JSON.stringify(data)}`
}

// In a real app this prompt now goes to a full model in one shot:
//   await container.feature('assistant', { name: 'support' }).run(prompt)
console.log('assembled prompt:\n' + prompt)
if (!prompt.includes('pre-fetched search_tickets')) throw new Error('expected a confident read-only prefetch')
if (!prompt.includes('cleo@example.com')) throw new Error("expected cleo's cracked-screen ticket in the prefetched data")
```

## Cleanup — stop what this doc started

Servers are tiny but deliberately have no idle watchdog — stop the ones you spawned. This
instance tracks the ports it confirmed healthy in `state`; note `stopAll()` would instead stop
*every* needle server on the machine, which is too blunt here.

```ts
for (const port of needle.state.get('runningPorts') ?? []) needle.stopServer(port)
await fs.rm(dbPath, { force: true })
console.log('stopped needle servers and removed', dbPath)
```

## Where each pattern fits

- **Extraction pipeline**: intake daemons (`fileManager.watch` a drop folder, extract, insert), webhook endpoints that normalize free-text payloads, log triage.
- **Confidence-gated routing**: voice assistants and command palettes where the common intents shouldn't cost an LLM call; the low-confidence tail falls through to `assistant.run()`.
- **Speculative prefetch**: any assistant whose tools are mostly reads — halves perceived latency on the queries that were going to call a tool anyway.
