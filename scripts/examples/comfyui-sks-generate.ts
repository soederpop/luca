import container from '@/node'
import '@/clients/comfyui'

const comfyui = container.client('comfyui', {
  baseURL: 'https://8bwb9v7oc9ao4h-8188.proxy.runpod.net',
})

// This is already in API format so it goes straight to /prompt
const workflow = JSON.parse(
  await Bun.file(new URL('../../comfy-ui/simple-checkpoint-workflow.json', import.meta.url)).text()
)

console.log('Queuing workflow with sks-juggernaut-3000...')

const result = await comfyui.runWorkflow(workflow, {
  '3': { text: 'sks woman, sitting on a bench in a tuscan vineyard, looking at the camera, smiling' },
  '4': { text: 'low quality, blurry, deformed, ugly, bad anatomy' },
  '6': { seed: Math.floor(Math.random() * 2 ** 32) },
}, {
  outputDir: './output',
  poll: true,
  pollInterval: 2000,
})

console.log(`Done! prompt_id: ${result.promptId}`)
console.log(`Images:`, result.images?.map(i => i.localPath ?? i.filename))
