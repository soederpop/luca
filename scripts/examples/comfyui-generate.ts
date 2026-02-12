import container from '@/node'
import '@/clients/comfyui'

// ── Edit these ──────────────────────────────────────────────────
const PROMPT = 'a beautiful landscape, masterpiece, best quality, highly detailed'
const NEGATIVE = 'low quality, blurry, deformed, ugly, bad anatomy'
const SEED = 42
const STEPS = 25
const CFG = 7.0
const WIDTH = 1024
const HEIGHT = 1024
// ────────────────────────────────────────────────────────────────

const comfyui = container.client('comfyui')

const workflow = JSON.parse(
  await Bun.file(new URL('../../comfy-ui/simple-comfy-workflow.json', import.meta.url)).text()
)

const result = await comfyui.runWorkflow(workflow, {
  '3': { text: PROMPT },
  '4': { text: NEGATIVE },
  '5': { width: WIDTH, height: HEIGHT },
  '6': { seed: SEED, steps: STEPS, cfg: CFG },
}, {
  outputDir: './output',
  poll: true,
})

console.log(`Done! prompt_id: ${result.promptId}`)
console.log(`Images:`, result.images?.map(i => i.localPath ?? i.filename))
