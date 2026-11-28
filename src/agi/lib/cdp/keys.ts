/**
 * Keyboard tables for CDP Input.dispatchKeyEvent, ported from browser-use
 * (actor/utils.py get_key_info and default_action_watchdog.py char helpers).
 * Pages check `key`, `code` and `keyCode`, so typing has to send all three.
 */

const KEY_MAP: Record<string, [string, number]> = {
  Backspace: ['Backspace', 8], Tab: ['Tab', 9], Enter: ['Enter', 13], Escape: ['Escape', 27],
  Space: ['Space', 32], ' ': ['Space', 32], PageUp: ['PageUp', 33], PageDown: ['PageDown', 34],
  End: ['End', 35], Home: ['Home', 36], ArrowLeft: ['ArrowLeft', 37], ArrowUp: ['ArrowUp', 38],
  ArrowRight: ['ArrowRight', 39], ArrowDown: ['ArrowDown', 40], Insert: ['Insert', 45], Delete: ['Delete', 46],
  Shift: ['ShiftLeft', 16], ShiftLeft: ['ShiftLeft', 16], ShiftRight: ['ShiftRight', 16],
  Control: ['ControlLeft', 17], ControlLeft: ['ControlLeft', 17], ControlRight: ['ControlRight', 17],
  Alt: ['AltLeft', 18], AltLeft: ['AltLeft', 18], AltRight: ['AltRight', 18],
  Meta: ['MetaLeft', 91], MetaLeft: ['MetaLeft', 91], MetaRight: ['MetaRight', 92],
  CapsLock: ['CapsLock', 20], ScrollLock: ['ScrollLock', 145], NumLock: ['NumLock', 144],
  Semicolon: ['Semicolon', 186], ';': ['Semicolon', 186], Equal: ['Equal', 187], '=': ['Equal', 187],
  Comma: ['Comma', 188], ',': ['Comma', 188], Minus: ['Minus', 189], '-': ['Minus', 189],
  Period: ['Period', 190], '.': ['Period', 190], Slash: ['Slash', 191], '/': ['Slash', 191],
  Backquote: ['Backquote', 192], '`': ['Backquote', 192], BracketLeft: ['BracketLeft', 219], '[': ['BracketLeft', 219],
  Backslash: ['Backslash', 220], '\\': ['Backslash', 220], BracketRight: ['BracketRight', 221], ']': ['BracketRight', 221],
  Quote: ['Quote', 222], "'": ['Quote', 222], ContextMenu: ['ContextMenu', 93], Pause: ['Pause', 19],
  PrintScreen: ['PrintScreen', 44], Help: ['Help', 47], Clear: ['Clear', 12],
}
for (let i = 1; i <= 24; i++) KEY_MAP[`F${i}`] = [`F${i}`, 111 + i]
for (let i = 0; i <= 9; i++) KEY_MAP[`Numpad${i}`] = [`Numpad${i}`, 96 + i]

const isAlpha = (c: string) => c.length === 1 && c.toLowerCase() !== c.toUpperCase()
const isDigit = (c: string) => /^[0-9]$/.test(c)

/** code and windowsVirtualKeyCode for a named key ('Enter', 'ArrowUp', 'a'). */
export function getKeyInfo(key: string): [string, number | null] {
  if (key in KEY_MAP) return KEY_MAP[key]!
  if (key.length === 1) {
    if (isAlpha(key)) return [`Key${key.toUpperCase()}`, key.toUpperCase().charCodeAt(0)]
    if (isDigit(key)) return [`Digit${key}`, key.charCodeAt(0)]
  }
  return [key, null]
}

const SHIFT_CHARS: Record<string, [string, number]> = {
  '!': ['1', 49], '@': ['2', 50], '#': ['3', 51], '$': ['4', 52], '%': ['5', 53], '^': ['6', 54],
  '&': ['7', 55], '*': ['8', 56], '(': ['9', 57], ')': ['0', 48], '_': ['-', 189], '+': ['=', 187],
  '{': ['[', 219], '}': [']', 221], '|': ['\\', 220], ':': [';', 186], '"': ["'", 222],
  '<': [',', 188], '>': ['.', 190], '?': ['/', 191], '~': ['`', 192],
}
const NO_SHIFT_CHARS: Record<string, number> = {
  ' ': 32, '-': 189, '=': 187, '[': 219, ']': 221, '\\': 220, ';': 186, "'": 222, ',': 188, '.': 190, '/': 191, '`': 192,
}

/** [modifiers, windowsVirtualKeyCode, baseKey] for one typed character. Shift = 8. */
export function charModifiersAndVk(char: string): [number, number, string] {
  if (char in SHIFT_CHARS) {
    const [base, vk] = SHIFT_CHARS[char]!
    return [8, vk, base]
  }
  const vkFrom = (c: string) => { const up = c.toUpperCase(); return up.length === 1 ? up.charCodeAt(0) : c.charCodeAt(0) }
  if (isAlpha(char) && char === char.toUpperCase()) return [8, char.charCodeAt(0), char.toLowerCase()[0] || char]
  if (isAlpha(char)) return [0, vkFrom(char), char]
  if (isDigit(char)) return [0, char.charCodeAt(0), char]
  if (char in NO_SHIFT_CHARS) return [0, NO_SHIFT_CHARS[char]!, char]
  return [0, char.codePointAt(0)!, char]
}

const CHAR_CODES: Record<string, string> = {
  ' ': 'Space', '.': 'Period', ',': 'Comma', '-': 'Minus', '_': 'Minus', '@': 'Digit2', '!': 'Digit1',
  '?': 'Slash', ':': 'Semicolon', ';': 'Semicolon', '(': 'Digit9', ')': 'Digit0', '[': 'BracketLeft',
  ']': 'BracketRight', '{': 'BracketLeft', '}': 'BracketRight', '/': 'Slash', '\\': 'Backslash',
  '=': 'Equal', '+': 'Equal', '*': 'Digit8', '&': 'Digit7', '%': 'Digit5', '$': 'Digit4', '#': 'Digit3',
  '^': 'Digit6', '~': 'Backquote', '`': 'Backquote', "'": 'Quote', '"': 'Quote',
}

/** The physical key `code` for a character, the way Playwright reports it. */
export function keyCodeForChar(char: string): string {
  if (isDigit(char)) return `Digit${char}`
  if (isAlpha(char)) return `Key${char.toUpperCase()}`
  return CHAR_CODES[char] ?? `Key${char.toUpperCase()}`
}

const KEY_ALIASES: Record<string, string> = {
  ctrl: 'Control', control: 'Control', alt: 'Alt', option: 'Alt', meta: 'Meta', cmd: 'Meta', command: 'Meta',
  shift: 'Shift', enter: 'Enter', return: 'Enter', tab: 'Tab', delete: 'Delete', backspace: 'Backspace',
  escape: 'Escape', esc: 'Escape', space: ' ', up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft',
  right: 'ArrowRight', pageup: 'PageUp', pagedown: 'PageDown', home: 'Home', end: 'End',
}

export const MODIFIER_BITS: Record<string, number> = { Alt: 1, Control: 2, Meta: 4, Shift: 8 }

export const SPECIAL_KEYS = new Set([
  'Enter', 'Tab', 'Delete', 'Backspace', 'Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'PageUp', 'PageDown', 'Home', 'End', 'Control', 'Alt', 'Meta', 'Shift',
  'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12',
])

/** Normalize "ctrl+a" or "esc" to CDP key names ("Control+a", "Escape"). */
export function normalizeKeys(keys: string): string {
  if (keys.includes('+')) return keys.split('+').map((p) => KEY_ALIASES[p.trim().toLowerCase()] ?? p).join('+')
  return KEY_ALIASES[keys.trim().toLowerCase()] ?? keys
}
