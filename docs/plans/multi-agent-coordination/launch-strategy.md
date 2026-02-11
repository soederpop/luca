# Launch Strategy (Rough Outline)

## The Pitch (one sentence)

Luca is the first TypeScript-native multi-agent coordination framework where agents discover each other at runtime, self-modify, and work in browser or server — no Python required.

## What Makes It Different (the talking points)

1. **Runtime introspection** — agents learn what other agents can do by asking, not by config files
2. **Isomorphic JS** — same agent code runs in Node and the browser. Nobody else can do this.
3. **Observable everything** — watch agent state, task progress, and inter-agent messages in real-time
4. **Multiple topologies** — not just hub-and-spoke. Coordinated, peer-to-peer, pipeline, debate, swarm.
5. **Self-modification** — agents can write code that creates new agents. At runtime. While you watch.
6. **MCP-native** — agents expose capabilities as MCP tools, meaning Claude/GPT/etc can join a crew as a peer

## The Demo That Sells It

Build ONE jaw-dropping demo. Candidates:

- **Live REPL session**: start a crew from a REPL, watch agents discover each other, decompose a task, debate approaches, produce output — all observable in real-time. The "look ma, no config files" moment.
- **Browser + Server split**: agents in a browser tab coordinating with agents on a server, same codebase, visible in a dashboard. This is the "Python can't do this" moment.
- **Self-assembling crew**: give a goal to one agent, it spawns the team it needs, they coordinate, deliver the result. The sci-fi moment.

Pick one. Record it. 2-3 minutes max.

## Launch Sequence

### Pre-launch
- Clean up the repo, write a README that slaps
- The demo video
- A blog post explaining the philosophy (the docker layers analogy is compelling, use it)
- Set up Discord

### Launch day
- GitHub public release
- Hacker News "Show HN" post
- Product Hunt listing
- Twitter/X thread with the demo video
- Post in relevant communities (r/typescript, r/LocalLLaMA, r/MachineLearning)

### Post-launch
- Write 2-3 blog posts showing real use cases (not toy examples)
- Engage with everyone who files an issue or asks a question
- If there's traction, do a YouTube walkthrough / livestream building something with it
- Submit to the WMAC (AAAI workshop on multi-agent collaboration) or similar if the work is novel enough for a short paper

## Things to Figure Out Later
- Licensing (MIT is the move for adoption)
- Whether to extract the multi-agent stuff as its own package or keep it in Luca
- Benchmarking against MultiAgentBench if we want academic credibility
- Whether the A2A protocol (Google's agent-to-agent standard) is worth implementing alongside MCP

## Priority

None of this matters if the thing doesn't work and feel good to use. Build first, launch later. The plan in `build-phases.md` is the real priority. This doc is just so we don't forget the endgame.
