# Speech (features.speech)

Text-to-speech synthesis using the Web Speech API (SpeechSynthesis). Wraps the browser's built-in speech synthesis, providing voice selection, queue management, and state tracking. Voices are discovered on init and exposed via state for UI binding.

## Usage

```ts
container.feature('speech')
```

## Methods

### loadVoices

**Returns:** `void`



### setDefaultVoice

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `name` | `string` | ✓ | Parameter name |

**Returns:** `void`



### cancel

**Returns:** `void`



### say

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `text` | `string` | ✓ | Parameter text |
| `options` | `{ voice?: Voice }` |  | Parameter options |

**Returns:** `void`



## Getters

| Property | Type | Description |
|----------|------|-------------|
| `voices` | `any` | Returns the array of available speech synthesis voices. |
| `defaultVoice` | `any` | Returns the Voice object matching the currently selected default voice name. |

## Examples

**features.speech**

```ts
const speech = container.feature('speech')
speech.say('Hello from the browser!')

// Choose a specific voice
const speech = container.feature('speech', { voice: 'Google UK English Female' })
speech.say('Cheerio!')
```

