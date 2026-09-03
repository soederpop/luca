import { describe, it, expect } from 'bun:test'
import { NodeContainer } from '../src/node/container'

/**
 * secureShell and docker expose agent tools via the static `tools` convention.
 * These tests verify the toTools() bundle wiring — schemas present, handlers
 * bound, and handlers delegating to the underlying feature methods — without
 * needing a reachable SSH host or a docker daemon.
 */

describe('secureShell agent tools', () => {
	const makeSsh = () => new NodeContainer().feature('secureShell', {
		host: 'example.test',
		username: 'deploy',
		key: '/keys/id_test',
	})

	it('exposes the ssh tool surface with matching schemas and handlers', () => {
		const bundle = makeSsh().toTools()
		const expected = ['sshExec', 'sshTestConnection', 'sshUpload', 'sshDownload']
		for (const name of expected) {
			expect(Object.keys(bundle.schemas)).toContain(name)
			expect(typeof bundle.handlers[name]).toBe('function')
		}
	})

	it('sshExec handler delegates the command string to exec()', async () => {
		const ssh = makeSsh()
		let seen: string | null = null
		;(ssh as any).exec = async (command: string) => { seen = command; return 'ok' }
		const result = await makeBundleHandler(ssh, 'sshExec')({ command: 'uptime' })
		expect(seen).toBe('uptime')
		expect(result).toBe('ok')
	})

	it('sshUpload handler delegates source/target positionally', async () => {
		const ssh = makeSsh()
		let seen: string[] = []
		;(ssh as any).upload = async (source: string, target: string) => { seen = [source, target]; return 'done' }
		await makeBundleHandler(ssh, 'sshUpload')({ source: './a.txt', target: '/tmp/a.txt' })
		expect(seen).toEqual(['./a.txt', '/tmp/a.txt'])
	})

	it('setupToolsConsumer injects the host into the prompt extension', () => {
		const ssh = makeSsh()
		const extensions: Record<string, string> = {}
		const consumer: any = {
			addSystemPromptExtension: (name: string, text: string) => { extensions[name] = text },
		}
		ssh.setupToolsConsumer(consumer)
		expect(extensions.secureShell).toContain('deploy@example.test')
	})
})

describe('docker agent tools', () => {
	const makeDocker = () => new NodeContainer().feature('docker')

	it('exposes the docker tool surface with matching schemas and handlers', () => {
		const bundle = makeDocker().toTools()
		const expected = [
			'listContainers', 'listImages', 'runContainer', 'execInContainer',
			'getContainerLogs', 'startContainer', 'stopContainer', 'removeContainer',
			'pullImage', 'removeImage', 'buildImage',
		]
		for (const name of expected) {
			expect(Object.keys(bundle.schemas)).toContain(name)
			expect(typeof bundle.handlers[name]).toBe('function')
		}
	})

	it('listContainers handler returns JSON from the feature method', async () => {
		const docker = makeDocker()
		;(docker as any).listContainers = async (opts: any) => [{ id: 'abc', all: opts.all }]
		const result = await makeBundleHandler(docker, 'listContainers')({ all: true })
		expect(JSON.parse(result)).toEqual([{ id: 'abc', all: true }])
	})

	it('runContainer handler splits image from the remaining options', async () => {
		const docker = makeDocker()
		let seen: any = null
		;(docker as any).runContainer = async (image: string, options: any) => { seen = { image, options }; return 'cid' }
		const result = await makeBundleHandler(docker, 'runContainer')({
			image: 'nginx:latest', detach: true, ports: ['8080:80'],
		})
		expect(result).toBe('cid')
		expect(seen.image).toBe('nginx:latest')
		expect(seen.options).toEqual({ detach: true, ports: ['8080:80'] })
	})

	it('execInContainer handler wraps the command in sh -c and stringifies the result', async () => {
		const docker = makeDocker()
		let seen: any = null
		;(docker as any).execCommand = async (target: string, command: string[], opts: any) => {
			seen = { target, command, opts }
			return { stdout: 'hi', stderr: '', exitCode: 0 }
		}
		const result = await makeBundleHandler(docker, 'execInContainer')({ container: 'web', command: 'ls -la' })
		expect(seen.target).toBe('web')
		expect(seen.command).toEqual(['sh', '-c', 'ls -la'])
		expect(JSON.parse(result).exitCode).toBe(0)
	})

	it('setupToolsConsumer registers a docker prompt extension', () => {
		const docker = makeDocker()
		const extensions: Record<string, string> = {}
		const consumer: any = {
			addSystemPromptExtension: (name: string, text: string) => { extensions[name] = text },
		}
		docker.setupToolsConsumer(consumer)
		expect(extensions.docker).toContain('exitCode')
	})
})

// Rebuild the bundle after stubbing an instance method, since handlers close
// over the helper instance at toTools() time
function makeBundleHandler(helper: any, name: string) {
	return helper.toTools().handlers[name]
}
