---
title: "Process Orchestrator"
---

# Process Orchestrator

Build `luca dev` that starts 3 processes simultaneously:

1. An HTTP API server on port 3000
2. A WebSocket server on port 3001
3. A file watcher that logs changes in the project directory

Multiplex their logs to stdout with color-coded prefixes (e.g. `[API]`, `[WS]`, `[WATCH]`). Gracefully shut down all processes on ctrl+c.

Support `luca dev --only api,ws` to start a subset of the processes.

Create a simple endpoint and websocket handler so there's something to actually hit when testing.

## After you are done

Write a LESSONS.md in the attempt folder that describes what you learned, what you struggled with, and what you could have been supplied with up front either in the CLAUDE.md or in the skills that come with luca so you could achieve the goal quicker and with less trouble.
