import { z } from 'zod'

declare const container: any

const fileTools = container.feature('fileTools')
const git = container.feature('git')
const proc = container.feature('proc')

export const use = [
	container.feature('codingTools'),
	fileTools.toTools({ only: ['editFile', 'writeFile', 'deleteFile'] }),
	container.feature('processManager'),
	container.feature('skillsLibrary'),
]

// Diffs can dwarf a local model's context window — cap what a single tool call returns.
const MAX_DIFF_CHARS = 20_000

const quote = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`

const truncate = (text: string, max = MAX_DIFF_CHARS) =>
	text.length > max
		? `${text.slice(0, max)}\n\n[truncated: ${text.length - max} more characters — narrow with paths or a single file]`
		: text

export const schemas = {
	gitStatus: z
		.object({})
		.describe('Current branch, HEAD sha, and lists of staged, modified, and untracked files'),

	gitDiff: z
		.object({
			paths: z.array(z.string()).optional().describe('Limit the diff to these files or directories'),
			staged: z.boolean().optional().describe('Diff the staged changes (--cached) instead of the working tree'),
			compareTo: z.string().optional().describe('Target ref (sha, branch, tag) to diff against'),
			compareFrom: z.string().optional().describe('Base ref to diff from (defaults to the working tree / HEAD)'),
		})
		.describe('Show a unified diff of the working tree, staged changes, or between two refs'),

	gitLog: z
		.object({
			count: z.number().int().min(1).max(50).optional().describe('How many commits to return (default 10)'),
			file: z.string().optional().describe('Only commits that touched this file'),
		})
		.describe('Recent commit history, optionally scoped to a single file'),

	fileHistory: z
		.object({
			paths: z.array(z.string()).min(1).describe('File paths or glob patterns to get history for'),
		})
		.describe('Commit history for a set of files, with which of the queried files each commit touched'),

	stageFiles: z
		.object({
			paths: z.array(z.string()).min(1).describe('Explicit file paths to stage — no wildcards, no -A'),
		})
		.describe('Stage specific files for commit with git add'),

	commit: z
		.object({
			message: z.string().min(1).describe('Commit message. First line is the title; explain why, not just what.'),
		})
		.describe('Commit the currently staged files. Never amends, never stages on its own.'),
}

export async function gitStatus() {
	if (!git.isRepo) return { error: 'Not inside a git repository' }

	const staged = proc
		.execSync('git diff --cached --name-only', { encoding: 'utf8' })
		.split('\n')
		.filter(Boolean)

	return {
		branch: git.branch,
		sha: git.sha,
		staged,
		modified: await git.lsFiles({ modified: true }),
		untracked: await git.lsFiles({ others: true, exclude: ['node_modules', '.luca'] }),
	}
}

export async function gitDiff({
	paths,
	staged,
	compareTo,
	compareFrom,
}: {
	paths?: string[]
	staged?: boolean
	compareTo?: string
	compareFrom?: string
}) {
	if (!git.isRepo) return { error: 'Not inside a git repository' }

	const parts = ['git diff']
	if (staged) parts.push('--cached')
	if (compareFrom) parts.push(quote(compareFrom))
	if (compareTo) parts.push(quote(compareTo))
	if (paths?.length) parts.push('--', ...paths.map(quote))

	try {
		const output = proc.execSync(parts.join(' '), { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 })
		return { diff: truncate(output) || '(no changes)' }
	} catch (error: any) {
		return { error: error?.stderr?.toString?.() || error?.message || String(error) }
	}
}

export async function gitLog({ count, file }: { count?: number; file?: string }) {
	if (!git.isRepo) return { error: 'Not inside a git repository' }

	if (file) return { commits: git.fileLog(file).slice(0, count ?? 10) }
	return { commits: await git.getLatestChanges(count ?? 10) }
}

export async function fileHistory({ paths }: { paths: string[] }) {
	if (!git.isRepo) return { error: 'Not inside a git repository' }
	return { history: git.getChangeHistoryForFiles(...paths) }
}

export async function stageFiles({ paths }: { paths: string[] }) {
	if (!git.isRepo) return { error: 'Not inside a git repository' }

	// Explicit paths only — a glob or -A slipping through would stage things the model never saw.
	const suspicious = paths.filter(p => p.startsWith('-') || /[*?[\]]/.test(p))
	if (suspicious.length) return { error: `Refusing globs or flags: ${suspicious.join(', ')}` }

	try {
		proc.execSync(`git add -- ${paths.map(quote).join(' ')}`, { encoding: 'utf8' })
		const staged = proc
			.execSync('git diff --cached --name-only', { encoding: 'utf8' })
			.split('\n')
			.filter(Boolean)
		return { staged }
	} catch (error: any) {
		return { error: error?.stderr?.toString?.() || error?.message || String(error) }
	}
}

export async function commit({ message }: { message: string }) {
	if (!git.isRepo) return { error: 'Not inside a git repository' }

	try {
		const output = proc.execSync(`git commit -m ${quote(message)}`, { encoding: 'utf8' })
		return { sha: git.sha, output: output.trim() }
	} catch (error: any) {
		return { error: error?.stderr?.toString?.() || error?.stdout?.toString?.() || error?.message || String(error) }
	}
}
