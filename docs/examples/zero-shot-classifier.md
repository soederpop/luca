---
title: 'Zero-Shot Triage: Classifying a Support Inbox with Local Probabilities'
tags:
  - zeroshotClassifier
  - llamaServer
  - classification
  - local-inference
  - composition
lastTested: '2026-09-19'
lastTestPassed: true
---

# Zero-Shot Triage: Classifying a Support Inbox with Local Probabilities

A real inbox pipeline, entirely on local inference: raw customer emails come in, a
**zeroshotClassifier** routes each one to a department, a second classifier scores
urgency, and a probability threshold catches the ambiguous ones for human review
instead of silently guessing. No API keys, no cloud calls — the classifier runs a
local llama-server (Qwen3-4B by default) and returns a **probability for every
option** from a single forward pass, so "how sure was it" is part of every answer.

For the full API: `luca describe zeroshotClassifier`.

## Make sure the model is ready

The classifier serves its own model on its own port (default 8145), separate from
the default chat server. `ensureReady()` downloads the llama-server binary and the
model weights when missing (~2.5GB, one time), then health-checks the server. The
first classification after an idle period pays a few seconds of model load; after
that, calls are tens of milliseconds.

```ts
// bare assignment: survives into later blocks
router = container.feature('zeroshotClassifier', {
  systemPrompt: `You route inbound email for a small software company.
Judge only what the sender needs, not their tone. If an email mixes topics,
pick the department that must act first. A sales pitch aimed AT us is 'noise',
however it is disguised.`,
  availableOptions: [
    { label: 'support', description: 'existing customer needs help or reports something broken' },
    { label: 'billing', description: 'invoices, refunds, card or subscription problems' },
    { label: 'sales', description: 'prospective customer asking about pricing, plans, or demos' },
    { label: 'noise', description: 'vendor pitches, link-exchange spam, automated notifications' },
  ],
})

await router.ensureReady()
console.log('classifier server ready at', router.baseURL)
```

Two things worth copying in that configuration: the **system prompt carries the
judging perspective and the tie-break rules** ("must act first", "pitches at us are
noise"), while the **option descriptions carry the definitions**. Don't re-list the
options inside the system prompt — the feature already renders them as a lettered
list, and a drifting second copy just confuses the model.

## Classify raw inputs — and read the distribution

Inputs go in raw and untrimmed. Pre-summarizing tends to strip exactly the details
that separate the labels.

```ts
inbox = [
  {
    id: 'msg-1',
    body: `Subject: quick q
We're on the Teams plan and my colleague can't log in since yesterday,
it says "workspace suspended". Our card may have expired last month.
Can you fix this today? We have a filing deadline.`,
  },
  {
    id: 'msg-2',
    body: `Subject: Boost your domain authority
Hi there! I came across your site and loved it. We help SaaS companies
like yours rank #1 on Google. Do you have 15 minutes this week?`,
  },
  {
    id: 'msg-3',
    body: `Subject: pricing for 40 seats
Hello — evaluating options for our design team (40 people). Does the
Business tier support SSO, and is there a discount for annual billing?`,
  },
]

results = []
for (const message of inbox) {
  const result = await router.classify(message.body)
  results.push({ ...message, ...result })
  console.log(message.id, '→', result.label, `(${(result.probability * 100).toFixed(1)}%)`)
}
```

`classify()` returns `{ label, probability, probabilities }`; `run()` returns just
the `probabilities` record when that's all you need. The distribution is the point:
msg-1 is genuinely ambiguous (a login lockout *caused by* a billing failure), and
instead of false certainty you get the mass split across `support` and `billing`.

```ts
const msg1 = results[0]
const supportPlusBilling = msg1.probabilities.support + msg1.probabilities.billing
if (supportPlusBilling < 0.9) throw new Error(`expected msg-1 mass on support+billing, got ${JSON.stringify(msg1.probabilities)}`)
if (results[1].label !== 'noise') throw new Error(`expected msg-2 to be noise, got ${results[1].label}`)
if (results[2].label !== 'sales') throw new Error(`expected msg-3 to be sales, got ${results[2].label}`)
console.log('msg-1 split:', JSON.stringify(msg1.probabilities))
```

## Threshold on probability, not just the winner

The winning label alone throws away the most useful signal. A routing pipeline
should auto-route only when the model is actually sure, and queue the rest for a
human. That's a one-line policy once you have real probabilities:

```ts
CONFIDENCE_FLOOR = 0.8

routed = []
needsReview = []
for (const r of results) {
  if (r.probability >= CONFIDENCE_FLOOR) routed.push(r)
  else needsReview.push(r)
}
console.log(`auto-routed ${routed.length}, queued ${needsReview.length} for review`)
```

The same pattern inverts for moderation-style checks: a `hostile` option can *lose*
the argmax at 30% probability and still deserve a look — threshold on
`probabilities.hostile`, not on `label`.

## Compose a second dimension: urgency

Classifiers are cheap to instantiate — same server, same loaded model, different
prompt. A second one scores urgency, and because both share the model on port 8145,
the second dimension costs one more forward pass per message, not a second model in
memory.

```ts
urgency = container.feature('zeroshotClassifier', {
  systemPrompt: `You rate how urgently a customer email needs a first response.
Judge stated impact and deadlines, not politeness or capitalization. Sales
pitches aimed at us are never urgent.`,
  availableOptions: [
    { label: 'today', description: 'the sender is blocked or names a hard deadline' },
    { label: 'this_week', description: 'real request, no stated time pressure' },
    { label: 'whenever', description: 'informational, promotional, or no response needed' },
  ],
})

for (const r of results) {
  const u = await urgency.classify(r.body)
  r.urgency = u.label
  console.log(r.id, '→', r.label, '/', u.label)
}

if (results[0].urgency !== 'today') throw new Error(`expected msg-1 urgent today, got ${results[0].urgency}`)
if (results[1].urgency === 'today') throw new Error('a vendor pitch should never be urgent')
console.log('two-dimension triage complete')
```

Note what the second system prompt does: it re-anchors the *same input* to a
different question. Zero-shot means the labels are just prompt text — adding a
dimension is a config change, not a training run.

## Listen for classifications

Every successful `classify()`/`run()` emits a `classified` event with the input,
the winning label, and the full distribution — the natural hook for logging,
metrics, or feeding a review queue without threading callbacks through your
pipeline.

```ts
seen = []
urgency.on('classified', ({ label, probabilities }) => {
  seen.push({ label, top: Math.max(...Object.values(probabilities)) })
})

await urgency.run('URGENT!!! production is down for all our users, please call us')
if (seen.length !== 1 || seen[0].label !== 'today') throw new Error(`expected an urgent classified event, got ${JSON.stringify(seen)}`)
console.log('classified event observed:', JSON.stringify(seen[0]))
```

## How it works under the hood (and its limits)

The options are rendered as a lettered list (`A. support`, `B. billing`, …) and a
GBNF grammar restricts generation to exactly one letter token. The probabilities
come from that single position's `top_logprobs` — the model's real pre-constraint
distribution over next tokens — exponentiated and renormalized over your labels.
One generated token per classification: no sampling noise, no output parsing.

Speed, measured on an M-series MacBook with the default Qwen3-4B: **~35ms per
classification (~27/sec)** when inputs share a cached prefix, **~120ms (~8/sec)**
for fully unique ~150-token inputs (prompt processing dominates; the generated
token is always exactly one), and ~49/sec with 16 concurrent cached requests.
The system prompt and options are a stable prefix the server caches across calls,
so only the input tokens cost anything after the first request.

Two limits follow directly: **at most 20 options** (`top_logprobs` caps at 20), and
the probabilities are the model's *belief* — small models are often overconfident,
so trust the rank order and relative mass, and use absolute values as a threshold
signal rather than a calibrated frequency. The classifier's server idles out after
15 minutes without requests (configurable via `idleTimeoutMs`), so a cold call pays
model-load time once.

```ts
console.log('done — classifier server on', router.baseURL, 'will idle out on its own')
```
