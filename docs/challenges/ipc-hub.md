---
difficulty: hard
maxTime: 15
---
# IPC Hub and Spoke

Build an inter-process communication pair using unix domain sockets, using only the features available in luca:

- `luca hub` — starts a long-running hub process listening on a socket. It should answer `{ type: 'sum', numbers: [...] }` requests with the sum, and `{ type: 'time' }` requests with the current ISO timestamp.
- `luca ask sum 1 2 3` and `luca ask time` — connect to the hub as a client, send the request, print the reply, and exit non-zero if the hub doesn't answer within a reasonable timeout.

Verify the roundtrip actually works with the hub running, including the timeout path when the hub is down.

## After you are done

Write a LESSONS.md in the project root that describes what you learned, what you struggled with, and what you could have been supplied with up front either in the CLAUDE.md or in the skills that come with luca so you could achieve the goal quicker and with less trouble.
