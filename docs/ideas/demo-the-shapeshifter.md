# The Shapeshifter

The same container running on both server and browser, sharing state over WebSockets. Add voice recognition in the browser to control the server. The ultimate demo of Luca's "write once, run anywhere" philosophy.

## The Demo

Start a NodeContainer that runs an Express server with WebSocket support. Open the browser, which runs a WebContainer that connects back via WebSocket. They share observable state.

From the browser:

- Use voice recognition: "Create a new file called hello.txt"
- The voice command travels over WebSocket to the server
- The server's FS feature creates the file
- The state update propagates back to the browser
- The browser speaks "File created" via text-to-speech

From the server terminal:

- Type a command in the REPL
- The state change is reflected in the browser instantly

Both sides have the same container interface. Code written for one works on the other (minus platform-specific features).

## What It Demonstrates

- The container abstraction working across platforms
- Observable State as a synchronization primitive
- Voice as an input method for developer tools
- WebSockets as the bridge between containers
- The philosophical vision: one architecture, every runtime

## Features Used

### Server Side (NodeContainer)
- `ExpressServer` — HTTP server for the web frontend
- `WebsocketServer` — real-time state sync
- `FS` — file operations triggered by browser commands
- `Repl` — server-side interactive control
- `ESBuild` — bundling the browser container code
- `State` — observable, versioned state

### Browser Side (WebContainer)
- `WebSocketClient` — connection back to server
- `VoiceRecognition` — speech-to-text input
- `Speech` — text-to-speech feedback
- `VM` — executing commands in the browser
- `State` — mirrored observable state
- `AssetLoader` — dynamically loading UI components

## Key Moments

- Saying a command out loud and watching it execute on the server
- Changing state on the server and seeing the browser update instantly
- The same `container.state.get('files')` call working on both sides
- Demonstrating a feature that exists on both platforms (VM, State, ESBuild)
