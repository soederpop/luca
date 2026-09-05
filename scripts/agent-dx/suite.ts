/** Small, outcome-graded tasks. Keep prompts free of the API names being tested. */
export const suiteVersion = 2

export const tasks = [
  {
    id: 'path-semantics', dimension: 'contract-understanding',
    prompt: 'Given { base, target }, return the path of target relative to base. Both may be absolute paths or paths relative to the working directory. Return a string.',
    reference: `export default (container, input) => container.paths.relative(input.base, input.target)`,
  },
  {
    id: 'binary-copy', dimension: 'data-integrity',
    prompt: 'Given { source, destination }, copy the file byte-for-byte, creating destination directories as necessary. Files may contain arbitrary binary bytes. Return the byte count.',
    reference: `export default (container, input) => {
      const fs = container.feature('fs')
      const bytes = fs.readFile(input.source, null)
      fs.ensureFolder(container.paths.dirname(container.paths.resolve(input.destination)))
      fs.writeFile(input.destination, bytes)
      return bytes.length
    }`,
  },
  {
    id: 'process-result', dimension: 'failure-recovery',
    prompt: 'Given { command, args, environment? }, execute that program with the exact argument array. Optional environment entries override inherited variables for the child only. Return { ok, exitCode, stdout, stderr }. A nonzero exit must produce ok:false while preserving diagnostic output. Do not invoke a shell.',
    reference: `export default async (container, input) => {
      const result = await container.proc.spawnAndCapture(input.command, input.args, { environment: input.environment })
      return { ok: result.exitCode === 0 && !result.error, exitCode: result.exitCode, stdout: result.stdout, stderr: result.stderr }
    }`,
  },
  {
    id: 'durable-counter', dimension: 'architecture',
    prompt: 'Implement a named durable counter. Input is { name, action:"add"|"read", amount?:number }. A missing counter starts at zero. Add must safely apply amount even when independent processes update concurrently. Read returns its numeric value, including updates by previous processes. Keep state local to this project; it must not expire.',
    reference: `export default async (container, input) => {
      const store = container.store(input.name, { initial: { value: 0 } })
      if (input.action === 'add') await store.update(state => { state.value += input.amount })
      return (await store.read()).value
    }`,
  },
  {
    id: 'module-boundary', dimension: 'runtime-understanding',
    prompt: 'Given { file, value }, load the TypeScript module at file through Luca, call its exported transform(value), and return { ok:true, value:result }. The module may use the injected container. For a missing file or failed transform return { ok:false, error:message } with the actual diagnostic message.',
    reference: `export default async (container, input) => {
      try {
        const mod = container.feature('vm').loadModule(container.paths.resolve(input.file), { container })
        return { ok: true, value: await mod.transform(input.value) }
      } catch (error) { return { ok: false, error: error.message } }
    }`,
  },
  {
    id: 'registry-discovery', dimension: 'discovery',
    prompt: 'Given { registry, name }, inspect a helper without constructing it. registry is features, clients, or servers. name may be bare (such as fs) or qualified (such as features.fs). Return { available, description }, where available is a boolean and description is the exact introspection description string for a registered helper, or null if unavailable. An unknown helper should not throw.',
    reference: `export default (container, input) => {
      const registry = container[input.registry]
      return { available: registry.has(input.name), description: registry.introspect(input.name)?.description ?? null }
    }`,
  },
] as const

export type Task = typeof tasks[number]

export function promptFor(task: Task) {
  return `Complete this Luca task in the current directory.\n\n${task.prompt}\n\nWrite solution.ts exporting a default function (container, input). The evaluator supplies a Luca NodeContainer whose cwd is a fresh project directory. Use the supplied container and its helpers for file, path, process, and state operations. Keep the implementation self-contained in solution.ts; do not install packages. Your function will be called with multiple unseen inputs and in fresh processes. Return JSON-serializable values. Read AGENTS.md and SKILL.md; references/ contains examples and tutorials. Use bun luca.ts describe or bun luca.ts eval to discover APIs against the evaluated checkout (these replace the installed luca command for this run). Do not read evaluator sources or reference solutions.\n`
}
