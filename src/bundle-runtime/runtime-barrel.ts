// The single entrypoint prebundled into runtime-barrel.js — the self-contained
// luca runtime that `luca bundle` materializes into a consumer build dir.
//
// Everything is exported as namespaces from ONE file so all specifiers
// ('luca', 'luca/agi', 'zod', ...) share the same module instances — the
// container stays a singleton and zod instanceof checks hold. Builtin commands
// are exposed as lazy loaders so a consumer binary only registers the commands
// its generated entry imports.
//
// Bundled as a single file on purpose: bun's --splitting output cannot be
// re-bundled by the consumer compile (cross-chunk export corruption).

export * as lucaMain from './entries/index.js'
export * as lucaAgi from './entries/agi.js'
export * as lucaCliRunner from './entries/cli-runner.js'
export * as lucaFeature from './entries/feature.js'
export * as lucaSchemas from './entries/schemas.js'
export * as lucaContainer from './entries/container.js'
export * as lucaClient from './entries/client.js'
export * as lucaServer from './entries/server.js'
export * as lucaZod from './entries/zod.js'

export const commandLoaders: Record<string, () => Promise<unknown>> = {
	'run': () => import('../commands/run.js'),
	'console': () => import('../commands/console.js'),
	'serve': () => import('../commands/serve.js'),
	'chat': () => import('../commands/chat.js'),
	'prompt': () => import('../commands/prompt.js'),
	'mcp': () => import('../commands/mcp.js'),
	'sandbox-mcp': () => import('../commands/sandbox-mcp.js'),
	'describe': () => import('../commands/describe.js'),
	'eval': () => import('../commands/eval.js'),
	'help': () => import('../commands/help.js'),
	'scaffold': () => import('../commands/scaffold.js'),
	'introspect': () => import('../commands/introspect.js'),
	'save-api-docs': () => import('../commands/save-api-docs.js'),
	'bootstrap': () => import('../commands/bootstrap.js'),
	'select': () => import('../commands/select.js'),
	'code': () => import('../commands/code.js'),
	'social': () => import('../commands/social.js'),
	'bundle': () => import('../commands/bundle.js'),
	'assistant': () => import('../commands/assistant.js'),
}
