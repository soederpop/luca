import container from '@/node'

async function main() {
	const cache = container.feature('diskCache')
	await cache.set('test', 'test')
	const test = await cache.get('test')
	console.log(test)
}

main()