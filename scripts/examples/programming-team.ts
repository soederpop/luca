import container from '@/agi'

const ui = container.feature('ui')

async function main() {
	const args = process.argv.slice(2)
	const dryRun = args.includes('--dry-run')
	const goal = args.filter((a) => !a.startsWith('--')).join(' ') ||
		'Build a REST API for a todo list application using Express and TypeScript. Include CRUD endpoints, input validation with Zod, and unit tests with vitest.'

	ui.print.cyan('\n━━━ Programming Team ━━━\n')
	ui.print(`Goal: ${goal}`)
	ui.print(`Mode: ${dryRun ? 'dry run (plan only)' : 'full execution'}`)
	ui.print('')

	const crew = container.feature('crew', {
		cached: false,
		projectPath: '/tmp/programming-team-demo',
		codingModel: 'sonnet',
		maxConcurrentAgents: 3,
		permissionMode: 'bypassPermissions',
		dryRun,
	})

	// Wire up events for visibility
	crew.on('statusChange' as any, (status: string) => {
		ui.print.cyan(`\n[crew] Status: ${status}`)
	})

	crew.on('architectComplete' as any, (plan: string) => {
		ui.print.green(`[architect] Plan produced (${plan.length} chars)`)
	})

	crew.on('planComplete' as any, (buildPath: string) => {
		ui.print.green(`[planner] Build folder: ${buildPath}`)
	})

	crew.on('phaseStart' as any, (phase: number, taskIds: string[]) => {
		ui.print.cyan(`\n[phase ${phase}] Starting: ${taskIds.join(', ')}`)
	})

	crew.on('phaseComplete' as any, (phase: number) => {
		ui.print.green(`[phase ${phase}] Complete`)
	})

	crew.on('taskStart' as any, (taskId: string) => {
		ui.print(`  [task] ${taskId} — started`)
	})

	crew.on('taskComplete' as any, (taskId: string) => {
		ui.print.green(`  [task] ${taskId} — completed`)
	})

	crew.on('taskFailed' as any, (taskId: string, error: string) => {
		ui.print.red(`  [task] ${taskId} — failed: ${error}`)
	})

	crew.on('reviewApproved' as any, (summary: string) => {
		ui.print.green(`\n[review] Approved: ${summary}`)
	})

	crew.on('revisionRequested' as any, (feedback: string) => {
		ui.print.yellow(`\n[review] Revisions needed`)
	})

	crew.on('error' as any, (err: Error) => {
		ui.print.red(`\n[error] ${err.message}`)
	})

	const result = await crew.start(goal)

	ui.print.green('\n━━━ Result ━━━\n')
	ui.print(`Status: ${result.status}`)
	ui.print(`Build folder: ${result.buildPath}`)
	ui.print(`Total cost: $${result.costUsd.toFixed(4)}`)
	ui.print(`Phases completed: ${result.phasesCompleted}`)
	ui.print(`Tasks completed: ${result.tasksCompleted}/${result.totalTasks}`)
	ui.print(`Review passes: ${result.reviewPasses}`)
}

main().catch((err) => {
	console.error(err)
	process.exit(1)
})
