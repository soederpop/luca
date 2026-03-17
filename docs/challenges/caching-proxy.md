# Build a Caching Proxy

Create `luca proxy` that starts a local HTTP server which proxies incoming requests to a configurable upstream URL, caching responses with a configurable TTL (default 60 seconds).

Support these flags:

- `luca proxy --upstream https://jsonplaceholder.typicode.com` — set the upstream
- `luca proxy --ttl 120` — cache TTL in seconds
- `luca proxy --flush` — clear the cache and exit
- `luca proxy --stats` — show cache hit/miss ratio and exit

When running, every request to `localhost:<port>/anything` should proxy to `<upstream>/anything`, serving from cache on hit.

## After you are done

Write a LESSONS.md in the attempt folder that describes what you learned, what you struggled with, and what you could have been supplied with up front either in the CLAUDE.md or in the skills that come with luca so you could achieve the goal quicker and with less trouble.
