# Luca marketing concept

Local design prototype. No deployment configuration or publishing step.

From the repository root, run `bun run design/marketing/preview.ts`, then open
http://127.0.0.1:4317. The HTML also works directly from disk.

## Design direction

An open technical workshop, built around Luca's shared architectural map.
The audience is TypeScript developers building applications, tools, and AI operators.
The primary action is exploring a working pattern, followed by starting a project.

- Palette: paper `#f8f9fd`, ink `#222d57`, blueprint `#254cdd`, lilac `#e6e7fa`, lemon `#f5edaa`, muted `#606982`.
- Typography: Avenir Next for approachable geometric headlines and body text, with system fallbacks; SF Mono / Menlo for actual code.
- Layout: left-aligned large headline beside a spatial container diagram; a full-width interactive code workbench; an asymmetric shipping section; a compact installation close.
- Signature: a blue rounded enclosure with nested capability modules, showing what a container holds. Human and agent inputs share the same enclosure.
- Restraint: no decorative gradient, fabricated metrics, testimonials, or animated background. The diagram carries the visual identity. Motion only responds to interaction.

The initial generic feature-card grid was replaced by one shared container map and a code workbench: both explain Luca's architecture instead of merely listing benefits.

## Content and interactions

Copy and examples are grounded in the repository README. Capability buttons change the diagram description and sample call. The workbench switches among container, assistant, and binary examples. Copy buttons copy displayed code. Installation controls switch between the binary and library paths. Documentation links lead to repository guides.

This is a static demonstration, not a live agent or terminal. It makes no API calls and runs no displayed commands. There are no external assets, tracking, or package dependencies.
