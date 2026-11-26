import { z } from 'zod'
import type { Assistant, AGIContainer } from 'luca/agi'

declare global {
	var assistant: Assistant
	var container: AGIContainer
}

const projectRef = z.string().min(1).describe('A project name from listProjects (e.g. "invoice-sync", "@work/projects/client-site"), or its path')

export const schemas = {
	listProjects: z.object({
		refresh: z.boolean().optional().describe('Scan the disk again. A scan stays fresh for 5 minutes; use this after a project was created or copied into'),
		untouchedForDays: z.number().optional().describe('Only projects with no commit and no Luca Desktop open for at least this many days'),
	}).describe(
		'List every Luca project in the portfolio, most recently touched first: name, path, description, last commit, days since touched, uncommitted file count, and helper counts per registry. Use it for "which projects do we have", "what has not been touched in a while", and to find a project\'s exact name. It does not list a project\'s helpers: use projectDetails.'
	),

	projectDetails: z.object({
		project: projectRef,
	}).describe(
		'One project in detail: its summary, every helper (registry, id, file, first paragraph of docs), the top of its README, and where its CLAUDE.md or AGENTS.md is. Use it before you copy into a project, or when the human asks what a project does or has.'
	),

	searchPortfolio: z.object({
		terms: z.array(z.string().min(1)).min(1).describe('Words or regexes, any of which may match, case-insensitive. Give the specific names a capability goes by, with synonyms: for Microsoft 365 ["microsoft", "msgraph", "outlook", "o365|m365"]. Avoid generic words such as "integration" or "api"; they match everything'),
		projects: z.array(z.string()).optional().describe('Search only these projects. Default: all'),
		content: z.boolean().optional().describe('Also search file contents (helper folders, docs/, top-level markdown). Default true. Set false for a quick search of helper names and docs only'),
	}).describe(
		'Search every project for a capability: helpers whose id, path or docs match, then files whose contents match. Results come strongest first, grouped by project. Use it for "do we have X anywhere". A helper match is strong evidence; a match only in docs/ usually means the project talks about X, not that it implements it. Say which it is.'
	),

	reviewCopy: z.object({
		from: projectRef,
		to: projectRef,
		files: z.array(z.string().min(1)).min(1).describe('Helper paths relative to the source project, e.g. ["features/microsoft-graph.ts", "commands/microsoft365.ts"]. A path inside an assistant folder means the whole assistant'),
	}).describe(
		'Send helpers from one project to another for the human to review in Luca Desktop. It writes nothing: the app opens one change tile per helper in the receiving project, beside this chat. Each tile shows its plan (files, clashes, relative imports, packages the target lacks) and the human writes it there with a key. Call it when the human asks for a copy. Include the commands, endpoints or assistants that go with a helper when the human wants the whole capability. The result lists helpers the code needs that the target lacks, env vars it reads, and files that are not helpers and were not sent: tell the human those.'
	),

	checkCopy: z.object({
		to: projectRef,
		helpers: z.array(z.string().min(1)).min(1).describe('Shortcuts to check, e.g. ["features.microsoftGraph", "commands.microsoft365"]'),
	}).describe(
		'After the human says they wrote the copies: run `luca describe` for each helper in the receiving project, and allow follow-up writes there (bun add, fixes the human asks for).'
	),

	newProject: z.object({
		name: z.string().min(1).regex(/^[a-z0-9][a-z0-9._-]*$/i, 'a folder name, no slashes').describe('The folder name, short and kebab-case, e.g. "invoice-parser"'),
		folder: z.string().optional().describe('The folder to create it in, e.g. "~/work/projects". Default: the newProjectsFolder from portfolio.yml. Use the folder of a related project when the human says the new one belongs with it'),
		usePlugins: z.string().optional().describe('Comma-separated plugins the project auto-loads, e.g. "my-toolkit". Omit unless the human asked'),
	}).describe(
		'Create a new Luca project with `luca bootstrap`, and allow writes to it for this session. Use it when the human asks for a new project. To open it in Luca Desktop, the human types `:open-project <path>`; tell them the path.'
	),

	openProject: z.object({
		project: projectRef,
	}).describe(
		'Allow file writes and shell commands that change things in an existing portfolio project, for this session. Call it only when the human asked for a change in that project. Reading needs no call.'
	),

	runLucaCommand: z.object({
		args: z.string().min(1).describe('Arguments for the `luca` CLI, e.g. "describe microsoftGraph", "describe features", "microsoft365 --help"'),
		project: projectRef,
	}).describe(
		'Run the `luca` CLI in a project folder in a new process, and return stdout, stderr and the exit code. Use it to check a helper after a copy (`describe <id>`) and to read a project\'s docs. Never run servers or watchers with it: the call waits for the process to exit.'
	),

	runShellCommand: z.object({
		command: z.string().min(1).describe('A bash command line, e.g. "git log --oneline -5", "git status --short", "bun add dayjs"'),
		project: projectRef,
	}).describe(
		'Run a bash command in a project folder and return stdout, stderr and the exit code. Read-only commands (git log, git status, ls) work in any portfolio project. A command that changes files needs openProject, newProject or checkCopy on that project first, and the human\'s go-ahead for anything they did not ask for.'
	),
}

function inside(root: string, target: string): boolean {
	const rel = container.paths.relative(root, target)
	return rel === '' || (!rel.startsWith('..') && !rel.startsWith('/'))
}

// Enabled, so the workbench host forwards its `review` event to Luca Desktop.
const portfolio = () => container.feature('portfolio', { enable: true })

function writable(): string[] {
	return ((assistant.state as any).get('writableProjects') as string[]) || []
}

function allowWrites(path: string) {
	;(assistant.state as any).set('writableProjects', [...new Set([...writable(), path])])
}

// lucaExpert's skills: Luca Desktop installs lucaExpert with its own skills/
// folder into ~/.luca/assistants. A missing folder only means fewer skills.
const skillLocations = [
	container.paths.resolve(assistant.resolvedFolder, 'skills'),
	container.paths.resolve(String(container.feature('os').homedir), '.luca/assistants/lucaExpert/skills'),
].filter((location) => container.fs.exists(location))

export const use = [
	container.feature('skillsLibrary', {
		locations: skillLocations,
		only: ['luca-framework', 'extending-luca', 'scaffolding-*'],
	}),
]

const MUTATING = /(^|[;&|]\s*)(rm|mv|cp|git\s+(commit|push|reset|checkout|clean|rebase|merge|stash)|bun\s+(add|remove|install)|npm|sed\s+-i|tee|luca\s+(scaffold|bootstrap))\b|(?<![0-9&])>(?!&|\s*\/dev\/null)/

async function run(command: string, cwd: string) {
	// The host's LUCA_PLUGINS would load into another project's luca and can
	// rewrite its files. Each project reads its own .env instead.
	const { stdout, stderr, exitCode } = await container.feature('proc').spawnAndCapture('bash', ['-c', `unset LUCA_PLUGINS; ${command}`], { cwd })
	const cap = (s: string) => (s.length > 20_000 ? s.slice(0, 20_000) + `\n… ${s.length - 20_000} more characters` : s)
	return { exitCode, stdout: cap(stdout?.trim() || ''), stderr: cap(stderr?.trim() || '') }
}

export async function listProjects(options: z.infer<typeof schemas.listProjects>) {
	let projects = await portfolio().projects({ refresh: options.refresh })
	if (options.untouchedForDays != null) {
		projects = projects.filter((p) => p.daysSinceTouched == null || p.daysSinceTouched >= options.untouchedForDays!)
	}
	return {
		count: projects.length,
		projects: projects.map((p) => ({
			name: p.name,
			path: p.pathDisplay,
			description: p.description.slice(0, 160),
			lastCommit: p.lastCommitAt ? `${p.lastCommitAt.slice(0, 10)} ${p.lastCommitSubject || ''}`.trim() : (p.gitRepo ? 'no commits here' : 'not a git repo'),
			lastOpenedInDesktop: p.lastOpenedAt?.slice(0, 10) || null,
			daysSinceTouched: p.daysSinceTouched,
			uncommitted: p.uncommitted,
			helpers: p.helperCounts,
			insideProject: p.insideProject,
		})),
	}
}

// `file` stays relative for reviewCopy; `fullPath` is what file tools need,
// since a relative path would resolve against this portfolio folder.
const full = (root: string, file: string) => container.paths.resolve(root, file)

export async function projectDetails(options: z.infer<typeof schemas.projectDetails>) {
	const p = await portfolio().project(options.project)
	return { ...p, helpers: p.helpers.map((h) => ({ ...h, fullPath: full(p.path, h.file) })) }
}

export async function searchPortfolio(options: z.infer<typeof schemas.searchPortfolio>) {
	const results = await portfolio().search({ terms: options.terms, projects: options.projects, content: options.content })
	const home = String(container.feature('os').homedir)
	const withPaths = results.slice(0, 15).map((r) => {
		const root = r.path.replace(/^~(?=\/|$)/, home)
		return {
			...r,
			helpers: r.helpers.map((h) => ({ ...h, fullPath: full(root, h.file) })),
			files: r.files.map((f) => ({ ...f, fullPath: full(root, f.file) })),
		}
	})
	return { matches: results.length, results: withPaths, more: Math.max(0, results.length - 15) }
}

export async function reviewCopy(options: z.infer<typeof schemas.reviewCopy>) {
	return portfolio().reviewCopy(options)
}

export async function checkCopy(options: z.infer<typeof schemas.checkCopy>) {
	const p = await portfolio().resolve(options.to)
	// The human chose this project as a copy target, so follow-up fixes may write there.
	allowWrites(p.path)
	const checks = []
	for (const shortcut of options.helpers) {
		const id = shortcut.split('.').slice(1).join('.') || shortcut
		const result = await run(`luca describe ${JSON.stringify(id)}`, p.path)
		checks.push({ helper: shortcut, loads: result.exitCode === 0, output: String(result.stdout || result.stderr || '').slice(0, 1500) })
	}
	return { to: p.pathDisplay, checks }
}

export async function newProject(options: z.infer<typeof schemas.newProject>) {
	const fs = container.feature('fs')
	const cfg = await portfolio().config()
	const home = String(container.feature('os').homedir)
	const parent = options.folder ? container.paths.resolve(options.folder.replace(/^~(?=\/|$)/, home)) : cfg.newProjectsFolder
	const target = container.paths.resolve(parent, options.name)
	if (fs.existsSync(target) && fs.readdirSync(target).length > 0) {
		throw new Error(`${target} exists and is not empty. Choose another name.`)
	}
	await fs.ensureFolderAsync(parent)
	const plugins = options.usePlugins ? ` --use-plugins ${JSON.stringify(options.usePlugins)}` : ''
	// --no-setup skips a question no one is here to answer.
	const result = await run(`luca bootstrap ${JSON.stringify(target)} --no-setup${plugins}`, parent)
	if (result.exitCode !== 0) return { ok: false, ...result }
	allowWrites(target)
	const listed = cfg.roots.some((root) => container.paths.dirname(target) === root || container.paths.dirname(container.paths.dirname(target)) === root)
	return {
		ok: true,
		path: target,
		inPortfolio: listed,
		next: `Tell the human the path, and that \`:open-project ${target}\` opens it in Luca Desktop.${listed ? '' : ' It is outside the portfolio roots in portfolio.yml, so listProjects will not show it until they add the folder or open it in Luca Desktop.'} Building it out is lucaExpert's job: suggest they open the project and chat with lucaExpert there.`,
	}
}

export async function openProject(options: z.infer<typeof schemas.openProject>) {
	const p = await portfolio().resolve(options.project)
	allowWrites(p.path)
	return { ok: true, path: p.path, next: 'Read its CLAUDE.md or AGENTS.md before you change anything, and run `git status --short` there.' }
}

export async function runLucaCommand(options: z.infer<typeof schemas.runLucaCommand>) {
	const p = await portfolio().resolve(options.project)
	if (/^\s*(main|serve|chat|workbench|bootstrap|scaffold)\b/.test(options.args) && !writable().some((r) => inside(r, p.path))) {
		throw new Error(`\`luca ${options.args.split(' ')[0]}\` is not a read. Call openProject for ${p.name} first if the human asked for this, and never run servers here.`)
	}
	return run(`luca ${options.args}`, p.path)
}

export async function runShellCommand(options: z.infer<typeof schemas.runShellCommand>) {
	const p = await portfolio().resolve(options.project)
	if (MUTATING.test(options.command) && !writable().some((r) => inside(r, p.path))) {
		throw new Error(`That command changes files in ${p.name}. Call openProject first, and only if the human asked for a change there.`)
	}
	return run(options.command, p.path)
}
