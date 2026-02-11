/**
 * Avatar generation workflow and prompt templates.
 *
 * For now this exports mock generation logic with stock images.
 * When ComfyUI is wired up, this will export the API-format workflow
 * and input mapping for comfyui.runWorkflow().
 */

export type PortraitPrompt = {
  positive: string
  negative: string
  seed: number
}

export type AvatarImage = {
  index: number
  filename: string
  url: string
  prompt: string
  seed: number
}

const BASE_NEGATIVE = 'low quality, blurry, deformed, ugly, bad anatomy, disfigured, poorly drawn face, mutation, extra limbs, text, watermark'

/** Generate 4 diverse portrait prompts with random seeds */
export function generatePortraitPrompts(): PortraitPrompt[] {
  return [
    {
      positive: 'portrait photograph of a young woman with dark curly hair, warm smile, natural lighting, professional headshot, sharp focus, detailed skin texture, bokeh background, 8k, masterpiece',
      negative: BASE_NEGATIVE,
      seed: Math.floor(Math.random() * 2147483647),
    },
    {
      positive: 'portrait photograph of a middle-aged man with short gray hair and beard, confident expression, studio lighting, professional headshot, sharp focus, detailed skin texture, clean background, 8k, masterpiece',
      negative: BASE_NEGATIVE,
      seed: Math.floor(Math.random() * 2147483647),
    },
    {
      positive: 'portrait photograph of a young person with freckles and auburn hair, thoughtful expression, golden hour lighting, professional headshot, sharp focus, detailed skin texture, soft background, 8k, masterpiece',
      negative: BASE_NEGATIVE,
      seed: Math.floor(Math.random() * 2147483647),
    },
    {
      positive: 'portrait photograph of a person with dark skin and short natural hair, bright eyes, warm expression, rim lighting, professional headshot, sharp focus, detailed skin texture, gradient background, 8k, masterpiece',
      negative: BASE_NEGATIVE,
      seed: Math.floor(Math.random() * 2147483647),
    },
  ]
}

// ── ComfyUI API-format workflow (for when we wire up real generation) ──

export const PORTRAIT_INPUT_MAP = {
  positive_prompt: { nodeId: '3', field: 'text' },
  negative_prompt: { nodeId: '4', field: 'text' },
  seed: { nodeId: '6', field: 'seed' },
  model: { nodeId: '1', field: 'unet_name' },
  width: { nodeId: '5', field: 'width' },
  height: { nodeId: '5', field: 'height' },
}

export function buildPortraitWorkflow(opts: {
  model: string
  clipL?: string
  clipG?: string
  vae?: string
  positivePrompt?: string
  negativePrompt?: string
  seed?: number
  width?: number
  height?: number
  steps?: number
  cfg?: number
}) {
  return {
    '1': {
      class_type: 'UNETLoader',
      inputs: { unet_name: opts.model, weight_dtype: 'default' },
    },
    '2': {
      class_type: 'DualCLIPLoader',
      inputs: {
        clip_name1: opts.clipL ?? 'clip_l.safetensors',
        clip_name2: opts.clipG ?? 'clip_g.safetensors',
        type: 'sdxl',
      },
    },
    '3': {
      class_type: 'CLIPTextEncode',
      inputs: { text: opts.positivePrompt ?? '', clip: ['2', 0] },
    },
    '4': {
      class_type: 'CLIPTextEncode',
      inputs: { text: opts.negativePrompt ?? '', clip: ['2', 0] },
    },
    '5': {
      class_type: 'EmptyLatentImage',
      inputs: { width: opts.width ?? 768, height: opts.height ?? 1024, batch_size: 1 },
    },
    '6': {
      class_type: 'KSampler',
      inputs: {
        model: ['1', 0],
        positive: ['3', 0],
        negative: ['4', 0],
        latent_image: ['5', 0],
        seed: opts.seed ?? 42,
        control_after_generate: 'randomize',
        steps: opts.steps ?? 30,
        cfg: opts.cfg ?? 7.0,
        sampler_name: 'euler',
        scheduler: 'normal',
        denoise: 1.0,
      },
    },
    '7': {
      class_type: 'VAELoader',
      inputs: { vae_name: opts.vae ?? 'sdxl_vae.safetensors' },
    },
    '8': {
      class_type: 'VAEDecode',
      inputs: { samples: ['6', 0], vae: ['7', 0] },
    },
    '9': {
      class_type: 'SaveImage',
      inputs: { images: ['8', 0], filename_prefix: 'avatar' },
    },
  }
}
