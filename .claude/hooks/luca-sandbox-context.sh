#!/bin/bash
# Inject Luca container sandbox context at session start.
# This gives the AI agent automatic knowledge of the framework
# when the luca-sandbox MCP server is connected.

cat << 'EOF'
# Luca Container Sandbox

The `luca-sandbox` MCP server is available. It provides an `eval` tool that runs JavaScript in a live Luca container with all features in scope.

## Quick start

Use the `eval` tool to run code. The sandbox is persistent — variables survive across calls. Top-level `await` is supported.

## Discovering the framework

```
container.features.available    — list all feature names
container.clients.available     — list all client names
container.servers.available     — list all server names
container.commands.available    — list all command names
```

## Getting documentation

```
container.features.describe("fs")   — full docs for a feature
container.clients.describe("rest")  — full docs for a client
container.inspectAsText()            — full container introspection
```

## Using features directly

All enabled features are top-level variables (fs, git, proc, vm, ui, networking, os, grep):

```
fs.readFile(path)       — read a file
fs.readdir(dir)         — list a directory
proc.exec(cmd)          — run a shell command
git.branch              — current branch
```

## Async code

Top-level await works:
```
var resp = await fetch(url)
await resp.json()
```
EOF
