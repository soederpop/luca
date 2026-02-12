import container from '@/agi'

const codex = container.feature('openaiCodex')

// Stream deltas as they come in
codex.on('session:delta', ({ text }: any) => process.stdout.write(text))
codex.on('session:exec', ({ exec }: any) => console.log(`\n[exec] ${exec.command?.join(' ')}`))
codex.on('session:patch', ({ patch }: any) => console.log(`\n[patch] ${patch.path}`))

async function main() {
	const session = await codex.run('Explain the purpose of this project in a few sentences.', {
		fullAuto: true,
	})

	console.log('\n---')
	console.log('Status:', session.status)
	console.log('Result:', session.result)
	console.log('Turns:', session.turns)
	console.log('Patches:', session.patches.length)
	console.log('Execs:', session.executions.length)
}

main()
