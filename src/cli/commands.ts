import container from '@/agi'

export async function chat() {
	const expert = container.feature('expert', {
		folder: 'codebase',
		name: 'luca-codebase-expert'
	})

	await expert.start()

	expert.conversation!.on('preview', (chunk: string) => {
		console.clear()
		console.log(container.ui.markdown(chunk))
	})

	expert.conversation!.on('toolCall', (name: string, args: any) => {
		console.log(container.ui.markdown(`\n> **Running skill:** \`${name}\`\n`))
	})

	expert.conversation!.on('toolResult', (name: string, result: string) => {
		console.log(container.ui.markdown(`\n> **Skill result:** \`${name}\` returned\n`))
	})

	expert.conversation!.on('toolError', (name: string, err: any) => {
		console.log(container.ui.markdown(`\n> **Skill error:** \`${name}\` — ${err}\n`))
	})

	// we need to loop here and ask questions until the user quits
	while (true) {
		const { question } = await container.ui.askQuestion('?')
		const result = await expert.ask(question)
		console.clear()
		console.log(container.ui.markdown(result))
	}
}

export { oracleConsole as console }
async function oracleConsole() {
	const options = container.argv as any
	const model = options.model || 'gpt-4o'

	const oracle = container.feature('oracle', { model })
	await oracle.start()
}

export async function rundoc() {
	const options = container.argv as any
	const relativePathToMarkdownFile = options._[1] 

	if (!relativePathToMarkdownFile.startsWith('scripts/')) {
		throw new Error('Relative path must start with "scripts/"')
	}

	const requireApproval = options.requireApproval || options.safe || false 

	await container.docs.load()
	const doc = container.docs.collection.document(relativePathToMarkdownFile)		
	const vm = container.feature('vm')

	const shared = vm.createContext({ console, ...container.context })

	for (const node of doc.ast.children) {
		if (node.type === "code") {
			const { value, lang, meta } = node

			if (lang !== 'ts' && lang !== 'js') {
				continue
			}

			if (meta && typeof meta === 'string') {
				if (meta.toLowerCase().includes('skip')) {
					continue
				}
			}

			console.log(container.ui.markdown([
				'```' + lang,
				value,
				'```',
			].join('\n')))

			if (requireApproval) {
				const answer = await container.ui.askQuestion('Are you sure you want to run this script? (y/n)')
				if (answer.question.toLowerCase() !== 'y') {
					continue
				}
			}

			// your async code-block handling
			await vm.run(value, shared)
		} else {
			const md = doc.stringify({ type: "root", children: [node] });
			console.log(container.ui.markdown(md))	
		}
	}
}
