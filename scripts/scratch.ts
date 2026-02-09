import container from '@/node'

const grep = container.feature('grep')

const results = await grep.search({
	pattern: 'TODO',
	include: '*.ts',
	exclude: 'node_modules',
})

console.log(results)

console.log(container.features.lookup('grep').introspectAsText(3))