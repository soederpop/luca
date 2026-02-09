# The Octopus

A multi-service development environment orchestrator. Define your entire local stack (databases, APIs, workers, frontends) in a simple config, and the Octopus starts everything, wires them together, monitors health, and gives you a single pane of glass.

## The Demo

Define a `stack.yml`:

```yaml
services:
  db:
    docker: postgres:16
    port: 5432
  api:
    script: "dev:api"
    port: 3000
    depends_on: [db]
  worker:
    script: "dev:worker"
    depends_on: [db]
  web:
    script: "dev:web"
    port: 5173
    depends_on: [api]
```

Run `octopus start`. It:

1. Reads the config (YAML feature)
2. Pulls and starts Docker containers for infrastructure services
3. Finds open ports if defaults are taken (Networking)
4. Starts application processes in dependency order (ChildProcess + ScriptRunner)
5. Monitors everything — restarts crashed processes, streams logs
6. Exposes the frontend via ngrok for mobile testing (PortExposer)
7. Renders a live terminal dashboard showing the health of every service

`octopus stop` tears everything down cleanly. `octopus logs api` tails a specific service.

## What It Demonstrates

- Docker + ChildProcess + ScriptRunner as a unified process manager
- YAML as a simple, human-readable configuration format
- Networking for dynamic port allocation
- The container as an orchestration layer that replaces docker-compose for mixed stacks
- No AI required — just well-composed features

## Features Used

- `Docker` — pulling images, starting/stopping containers, streaming logs
- `ChildProcess` — spawning and monitoring application processes
- `ScriptRunner` — running package.json scripts
- `YAML` — parsing the stack configuration
- `Networking` — finding open ports, checking port availability
- `PortExposer` — ngrok tunneling for external access
- `OS` — system info for resource allocation decisions
- `UI` — live dashboard with service status, log streaming, health indicators
- `State` — tracking the health/status of every service
- `Bus` — events for service lifecycle (started, crashed, restarted)
- `IpcSocket` — optional inter-service communication channel

## Key Moments

- Running one command and watching 5 services come up in dependency order
- A service crashing and automatically restarting with a warning banner
- Getting an ngrok URL and testing the full stack from your phone
- `octopus stop` and watching everything tear down cleanly in reverse order
