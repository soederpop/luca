import container from '@/agi'

const claude = container.feature('claudeCode')

async function main() {
	const session = await claude.run('Explain the purpose of this project in a few sentences.')
	console.log(session.result)
}

main()