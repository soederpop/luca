/**
 * Shared eval-mode policy for markdown documents with fenced code blocks.
 *
 * Three commands walk markdown fences and decide whether to execute them
 * (`luca run`, `luca prompt`, `luca console --eval`). This module is the single
 * source of truth for that decision so the fence-meta grammar and mode
 * semantics can't drift between them.
 *
 * Modes:
 * - `all`   — every executable fence (ts/js/tsx/jsx) runs
 * - `optIn` — only fences whose meta carries the `eval` token run
 * - `none`  — nothing runs; executable fences ship/print as literal source
 *
 * Precedence: CLI `--eval-mode` flag > `evalMode:` frontmatter > command default
 * (`prompt` defaults to `none`, `run` and `console` default to `all`).
 *
 * Fence meta tokens are exact, whitespace-separated words after the language:
 * ` ```ts eval ` opts a block in, ` ```ts skip ` opts it out in any mode,
 * ` ```ts silent ` suppresses the result print (run only).
 */

export type EvalMode = 'all' | 'optIn' | 'none'

export const EVAL_MODES: readonly EvalMode[] = ['all', 'optIn', 'none'] as const

/** Fence languages that are candidates for execution. */
export const EXECUTABLE_LANGS = new Set(['ts', 'js', 'tsx', 'jsx'])

/**
 * What to do with a single fenced code block under a given mode.
 * - `execute` — run it
 * - `literal` — don't run it; keep it as fenced source
 * - `skip`    — author opted it out with the `skip` token (callers decide
 *   whether that means "print without running" or "drop entirely")
 */
export type BlockDecision = 'execute' | 'literal' | 'skip'

/**
 * Tokenize a fence meta string into exact lowercase words.
 * ` ```ts eval title=setup ` → Set { 'eval', 'title=setup' }.
 * Exact-token matching replaces the old substring test, so a meta like
 * `skip-this` or a filename containing "skip" no longer opts a block out.
 */
export function parseFenceMeta(meta: unknown): Set<string> {
	if (typeof meta !== 'string' || !meta.trim()) return new Set()
	return new Set(meta.trim().toLowerCase().split(/\s+/))
}

/**
 * Normalize a user-supplied mode value (`opt-in`, `OptIn`, ` ALL `, …) to an
 * EvalMode, or null when it isn't one.
 */
export function normalizeEvalMode(value: unknown): EvalMode | null {
	if (typeof value !== 'string') return null
	const lower = value.trim().toLowerCase().replace(/[-_]/g, '')
	if (lower === 'all') return 'all'
	if (lower === 'optin') return 'optIn'
	if (lower === 'none') return 'none'
	return null
}

/**
 * Resolve the effective eval mode: CLI flag > frontmatter > fallback.
 * Invalid frontmatter values are reported via `onInvalid` (so callers can
 * warn) and otherwise ignored; an invalid flag value falls through the same
 * way, though zod normally rejects it before we get here.
 */
export function resolveEvalMode(opts: {
	flag?: unknown
	frontmatter?: unknown
	fallback: EvalMode
	onInvalid?: (source: 'flag' | 'frontmatter', value: unknown) => void
}): EvalMode {
	for (const source of ['flag', 'frontmatter'] as const) {
		const raw = opts[source]
		if (raw === undefined || raw === null) continue
		const mode = normalizeEvalMode(raw)
		if (mode) return mode
		opts.onInvalid?.(source, raw)
	}
	return opts.fallback
}

/**
 * Decide what to do with one fenced code block.
 * Non-executable languages are always `literal`. The `skip` token wins in
 * every mode. Under `none`, an `eval` token is ignored — a caller that forced
 * safe mode stays safe (use `parseFenceMeta` to detect and warn about it).
 */
export function decideBlock(lang: unknown, meta: unknown, mode: EvalMode): BlockDecision {
	if (typeof lang !== 'string' || !EXECUTABLE_LANGS.has(lang)) return 'literal'
	const tokens = parseFenceMeta(meta)
	if (tokens.has('skip')) return 'skip'
	if (mode === 'all') return 'execute'
	if (mode === 'optIn') return tokens.has('eval') ? 'execute' : 'literal'
	return 'literal'
}

/**
 * Transpile a fenced block for the vm, identically for every command.
 * `ts` strips types only (esm — doc blocks use the injected container, not
 * module syntax); `tsx`/`jsx` need the cjs JSX transform; `js` runs raw.
 * Previously `luca prompt` skipped the `ts` transform entirely, so a type
 * annotation that worked under `luca run` was a SyntaxError under `prompt`.
 */
export function transpileBlock(transpiler: any, lang: string, source: string): string {
	if (lang === 'ts' || lang === 'tsx' || lang === 'jsx') {
		const { code } = transpiler.transformSync(source, {
			loader: lang as 'ts' | 'tsx' | 'jsx',
			format: lang === 'ts' ? 'esm' : 'cjs',
		})
		return code
	}
	return source
}

/**
 * Reconstruct a node's markdown verbatim from the raw file via its position
 * offsets, falling back to the (lossy) stringifier. The raw slice is immune
 * to stringifier gaps — contentbase's toMarkdown lacks the GFM extensions,
 * so re-stringifying a table node throws.
 */
export function sliceNodeSource(node: any, rawSource: string, stringify: (node: any) => string): string {
	const start = node.position?.start?.offset
	const end = node.position?.end?.offset
	if (typeof start === 'number' && typeof end === 'number') {
		return rawSource.slice(start, end)
	}
	try {
		return stringify(node)
	} catch {
		return ''
	}
}
