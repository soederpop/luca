# Luca: Lightweight Universal Conversational Architecture

`luca` is a CLI you can download that comes with 40+ self-documenting feature, client, and server modules and types that you can use to build full featured, secure applications, without any complication, or without any `npm install` step.

Luca has the concept of a `container` object that is, metaphorically, very similar to a Docker container.  

Like Docker containers, you can build layers on top of the base luca `NodeContainer` or `WebContainer` and `use()` your own `Feature`, `Client`, `Command`, `Endpoint` and `Server` patterns.  Bundle that up into your own single file executable, or browser bundle, and provide a standard foundation for all of your custom applications to build on top of.

This library provides a `NodeContainer` for server side applications, `WebContainer` for the browser, and an `AGIContainer` that demonstrates another layer on top of the standard node server / script stack.

The `AGIContainer` provides features, clients, and servers suitable for building a whole manner of AI Assistants, and comes with its own Assistants to write framework code for you or architect and design applications.  It provides wrappers around all of the major coding assistants, so you can build cool UI applications to visualize them working.  

## Fully typed at Author-time / Self-Documenting at Runtime

Besides being fully typed, The `container`'s JavaScript API is self documenting at runtime.  All of the constructor options, the shape of observable state, events emitted, environment variables used, method descriptions, are documented and fully typed.  This helps while debugging, working in the chrome console or a CLI REPL, allows for insane metaprogramming and is a great way to learn about the framework and its components. 

```ts
import container from '@soederpop/luca'

container.features.available // ['fs','git','proc','vault',...]
container.clients.available // ['rest','websocket']
container.servers.available // ['express','websocket','ipc','mcp']

container.features.describe() // markdown or json summary of all features
container.feature.describe('fileManager') // describe an individual feature 

container.introspect() // a json structure that describes the container, its registries, their members
container.introspectAsText() // a markdown description of the same
```

You can pass args to these things to only get a small slice of information, e.g. just usage examples, or a list of events it emits, or documentation for a single method.

And the individual components also respond to the same

```
const fileManager = container.feature('fileManager')

fileManager.introspect() // json
fileManager.introspectAsText() // markdown
fileManager.introspectAsText("usage", "examples") // just summarize it for me my boy
```

## Self Documentation on steroids actually

The node container has a `container.docs` feature that uses [Contentbase](https://contentbase.soederpop.com) to be able to understand and interact with the local project markdown documentation 

```ts
await container.docs.load()
const { Tutorial } = container.docs.models
const tutorials = await container.docs.query(Tutorial).fetchAll()
```

## A Perfect Companion for AI Coding Assistants and Students alike

The `luca` CLI [Full Docs Here](./docs/CLI.md) has a few interesting commands.

- The `luca eval` command lets you run snippets of code to see what they produce.  The `container` is already defined for you
- The `luca describe` command lets you view docs, or just parts of docs, of any group of features, clients, etc, as a single markdown doc
- The `luca console` command will bring you into a full blown REPL
- The `luca chat` command will put you in touch with a tutor
- The `luca sandbox-mcp` provides a REPL for your coding assistant and a documentation browser

### Codex MCP note

If OpenAI Codex CLI reports `MCP client ... timed out after 10 seconds` for Luca or Contentbase stdio servers, use a Node stdio bridge to launch Bun. This avoids an intermittent Codex<->Bun stdio startup issue where the server appears to start but handshake still times out.

See [`docs/CLI.md`](./docs/CLI.md) for the exact bridge script and `~/.codex/config.toml` examples.

## Installation

To install the CLI

```sh
echo 'i will eventually have a url to download the CLI and stuff'
```



