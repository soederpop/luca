import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'
import { Feature, features } from '../feature'
import axios from 'axios'

export const RunpodStateSchema = FeatureStateSchema.extend({})
export type RunpodState = z.infer<typeof RunpodStateSchema>

export const RunpodOptionsSchema = FeatureOptionsSchema.extend({
	apiKey: z.string().optional().describe('RunPod API key (falls back to RUNPOD_API_KEY env var)'),
	dataCenterId: z.string().optional().describe('Preferred data center ID (default: US-TX-3)'),
})
export type RunpodOptions = z.infer<typeof RunpodOptionsSchema>

/**
 * RunPod feature — manage GPU cloud pods, templates, volumes, and SSH connections via the RunPod REST API.
 *
 * Provides a complete interface for provisioning and managing RunPod GPU instances.
 * Supports creating pods from templates, managing network storage volumes, SSH access
 * via the SecureShell feature, file transfers, and polling for pod readiness.
 *
 * @extends Feature
 *
 * @example
 * ```typescript
 * const runpod = container.feature('runpod', { enable: true })
 * const pod = await runpod.createPod({ gpuTypeId: 'NVIDIA RTX 4090', templateId: 'abc123' })
 * const ready = await runpod.waitForPod(pod.id)
 * const shell = await runpod.getShell(pod.id)
 * await shell.exec('nvidia-smi')
 * ```
 */
export class Runpod extends Feature<RunpodState, RunpodOptions> {
  static override shortcut = 'features.runpod' as const
  static override envVars = ['RUNPOD_API_KEY']
  static override stateSchema = RunpodStateSchema
  static override optionsSchema = RunpodOptionsSchema

	/** The proc feature used for executing CLI commands like runpodctl. */
	get proc() {
		return this.container.feature('proc')
	}

	/** RunPod API key from options or the RUNPOD_API_KEY environment variable. */
	get apiKey() {
		return this.options.apiKey || process.env.RUNPOD_API_KEY || ''
	}

	/** Preferred data center ID, defaults to 'US-TX-3'. */
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

	/**
	 * List available pod templates.
	 *
	 * @param options - Filter options for templates
	 * @param options.includePublic - Include public community templates (default: false)
	 * @param options.includeRunpod - Include RunPod official templates (default: true)
	 * @returns Array of template info objects
	 *
	 * @example
	 * ```typescript
	 * const templates = await runpod.listTemplates({ includeRunpod: true })
	 * console.log(templates.map(t => t.name))
	 * ```
	 */
	async listTemplates(options: { includePublic?: boolean, includeRunpod?: boolean } = {}): Promise<TemplateInfo[]> {
		return this.api('/templates', {
			params: {
				includePublicTemplates: options.includePublic ?? false,
				includeRunpodTemplates: options.includeRunpod ?? true,
			}
		})
	}

	/**
	 * Get details for a specific template by ID.
	 *
	 * @param templateId - The template ID to look up
	 * @returns Template info object
	 *
	 * @example
	 * ```typescript
	 * const template = await runpod.getTemplate('abc123')
	 * console.log(template.imageName)
	 * ```
	 */
	async getTemplate(templateId: string): Promise<TemplateInfo> {
		return this.api(`/templates/${templateId}`)
	}

	/**
	 * Create a new GPU pod on RunPod.
	 *
	 * @param options - Pod configuration options
	 * @returns The created pod info
	 *
	 * @example
	 * ```typescript
	 * const pod = await runpod.createPod({
	 *   gpuTypeId: 'NVIDIA RTX 4090',
	 *   templateId: 'abc123',
	 *   volumeInGb: 50,
	 * })
	 * console.log(`Pod ${pod.id} created`)
	 * ```
	 */
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
				...(options.ports ? { ports: options.ports } : !options.templateId ? { ports: ['8888/http', '22/tcp'] } : {}),
				env: options.env,
				interruptible: options.interruptible ?? false,
				networkVolumeId: options.networkVolumeId,
				minRAMPerGPU: options.minRAMPerGPU,
			}
		})
	}

	/**
	 * Stop a running pod.
	 *
	 * @param podId - The pod ID to stop
	 * @returns API response
	 *
	 * @example
	 * ```typescript
	 * await runpod.stopPod('pod-abc123')
	 * ```
	 */
	async stopPod(podId: string) {
		return this.api(`/pods/${podId}/stop`, { method: 'POST' })
	}

	/**
	 * Start a stopped pod.
	 *
	 * @param podId - The pod ID to start
	 * @returns API response
	 *
	 * @example
	 * ```typescript
	 * await runpod.startPod('pod-abc123')
	 * ```
	 */
	async startPod(podId: string) {
		return this.api(`/pods/${podId}/start`, { method: 'POST' })
	}

	/**
	 * Permanently delete a pod.
	 *
	 * @param podId - The pod ID to remove
	 * @returns API response
	 *
	 * @example
	 * ```typescript
	 * await runpod.removePod('pod-abc123')
	 * ```
	 */
	async removePod(podId: string) {
		return this.api(`/pods/${podId}`, { method: 'DELETE' })
	}

	/**
	 * Get all pods via the REST API.
	 *
	 * @param filters - Optional filters for name, image, or status
	 * @param filters.name - Filter by pod name
	 * @param filters.imageName - Filter by Docker image name
	 * @param filters.desiredStatus - Filter by status (RUNNING, EXITED, TERMINATED)
	 * @returns Array of pod info objects
	 *
	 * @example
	 * ```typescript
	 * const pods = await runpod.getpods({ desiredStatus: 'RUNNING' })
	 * console.log(pods.map(p => `${p.name}: ${p.desiredStatus}`))
	 * ```
	 */
	async getpods(filters: { name?: string; imageName?: string; desiredStatus?: string } = {}): Promise<RestPodInfo[]> {
		return this.api('/pods', { params: filters })
	}

	/**
	 * Get detailed pod info via the REST API.
	 *
	 * Returns richer data than the CLI-based `getPodInfo`, including port mappings and public IP.
	 *
	 * @param podId - The pod ID to look up
	 * @returns Detailed pod info with port mappings, costs, and GPU details
	 *
	 * @example
	 * ```typescript
	 * const pod = await runpod.getPod('pod-abc123')
	 * console.log(`${pod.name} - ${pod.desiredStatus} - $${pod.costPerHr}/hr`)
	 * ```
	 */
	async getPod(podId: string): Promise<RestPodInfo> {
		return this.api(`/pods/${podId}`)
	}

	/**
	 * Poll until a pod reaches a desired status.
	 *
	 * @param podId - The pod ID to monitor
	 * @param status - Target status to wait for (default: 'RUNNING')
	 * @param options - Polling configuration
	 * @param options.interval - Polling interval in ms (default: 5000)
	 * @param options.timeout - Max wait time in ms (default: 300000)
	 * @returns The pod info once it reaches the target status
	 * @throws If the pod does not reach the target status within the timeout
	 *
	 * @example
	 * ```typescript
	 * const pod = await runpod.createPod({ gpuTypeId: 'NVIDIA RTX 4090', templateId: 'abc' })
	 * const ready = await runpod.waitForPod(pod.id, 'RUNNING', { timeout: 120000 })
	 * ```
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
	 * List all network storage volumes on your account.
	 *
	 * @returns Array of volume info objects
	 *
	 * @example
	 * ```typescript
	 * const volumes = await runpod.listVolumes()
	 * console.log(volumes.map(v => `${v.name}: ${v.size}GB`))
	 * ```
	 */
	async listVolumes(): Promise<VolumeInfo[]> {
		return this.api('/networkvolumes')
	}

	/**
	 * Get details for a specific network volume.
	 *
	 * @param volumeId - The volume ID to look up
	 * @returns Volume info object
	 *
	 * @example
	 * ```typescript
	 * const vol = await runpod.getVolume('vol-abc123')
	 * console.log(`${vol.name}: ${vol.size}GB in ${vol.dataCenterId}`)
	 * ```
	 */
	async getVolume(volumeId: string): Promise<VolumeInfo> {
		return this.api(`/networkvolumes/${volumeId}`)
	}

	/**
	 * Create a new network storage volume.
	 *
	 * @param options - Volume configuration
	 * @returns The created volume info
	 *
	 * @example
	 * ```typescript
	 * const vol = await runpod.createVolume({ name: 'my-models', size: 100 })
	 * console.log(`Created volume ${vol.id}`)
	 * ```
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
	 * Delete a network storage volume.
	 *
	 * @param volumeId - The volume ID to delete
	 * @returns API response
	 *
	 * @example
	 * ```typescript
	 * await runpod.removeVolume('vol-abc123')
	 * ```
	 */
	async removeVolume(volumeId: string) {
		return this.api(`/networkvolumes/${volumeId}`, { method: 'DELETE' })
	}

	/**
	 * Create an SSH connection to a pod using the runpodctl CLI.
	 *
	 * Prefer `getShell()` which uses the REST API and is more reliable.
	 *
	 * @param podId - The pod ID to connect to
	 * @returns A SecureShell feature instance connected to the pod
	 *
	 * @example
	 * ```typescript
	 * const shell = await runpod.createRemoteShell('pod-abc123')
	 * const output = await shell.exec('nvidia-smi')
	 * ```
	 */
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

	/**
	 * Get an SSH connection to a pod using the REST API.
	 *
	 * Uses port mappings and public IP from the REST API, which is more reliable
	 * than the CLI-based `createRemoteShell`.
	 *
	 * @param podId - The pod ID to connect to
	 * @returns A SecureShell feature instance connected to the pod
	 * @throws If no SSH port mapping or public IP is found
	 *
	 * @example
	 * ```typescript
	 * const shell = await runpod.getShell('pod-abc123')
	 * const output = await shell.exec('ls /workspace')
	 * ```
	 */
	async getShell(podId: string) {
		const pod = await this.getPod(podId)

		const sshPort = pod.portMappings?.['22']
		if (!sshPort) {
			throw new Error(`No SSH port mapping found for pod ${podId}. Is SSH (22/tcp) exposed?`)
		}

		if (!pod.publicIp) {
			throw new Error(`No public IP found for pod ${podId}. Is the pod running?`)
		}

		return this.container.feature('secureShell', {
			host: pod.publicIp,
			port: sshPort,
			key: '~/.ssh/id_ed25519',
			username: 'root',
		})
	}

	/**
	 * Ensure a file exists on a pod's filesystem. If missing, kicks off a background
	 * download via a helper script and polls until the file appears.
	 *
	 * @param podId - The pod ID
	 * @param remotePath - Absolute path on the pod where the file should exist
	 * @param fallbackUrl - URL to download from (inside the pod) if the file doesn't exist
	 * @param options.pollInterval - How often to check in ms (default 5000)
	 * @param options.timeout - Max time to wait for download in ms (default 600000 / 10 min)
	 * @param options.onProgress - Called each poll with current file size in bytes
	 * @returns Object with `existed` (was already there) and `path`
	 *
	 * @example
	 * ```ts
	 * await runpod.ensureFileExists(
	 *   podId,
	 *   '/workspace/ComfyUI/models/checkpoints/juggernaut_xl.safetensors',
	 *   'https://civitai.com/api/download/models/456789',
	 *   { onProgress: (bytes) => console.log(`${(bytes / 1e9).toFixed(2)} GB downloaded`) }
	 * )
	 * ```
	 */
	async ensureFileExists(
		podId: string,
		remotePath: string,
		fallbackUrl: string,
		options: {
			pollInterval?: number
			timeout?: number
			onProgress?: (bytes: number) => void
		} = {}
	): Promise<{ existed: boolean; path: string }> {
		const { pollInterval = 5000, timeout = 600_000, onProgress } = options
		const shell = await this.getShell(podId)

		// Check if file already exists
		const check = await shell.exec(`test -f ${esc(remotePath)} && echo EXISTS || echo MISSING`)

		if (check.trim() === 'EXISTS') {
			return { existed: true, path: remotePath }
		}

		// Ensure parent directory exists
		const dir = remotePath.substring(0, remotePath.lastIndexOf('/'))
		await shell.exec(`mkdir -p ${esc(dir)}`)

		// Encode the download command as base64 and decode+exec on the pod.
		// This completely sidesteps quoting issues with nohup/& through SSH.
		const partial = `${remotePath}.partial`
		const downloadCmd = `wget -q -O '${partial}' '${fallbackUrl}' && mv '${partial}' '${remotePath}'`
		const b64 = Buffer.from(downloadCmd).toString('base64')

		await shell.exec(`echo ${b64} | base64 -d | nohup bash >/dev/null 2>&1 &`)

		// Poll until the final file appears
		const start = Date.now()

		while (Date.now() - start < timeout) {
			await new Promise(r => setTimeout(r, pollInterval))

			// Check if the final file landed (mv from .partial succeeded)
			const result = await shell.exec(
				`if test -f ${esc(remotePath)}; then echo DONE; elif test -f ${esc(partial)}; then stat -c%s ${esc(partial)} 2>/dev/null || stat -f%z ${esc(partial)} 2>/dev/null; else echo MISSING; fi`
			)

			const trimmed = result.trim()

			if (trimmed === 'DONE') {
				return { existed: false, path: remotePath }
			}

			if (trimmed === 'MISSING') {
				// wget hasn't started writing yet, or it failed before creating the file.
				// Give it a moment — if we're early in the poll loop, keep waiting.
				if (Date.now() - start > 30_000) {
					throw new Error(`Download failed: neither ${remotePath} nor ${partial} found after 30s`)
				}
				continue
			}

			// It's a number — file size of the .partial
			const bytes = parseInt(trimmed, 10)
			if (!isNaN(bytes) && onProgress) {
				onProgress(bytes)
			}
		}

		throw new Error(`Timed out waiting for download of ${remotePath} after ${timeout / 1000}s`)
	}

	/**
	 * Get the public HTTP proxy URLs for a pod's exposed HTTP ports.
	 *
	 * @param podId - The pod ID
	 * @returns Array of public proxy URLs
	 *
	 * @example
	 * ```typescript
	 * const urls = await runpod.getPodHttpURLs('pod-abc123')
	 * // ['https://pod-abc123-8888.proxy.runpod.net']
	 * ```
	 */
	async getPodHttpURLs(podId: string) {
		const podInfo = await this.getPodInfo(podId)!
		const httpServices  = podInfo.ports.filter(p => p.serviceType == 'http')
		return httpServices.map(p => `https://${podInfo.id}-${p.external}.proxy.runpod.net`)
	}

	/**
	 * List all pods using the runpodctl CLI.
	 *
	 * Parses the tabular output from `runpodctl get pod`. For richer data, use `getpods()`.
	 *
	 * @param detailed - Reserved for future use
	 * @returns Array of pod info objects
	 *
	 * @example
	 * ```typescript
	 * const pods = await runpod.listPods()
	 * pods.forEach(p => console.log(`${p.name} (${p.gpu}): ${p.status}`))
	 * ```
	 */
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

	/**
	 * Get pod info using the runpodctl CLI.
	 *
	 * For richer data including port mappings and public IP, use `getPod()`.
	 *
	 * @param podId - The pod ID to look up
	 * @returns Pod info parsed from CLI output
	 *
	 * @example
	 * ```typescript
	 * const info = await runpod.getPodInfo('pod-abc123')
	 * console.log(`${info.name}: ${info.status}`)
	 * ```
	 */
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

	/**
	 * List available secure GPU types with pricing.
	 *
	 * Uses the runpodctl CLI to query available secure cloud GPUs, filtering out reserved instances.
	 *
	 * @returns Array of GPU info with type, memory, CPU count, and pricing
	 *
	 * @example
	 * ```typescript
	 * const gpus = await runpod.listSecureGPUs()
	 * gpus.forEach(g => console.log(`${g.gpuType}: $${g.ondemandPrice}/hr`))
	 * ```
	 */
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

/** Shell-escape a string for safe use in SSH commands */
function esc(s: string): string {
	return `'${s.replace(/'/g, "'\\''")}'`
}

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
	/** Display name for the volume */
	name: string
	/** Size in GB */
	size: number
	/** Data center to create in (defaults to feature's dataCenterId) */
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
	/** Public IP for SSH/TCP connections */
	publicIp: string | null
	ports: string[]
	/** Maps internal port (e.g. "22") to external port number (e.g. 22122) */
	portMappings: Record<string, number> | null
	containerDiskInGb: number
	volumeInGb: number
	memoryInGb: number
	vcpuCount: number
	image: string
}

type CreatePodOptions = {
	/** Pod display name (default: 'luca-pod') */
	name?: string
	/** Docker image name to run */
	imageName?: string
	/** GPU type ID or array of acceptable GPU types */
	gpuTypeId: string | string[]
	/** Number of GPUs to allocate (default: 1) */
	gpuCount?: number
	/** Template ID to use for pod configuration */
	templateId?: string
	/** Cloud type: 'SECURE' for dedicated or 'COMMUNITY' for shared (default: 'SECURE') */
	cloudType?: 'SECURE' | 'COMMUNITY'
	/** Container disk size in GB (default: 50) */
	containerDiskInGb?: number
	/** Persistent volume size in GB (default: 20) */
	volumeInGb?: number
	/** Mount path for the volume (default: '/workspace') */
	volumeMountPath?: string
	/** Port mappings like ['8888/http', '22/tcp'] */
	ports?: string[]
	/** Environment variables to set in the container */
	env?: Record<string, string>
	/** Whether the pod can be preempted for spot pricing */
	interruptible?: boolean
	/** ID of an existing network volume to attach */
	networkVolumeId?: string
	/** Minimum RAM per GPU in GB */
	minRAMPerGPU?: number
}
