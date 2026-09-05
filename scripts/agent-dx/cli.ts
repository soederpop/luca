import container from '../../src/node'
import { tasks } from './suite'
import { compare, configSchema, run, summarize } from './harness'

const [command, arg, output] = process.argv.slice(2)
try {
  if (command === 'list') console.log(tasks.map(t => `${t.id}: ${t.dimension}\n  ${t.prompt}`).join('\n'))
  else if (command === 'compare') {
    if (!arg || !output) throw new Error('Usage: eval:agent-dx compare BASELINE/report.json CANDIDATE/report.json')
    const result = compare(container.fs.readJson(arg), container.fs.readJson(output))
    console.log(JSON.stringify(result, null, 2))
    if (result.regressed) process.exitCode = 1
  } else if (command === 'run' || command === 'reference') {
    if (!arg) throw new Error('Usage: eval:agent-dx run CONFIG.json [OUTPUT] | reference OUTPUT')
    const mode = command === 'reference' ? 'reference' : 'agent'
    const config = mode === 'reference'
      ? configSchema.parse({ label: 'reference', model: 'reference', runner: ['reference'], trials: 1 })
      : configSchema.parse(container.fs.readJson(arg))
    const report = await run(config, mode, mode === 'reference' ? arg : output || `/tmp/luca-agent-dx-${container.utils.uuid()}`)
    console.log(JSON.stringify(summarize(report), null, 2))
    if (report.attempts.some(a => a.status !== 'passed')) process.exitCode = 1
  } else throw new Error('Usage: bun run eval:agent-dx list | reference OUTPUT | run CONFIG.json [OUTPUT] | compare BASELINE/report.json CANDIDATE/report.json')
} catch (error) { console.error(String(error)); if (process.exitCode !== 130) process.exitCode = 2 }
