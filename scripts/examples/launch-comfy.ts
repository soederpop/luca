import container from '@/node'

const ui = container.feature('ui')

const VOLUME_NAME = 'comfy-workspace'
const POD_NAME = 'comfy-workspace'
const IMAGE = 'ghcr.io/ai-dock/comfyui:latest'
const GPU = 'NVIDIA GeForce RTX 4090'

async function main() {
	const runpod = container.feature('runpod')

	// Step 1: Find or create the volume
	const volumes = await runpod.listVolumes()
	let volume = volumes.find(v => v.name === VOLUME_NAME)

	if (volume) {
		ui.print.green(`Using existing volume: ${volume.id} (${volume.size}GB in ${volume.dataCenterId})`)
	} else {
		ui.print.cyan('Creating 40GB network volume...')
		volume = await runpod.createVolume({ name: VOLUME_NAME, size: 40 })
		ui.print.green(`Volume created: ${volume.id} (${volume.size}GB in ${volume.dataCenterId})`)
	}

	// Step 2: Find or create the pod
	const pods = await runpod.getpods({ name: POD_NAME })
	let existingPod = pods.find(p => p.desiredStatus !== 'TERMINATED')

	if (existingPod) {
		ui.print.green(`Found existing pod: ${existingPod.id} (${existingPod.desiredStatus})`)

		if (existingPod.desiredStatus === 'EXITED') {
			ui.print.cyan('Pod is stopped, starting it...')
			await runpod.startPod(existingPod.id)
		}
	} else {
		ui.print.cyan('Launching ComfyUI on RTX 4090...')
		existingPod = await runpod.createPod({
			name: POD_NAME,
			imageName: IMAGE,
			gpuTypeId: GPU,
			cloudType: 'SECURE',
			networkVolumeId: volume.id,
			containerDiskInGb: 50,
			ports: ['8188/http', '22/tcp'],
		})
		ui.print.green(`Pod created: ${existingPod.id}`)
	}

	// Step 3: Wait for the pod to be running
	ui.print.cyan('Waiting for pod to be ready...')
	const readyPod = await runpod.waitForPod(existingPod.id, 'RUNNING', { interval: 5000, timeout: 120000 })

	const gpuName = readyPod.gpu?.displayName ?? readyPod.machine?.gpuTypeId ?? 'unknown'
	const comfyUrl = `https://${readyPod.id}-8188.proxy.runpod.net`

	ui.print.green('\n--- ComfyUI is ready! ---')
	ui.print(`Pod ID:    ${readyPod.id}`)
	ui.print(`GPU:       ${gpuName}`)
	ui.print(`Cost:      $${readyPod.costPerHr}/hr`)
	ui.print(`Volume:    ${volume.id} (${volume.size}GB)`)
	ui.print.green(`ComfyUI:   ${comfyUrl}`)

	if (readyPod.portMappings?.['22/tcp']) {
		const ssh = readyPod.portMappings['22/tcp']
		ui.print(`SSH:       ssh root@${ssh.ip} -p ${ssh.port}`)
	}
}

main().catch(err => {
	ui.print.red(`Error: ${err.message}`)
	console.error(err)
	process.exit(1)
})
