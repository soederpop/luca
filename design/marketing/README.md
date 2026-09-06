# Luca marketing concept

Unpublished local prototype. Start from the repository root:

```sh
bun run design/marketing/preview.ts
```

Open http://127.0.0.1:4317. No build or external assets are required.

## Positioning

Luca is an AI-native application runtime: APIs, services, CLI toolkits, browser applications, and assistants built from the same architecture. Assistants are embedded in that runtime, sharing its capabilities, state, and events. Task-specific, environment-specific harnesses combine a Contentbase Markdown brain with operational tools and live evaluation. The full application toolkit and embedded assistants are one product story.

## Design system

- Carbon `#151719`, panel `#1c1f22`, white `#f0f1ee`, secondary `#a4a9ad`, steel `#444a50`, signal `#c4d4df`.
- Helvetica Neue / Helvetica for tightly set, oversized display type and quiet body text. SF Mono / Menlo for code and technical identifiers.
- Broad headline and positioning lead into a full-width harness workbench. The selected mission, concrete configuration, and capability inventory appear together. Subsequent sections explain the shared application runtime, the structured Markdown brain, live evaluation, the operational toolkit, and binary delivery.
- Alignment is left-led throughout. Tiny radii, flat surfaces, generous space around dense technical content. No decorative objects, mascot, pastel blocks, invented activity logs, metrics, or testimonials.
- The signature is the actual harness code and its changing environment. A generic architecture illustration was rejected because it hides the operational depth.

## Examples and verification

API signatures were inspected using `luca describe` for `features.assistant`, `secureShell`, `telnyxConnector`, `claudeCode`, `openaiCodex`, `hermesAgent`, `vm`, and `contentDb`. The live-evaluation behavior was also checked against the VM implementation. Examples are recipes for configured environments, not executed demos. Model credentials, installed coding CLIs, SSH aliases, and Telnyx configuration must exist where required.

All interactions are local presentation controls: harness selection and clipboard copy. No agents, calls, purchases, SSH commands, or deployments are launched by this page.

Validation: page JavaScript and all three displayed harnesses pass Bun syntax checks. HTML nesting, unique IDs, and in-page navigation targets were checked. A side-effect-free VM smoke check confirmed that `addContext()` values resolve through `evalCode()`. Browser visual review of this revision remains outstanding.

The Markdown brain example was syntax-checked, and Contentbase tool handlers for semantic search, model discovery, document querying, and reading were verified without loading a collection or making external calls. HTML nesting, navigation targets, page JavaScript, and all harness example syntax checks pass after this revision.
