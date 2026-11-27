import * as generated from './generated.js'

// A namespace import, so a checkout whose generated.ts predates this export
// still loads: the CLI that rebuilds generated.ts imports this file first.
const bootstrapAssistants: Record<string, Record<string, string>> = (generated as any).bootstrapAssistants ?? {}
const { bootstrapFiles, bootstrapExamples, bootstrapTutorials, bootstrapReferences } = generated

/**
 * Installs the assistants the binary ships (today, lucaArchitect) into
 * ~/.luca/assistants, where every Luca project discovers them.
 *
 * Luca Desktop installs the same folder on launch. Both stay friends by
 * these rules:
 *
 * - The binary writes the desktop's `.luca-desktop-build` stamp too, so the
 *   desktop treats the copy as its own and replaces it with its build.
 * - The binary marks its copy with `.luca-cli-build`. It replaces only a copy
 *   with that marker. A copy the desktop wrote has no marker, so the binary
 *   never swaps a newer desktop build for an older one.
 * - A folder with neither stamp is the user's and is never touched.
 */

export const CLI_STAMP = '.luca-cli-build'
export const DESKTOP_STAMP = '.luca-desktop-build'

export type InstallOutcome = 'installed' | 'updated' | 'current' | 'desktop' | 'handMade'

export interface InstallResult {
	name: string
	outcome: InstallOutcome
	folder: string
}

/** The luca-framework skill as `luca bootstrap` writes it, keyed by path under the skill folder. */
function lucaFrameworkSkill(): Record<string, string> {
	const files: Record<string, string> = { 'SKILL.md': bootstrapFiles['SKILL'] || '' }
	for (const [name, content] of Object.entries(bootstrapExamples)) files[`references/examples/${name}`] = content
	for (const [name, content] of Object.entries(bootstrapTutorials)) files[`references/tutorials/${name}`] = content
	for (const [name, content] of Object.entries(bootstrapReferences)) files[`references/${name}`] = content
	return files
}

/** Every file of one bundled assistant, the luca-framework skill included, as the desktop's build ships it. */
export function bundledAssistantFiles(name: string): Record<string, string> | undefined {
	const own = bootstrapAssistants[name]
	if (!own) return undefined
	const files: Record<string, string> = { ...own }
	for (const [path, content] of Object.entries(lucaFrameworkSkill())) files[`skills/luca-framework/${path}`] = content
	return files
}

/** Names of the assistants this binary ships. Empty in a fresh clone before `bun run build:generated`. */
export function bundledAssistantNames(): string[] {
	return Object.keys(bootstrapAssistants)
}

/**
 * Install or update each bundled assistant in `<home>/.luca/assistants`.
 * Pass `home` to install somewhere else (tests).
 */
export async function installBundledAssistants(container: any, options: { home?: string } = {}): Promise<InstallResult[]> {
	const fs = container.feature('fs')
	const { paths } = container
	const root = paths.resolve(options.home || container.os.homedir, '.luca', 'assistants')
	const results: InstallResult[] = []

	for (const name of bundledAssistantNames()) {
		const files = bundledAssistantFiles(name)!
		const stamp = String(container.utils.hashObject(files))
		const folder = paths.resolve(root, name)
		const read = (file: string) => {
			const p = paths.resolve(folder, file)
			return fs.exists(p) ? String(fs.readFile(p)).trim() : null
		}

		let outcome: InstallOutcome = 'installed'
		if (fs.exists(folder)) {
			const mine = read(CLI_STAMP)
			if (mine === stamp) outcome = 'current'
			else if (mine) outcome = 'updated'
			else outcome = read(DESKTOP_STAMP) ? 'desktop' : 'handMade'
		}
		results.push({ name, outcome, folder })
		if (outcome !== 'installed' && outcome !== 'updated') continue

		// Write beside the target first, so a failed write never leaves half a folder.
		const staging = paths.resolve(root, `.${name}.installing-${container.utils.uuid()}`)
		for (const [file, content] of Object.entries(files)) {
			const target = paths.resolve(staging, file)
			fs.ensureFolder(paths.dirname(target))
			await fs.writeFileAsync(target, content)
		}
		await fs.writeFileAsync(paths.resolve(staging, CLI_STAMP), stamp + '\n')
		await fs.writeFileAsync(paths.resolve(staging, DESKTOP_STAMP), stamp + '\n')
		if (outcome === 'updated') await fs.rm(folder, { recursive: true, force: true })
		fs.move(staging, folder)
	}

	return results
}

/** One line per assistant that changed or was left alone for a reason, for command output. */
export function describeInstall(results: InstallResult[]): string[] {
	const tilde = (p: string) => p.replace(/^\/(Users|home)\/[^/]+/, '~')
	return results.flatMap(({ name, outcome, folder }) => {
		switch (outcome) {
			case 'installed': return [`installed assistant ${name} in ${tilde(folder)}`]
			case 'updated': return [`updated assistant ${name} in ${tilde(folder)}`]
			case 'handMade': return [`left ${tilde(folder)} alone: it has no install stamp, so it is yours`]
			default: return []
		}
	})
}
