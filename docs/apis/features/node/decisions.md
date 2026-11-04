# Decisions (features.decisions)

> Stability: `experimental`

Ask a local decision model (Ollama `nimble` / `tev1` over the Jev-style `/v1/systemone` endpoint) several typed questions about one piece of input in a single forward pass. Decision models don't generate text: each question comes back as a choice with probabilities, a yes/no probability, or a weighted score on an ordered rubric. Use it for triage, routing, moderation, and any "look at this and decide" step that would otherwise be a chat call you have to parse. Expect a few hundred milliseconds per call on Apple Silicon for `nimble` (9.5GB, 16GB+ RAM) and much less for `tev1:0.8b` (800MB). Ollama 0.35 or newer is required for the endpoint. With `fallback: 'classifier'` the same questions are answered by the zeroshotClassifier feature when the decision endpoint is unreachable — a one-token logprob trick on a plain instruct model. Lower accuracy, but the API and answer shapes are identical, so callers don't branch.

## Usage

```ts
container.feature('decisions', {
  // Root URL of an Ollama (or other Jev-compatible) server. The decision endpoint is POST {baseURL}/v1/systemone. Falls back to the LUCA_DECISIONS_BASE_URL env var
  baseURL,
  // Decision model to ask. Ollama ships `nimble` (9B, ~9.5GB, needs a 16GB+ machine), `tev1` (4B, ~4.5GB) and `tev1:0.8b` (~800MB, runs anywhere)
  model,
  // Bearer token for the decision endpoint (falls back to the LUCA_DECISIONS_API_KEY env var). Local Ollama needs none
  apiKey,
  // A modelProviders profile id to resolve baseURL/apiKey from (AGI containers only). Ignored when baseURL is set explicitly
  provider,
  // What to do when no decision model answers. `classifier` emulates every question with the zeroshotClassifier feature (a one-token logprob pass on a plain instruct model) — same API, lower accuracy, no new downloads
  fallback,
  // Options forwarded to the zeroshotClassifier feature when the fallback is used (model, baseURL, port, provider, …)
  classifier,
  // Probability at or above which a yesNo answer resolves to true
  yesNoThreshold,
  // Per-request timeout for the decision endpoint
  timeoutMs,
})
```

## Options (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `baseURL` | `string` | Root URL of an Ollama (or other Jev-compatible) server. The decision endpoint is POST {baseURL}/v1/systemone. Falls back to the LUCA_DECISIONS_BASE_URL env var |
| `model` | `string` | Decision model to ask. Ollama ships `nimble` (9B, ~9.5GB, needs a 16GB+ machine), `tev1` (4B, ~4.5GB) and `tev1:0.8b` (~800MB, runs anywhere) |
| `apiKey` | `string` | Bearer token for the decision endpoint (falls back to the LUCA_DECISIONS_API_KEY env var). Local Ollama needs none |
| `provider` | `string` | A modelProviders profile id to resolve baseURL/apiKey from (AGI containers only). Ignored when baseURL is set explicitly |
| `fallback` | `string` | What to do when no decision model answers. `classifier` emulates every question with the zeroshotClassifier feature (a one-token logprob pass on a plain instruct model) — same API, lower accuracy, no new downloads |
| `classifier` | `object` | Options forwarded to the zeroshotClassifier feature when the fallback is used (model, baseURL, port, provider, …) |
| `yesNoThreshold` | `number` | Probability at or above which a yesNo answer resolves to true |
| `timeoutMs` | `number` | Per-request timeout for the decision endpoint |

## Methods

### isAvailable

Probe the decision server. Resolves true when it answers and the configured model is pulled, false otherwise. Never throws.

**Returns:** `Promise<boolean>`

```ts
if (!(await d.isAvailable())) console.log('run: ollama pull nimble')
```



### decide

Ask every question about one state in a single call. Answers are typed per key from the question builders you passed.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `state` | `string` | ✓ | The input the questions are about (a ticket, a message, a game frame…) |
| `questions` | `Q` | ✓ | Named questions built with choice()/yesNo()/score(); at most 64 |

**Returns:** `Promise<AnswersFor<Q>>`

```ts
const { route } = await d.decide(userMessage, {
 route: d.choice('Which model should handle this?', {
   fast: 'Short factual lookups and chit-chat',
   deep: 'Multi-step reasoning, code, or long documents',
 }),
})
const model = route.choice === 'deep' ? 'claude-opus-5-5' : 'claude-haiku-4-5-20251001'
```



### decideMany

Ask the same questions about many states. Runs calls with bounded concurrency; results keep input order.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `states` | `string[]` | ✓ | Inputs to decide on |
| `questions` | `Q` | ✓ | The shared question set |
| `concurrency` | `any` |  | Parallel requests in flight (default 4) |

**Returns:** `Promise<Array<AnswersFor<Q>>>`

```ts
const results = await d.decideMany(tickets.map(t => t.body), {
 spam: d.yesNo('This message is unsolicited marketing.'),
})
const clean = tickets.filter((_, i) => !results[i]!.spam.value)
```



## Getters

| Property | Type | Description |
|----------|------|-------------|
| `model` | `string` | The decision model name sent on every request. |
| `baseURL` | `string` | Root URL of the decision server (explicit option, else env, else local Ollama). |
| `endpoint` | `string` | Full URL of the decision endpoint. |

## Events (Zod v4 schema)

### fallback

When a decide() call falls back to the classifier emulation

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `reason` | `string` | Why the native endpoint was abandoned |



### decided

After every successful decide()

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `state` | `string` | The input state the questions were asked about |
| `backend` | `'native' | 'classifier'` | Which backend produced the answers |
| `answers` | `object` | Answer per question key |
| `durationMs` | `number` | Wall-clock time of the call |



## State (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | `boolean` | Whether this feature is currently enabled |
| `lastBackend` | `string` | Which backend answered the most recent decide() call |
| `decisionsMade` | `number` | Count of successful decide() calls this process |

## Examples

**features.decisions**

```ts
const d = container.feature('decisions', { model: 'nimble' })
const r = await d.decide('Checkout has returned 500 errors since 9am.', {
 label: d.choice('Which label fits this ticket?', {
   billing: 'Payments and refunds',
   bug: 'Software errors',
   account: 'Login and account access',
 }),
 urgent: d.yesNo('This needs a human response within the hour.'),
 severity: d.score('How severe is the impact?', ['cosmetic', 'degraded', 'outage']),
})
r.label.choice        // 'bug'
r.urgent.value        // true
r.severity.score      // 0.9
r.severity.label      // 'outage'
```



**isAvailable**

```ts
if (!(await d.isAvailable())) console.log('run: ollama pull nimble')
```



**decide**

```ts
const { route } = await d.decide(userMessage, {
 route: d.choice('Which model should handle this?', {
   fast: 'Short factual lookups and chit-chat',
   deep: 'Multi-step reasoning, code, or long documents',
 }),
})
const model = route.choice === 'deep' ? 'claude-opus-5-5' : 'claude-haiku-4-5-20251001'
```



**decideMany**

```ts
const results = await d.decideMany(tickets.map(t => t.body), {
 spam: d.yesNo('This message is unsolicited marketing.'),
})
const clean = tickets.filter((_, i) => !results[i]!.spam.value)
```

