/**
 * Example hooks.ts — showcases the assistant hook system.
 *
 * Every named export is a hook. Hooks are awaited via triggerHook(),
 * so async work completes BEFORE the assistant proceeds.
 *
 * Available hooks:
 *
 *   Lifecycle:
 *     created()              — after prompt/tools/hooks load (before start)
 *     beforeStart()          — before conversation wiring, blocks start()
 *     started()              — conversation is ready, wire up tools here
 *     afterStart()           — everything is live, blocks start() until done
 *     formatSystemPrompt(a, prompt) => string — rewrite the system prompt
 *
 *   Ask flow:
 *     beforeInitialAsk(a, question, options) — first ask() only
 *     beforeAsk(a, question, options) => string? — every ask(), return rewrites question
 *     answered(a, result) — after response, before ask() returns
 *
 *   Tool execution:
 *     beforeToolCall(a, ctx) — inspect/rewrite args, set ctx.skip to bypass
 *     afterToolCall(a, ctx)  — inspect/rewrite result after execution
 *
 *   Forwarded from conversation (awaited before the bus event):
 *     turnStart(a, info)  turnEnd(a, info)  chunk(a, delta)
 *     preview(a, text)    response(a, text)  toolCall(a, name, args)
 *     toolResult(a, name, result)  toolError(a, name, error)
 *
 * The first argument is always the assistant instance.
 * `assistant` and `container` are also available as globals (injected by the VM).
 */
import type { Assistant, AGIContainer } from '@soederpop/luca/agi'

declare global {
  var assistant: Assistant
  var container: AGIContainer
}

// ─── Lifecycle ──────────────────────────────────────────────────

/**
 * Runs before the conversation is created. Good for async setup
 * that needs to finish before the assistant is usable.
 */
export async function beforeStart() {
  console.log(`[hooks] preparing ${assistant.assistantName}...`)
}

/**
 * Conversation is wired — register tools, plugins, extensions.
 * This is the most common hook: equivalent to the old bus-based pattern.
 */
export function started() {
  // Give the assistant shell tools
  assistant.use(container.feature('codingTools'))

  // Add write operations from fileTools
  const fileTools = container.feature('fileTools')
  assistant.use(fileTools.toTools({ only: ['editFile', 'writeFile'] }))
  fileTools.setupToolsConsumer(assistant)
}

/**
 * Everything is live. Good for loading state that depends on
 * the conversation being fully initialized. Blocks start().
 */
export async function afterStart() {
  // e.g. load a knowledge base into the system prompt
  const fs = container.feature('fs')
  const notesPath = assistant.paths.resolve('notes.md')

  if (await fs.exists(notesPath)) {
    const notes = await fs.readFile(notesPath)
    assistant.addSystemPromptExtension('notes', `\n## Your Notes\n${notes}`)
  }
}

/**
 * Rewrite the system prompt before the conversation is created.
 * Return the new prompt string.
 */
export async function formatSystemPrompt(_assistant: Assistant, prompt: string) {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
  return `${prompt}\n\nToday is ${today}.`
}

// ─── Ask Flow ───────────────────────────────────────────────────

/**
 * Runs only on the very first ask(). Good for one-time greetings
 * or loading context that depends on the first user message.
 */
export async function beforeInitialAsk(_assistant: Assistant, question: string) {
  console.log(`[hooks] first message from user: "${question}"`)
}

/**
 * Runs before every ask(). Return a string to rewrite the question.
 * Useful for injecting context the model should see but the user
 * shouldn't have to type every time.
 */
export async function beforeAsk(_assistant: Assistant, question: string) {
  // Example: inject recent git context into every question
  const proc = container.feature('proc')
  const { stdout } = await proc.exec('git log --oneline -5 2>/dev/null || true')

  if (stdout.trim()) {
    return `${question}\n\n<context>\nRecent commits:\n${stdout.trim()}\n</context>`
  }
}

/**
 * Fires after the model responds, before ask() returns.
 * Good for logging, analytics, or auto-saving.
 */
export async function answered(_assistant: Assistant, result: string) {
  console.log(`[hooks] response length: ${result.length} chars`)
}

// ─── Tool Execution ─────────────────────────────────────────────

/**
 * Fires before every tool call. The ctx object is mutable:
 *   ctx.name  — tool name
 *   ctx.args  — arguments (rewrite to modify)
 *   ctx.skip  — set true to bypass execution
 *   ctx.result — set when skipping to provide a result
 */
export async function beforeToolCall(_assistant: Assistant, ctx: any) {
  console.log(`[hooks] tool call: ${ctx.name}(${JSON.stringify(ctx.args)})`)

  // Example: block dangerous commands
  if (ctx.name === 'runCommand' && ctx.args.command?.includes('rm -rf')) {
    ctx.skip = true
    ctx.result = JSON.stringify({ error: 'Blocked: destructive command not allowed' })
  }
}

/**
 * Fires after every tool call. The ctx object contains:
 *   ctx.name   — tool name
 *   ctx.args   — original arguments
 *   ctx.result — the result string (rewrite to modify what the model sees)
 *   ctx.error  — error object if the tool threw
 */
export async function afterToolCall(_assistant: Assistant, ctx: any) {
  if (ctx.error) {
    console.error(`[hooks] tool ${ctx.name} failed:`, ctx.error.message)
  }

  // Example: truncate huge tool outputs so they don't blow the context
  if (ctx.result && ctx.result.length > 10000) {
    const truncated = ctx.result.slice(0, 10000)
    ctx.result = `${truncated}\n\n... (truncated from ${ctx.result.length} chars)`
  }
}

// ─── Forwarded Conversation Events ──────────────────────────────

/**
 * Fires at the start of each completion turn. turn > 1 means
 * the model is continuing after tool calls.
 */
export function turnStart(_assistant: Assistant, info: { turn: number; isFollowUp: boolean }) {
  if (info.isFollowUp) {
    console.log(`[hooks] follow-up turn ${info.turn}`)
  }
}
