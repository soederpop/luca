import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from '../../schemas/base.js'
import { features, Feature } from '@soederpop/luca/feature'
import { toString } from 'mdast-util-to-string'
import type { AGIContainer } from '../container.server.js'
import type { Heading, Content } from 'mdast'

declare module '@soederpop/luca/feature' {
	interface AvailableFeatures {
		heartbeat: typeof Heartbeat
	}
}

// ─── Play types ───

export interface CodePlay {
	type: 'code'
	lang: 'ts' | 'js' | 'sh'
	code: string
}

export interface PromptPlay {
	type: 'prompt'
	assistant: string
	text: string
}

export type Play = CodePlay | PromptPlay

export interface Tier {
	name: string
	plays: Play[]
}

// ─── Schemas ───

export const HeartbeatEventsSchema = FeatureEventsSchema.extend({
	tick: z.tuple([z.number().describe('Tick count')]).describe('Emitted on each run'),
	tierDue: z.tuple([z.string().describe('Tier name'), z.string().describe('Reason')]).describe('Emitted when a tier is due to run'),
	tierSkipped: z.tuple([z.string().describe('Tier name'), z.string().describe('Reason')]).describe('Emitted when a tier is skipped'),
	playStarted: z.tuple([z.string().describe('Tier name'), z.any().describe('Play definition')]).describe('Emitted when a play begins execution'),
	playCompleted: z.tuple([z.string().describe('Tier name'), z.any().describe('Play definition'), z.any().describe('Result'), z.string().describe('Captured output')]).describe('Emitted when a play finishes successfully'),
	playError: z.tuple([z.string().describe('Tier name'), z.any().describe('Play definition'), z.any().describe('Error'), z.string().describe('Captured output')]).describe('Emitted when a play fails'),
	runComplete: z.tuple([]).describe('Emitted when the full run finishes'),
})

export const HeartbeatStateSchema = FeatureStateSchema.extend({
	tickCount: z.number().default(0).describe('Number of runs'),
	lastTick: z.string().optional().describe('ISO timestamp of last run'),
	lastRunEveryTime: z.string().optional().describe('ISO timestamp of last everyTime run'),
	lastRunHourly: z.string().optional().describe('ISO timestamp of last hourly run'),
	lastRunHourlyHour: z.number().optional().describe('Hour number of last hourly run'),
	lastRunThreeTimesDaily: z.string().optional().describe('ISO timestamp of last threeTimesDaily run'),
	lastRunThreeTimesDailyHour: z.number().optional().describe('Hour of last threeTimesDaily trigger'),
	lastRunEndOfDay: z.string().optional().describe('ISO timestamp of last endOfDay run'),
	lastRunEndOfDayDate: z.string().optional().describe('Date string of last endOfDay run'),
	runCountEveryTime: z.number().default(0).describe('Total everyTime runs'),
	runCountHourly: z.number().default(0).describe('Total hourly runs'),
	runCountThreeTimesDaily: z.number().default(0).describe('Total threeTimesDaily runs'),
	runCountEndOfDay: z.number().default(0).describe('Total endOfDay runs'),
})

export const HeartbeatOptionsSchema = FeatureOptionsSchema.extend({
	documentId: z.string().default('HEARTBEAT').describe('Document ID in container.docs collection'),
	minuteInterval: z.number().optional().describe('Override interval in minutes (default from frontmatter)'),
	dryRun: z.boolean().default(false).describe('Log plays without executing them'),
	overtime: z.boolean().default(false).describe('Run even outside configured working hours'),
	quiet: z.boolean().default(false).describe('Suppress console output (for TUI mode)'),
})

export type HeartbeatState = z.infer<typeof HeartbeatStateSchema>
export type HeartbeatOptions = z.infer<typeof HeartbeatOptionsSchema>

// ─── Tier schedule config ───

const THREE_TIMES_DAILY_HOURS = [9, 13, 17]
const DISK_CACHE_KEY = 'heartbeat-state'

/**
 * Heartbeat is a single-shot play executor that reads a HEARTBEAT.md document
 * from the container's docs collection, parses code blocks and prompt headings
 * into plays organized by timing tiers, and executes due tiers based on
 * persisted state from disk.
 *
 * @extends Feature
 *
 * @example
 * ```typescript
 * const heartbeat = container.feature('heartbeat', { enable: true })
 * await heartbeat.run() // loads, checks schedule, runs due tiers, saves state
 * ```
 */
export class Heartbeat extends Feature<HeartbeatState, HeartbeatOptions> {
	static override stateSchema = HeartbeatStateSchema
	static override optionsSchema = HeartbeatOptionsSchema
	static override eventsSchema = HeartbeatEventsSchema
	static override shortcut = 'features.heartbeat' as const

	private _tiers: Tier[] = []
	private _minuteInterval: number = 30
	private _startHour: number = 9
	private _endHour: number = 22

	override get container(): AGIContainer {
		return super.container as AGIContainer
	}

	override get initialState(): HeartbeatState {
		return {
			...super.initialState,
			tickCount: 0,
			runCountEveryTime: 0,
			runCountHourly: 0,
			runCountThreeTimesDaily: 0,
			runCountEndOfDay: 0,
		}
	}

	/** The parsed tiers and their plays. */
	get tiers(): Tier[] {
		return this._tiers
	}

	/** The resolved interval in minutes. */
	get minuteInterval(): number {
		return this._minuteInterval
	}

	/** Configured start hour for working hours. */
	get startHour(): number {
		return this._startHour
	}

	/** Configured end hour for working hours. */
	get endHour(): number {
		return this._endHour
	}

	/**
	 * Returns a human-readable description of the heartbeat schedule.
	 * Shows each tier, when it fires, and what plays it contains.
	 */
	describe(): string {
		const lines: string[] = []

		const startLabel = this._startHour > 12 ? `${this._startHour - 12}pm` : `${this._startHour}am`
		const endLabel = this._endHour > 12 ? `${this._endHour - 12}pm` : `${this._endHour}am`

		const scheduleDesc: Record<string, string> = {
			'Every Time': `runs every ${this._minuteInterval} minutes`,
			'Hourly': 'runs once per hour',
			'Three Times Daily': 'runs at 9am, 1pm, 5pm',
			'End of Day': `runs once after ${endLabel}`,
		}

		lines.push(`Heartbeat (interval: ${this._minuteInterval}m, hours: ${startLabel}–${endLabel})`)
		lines.push('')

		for (const tier of this._tiers) {
			const when = scheduleDesc[tier.name] || tier.name
			lines.push(`  ${tier.name} — ${when}`)

			for (const play of tier.plays) {
				if (play.type === 'code') {
					const preview = play.code.split('\n')[0].slice(0, 60)
					const suffix = play.code.includes('\n') ? ' ...' : ''
					lines.push(`    ${play.lang}  ${preview}${suffix}`)
				} else {
					const preview = play.text.slice(0, 50)
					const suffix = play.text.length > 50 ? '...' : ''
					lines.push(`    prompt ${play.assistant}  "${preview}${suffix}"`)
				}
			}

			lines.push('')
		}

		return lines.join('\n')
	}

	/**
	 * Load the HEARTBEAT document from container.docs and parse all plays.
	 * Reads minuteInterval, startHour, endHour from frontmatter.
	 */
	async loadPlays(): Promise<Tier[]> {
		await this.container.docs.load()
		const doc = this.container.docs.collection.document(this.options.documentId)

		// Read config from frontmatter, option overrides take precedence
		const meta = doc.meta as Record<string, any>
		this._minuteInterval = this.options.minuteInterval ?? (meta.minuteInterval as number | undefined) ?? 30
		this._startHour = (meta.startHour as number | undefined) ?? 9
		this._endHour = (meta.endHour as number | undefined) ?? 22

		// Get the ## Plays section
		const playsQuery = doc.querySection('Plays')
		const h3s = playsQuery.headingsAtDepth(3)

		const tiers: Tier[] = []

		for (let i = 0; i < h3s.length; i++) {
			const h3 = h3s[i]
			const tierName = toString(h3)
			const nextH3 = h3s[i + 1]

			// Get all nodes between this h3 and the next h3 (or end of section)
			const contentNodes = nextH3
				? playsQuery.findBetween(h3 as Content, nextH3 as Content)
				: playsQuery.findAllAfter(h3 as Content)

			const plays: Play[] = []
			let currentPromptAssistant: string | null = null
			let currentPromptParagraphs: string[] = []

			const flushPrompt = () => {
				if (currentPromptAssistant && currentPromptParagraphs.length) {
					plays.push({
						type: 'prompt',
						assistant: currentPromptAssistant,
						text: currentPromptParagraphs.join('\n\n'),
					})
				}
				currentPromptAssistant = null
				currentPromptParagraphs = []
			}

			for (const node of contentNodes) {
				if (node.type === 'code') {
					flushPrompt()
					const lang = (node as any).lang as string
					if (lang === 'ts' || lang === 'js' || lang === 'sh') {
						plays.push({
							type: 'code',
							lang,
							code: (node as any).value as string,
						})
					}
				} else if (node.type === 'heading' && (node as Heading).depth === 4) {
					flushPrompt()
					const text = toString(node)
					const match = text.match(/^Prompt\s+(.+)$/i)
					if (match) {
						currentPromptAssistant = match[1].trim()
					}
				} else if (node.type === 'paragraph' && currentPromptAssistant) {
					currentPromptParagraphs.push(toString(node))
				}
			}

			flushPrompt()
			tiers.push({ name: tierName, plays })
		}

		this._tiers = tiers
		return tiers
	}

	/**
	 * Load persisted state from diskCache. Hydrates this.state with saved values.
	 */
	async loadState(): Promise<void> {
		const diskCache = this.container.feature('diskCache')
		const hasState = await diskCache.has(DISK_CACHE_KEY)

		if (hasState) {
			const saved = await diskCache.get(DISK_CACHE_KEY, true) as Record<string, any>
			if (saved && typeof saved === 'object') {
				for (const [key, value] of Object.entries(saved)) {
					this.state.set(key as any, value)
				}
			}
		}
	}

	/**
	 * Save current state to diskCache for persistence across runs.
	 */
	async saveState(): Promise<void> {
		const diskCache = this.container.feature('diskCache')
		const stateData: Record<string, any> = {}

		// Serialize all state keys
		for (const key of Object.keys(HeartbeatStateSchema.shape)) {
			const val = this.state.get(key as any)
			if (val !== undefined) {
				stateData[key] = val
			}
		}

		await diskCache.set(DISK_CACHE_KEY, stateData)
	}

	/** Log only when not in quiet mode. */
	private log(...args: any[]): void {
		if (!this.options.quiet) console.log(...args)
	}

	/**
	 * Main entry point. Loads plays, hydrates state from disk, checks working
	 * hours, determines which tiers are due, executes them, and saves state.
	 */
	async run(): Promise<void> {
		await this.loadPlays()
		await this.loadState()

		const now = new Date()
		const currentHour = now.getHours()

		// Check working hours
		if (currentHour < this._startHour || currentHour >= this._endHour) {
			if (!this.options.overtime) {
				const startLabel = this._startHour > 12 ? `${this._startHour - 12}pm` : `${this._startHour}am`
				const endLabel = this._endHour > 12 ? `${this._endHour - 12}pm` : `${this._endHour}am`
				this.log(`Outside working hours (${startLabel}–${endLabel}). Use --overtime to run anyway.`)
				return
			}
		}

		await this.tick()
		await this.saveState()

		this.log('\nState saved.')
		this.emit('runComplete')
	}

	/**
	 * Execute a single tick. Determines which tiers should fire based on the
	 * current time and last-run state, then executes all plays for those tiers.
	 */
	private async tick(): Promise<void> {
		const tickCount = (this.state.get('tickCount') || 0) + 1
		this.state.set('tickCount', tickCount)
		this.state.set('lastTick', new Date().toISOString())
		this.emit('tick', tickCount)

		const now = new Date()
		const currentHour = now.getHours()
		const currentDate = now.toISOString().slice(0, 10)

		// Build list of tiers that are due, with reasons
		const dueMap = new Map<string, string>()
		const skipMap = new Map<string, string>()

		// Every Time — always fires
		dueMap.set('Every Time', 'due → running')

		// Hourly — fires when the hour has changed since last run
		const lastHourlyHour = this.state.get('lastRunHourlyHour') as number | undefined
		const lastHourlyTime = this.state.get('lastRunHourly') as string | undefined
		if (lastHourlyHour === undefined || lastHourlyHour !== currentHour) {
			const reason = lastHourlyTime
				? `last ran ${formatTime(lastHourlyTime)}, hour changed → running`
				: 'never ran → running'
			dueMap.set('Hourly', reason)
		} else {
			skipMap.set('Hourly', `last ran ${formatTime(lastHourlyTime!)}, same hour → skip`)
		}

		// Three Times Daily — fires at hours 9, 13, 17 (once per slot)
		const lastThreeHour = this.state.get('lastRunThreeTimesDailyHour') as number | undefined
		const lastThreeTime = this.state.get('lastRunThreeTimesDaily') as string | undefined
		if (THREE_TIMES_DAILY_HOURS.includes(currentHour)) {
			if (lastThreeHour !== currentHour) {
				const reason = lastThreeTime
					? `last ran ${formatTime(lastThreeTime)}, slot changed → running`
					: 'never ran → running'
				dueMap.set('Three Times Daily', reason)
			} else {
				skipMap.set('Three Times Daily', `last ran ${formatTime(lastThreeTime!)}, same slot → skip`)
			}
		} else {
			skipMap.set('Three Times Daily', `not due until next slot → skip`)
		}

		// End of Day — fires once when hour >= endHour
		const lastEodDate = this.state.get('lastRunEndOfDayDate') as string | undefined
		if (currentHour >= this._endHour) {
			if (lastEodDate !== currentDate) {
				dueMap.set('End of Day', 'due → running')
			} else {
				skipMap.set('End of Day', `already ran today → skip`)
			}
		} else {
			const endLabel = this._endHour > 12 ? `${this._endHour - 12}pm` : `${this._endHour}am`
			skipMap.set('End of Day', `not due until ${endLabel} → skip`)
		}

		// Emit tier events and print (if not quiet)
		for (const tier of this._tiers) {
			const dueReason = dueMap.get(tier.name)
			const skipReason = skipMap.get(tier.name)

			if (dueReason) {
				this.emit('tierDue', tier.name, dueReason)
				this.log(`\n  ${tier.name} — ${dueReason}`)
				await this.executeTier(tier)
			} else if (skipReason) {
				this.emit('tierSkipped', tier.name, skipReason)
				this.log(`\n  ${tier.name} — ${skipReason}`)
			}
		}
	}

	/**
	 * Execute all plays in a tier, updating run tracking state.
	 */
	private async executeTier(tier: Tier): Promise<void> {
		const now = new Date()
		const currentHour = now.getHours()
		const currentDate = now.toISOString().slice(0, 10)

		// Update tier tracking state
		const tierKey = tier.name.replace(/\s+/g, '')
		const stateKey = `lastRun${tierKey}` as keyof HeartbeatState
		const countKey = `runCount${tierKey}` as keyof HeartbeatState

		this.state.set(stateKey as any, now.toISOString())
		this.state.set(countKey as any, ((this.state.get(countKey as any) as number) || 0) + 1)

		if (tier.name === 'Hourly') {
			this.state.set('lastRunHourlyHour', currentHour)
		} else if (tier.name === 'Three Times Daily') {
			this.state.set('lastRunThreeTimesDailyHour', currentHour)
		} else if (tier.name === 'End of Day') {
			this.state.set('lastRunEndOfDayDate', currentDate)
		}

		for (const play of tier.plays) {
			await this.executePlay(tier.name, play)
		}
	}

	/**
	 * Execute a single play. Code plays run via vm or proc. Prompt plays
	 * dispatch to Claude Code or log a stub for other assistants.
	 */
	private async executePlay(tierName: string, play: Play): Promise<void> {
		this.emit('playStarted', tierName, play)

		if (this.options.dryRun) {
			const label = play.type === 'code'
				? `${play.lang}  ${play.code.split('\n')[0].slice(0, 60)}`
				: `prompt ${play.assistant}  "${play.text.slice(0, 50)}"`
			this.log(`    ${label} (dry-run)`)
			this.emit('playCompleted', tierName, play, { dryRun: true }, '')
			return
		}

		try {
			let result: { value: any; output: string }

			if (play.type === 'code') {
				result = await this.executeCodePlay(play)
			} else {
				result = await this.executePromptPlay(play)
			}

			const label = play.type === 'code'
				? `${play.lang}  ${play.code.split('\n')[0].slice(0, 60)}`
				: `prompt ${play.assistant}`
			this.log(`    ${label} \u2713`)
			if (result.output) this.log(`    ${result.output}`)

			this.emit('playCompleted', tierName, play, result.value, result.output)
		} catch (err: any) {
			const label = play.type === 'code'
				? `${play.lang}  ${play.code.split('\n')[0].slice(0, 60)}`
				: `prompt ${play.assistant}`
			const captured = (err as any).__capturedOutput || ''
			this.log(`    ${label} \u2717 ${err?.message || err}`)
			this.emit('playError', tierName, play, err, captured)
		}
	}

	/**
	 * Create a console that captures output into an array while optionally
	 * forwarding to the real console (when not in quiet mode).
	 */
	private createCapturingConsole(): { console: Record<string, Function>; lines: string[] } {
		const lines: string[] = []
		const quiet = this.options.quiet
		const fns = ['log', 'error', 'warn', 'info'] as const
		const captured: Record<string, Function> = {}

		for (const fn of fns) {
			captured[fn] = (...args: any[]) => {
				lines.push(args.map(String).join(' '))
				if (!quiet) (console as any)[fn](...args)
			}
		}

		return { console: captured, lines }
	}

	/**
	 * Execute a code play. ts/js blocks run through the container's VM feature
	 * with the container context. sh blocks run through proc.exec.
	 * Returns both the result value and any captured console output.
	 */
	private async executeCodePlay(play: CodePlay): Promise<{ value: any; output: string }> {
		if (play.lang === 'sh') {
			const proc = this.container.feature('proc')
			const value = await proc.exec(play.code)
			const output = typeof value === 'string' ? value : (value?.stdout ?? '')
			return { value, output }
		}

		// ts/js — use VM with container context and captured console
		const cap = this.createCapturingConsole()
		const vm = this.container.feature('vm')
		const ctx = vm.createContext({
			console: cap.console,
			container: this.container,
			setTimeout, clearTimeout, setInterval, clearInterval,
			fetch, URL, URLSearchParams,
			...this.container.context,
		})

		let code = play.code
		const hasTopLevelAwait = /\bawait\b/.test(code)
		if (hasTopLevelAwait) {
			code = `(async function() { ${code} })()`
		}

		try {
			const value = await vm.run(code, ctx)
			return { value, output: cap.lines.join('\n') }
		} catch (err: any) {
			// Attach captured output to the error so executePlay can include it
			err.__capturedOutput = cap.lines.join('\n')
			throw err
		}
	}

	/**
	 * Execute a prompt play. If the assistant is "Claude", dispatches to
	 * the claudeCode feature in headless acceptEdits mode. Other assistants
	 * log a stub for future wiring via assistantsManager.
	 */
	private async executePromptPlay(play: PromptPlay): Promise<{ value: any; output: string }> {
		if (play.assistant.toLowerCase() === 'claude') {
			const claude = this.container.feature('claudeCode')
			const value = await claude.run(play.text, { permissionMode: 'acceptEdits' })
			return { value, output: '' }
		}

		// Stub for other assistants — will use assistantsManager in future
		this.log(`    [prompt for ${play.assistant} not yet wired — will use assistantsManager]`)
		return { value: { stub: true, assistant: play.assistant, text: play.text }, output: '' }
	}
}

function formatTime(iso: string): string {
	const d = new Date(iso)
	const h = d.getHours()
	const m = d.getMinutes().toString().padStart(2, '0')
	const ampm = h >= 12 ? 'pm' : 'am'
	const h12 = h % 12 || 12
	return `${h12}:${m}${ampm}`
}

export default features.register('heartbeat', Heartbeat)
