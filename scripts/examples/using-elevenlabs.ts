import container from '@soederpop/luca/node'
import '../../src/clients/elevenlabs'

async function main() {
	const phrase = container.argv.phrase || 'Hello! This is a test of the ElevenLabs text to speech client.'
	const voiceId = container.argv.voice || 'D3LWHMMgiK6AHC5Bl7dE'
	const outputPath = `/tmp/elevenlabs-${Date.now()}.mp3`

	const el = container.client('elevenlabs')
	await el.connect()

	console.log('Synthesizing:', phrase)
	const audio = await el.synthesize(phrase, { voiceId })
	console.log(`Audio size: ${(audio.length / 1024).toFixed(1)} KB`)

	await container.fs.writeFileAsync(outputPath, audio)
	console.log(`Saved to: ${outputPath}`)

	console.log('Playing...')
	const proc = container.feature('proc')
	await proc.spawnAndCapture('afplay', [outputPath])
	console.log('Done!')
}

main().catch(console.error)
