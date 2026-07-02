# TelnyxAssistantConnector (features.telnyxAssistantConnector)

> Stability: `experimental`

Bridges a local Luca assistant to Telnyx AI by exposing tool handlers as HTTP endpoints and creating a mirrored Telnyx assistant with webhook bindings.

## Usage

```ts
container.feature('telnyxAssistantConnector', {
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



### streamSpeak

Stream text-to-speech audio over a WebSocket, yielding `Buffer` chunks as they arrive. First audio chunk typically arrives in <500ms. You can pipe chunks directly to a speaker or file stream.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `text` | `string` | ✓ | Parameter text |
| `opts` | `{ voice?: string; voiceSettings?: any }` |  | Parameter opts |

**Returns:** `AsyncGenerator<Buffer>`

```ts
// collect all chunks (still faster than speak() for long text)
const chunks: Buffer[] = []
for await (const chunk of connector.streamSpeak('Hello world')) {
 chunks.push(chunk)
}
const audio = Buffer.concat(chunks)

// or pipe to a write stream as chunks arrive
const out = fs.createWriteStream('/tmp/out.pcm')
for await (const chunk of connector.streamSpeak('Hello', { voice: 'Telnyx.Ultra.Aurora' })) {
 out.write(chunk)
}
out.end()
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



### listConversations

List conversations for this assistant. Automatically filters by the assistant ID stored in state when available, so you only see conversations that belong to the current deployment.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `query` | `Record<string, any>` |  | Parameter query |

**Returns:** `void`

```ts
const convos = await connector.listConversations()
const recent = await connector.listConversations({ order: 'last_message_at.desc', limit: 20 })
```



### getConversation

Retrieve a specific conversation by ID.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `conversationId` | `string` | ✓ | Parameter conversationId |

**Returns:** `void`



### getConversationMessages

List all messages in a conversation, including assistant tool calls.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `conversationId` | `string` | ✓ | Parameter conversationId |

**Returns:** `void`



### getConversationInsights

Retrieve post-call insights for a conversation (summaries, extracted data, etc.). Insights are generated asynchronously after the call ends — check `status` field.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `conversationId` | `string` | ✓ | Parameter conversationId |

**Returns:** `void`



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

```ts
await connector.handoffToHuman(conversationId)
```



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
 name: 'call-summary',
 instructions: 'Summarize this call in 2-3 sentences.',
})
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

Event emitted by TelnyxAssistantConnector



### stopped

Event emitted by TelnyxAssistantConnector



### toolCall

Event emitted by TelnyxAssistantConnector



### toolError

Event emitted by TelnyxAssistantConnector



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

**features.telnyxAssistantConnector**

```ts
const mgr = container.feature('assistantsManager')
const chief = mgr.create('chiefOfStaff')
const connector = container.feature('telnyxAssistantConnector', { assistant: chief })
await connector.start()
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



**speak**

```ts
const audio = await connector.speak('Hello world', { voice: 'Telnyx.Ultra.Aurora' })
await fs.writeFile('/tmp/out.mp3', audio)
```



**streamSpeak**

```ts
// collect all chunks (still faster than speak() for long text)
const chunks: Buffer[] = []
for await (const chunk of connector.streamSpeak('Hello world')) {
 chunks.push(chunk)
}
const audio = Buffer.concat(chunks)

// or pipe to a write stream as chunks arrive
const out = fs.createWriteStream('/tmp/out.pcm')
for await (const chunk of connector.streamSpeak('Hello', { voice: 'Telnyx.Ultra.Aurora' })) {
 out.write(chunk)
}
out.end()
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



**listConversations**

```ts
const convos = await connector.listConversations()
const recent = await connector.listConversations({ order: 'last_message_at.desc', limit: 20 })
```



**handoffToHuman**

```ts
await connector.handoffToHuman(conversationId)
```



**createInsight**

```ts
await connector.createInsight({
 name: 'call-summary',
 instructions: 'Summarize this call in 2-3 sentences.',
})
await connector.createInsight({
 name: 'action-items',
 instructions: 'Extract any action items promised during the call.',
 json_schema: { type: 'array', items: { type: 'string' } },
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

