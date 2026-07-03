---
difficulty: medium
maxTime: 15
---
# Process Fleet

Build a small process supervisor, using only the features available in luca:

- `luca fleet start` — spawns 3 long-lived child worker processes (each can be a trivial bun/shell one-liner that prints a heartbeat every second). The command should return immediately after starting them, leaving the workers running.
- `luca fleet status` — lists the running workers with their PIDs and a sample of their recent output.
- `luca fleet stop` — kills all the workers and confirms nothing is left running.

The three commands run as separate processes, so `status` and `stop` must be able to find workers they didn't spawn themselves. Leave nothing running when you're done.

## After you are done

Write a LESSONS.md in the project root that describes what you learned, what you struggled with, and what you could have been supplied with up front either in the CLAUDE.md or in the skills that come with luca so you could achieve the goal quicker and with less trouble.
