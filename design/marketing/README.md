# Luca marketing concept

Unpublished local prototype. From the repository root:

```sh
bun run design/marketing/preview.ts
```

Open http://127.0.0.1:4317. No build step, external assets, or rendering libraries are required.

## Story and conversion

The opening promise is “Build software. Give it an operator.” A developer should understand what they gain before encountering the full API surface.

The walkthrough follows one incident: an API fails, an embedded assistant searches the runbooks, inspects the machine, and can coordinate a coding agent to investigate and verify a fix. Each chapter answers the next practical question:

1. Application: where do the API, services, commands, state, and events live?
2. Assistant: how does an operator become part of that application?
3. Knowledge: how does it discover our runbooks and prior decisions?
4. Operations: how does it reach the real systems involved?
5. Execution: how does it compose those capabilities into a useful next action?

The completed architecture leads directly to the full infrastructure harness, followed by voice and coding-supervisor variants. Installation is the final action. Binary delivery explains how the developer can turn the application and its assistant into their own tool.

## Design system

Midnight `#10131e`, panel `#181e30`, white `#f0f1ee`, and blue signal `#81b5ff`. The application is blue, assistants violet, knowledge amber, operations teal, and execution rose. Gradient materials, thicker extruded faces, lit seams, contact shadows, and cast shadows give the assembly depth. Helvetica Neue / Helvetica carries the narrative; SF Mono / Menlo identifies code and components.

A left-aligned story sits beside a full-height sticky isometric assembly occupying 60% of the desktop viewport. On mobile, the scene occupies 47% of the viewport height. Five physical compartments each hold six named components. The lid lifts, category trays separate, and the selected compartment expands and comes forward. This assembly is the primary visual; surrounding typography and controls stay quiet.

The scene is a code-native SVG using a shared isometric projection. Scrolling schedules a single animation frame, with geometry derived from chapter positions. It reverses naturally, supports direct chapter anchors, updates its accessible description, and recalculates after viewport changes. There is no scroll hijacking or continuous animation loop.

On narrow screens the diagram sticks above the narrative. Reduced-motion mode shows an already-expanded assembly and changes emphasis without moving the geometry. The narrative remains readable without JavaScript.

## Code and validation

`index.html` contains the narrative and verified harness examples. `container-scene.js` contains the scene projection and scroll behavior. `preview.ts` serves this folder through Luca's Express feature on loopback only.

API signatures were inspected through `luca describe` for the assistant, Contentbase, SSH, Telnyx, VM, and coding-agent wrappers. Coding agents are made available through runtime context and invoked via live evaluation. The examples require the model access, collections, external services, SSH configuration, and installed coding CLIs described beside them. The page does not execute these examples.

Validation includes HTML structure and anchors, Bun syntax checks, simulated forward/reverse scroll and layer navigation at desktop/mobile viewport settings, and all 30 component labels. Both reduced-motion modes were exercised. The initial desktop page was inspected in Chrome; assembled, intermediate, and fully expanded SVG states were rendered separately for visual QA. A full mobile browser visual pass remains outstanding.

Nothing is deployed or published.

Code highlighting covers all narrative snippets, changing harness examples, and shell commands. Keywords, strings, calls, properties, variables, numbers, and comments have distinct high-contrast colors. A text-preservation check verifies that the highlighter leaves copied source unchanged. Updated colored SVG reveal states were rendered for inspection, and the forward/reverse, responsive, and reduced-motion scene checks pass.
