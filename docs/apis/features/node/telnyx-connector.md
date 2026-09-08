# TelnyxConnector (features.telnyxConnector)

> Stability: `experimental`

Bridges a local Luca assistant to Telnyx AI by exposing tool handlers as HTTP endpoints and creating a mirrored Telnyx assistant with webhook bindings.

## Usage

```ts
container.feature('telnyxConnector', {
  // The Luca assistant instance to bridge to Telnyx
  assistant,
  // Port for the local express server
  port,
  // Telnyx model ID
  model,
  // Greeting message for the Telnyx assistant
  greeting,
  // Phone number to wire to the assistant (e.g. +13125552200)
  phoneNumber,
  // Deploy without tools — skip local server and tunnel
  noTools,
  // Emit verbose [telnyx] log output
  debug,
  // Pre-configured domain name (e.g. from cloudflared tunnel). Skips ephemeral tunnel creation.
  domain,
  // TTS voice ID (e.g. Telnyx.Ultra.<id> or an ElevenLabs voice ID). If omitted, uses Telnyx default.
  voice,
  // TTS provider: "telnyx" (default) or "elevenlabs"
  ttsProvider,
  // Integration secret identifier for the TTS provider API key (required for ElevenLabs)
  apiKeyRef,
  // UUID of a Telnyx pronunciation dictionary to attach to the assistant voice. Falls back to pronunciationDictId in the assistant's voice.yml. Survives redeploys — without this, a manually-attached dictionary is lost every time the assistant is recreated.
  pronunciationDictId,
  // Shared secret Telnyx must present on tool webhook calls. Auto-generated per deploy if omitted.
  toolSecret,
  // E.164 numbers allowed past the caller restriction. Omit for a fully open line. How the restriction is enforced is set by callerPolicy.
  allowedCallers,
  // How allowedCallers is enforced. 'screen': unlisted callers hear rejectMessage and the call ends before the assistant answers (SMS from unlisted senders gets rejectMessage back). 'tools': anyone can converse, but unlisted callers cannot trigger tool calls. Tool webhooks are secret-gated in both modes.
  callerPolicy,
  // What unlisted callers hear (or receive via SMS) under callerPolicy 'screen'.
  rejectMessage,
  // Leave the Telnyx assistant, screening app, and number wiring in place on stop() so the next start() can reuse them. For supervised deployments that restart with the loop.
  persist,
  // Named targets for the native transfer tool. Telnyx executes transfers itself (works in noTools mode too), so any caller who reaches the assistant can request one — under callerPolicy 'tools' the only guard is prompt instructions. Requires phoneNumber: transfers originate from the deployed number.
  transferTargets,
  // Attach the native send_dtmf tool so the assistant can press keypad digits — navigating phone trees and extension menus on outbound calls. Telnyx executes it natively (works in noTools mode too). Pair it with prompt instructions telling the assistant which extensions to use.
  dtmf,
  // Natural-language instructions for how the assistant briefs the transfer recipient before connecting the caller. Omit for a cold transfer.
  warmTransferInstructions,
})
```

## Options (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `assistant` | `any` | The Luca assistant instance to bridge to Telnyx |
| `port` | `number` | Port for the local express server |
| `model` | `string` | Telnyx model ID |
| `greeting` | `string` | Greeting message for the Telnyx assistant |
| `phoneNumber` | `string` | Phone number to wire to the assistant (e.g. +13125552200) |
| `noTools` | `boolean` | Deploy without tools — skip local server and tunnel |
| `debug` | `boolean` | Emit verbose [telnyx] log output |
| `domain` | `string` | Pre-configured domain name (e.g. from cloudflared tunnel). Skips ephemeral tunnel creation. |
| `voice` | `string` | TTS voice ID (e.g. Telnyx.Ultra.<id> or an ElevenLabs voice ID). If omitted, uses Telnyx default. |
| `ttsProvider` | `string` | TTS provider: "telnyx" (default) or "elevenlabs" |
| `apiKeyRef` | `string` | Integration secret identifier for the TTS provider API key (required for ElevenLabs) |
| `pronunciationDictId` | `string` | UUID of a Telnyx pronunciation dictionary to attach to the assistant voice. Falls back to pronunciationDictId in the assistant's voice.yml. Survives redeploys — without this, a manually-attached dictionary is lost every time the assistant is recreated. |
| `toolSecret` | `string` | Shared secret Telnyx must present on tool webhook calls. Auto-generated per deploy if omitted. |
| `allowedCallers` | `array` | E.164 numbers allowed past the caller restriction. Omit for a fully open line. How the restriction is enforced is set by callerPolicy. |
| `callerPolicy` | `string` | How allowedCallers is enforced. 'screen': unlisted callers hear rejectMessage and the call ends before the assistant answers (SMS from unlisted senders gets rejectMessage back). 'tools': anyone can converse, but unlisted callers cannot trigger tool calls. Tool webhooks are secret-gated in both modes. |
| `rejectMessage` | `string` | What unlisted callers hear (or receive via SMS) under callerPolicy 'screen'. |
| `persist` | `boolean` | Leave the Telnyx assistant, screening app, and number wiring in place on stop() so the next start() can reuse them. For supervised deployments that restart with the loop. |
| `transferTargets` | `array` | Named targets for the native transfer tool. Telnyx executes transfers itself (works in noTools mode too), so any caller who reaches the assistant can request one — under callerPolicy 'tools' the only guard is prompt instructions. Requires phoneNumber: transfers originate from the deployed number. |
| `dtmf` | `boolean` | Attach the native send_dtmf tool so the assistant can press keypad digits — navigating phone trees and extension menus on outbound calls. Telnyx executes it natively (works in noTools mode too). Pair it with prompt instructions telling the assistant which extensions to use. |
| `warmTransferInstructions` | `string` | Natural-language instructions for how the assistant briefs the transfer recipient before connecting the caller. Omit for a cold transfer. |

## Methods

### listMessagingProfiles

List all messaging profiles on the account.

**Returns:** `void`



### getMessagingProfile

Get full details of a messaging profile by ID.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `profileId` | `string` | ✓ | Parameter profileId |

**Returns:** `void`



### listAssistants

List all AI assistants on the account.

**Returns:** `void`



### getAssistant

Get full details of a Telnyx AI assistant by ID.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `assistantId` | `string` | ✓ | Parameter assistantId |

**Returns:** `void`



### listConversations

List recent AI conversations (phone calls) newest-first. Each conversation's `metadata` carries `from`, `to`, `call_session_id`, `call_control_id`, and `assistant_id` — everything needed to join to recordings and detail records.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `opts` | `{ limit?: number; assistantId?: string; order?: string }` |  | Parameter opts |

**Returns:** `void`

```ts
const convos = await connector.listConversations({ limit: 50 })
```



### getConversation

Retrieve a single conversation by id, or null if not found.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `conversationId` | `string` | ✓ | Parameter conversationId |

**Returns:** `void`



### getConversationMessages

Full transcript for a conversation, oldest message first. Telnyx message `text` may contain inline `<emotion .../>` control tags — callers that display transcripts should strip them.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `conversationId` | `string` | ✓ | Parameter conversationId |

**Returns:** `void`



### getConversationInsights

Post-call AI insights (summary) for a conversation. Returns the raw insight records; the human-readable summary is `result` on each.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `conversationId` | `string` | ✓ | Parameter conversationId |

**Returns:** `void`



### getConversationCost

The `ai-voice-assistant` detail record for a single conversation — one row carrying `cost`, `currency`, `duration_sec`, `billed_sec`, `llm_model`, `tts_provider`, `tts_voice_id`, and `stt_model`. Returns null if no CDR has been generated yet (billing can lag a completed call by a few minutes).

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `conversationId` | `string` | ✓ | Parameter conversationId |

**Returns:** `void`



### getRecordingUrl

A fresh, signed MP3 download URL for a call's recording, or null if none. Telnyx signs these URLs with a short expiry, so fetch on demand rather than persisting the link.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `callSessionId` | `string` | ✓ | Parameter callSessionId |

**Returns:** `Promise<string | null>`



### addConversationMessage

Manually inject a message into a conversation. Useful for adding context or system messages outside of a live call.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `conversationId` | `string` | ✓ | Parameter conversationId |
| `message` | `{
    role: string
    content?: string
    name?: string
    sent_at?: string
    tool_call_id?: string
    tool_calls?: Array<Record<string, unknown>>
  }` | ✓ | Parameter message |

**Returns:** `void`



### handoffToHuman

Disable AI responses on a conversation so a human agent can take over. While disabled, calls to the Telnyx chat endpoint return 400. Re-enable with `handoffToAI()`.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `conversationId` | `string` | ✓ | Parameter conversationId |

**Returns:** `void`



### handoffToAI

Re-enable AI responses on a conversation after a human handoff.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `conversationId` | `string` | ✓ | Parameter conversationId |

**Returns:** `void`



### createInsight

Create an insight template — a reusable instruction applied to conversations to extract structured data (summaries, action items, sentiment, etc.). Optionally provide a `json_schema` to enforce structured output.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `params` | `{ name: string; instructions: string; json_schema?: unknown; webhook?: string }` | ✓ | Parameter params |

**Returns:** `void`

```ts
await connector.createInsight({
 name: 'action-items',
 instructions: 'Extract any action items promised during the call.',
 json_schema: { type: 'array', items: { type: 'string' } },
})
```



### listInsights

List all insight templates on the account.

**Returns:** `void`



### deleteInsight

Delete an insight template by ID.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `insightId` | `string` | ✓ | Parameter insightId |

**Returns:** `void`



### listModels

List the inference models available to your Telnyx account. Model IDs are `{source}/{model_name}` (e.g. `moonshotai/Kimi-K2.6`) — the same strings the `model` option accepts.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `opts` | `{ filter?: string }` |  | Parameter opts |

**Returns:** `void`

```ts
await connector.listModels()                     // everything
await connector.listModels({ filter: 'kimi' })   // just the Kimi family
```



### listVoices

List voices available to your Telnyx account. Optionally pass an integration secret ref for ElevenLabs — Telnyx will then include your personal ElevenLabs voices in the response.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `opts` | `{ provider?: string; apiKeyRef?: string; filter?: string }` |  | Parameter opts |

**Returns:** `void`

```ts
await connector.listVoices()                               // Telnyx defaults
await connector.listVoices({ provider: 'ElevenLabs',       // your custom voices
                            apiKeyRef: 'elevenlabs_api_key' })
```



### updateAssistantVoice

Patch voice_settings on an existing Telnyx AI assistant. Useful for iterating on the voice string without redeploying.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `assistantId` | `string` | ✓ | Parameter assistantId |
| `voiceSettings` | `any` | ✓ | Parameter voiceSettings |

**Returns:** `void`

```ts
await connector.updateAssistantVoice('assistant-abc', {
 voice: 'ElevenLabs.eleven_v3.ulEiUT06p4S3sHtsvn4T',
 api_key_ref: 'elevenlabs_api_key',
 voice_speed: 1.05,
})
```



### setHandoffTargets

Add or replace the native handoff tool on the deployed Telnyx assistant, letting it hand the conversation to other Telnyx assistants mid-call. Handoff targets need Telnyx assistant IDs, which only exist once those assistants are deployed — so this is a post-`start()` patch, not a create-time option. Safe to call on every deploy: it replaces any existing handoff tool, which also heals stale IDs after a target was deleted and recreated.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `targets` | `Array<{ id: string; name: string }>` | ✓ | Parameter targets |
| `voiceMode` | `'unified' | 'distinct'` |  | Parameter voiceMode |

**Returns:** `void`

```ts
await connector.setHandoffTargets([
 { id: 'assistant-abc123', name: 'receptionist — greets and routes callers' },
])
```



### speak

Convert text to speech and return the full audio as a Buffer. Uses the Telnyx TTS REST endpoint — waits for the complete audio before returning. For lower latency on longer text, use `streamSpeak()` instead.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `text` | `string` | ✓ | Parameter text |
| `opts` | `{ voice?: string; apiKeyRef?: string; voiceSettings?: any }` |  | Parameter opts |

**Returns:** `Promise<Buffer>`

```ts
const audio = await connector.speak('Hello world', { voice: 'Telnyx.Ultra.Aurora' })
await fs.writeFile('/tmp/out.mp3', audio)
```



### createTranscriptionStream

Open a standalone speech-to-text stream for mono, signed 16-bit little-endian PCM audio. No phone call or deployed assistant is needed. Attach `event` and `error` listeners immediately, await `waitForOpen()`, then `send()` audio. Send `{"type":"CloseStream"}` through `stream.socket` to flush final transcripts before closing; terminate the socket when the consumer leaves.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `opts` | `{ sampleRate?: number; language?: string }` |  | Parameter opts |

**Returns:** `Promise<SpeechToTextWS>`

```ts
const stream = await connector.createTranscriptionStream({ sampleRate: 48000 })
stream.on('event', frame => console.log(frame))
stream.on('error', error => console.error(error.message))
await stream.waitForOpen()
stream.send(pcmChunk)
stream.socket.send(JSON.stringify({ type: 'CloseStream' }))
```



### streamSpeak

Stream text-to-speech audio over a WebSocket, yielding `Buffer` chunks as they arrive. First audio chunk typically arrives in <500ms. You can pipe chunks directly to a speaker or file stream.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `text` | `string` | ✓ | Parameter text |
| `opts` | `{ voice?: string; voiceSettings?: any }` |  | Parameter opts |

**Returns:** `AsyncGenerator<Buffer>`

```ts
const chunks: Buffer[] = []
for await (const chunk of connector.streamSpeak('Hello world')) {
 chunks.push(chunk)
}
const audio = Buffer.concat(chunks)
```



### testVoice

Try a voice_settings object on the standalone TTS command endpoint and save the MP3 locally so you can listen. Fastest way to confirm a voice string is valid without deploying an assistant.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `opts` | `{ voice: string; apiKeyRef?: string; text: string; outputPath?: string; voiceSettings?: any }` | ✓ | Parameter opts |

**Returns:** `void`

```ts
await connector.testVoice({
 voice: 'ElevenLabs.eleven_v3.ulEiUT06p4S3sHtsvn4T',
 apiKeyRef: 'elevenlabs_api_key',
 text: 'Top of the morning.',
 outputPath: 'docs/calls/voice-test.mp3',
})
```



### inspectVoice

Pretty-print the voice-related config of an assistant. Shows the raw voice_settings that Telnyx has stored, so you can compare against what the UI displays.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `assistantId` | `string` | ✓ | Parameter assistantId |

**Returns:** `void`



### listPhoneNumbers

List all phone numbers on the Telnyx account with their status and connection info.

**Returns:** `void`



### getPhoneNumber

Get the phone number record (voice + messaging config) for an E.164 number.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `phoneNumber` | `string` | ✓ | Parameter phoneNumber |

**Returns:** `void`



### searchNumbers

Search Telnyx inventory for purchasable phone numbers.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `opts` | `{
    /** Three-digit national destination code, e.g. '312' */
    areaCode?: string
    /** City name, e.g. 'Chicago' */
    locality?: string
    /** US state / CA province, e.g. 'IL' */
    administrativeArea?: string
    /** ISO country code; defaults to 'US' */
    countryCode?: string
    /** Required features, e.g. ['sms', 'voice'] */
    features?: Array<'sms' | 'mms' | 'voice' | 'fax' | 'emergency' | 'hd_voice' | 'international_sms' | 'local_calling'>
    /** Max results; defaults to 10 */
    limit?: number
  }` |  | Parameter opts |

**Returns:** `void`

```ts
const telnyx = container.feature('telnyxConnector')
const available = await telnyx.searchNumbers({ areaCode: '312', features: ['sms', 'voice'] })
console.log(available.map(n => n.phone_number))
```



### purchaseNumber

Purchase a phone number from Telnyx inventory. Creates a number order and, by default, polls until Telnyx marks it complete (usually seconds for US numbers). Pass wait: false to return the pending order immediately.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `phoneNumber` | `string` | ✓ | Parameter phoneNumber |
| `opts` | `{
    /** Wire the purchased number to this connection */
    connectionId?: string
    /** Attach this messaging profile to the purchased number */
    messagingProfileId?: string
    /** Free-form reference stored on the order */
    customerReference?: string
    /** Poll the order until it leaves 'pending'; defaults to true */
    wait?: boolean
    /** Max time to poll before giving up, in ms; defaults to 30000 */
    timeout?: number
  }` |  | Parameter opts |

**Returns:** `void`

```ts
const telnyx = container.feature('telnyxConnector')
const [candidate] = await telnyx.searchNumbers({ areaCode: '312', limit: 1 })
const order = await telnyx.purchaseNumber(candidate.phone_number)
console.log(order.status) // 'success'
```



### getNumberOrder

Get the current status of a number order by ID.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `orderId` | `string` | ✓ | Parameter orderId |

**Returns:** `void`



### getTexmlApp

Get a TeXML application by ID.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `appId` | `string` | ✓ | Parameter appId |

**Returns:** `void`



### listTexmlApps

List all TeXML applications on the account.

**Returns:** `void`



### deleteAllTexmlApps

Delete all TeXML applications on the account. Returns a summary of what was deleted and any failures.

**Returns:** `void`



### inspect

Inspect the full live config: the current assistant, its messaging profile, the phone number wiring, and the TeXML app. Pass a phone number to include phone config, or omit to just show assistant + profile.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `phoneNumber` | `string` |  | Parameter phoneNumber |

**Returns:** `void`



### dial

Place an outbound call from the assistant to a phone number, with an optional per-call greeting and purpose delivered as dynamic variables. Deployed assistants template their greeting as `{{greeting_line}}` and carry a `{{call_context}}` section in their instructions, so both can be set per call without touching the deployment. Works standalone (assistant: null) as long as the `from` number is wired to a Telnyx AI assistant — the assistant is resolved from the number.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `to` | `string` | ✓ | Parameter to |
| `opts` | `{
    /** Calling number in E.164; defaults to options.phoneNumber. */
    from?: string
    /** First thing the assistant says on answer. */
    greeting?: string
    /** Why the assistant is calling — injected into its instructions. */
    context?: string
    /** Extra dynamic variables for custom templates. */
    variables?: Record<string, string>
    /** Telnyx assistant ID; defaults to state, then the number's wiring. */
    assistantId?: string
    /**
     * Answering-machine detection. 'Enable' classifies human vs machine as
     * soon as possible; 'DetectMessageEnd' additionally waits for the
     * voicemail beep, so the assistant starts talking after it and the
     * greeting lands on the recording instead of being cut off.
     */
    machineDetection?: 'Enable' | 'Disable' | 'DetectMessageEnd'
    /** AMD engine: 'Premium' (ML-based) or 'Regular'. */
    detectionMode?: 'Premium' | 'Regular'
    /** Overall AMD window in milliseconds. */
    machineDetectionTimeout?: number
    /** Seconds to wait for an answer before canceling (5–120, Telnyx default 30). */
    timeoutSeconds?: number
  }` |  | Parameter opts |

**Returns:** `void`

```ts
await connector.dial('+13125550000', {
 greeting: 'Hey Jon, calling with your morning brief.',
 context: 'You called Jon to deliver his morning brief. Keep it under two minutes.',
 machineDetection: 'DetectMessageEnd',
})
```



### start

Start the connector: mount tool endpoints, establish public URL, create Telnyx assistant, and optionally wire a phone number to it.

**Returns:** `void`

```ts
const info = await connector.start()
console.log(info.publicUrl, info.telnyxAssistantId)
```



### stop

Stop the connector: restore the phone number's previous connection, delete the Telnyx assistant, kill tunnel (if ephemeral), stop the server.

**Returns:** `void`

```ts
await connector.stop()
```



## Getters

| Property | Type | Description |
|----------|------|-------------|
| `assistant` | `any` |  |
| `assistantName` | `string` | Canonical name derived from the assistant folder (e.g. `receptionist`), used for both the Telnyx assistant and its messaging profile. |

## Events (Zod v4 schema)

### started

Event emitted by TelnyxConnector



### stopped

Event emitted by TelnyxConnector



### toolDenied

Event emitted by TelnyxConnector



### toolCall

Event emitted by TelnyxConnector



### toolError

Event emitted by TelnyxConnector



### callScreened

Event emitted by TelnyxConnector



## State (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | `boolean` | Whether this feature is currently enabled |
| `publicUrl` | `string` | The public URL for tool webhooks (tunnel or pre-configured domain) |
| `telnyxAssistantId` | `string` | The Telnyx assistant ID created for this session |
| `phoneNumberId` | `string` | The Telnyx phone number ID wired to the assistant |
| `port` | `number` | The port the express server is listening on |
| `running` | `boolean` | Whether the connector is actively running |

## Examples

**features.telnyxConnector**

```ts
const mgr = container.feature('assistantsManager')
const chief = mgr.create('chiefOfStaff')
const connector = container.feature('telnyxConnector', { assistant: chief })
await connector.start()
```



**listConversations**

```ts
const convos = await connector.listConversations({ limit: 50 })
```



**createInsight**

```ts
await connector.createInsight({
 name: 'action-items',
 instructions: 'Extract any action items promised during the call.',
 json_schema: { type: 'array', items: { type: 'string' } },
})
```



**listModels**

```ts
await connector.listModels()                     // everything
await connector.listModels({ filter: 'kimi' })   // just the Kimi family
```



**listVoices**

```ts
await connector.listVoices()                               // Telnyx defaults
await connector.listVoices({ provider: 'ElevenLabs',       // your custom voices
                            apiKeyRef: 'elevenlabs_api_key' })
```



**updateAssistantVoice**

```ts
await connector.updateAssistantVoice('assistant-abc', {
 voice: 'ElevenLabs.eleven_v3.ulEiUT06p4S3sHtsvn4T',
 api_key_ref: 'elevenlabs_api_key',
 voice_speed: 1.05,
})
```



**setHandoffTargets**

```ts
await connector.setHandoffTargets([
 { id: 'assistant-abc123', name: 'receptionist — greets and routes callers' },
])
```



**speak**

```ts
const audio = await connector.speak('Hello world', { voice: 'Telnyx.Ultra.Aurora' })
await fs.writeFile('/tmp/out.mp3', audio)
```



**createTranscriptionStream**

```ts
const stream = await connector.createTranscriptionStream({ sampleRate: 48000 })
stream.on('event', frame => console.log(frame))
stream.on('error', error => console.error(error.message))
await stream.waitForOpen()
stream.send(pcmChunk)
stream.socket.send(JSON.stringify({ type: 'CloseStream' }))
```



**streamSpeak**

```ts
const chunks: Buffer[] = []
for await (const chunk of connector.streamSpeak('Hello world')) {
 chunks.push(chunk)
}
const audio = Buffer.concat(chunks)
```



**testVoice**

```ts
await connector.testVoice({
 voice: 'ElevenLabs.eleven_v3.ulEiUT06p4S3sHtsvn4T',
 apiKeyRef: 'elevenlabs_api_key',
 text: 'Top of the morning.',
 outputPath: 'docs/calls/voice-test.mp3',
})
```



**searchNumbers**

```ts
const telnyx = container.feature('telnyxConnector')
const available = await telnyx.searchNumbers({ areaCode: '312', features: ['sms', 'voice'] })
console.log(available.map(n => n.phone_number))
```



**purchaseNumber**

```ts
const telnyx = container.feature('telnyxConnector')
const [candidate] = await telnyx.searchNumbers({ areaCode: '312', limit: 1 })
const order = await telnyx.purchaseNumber(candidate.phone_number)
console.log(order.status) // 'success'
```



**dial**

```ts
await connector.dial('+13125550000', {
 greeting: 'Hey Jon, calling with your morning brief.',
 context: 'You called Jon to deliver his morning brief. Keep it under two minutes.',
 machineDetection: 'DetectMessageEnd',
})
```



**start**

```ts
const info = await connector.start()
console.log(info.publicUrl, info.telnyxAssistantId)
```



**stop**

```ts
await connector.stop()
```
