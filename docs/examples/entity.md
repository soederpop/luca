---
title: "Entity"
tags: [entity, state, events, tools, core]
lastTested: null
lastTestPassed: null
---

# entity

Lightweight, composable objects with observable state, a typed event bus, and an optional tool interface.

## Overview

An entity is a plain object — not a class — created via `container.entity(id, options?)`. Same id + options always returns the same underlying state and bus instance. Entities are designed to be extended with methods and getters via `.extend()`, and can expose those methods as AI tools via `.expose()`.

## Basic Entity with Observable State

Create an entity and read/write state through the observable `state` property.

```ts
const counter = container.entity<{ count: number }>('counter')
counter.setState({ count: 0 })

counter.state.observe((next) => {
  console.log('count changed to', next.count)
})

counter.setState(s => ({ count: s.count + 1 }))
counter.setState(s => ({ count: s.count + 1 }))
console.log('final count:', counter.state.get('count'))
```

`setState` accepts either a partial object or a function that receives the current state. Observers fire synchronously after each change.

## Typed Event Bus

Every entity has a built-in event bus. Declare the event map as the third type parameter.

```ts
type TimerEvents = {
  tick: [elapsed: number]
  done: []
}

const timer = container.entity<{}, {}, TimerEvents>('timer')

timer.on('tick', (elapsed) => {
  console.log('tick at', elapsed, 'ms')
})

timer.once('done', () => {
  console.log('timer finished')
})

timer.emit('tick', 100)
timer.emit('tick', 200)
timer.emit('done')
```

`once` auto-detaches after the first fire. `waitFor` returns a promise that resolves on the next emit of that event.

## Extending with Methods

Use `.extend()` to graft methods and getters onto an entity. All base properties — `state`, `options`, `container`, and the event methods — are available via `this`.

```ts
const session = container.entity('session', { userId: '42' })
  .extend({
    greet() {
      return `Hello user ${this.options.userId}`
    },
    get label() {
      return `Session ${this.id} (user ${this.options.userId})`
    },
    bump() {
      const visits = (this.state.get('visits') ?? 0) + 1
      this.setState({ visits })
      this.emit('visited', visits)
      return visits
    },
  })

console.log(session.greet())
console.log(session.label)
console.log('visits:', session.bump())
console.log('visits:', session.bump())
```

Extensions are chained via prototype delegation — each layer can see everything below it.

## Exposing Methods as AI Tools

Use `.expose(methodName, zodSchema)` to register methods as tools. `.toTools()` returns `{ schemas, handlers }` compatible with `assistant.addTools()`.

```ts
const search = container.entity('search', {})
  .extend({
    async lookup({ query }: { query: string }) {
      return `Results for: ${query}`
    },
    async summarize({ text, maxWords }: { text: string; maxWords: number }) {
      return text.split(' ').slice(0, maxWords).join(' ')
    },
  })
  .expose('lookup', z.object({
    query: z.string().describe('The search query'),
  }))
  .expose('summarize', z.object({
    text: z.string().describe('Text to summarize'),
    maxWords: z.number().describe('Maximum words in summary'),
  }))

const { schemas, handlers } = search.toTools()
console.log('registered tools:', Object.keys(schemas))

// Pass directly to an assistant
// assistant.addTools(search)
```

`.expose()` is chainable and returns `this`, so you can stack as many as you need.

## Summary

Entities give you observable state, a typed event bus, and prototype-safe method extension — all as a plain object with no class overhead. The `.expose()` / `.toTools()` interface makes it straightforward to surface entity methods as AI tools.
