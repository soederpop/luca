export interface ClaudeControllerChoice {
  index?: number
  key?: string
  label: string
  selected?: boolean
  raw: string
}

export interface ClaudeControllerSnapshot {
  id: string
  tmuxSession: string
  cwd: string
  sessionId?: string
  sessionFile?: string
  pane: string
  currentCommand: string
  awaitingInput: boolean
  choices: ClaudeControllerChoice[]
  history: any[]
  updatedAt: string
}

export interface ClaudeControllerAskOptions {
  timeoutMs?: number
  pollIntervalMs?: number
  wait?: boolean
}

export interface ClaudeControllerStartOptions {
  id?: string
  name?: string
  cwd?: string
  command?: string
  args?: string[]
  width?: number
  height?: number
  reuse?: boolean
}

const DEFAULT_AWAITING_PATTERNS = [
  />\s*$/,
  /❯\s*$/,
  /\?\s*$/,
  /Do you want to proceed\?/i,
  /Would you like to/i,
  /\b(Y\/n|y\/N)\b/,
  /\b(Yes|No)\b.*\besc\b/i,
  /Choose an option/i,
]

const CLAUDE_COMMAND_NAMES = new Set(['claude', 'node', 'bun'])

export function compactClaudeControllerId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'default'
}

function lastMeaningfulLines(screen: string): string[] {
  return screen
    .split('\n')
    .map(line => line.trimEnd())
    .filter(line => line.trim().length > 0)
}

/**
 * Parse Claude's visible terminal prompt into selectable choices.
 * Handles numbered menus, selected rows, radio-like bullets, and simple y/n prompts.
 */
export function parseClaudeChoices(screen: string): ClaudeControllerChoice[] {
  const lines = lastMeaningfulLines(screen)
  const choices: ClaudeControllerChoice[] = []
  const seen = new Set<string>()

  for (const rawLine of lines.slice(-30)) {
    const line = rawLine.trim()
    const selected = /^[>❯➜→]/.test(line) || /^[●◉]/.test(line)
    const normalized = line.replace(/^[>❯➜→]\s*/, '').replace(/^[○●◉◌]\s*/, '')

    let match = normalized.match(/^(\d+)[.)]\s+(.+)$/)
    if (match) {
      const index = Number(match[1])
      const label = match[2]!.trim()
      const key = String(index)
      if (!seen.has(key)) {
        choices.push({ index, key, label, selected, raw: rawLine })
        seen.add(key)
      }
      continue
    }

    match = normalized.match(/^\[?([a-zA-Z])\]?\)?[.)]?\s+(.+)$/)
    if (match && /^(y|n|a|d|q|c)$/i.test(match[1]!)) {
      const key = match[1]!
      const label = match[2]!.trim()
      if (label.length > 1 && !seen.has(key.toLowerCase())) {
        choices.push({ key, label, selected, raw: rawLine })
        seen.add(key.toLowerCase())
      }
      continue
    }
  }

  const tail = lines.slice(-6).join('\n')
  if (choices.length === 0 && /\b(y\/n|yes\/no|y\/N|Y\/n)\b/i.test(tail)) {
    choices.push({ key: 'y', label: 'yes', raw: 'y' })
    choices.push({ key: 'n', label: 'no', raw: 'n' })
  }

  return choices
}

/** Heuristic for detecting that interactive Claude is stopped at a prompt. */
export function detectClaudeAwaitingInput(screen: string, currentCommand?: string): boolean {
  const lines = lastMeaningfulLines(screen)
  const tail = lines.slice(-8).join('\n')
  const last = lines[lines.length - 1] ?? ''
  if (parseClaudeChoices(screen).length > 0) return true
  if (DEFAULT_AWAITING_PATTERNS.some(pattern => pattern.test(last) || pattern.test(tail))) return true
  if (currentCommand && !CLAUDE_COMMAND_NAMES.has(currentCommand)) return false
  return false
}
