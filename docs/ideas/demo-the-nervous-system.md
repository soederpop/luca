# The Nervous System

A real-time development dashboard that runs entirely from Luca features — no AI involved. Pure reactive architecture: file changes, git events, process health, and network status all feed into a unified observable state that drives a live terminal UI.

## The Demo

Start the Nervous System pointed at a monorepo. Your terminal becomes a live dashboard:

- **Top panel:** File activity heatmap — which directories are changing most right now
- **Middle panel:** Git status — current branch, uncommitted changes, recent commits scrolling by
- **Bottom panel:** Package health — dependency graph, duplicates flagged in red, outdated packages
- **Sidebar:** Network — open ports on your machine, which processes own them

Everything updates in real time. Edit a file, the heatmap pulses. Commit, the git panel scrolls. Start a dev server, a new port lights up.

No AI. No LLM calls. Just observable state, event buses, and features reacting to each other.

## What It Demonstrates

- Observable State as the backbone of reactive systems
- The Bus (event system) wiring unrelated features together
- FileManager, Git, PackageFinder, Networking working in concert
- The UI feature's terminal rendering capabilities (colors, gradients, layout)
- That Luca isn't "just an AI framework" — it's a runtime architecture

## Features Used

- `FileManager` — file watching, directory scanning, change detection
- `Git` — branch info, status, recent log, diff stats
- `PackageFinder` — dependency graph, duplicate detection, scope analysis
- `Networking` — port scanning, open port discovery
- `OS` — CPU count, hostname, platform info for the header
- `UI` — terminal rendering: colors, gradients, banners, layout formatting
- `State` — central observable state driving the entire dashboard
- `Bus` — events connecting features to the rendering loop

## Key Moments

- Starting it up and seeing the whole dashboard populate in under a second
- Editing a file in another terminal and watching the heatmap respond instantly
- Spotting a duplicate dependency you didn't know about
- The satisfying feeling of a clean git status panel after committing
