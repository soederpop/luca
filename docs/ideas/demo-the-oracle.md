# The Oracle

An AI-augmented REPL where you can type JavaScript or natural language interchangeably. The AI copilot knows everything about the container — every feature, method, event, and state shape — via introspection metadata.

## The Demo

Start the Oracle REPL. You can:

- Type `container.features.list()` and get a list of all features — normal REPL behavior
- Type "show me how to use the disk cache" and the AI writes and executes example code
- Type `await container.feature('fs').readFile('package.json')` — it runs
- Type "watch this directory for changes and log them" — the AI writes the FileManager code, executes it, and you see live output
- Type "what events does the git feature emit?" — the AI queries introspection metadata and answers

The boundary between code and conversation disappears.

## What It Demonstrates

- The REPL as a first-class developer interface
- Introspection as the bridge between AI and runtime
- ContainerChat's ability to generate working code from container knowledge
- The philosophical vision: an AI that can learn about and control its own runtime

## Features Used

- `Repl` — interactive REPL with history and VM context
- `Conversation` — LLM for natural language interpretation
- `ContainerChat` — container-aware code generation
- `VM` — executing generated code in the REPL context
- `UI` — markdown rendering of AI responses inline in the terminal
- The entire introspection system — feature docs, method signatures, state schemas

## Key Moments

- Seamlessly switching between typing code and typing english
- The AI generating a multi-line snippet and it executing perfectly because it knows the exact API
- Asking "what can you do?" and getting a real answer from introspection
- Building something non-trivial interactively, step by step, in the REPL
