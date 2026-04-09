# Luca Inkbot Assistant

Inkbot renders React Ink components directly in the canvas pane — no subprocesses, no temp files, no `luca run`. Components live in the same React tree as the host app, giving them direct access to the assistant's mental state and full error boundary protection.

## Key Features

- **Direct rendering** — components evaluate in-process and render as part of the Ink tree
- **Error boundaries** — render errors are caught and displayed, not crashes
- **useSceneInput** — focus-aware, error-safe keyboard handling
- **Mental state integration** — components call `setMental()`/`getMental()` directly via closure

## Example Prompts

- Show me what features this project has, let me browse them
- Build me an interactive form to configure a new endpoint
- Create a dashboard showing project stats
