# Luca marketing concept

Unpublished local prototype. From the repository root:

```sh
bun run design/marketing/preview.ts
```

Open http://127.0.0.1:4317. No build step, external assets, or rendering libraries are required.

## Story and conversion

The opening promise is “Build software. Give it an operator.” The introduction establishes that Luca is a single binary that builds other binaries: assemble a task-specific system, then distribute it as a standalone tool. A developer should understand what they gain before encountering the full API surface.

The walkthrough follows one incident: an API fails, an embedded assistant searches the runbooks, inspects the machine, and can coordinate a coding agent to investigate and verify a fix. Each chapter answers the next practical question:

1. Application: where do the API, services, commands, state, and events live?
2. Assistant: how does an operator become part of that application?
3. Knowledge: how does it discover our runbooks and prior decisions?
4. Operations: how does it reach the real systems involved?
5. Execution: how does it compose those capabilities into a useful next action?

The completed architecture leads directly to six inspectable harnesses: infrastructure, database-to-presentation, model discovery and switching, history-to-skills, voice, and coding supervision. The framing is a construction kit: choose reusable pieces and invent an application for the task. Installation is the final action. Binary delivery explains how the developer can turn the application and its assistant into their own tool.

## Design system

Midnight `#10131e`, panel `#181e30`, white `#f0f1ee`, and blue signal `#81b5ff`. The application is blue, assistants violet, knowledge amber, operations teal, and execution rose. Gradient materials, thicker extruded faces, lit seams, contact shadows, and cast shadows give the assembly depth. Helvetica Neue / Helvetica carries the narrative; SF Mono / Menlo identifies code and components.

A left-aligned story sits beside a full-height sticky isometric assembly occupying 60% of the desktop viewport. On mobile, the scene occupies 47% of the viewport height. Five physical compartments each hold six named components. From top to bottom: Application, Assistants, Knowledge, Operations, Execution. Every tray has an identical, rigid footprint and seats on locating pins. One joint opens at a time: the selected tray stays aligned while the assembly above it rises as a unit. The lid lifts first to reveal Application; advancing closes that joint and opens the next joint down. Parts remain opaque and are always drawn in physical stacking order. This assembly is the primary visual; surrounding typography and controls stay quiet.

The scene is a code-native SVG using a shared isometric projection. Scrolling schedules a single animation frame, with geometry derived from chapter positions. The opening reverses deterministically to reseat the plates, supports direct chapter anchors, updates its accessible description, and recalculates after viewport changes. There is no scroll hijacking or continuous animation loop.

On narrow screens the diagram sticks above the narrative. Reduced-motion mode uses a fixed exploded assembly with unchanged geometry across chapters. The narrative remains readable without JavaScript.

## Code and validation

`index.html` contains the narrative and verified harness examples. `container-scene.js` contains the scene projection and scroll behavior. `preview.ts` serves this folder through Luca's Express feature on loopback only.

API signatures were inspected through `luca describe` for the assistant, Contentbase, SSH, Telnyx, VM, and coding-agent wrappers. Coding agents are made available through runtime context and invoked via live evaluation. The examples require the model access, collections, external services, SSH configuration, and installed coding CLIs described beside them. The page does not execute these examples.

Validation includes HTML structure and anchors, Bun syntax checks, simulated forward/reverse scroll and layer navigation at desktop/mobile viewport settings, and all 30 component labels. Both reduced-motion modes were exercised. The initial desktop page was inspected in Chrome; assembled, intermediate, and fully expanded SVG states were rendered separately for visual QA. A full mobile browser visual pass remains outstanding.

The packaging section makes the distribution story explicit: “One binary. That builds your binaries.” Its example uses verified `luca bundle` flags for macOS and Linux and the generated executable naming convention. Bun is needed on the build machine; recipients run the standalone executable with their configured providers and services.

Nothing is deployed or published.

Code highlighting covers all narrative snippets, changing harness examples, and shell commands. Keywords, strings, calls, properties, variables, numbers, and comments have distinct high-contrast colors. A text-preservation check verifies that the highlighter leaves copied source unchanged. Updated colored SVG reveal states were rendered for inspection, and the forward/reverse, responsive, and reduced-motion scene checks pass.

Mechanical verification samples 101 positions in desktop/mobile and reduced-motion modes, checking constant footprints, fixed base position, physical paint order, minimum seating clearance, and nonintersecting layers. The first assembled state and selected compartment were also checked. Narrative code snippets now use preformatted blocks so highlighting and formatting preserve their line breaks.


## Additional composition examples

- Database analyst: `postgres` provides read-only SQL tools for schema exploration and evidence-backed insights. Claude Code receives the findings and builds a local presentation page with charts and supporting queries.
- Model discovery: `modelProviders.discover()` probes localhost, explicitly supplied LAN hosts, and online Tailscale peers. Registered discovered endpoints and authenticated Claude Code/Codex provider profiles can be selected via `setProvider()`; `setModel()` chooses an advertised model. The example continues a conversation across backends.
- History-to-skills: an assistant inventories Claude Code JSONL files, Codex rollout sessions, and Hermes session exports through live evaluation. It reads in batches, reports coverage and listing limits, writes reusable skill definitions, and registers their location in `skillsLibrary`.

These are inspectable recipes, not services run by the marketing page. No databases were accessed, networks probed, session histories read, skills created, or model calls made while authoring them. All six recipes pass Bun syntax checks and match their selector controls; highlighting preserves copied code. The scene's assembly checks also pass after adding the Postgres, modelProviders, and skillsLibrary labels. The six-option selector uses three columns on desktop and two on mobile.
