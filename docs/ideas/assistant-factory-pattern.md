---
title: Assistant Factory Pattern — Eliminate Wrapper Duplication
status: idea
tags: [agi, assistant, refactor, lucaCoder, autonomousAssistant]
---

# Assistant Factory Pattern

## Problem

`LucaCoder` and `AutonomousAssistant` both duplicate the same pattern: create an inner `Assistant`, stack tool bundles, wire a permission interceptor, forward events. The permission system, approval flow, and event forwarding are copy-pasted between them. `LucaCoder` is just `AutonomousAssistant` + coding opinions (bash tool, skill loading, project instructions).

Both features **wrap** an assistant rather than **composing** one. This means every method on `Assistant` (ask, tools, messages, conversation) has to be proxied through the wrapper.

## Proposal

### 1. Extract the permission layer into a `use()`-able plugin

The permission system (allow/ask/deny per tool, pending approvals, approval history) is just a `beforeToolCall` interceptor. It doesn't need to be a feature — it's a plugin function.

```typescript
import type { Assistant } from './assistant'

interface PermissionConfig {
  permissions?: Record<string, 'allow' | 'ask' | 'deny'>
  defaultPermission?: 'allow' | 'ask' | 'deny'
}

function withPermissions(config: PermissionConfig = {}) {
  return (assistant: Assistant) => {
    const perms = config.permissions || {}
    const defaultPerm = config.defaultPermission || 'ask'
    const pendingResolvers = new Map<string, (d: 'approve' | 'deny') => void>()

    assistant.intercept('beforeToolCall', async (ctx, next) => {
      const policy = perms[ctx.name] || defaultPerm

      if (policy === 'deny') {
        ctx.skip = true
        ctx.result = JSON.stringify({ blocked: true, tool: ctx.name, reason: 'Permission denied.' })
        assistant.emit('toolBlocked', ctx.name, 'deny policy')
        return
      }

      if (policy === 'allow') {
        await next()
        return
      }

      // 'ask' — emit event and block until resolved
      const id = assistant.container.utils.uuid()
      const decision = await new Promise<'approve' | 'deny'>((resolve) => {
        pendingResolvers.set(id, resolve)
        assistant.emit('permissionRequest', { id, toolName: ctx.name, args: ctx.args })
      })

      pendingResolvers.delete(id)

      if (decision === 'approve') {
        await next()
      } else {
        ctx.skip = true
        ctx.result = JSON.stringify({ blocked: true, tool: ctx.name, reason: 'User denied.' })
      }
    })

    // Expose approve/deny on the assistant instance
    ;(assistant as any).approve = (id: string) => pendingResolvers.get(id)?.('approve')
    ;(assistant as any).deny = (id: string) => pendingResolvers.get(id)?.('deny')
  }
}
```

### 2. LucaCoder becomes an assistant factory, not a wrapper

Instead of owning an inner assistant and proxying everything, `LucaCoder` creates and returns a configured `Assistant`:

```typescript
export class LucaCoder extends Feature {
  createAssistant(overrides?: Partial<AssistantOptions>): Assistant {
    const assistant = this.container.feature('assistant', {
      systemPrompt: this.buildSystemPrompt(),
      ...overrides,
    })

    // This is the runtime equivalent of hooks.ts started()
    assistant.use(this.container.feature('codingTools'))

    const fileTools = this.container.feature('fileTools')
    assistant.use(fileTools.toTools({ only: ['editFile', 'writeFile', 'deleteFile'] }))
    fileTools.setupToolsConsumer(assistant)

    assistant.use(this.container.feature('processManager'))
    assistant.use(this.container.feature('skillsLibrary'))

    // Permission layer as a plugin
    if (this.options.permissions || this.options.defaultPermission) {
      assistant.use(withPermissions({
        permissions: this.options.permissions,
        defaultPermission: this.options.defaultPermission,
      }))
    }

    return assistant
  }
}
```

### 3. Usage

```typescript
// Runtime — no disk files, works in compiled binary
const coder = container.feature('lucaCoder')
const assistant = await coder.createAssistant()
await assistant.ask('refactor the auth module')

// With permission gating
const coder = container.feature('lucaCoder', {
  permissions: { editFile: 'ask', writeFile: 'ask', deleteFile: 'ask' },
  defaultPermission: 'allow',
})
const assistant = await coder.createAssistant()
assistant.on('permissionRequest', ({ id }) => assistant.approve(id))
```

### 4. AutonomousAssistant collapses

`AutonomousAssistant` becomes either:
- Deleted entirely (replaced by `withPermissions` plugin on any assistant)
- Or a thin factory like LucaCoder but with no coding opinions — just `createAssistant()` + permissions

## What This Achieves

- **No duplication** — permission logic lives in one place (the plugin)
- **No proxying** — you get back a real `Assistant`, not a wrapper that forwards `.ask()`, `.tools`, `.messages`, `.conversation`
- **Binary-compatible** — the factory pattern doesn't need disk files, so it works in the compiled `luca` binary
- **Composable** — `assistants/codingAssistant/hooks.ts` and `LucaCoder.createAssistant()` produce the exact same result through the same mechanism (`assistant.use()`)
- **The folder-based assistant becomes the reference implementation** of what the factory does programmatically

## Relationship to assistants/codingAssistant

The disk-based `assistants/codingAssistant/` (CORE.md + hooks.ts + tools.ts) is the "editable" version. `LucaCoder.createAssistant()` is the "compiled" version. Same tools, same prompt, same behavior — one loads from files, the other is baked in code.
