---
target: claude
reusable: true
repeatable: true
---

# MCP Test: Build a Command

You are in an empty luca project. The `luca` CLI is available and you have a `luca-sandbox` MCP server connected.

## Task

Create a luca command called `greet` in `commands/greet.ts` that:

1. Accepts a `--name` flag (string, defaults to "world")
2. Accepts a `--shout` flag (boolean, defaults to false)
3. Prints "Hello, {name}!" to stdout
4. If `--shout` is true, uppercases the entire message

The command should be runnable via `luca greet --name Jon --shout`.

## Rules

- Do not install any npm packages
- Import only from `@soederpop/luca`
- Use the MCP tools to learn the command pattern before writing code
- After creating the file, verify it works by running `luca greet --name Test`
