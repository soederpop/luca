import container from '@soederpop/luca/node'

async function main() {
	const docker = container.feature('docker', { enable: true, autoRefresh: true })

	// List running containers so we can pick one
	const containers = await docker.listContainers()
	console.log('Running containers:', containers.map((c) => `${c.name} (${c.image})`).join(', ') || 'none')

	if (!containers.length) {
		console.log('\nNo running containers. Starting an alpine container for the demo...')
		await docker.runContainer('alpine:latest', {
			name: 'luca-shell-demo',
			detach: true,
			command: ['sleep', 'infinity'],
		})
		console.log('Started luca-shell-demo')
	}

	const target = containers[0]?.name || 'luca-shell-demo'

	// --- Basic shell (no volumes) ---
	console.log(`\n--- Basic shell against "${target}" ---`)
	const shell = await docker.createShell(target)

	await shell.run('echo "Hello from inside the container"')
	console.log('stdout:', shell.last!.stdout.trim())

	await shell.run('uname -a')
	console.log('uname:', shell.last!.stdout.trim())

	await shell.run('ls /')
	console.log('root listing:', shell.last!.stdout.trim())

	// --- Shell with volume mounts ---
	// This creates a new helper container from the same image with the mounts applied
	console.log(`\n--- Shell with volume mount ---`)
	const mounted = await docker.createShell(target, {
		volumes: [`${process.cwd()}:/workspace`],
		workdir: '/workspace',
	})

	console.log('Helper container:', mounted.containerId)

	await mounted.run('ls -la')
	console.log('workspace files:\n', mounted.last!.stdout)

	await mounted.run('wc -l package.json')
	console.log('package.json lines:', mounted.last!.stdout.trim())

	// Write a file from inside the container, visible on the host
	await mounted.run('echo "written by docker shell" > /workspace/.docker-shell-test')
	console.log('Wrote .docker-shell-test (exit code:', mounted.last!.exitCode, ')')

	// Clean up the helper container
	await mounted.destroy()
	console.log('Helper container destroyed')

	// --- Using execCommand directly with volumes (one-shot) ---
	console.log(`\n--- One-shot execCommand with volumes ---`)
	const result = await docker.execCommand(target, ['cat', '/data/package.json'], {
		volumes: [`${process.cwd()}/package.json:/data/package.json:ro`],
	})
	console.log('package.json name:', JSON.parse(result.stdout).name)

	// Clean up demo container if we created it
	if (!containers.length) {
		await docker.removeContainer('luca-shell-demo', { force: true })
		console.log('\nCleaned up luca-shell-demo')
	}

	console.log('\nDone!')
}

main().catch(console.error)
