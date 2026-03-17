import { z } from 'zod'
import { commands, CommandOptionsSchema } from '@soederpop/luca'
import type { ContainerContext } from '@soederpop/luca'

declare module '@soederpop/luca' {
  interface AvailableCommands {
    tryChallenge: ReturnType<typeof commands.registerHandler>
  }
}

export const argsSchema = CommandOptionsSchema.extend({
  'time-limit': z.number().optional().describe('Time limit in minutes (defaults to challenge maxTime, then 5)'),
  list: z.boolean().default(false).describe('List available challenges')
})

export async function tryChallenge(options: z.infer<typeof argsSchema>, context: ContainerContext) {
  const container = context.container as any
  const fs = container.feature('fs')
  let requestedChallengeId = options._[1]!

  await container.docs.load()

  const challenges = await container.docs.queries.challenges.fetchAll()

  if (!requestedChallengeId) {
    container.ui.print('Available challenges:')
    challenges.forEach(c => container.ui.print(`- ${c.id.split('/').pop()}`))
    return
  }

  requestedChallengeId = requestedChallengeId.startsWith('challenges/') ? requestedChallengeId : `challenges/${requestedChallengeId}`

  const challenge = challenges.find(c => c.id === requestedChallengeId || c.id.split('/').pop() === requestedChallengeId)

  // Derive slug from the challenge id (e.g. "challenges/build-an-api" -> "build-an-api")
  const slug = challenge.id.split('/').pop()

  // Determine attempt number by counting existing attempts for this challenge
  fs.ensureFolder('attempts')
  const existing = fs.existsSync('attempts')
    ? (await fs.readdir('attempts') as string[]).filter((name: string) => name.startsWith(slug + '-attempt-'))
    : []
  const attemptNumber = existing.length + 1
  const attemptFolder = `attempts/${slug}-attempt-${attemptNumber}`

  fs.ensureFolder(attemptFolder)

  const timeLimitMinutes = options['time-limit'] ?? challenge.meta?.maxTime ?? 5
  const timeLimitMs = timeLimitMinutes * 60 * 1000

  container.ui.print(`Running Challenge: ${challenge.title}`)
  container.ui.print(`Attempt #${attemptNumber} in ${attemptFolder}`)
  container.ui.print(`Time limit: ${timeLimitMinutes} minutes`)

  // Bootstrap the attempt folder
  await container.proc.spawnAndCapture('luca', ['bootstrap'], {
    cwd: container.paths.resolve(attemptFolder),
    onOutput: (str) => { console.log(str) },
    onError: (str) => { console.error(str) },
  })

  const promptCommandArgs = [
    'prompt', 'claude', `docs/${challenge.id}`,
    '--exclude-sections', 'Internal Notes',
    '--out-file', `docs/sessions/${challenge.id.split('/').pop()}/attempt-log-${attemptNumber}.md`,
    '--in-folder', attemptFolder, '--dont-touch-file'
  ]

  const promptProcess = container.proc.spawnAndCapture('luca', promptCommandArgs, {
	  onOutput: (str) => {
		  console.log(str)
	  },
	  onError: (str) => {
		  console.error(str)
	  },
	  onExit: () => {
		  console.log('Claude Exited')
      // @ts-ignore
      process.exit(0)
	  }
  })

  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Time limit of ${timeLimitMinutes} minutes reached`))
    }, timeLimitMs)
  })

  try {
    await Promise.race([promptProcess, timeout])
  } catch (err: any) {
    container.ui.print(err.message)
  }
}

export default {
  description: 'Try running one of the evaluation challenges.',
  argsSchema,
  handler: tryChallenge,
}
