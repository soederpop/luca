---
status: approved
---

# Refactor Container Event System

## Summary

Replace the current EventEmitter-based eventing in the container with a typed, schema-validated event bus. This will catch event payload mismatches at runtime and improve developer experience with autocomplete on event names and payloads.

## Steps

- [x] Define event schemas using Zod for all core container events
- [x] Create a `TypedEventBus` class that validates payloads on `emit()`
- [ ] Replace `EventEmitter` usage in `Container` base class
- [ ] Update all features to use the new typed event API
- [ ] Run full test suite and fix any regressions

## Test plan

- [ ] All existing event listeners still fire correctly
- [ ] Invalid payloads throw validation errors at emit time
- [ ] Event autocomplete works in IDE for all core events
- [ ] No performance regression in event-heavy test scenarios

## References

- [Zod Documentation](https://zod.dev)
- Current event system in `src/container.ts`
- Related discussion in `docs/ideas/typed-events.md`
