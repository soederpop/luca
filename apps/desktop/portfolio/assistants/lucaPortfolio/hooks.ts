import type { Assistant, AGIContainer } from 'luca/agi'

declare global {
	var assistant: Assistant
	var container: AGIContainer
}

const WRITE_TOOLS = new Set(['writeFile', 'editFile', 'deleteFile', 'moveFile', 'createDirectory'])

function inside(root: string, target: string): boolean {
	const rel = container.paths.relative(root, target)
	return rel === '' || (!rel.startsWith('..') && !rel.startsWith('/'))
}

export async function started() {
	const fileTools = container.feature('fileTools')
	assistant.use(fileTools.toTools({
		only: ['readFile', 'listDirectory', 'searchFiles', 'findFiles', 'fileInfo', 'writeFile', 'editFile', 'deleteFile', 'createDirectory', 'moveFile'],
	}))
	fileTools.setupToolsConsumer(assistant as any)

	const cfg = await container.feature('portfolio', { enable: true }).config()
	assistant.addSystemPromptExtension('luca-portfolio-setup', [
		'## This Machine',
		`The portfolio config is ${container.paths.resolve('portfolio.yml')}. Roots scanned: ${cfg.roots.join(', ')}. New projects go in ${cfg.newProjectsFolder} unless the human says otherwise.`,
		'Projects Luca Desktop has opened are always in the portfolio.',
	].join('\n'))
}

/** File tools read anywhere, and write only in this folder and the projects opened for writing. */
export async function beforeToolCall(_assistant: Assistant, ctx: { name: string, args: Record<string, any>, result?: string, skip: boolean }) {
	if (!WRITE_TOOLS.has(ctx.name)) return

	const home = String(container.feature('os').homedir)
	const roots = [container.cwd, ...(((assistant.state as any).get('writableProjects') as string[]) || [])]
	const targets = [ctx.args.path, ctx.args.source, ctx.args.destination].filter(Boolean) as string[]

	for (const target of targets) {
		const resolved = container.paths.resolve(container.cwd, String(target).replace(/^~(?=\/|$)/, home))
		const root = roots.find((candidate) => inside(candidate, resolved))
		if (!root) {
			ctx.skip = true
			ctx.result = JSON.stringify({ error: `Write refused: "${target}" is not in a project opened for writing. Call openProject if the human asked for a change there.` })
			return
		}
		const rel = container.paths.relative(root, resolved)
		if (rel === '.git' || rel.startsWith('.git/')) {
			ctx.skip = true
			ctx.result = JSON.stringify({ error: `Write refused: "${target}" is inside .git.` })
			return
		}
	}
}
