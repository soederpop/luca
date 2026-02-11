import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'
import { Feature, features } from '../feature'
import axios from 'axios'

export const RunpodStateSchema = FeatureStateSchema.extend({})
export type RunpodState = z.infer<typeof RunpodStateSchema>

export const RunpodOptionsSchema = FeatureOptionsSchema.extend({
	apiKey: z.string().optional(),
	dataCenterId: z.string().optional(),
})
export type RunpodOptions = z.infer<typeof RunpodOptionsSchema>

/**
 * Manage RunPod GPU cloud pods: list templates, available GPUs, create and manage pods.
 */
export class Runpod extends Feature<RunpodState, RunpodOptions> {
  static override shortcut = 'features.runpod' as const
  static override stateSchema = RunpodStateSchema
  static override optionsSchema = RunpodOptionsSchema

	get proc() {
		return this.container.feature('proc')
	}

	get apiKey() {
		return this.options.apiKey || process.env.RUNPOD_API_KEY || ''
	}

	get dataCenterId() {
		return this.options.dataCenterId || 'US-TX-3'
	}

	private api(path: string, options: any = {}) {
		return axios({
			baseURL: 'https://rest.runpod.io/v1',
			url: path,
			headers: {
				Authorization: `Bearer ${this.apiKey}`,
				'Content-Type': 'application/json',
			},
			...options,
		}).then(r => r.data)
	}

	async listTemplates(options: { includePublic?: boolean, includeRunpod?: boolean } = {}): Promise<TemplateInfo[]> {
		return this.api('/templates', {
			params: {
				includePublicTemplates: options.includePublic ?? false,
				includeRunpodTemplates: options.includeRunpod ?? true,
			}
		})
	}

	async getTemplate(templateId: string): Promise<TemplateInfo> {
		return this.api(`/templates/${templateId}`)
	}

	async createPod(options: CreatePodOptions): Promise<PodInfo> {
		return this.api('/pods', {
			method: 'POST',
			data: {
				name: options.name ?? 'luca-pod',
				imageName: options.imageName,
				gpuTypeIds: Array.isArray(options.gpuTypeId) ? options.gpuTypeId : [options.gpuTypeId],
				gpuCount: options.gpuCount ?? 1,
				templateId: options.templateId,
				cloudType: options.cloudType ?? 'SECURE',
				containerDiskInGb: options.containerDiskInGb ?? 50,
				volumeInGb: options.volumeInGb ?? 20,
				volumeMountPath: options.volumeMountPath ?? '/workspace',
				ports: options.ports ?? ['8888/http', '22/tcp'],
				env: options.env,
				interruptible: options.interruptible ?? false,
				networkVolumeId: options.networkVolumeId,
				minRAMPerGPU: options.minRAMPerGPU,
			}
		})
	}

	async stopPod(podId: string) {
		return this.api(`/pods/${podId}/stop`, { method: 'POST' })
	}

	async startPod(podId: string) {
		return this.api(`/pods/${podId}/start`, { method: 'POST' })
	}

	async removePod(podId: string) {
		return this.api(`/pods/${podId}`, { method: 'DELETE' })
	}

	/**
	 * Get all pods via REST API
	 */
	async getpods(filters: { name?: string; imageName?: string; desiredStatus?: string } = {}): Promise<RestPodInfo[]> {
		return this.api('/pods', { params: filters })
	}

	/**
	 * Get pod details via REST API (richer than runpodctl output)
	 */
	async getPod(podId: string): Promise<RestPodInfo> {
		return this.api(`/pods/${podId}`)
	}

	/**
	 * Poll until a pod reaches a desired status, returns the pod info
	 */
	async waitForPod(podId: string, status: string = 'RUNNING', { interval = 5000, timeout = 300000 } = {}): Promise<RestPodInfo> {
		const start = Date.now()
		while (Date.now() - start < timeout) {
			const pod = await this.getPod(podId)
			if (pod.desiredStatus === status && pod.portMappings) {
				return pod
			}
			await new Promise(r => setTimeout(r, interval))
		}
		throw new Error(`Pod ${podId} did not reach status ${status} within ${timeout / 1000}s`)
	}

	/**
	 * List all network storage volumes on your account
	 */
	async listVolumes(): Promise<VolumeInfo[]> {
		return this.api('/networkvolumes')
	}

	/**
	 * Get details for a specific network volume
	 */
	async getVolume(volumeId: string): Promise<VolumeInfo> {
		return this.api(`/networkvolumes/${volumeId}`)
	}

	/**
	 * Create a new network storage volume
	 */
	async createVolume(options: CreateVolumeOptions): Promise<VolumeInfo> {
		return this.api('/networkvolumes', {
			method: 'POST',
			data: {
				name: options.name,
				size: options.size,
				dataCenterId: options.dataCenterId ?? this.dataCenterId,
			}
		})
	}

	/**
	 * Delete a network storage volume
	 */
	async removeVolume(volumeId: string) {
		return this.api(`/networkvolumes/${volumeId}`, { method: 'DELETE' })
	}

	async createRemoteShell(podId: string) {
		const podInfo = await this.getPodInfo(podId)!
		const sshService  = podInfo.ports.find((p:any) => p.serviceType == 'tcp' && p.external == '22')	

		if (!sshService) {
			throw new Error('No SSH service found')
		}

		return this.container.feature('secureShell', {
			host: sshService.ip,
			port: sshService.internal,
			key: '~/.ssh/id_ed25519',
			username: 'root'
		})
	}

	async getPodHttpURLs(podId: string) {
		const podInfo = await this.getPodInfo(podId)!
		const httpServices  = podInfo.ports.filter(p => p.serviceType == 'http')
		return httpServices.map(p => `https://${podInfo.id}-${p.external}.proxy.runpod.net`)
	}

	async listPods(detailed = false): Promise<PodInfo[]> {
		const { stdout: output } = await this.proc.spawnAndCapture('runpodctl', ['get', 'pod', '-a'])
		const pods = output
			.trim()
			.split("\n")
			.slice(1)
			.map(line => line.trim().split("\t"))
			.map((fields) => fields.map(f => f.trim()))
			.map((fields) => ({
				id: fields[0],
				name: fields[1],
				gpu: fields[2],
				imageName: fields[3],
				status: fields[4],
				podType: fields[5],
				cpu: fields[6],
				memory: fields[7],
				containerDisk: fields[8],
				volumeDisk: fields[9],
				price: fields[10],
				ports: parsePortInfo(fields[11] || ''),
			}))
		
		return pods as unknown as PodInfo[]
	}

	async getPodInfo(podId: string): Promise<PodInfo> {
		const { stdout: output } = await this.proc.spawnAndCapture('runpodctl', ['get', 'pod', podId, '-a'])

		return output
			.trim()
			.split("\n")
			.slice(1)	
			.map(line => line.trim().split("\t"))
			.map((fields) => fields.map(f => f.trim()))
			.map((fields) => ({
				id: fields[0],
				name: fields[1],
				gpu: fields[2],
				imageName: fields[3],
				status: fields[4],
				podType: fields[5],
				cpu: fields[6],
				memory: fields[7],
				containerDisk: fields[8],
				volumeDisk: fields[9],
				spotPrice: fields[10],
				ports: parsePortInfo(fields[11] || ''),
			}))[0] as PodInfo
	}

	async listSecureGPUs() {
		const { stdout: output } = await this.proc.spawnAndCapture('runpodctl', ['get', 'cloud', '--secure'])

		return output
			.split("\n")
			.filter((line) => !line.includes("Reserved"))
			.map(line => line.trim().split("\t"))
			.filter(list => list.length > 3)
			.map((fields) => fields.map(f => f.trim()))
			.map((fields) => ({
				gpuType: fields[0],
				memory: parseInt(fields[1]!),
				cpuCount: parseInt(fields[2]!),
				spotPrice: parseFloat(fields[3]!),
				ondemandPrice: parseFloat(fields[4]!),
			}))
			
	}

}

export default features.register('runpod', Runpod)

function parsePortInfo(portsString: string)  {
	const portsInfo = portsString.trim().split(')')
		.map((p) => p.trim().replace('(', '').replace(/^,/,''))
		.filter((v) => v.length > 0)
		.map((line) => line.split(/\s+/))
	
	return portsInfo.map((p: string[]) => {
		let [mappings,info] = p
		const mappingsInfo = (mappings || '').split(':')

		info = info || ''

		const ip = mappingsInfo[0]
		const portMappings = mappingsInfo[1]?.split(/\W+/) || ['0', '0']
		const internal = parseInt(portMappings![0]!)
		const external = parseInt(portMappings![1]!)
		const serviceType = info.split(',').pop()
		const isPublic = info.includes('pub')

		return {
			ip,
			internal,
			external,
			serviceType,
			isPublic
		}
	}).filter((info) => {
		if (info.serviceType == 'http' && info.external > 10000) {
			return false 
		}

		return true
	})
}

type PortInfo = {
	ip: string
	internal: number 
	external: number 
	serviceType: string
	isPublic: boolean
}

/** 
 * {
  "id": "vv32fbi9y21cxz",
  "name": "RunPod Stable Diffusion",
  "gpu": "1 RTX 4090",
  "imageName": "runpod/stable-diffusion:web-ui-10.2.1",
  "status": "RUNNING",
  "podType": "RESERVED",
  "cpu": "21",
  "memory": "41",
  "containerDisk": "10",
  "volumeDisk": "0",
  "spotPrice": "0.690",
  "ports": [
    {
      "ip": "100.65.22.197",
      "internal": "60014",
      "external": "8888",
      "serviceType": "http",
      "isPublic": false
    },
    {
      "ip": "100.65.22.197",
      "internal": "60013",
      "external": "19123",
      "serviceType": "http",
      "isPublic": false
    },
    {
      "ip": "203.57.40.89",
      "internal": "10020",
      "external": "22",
      "serviceType": "tcp",
      "isPublic": true
    },
    {
      "ip": "100.65.22.197",
      "internal": "60015",
      "external": "3001",
      "serviceType": "http",
      "isPublic": false
    }
  ]
}
*/

type PodInfo = {
	id: string
	name: string
	gpu: string
	imageName: string
	status: string
	podType: string
	cpu: string
	memory: string
	containerDisk: string
	volumeDisk: string
	spotPrice: string
	ports: PortInfo[]
}

type TemplateInfo = {
	id: string
	name: string
	category: string
	imageName: string
	isPublic: boolean
	isRunpod: boolean
	isServerless: boolean
	containerDiskInGb: number
	volumeInGb: number
	volumeMountPath: string
	ports: string[]
	env: Record<string, string>
	readme: string
}

type VolumeInfo = {
	id: string
	name: string
	size: number
	dataCenterId: string
}

type CreateVolumeOptions = {
	name: string
	size: number
	dataCenterId?: string
}

type RestPodInfo = {
	id: string
	name: string
	desiredStatus: 'RUNNING' | 'EXITED' | 'TERMINATED'
	costPerHr: number
	adjustedCostPerHr: number
	gpu: { id: string; count: number; displayName: string }
	machine: { dataCenterId: string; location: string; gpuTypeId: string }
	publicIp: string | null
	ports: string[]
	portMappings: Record<string, { ip: string; port: number }> | null
	containerDiskInGb: number
	volumeInGb: number
	memoryInGb: number
	vcpuCount: number
	image: string
}

type CreatePodOptions = {
	name?: string
	imageName?: string
	gpuTypeId: string | string[]
	gpuCount?: number
	templateId?: string
	cloudType?: 'SECURE' | 'COMMUNITY'
	containerDiskInGb?: number
	volumeInGb?: number
	volumeMountPath?: string
	ports?: string[]
	env?: Record<string, string>
	interruptible?: boolean
	networkVolumeId?: string
	minRAMPerGPU?: number
}