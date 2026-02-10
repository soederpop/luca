/**
 * THE FORGE
 *
 * Describe an app in plain english. Claude Code scaffolds it and writes all the
 * code. Then the script builds a Docker image, runs the container, exposes it
 * via ngrok, tests it, and hands you a public URL.
 *
 * Phase 1: Claude Code writes the app (it's a full coding agent — files, bash, deps)
 * Phase 2: This script handles Docker build → run → expose → test (deterministic)
 *
 * Usage:
 *   bun run playground/forge/forge.ts "A URL shortener with a REST API and a simple web frontend"
 *   bun run playground/forge/forge.ts  (interactive prompt)
 */
import container from '@/agi'
import { resolve } from 'path'

const { ui, fs, networking } = container

// ─── UI Helpers ──────────────────────────────────────────────────────────────
const colors = ui.colors
const dim = (s: string) => colors.dim(s)
const step = (icon: string, msg: string) => console.log(`\n  ${icon}  ${msg}`)
const substep = (msg: string) => console.log(`      ${dim(msg)}`)

function printBanner() {
	const art = ui.asciiArt('THE FORGE', 'Small')
	console.log(ui.applyGradient(art, ['red', 'yellow', 'white'], 'horizontal'))
	console.log(dim('  Describe an app. Get a public URL.\n'))
}

// ─── State ───────────────────────────────────────────────────────────────────
const forgeState = container.newState({
	phase: 'init' as 'init' | 'coding' | 'building' | 'running' | 'exposing' | 'testing' | 'done' | 'error',
	projectDir: '',
	projectName: '',
	imageName: '',
	containerName: '',
	containerId: '',
	hostPort: 0,
	containerPort: 3000,
	publicUrl: '',
	cost: 0,
	turns: 0,
})

// ─── Keep references for cleanup ────────────────────────────────────────────
let exposer: ReturnType<typeof container.feature<'portExposer'>> | null = null
let docker: ReturnType<typeof container.feature<'docker'>> | null = null

// ─── Phase 1: Claude Code writes the app ─────────────────────────────────────
async function phaseCode(description: string, projectDir: string): Promise<boolean> {
	forgeState.set('phase', 'coding')
	step('🧠', colors.bold('Phase 1: Code Generation'))
	substep('Claude Code is writing your application...')

	const claude = container.feature('claudeCode')

	// Stream Claude's output live
	claude.on('session:delta', ({ text }: { text: string }) => {
		process.stdout.write(dim(text))
	})

	claude.on('session:message', ({ message }: any) => {
		// Log tool uses (file writes, bash commands) as they happen
		if (message?.message?.content) {
			for (const block of message.message.content) {
				if (block.type === 'tool_use') {
					const name = block.name
					if (name === 'write' || name === 'create') {
						substep(`writing: ${block.input?.file_path || block.input?.path || '?'}`)
					} else if (name === 'bash') {
						substep(`running: ${(block.input?.command || '').substring(0, 80)}`)
					}
				}
			}
		}
	})

	const prompt = `You are building a complete, production-ready application from this description:

"${description}"

REQUIREMENTS:
1. Create all source files in the current working directory (${projectDir}).
2. Write a Dockerfile that builds and runs the application.
3. The app MUST listen on port 3000 inside the container.
4. Use simple, proven technology. Node.js + Express is great for most apps.
5. Write COMPLETE, working code. No placeholders, no TODOs, no "implement here" comments.
6. Include a package.json with all dependencies.
7. The Dockerfile should: install deps, copy source, expose 3000, and CMD to start the app.
8. If the app has a web frontend, serve it from the Express server (no separate build step).
9. Keep it simple. One Dockerfile. One process. One port.

Do NOT run the app or start Docker. Just write the code and the Dockerfile.
When you're done, list the files you created.`

	const session = await claude.run(prompt, {
		cwd: projectDir,
		permissionMode: 'bypassPermissions',
		streaming: true,
	})

	console.log('') // newline after streaming

	if (session.status === 'error') {
		step('❌', colors.red(`Claude Code failed: ${session.error}`))
		return false
	}

	forgeState.set('cost', session.costUsd)
	forgeState.set('turns', session.turns)

	// Verify a Dockerfile exists
	const hasDockerfile = fs.exists(resolve(projectDir, 'Dockerfile'))
	if (!hasDockerfile) {
		step('⚠️ ', colors.yellow('No Dockerfile found. Asking Claude to fix...'))

		const fixSession = await claude.run(
			'You forgot to create the Dockerfile. Please write one now for the app in this directory. It should install deps, copy source, expose port 3000, and start the app.',
			{
				cwd: projectDir,
				permissionMode: 'bypassPermissions',
			}
		)

		forgeState.set('cost', forgeState.get('cost')! + fixSession.costUsd)

		if (!fs.exists(resolve(projectDir, 'Dockerfile'))) {
			step('❌', colors.red('Still no Dockerfile. Cannot proceed.'))
			return false
		}
	}

	// Show what was created
	const { files } = fs.walk(projectDir, { files: true, directories: false, exclude: ['node_modules', '.git'] })
	const relative = files.map(f => f.replace(projectDir + '/', ''))
	step('📁', `${colors.bold(String(relative.length))} files created:`)
	for (const f of relative.slice(0, 15)) {
		substep(f)
	}
	if (relative.length > 15) substep(`... and ${relative.length - 15} more`)

	return true
}

// ─── Phase 2: Docker build ───────────────────────────────────────────────────
async function phaseBuild(projectDir: string, imageName: string): Promise<boolean> {
	forgeState.set('phase', 'building')
	step('🔨', colors.bold('Phase 2: Docker Build'))
	substep(`image: ${imageName}`)

	docker = container.feature('docker', { enable: true, autoRefresh: true })
	const available = await docker.checkDockerAvailability()

	if (!available) {
		step('❌', colors.red('Docker is not available. Please install and start Docker Desktop.'))
		return false
	}

	try {
		await docker.buildImage(projectDir, { tag: imageName })
		step('✅', colors.green('Image built successfully'))
		return true
	} catch (err: any) {
		step('❌', colors.red(`Docker build failed: ${err.message}`))
		substep('Tip: check the Dockerfile and try `docker build .` manually in the project dir')
		return false
	}
}

// ─── Phase 3: Run container ──────────────────────────────────────────────────
async function phaseRun(imageName: string, containerName: string, hostPort: number, containerPort: number): Promise<boolean> {
	forgeState.set('phase', 'running')
	step('🚀', colors.bold('Phase 3: Run Container'))
	substep(`${containerName} → localhost:${hostPort} → container:${containerPort}`)

	if (!docker) return false

	// Remove any existing container with same name
	try { await docker.removeContainer(containerName, { force: true }) } catch {}

	try {
		const containerId = await docker.runContainer(imageName, {
			detach: true,
			name: containerName,
			ports: [`${hostPort}:${containerPort}`],
		})
		forgeState.set('containerId', containerId)
		substep(`container id: ${containerId.substring(0, 12)}`)

		// Wait for it to boot
		substep('waiting 4s for container to start...')
		await new Promise(r => setTimeout(r, 4000))

		// Check it's still running
		const containers = await docker.listContainers()
		const running = containers.find(c => c.name === containerName)
		if (!running) {
			substep('container exited unexpectedly. Checking logs...')
			try {
				const logs = await docker.getLogs(containerName, { tail: 20 })
				console.log(dim(logs))
			} catch {}
			return false
		}

		step('✅', colors.green('Container is running'))
		return true
	} catch (err: any) {
		step('❌', colors.red(`Failed to start container: ${err.message}`))
		return false
	}
}

// ─── Ngrok auth token ────────────────────────────────────────────────────────
// The ngrok SDK doesn't read the CLI config, so we need to find the token ourselves.
function getNgrokAuthToken(): string | undefined {
	if (process.env.NGROK_AUTHTOKEN) return process.env.NGROK_AUTHTOKEN

	// Try reading the ngrok CLI config file
	try {
		const home = process.env.HOME || ''
		const configPath = resolve(home, 'Library', 'Application Support', 'ngrok', 'ngrok.yml')
		if (fs.exists(configPath)) {
			const content = fs.readFile(configPath)
			const match = content.match(/authtoken:\s*(.+)/)
			if (match) return match[1].trim()
		}
	} catch {}

	// Linux fallback
	try {
		const home = process.env.HOME || ''
		const configPath = resolve(home, '.config', 'ngrok', 'ngrok.yml')
		if (fs.exists(configPath)) {
			const content = fs.readFile(configPath)
			const match = content.match(/authtoken:\s*(.+)/)
			if (match) return match[1].trim()
		}
	} catch {}

	return undefined
}

// ─── Phase 4: Expose via ngrok ───────────────────────────────────────────────
async function phaseExpose(hostPort: number): Promise<string | null> {
	forgeState.set('phase', 'exposing')
	step('🌐', colors.bold('Phase 4: Expose to Internet'))
	substep(`creating ngrok tunnel for port ${hostPort}...`)

	const authToken = getNgrokAuthToken()
	if (!authToken) {
		step('⚠️ ', colors.yellow('No ngrok auth token found (set NGROK_AUTHTOKEN or run `ngrok config add-authtoken`)'))
		substep('The app is still running at localhost:' + hostPort)
		return null
	}

	try {
		exposer = container.feature('portExposer', {
			port: hostPort,
			authToken,
			domain: 'soederpop.ngrok.dev',
		})
		const publicUrl = await exposer.expose()
		forgeState.set('publicUrl', publicUrl)
		step('✅', `${colors.green('Tunnel open:')} ${colors.bold.underline(publicUrl)}`)
		return publicUrl
	} catch (err: any) {
		step('❌', colors.red(`ngrok failed: ${err.message}`))
		substep('The app is still running at localhost:' + hostPort)
		return null
	}
}

// ─── Phase 5: Test ───────────────────────────────────────────────────────────
async function phaseTest(baseUrl: string): Promise<boolean> {
	forgeState.set('phase', 'testing')
	step('🧪', colors.bold('Phase 5: Smoke Test'))

	try {
		substep(`GET ${baseUrl}/`)
		const res = await fetch(baseUrl, { redirect: 'follow' })
		const text = await res.text()
		substep(`${res.status} ${res.statusText} (${text.length} bytes)`)

		if (res.ok) {
			step('✅', colors.green('App is responding!'))
			return true
		} else {
			substep(`unexpected status: ${res.status}`)
			return false
		}
	} catch (err: any) {
		substep(`request failed: ${err.message}`)
		substep('the container may still be starting — try the URL manually')
		return false
	}
}

// ─── Cleanup ─────────────────────────────────────────────────────────────────
async function cleanup() {
	console.log(dim('\n  Shutting down...'))
	try { if (exposer) await exposer.close() } catch {}
	try {
		const cn = forgeState.get('containerName')
		if (cn && docker) {
			await docker.stopContainer(cn)
			await docker.removeContainer(cn, { force: true })
		}
	} catch {}
	console.log(dim('  Done. Goodbye.\n'))
	process.exit(0)
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
	printBanner()

	// Get the app description from CLI args or prompt
	let description = process.argv.slice(2).join(' ').trim()

	if (!description) {
		const answers = await ui.wizard([{
			type: 'input',
			name: 'description',
			message: colors.bold('What do you want to build?'),
		}])
		description = answers.description as string
	}

	if (!description) {
		console.log(colors.red('\n  No description provided. Exiting.'))
		process.exit(1)
	}

	const startTime = Date.now()

	// ── Setup ──
	const projectName = description
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '')
		.substring(0, 30)

	const projectDir = resolve(process.cwd(), 'playground', 'forge', 'projects', projectName)
	fs.ensureFolder(projectDir)

	const imageName = `forge-${projectName}`
	const containerName = `forge-${projectName}`
	const containerPort = 3000

	forgeState.set('projectName', projectName)
	forgeState.set('projectDir', projectDir)
	forgeState.set('imageName', imageName)
	forgeState.set('containerName', containerName)
	forgeState.set('containerPort', containerPort)

	step('📝', `Project: ${colors.bold(projectName)}`)
	substep(projectDir)

	// ── Phase 1: Claude Code writes the app ──
	const codeOk = await phaseCode(description, projectDir)
	if (!codeOk) {
		forgeState.set('phase', 'error')
		process.exit(1)
	}

	// ── Phase 2: Docker build ──
	const buildOk = await phaseBuild(projectDir, imageName)
	if (!buildOk) {
		forgeState.set('phase', 'error')
		process.exit(1)
	}

	// ── Phase 3: Find port + run container ──
	const hostPort = await networking.findOpenPort(3000)
	forgeState.set('hostPort', hostPort)

	const runOk = await phaseRun(imageName, containerName, hostPort, containerPort)
	if (!runOk) {
		forgeState.set('phase', 'error')
		process.exit(1)
	}

	// ── Phase 4: Expose via ngrok ──
	const publicUrl = await phaseExpose(hostPort)

	// ── Phase 5: Test ──
	const testUrl = publicUrl || `http://localhost:${hostPort}`
	await phaseTest(testUrl)

	// ─── Done ────────────────────────────────────────────────────────────
	forgeState.set('phase', 'done')
	const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)

	console.log('\n')
	const doneBanner = ui.asciiArt('SHIPPED', 'Small')
	console.log(ui.applyGradient(doneBanner, ['green', 'cyan', 'white'], 'horizontal'))

	const url = publicUrl || `http://localhost:${hostPort}`
	console.log(`  ${colors.green('URL:')}      ${colors.bold.underline(url)}`)
	console.log(`  ${colors.dim('Local:')}    http://localhost:${hostPort}`)
	console.log(`  ${colors.dim('Project:')}  ${projectDir}`)
	console.log(`  ${colors.dim('Image:')}    ${imageName}`)
	console.log(`  ${colors.dim('Time:')}     ${elapsed}s`)
	console.log(`  ${colors.dim('Cost:')}     $${forgeState.get('cost')?.toFixed(4) || '?'}`)
	console.log(`  ${colors.dim('Turns:')}    ${forgeState.get('turns') || '?'}`)

	if (publicUrl) {
		console.log(`\n  ${dim('The app is live. Press Ctrl+C to tear down.')}\n`)
	} else {
		console.log(`\n  ${dim('Running locally. Press Ctrl+C to tear down.')}\n`)
	}

	process.on('SIGINT', cleanup)
	process.on('SIGTERM', cleanup)

	// Keep alive while the tunnel/container are running
	await new Promise(() => {})
}

main().catch((err) => {
	console.error(colors.red(`\n  Fatal error: ${err.message}`))
	if (err.stack) console.error(dim(err.stack))
	process.exit(1)
})
