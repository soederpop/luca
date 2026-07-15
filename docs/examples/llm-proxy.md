---
title: 'One Endpoint For All Your Compute: the llmProxy Server'
tags:
  - llmProxy
  - servers
  - docker
  - litellm
  - openai
  - composition
---

# One Endpoint For All Your Compute: the llmProxy Server

The `llmProxy` server runs a [LiteLLM proxy](https://docs.litellm.ai/docs/proxy/quick_start) in a docker container and fronts every backend you have — a GPU box on the LAN, LM Studio on this machine, paid APIs — with a single OpenAI-compatible endpoint. Point every client at `proxy.baseURL` and pick backends by model name.

For the full API: `luca describe llmProxy`. Requires the docker CLI for `start()`; config generation below runs without it.

## The model routing table

Each `models` entry maps a client-facing `modelName` to a backend. Local OpenAI-compatible servers (LM Studio, vLLM, llama.cpp, SGLang) use `provider: 'openai'` plus an `apiBase`; paid APIs just need their provider and a key.

```ts
proxy = container.server('llmProxy', {
  port: 4000,
  masterKey: 'sk-luca-dev',
  models: [
    // LM Studio on this machine
    { modelName: 'local-qwen', provider: 'openai', model: 'qwen2.5-32b', apiBase: 'http://localhost:1234/v1', apiKey: 'lm-studio' },
    // a GPU box on the LAN serving vLLM
    { modelName: 'dgx-llama', provider: 'openai', model: 'llama-3.3-70b', apiBase: 'http://192.168.1.50:8000/v1', apiKey: 'none' },
    // a paid API
    { modelName: 'claude', provider: 'anthropic', model: 'claude-sonnet-5', apiKey: 'sk-ant-example' },
  ],
})

console.log(proxy.baseURL)        // http://localhost:4000
console.log(proxy.containerName)  // luca-llm-proxy-4000
```

## What gets generated — and the two things that surprise everyone

`writeConfig()` (called by `start()`) writes the LiteLLM `config.yaml` into a tmp dir. Two behaviors to know about:

1. **localhost is rewritten.** The proxy runs *inside* a container, where `localhost` is the container itself — so LM Studio at `http://localhost:1234/v1` would be unreachable. Any localhost/127.0.0.1/0.0.0.0 `apiBase` is rewritten to the host gateway (`host.docker.internal` by default, `hostGatewayOverride` to change it).
2. **Secrets never touch the YAML.** API keys are written to a `0600` env file next to the config and referenced as `os.environ/...`. The env file is passed to the container via `--env-file` and deleted on `stop()`.

```ts
configPath = await proxy.writeConfig()
const config = container.feature('yaml').parse(container.feature('fs').readFile(configPath).toString())

console.log(config.model_list[0].litellm_params.api_base)
// http://host.docker.internal:1234/v1  <- localhost, rewritten

console.log(config.model_list[0].litellm_params.api_key)
// os.environ/LUCA_LLM_KEY_0            <- a reference, not the key

console.log(config.general_settings.master_key)
// os.environ/LITELLM_MASTER_KEY
```

Clean up the generated files since we're not booting the container in this doc:

```ts
await container.feature('fs').rm(container.paths.resolve(configPath, '..'), { recursive: true, force: true })
```

## Booting it for real

`start()` checks docker availability, force-removes any stale `luca-llm-proxy-<port>` container (so the running config always matches your options), runs the image with the port published and config mounted, and polls `/health/liveliness` until healthy — failing loudly with the container's log tail if it never comes up.

```ts skip
await proxy.start()

// one OpenAI-compatible endpoint for everything
const client = container.client('rest', { baseURL: proxy.baseURL })
const models = await client.get('/v1/models', { headers: { Authorization: 'Bearer sk-luca-dev' } })
console.log(models.data.map(m => m.id))   // ['local-qwen', 'dgx-llama', 'claude']

// chat completions route by model name
const reply = await client.post('/v1/chat/completions', {
  body: { model: 'local-qwen', messages: [{ role: 'user', content: 'hello' }] },
  headers: { Authorization: 'Bearer sk-luca-dev' },
})

// tail the LiteLLM container logs when something misbehaves
console.log(await proxy.logs({ tail: 20 }))

await proxy.stop()  // stops + removes the container, deletes the env file
```

## Where this fits

- `luca describe llmProxy` — full options/state reference
- `luca describe docker` — the feature doing the container lifting underneath
- `docs/examples/server-rest-roundtrip.md` — the rest client patterns used against `proxy.baseURL`
