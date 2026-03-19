import { z } from 'zod'
import type { ContainerContext } from '@soederpop/luca'
import { CommandOptionsSchema } from '@soederpop/luca/schemas'

const TARGETS = [
	{ name: 'linux-x64', bunTarget: 'bun-linux-x64', suffix: 'linux-x64' },
	{ name: 'linux-arm64', bunTarget: 'bun-linux-arm64', suffix: 'linux-arm64' },
	{ name: 'darwin-x64', bunTarget: 'bun-darwin-x64', suffix: 'darwin-x64' },
	{ name: 'darwin-arm64', bunTarget: 'bun-darwin-arm64', suffix: 'darwin-arm64' },
	{ name: 'windows-x64', bunTarget: 'bun-windows-x64', suffix: 'windows-x64', ext: '.exe' },
]

export const argsSchema = CommandOptionsSchema.extend({
	dryRun: z.boolean().optional().describe('Build binaries but skip tagging and uploading'),
	skipBuild: z.boolean().optional().describe('Skip pre-build steps (introspection, scaffolds, bootstrap)'),
	skipTests: z.boolean().optional().describe('Skip running tests before release'),
	draft: z.boolean().optional().describe('Create the GitHub release as a draft'),
	targets: z.string().optional().describe('Comma-separated list of targets to build (e.g. linux-x64,darwin-arm64). Defaults to all'),
})

async function release(options: z.infer<typeof argsSchema>, context: ContainerContext) {
	const container = context.container as any
	const proc = container.feature('proc')
	const fileSystem = container.feature('fs')
	const ui = container.feature('ui')

	const pkg = JSON.parse(await fileSystem.readFileAsync('package.json'))
	const version = pkg.version
	const tag = `v${version}`
	const distDir = 'dist/release'

	ui.banner(`Luca Release ${tag}`)

	// Filter targets if specified
	let selectedTargets = TARGETS
	if (options.targets) {
		const requested = options.targets.split(',').map((t: string) => t.trim())
		selectedTargets = TARGETS.filter(t => requested.includes(t.suffix) || requested.includes(t.name))
		if (selectedTargets.length === 0) {
			console.error(`No valid targets found. Available: ${TARGETS.map(t => t.suffix).join(', ')}`)
			return
		}
	}

	// 1. Run tests
	if (!options.skipTests) {
		console.log('\n→ Running tests...')
		const testResult = await proc.execAndCapture('bun test test/*.test.ts', { silent: false })
		if (testResult.exitCode !== 0) {
			console.error('Tests failed. Fix them before releasing.')
			return
		}
	}

	// 2. Pre-build steps
	if (!options.skipBuild) {
		console.log('\n→ Running pre-build steps...')
		const steps = [
			['build:introspection', 'bun run build:introspection'],
			['build:scaffolds', 'bun run build:scaffolds'],
			['build:bootstrap', 'bun run build:bootstrap'],
		]
		for (const [label, cmd] of steps) {
			console.log(`  ${label}...`)
			const r = await proc.execAndCapture(cmd, { silent: true })
			if (r.exitCode !== 0) {
				console.error(`${label} failed:\n${r.stderr}`)
				return
			}
		}
	}

	// 3. Cross-compile for all targets
	fileSystem.ensureFolder(distDir)

	console.log(`\n→ Compiling for ${selectedTargets.length} targets...`)
	for (const target of selectedTargets) {
		const ext = target.ext || ''
		const outfile = `${distDir}/luca-${target.suffix}${ext}`
		const cmd = `bun build ./src/cli/cli.ts --compile --target=${target.bunTarget} --outfile ${outfile} --external node-llama-cpp`

		console.log(`  ${target.name}...`)
		const result = await proc.execAndCapture(cmd, { silent: true })
		if (result.exitCode !== 0) {
			console.error(`  Failed to compile for ${target.name}:\n${result.stderr}`)
			return
		}

		const sizeBytes = proc.exec(`stat -f%z ${container.paths.resolve(outfile)}`)
		const sizeMB = (parseInt(sizeBytes, 10) / 1024 / 1024).toFixed(1)
		console.log(`  ✓ ${outfile} (${sizeMB} MB)`)
	}

	if (options.dryRun) {
		console.log(`\n→ Dry run complete. Binaries are in ${distDir}/`)
		console.log('  Skipping git tag and GitHub release.')
		return
	}

	// 4. Check if tag already exists
	const tagCheck = await proc.execAndCapture(`git tag -l "${tag}"`, { silent: true })
	if (tagCheck.stdout.trim() === tag) {
		console.error(`\nTag ${tag} already exists. Bump the version in package.json first.`)
		return
	}

	// 5. Check for clean working tree (allow untracked)
	const statusCheck = await proc.execAndCapture('git status --porcelain', { silent: true })
	const dirtyFiles = statusCheck.stdout.trim().split('\n').filter((l: string) => l && !l.startsWith('??'))
	if (dirtyFiles.length > 0) {
		console.error('\nWorking tree has uncommitted changes. Commit or stash them first.')
		console.error(dirtyFiles.join('\n'))
		return
	}

	// 6. Create git tag
	console.log(`\n→ Creating tag ${tag}...`)
	const tagResult = await proc.execAndCapture(`git tag -a "${tag}" -m "Release ${tag}"`, { silent: true })
	if (tagResult.exitCode !== 0) {
		console.error(`Failed to create tag:\n${tagResult.stderr}`)
		return
	}

	// 7. Push tag
	console.log(`→ Pushing tag ${tag}...`)
	const pushResult = await proc.execAndCapture(`git push origin "${tag}"`, { silent: true })
	if (pushResult.exitCode !== 0) {
		console.error(`Failed to push tag:\n${pushResult.stderr}`)
		return
	}

	// 8. Create GitHub release and upload binaries
	const draftFlag = options.draft ? '--draft' : ''
	const assets = selectedTargets
		.map(t => `${distDir}/luca-${t.suffix}${t.ext || ''}`)
		.join(' ')

	const releaseTitle = `Luca ${tag}`
	const releaseNotes = await generateReleaseNotes(proc, tag)

	console.log(`\n→ Creating GitHub release ${tag}...`)
	const ghCmd = `gh release create "${tag}" ${assets} --title "${releaseTitle}" --notes ${JSON.stringify(releaseNotes)} ${draftFlag}`
	const ghResult = await proc.execAndCapture(ghCmd, { silent: false })

	if (ghResult.exitCode !== 0) {
		console.error(`Failed to create GitHub release:\n${ghResult.stderr}`)
		console.log('The tag was pushed. You can manually create the release with:')
		console.log(`  gh release create ${tag} ${assets}`)
		return
	}

	console.log(`\n✓ Released ${tag} successfully!`)
	console.log(`  https://github.com/soederpop/luca/releases/tag/${tag}`)
}

async function generateReleaseNotes(proc: any, tag: string): Promise<string> {
	// Get commits since last tag
	const lastTag = await proc.execAndCapture('git describe --tags --abbrev=0 HEAD^ 2>/dev/null || echo ""', { silent: true })
	const since = lastTag.stdout.trim()

	let logCmd: string
	if (since) {
		logCmd = `git log ${since}..HEAD --oneline --no-decorate`
	} else {
		logCmd = 'git log --oneline --no-decorate -20'
	}

	const log = await proc.execAndCapture(logCmd, { silent: true })
	const commits = log.stdout.trim()

	return `## What's Changed\n\n${commits ? commits.split('\n').map((c: string) => `- ${c}`).join('\n') : 'Initial release'}\n\n## Platforms\n\n- Linux x64\n- Linux ARM64\n- macOS x64 (Intel)\n- macOS ARM64 (Apple Silicon)\n- Windows x64`
}

export default {
	description: 'Build cross-platform binaries and publish a GitHub release tagged by version',
	argsSchema,
	handler: release,
}
