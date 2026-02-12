import container from '@/agi'

// ─── Types ───

interface TaskInfo {
	id: string
	title: string
	status: string
	cost: number
}

interface DashboardState {
	status: string
	goal: string
	costUsd: number
	currentPhase: number
	totalPhases: number
	tasksCompleted: number
	totalTasks: number
	revisionCount: number
	buildPath: string
	startTime: number
	tasks: TaskInfo[]
	activityLog: string[]
	spinnerFrame: number
	streamingLine: string
	done: boolean
}

// ─── Constants ───

const SPINNER = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

const STATUS_ICONS: Record<string, string> = {
	pending: '○',
	assigned: '◐',
	in_progress: '⟳',
	completed: '✓',
	failed: '✗',
	blocked: '⊘',
}

const STATUS_COLORS: Record<string, string> = {
	pending: 'gray',
	assigned: 'yellow',
	in_progress: 'cyan',
	completed: 'green',
	failed: 'red',
	blocked: 'gray',
}

const MAX_LOG_LINES = 8

// ─── Helpers ───

function formatElapsed(ms: number): string {
	const secs = Math.floor(ms / 1000)
	const mins = Math.floor(secs / 60)
	const s = secs % 60
	if (mins > 0) return `${mins}m ${s.toString().padStart(2, '0')}s`
	return `${s}s`
}

function truncate(str: string, len: number): string {
	if (!str) return ''
	if (str.length <= len) return str
	return str.slice(0, len - 1) + '…'
}

function pushLog(state: DashboardState, line: string): string[] {
	const log = [...state.activityLog, line]
	return log.slice(-MAX_LOG_LINES)
}

// ─── Main ───

async function main() {
	const args = process.argv.slice(2)
	const dryRun = args.includes('--dry-run')
	const goal = args.filter((a) => !a.startsWith('--')).join(' ') ||
		'Build a REST API for a todo list application using Express and TypeScript. Include CRUD endpoints, input validation with Zod, and unit tests with vitest.'

	// ─── Set up Ink ───
	const ink = container.feature('ink', { patchConsole: true })
	await ink.loadModules()

	const React = ink.React
	const { Box, Text } = ink.components
	const h = React.createElement

	// ─── Shared mutable state ───
	const dashState: DashboardState = {
		status: 'idle',
		goal,
		costUsd: 0,
		currentPhase: 0,
		totalPhases: 0,
		tasksCompleted: 0,
		totalTasks: 0,
		revisionCount: 0,
		buildPath: '',
		startTime: Date.now(),
		tasks: [],
		activityLog: ['Starting up...'],
		spinnerFrame: 0,
		streamingLine: '',
		done: false,
	}

	let forceRender: (() => void) | null = null

	function update(partial: Partial<DashboardState>) {
		Object.assign(dashState, partial)
		forceRender?.()
	}

	// ─── Components (createElement style) ───

	function Header() {
		const elapsed = formatElapsed(Date.now() - dashState.startTime)
		return h(Box, { flexDirection: 'column', paddingX: 1 },
			h(Text, { bold: true, color: 'cyan' }, '━━━ Programming Team ━━━'),
			h(Text, { dimColor: true }, truncate(dashState.goal, 70)),
			h(Box, { gap: 2 },
				h(Text, null,
					'Status: ',
					h(Text, { color: 'yellow', bold: true }, dashState.status.toUpperCase())
				),
				h(Text, null,
					'Cost: ',
					h(Text, { color: 'green' }, `$${dashState.costUsd.toFixed(4)}`)
				),
			),
			h(Box, { gap: 2 },
				h(Text, null,
					'Phase: ',
					h(Text, { color: 'cyan' }, `${dashState.currentPhase || '-'} / ${dashState.totalPhases || '-'}`)
				),
				h(Text, null,
					'Elapsed: ',
					h(Text, { dimColor: true }, elapsed)
				),
				dashState.revisionCount > 0
					? h(Text, null,
						'Revisions: ',
						h(Text, { color: 'yellow' }, String(dashState.revisionCount))
					)
					: null,
			),
		)
	}

	function TaskBoard() {
		if (dashState.tasks.length === 0) {
			return h(Box, { flexDirection: 'column', paddingX: 1, marginTop: 1 },
				h(Text, { dimColor: true }, 'Waiting for planner to create tasks...'),
			)
		}

		const rows = dashState.tasks.map((task) => {
			const icon = task.status === 'in_progress'
				? SPINNER[dashState.spinnerFrame % SPINNER.length]
				: STATUS_ICONS[task.status] || '?'

			const color = STATUS_COLORS[task.status] || 'white'
			const costStr = task.cost > 0 ? `$${task.cost.toFixed(3)}` : ''

			return h(Box, { key: task.id, paddingX: 1, gap: 1 },
				h(Text, { color }, icon),
				h(Text, {
					color: task.status === 'completed' ? 'green' : task.status === 'failed' ? 'red' : undefined
				}, truncate(task.id, 30).padEnd(30)),
				h(Text, { dimColor: true }, task.status.padEnd(12)),
				h(Text, { color: 'green', dimColor: true }, costStr),
			)
		})

		return h(Box, { flexDirection: 'column', paddingX: 1, marginTop: 1 },
			h(Text, { bold: true, dimColor: true }, '┌─ Task Board ─────────────────────────────────────────┐'),
			...rows,
			h(Text, { bold: true, dimColor: true }, '└─────────────────────────────────────────────────────┘'),
		)
	}

	function Activity() {
		const lines = dashState.activityLog.map((line, i) =>
			h(Box, { key: `log-${i}`, paddingX: 1 },
				h(Text, { dimColor: i < dashState.activityLog.length - 1, wrap: 'truncate' as any },
					truncate(line, 55)
				),
			)
		)

		return h(Box, { flexDirection: 'column', paddingX: 1, marginTop: 1 },
			h(Text, { bold: true, dimColor: true }, '┌─ Activity ───────────────────────────────────────────┐'),
			...lines,
			dashState.streamingLine
				? h(Box, { paddingX: 1 },
					h(Text, { color: 'cyan', wrap: 'truncate' as any }, truncate(dashState.streamingLine, 55))
				)
				: null,
			h(Text, { bold: true, dimColor: true }, '└─────────────────────────────────────────────────────┘'),
		)
	}

	function Footer() {
		if (!dashState.buildPath) return null
		return h(Box, { paddingX: 1, marginTop: 1 },
			h(Text, { dimColor: true }, `Build: ${dashState.buildPath}`),
		)
	}

	function App() {
		const [, setTick] = React.useState(0)

		React.useEffect(() => {
			forceRender = () => setTick((t: number) => t + 1)
			return () => { forceRender = null }
		}, [])

		// Spinner + elapsed timer
		React.useEffect(() => {
			const interval = setInterval(() => {
				dashState.spinnerFrame++
				setTick((t: number) => t + 1)
			}, 100)
			return () => clearInterval(interval)
		}, [])

		return h(Box, { flexDirection: 'column' },
			h(Header, null),
			h(TaskBoard, null),
			h(Activity, null),
			h(Footer, null),
		)
	}

	// ─── Mount the dashboard ───
	await ink.render(h(App, null))

	// ─── Create Crew ───
	const crew = container.feature('crew', {
		cached: false,
		projectPath: '/tmp/programming-team-demo',
		codingModel: 'sonnet',
		maxConcurrentAgents: 3,
		permissionMode: 'bypassPermissions',
		dryRun,
	})

	// ─── Wire Crew events → dashboard state ───

	crew.on('statusChange' as any, (status: string) => {
		update({ status, activityLog: pushLog(dashState, `Status → ${status}`) })
	})

	crew.on('architect:streamStart' as any, () => {
		update({
			streamingLine: '  thinking...',
			activityLog: pushLog(dashState, 'Architect is designing the plan...'),
		})
	})

	crew.on('architect:chunk' as any, (text: string) => {
		const combined = (dashState.streamingLine || '') + text
		update({ streamingLine: truncate(combined.split('\n').pop() || '', 55) })
	})

	crew.on('architect:streamEnd' as any, () => {
		update({ streamingLine: '' })
	})

	crew.on('architectComplete' as any, (plan: string) => {
		update({
			activityLog: pushLog(dashState, `Architect done (${plan.length} chars)`),
			streamingLine: '',
		})
	})

	crew.on('planner:start' as any, () => {
		update({
			streamingLine: '  thinking...',
			activityLog: pushLog(dashState, 'Planner is decomposing into tasks...'),
		})
	})

	crew.on('planner:done' as any, () => {
		update({ streamingLine: '' })
	})

	crew.on('planComplete' as any, async (buildPath: string) => {
		try {
			const planner = container.feature('planner', { cached: false }) as any
			await planner.loadBuild(buildPath)
			const tasks = await planner.getTasks()
			const taskInfos: TaskInfo[] = tasks.map((t: any) => ({
				id: t.meta.id,
				title: t.meta.title,
				status: t.meta.status,
				cost: t.meta.cost_usd || 0,
			}))
			update({
				buildPath,
				tasks: taskInfos,
				totalTasks: taskInfos.length,
				activityLog: pushLog(dashState, `Plan ready: ${taskInfos.length} tasks`),
			})
		} catch {
			update({
				buildPath,
				activityLog: pushLog(dashState, `Plan ready: ${buildPath}`),
			})
		}
	})

	crew.on('phaseStart' as any, (phase: number, taskIds: string[]) => {
		update({
			currentPhase: phase,
			activityLog: pushLog(dashState, `Phase ${phase}: ${taskIds.join(', ')}`),
		})
	})

	crew.on('phaseComplete' as any, (phase: number) => {
		update({ activityLog: pushLog(dashState, `Phase ${phase} complete`) })
	})

	crew.on('taskStart' as any, (taskId: string) => {
		const tasks = dashState.tasks.map((t) =>
			t.id === taskId ? { ...t, status: 'in_progress' } : t
		)
		update({ tasks, activityLog: pushLog(dashState, `[${taskId}] Started`) })
	})

	crew.on('taskComplete' as any, (taskId: string) => {
		const s = crew.state.current
		const tasks = dashState.tasks.map((t) =>
			t.id === taskId ? { ...t, status: 'completed' } : t
		)
		update({
			tasks,
			tasksCompleted: s.tasksCompleted || dashState.tasksCompleted + 1,
			costUsd: s.costUsd || dashState.costUsd,
			activityLog: pushLog(dashState, `[${taskId}] ✓ Completed`),
		})
	})

	crew.on('taskFailed' as any, (taskId: string, error: string) => {
		const tasks = dashState.tasks.map((t) =>
			t.id === taskId ? { ...t, status: 'failed' } : t
		)
		update({
			tasks,
			activityLog: pushLog(dashState, `[${taskId}] ✗ Failed: ${truncate(error || 'unknown', 40)}`),
		})
	})

	crew.on('agent:delta' as any, ({ taskId, text }: { taskId: string; text: string }) => {
		const combined = (dashState.streamingLine || '') + text
		const lastLine = combined.split('\n').pop() || ''
		update({ streamingLine: `[${taskId}] ${truncate(lastLine, 45)}` })
	})

	crew.on('reviewApproved' as any, (summary: string) => {
		update({ activityLog: pushLog(dashState, `Review: ✓ Approved — ${truncate(summary, 40)}`) })
	})

	crew.on('revisionRequested' as any, () => {
		update({
			revisionCount: dashState.revisionCount + 1,
			activityLog: pushLog(dashState, 'Review: Revisions requested'),
		})
	})

	crew.on('error' as any, (err: Error) => {
		update({ activityLog: pushLog(dashState, `ERROR: ${err.message}`) })
	})

	// ─── Run the crew ───
	try {
		const result = await crew.start(goal)

		update({
			done: true,
			activityLog: pushLog(dashState, `Done! ${result.tasksCompleted}/${result.totalTasks} tasks, $${result.costUsd.toFixed(4)}`),
		})

		// Let the user see the final state
		await new Promise((r) => setTimeout(r, 2000))
		ink.unmount()

		// Print final summary to plain stdout
		console.log('\n━━━ Result ━━━')
		console.log(`  Status: ${result.status}`)
		console.log(`  Build: ${result.buildPath}`)
		console.log(`  Cost: $${result.costUsd.toFixed(4)}`)
		console.log(`  Phases: ${result.phasesCompleted}`)
		console.log(`  Tasks: ${result.tasksCompleted}/${result.totalTasks}`)
		console.log(`  Reviews: ${result.reviewPasses}`)
		console.log('')
	} catch (err: any) {
		update({ activityLog: pushLog(dashState, `FATAL: ${err.message}`) })
		await new Promise((r) => setTimeout(r, 3000))
		ink.unmount()
		console.error(err)
		process.exit(1)
	}
}

main().catch((err) => {
	console.error(err)
	process.exit(1)
})
