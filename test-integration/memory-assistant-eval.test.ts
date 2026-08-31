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
 * Memory assistant eval — runs a REAL assistant through the failure modes the
 * memory redesign exists to fix. Every scenario is a sequence of sessions;
 * each session is a FRESH assistant instance (no conversation carryover)
 * sharing one memory database, so anything that survives between sessions
 * survived through memory alone.
 *
 * Scenarios grade the taught gardening workflow, not just final answers:
 * did a correction actually retire the stale belief, did a re-affirmation
 * strengthen instead of duplicate, did a targeted forget avoid collateral
 * damage, and did unrelated facts survive untouched.
 *
 * Run with: LUCA_MEMORY_EVAL=1 bun test ./test-integration/memory-assistant-eval.test.ts
 * Model override: LUCA_EVAL_MODEL (default gpt-4o-mini).
 * Endpoint override: LUCA_EVAL_BASE_URL points the assistant at any
 * OpenAI-compatible server (vLLM, llama-server, Ollama) — no api key needed.
 * Embeddings: LUCA_EVAL_EMBEDDINGS=local uses the resident llama-server
 * (default when a custom endpoint is set, since vLLM chat servers rarely
 * serve embeddings).
 * Repetition: LUCA_EVAL_RUNS runs every scenario N times (default 1) and the
 * scorecard reports per-check pass rates — single runs prove plumbing,
 * repeated runs measure reliability.
 */
const evalGate = requireEnv('LUCA_MEMORY_EVAL')

const BASE_URL = process.env.LUCA_EVAL_BASE_URL
const MODEL = process.env.LUCA_EVAL_MODEL || 'gpt-4o-mini'
const EMBEDDINGS = (process.env.LUCA_EVAL_EMBEDDINGS as 'local' | 'openai') || (BASE_URL ? 'local' : 'openai')
const RUNS = Number(process.env.LUCA_EVAL_RUNS || 1)
/** Comma-separated scenario-name filter for cheap iteration (LUCA_EVAL_SCENARIO=confirmation-strengthens). */
const SCENARIO_FILTER = process.env.LUCA_EVAL_SCENARIO?.split(',').map(s => s.trim())
const SCENARIO_TIMEOUT = 300_000

// A custom endpoint needs no OpenAI key; the default path does.
const backend = BASE_URL ? { value: BASE_URL } : openaiKey

type Check = { pass: boolean; detail?: unknown; soft?: boolean }
type GradeContext = {
  replies: string[]
  /** Raw SQL over the scenario's memory db (already initialized). */
  query: (sql: string) => Promise<any[]>
}

interface Scenario {
  name: string
  sessions: string[]
  grade: (ctx: GradeContext) => Promise<Record<string, Check>>
}

const SCENARIOS: Scenario[] = [
  {
    // The headline failure of the old design: a corrected fact must replace
    // the stale one, and unrelated facts must not be collateral damage.
    name: 'direct-correction',
    sessions: [
      'Hey! Some context about me: I use codex as my coding provider, I live in Austin, and my app deploys to fly.io.',
      'Update for you: I switched my coding provider from codex to claude-code last week.',
      'Quick check: which coding provider do I use these days?',
      'And remind me — which city do I live in?',
    ],
    async grade({ replies, query }) {
      const total = await query("SELECT COUNT(*) as c FROM memories")
      const retired = await query("SELECT COUNT(*) as c FROM memories WHERE status IN ('superseded', 'retracted', 'consolidated')")
      const staleActive = await query("SELECT document FROM memories WHERE status = 'active' AND document LIKE '%codex%' AND document NOT LIKE '%claude%'")
      return {
        factsStored: { pass: total[0].c >= 2, detail: total[0].c },
        staleBeliefRetired: { pass: retired[0].c >= 1, detail: retired[0].c },
        noActiveStaleBelief: { pass: staleActive.length === 0, detail: staleActive.map((r: any) => r.document) },
        recallsCorrectedFact: { pass: replies[2]!.toLowerCase().includes('claude'), detail: replies[2] },
        unrelatedFactSurvives: { pass: replies[3]!.toLowerCase().includes('austin'), detail: replies[3] },
      }
    },
  },
  {
    // Same correction, but phrased as venting rather than an announcement —
    // the assistant has to recognize an implicit "no longer true".
    name: 'oblique-correction',
    sessions: [
      'For reference: I do all my coding with codex.',
      'Ugh, codex has been driving me crazy all week. I finally gave up and moved everything over to claude-code yesterday.',
      'Which coding tool am I using now?',
    ],
    async grade({ replies, query }) {
      const retired = await query("SELECT COUNT(*) as c FROM memories WHERE status IN ('superseded', 'retracted', 'consolidated')")
      const staleActive = await query("SELECT document FROM memories WHERE status = 'active' AND document LIKE '%codex%' AND document NOT LIKE '%claude%'")
      return {
        staleBeliefRetired: { pass: retired[0].c >= 1, detail: retired[0].c },
        noActiveStaleBelief: { pass: staleActive.length === 0, detail: staleActive.map((r: any) => r.document) },
        recallsCorrectedFact: { pass: replies[2]!.toLowerCase().includes('claude'), detail: replies[2] },
      }
    },
  },
  {
    // A re-affirmed fact should strengthen the existing memory, not pile up
    // a duplicate row.
    name: 'confirmation-strengthens',
    sessions: [
      'Good morning! Fun fact about me: I drink an oat milk latte every single day.',
      "Just finished my oat milk latte — still my daily ritual, in case you're keeping track.",
      "What's my daily drink?",
    ],
    async grade({ replies, query }) {
      const active = await query("SELECT id, confirmations FROM memories WHERE status = 'active' AND (document LIKE '%oat%' OR document LIKE '%latte%')")
      const maxConfirmations = Math.max(0, ...active.map((r: any) => r.confirmations))
      return {
        noDuplicateRows: { pass: active.length === 1, detail: active.length },
        // Soft: measures model diligence, not memory correctness. Small local
        // models follow the confirmation intent ~50% of the time; recall's
        // usage_count bump already protects re-used facts from decay, so a
        // missed confirmation is a lost strength signal, not corruption.
        confirmationRecorded: { pass: maxConfirmations >= 2, detail: maxConfirmations, soft: true },
        recallsFact: { pass: /oat|latte/i.test(replies[2]!), detail: replies[2] },
      }
    },
  },
  {
    // "Forget X" must retract exactly X: the neighboring fact stays active,
    // and the retraction leaves an audit trail rather than hard-deleting
    // (forgetCategory would nuke both facts and the trail — that's a fail).
    name: 'targeted-forget',
    sessions: [
      'Two things to remember about me: I live in Austin, and my favorite editor is neovim.',
      'Actually, please forget where I live — just drop that from your memory.',
      "What's my favorite editor?",
    ],
    async grade({ replies, query }) {
      const austinActive = await query("SELECT document FROM memories WHERE status = 'active' AND document LIKE '%Austin%'")
      const austinAnywhere = await query("SELECT COUNT(*) as c FROM memories WHERE document LIKE '%Austin%'")
      const editorActive = await query("SELECT COUNT(*) as c FROM memories WHERE status = 'active' AND (document LIKE '%neovim%' OR document LIKE '%editor%')")
      return {
        forgottenFactInactive: { pass: austinActive.length === 0, detail: austinActive.map((r: any) => r.document) },
        auditTrailPreserved: { pass: austinAnywhere[0].c >= 1, detail: austinAnywhere[0].c },
        noCollateralDamage: { pass: editorActive[0].c >= 1, detail: editorActive[0].c },
        recallsSurvivingFact: { pass: /neovim|vim/i.test(replies[2]!), detail: replies[2] },
      }
    },
  },
]

describeWithRequirements('Memory Assistant Eval', [backend, evalGate], () => {
  let tempDir: string
  let assistantDir: string
  // scoreboard[scenario][check] = number of passing runs
  const scoreboard: Record<string, Record<string, number>> = {}
  const failures: string[] = []

  beforeAll(() => {
    tempDir = realpathSync(mkdtempSync(join(tmpdir(), 'luca-memory-eval-')))
    assistantDir = join(tempDir, 'assistants', 'memory-eval')
    mkdirSync(assistantDir, { recursive: true })
    writeFileSync(
      join(assistantDir, 'CORE.md'),
      'You are a personal assistant with long-term memory. Be concise and direct.'
    )
  })

  afterAll(() => {
    console.log(`\n=== memory eval scorecard (model=${MODEL}, endpoint=${BASE_URL ?? 'openai'}, embeddings=${EMBEDDINGS}, runs=${RUNS}) ===`)
    for (const [scenario, checks] of Object.entries(scoreboard)) {
      console.log(`\n${scenario}`)
      for (const [check, passes] of Object.entries(checks)) {
        console.log(`  ${passes === RUNS ? '✓' : '✗'} ${check}: ${passes}/${RUNS}`)
      }
    }
    if (failures.length) {
      console.log('\nfailed checks (first detail each):')
      for (const f of failures) console.log(`  - ${f}`)
    }
    console.log()
    rmSync(tempDir, { recursive: true, force: true })
  })

  /** One fresh session: new container, new assistant, one shared memory db. */
  async function session(message: string, dbPath: string) {
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
    return { reply, mem }
  }

  const activeScenarios = SCENARIO_FILTER
    ? SCENARIOS.filter(s => SCENARIO_FILTER.includes(s.name))
    : SCENARIOS

  for (let run = 1; run <= RUNS; run++) {
    for (const scenario of activeScenarios) {
      it(
        `${scenario.name} (run ${run}/${RUNS})`,
        async () => {
          const dbPath = join(tempDir, `${scenario.name}-run${run}.db`)

          const replies: string[] = []
          let lastMem: any
          for (const message of scenario.sessions) {
            const { reply, mem } = await session(message, dbPath)
            replies.push(reply)
            lastMem = mem
          }

          await lastMem.ensureDb()
          const query = (sql: string) => lastMem.db.query(sql)
          const checks = await scenario.grade({ replies, query })

          scoreboard[scenario.name] ??= {}
          const failed: string[] = []
          for (const [name, check] of Object.entries(checks)) {
            scoreboard[scenario.name]![name] = (scoreboard[scenario.name]![name] ?? 0) + (check.pass ? 1 : 0)
            if (!check.pass) {
              if (!check.soft) failed.push(name)
              failures.push(`${scenario.name}/${name}${check.soft ? ' (soft)' : ''}: ${JSON.stringify(check.detail)}`)
            }
          }

          expect(failed).toEqual([])
        },
        SCENARIO_TIMEOUT
      )
    }
  }
})
