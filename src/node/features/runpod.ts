import { Feature, features, type FeatureOptions, type FeatureState } from '../feature'

export interface RunpodState extends FeatureState { }

export interface RunpodOptions extends FeatureOptions { }

/**
 * Uses ssh to run commands, or scp to transfer files between a remote host. 
 * 
 */
export class Runpod extends Feature<RunpodState, RunpodOptions> {
  static override shortcut = 'features.runpod' as const

	/**
	 * Get the proc feature for executing shell commands
	 */
	get proc() {
		return this.container.feature('proc')
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