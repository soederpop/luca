import container from '@soederpop/luca/node'

async function main() {
	const runpod = container.feature('runpod')

	// List available GPUs with pricing
	const gpus = await runpod.listSecureGPUs()
	console.log('Available GPUs:')
	console.table(gpus)

	// List RunPod's official templates
	const templates = await runpod.listTemplates({ includeRunpod: true })
	console.log('\nAvailable Templates:')
	for (const t of templates) {
		console.log(`  ${t.id} - ${t.name} (${t.imageName})`)
	}

	// Launch a pod from a template on an RTX 4090
	// const pod = await runpod.createPod({
	// 	name: 'my-workspace',
	// 	templateId: templates[0].id,
	// 	gpuTypeId: 'NVIDIA GeForce RTX 4090',
	// })
	// console.log('Created pod:', pod.id)

	// List running pods
	const pods = await runpod.listPods()
	console.log('\nRunning Pods:')
	console.table(pods.map(p => ({ id: p.id, name: p.name, gpu: p.gpu, status: p.status })))
}

main()
