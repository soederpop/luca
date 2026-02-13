import { Client, type ClientsInterface, RestClient } from '@/client'
import { Container } from '@/container'
import { z } from 'zod'
import { ClientStateSchema } from '@/schemas/base.js'

declare module '@/client' {
  interface AvailableClients {
    sdWebUi: typeof SDWebUIClient
  }
}

export type Samplers =
  | 'Euler a'
  | 'Euler'
  | 'LMS'
  | 'Heun'
  | 'DPM2'
  | 'DPM2 a'
  | 'DPM++ 2S a'
  | 'DPM++ 2M'
  | 'DPM++ SDE'
  | 'DPM fast'
  | 'DPM adaptive'
  | 'LMS Karras'
  | 'DPM2 Karras'
  | 'DPM2 a Karras'
  | 'DPM++ 2S a Karras'
  | 'DPM++ 2M Karras'
  | 'DPM++ SDE Karras'
  | 'DDIM'
  | 'PLMS'
  | 'UniPC'

export type TextToImageOptions = {
  prompt?: string
  count?: number
  negativePrompt?: string
  sampler?: Samplers
  cfgScale?: number
  steps?: number
  clipSkip?: number
  saveImages?: boolean
  noGrid?: boolean
  noSamples?: boolean
  width?: number
  height?: number
  seed?: number
  batchSize?: number
  debug?: boolean
  varSeed?: number
  varStrength?: number
  model?: string
  applySettings?: boolean
  sendImages?: boolean
  restoreFaces?: boolean
}

export type Img2ImgOptions = Omit<TextToImageOptions, 'restoreFaces'> & {
  denoisingStrength?: number
  mask?: string
  maskBlur?: number
  inpaintingFill?: number
  inpaintFullRes?: boolean
  inpaintPadding?: number
  invertMask?: boolean
  initialNoiseMultiplier?: number
  seedResizeFromW?: number
  seedResizeFromH?: number
}

export type Img2ImgResponse = TextToImageResponse

export const SDWebUIClientStateSchema = ClientStateSchema.extend({
  checkpoints: z.array(z.string()).default([]),
})

export type SDWebUIClientState = z.infer<typeof SDWebUIClientStateSchema>

export class SDWebUIClient<T extends SDWebUIClientState> extends RestClient<T> {

  // @ts-ignore
  static attach(container: Container & ClientsInterface, options?: any) {
    // @ts-ignore-next-line
    container.clients.register('sdWebUi', SDWebUIClient)
  }

  // Updated to use available API endpoint for predictions
  async textToImage(options: TextToImageOptions): Promise<TextToImageResponse> {
    const {
      saveImages = true,
      batchSize = 1,
      seed = -1,
      width = 512,
      height = 512,
      count = 1,
      noGrid = true,
      noSamples = true,
      varSeed = -1,
      varStrength = 0.0,
      negativePrompt = '',
      clipSkip = 0,
      sampler = 'Euler a',
      steps = 20,
      cfgScale = 7,
      applySettings = false,
      sendImages = true,
      restoreFaces = false,
    } = options

    if (!options?.prompt?.length) {
      throw new Error(`Must supply a prompt`)
    }

    const { prompt, model } = options

    const payload = {
      data: [
        prompt,
        negativePrompt,
        cfgScale,
        sampler,
        steps,
        height,
        width,
        seed,
        count,
        batchSize,
        restoreFaces,
        saveImages,
        sendImages,
        // @ts-ignore
        ...(model! && [model]),
        // @ts-ignore
        ...(clipSkip > 0 && [clipSkip]),
        // @ts-ignore
        ...(varSeed > -1 && [varSeed]),
        // @ts-ignore
        ...(varStrength > 0 && [varStrength])
      ],
      fn_index: 0 // Assuming txt2img is function index 0
    }

    console.log("txtToImage via API", payload)
    
    // Use the available /api/{api_name} endpoint
    const response = await this.axios
      .post(`/api/txt2img`, payload)
      .then((resp) => resp.data)

    return response
  }

  // Updated to use available API endpoint for predictions  
  async img2img(image: string, options: Img2ImgOptions): Promise<Img2ImgResponse> {
    const {
      saveImages = false,
      batchSize = 1,
      seed = -1,
      width = 512,
      mask = null,
      height = 512,
      count = 1,
      noGrid = true,
      noSamples = true,
      varSeed = -1,
      varStrength = 0.0,
      negativePrompt = '',
      prompt = '',
      clipSkip = 0,
      sampler = 'Euler a',
      steps = 20,
      cfgScale = 7,
      applySettings = false,
      sendImages = true,
      denoisingStrength = 0.50,
      maskBlur = 4,
      inpaintingFill = 1,
      inpaintFullRes = false,
      inpaintPadding = 4,
      invertMask = false,
      initialNoiseMultiplier = 0,
      seedResizeFromW = 0,
      seedResizeFromH = 0,
    } = options

    const { model } = options

    const payload = {
      data: [
        image,
        prompt,
        negativePrompt,
        denoisingStrength,
        cfgScale,
        sampler,
        steps,
        height,
        width,
        seed,
        count,
        batchSize,
        // @ts-ignore
        saveImages,
        sendImages,
        // @ts-ignore
        ...(mask && [mask, maskBlur]),
        // @ts-ignore
        ...(model && [model]),
        // @ts-ignore
        ...(clipSkip > 0 && [clipSkip])
      ],
      fn_index: 1 // Assuming img2img is function index 1
    }

    console.log("Img2Img via API", payload)

    // Use the available /api/{api_name} endpoint
    const data = await this.post('/api/img2img', payload)
    
    return data
  }

  // Updated to use available progress endpoint
  async getProgress({ save = false, image = false }: { save?: boolean; image?: boolean } = {}): Promise<ProgressInfo> {
    // Use the available internal progress endpoint
    const payload = {
      id_task: 'current', // May need to be adjusted based on actual API
      live_preview: image,
      id_live_preview: -1
    }

    const resp = await this.axios.post('/internal/progress', payload).then((r) => r.data)

    if (image) {
      return resp
    } else {
      return {
        ...resp,
        current_image: null
      }
    }
  }

  // These methods may not be available in the current API spec
  async interrupt() {
    throw new Error('Interrupt functionality not available in current API specification')
  }

  async skip() {
    throw new Error('Skip functionality not available in current API specification')
  }

  // Updated to use available config endpoint
  async listCheckpoints(refresh = false): Promise<string[]> {
    if (this.state.get('checkpoints')?.length && !refresh) {
      return this.state.get('checkpoints')!
    }

    const data = await this.getWebUiConfig()
    const checkpoints = (
      data.components.find(
        (c: any) => c.props.elem_id === 'setting_sd_model_checkpoint' && c.type === 'dropdown'
      )?.props?.choices || []
    )

    this.state.set('checkpoints', checkpoints)
    return checkpoints
  }

  // Updated to use file upload endpoint for upscaling
  async upscaleImage(image: string, options: any) {
    // Convert base64 image to form data for upload
    const formData = new FormData()
    const blob = this.base64ToBlob(image)
    formData.append('files', blob, 'image.png')

    // Upload the file first
    const uploadResp = await this.axios.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })

    // Then use the prediction API for upscaling
    const payload = {
      data: [
        uploadResp.data, // File path from upload
        options.scale || 2,
        options.width || 512,
        options.height || 512,
        options.gfpgan || 0,
        options.codeformer || 0
      ],
      fn_index: 2 // Assuming upscale is function index 2
    }

    return this.post('/api/upscale', payload)
  }

  // Utility method to convert base64 to blob
  private base64ToBlob(base64: string): Blob {
    const byteCharacters = atob(base64.split(',')[1] || base64)
    const byteNumbers = new Array(byteCharacters.length)
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i)
    }
    const byteArray = new Uint8Array(byteNumbers)
    return new Blob([byteArray], { type: 'image/png' })
  }

  // Image info would need to be handled through file upload + prediction
  async getImageInfo({ image }: { image: Buffer }) {
    // Convert buffer to form data
    const formData = new FormData()
    const blob = new Blob([image], { type: 'image/png' })
    formData.append('files', blob, 'image.png')

    // Upload the file first
    const uploadResp = await this.axios.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })

    // Then use prediction API to get info
    const payload = {
      data: [uploadResp.data],
      fn_index: 3 // Assuming image info is function index 3
    }

    const resp = await this.post('/api/png_info', payload)

    // Parse the response (format may differ from original)
    const details = resp.data.split('\n')
    const prompt = details[0]
    const negative = details[1]?.replace('Negative prompt:', '') || ''
    const config = details[2] || ''
    
    const pairs = Object.fromEntries(
      config.split(',').map((v: string) =>
        v
          .trim()
          .split(':')
          .map((v) => v.trim())
      )
    )

    return {
      prompt,
      negativePrompt: negative,
      cfgScale: Number(pairs['CFG scale']) || 7,
      steps: Number(pairs['Steps']) || 20,
      sampler: pairs['Sampler'] || 'Euler a',
      seed: Number(pairs['Seed'] || -1),
      varSeed: Number(pairs['Variation seed'] || -1),
      varStrength: Number(pairs['Variation seed strength'] || 0),
      height: Number(pairs['Size']?.split('x')[1]) || 512,
      width: Number(pairs['Size']?.split('x')[0]) || 512,
    }
  }

  // Keep existing config methods as they use available endpoints
  async getSdConfig() {
    return this.axios.get('/config').then((r) => r.data)
  }

  async getWebUiConfig() {
    return this.axios.get('/config').then((r) => r.data)
  }

  // These methods are not available in the current API spec
  async refreshCheckpoints() {
    throw new Error('Refresh checkpoints functionality not available in current API specification')
  }

  async getEmbeddings() {
    throw new Error('Embeddings functionality not available in current API specification')
  }

  async getHyperNetworks() {
    throw new Error('HyperNetworks functionality not available in current API specification')
  }
}

export default SDWebUIClient

// Keep existing type definitions
type Parameters = {
  enable_hr: boolean
  denoising_strength: number
  firstphase_width: number
  firstphase_height: number
  hr_scale: number
  hr_upscaler: null
  hr_second_pass_steps: number
  hr_resize_x: number
  hr_resize_y: number
  prompt: string
  styles: null
  seed: number
  subseed: number
  subseed_strength: number
  seed_resize_from_h: number
  seed_resize_from_w: number
  sampler_name: string
  batch_size: number
  n_iter: number
  steps: number
  cfg_scale: number
  width: number
  height: number
  restore_faces: boolean
  tiling: boolean
  do_not_save_samples: boolean
  do_not_save_grid: boolean
  negative_prompt: string
  eta: null
  s_churn: number
  s_tmax: null
  s_tmin: number
  s_noise: number
  override_settings: Record<string, unknown>
  override_settings_restore_afterwards: boolean
  script_args: string[]
  sampler_index: string
  script_name: null
  send_images: boolean
  save_images: boolean
  alwayson_scripts: Record<string, unknown>
}

export const VALID_OPTIONS = [
  'count',
  'prompt',
  'negativePrompt',
  'sampler',
  'cfgScale',
  'steps',
  'clipSkip',
  'saveImages',
  'noGrid',
  'noSamples',
  'width',
  'height',
  'seed',
  'batchSize',
  'debug',
  'varSeed',
  'varStrength',
  'model',
  'applySettings',
  'sendImages',
  'restoreFaces',
]

type Info = {
  prompt: string
  all_prompts: string[]
  negative_prompt: string
  all_negative_prompts: string[]
  seed: number
  all_seeds: number[]
  subseed: number
  all_subseeds: number[]
  subseed_strength: number
  width: number
  height: number
  sampler_name: string
  cfg_scale: number
  steps: number
  batch_size: number
  restore_faces: boolean
  face_restoration_model: null
  sd_model_hash: string
  seed_resize_from_w: number
  seed_resize_from_h: number
  denoising_strength: number
  extra_generation_params: Record<string, unknown>
  index_of_first_image: number
  infotexts: string[]
  styles: string[]
  job_timestamp: string
  clip_skip: number
  is_using_inpainting_conditioning: boolean
}

export type TextToImageResponse = {
  parameters: Parameters
  info: Info
  images: string[]
}

export type ProgressInfo = {
  progress: number
  eta_relative: number
  state: {
    skipped: boolean
    interrupted: boolean
    job: string
    job_count: number
    job_timestamp: string
    job_no: number
    sampling_step: number
    sampling_steps: number
  }
  current_image: string | null
  textinfo: string
}

export const SAMPLERS = [
  "Euler a",
  "Euler",
  "LMS",
  "Heun",
  "DPM2",
  "DPM2 a",
  "DPM++ 2S a",
  "DPM++ 2M",
  "DPM++ SDE",
  "DPM fast",
  "DPM adaptive",
  "LMS Karras",
  "DPM2 Karras",
  "DPM2 a Karras",
  "DPM++ 2S a Karras",
  "DPM++ 2M Karras",
  "DPM++ SDE Karras",
  "DDIM",
  "PLMS",
  "UniPC"
] as const