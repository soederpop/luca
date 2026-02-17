# LUCA
> Malleable, self-teaching, AI Native Typescript Programs you can talk to.

Luca allows you to build observable, stateful, event emitting, dependency injectors called `containers` for server side and browser side application development.  A `container` is something that can be extended in layers, adding new `clients`, `servers`, `features`, `commands` and other registries of `helper` module patterns that can be combined like legos to build any kind of application.

Besides being fully typed for developers, every `container` and `helper` can `introspect()` at runtime and tell consumers about its methods, properties, observable state, the events it emits.

Luca provides a `NodeContainer` and a `WebContainer` primitive.  The NodeContainer provides easy express based Rest servers, Websocket servers, IPC Socket servers, MCP servers, and the corresponding clients, as well as features for interacting with git, the file system, and more.  The `WebContainer` provides features for loading assets from unpkg, compiling code with esbuild, speech, voice, webcam, as well as REST, Websocket clients.

An `AGIContainer` is built on top of `NodeContainer` and contains a multitude of features and clients suitable for building and orchestrating AI Agents and Agent workflows.

Because everything can be discovered and learned at runtime, and you only need to know a handful of patterns, Luca is perfect for Agentic AI coding with minimal context requirements.  (This is true for humans too!) 

## What is in this project

The goal of this project now is to prove the above, and build a fully online BEING which can construct different interfaces for itself (publish APIs and MCP servers to the world) and fully use a computer, modify its own code via the `claudeCode` feature, and even deploy copies of itself to other systems.

It will be connected to a heartbeat prompt which runs every hour say, and autonomously allows it to move forward.

## Requirements

- OpenAI API Key
- Claude Code Installed 
- Docker Desktop Installed

## Optional Requirements

- OpenAI Codex Installed
- Runpod API Key - if you want to spawn GPU instances in the cloud
- ComfyUI URL - if you want to use the image generation features.  desktop app, or running in the cloud.
- A Supabase server (supabase init, supabase start locally if docker desktop is installed)
- Postgres database

