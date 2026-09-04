import { z } from 'zod'

/**
 * Assistant-facing UI tools for the `luca chat` TUI.
 *
 * This is deliberately NOT a registered container feature: it only makes
 * sense inside a live ink chat session, so the chat TUI builds one per
 * session with closures over its own store and mounts it on every
 * assistant via `assistant.use(bundle)`.
 *
 * Two tools, two surfaces:
 *  - showWidget: renders a static block (table/list/markdown/banner) into
 *    the transcript scrollback. Fire-and-forget.
 *  - askUser: takes over the live input region with an interactive picker
 *    and blocks the turn until the human answers. The selection (or a
 *    cancellation) becomes the tool result.
 */

export interface InkSurfaceDeps {
	/** Render a static widget block into the transcript. */
	show: (spec: ShowWidgetArgs) => void
	/** Present an interactive prompt; resolves with the user's answer. */
	ask: (spec: AskUserArgs) => Promise<AskUserResult>
	/** Compile and mount an assistant-authored ink component; resolves when it calls done()/cancel(). */
	renderUi: (spec: RenderUiArgs) => Promise<RenderUiResult>
}

export const showWidgetSchema = z.object({
	widget: z.enum(['table', 'list', 'markdown', 'banner']).describe('Which widget to render'),
	title: z.string().optional().describe('Optional heading rendered above the widget'),
	text: z.string().optional().describe('Body content for markdown and banner widgets'),
	columns: z.array(z.string()).optional().describe('Column headers (table widget)'),
	rows: z.array(z.array(z.string())).optional().describe('Row cells, one array per row, matching columns (table widget)'),
	items: z.array(z.string()).optional().describe('Bullet items (list widget)'),
}).describe('Render a read-only widget into the chat transcript. Use it to present structured results instead of a wall of prose.')

export const askUserSchema = z.object({
	kind: z.enum(['select', 'confirm']).describe("'select' shows a menu of options; 'confirm' asks a yes/no question"),
	question: z.string().describe('The question shown above the choices'),
	options: z.array(z.object({
		label: z.string().describe('Text shown for this choice'),
		value: z.string().optional().describe('Value returned when chosen (defaults to the label)'),
		hint: z.string().optional().describe('Dim hint text shown after the label'),
	})).optional().describe("Choices for kind 'select' (2-10 recommended). Ignored for 'confirm'."),
}).describe("Present an interactive prompt in the terminal and wait for the user's keyboard answer. The result is what they chose, or { cancelled: true } if they pressed escape — respect a cancellation, do not immediately re-ask.")

export const renderUiSchema = z.object({
	source: z.string().describe(
		'TypeScript/JSX source for an ink component. Must export default a function component (or define one named Widget). ' +
		'React and ink are already loaded — import from "react" and "ink" normally (Box, Text, useInput, useState, ...), but never call render() yourself. ' +
		'The component receives props { done, cancel }: call done(result) with any JSON-serializable value to finish and return that result to you; ' +
		'the user can back out with ctrl+c, which resolves as { cancelled: true }. ' +
		'Always wire a way to finish (useInput handling enter/escape, a final selection, etc.) — the conversation is blocked until done() or cancel() is called.',
	),
	title: z.string().optional().describe('Short label for the transcript line recording that this UI ran'),
}).describe('Build and mount a fully custom interactive ink UI in the terminal (forms, dashboards, games, multi-step wizards — anything ink can render). Heavier than askUser; prefer askUser for a simple choice.')

export type ShowWidgetArgs = z.infer<typeof showWidgetSchema>
export type AskUserArgs = z.infer<typeof askUserSchema>
export type AskUserResult = { value: string; label: string } | { cancelled: true }
export type RenderUiArgs = z.infer<typeof renderUiSchema>
export type RenderUiResult = { value: unknown } | { cancelled: true } | { error: string }

const PROMPT_EXTENSION = [
	'You are running inside an interactive terminal chat UI and have three UI tools.',
	'Use showWidget to present structured information (tables, lists, rendered markdown) instead of large text dumps.',
	'Use askUser when you need the human to decide something — it renders a keyboard-driven menu and returns their choice as the tool result.',
	'Use renderUi to build any custom interactive terminal UI: you write an ink (React for terminals) component and it is compiled and mounted live.',
	'renderUi contract: export default a function component; React and ink imports work normally (useState, Box, Text, useInput, ...); never call render(); ',
	'call props.done(result) to finish — the result becomes your tool result — and always give the user a keyboard path to done() or props.cancel().',
	'All interactive tools block until answered; if the result is { cancelled: true } the user dismissed it, so continue without that answer instead of re-asking.',
	'If renderUi returns { error }, fix the component source and try once more.',
].join(' ')

/**
 * Build the tools bundle the chat TUI mounts on each assistant.
 * The returned object satisfies the plain `{ schemas, handlers }` shape
 * that `assistant.use()` accepts; `setup()` is invoked by use() and adds
 * a system-prompt extension so the model knows the surface exists.
 */
export function createInkSurface(deps: InkSurfaceDeps) {
	return {
		provider: { name: 'inkSurface' },
		schemas: {
			showWidget: showWidgetSchema,
			askUser: askUserSchema,
			renderUi: renderUiSchema,
		},
		handlers: {
			showWidget(args: ShowWidgetArgs) {
				const parsed = showWidgetSchema.parse(args)
				if (parsed.widget === 'table' && (!parsed.columns?.length || !parsed.rows?.length)) {
					return { error: 'table widget requires columns and rows' }
				}
				if (parsed.widget === 'list' && !parsed.items?.length) {
					return { error: 'list widget requires items' }
				}
				if ((parsed.widget === 'markdown' || parsed.widget === 'banner') && !parsed.text) {
					return { error: `${parsed.widget} widget requires text` }
				}
				deps.show(parsed)
				return { shown: true }
			},
			async askUser(args: AskUserArgs) {
				const parsed = askUserSchema.parse(args)
				if (parsed.kind === 'select' && !parsed.options?.length) {
					return { error: "kind 'select' requires options" }
				}
				return deps.ask(parsed)
			},
			async renderUi(args: RenderUiArgs) {
				const parsed = renderUiSchema.parse(args)
				return deps.renderUi(parsed)
			},
		},
		setup(assistant: any) {
			assistant.addSystemPromptExtension?.('inkSurface', PROMPT_EXTENSION)
		},
	}
}
