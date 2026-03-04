import {
  requireEnv,
  describeWithRequirements,
  createAGIContainer,
  API_TIMEOUT,
} from './helpers'

const elevenLabsKey = requireEnv('ELEVENLABS_API_KEY')

describeWithRequirements('ElevenLabs Integration', [elevenLabsKey], () => {
  let container: any
  let el: any

  beforeAll(async () => {
    container = createAGIContainer()
    el = container.client('elevenlabs', {
      apiKey: elevenLabsKey.value,
    })
    await el.connect()
  })

  it(
    'listVoices returns available voices',
    async () => {
      const voices = await el.listVoices()
      expect(Array.isArray(voices)).toBe(true)
      expect(voices.length).toBeGreaterThan(0)
      expect(voices[0]).toHaveProperty('voice_id')
      expect(voices[0]).toHaveProperty('name')
    },
    API_TIMEOUT
  )

  it(
    'listModels returns available models',
    async () => {
      const models = await el.listModels()
      expect(Array.isArray(models)).toBe(true)
      expect(models.length).toBeGreaterThan(0)
    },
    API_TIMEOUT
  )

  it(
    'synthesize produces audio buffer',
    async () => {
      const audio = await el.synthesize('Hello, integration test.', {
        voiceId: '21m00Tcm4TlvDq8ikWAM', // Rachel
      })
      expect(audio).toBeDefined()
      expect(audio.length).toBeGreaterThan(0)
    },
    API_TIMEOUT
  )
})
