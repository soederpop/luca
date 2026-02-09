# The Forge

Describe an app in plain english. The agent scaffolds it, writes the code, builds a Docker image, runs it locally, exposes it to the internet via ngrok, and hands you a public URL. All streamed live to the terminal.

## The Demo

You type: "Build me a URL shortener with a REST API and a simple web frontend."

The agent:

1. Creates a project directory
2. Scaffolds the application (Express server, HTML frontend, SQLite storage)
3. Writes a Dockerfile
4. Builds the Docker image
5. Finds an open port
6. Runs the container
7. Exposes it via ngrok
8. Hands you a public URL
9. Demonstrates it works by shortening a URL via the API

Total time: under 2 minutes. Total human input: one sentence.

## What It Demonstrates

- The full lifecycle from idea to deployed application
- Docker as a portable, reproducible deployment target
- Ngrok/port exposure for instant sharing
- How Luca's feature composition makes complex workflows feel simple
- The "Layer 3 is where you spend your energy" philosophy — the infrastructure is solved

## Features Used

- `Conversation` or `ClaudeCode` — code generation from natural language
- `FS` — file scaffolding and writing
- `Docker` — image building, container management
- `Networking` — finding open ports
- `PortExposer` — ngrok tunneling for public URL
- `UI` — live progress banners, colored output, ASCII art celebration
- `Git` — init and first commit
- `ScriptRunner` — running build/test scripts
- `ChildProcess` — orchestrating build steps

## Key Moments

- The Dockerfile appearing on screen
- Docker build output streaming in real time
- The ngrok URL appearing and being immediately usable
- The agent testing its own creation by making HTTP requests to it
