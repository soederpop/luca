export interface ChatPicker {
	title: string
	items: Array<{ label: string; hint?: string; value: string }>
	index: number
	/** When present, an additional row accepts a custom answer. */
	text?: { value: string; cursor: number }
	onPick: (value: string) => void | Promise<void>
	onText?: (value: string) => void
	onCancel?: () => void
}

/** Handle the active picker without touching the chat draft or history. */
export function handlePickerInput(picker: ChatPicker, input: string, key: Record<string, boolean>, close: () => void) {
	if (key.escape || (key.ctrl && input === 'c')) {
		close()
		picker.onCancel?.()
		return
	}
	const lastIndex = picker.items.length - (picker.text ? 0 : 1)
	if (key.upArrow) { picker.index = Math.max(0, picker.index - 1); return }
	if (key.downArrow) { picker.index = Math.min(lastIndex, picker.index + 1); return }
	const text = picker.index === picker.items.length ? picker.text : undefined
	if (key.return) {
		if (text) {
			if (!text.value.trim()) return
			close()
			picker.onText?.(text.value)
		} else {
			const chosen = picker.items[picker.index]
			if (!chosen) return
			close()
			void Promise.resolve(picker.onPick(chosen.value))
		}
		return
	}
	if (!text) return
	if (key.leftArrow) { text.cursor = Math.max(0, text.cursor - 1); return }
	if (key.rightArrow) { text.cursor = Math.min(text.value.length, text.cursor + 1); return }
	if (key.ctrl && input === 'a') { text.cursor = 0; return }
	if (key.ctrl && input === 'e') { text.cursor = text.value.length; return }
	if (key.backspace || key.delete) {
		if (text.cursor > 0) {
			text.value = text.value.slice(0, text.cursor - 1) + text.value.slice(text.cursor)
			text.cursor--
		}
		return
	}
	if (key.ctrl || key.meta || key.tab) return
	const clean = input.replace(/\r\n?/g, '\n').replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '')
	text.value = text.value.slice(0, text.cursor) + clean + text.value.slice(text.cursor)
	text.cursor += clean.length
}
