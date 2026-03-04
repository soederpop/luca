import {
  requireEnv,
  describeWithRequirements,
  createAGIContainer,
  API_TIMEOUT,
} from './helpers'

const runpodKey = requireEnv('RUNPOD_API_KEY')

describeWithRequirements('RunPod Integration', [runpodKey], () => {
  let container: any
  let runpod: any

  beforeAll(() => {
    container = createAGIContainer()
    runpod = container.feature('runpod', {
      apiKey: runpodKey.value,
    })
  })

  it(
    'lists templates (read-only)',
    async () => {
      const templates = await runpod.listTemplates({ includeRunpod: true })
      expect(Array.isArray(templates)).toBe(true)
      expect(templates.length).toBeGreaterThan(0)
    },
    API_TIMEOUT
  )

  it(
    'lists secure GPU availability',
    async () => {
      const gpus = await runpod.listSecureGPUs()
      expect(Array.isArray(gpus)).toBe(true)
      expect(gpus.length).toBeGreaterThan(0)
    },
    API_TIMEOUT
  )

  it(
    'lists network volumes',
    async () => {
      const volumes = await runpod.listVolumes()
      expect(Array.isArray(volumes)).toBe(true)
    },
    API_TIMEOUT
  )

  it(
    'lists existing pods',
    async () => {
      const pods = await runpod.listPods()
      expect(Array.isArray(pods)).toBe(true)
    },
    API_TIMEOUT
  )
})
