import {
  requireEnv,
  describeWithRequirements,
  createAGIContainer,
} from './helpers'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, realpathSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

const openaiKey = requireEnv('OPENAI_API_KEY')

/**
 * Memory assistant eval — runs a REAL assistant through the failure mode the
 * memory redesign exists to fix: a fact is learned in one session, corrected
 * in a second, and must be recalled correctly in a third. Each session is a
 * fresh assistant instance (no conversation carryover) sharing one memory db.
 *
 * Graded on three things:
 *   1. Does the assistant store facts it is told? (write diligence)
 *   2. When the user corrects a fact, does the stale memory actually get
 *      retired — superseded or retracted, not left active? (the correction
 *      intent — this is the metric the old design could not pass)
 *   3. Does a later session answer from the corrected fact? (end-to-end truth)
 *
 * Run with: LUCA_MEMORY_EVAL=1 bun test ./test-integration/memory-assistant-eval.test.ts
 * Model override: LUCA_EVAL_MODEL (default gpt-4o-mini).
 * Endpoint override: LUCA_EVAL_BASE_URL points the assistant at any
 * OpenAI-compatible server (vLLM, llama-server, Ollama) — no api key needed.
 * Embeddings: LUCA_EVAL_EMBEDDINGS=local uses the resident llama-server
 * (required when the chat endpoint doesn't serve embeddings).
 */
const evalGate = requireEnv('LUCA_MEMORY_EVAL')

const BASE_URL = process.env.LUCA_EVAL_BASE_URL
const MODEL = process.env.LUCA_EVAL_MODEL || 'gpt-4o-mini'
const EMBEDDINGS = (process.env.LUCA_EVAL_EMBEDDINGS as 'local' | 'openai') || (BASE_URL ? 'local' : 'openai')
const SESSION_TIMEOUT = 180_000

// A custom endpoint needs no OpenAI key; the default path does.
const backend = BASE_URL ? { value: BASE_URL } : openaiKey

describeWithRequirements('Memory Assistant Eval', [backend, evalGate], () => {
  let tempDir: string
  let assistantDir: string
  let dbPath: string
  const score: Record<string, unknown> = { model: MODEL, baseURL: BASE_URL ?? 'openai', embeddings: EMBEDDINGS }

  beforeAll(() => {
    tempDir = realpathSync(mkdtempSync(join(tmpdir(), 'luca-memory-eval-')))
    assistantDir = join(tempDir, 'assistants', 'memory-eval')
    mkdirSync(assistantDir, { recursive: true })
    writeFileSync(
      join(assistantDir, 'CORE.md'),
      'You are a personal assistant with long-term memory. Be concise and direct.'
    )
    dbPath = join(tempDir, 'memory-eval.db')
  })

  afterAll(() => {
    console.log('\n=== memory eval scorecard ===')
    console.log(JSON.stringify(score, null, 2))
    rmSync(tempDir, { recursive: true, force: true })
  })

  /** One fresh session: new container, new assistant, same memory database. */
  async function session(message: string) {
    const container = createAGIContainer({ cwd: tempDir })
    const mem = container.feature('memory', { dbPath, namespace: 'memory-eval', embeddingProvider: EMBEDDINGS })
    const assistant = container.feature('assistant', {
      folder: assistantDir,
      model: MODEL,
      historyMode: 'lifecycle',
      ...(BASE_URL ? { clientOptions: { baseURL: BASE_URL, apiKey: process.env.OPENAI_API_KEY || 'none' } } : {}),
    })
    assistant.use(mem)
    await assistant.start()
    const reply = await assistant.ask(message)
    await (mem as any).ensureDb()
    return { reply, mem, db: (mem as any).db }
  }

  it(
    'session 1: stores the facts it is told',
    async () => {
      const { mem } = await session(
        'Hey! Some context about me: I use codex as my coding provider, I live in Austin, and my app deploys to fly.io.'
      )
      const stored = await mem.count()
      score.session1_factsStored = stored
      expect(stored).toBeGreaterThan(0)
    },
    SESSION_TIMEOUT
  )

  it(
    'session 2: a correction retires the stale memory instead of piling on',
    async () => {
      const { db, reply } = await session(
        'Update for you: I switched my coding provider from codex to claude-code last week.'
      )
      score.session2_reply = reply

      const retired = await db.query(
        "SELECT COUNT(*) as c FROM memories WHERE namespace = 'memory-eval' AND status IN ('superseded', 'retracted', 'consolidated')"
      )
      const activeCodex = await db.query(
        "SELECT document FROM memories WHERE namespace = 'memory-eval' AND status = 'active' AND document LIKE '%codex%' AND document NOT LIKE '%claude%'"
      )
      score.session2_staleRowsRetired = retired[0].c
      score.session2_activeCodexOnlyRows = activeCodex.map((r: any) => r.document)

      // The metric the old design could not pass: the outdated belief must
      // actually leave the active set, not coexist with its correction.
      expect(retired[0].c).toBeGreaterThan(0)
      expect(activeCodex.length).toBe(0)
    },
    SESSION_TIMEOUT
  )

  it(
    'session 3: answers from the corrected fact',
    async () => {
      const { reply } = await session(
        'Quick check: which coding provider do I use these days?'
      )
      score.session3_finalAnswer = reply
      expect(reply.toLowerCase()).toContain('claude')
    },
    SESSION_TIMEOUT
  )
})
