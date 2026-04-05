import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'
import { Feature } from '../feature.js'
import type { Helper } from '../../helper.js'
import type { ChildProcess } from '../../node/features/proc.js'

declare module '@soederpop/luca/feature' {
	interface AvailableFeatures {
		codingTools: typeof CodingTools
	}
}

export const CodingToolsStateSchema = FeatureStateSchema.extend({})
export const CodingToolsOptionsSchema = FeatureOptionsSchema.extend({})

/**
 * Shell primitives for AI coding assistants: rg, ls, cat, sed, awk.
 *
 * Wraps standard Unix tools into the assistant tool surface with
 * LLM-optimized descriptions and system prompt guidance. These are
 * the raw, flexible tools for reading, searching, and exploring code.
 *
 * Compose with other features (fileTools, processManager, skillsLibrary)
 * in assistant hooks for a complete coding tool surface.
 *
 * Usage:
 * ```typescript
 * assistant.use(container.feature('codingTools'))
 * ```
 *
 * @extends Feature
 */
export class CodingTools extends Feature {
	static override shortcut = 'features.codingTools' as const
	static override stateSchema = CodingToolsStateSchema
	static override optionsSchema = CodingToolsOptionsSchema

	static { Feature.register(this, 'codingTools') }

	static override tools: Record<string, { schema: z.ZodType; description?: string }> = {
		rg: {
			description: 'ripgrep — fast content search across files. The fastest way to find where something is defined, referenced, or used. Supports regex, file type filtering, context lines, and everything ripgrep supports.',
			schema: z.object({
				args: z.string().describe(
					'Arguments to pass to rg, exactly as you would on the command line. ' +
					'Examples: "TODO --type ts", "-n "function handleAuth" src/", ' +
					'"import.*lodash -g "*.ts" --count", "-C 3 "class User" src/models/"'
				),
				cwd: z.string().optional().describe('Working directory. Defaults to project root.'),
			}).describe('ripgrep — fast content search across files. Supports regex, file type filtering, context lines. Use this as your primary search tool for finding code.'),
		},
		ls: {
			description: 'List files and directories. Use to orient yourself in the project structure, check what exists in a directory, or verify paths before operating on them.',
			schema: z.object({
				args: z.string().optional().describe(
					'Arguments to pass to ls. Examples: "-la src/", "-R --color=never commands/", "-1 *.ts". ' +
					'Defaults to listing the project root.'
				),
				cwd: z.string().optional().describe('Working directory. Defaults to project root.'),
			}).describe('List files and directories. Use to orient yourself, check directory contents, or verify paths.'),
		},
		cat: {
			description: 'Read file contents. Use for reading entire files or specific line ranges. For large files, prefer reading specific ranges with sed or use rg to find the relevant section first.',
			schema: z.object({
				args: z.string().describe(
					'Arguments to pass to cat. Typically just a file path. ' +
					'Examples: "src/index.ts", "-n src/index.ts" (with line numbers). ' +
					'For line ranges, use sed instead: sed -n "10,20p" file.ts'
				),
				cwd: z.string().optional().describe('Working directory. Defaults to project root.'),
			}).describe('Read file contents. Best for reading entire files or viewing file content with line numbers.'),
		},
		sed: {
			description: 'Stream editor for extracting or transforming text. Use for reading specific line ranges from files, or performing find-and-replace operations.',
			schema: z.object({
				args: z.string().describe(
					'Arguments to pass to sed. Examples: ' +
					'"-n \\"10,30p\\" src/index.ts" (print lines 10-30), ' +
					'"-n \\"1,5p\\" package.json" (first 5 lines), ' +
					'"s/oldName/newName/g src/config.ts" (find-and-replace)'
				),
				cwd: z.string().optional().describe('Working directory. Defaults to project root.'),
			}).describe('Stream editor for extracting line ranges or transforming text in files.'),
		},
		awk: {
			description: 'Pattern scanning and text processing. Use for extracting specific fields from structured output, summarizing data, or complex text transformations.',
			schema: z.object({
				args: z.string().describe(
					'Arguments to pass to awk. Examples: ' +
					'"\'{print $1}\' file.txt" (first column), ' +
					'"-F: \'{print $1, $3}\' /etc/passwd" (colon-delimited fields), ' +
					'"\'/pattern/ {print}\' file.txt" (lines matching pattern)'
				),
				cwd: z.string().optional().describe('Working directory. Defaults to project root.'),
			}).describe('Pattern scanning and text processing. Extract fields, summarize data, or perform complex text transformations.'),
		},
	}

	private get proc(): ChildProcess {
		return this.container.feature('proc') as unknown as ChildProcess
	}

	// -------------------------------------------------------------------------
	// Shell tool implementations
	// -------------------------------------------------------------------------

	private async _exec(command: string, args: string, cwd?: string): Promise<string> {
		const fullCommand = args ? `${command} ${args}` : command
		const result = await this.proc.execAndCapture(fullCommand, {
			cwd: cwd ?? this.container.cwd,
		})

		if (result.exitCode !== 0) {
			const parts: string[] = []
			if (result.stdout?.trim()) parts.push(result.stdout.trim())
			if (result.stderr?.trim()) parts.push(`[stderr] ${result.stderr.trim()}`)
			parts.push(`[exit code: ${result.exitCode}]`)
			return parts.join('\n')
		}

		return result.stdout || '(no output)'
	}

	async rg(args: { args: string; cwd?: string }): Promise<string> {
		return this._exec('rg', args.args, args.cwd)
	}

	async ls(args: { args?: string; cwd?: string }): Promise<string> {
		return this._exec('ls', args.args || '', args.cwd)
	}

	async cat(args: { args: string; cwd?: string }): Promise<string> {
		return this._exec('cat', args.args, args.cwd)
	}

	async sed(args: { args: string; cwd?: string }): Promise<string> {
		return this._exec('sed', args.args, args.cwd)
	}

	async awk(args: { args: string; cwd?: string }): Promise<string> {
		return this._exec('awk', args.args, args.cwd)
	}

	override setupToolsConsumer(consumer: Helper) {
		if (typeof (consumer as any).addSystemPromptExtension === 'function') {
			(consumer as any).addSystemPromptExtension('codingTools', SYSTEM_PROMPT_EXTENSION)
		}
	}
}

// ─── System Prompt Extension ──────────────────────────────────────────────────

const SYSTEM_PROMPT_EXTENSION = [
	'## Shell Tools',
	'',
	'You have direct access to standard Unix tools. These are your primary read/search/explore tools:',
	'',
	'**`rg` (ripgrep) — your most important tool.** Use it before guessing where anything is.',
	'- `rg -n "pattern" --type ts` — search TypeScript files with line numbers',
	'- `rg -C 3 "pattern"` — show 3 lines of context around matches',
	'- `rg -l "pattern"` — list only filenames that match',
	'- `rg "TODO|FIXME" --type ts --count` — count matches per file',
	'',
	'**`cat` — read files.** Use `cat -n` for line numbers. For large files, use `sed -n "10,30p"` to read a range.',
	'',
	'**`ls` — orient yourself.** `ls -la src/` for details, `ls -R` for recursive listing.',
	'',
	'**`sed` — extract line ranges.** `sed -n "50,80p" file.ts` reads lines 50-80.',
	'',
	'**`awk` — structured text processing.** Extract columns, summarize, transform.',
	'',
	'**Workflow:** `rg` to find → `cat -n` to read → `editFile` to change → `runCommand` to verify.',
].join('\n')

export default CodingTools
