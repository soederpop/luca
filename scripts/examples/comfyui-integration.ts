import container from '@/node'
import '@/clients/comfyui'

const comfyui = container.client('comfyui')

const models = await comfyui.getModels("loras")

console.log(models)
