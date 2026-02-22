import container from '@soederpop/luca/node'

async function main() {
	const tts = container.feature('tts', { enable: true })

	console.log('Available voices:', tts.voices.join(', '))
	console.log('Output directory:', tts.outputDir)
	console.log()

	// Synthesize a simple phrase
	console.log('Synthesizing with default voice (lucy)...')
	const path1 = await tts.synthesize('Hello! This is a test of the Chatterbox text to speech system.')
	console.log(`  Saved to: ${path1}`)

	// Try a different voice
	console.log('\nSynthesizing with voice "ethan"...')
	const path2 = await tts.synthesize('Good morning. How can I help you today?', { voice: 'ethan' })
	console.log(`  Saved to: ${path2}`)

	// Listen for events
	tts.on('synthesized', (text, path, voice, durationMs) => {
		console.log(`\n[event] synthesized "${text.slice(0, 40)}..." voice=${voice} took=${durationMs}ms`)
	})

	// Synthesize a longer passage
	console.log('\nSynthesizing a longer passage with voice "evelyn"...')
	const path3 = await tts.synthesize(
		'The quick brown fox jumps over the lazy dog. This sentence contains every letter of the English alphabet, making it a perfect pangram for testing.',
		{ voice: 'evelyn' }
	)
	console.log(`  Saved to: ${path3}`)

	// Play the last file with the system player (macOS)
	console.log('\nPlaying last generated audio...')
	const proc = container.feature('proc')
	await proc.spawnAndCapture('afplay', [path3])
	console.log('Done!')
}

main().catch(console.error)
