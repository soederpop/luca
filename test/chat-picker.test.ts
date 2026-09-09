import { describe, it, expect } from 'bun:test'
import { handlePickerInput, type ChatPicker } from '../src/commands/lib/chat-picker'
import { createInkSurface } from '../src/commands/lib/ink-surface'

function prompt(items: ChatPicker['items'] = [], custom = true) {
	const answers: string[] = []
	let closed = false
	let cancelled = false
	const picker: ChatPicker = {
		title: 'Question', items, index: 0,
		...(custom ? { text: { value: '', cursor: 0 } } : {}),
		onPick: value => { answers.push(value) },
		onText: value => { answers.push(value) },
		onCancel: () => { cancelled = true },
	}
	return {
		picker, answers,
		get closed() { return closed },
		get cancelled() { return cancelled },
		key(input: string, key: Record<string, boolean> = {}) {
			handlePickerInput(picker, input, key, () => { closed = true })
		},
	}
}

describe('chat question input', () => {
	it('accepts and edits a free-form answer', () => {
		const p = prompt()
		p.key('hello!')
		p.key('', { leftArrow: true })
		p.key('', { backspace: true })
		p.key('o world')
		p.key('', { return: true })
		expect(p.answers).toEqual(['hello world!'])
		expect(p.closed).toBe(true)
	})

	it('keeps a custom draft when moving between choices', () => {
		const p = prompt([{ label: 'Yes', value: 'yes' }])
		p.key('', { downArrow: true })
		p.key('Only on weekends')
		p.key('', { upArrow: true })
		p.key('', { downArrow: true })
		p.key('', { return: true })
		expect(p.answers).toEqual(['Only on weekends'])
	})

	it('still returns the value of a predefined choice', () => {
		const p = prompt([{ label: 'Yes', value: 'yes' }])
		p.key('', { return: true })
		expect(p.answers).toEqual(['yes'])
	})

	it('does not add custom answers to ordinary session pickers', () => {
		const p = prompt([{ label: 'Session', value: 'id' }], false)
		p.key('', { downArrow: true })
		p.key('ignored')
		p.key('', { return: true })
		expect(p.answers).toEqual(['id'])
	})

	it('does not submit blank text and supports multiline paste', () => {
		const p = prompt()
		p.key('', { return: true })
		expect(p.closed).toBe(false)
		p.key('First line\r\nSecond line')
		p.key('', { return: true })
		expect(p.answers).toEqual(['First line\nSecond line'])
	})

	for (const [input, key] of [['', { escape: true }], ['c', { ctrl: true }]] as const) {
		it(`cancels a typed answer with ${input || 'escape'}`, () => {
			const p = prompt()
			p.key('unfinished')
			p.key(input, key)
			expect(p.cancelled).toBe(true)
			expect(p.closed).toBe(true)
			expect(p.answers).toEqual([])
		})
	}

	it('allows the assistant tool to request text without options', async () => {
		const surface = createInkSurface({
			show() {},
			async ask(spec) {
				expect(spec.kind).toBe('text')
				return { value: 'My answer', label: 'My answer' }
			},
			async renderUi() { return { cancelled: true } },
		})
		expect(await surface.handlers.askUser({ kind: 'text', question: 'What else?' }))
			.toEqual({ value: 'My answer', label: 'My answer' })
	})
})
