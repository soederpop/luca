import container from '@/node'

const ui = container.feature('ui')

const VOLUME_NAME = 'comfy-workspace'
const POD_NAME = 'comfy-workspace'
const TEMPLATE_ID = 'cw3nka7d08'
const GPU = 'NVIDIA GeForce RTX 4090'

// ── Models to ensure exist on the pod ───────────────────────────
// Path on the pod filesystem → fallback download URL
const REQUIRED_FILES = [
	{
		path: '/workspace/ComfyUI/models/checkpoints/juggernautXL_v9Rundiffusion.safetensors',
		url: 'https://civitai.com/api/download/models/456194',
		label: 'Juggernaut XL v9 checkpoint',
	},
	{
		path: '/workspace/ComfyUI/models/checkpoints/sks-juggernaut-3000.safetensors',
		url: 'https://s3.us-east-1.amazonaws.com/demo.skypager.io/sks-juggernaut-3000.safetensors',
		label: 'Juggernaut SKS',
	},
	{
		path: '/workspace/ComfyUI/models/checkpoints/loras1.zip',
		url: 'https://s3.us-east-1.amazonaws.com/demo.skypager.io/loras1.zip',
		label: 'Loras',
	},

]

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
			templateId: TEMPLATE_ID,
			gpuTypeId: GPU,
			cloudType: 'SECURE',
			networkVolumeId: volume.id,
			containerDiskInGb: 50,
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
	ui.print(`FileBrowser: https://${readyPod.id}-8080.proxy.runpod.net`)
	ui.print(`JupyterLab:  https://${readyPod.id}-8888.proxy.runpod.net`)

	if (readyPod.publicIp && readyPod.portMappings?.['22']) {
		ui.print(`SSH:       ssh root@${readyPod.publicIp} -p ${readyPod.portMappings['22']}`)
	}

	// Step 4: Ensure required model files exist on the pod
	for (const file of REQUIRED_FILES) {
		ui.print.cyan(`\nChecking: ${file.label}...`)
		const result = await runpod.ensureFileExists(readyPod.id, file.path, file.url, {
			onProgress: (bytes) => {
				ui.print(`  ${file.label}: ${(bytes / 1e9).toFixed(2)} GB downloaded...`)
			},
		})

		if (result.existed) {
			ui.print.green(`  Already there.`)
		} else {
			ui.print.green(`  Downloaded successfully.`)
		}
	}

	// Step 5: Unzip loras into the ComfyUI loras directory
	const lorasZip = '/workspace/ComfyUI/models/checkpoints/loras1.zip'
	const lorasDest = '/workspace/ComfyUI/models/loras'

	ui.print.cyan('\nUnzipping LoRAs into models/loras...')
	const shell = await runpod.getShell(readyPod.id)
	const unzipResult = await shell.exec(`unzip -n ${lorasZip} -d ${lorasDest} && echo UNZIP_OK || echo UNZIP_FAIL`)

	if (unzipResult.includes('UNZIP_OK')) {
		ui.print.green('  LoRAs extracted successfully.')
	} else {
		ui.print.red(`  LoRA extraction may have failed: ${unzipResult}`)
	}

	ui.print.green('\n--- All models ready! ---\n')

	return { podId: readyPod.id, comfyUrl, pod: readyPod }
}

main().catch(err => {
	ui.print.red(`Error: ${err.message}`)
	console.error(err)
	process.exit(1)
})
