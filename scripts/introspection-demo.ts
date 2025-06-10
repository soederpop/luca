import container from '../src/node'
import '../src/introspection/generated'
import '../src/introspection/scan.js'

// Test the scanner directly to see if JSDoc extraction is working
async function testScanner() {
	const scanner = container.feature('introspectionScanner', { 
		src: ['src/node/features'], 
		enable: true 
	})
	
	const results = await scanner.scan()
	console.log('Scanner results:')
	console.log(JSON.stringify(results.find(r => r.id === 'features.fs'), null, 2))
}

// testScanner()

// container.features.available.forEach((feature) => {
// 	const f = container.feature(feature as any)
// 	console.log(f.introspect())
// })

console.log(
	JSON.stringify(container.feature('fs').introspect(), null, 2))