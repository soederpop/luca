import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from '../../schemas/base.js'
import { Feature } from '../feature.js'
import type { FS } from '../../node/features/fs.js'
import type { Grep, GrepMatch } from '../../node/features/grep.js'
import type { Helper } from '../../helper.js'

declare module '@soederpop/luca/feature' {
	interface AvailableFeatures {
		fileTools: typeof FileTools
	}
}

export const FileToolsStateSchema = FeatureStateSchema.extend({})
export const FileToolsOptionsSchema = FeatureOptionsSchema.extend({})

/**
 * Curated file-system and code-search tools for AI assistants.
 *
 * Wraps the container's `fs` and `grep` features into a focused tool surface
 * modeled on the tools that coding assistants (Claude Code, Cursor, etc.) rely on:
 * read, write, edit, list, search, find, stat, mkdir, move, copy, delete.
 *
 * Usage:
 * ```typescript
 * const fileTools = container.feature('fileTools')
 * assistant.use(fileTools)
 * // or selectively:
 * assistant.use(fileTools.toTools({ only: ['readFile', 'searchFiles', 'listDirectory'] }))
 * ```
 *
 * @extends Feature
 */
export class FileTools extends Feature {
	static override shortcut = 'features.fileTools' as const
	static override stateSchema = FileToolsStateSchema
	static override optionsSchema = FileToolsOptionsSchema

	static { Feature.register(this, 'fileTools') }

	static tools: Record<string, { schema: z.ZodType; description?: string }> = {
		readFile: {
			description: 'Read the contents of a file. Returns the text content. Use offset/limit to read portions of large files.',
			schema: z.object({
				path: z.string().describe('File path relative to the project root'),
				offset: z.number().optional().describe('Line number to start reading from (1-based)'),
				limit: z.number().optional().describe('Maximum number of lines to read'),
			}).describe('Read the contents of a file. Returns the text content. Use offset/limit to read portions of large files.'),
		},
		writeFile: {
			description: 'Create a new file or overwrite an existing file with the given content. Prefer editFile for modifying existing files.',
			schema: z.object({
				path: z.string().describe('File path relative to the project root'),
				content: z.string().describe('The full content to write'),
			}).describe('Create a new file or overwrite an existing file with the given content. Prefer editFile for modifying existing files.'),
		},
		editFile: {
			description: 'Make a surgical edit to a file by replacing an exact string match. The oldString must appear exactly once in the file (unless replaceAll is true). This is the preferred way to modify existing files.',
			schema: z.object({
				path: z.string().describe('File path relative to the project root'),
				oldString: z.string().describe('The exact text to find and replace'),
				newString: z.string().describe('The replacement text'),
				replaceAll: z.boolean().optional().describe('Replace all occurrences instead of requiring uniqueness (default: false)'),
			}).describe('Make a surgical edit to a file by replacing an exact string match. The oldString must appear exactly once in the file (unless replaceAll is true).'),
		},
		listDirectory: {
			description: 'List files and directories at a path. Returns arrays of file and directory names.',
			schema: z.object({
				path: z.string().optional().describe('Directory path relative to project root (defaults to ".")'),
				recursive: z.boolean().optional().describe('Whether to list recursively (default: false)'),
				include: z.string().optional().describe('Glob pattern to filter results (e.g. "*.ts")'),
				exclude: z.string().optional().describe('Glob pattern to exclude (e.g. "node_modules")'),
			}).describe('List files and directories at a path. Returns arrays of file and directory names.'),
		},
		searchFiles: {
			description: 'Search file contents for a pattern using ripgrep. Returns structured matches with file, line number, and content.',
			schema: z.object({
				pattern: z.string().describe('Search pattern (regex supported)'),
				path: z.string().optional().describe('Directory to search in (defaults to project root)'),
				include: z.string().optional().describe('Glob pattern to filter files (e.g. "*.ts")'),
				exclude: z.string().optional().describe('Glob pattern to exclude (e.g. "node_modules")'),
				ignoreCase: z.boolean().optional().describe('Case insensitive search'),
				maxResults: z.number().optional().describe('Maximum number of results to return'),
			}).describe('Search file contents for a pattern using ripgrep. Returns structured matches with file, line number, and content.'),
		},
		findFiles: {
			description: 'Find files by name/glob pattern. Returns matching file paths.',
			schema: z.object({
				pattern: z.string().describe('Glob pattern to match (e.g. "**/*.test.ts", "src/**/*.tsx")'),
				path: z.string().optional().describe('Directory to search from (defaults to project root)'),
				exclude: z.string().optional().describe('Glob pattern to exclude'),
			}).describe('Find files by name/glob pattern. Returns matching file paths.'),
		},
		fileInfo: {
			description: 'Get information about a file or directory: whether it exists, its type (file/directory), size, and modification time.',
			schema: z.object({
				path: z.string().describe('File path relative to the project root'),
			}).describe('Get information about a file or directory: whether it exists, its type, size, and modification time.'),
		},
		createDirectory: {
			description: 'Create a directory and all parent directories if they do not exist.',
			schema: z.object({
				path: z.string().describe('Directory path relative to the project root'),
			}).describe('Create a directory and all parent directories if they do not exist.'),
		},
		moveFile: {
			description: 'Move or rename a file or directory.',
			schema: z.object({
				source: z.string().describe('Source path relative to the project root'),
				destination: z.string().describe('Destination path relative to the project root'),
			}).describe('Move or rename a file or directory.'),
		},
		copyFile: {
			description: 'Copy a file or directory (recursive for directories).',
			schema: z.object({
				source: z.string().describe('Source path relative to the project root'),
				destination: z.string().describe('Destination path relative to the project root'),
			}).describe('Copy a file or directory (recursive for directories).'),
		},
		deleteFile: {
			description: 'Delete a file. Does not delete directories — use with care.',
			schema: z.object({
				path: z.string().describe('File path relative to the project root'),
			}).describe('Delete a file. Does not delete directories — use with care.'),
		},
	}

	private get fs(): FS {
		return this.container.feature('fs') as unknown as FS
	}

	private get grep(): Grep {
		return this.container.feature('grep') as unknown as Grep
	}

	// -------------------------------------------------------------------------
	// Tool implementations — each matches a static tools key by name
	// -------------------------------------------------------------------------

	async readFile(args: { path: string; offset?: number; limit?: number }): Promise<string> {
		const content = await this.fs.readFileAsync(args.path) as string

		if (args.offset || args.limit) {
			const lines = content.split('\n')
			const start = Math.max(0, (args.offset || 1) - 1)
			const end = args.limit ? start + args.limit : lines.length
			return lines.slice(start, end).map((line, i) => `${start + i + 1}\t${line}`).join('\n')
		}

		return content
	}

	async writeFile(args: { path: string; content: string }): Promise<string> {
		await this.fs.ensureFolderAsync(args.path.includes('/') ? args.path.split('/').slice(0, -1).join('/') : '.')
		await this.fs.writeFileAsync(args.path, args.content)
		return `Wrote ${args.content.length} bytes to ${args.path}`
	}

	async editFile(args: { path: string; oldString: string; newString: string; replaceAll?: boolean }): Promise<string> {
		const content = await this.fs.readFileAsync(args.path) as string

		if (args.replaceAll) {
			const updated = content.split(args.oldString).join(args.newString)
			const count = (content.split(args.oldString).length - 1)
			if (count === 0) return `Error: "${args.oldString}" not found in ${args.path}`
			await this.fs.writeFileAsync(args.path, updated)
			return `Replaced ${count} occurrence(s) in ${args.path}`
		}

		const idx = content.indexOf(args.oldString)
		if (idx === -1) return `Error: "${args.oldString}" not found in ${args.path}`

		const lastIdx = content.lastIndexOf(args.oldString)
		if (idx !== lastIdx) {
			const count = content.split(args.oldString).length - 1
			return `Error: "${args.oldString}" appears ${count} times in ${args.path}. Use replaceAll or provide a more specific string.`
		}

		const updated = content.slice(0, idx) + args.newString + content.slice(idx + args.oldString.length)
		await this.fs.writeFileAsync(args.path, updated)
		return `Edited ${args.path}`
	}

	async listDirectory(args: { path?: string; recursive?: boolean; include?: string; exclude?: string }): Promise<string> {
		const dir = args.path || '.'
		const result = await this.fs.walkAsync(dir, {
			files: true,
			directories: true,
			relative: true,
			include: args.include ? [args.include] : undefined,
			exclude: args.exclude ? [args.exclude] : ['node_modules', '.git'],
		})

		// For non-recursive, filter to top-level only
		if (!args.recursive) {
			result.files = result.files.filter(f => !f.includes('/'))
			result.directories = result.directories.filter(d => !d.includes('/'))
		}

		return JSON.stringify({ files: result.files, directories: result.directories })
	}

	async searchFiles(args: { pattern: string; path?: string; include?: string; exclude?: string; ignoreCase?: boolean; maxResults?: number }): Promise<string> {
		const results: GrepMatch[] = await this.grep.search({
			pattern: args.pattern,
			path: args.path,
			include: args.include,
			exclude: args.exclude || 'node_modules',
			ignoreCase: args.ignoreCase,
			maxResults: args.maxResults || 50,
		})

		return JSON.stringify(results.map(r => ({
			file: r.file,
			line: r.line,
			content: r.content,
		})))
	}

	async findFiles(args: { pattern: string; path?: string; exclude?: string }): Promise<string> {
		const dir = args.path || '.'
		const result = await this.fs.walkAsync(dir, {
			files: true,
			directories: false,
			relative: true,
			include: [args.pattern],
			exclude: args.exclude ? [args.exclude, 'node_modules', '.git'] : ['node_modules', '.git'],
		})
		return JSON.stringify(result.files)
	}

	async fileInfo(args: { path: string }): Promise<string> {
		const exists = await this.fs.existsAsync(args.path)
		if (!exists) return JSON.stringify({ exists: false })

		const stat = await this.fs.statAsync(args.path)
		return JSON.stringify({
			exists: true,
			isFile: stat.isFile(),
			isDirectory: stat.isDirectory(),
			size: stat.size,
			modified: stat.mtime.toISOString(),
		})
	}

	async createDirectory(args: { path: string }): Promise<string> {
		await this.fs.ensureFolderAsync(args.path)
		return `Created ${args.path}`
	}

	async moveFile(args: { source: string; destination: string }): Promise<string> {
		await this.fs.moveAsync(args.source, args.destination)
		return `Moved ${args.source} → ${args.destination}`
	}

	async copyFile(args: { source: string; destination: string }): Promise<string> {
		await this.fs.copyAsync(args.source, args.destination)
		return `Copied ${args.source} → ${args.destination}`
	}

	async deleteFile(args: { path: string }): Promise<string> {
		const isDir = await this.fs.isDirectoryAsync(args.path)
		if (isDir) return `Error: "${args.path}" is a directory. Use deleteFile only for files.`
		await this.fs.rm(args.path)
		return `Deleted ${args.path}`
	}

	/**
	 * When an assistant uses fileTools, inject system prompt guidance
	 * about how to use the tools effectively.
	 */
	override setupToolsConsumer(consumer: Helper) {
		if (typeof (consumer as any).addSystemPromptExtension === 'function') {
			(consumer as any).addSystemPromptExtension('fileTools', [
				'## File Tools',
				'- All file paths are relative to the project root unless they start with /',
				'- Use `searchFiles` to understand code before modifying it',
				'- Use `editFile` for surgical changes to existing files — prefer it over `writeFile`',
				'- Use `listDirectory` to explore before assuming paths exist',
				'- Use `readFile` with offset/limit for large files instead of reading the entire file',
			].join('\n'))
		}
	}
}

export default FileTools
