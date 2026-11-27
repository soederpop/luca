/**
 * Prints a markdown table from the bench.ts JSON reports.
 *   bun notes/lucaexpert-toolcall-bench/summarize.ts <results-folder>
 */
import { readdirSync, readFileSync } from 'fs'

const dir = process.argv[2]
if (!dir) throw new Error('pass the results folder')

const rows: string[] = []
for (const file of readdirSync(dir).filter((f) => f.endsWith('.json') && !f.startsWith('smoke')).sort()) {
	const r = JSON.parse(readFileSync(`${dir}/${file}`, 'utf8'))
	const [version] = file.replace('.json', '').split(/-(?=[a-z]+$)/i)
	const status = r.error ? `error: ${String(r.error).slice(0, 60)}` : (r.answer ? 'answered' : 'no answer')
	rows.push(`| ${r.prompt} | ${version} | ${r.totalToolCalls} | ${r.shellCalls} | ${r.evalCodeCalls} | ${Math.round(r.durationMs / 1000)}s | ${r.newFiles.length} | ${status} |`)
}
console.log('| prompt | version | tool calls | shell | evalCode | time | new files | status |')
console.log('|---|---|---|---|---|---|---|---|')
console.log(rows.join('\n'))
