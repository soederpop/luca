---
difficulty: medium
maxTime: 15
---
# Port Scout

Build a two-command pair that hands off a live server between processes, using only the features available in luca:

- `luca scout` — finds a free port programmatically (no hardcoding), starts an HTTP server on it with a `/health` endpoint returning `{ ok: true, startedAt: <iso timestamp> }`, and records the chosen port somewhere a *separate process* can find it.
- `luca check` — run in a separate process, discovers the port the scout chose, calls the health endpoint over HTTP, and prints up/down status plus the server's uptime. Exit non-zero when the server is down.

Verify both paths (server up, server down). Leave no servers running when you're done.

## After you are done

Write a LESSONS.md in the project root that describes what you learned, what you struggled with, and what you could have been supplied with up front either in the CLAUDE.md or in the skills that come with luca so you could achieve the goal quicker and with less trouble.
