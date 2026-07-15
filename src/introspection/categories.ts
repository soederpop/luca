/**
 * Helper categories — the single source of truth for grouping features,
 * clients, and servers in `luca describe` output, the bootstrapped skill's
 * "Features by Category" table, and describe-search index metadata.
 *
 * Every built-in helper declares `static override category` with one of
 * these slugs (mirroring the `stability` pattern). The introspection build
 * (`luca introspect`) enforces coverage, so this list and the sweep can
 * never drift apart silently.
 */

export const HELPER_CATEGORIES = [
	'filesystem',
	'process',
	'ai-assistants',
	'agent-wrappers',
	'data-storage',
	'networking',
	'google-workspace',
	'dev-tools',
	'content-nlp',
	'ui-output',
	'media-browser',
	'system',
] as const

export type HelperCategory = typeof HELPER_CATEGORIES[number]

/** Display metadata for each category, in the canonical presentation order. */
export const CATEGORY_LABELS: Record<HelperCategory, { label: string; description: string }> = {
	'filesystem': {
		label: 'File System & Code',
		description: 'Read/write files, search code, watch for changes',
	},
	'process': {
		label: 'Process & Shell',
		description: 'Run commands, manage long-running processes, SSH',
	},
	'ai-assistants': {
		label: 'AI Assistants',
		description: 'Build AI assistants, manage conversations, tool calling',
	},
	'agent-wrappers': {
		label: 'AI Agent Wrappers',
		description: 'Spawn and manage external AI agent CLIs as subprocesses',
	},
	'data-storage': {
		label: 'Data & Storage',
		description: 'Cross-process state, databases, caching, document management',
	},
	'networking': {
		label: 'Networking',
		description: 'HTTP clients and servers, sockets, DNS, network utilities',
	},
	'google-workspace': {
		label: 'Google Workspace',
		description: 'OAuth and Google service wrappers',
	},
	'dev-tools': {
		label: 'Dev Tools',
		description: 'Version control, containers, bundling, sandboxed execution',
	},
	'content-nlp': {
		label: 'Content & NLP',
		description: 'Document Q&A, text analysis, semantic search, structured file ingestion',
	},
	'ui-output': {
		label: 'UI & Output',
		description: 'Terminal UI, colors, ascii art, structured data display',
	},
	'media-browser': {
		label: 'Media & Browser',
		description: 'Browser automation, text-to-speech, downloads, messaging',
	},
	'system': {
		label: 'System',
		description: 'OS info, secrets, runtime introspection, remote container linking',
	},
}

export function isHelperCategory(value: unknown): value is HelperCategory {
	return typeof value === 'string' && (HELPER_CATEGORIES as readonly string[]).includes(value)
}
