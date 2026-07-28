// ─────────────────────────────────────────────────────────────────────────
// assistants/hooks.ts — workspace-level lifecycle hooks for every assistant
// created by the assistantsManager. Loaded via the vm feature at discover()
// time; `container` and `manager` are injected as globals — no imports.
//
// This file is DISTINCT from per-assistant hooks in
// assistants/<name>/hooks.ts, which use event-name exports (turnStart,
// beforeToolCall, etc.). The two functions below are workspace-wide.
//
// Both exports are OPTIONAL. This file is a no-op as shipped — uncomment
// only the hooks you actually want. A hook that throws is logged and
// swallowed, so a bad hook can't break assistant creation.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Runs right before an assistant is instantiated, with the fully merged
 * options (CORE.md frontmatter + assistants/options.yml + call-site).
 *
 * Return a new options object to REPLACE them — since this file is
 * workspace-owned code, its return value wins over even call-site options
 * (it's the "last word" in the precedence chain).
 *
 * Return `undefined` (or don't return) to leave options unchanged.
 */
// export function beforeAssistantCreated(name, options, manager) {
//   // Example: force a specific model in CI, regardless of what the caller asked for.
//   // if (process.env.CI) {
//   //   return { ...options, model: 'gpt-5.4-mini', temperature: 0 }
//   // }
//
//   // Example: inject the current working directory into providerOptions so
//   // provider transports (codex, claude-code) know where to run.
//   // return {
//   //   ...options,
//   //   providerOptions: { cwd: container.cwd, ...(options.providerOptions || {}) },
//   // }
// }

/**
 * Runs after the assistant is instantiated and wired to the manager. Use
 * this to attach interceptors, subscribe to events, or wire cross-cutting
 * concerns (logging, tracing, policy). Return value is ignored.
 */
// export function onAssistantCreated(assistant, name, manager) {
//   // Example: log every question this assistant is asked.
//   // assistant.on('ask', (message) => {
//   //   console.log(`[${name}] ask: ${String(message).slice(0, 80)}`)
//   // })
//
//   // Example: install a beforeAsk interceptor for all assistants.
//   // assistant.intercept('beforeAsk', async (ctx, next) => {
//   //   const t = Date.now()
//   //   await next()
//   //   console.log(`[${name}] turn took ${Date.now() - t}ms`)
//   // })
// }
