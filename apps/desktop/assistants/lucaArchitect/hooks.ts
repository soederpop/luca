import type { Assistant, AGIContainer } from 'luca/agi'

declare global {
	var assistant: Assistant
	var container: AGIContainer
}

const WRITE_TOOLS = new Set([
	'writeFile',
	'editFile',
	'deleteFile',
	'moveFile',
	'createDirectory',
])

function isInside(root: string, target: string): boolean {
	const rel = container.paths.relative(root, target)
	return !rel.startsWith('..') && !rel.startsWith('/')
}

export async function started() {
	const fileTools = container.feature('fileTools')
	assistant.use(fileTools.toTools({
		only: [
			'readFile',
			'listDirectory',
			'searchFiles',
			'findFiles',
			'fileInfo',
			'writeFile',
			'editFile',
			'deleteFile',
			'createDirectory',
			'moveFile',
		],
	}))
	fileTools.setupToolsConsumer(assistant as any)

	assistant.addSystemPromptExtension('luca-expert-current-project', [
		'## Current Project',
		`The current project is ${container.cwd}. New and opened projects live in the projects folder, ${assistant.setting('projectsFolder')}. You can read files anywhere. You can write inside the current project and inside projects from createProject or openProject, except \`.git/\`.`,
	].join('\n'))
}

export async function beforeToolCall(_assistant: Assistant, ctx: { name: string, args: Record<string, any>, result?: string, skip: boolean }) {
	if (!WRITE_TOOLS.has(ctx.name)) return

	const roots = [container.cwd, ...(((assistant.state as any).get('projectRoots') as string[]) || [])]
	const targets = [ctx.args.path, ctx.args.source, ctx.args.destination].filter(Boolean) as string[]

	for (const target of targets) {
		const resolved = container.paths.resolve(container.cwd, target)
		const root = roots.find((candidate) => isInside(candidate, resolved))

		if (!root) {
			ctx.skip = true
			ctx.result = JSON.stringify({
				error: `Write refused: ${ctx.name} on "${target}" is outside the current project (${container.cwd}) and the projects opened in this session. Call createProject or openProject if the human asked you to work there.`,
			})
			return
		}

		const rel = container.paths.relative(root, resolved)
		if (rel === '.git' || rel.startsWith('.git/')) {
			ctx.skip = true
			ctx.result = JSON.stringify({ error: `Write refused: ${ctx.name} on "${target}" touches git internals.` })
			return
		}
	}
}
