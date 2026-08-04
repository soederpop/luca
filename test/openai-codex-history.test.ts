import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { AGIContainer } from '../src/agi/container.server'
import os from 'os'
import { join } from 'path'
import { mkdirSync, writeFileSync, rmSync } from 'fs'

const base = join(os.tmpdir(), `luca-codex-history-${Date.now()}-${Math.random().toString(36).slice(2)}`)
const codexHome = join(base, '.codex')

const SESSION_A = '019f0000-0000-7000-8000-00000000000a'
const SESSION_B = '019f0000-0000-7000-8000-00000000000b'
const CWD_A = '/tmp/project-a'
const CWD_B = '/tmp/project-b'

function jsonl(records: any[]): string {
  return records.map(r => JSON.stringify(r)).join('\n') + '\n'
}

let container: AGIContainer
let priorCodexHome: string | undefined

beforeAll(() => {
  priorCodexHome = process.env.CODEX_HOME
  process.env.CODEX_HOME = codexHome

  // Session A — new-format rollout (session_id key) with a full conversation
  const dirA = join(codexHome, 'sessions', '2026', '08', '01')
  mkdirSync(dirA, { recursive: true })
  writeFileSync(join(dirA, `rollout-2026-08-01T10-00-00-${SESSION_A}.jsonl`), jsonl([
    { timestamp: '2026-08-01T10:00:00.000Z', type: 'session_meta', payload: { session_id: SESSION_A, timestamp: '2026-08-01T10:00:00.000Z', cwd: CWD_A, originator: 'codex_exec', source: 'exec', cli_version: '0.145.0' } },
    { timestamp: '2026-08-01T10:00:01.000Z', type: 'event_msg', payload: { type: 'task_started', turn_id: 't1' } },
    { timestamp: '2026-08-01T10:00:02.000Z', type: 'response_item', payload: { type: 'message', role: 'developer', content: [{ type: 'input_text', text: 'injected harness context' }] } },
    { timestamp: '2026-08-01T10:00:03.000Z', type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'Fix the websocket reconnect bug' }] } },
    { timestamp: '2026-08-01T10:00:04.000Z', type: 'response_item', payload: { type: 'reasoning', summary: [{ type: 'summary_text', text: 'Looking at reconnect logic' }] } },
    { timestamp: '2026-08-01T10:00:05.000Z', type: 'response_item', payload: { type: 'custom_tool_call', name: 'exec', input: 'grep -r reconnect src/' } },
    { timestamp: '2026-08-01T10:00:06.000Z', type: 'response_item', payload: { type: 'custom_tool_call_output', output: 'src/ws.ts: reconnect()' } },
    { timestamp: '2026-08-01T10:00:07.000Z', type: 'response_item', payload: { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'Fixed the reconnect bug in src/ws.ts' }] } },
    'this line is not json',
  ] as any[]).replace('"this line is not json"', 'this line is not json'))

  // Session B — old-format rollout (id key, no session_id) in a different cwd
  const dirB = join(codexHome, 'sessions', '2026', '03', '15')
  mkdirSync(dirB, { recursive: true })
  writeFileSync(join(dirB, `rollout-2026-03-15T08-00-00-${SESSION_B}.jsonl`), jsonl([
    { timestamp: '2026-03-15T08:00:00.000Z', type: 'session_meta', payload: { id: SESSION_B, timestamp: '2026-03-15T08:00:00.000Z', cwd: CWD_B, originator: 'codex_cli_rs', cli_version: '0.110.0' } },
    { timestamp: '2026-03-15T08:00:01.000Z', type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'Hello from the old format' }] } },
  ]))

  writeFileSync(join(codexHome, 'session_index.jsonl'), jsonl([
    { id: SESSION_A, thread_name: 'Fix websocket reconnect', updated_at: '2026-08-01T10:05:00.000Z' },
  ]))

  writeFileSync(join(codexHome, 'history.jsonl'), jsonl([
    { session_id: SESSION_A, ts: 1754042400, text: 'Fix the websocket reconnect bug' },
    { session_id: SESSION_B, ts: 1742025600, text: 'Hello from the old format' },
  ]))

  container = new AGIContainer()
})

afterAll(() => {
  if (priorCodexHome === undefined) delete process.env.CODEX_HOME
  else process.env.CODEX_HOME = priorCodexHome
  rmSync(base, { recursive: true, force: true })
})

describe('openaiCodex session history mining', () => {
  it('honors CODEX_HOME for codexHome', () => {
    const codex = container.feature('openaiCodex')
    expect(codex.codexHome).toBe(codexHome)
  })

  it('lists sessions newest-first with metadata from both rollout formats', async () => {
    const codex = container.feature('openaiCodex')
    const sessions = await codex.listHistorySessions()

    expect(sessions.length).toBe(2)
    expect(sessions[0]!.sessionId).toBe(SESSION_A)
    expect(sessions[0]!.cwd).toBe(CWD_A)
    expect(sessions[0]!.cliVersion).toBe('0.145.0')
    expect(sessions[0]!.threadName).toBe('Fix websocket reconnect')
    // old format resolves the id key and has no index entry
    expect(sessions[1]!.sessionId).toBe(SESSION_B)
    expect(sessions[1]!.threadName).toBeUndefined()
  })

  it('filters by cwd and applies limit', async () => {
    const codex = container.feature('openaiCodex')
    const forB = await codex.listHistorySessions({ cwd: CWD_B })
    expect(forB.map(s => s.sessionId)).toEqual([SESSION_B])

    const limited = await codex.listHistorySessions({ limit: 1 })
    expect(limited.length).toBe(1)
  })

  it('reads full conversation history and skips malformed lines', async () => {
    const codex = container.feature('openaiCodex')
    const records = await codex.getConversationHistory(SESSION_A)
    expect(records.length).toBe(8) // 9 lines minus the malformed one
    expect(records[0].type).toBe('session_meta')

    expect(await codex.getConversationHistory('not-a-real-session')).toEqual([])
  })

  it('renders session history to markdown', async () => {
    const codex = container.feature('openaiCodex')
    const md = await codex.sessionHistoryToMarkdown(SESSION_A)

    expect(md).toContain('# Codex Session History')
    expect(md).toContain(`**Session ID:** \`${SESSION_A}\``)
    expect(md).toContain(`**Working Directory:** \`${CWD_A}\``)
    expect(md).toContain('### User')
    expect(md).toContain('Fix the websocket reconnect bug')
    expect(md).toContain('### Assistant')
    expect(md).toContain('Fixed the reconnect bug in src/ws.ts')
    expect(md).toContain('**Tool Use:** `exec`')
    expect(md).toContain('*Looking at reconnect logic*')
    // developer messages are harness context, not conversation
    expect(md).not.toContain('injected harness context')
  })

  it('uses the most recent session when no source is given', async () => {
    const codex = container.feature('openaiCodex')
    const md = await codex.sessionHistoryToMarkdown()
    expect(md).toContain(SESSION_A)
  })

  it('searches user prompts across sessions, newest first', async () => {
    const codex = container.feature('openaiCodex')
    const hits = await codex.searchUserPrompts('websocket')
    expect(hits.length).toBe(1)
    expect(hits[0]!.sessionId).toBe(SESSION_A)

    const all = await codex.searchUserPrompts('', { limit: 10 })
    expect(all.length).toBe(2)
    expect(all[0]!.ts).toBeGreaterThan(all[1]!.ts)
  })
})

describe('fs.readFirstLineAsync', () => {
  it('reads only the first line of a large file', async () => {
    const fs = container.feature('fs')
    const file = join(base, 'big.jsonl')
    writeFileSync(file, `{"header":true}\n${'x'.repeat(1024 * 1024)}\n`)
    expect(await fs.readFirstLineAsync(file)).toBe('{"header":true}')
  })

  it('returns the whole content when there is no newline', async () => {
    const fs = container.feature('fs')
    const file = join(base, 'noline.txt')
    writeFileSync(file, 'single line no newline')
    expect(await fs.readFirstLineAsync(file)).toBe('single line no newline')
  })

  it('strips a trailing carriage return', async () => {
    const fs = container.feature('fs')
    const file = join(base, 'crlf.txt')
    writeFileSync(file, 'first\r\nsecond\r\n')
    expect(await fs.readFirstLineAsync(file)).toBe('first')
  })
})
