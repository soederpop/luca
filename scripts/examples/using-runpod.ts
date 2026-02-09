import container from '@/node'

async function main() {
	const runpod = container.feature('runpod')
	const secureGPUs = await runpod.listSecureGPUs()
	console.log(secureGPUs)

	const pods = await runpod.listPods()
	console.log(pods)
}

main()