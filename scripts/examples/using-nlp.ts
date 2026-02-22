import container from '@soederpop/luca/node'

const nlp = container.feature('nlp', { enable: true })

// --- parse(): compromise-powered verb normalization + structure extraction ---
console.log('=== parse() ===\n')

const commands = [
	'open the terminal',
	'draw a diagram of the auth flow',
	'write something about baseball',
	'quickly search for recent logs',
	'deploy the new build to staging',
]

for (const cmd of commands) {
	const result = nlp.parse(cmd)
	console.log(`"${cmd}"`)
	console.log(`  intent: ${result.intent}, target: ${result.target}, subject: ${result.subject}`)
	if (result.modifiers.length) console.log(`  modifiers: ${result.modifiers.join(', ')}`)
	console.log()
}

// --- analyze(): wink-nlp POS tagging + named entity recognition ---
console.log('=== analyze() ===\n')

const sentences = [
	'meet john at 3pm about the deployment',
	'send the report to sarah by friday',
	'there are 42 open issues in the repo',
]

for (const sentence of sentences) {
	const result = nlp.analyze(sentence)
	console.log(`"${sentence}"`)
	console.log(`  tokens: ${result.tokens.map(t => `${t.value}/${t.pos}`).join(' ')}`)
	if (result.entities.length) {
		console.log(`  entities: ${result.entities.map(e => `${e.value} (${e.type})`).join(', ')}`)
	}
	console.log()
}

// --- understand(): combined parse + analyze ---
console.log('=== understand() ===\n')

const utterance = 'create a new project for the dashboard'
const full = nlp.understand(utterance)
console.log(`"${utterance}"`)
console.log(`  intent: ${full.intent}`)
console.log(`  target: ${full.target}`)
console.log(`  subject: ${full.subject}`)
console.log(`  tokens: ${full.tokens.map(t => `${t.value}/${t.pos}`).join(' ')}`)
if (full.entities.length) {
	console.log(`  entities: ${full.entities.map(e => `${e.value} (${e.type})`).join(', ')}`)
}
