# Luca Development Guide

You are working in a **luca project**. The luca container provides all capabilities your code needs. Do not install npm packages or import Node.js builtins directly.

## The Contract

Every capability goes through the container. If you need something that doesn't exist, build it as a feature, client, or server. If it wraps a third-party library, the helper IS the interface — consumer code never imports the library directly.

## Import Rule

All consumer code imports from `@soederpop/luca` only:

```ts
import { Feature, features, z, FeatureStateSchema, FeatureOptionsSchema } from '@soederpop/luca'
import { Client, clients, RestClient, ClientStateSchema } from '@soederpop/luca/client'
import { Server, servers, ServerStateSchema } from '@soederpop/luca'
import { commands, CommandOptionsSchema } from '@soederpop/luca'
```

Never import from `fs`, `path`, `crypto`, or other Node builtins. Never import third-party packages in consumer code. The only exception is inside helper implementations themselves — a feature that wraps a library may import it.

## Dependencies

If the project has `node_modules` and a package manager, helper implementations can import third-party libraries internally. If not (e.g. running via the `luca` binary's VM), all code must import only from `@soederpop/luca`.

## Capability Map

| Intent | Container API |
|---|---|
| File I/O | `container.feature('fs')` — readFile, writeFile, exists, walk, etc. |
| Paths | `container.paths.resolve()`, `container.paths.join()` |
| Shell commands | `container.feature('proc')` — exec, spawn |
| HTTP requests | `container.client('rest')` — get, post, put, delete |
| GraphQL | `container.client('graphql')` — query, mutate |
| WebSockets | `container.client('websocket')` or `container.server('socket')` |
| HTTP server | `container.server('express')` — routes, middleware |
| MCP server | `container.server('mcp')` — tools, resources, prompts |
| Caching | `container.feature('diskCache')` — file-backed key-value cache |
| Encryption | `container.feature('vault')` — encrypt, decrypt |
| Git | `container.feature('git')` — branch, log, status, diff |
| YAML | `container.feature('yaml')` — parse, dump |
| Grep/search | `container.feature('grep')` — search files by pattern |
| OS info | `container.feature('os')` — platform, hostname, env |
| Networking | `container.feature('networking')` — ports, interfaces |
| Code execution | `container.feature('vm')` — sandboxed eval |
| UI/terminal | `container.feature('ui')` — markdown, tables, prompts |
| ESBuild | `container.feature('esbuild')` — bundle, transform |
| Ink/React TUI | `container.feature('ink')` — React-based terminal UI |

## Workflow

1. **`find_capability`** — Search what already exists before writing anything
2. **`describe_helper`** — Read the full API docs for the helper you need
3. **`eval`** — Prototype and test container API calls in the sandbox
4. **`scaffold`** — Generate correct boilerplate when building something new
5. **Write the file** — Using the patterns from the scaffold

## Portability

Code that only imports from `@soederpop/luca` can be copied between any luca project. That's the goal. Features, clients, servers, and commands written this way are portable building blocks.
