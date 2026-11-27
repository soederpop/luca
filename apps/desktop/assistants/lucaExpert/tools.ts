import { z } from 'zod'
import type { Assistant, AGIContainer } from 'luca/agi'

declare global {
	var assistant: Assistant
	var container: AGIContainer
}

export const schemas = {
	runLucaCommand: z.object({
		args: z.string().min(1).describe(
			'Arguments to pass to the `luca` CLI, e.g. "describe features", "scaffold feature diskCache --description \\"File-backed cache\\"", "introspect --lint", "eval \\"container.feature(\'diskCache\')\\"".'
		),
		cwd: z.string().optional().describe(
			'The folder to run in. Defaults to the current project. Must be inside the current project or a project from createProject or openProject.'
		),
	}).describe(
		'Run the `luca` CLI in a new process and return stdout, stderr, and the exit code. Use it to scaffold helpers, read docs, regenerate introspection, and test code you just wrote, because a new process discovers new helpers and `evalCode` does not. Run `luca --help` or `luca <command> --help` when unsure of a command. Do not use it for servers or watchers in the foreground, because the call waits for the process to exit.'
	),

	runShellCommand: z.object({
		command: z.string().min(1).describe('A bash command line, e.g. "bun test", "bun add zod", "git status --short".'),
		cwd: z.string().optional().describe(
			'The folder to run in. Defaults to the current project. Must be inside the current project or a project from createProject or openProject.'
		),
	}).describe(
		'Run a bash command and return stdout, stderr, and the exit code. It does not block the process while it runs, but the call waits for the command to exit: start a server with `&`, test it, and kill it in the same command. Use `luca` tools for luca work and file tools for editing files. Ask the human before anything that installs system-wide software or deletes work you did not create.'
	),

	createProject: z.object({
		name: z.string().min(1).describe('The project\'s folder name, e.g. "invoice-parser". It is created inside the configured projects folder. It must not exist, or must be empty.'),
		usePlugins: z.string().optional().describe('Comma-separated plugins the project auto-loads, e.g. "my-toolkit". Omit unless the human asked for it.'),
	}).describe(
		'Create a new Luca project inside the configured projects folder with `luca bootstrap`, and allow writes to it for this session. Use it when the human wants something new that does not belong in the current project. Do not use it to add to the current project.'
	),

	openProject: z.object({
		name: z.string().min(1).describe('The project\'s folder name inside the configured projects folder, e.g. "invoice-parser".'),
	}).describe(
		'Allow writes to an existing project inside the configured projects folder, for this session. Call it only when the human named that project, or after a write is refused for a project you already created or opened in an earlier session. Not needed for the current project. Projects outside the projects folder are refused.'
	),
}

// Luca Desktop installs this assistant to ~/.luca/assistants with its skills
// in a skills/ folder next to this file. A later location wins on a name
// clash, so the project's own skills/ goes last and overrides them.
const skillLocations = [
	container.paths.resolve(assistant.resolvedFolder, 'skills'),
	container.paths.resolve(container.cwd, 'skills'),
].filter((location) => container.fs.exists(location))

export const use = [
	container.feature('skillsLibrary', {
		locations: skillLocations,
		only: [
			'luca-framework',
			'extending-luca',
			'container-first',
			'building-assistants',
			'contentbase-models',
			'developing-with-contentbase',
			'querying-contentbase',
			'drawing-on-canvas',
		],
	}),
	// evalCode plus describe_container / describe_registry / describe_helper.
	container.feature('vm'),
	container.describer,
	// listAssistants, createAssistant, readDefinitionFile, writeDefinitionFile,
	// rollbackDefinitionFile, listDefinitionHistory, testAssistant,
	// reloadAssistant: building an assistant is three tool calls, with the
	// parse check and .history/ backup the manager does on every write.
	container.feature('assistantsManager'),
]

function isInside(root: string, target: string): boolean {
	const rel = container.paths.relative(root, target)
	return !rel.startsWith('..') && !rel.startsWith('/')
}

function projectRoots(): string[] {
	return ((assistant.state as any).get('projectRoots') as string[]) || []
}

function addProjectRoot(root: string) {
	;(assistant.state as any).set('projectRoots', [...new Set([...projectRoots(), root])])
}

function resolveInProjectsFolder(name: string): string {
	const fs = container.feature('fs')
	const configured = assistant.setting('projectsFolder') as string | undefined
	if (!configured) {
		throw new Error('No projects folder is configured. Tell the human to set `lucaExpert.config.projectsFolder` in assistants/options.yml.')
	}

	const expanded = configured.replace(/^~(?=\/|$)/, container.os.homedir)
	const folder = fs.realpath(fs.ensureFolder(container.paths.resolve(container.cwd, expanded)))
	const target = container.paths.resolve(folder, name)

	// Follow symlinks in the part that exists, so a link inside the projects
	// folder cannot lead out of it.
	let existing = target
	while (!fs.existsSync(existing)) existing = container.paths.dirname(existing)
	const real = container.paths.resolve(fs.realpath(existing), container.paths.relative(existing, target))

	if (real === folder || !isInside(folder, real)) {
		throw new Error(`"${name}" is not inside the projects folder (${folder}). Tell the human if the work belongs somewhere else.`)
	}

	return real
}

function resolveCwd(cwd?: string): string {
	const resolved = container.paths.resolve(container.cwd, cwd?.trim() || '.')
	if (![container.cwd, ...projectRoots()].some((root) => isInside(root, resolved))) {
		throw new Error(`${resolved} is outside the current project and the projects opened in this session. Call openProject first if the human asked you to work there.`)
	}
	return resolved
}

async function run(command: string, cwd: string) {
	// This project's LUCA_PLUGINS would leak into child processes, and its
	// plugins would then run against the other project. Unset it so luca reads
	// the other project's own .env instead.
	const prefix = projectRoots().some((root) => isInside(root, cwd)) ? 'unset LUCA_PLUGINS; ' : ''
	const { stdout, stderr, exitCode } = await container.feature('proc').spawnAndCapture('bash', ['-c', `${prefix}${command}`], { cwd })
	return { exitCode, stdout: stdout?.trim() || '', stderr: stderr?.trim() || '' }
}

export async function runLucaCommand(options: z.infer<typeof schemas.runLucaCommand>) {
	return run(`luca ${options.args}`, resolveCwd(options.cwd))
}

export async function runShellCommand(options: z.infer<typeof schemas.runShellCommand>) {
	return run(options.command, resolveCwd(options.cwd))
}

export async function createProject(options: z.infer<typeof schemas.createProject>) {
	const fs = container.feature('fs')
	const target = resolveInProjectsFolder(options.name)

	if (fs.existsSync(target) && fs.readdirSync(target).length > 0) {
		throw new Error(`${target} is not empty. Choose another name, or call openProject if it is an existing project.`)
	}

	const parent = container.paths.dirname(target)
	await fs.ensureFolder(parent)

	const plugins = options.usePlugins ? ` --use-plugins ${JSON.stringify(options.usePlugins)}` : ''
	// The project is not a root yet, so run() would not unset LUCA_PLUGINS here.
	// --no-setup skips a prompt no one is here to answer.
	const result = await run(`unset LUCA_PLUGINS; luca bootstrap ${JSON.stringify(target)} --no-setup${plugins}`, parent)
	if (result.exitCode !== 0) return { ok: false, ...result }

	addProjectRoot(target)
	return {
		ok: true,
		path: target,
		next: 'Read its CLAUDE.md. Use absolute paths with file tools, pass this path as `cwd` to runLucaCommand and runShellCommand, and test with `luca eval`, because evalCode cannot see this project.',
	}
}

export async function openProject(options: z.infer<typeof schemas.openProject>) {
	const fs = container.feature('fs')
	const target = resolveInProjectsFolder(options.name)

	if (!fs.existsSync(target)) {
		throw new Error(`${target} does not exist. Call createProject to make a new project.`)
	}

	addProjectRoot(target)
	return {
		ok: true,
		path: target,
		next: 'Read its CLAUDE.md or AGENTS.md and run `git status --short`. Use absolute paths with file tools, pass this path as `cwd` to runLucaCommand and runShellCommand, and test with `luca eval`, because evalCode cannot see this project.',
	}
}
