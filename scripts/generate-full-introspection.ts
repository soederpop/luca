import container from '@/node'

async function main() {
	const featureDescriptions= container.features.describeAll()	
	const serverDescriptions = container.servers.describeAll()
	const clientDescriptions = container.clients.describeAll()

	const allDescriptions = ['# Features', ...featureDescriptions, '# Servers', ...serverDescriptions, '# Clients', ...clientDescriptions]

	console.log(allDescriptions.join('\n\n'))
}

main()