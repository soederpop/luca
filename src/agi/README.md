# AGI Container

The AGI Container is intended to support server and browser applications with an container
object that provides dependencies, shared state, a global event bus, server and client instances, to instances of AI Agents.

### Features

## Claude Code Manager

A JavaScript object you can `ask(question)` to a claude code session.  Observe its state, listen for events.

## Expert

An expert is something with system prompt, memory, and tool calls.  It is the base class for an agent that has access to the container and any of its features or components at runtime.  It maintains a conversation history and you can `ask(questions)` of it and get streaming responses.