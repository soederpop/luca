# The Shapeshifter — Tutorial Prerequisites

These are the tutorials someone would need to read before building the Shapeshifter demo. They're ordered as a learning path — each one builds on the last. Tutorials marked with ✅ already exist, tutorials marked with 📝 need to be written.

---

## The Learning Path

### 1. ✅ Getting Started with Luca
**Already exists:** `tutorials/getting-started.md`

Covers the container, features, state, events, and basic usage. This is the foundation everything else builds on. No changes needed.

---

### 2. ✅ Creating Express Servers
**Already exists:** `tutorials/express-server.md`

Covers ExpressServer creation, the `create` hook, static file serving, and port management. This is the HTTP foundation for the Shapeshifter's server side. No changes needed.

---

### 3. ✅ WebSocket Communication
**Already exists:** `tutorials/websocket-communication.md`

Covers WebsocketServer and SocketClient, message envelopes, broadcasting, and combining with Express. This is the real-time backbone. No changes needed.

---

### 4. 📝 Building for the Browser with WebContainer
**Needs to be written**

This is the first major gap. None of the existing tutorials explain how to use Luca in the browser. Someone building the Shapeshifter needs to understand:

- What the `WebContainer` is and how it differs from `NodeContainer`
- How to import and use `@/browser`
- Which features are available in the browser (voice, speech, vault, vm, esbuild, assetLoader)
- How to enable and use browser features (they're all opt-in, unlike Node's auto-enable)
- The `SocketClient` from the browser perspective (connecting back to a NodeContainer's WebSocket server)
- How to build/bundle the browser code using esbuild (the `scripts/build-web.ts` pattern)
- How to serve the built bundle from an Express server
- A complete working example: NodeContainer serves an HTML page that loads a WebContainer bundle, connects via WebSocket, and exchanges messages

This tutorial is the linchpin. Without it, nobody knows how to get Luca running in a browser at all.

---

### 5. 📝 Observable State as a Synchronization Primitive
**Needs to be written**

The existing getting-started tutorial introduces state briefly, but doesn't go deep enough for what the Shapeshifter requires. This tutorial would cover:

- Deep dive on `container.newState()` — creating standalone state objects
- The observer pattern: `state.observe(callback)` — what arguments the callback receives (`changeType`, `key`, `value`)
- `state.current` for snapshots, `state.version` for change detection
- `state.setState(partial)` for bulk updates vs `state.set(key, value)` for singles
- Pattern: using state as the single source of truth for a UI
- Pattern: serializing state for transmission (state → JSON → WebSocket → state)
- Pattern: state diffing — using `version` to know if something changed
- Pattern: two-way state sync — server state changes → broadcast → client applies, client state changes → send → server applies → broadcast to others
- Handling conflicts: last-write-wins, version checking
- A complete working example: two state objects (server + client) staying in sync over WebSocket

This tutorial teaches the core architectural idea that makes the Shapeshifter possible: state is observable, serializable, and synchronizable.

---

### 6. 📝 Voice and Speech in the Browser
**Needs to be written**

Covers the two browser features that make the Shapeshifter magical:

- `VoiceRecognition` — enabling it, starting/stopping, continuous mode, the `result` event, `whenFinished()` for one-shot commands
- `Speech` — loading voices, `say()`, cancelling, choosing voices
- Pattern: voice command loop — listen → parse → act → speak response
- Pattern: using voice recognition output as WebSocket messages (speak a command → send to server)
- Handling browser permissions for microphone access
- Graceful degradation when speech APIs aren't available
- A complete example: a page that listens for voice commands, displays the transcript, and speaks a response

---

### 7. 📝 The Shapeshifter: Full-Stack Real-Time App with Shared State
**The capstone tutorial — the demo itself**

This pulls everything together into the Shapeshifter:

- **Architecture overview:** NodeContainer + ExpressServer + WebsocketServer on the server, WebContainer + SocketClient + Voice + Speech in the browser
- **Shared state protocol:** defining the state shape both sides use, the message types for state sync
- **Server implementation:**
  - Express serves the HTML + bundled browser JS
  - WebSocket server handles state sync + command execution
  - State observer broadcasts changes to all clients
  - Command handlers for file operations, git queries, etc.
- **Browser implementation:**
  - WebContainer connects via SocketClient
  - State mirror reflects server state locally
  - Voice recognition sends commands over WebSocket
  - Speech reads server responses aloud
  - DOM updates driven by state observation
- **The voice control loop:** speak → recognize → send → server executes → state changes → broadcast → browser updates → speak confirmation
- **Demonstrating symmetry:** same `container.state.get('files')` call on both sides, same event patterns, same observable model
- Building and bundling the browser side
- Running the full demo

---

## Summary

| # | Tutorial | Status | Key Concept |
|---|----------|--------|-------------|
| 1 | Getting Started | ✅ Exists | Container, features, state, events |
| 2 | Express Server | ✅ Exists | HTTP server with hooks and static serving |
| 3 | WebSocket Communication | ✅ Exists | Real-time bidirectional messaging |
| 4 | Building for the Browser | 📝 Write | WebContainer, bundling, browser features |
| 5 | Observable State Sync | 📝 Write | State as a sync primitive, two-way sync patterns |
| 6 | Voice and Speech | 📝 Write | Browser voice input/output, command patterns |
| 7 | The Shapeshifter | 📝 Write | Capstone: everything composed into one demo |

Four new tutorials need to be written. Tutorials 4 and 5 are the most important — they fill the two biggest knowledge gaps. Tutorial 6 is smaller but necessary for the demo's wow factor. Tutorial 7 is the payoff where it all comes together.

A reader who goes through all seven in order should be able to build the Shapeshifter from scratch, or adapt the patterns for their own real-time full-stack application.
