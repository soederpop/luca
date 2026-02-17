---
status: backlog
category: demos
horizon: long
---

# Cool Demo Ideas

## 1) Self-Building App Container

Build a live coding demo where a user says "make me a kanban app," and an `assistant` feature composes and wires new `features`, `endpoints`, and UI bindings in real time using the container registries.

Why it gets nerd fame:
- Shows typed runtime composition instead of static scaffolding
- Demonstrates introspection-driven code generation and self-documenting helpers
- Feels like "docker build layers," but for live application logic

## 2) Multiplayer CRDT Whiteboard With Time Travel

Use server + browser containers with websocket clients to run a collaborative whiteboard where every stroke is event-sourced, replayable, and inspectable via helper state timelines.

Why it gets nerd fame:
- Real-time distributed state with deterministic replay
- Debug mode can scrub the entire app state/event bus history
- Great way to prove Luca is strong for reactive stateful apps

## 3) Infra-in-a-Feature: One-Command Local Cloud

Create a `cloud-lab` feature that spins up Express routes, websocket streams, job queues, and metrics dashboards from one typed config object, then exposes everything through `introspectAsText()`.

Why it gets nerd fame:
- Makes infrastructure legible and programmable as a helper
- Extreme discoverability: ask the feature what it can do at runtime
- Strong demo of dependency injection + registry ergonomics

## 4) AI Pair Programmer That Knows Your Runtime

Build an in-app coding assistant that does not just chat; it reads `container.features.describeAll()`, proposes changes, runs commands, and explains the impact in terms of helper events/state transitions.

Why it gets nerd fame:
- "Agentic," but grounded in typed local runtime metadata
- Can explain systems through real introspection, not vague guesses
- Shows Luca as an ideal LLM-native architecture

## 5) Live API Genome + Auto-SDK Generator

Expose all commands/endpoints/features as a navigable "genome" graph, then auto-generate typed SDKs and interactive clients directly from Zod schemas and docblocks.

Why it gets nerd fame:
- Runtime reflection turned into immediate developer tooling
- Zero-stale docs and client generation from one source of truth
- Visually impressive and practical for real teams
