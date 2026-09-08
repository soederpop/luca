import { afterEach, beforeEach, describe, expect, it, spyOn, type Mock } from 'bun:test'
import { NodeContainer } from '../src/node/container'
let c: NodeContainer
let spawn: Mock<NodeContainer['proc']['spawnAndCapture']>
const result = (stdout = '', exitCode = 0, stderr = '') => ({ stdout, exitCode, stderr, pid: null, error: null })
beforeEach(() => {
  c = new NodeContainer()
  spawn = spyOn(c.proc, 'spawnAndCapture').mockResolvedValue(result())
})
afterEach(() => spawn.mockRestore())
function docker(autoRefresh = false) {
  const feature = c.feature('docker', { dockerPath: '/fake/docker', autoRefresh })
  feature.state.set('isDockerAvailable', true)
  return feature
}
const calls = () => spawn.mock.calls.map(call => call[1])

describe('Docker CLI contracts', () => {
  it('checks availability, clears prior errors, and handles a missing binary', async () => {
    const d = docker(); d.state.set('lastError', 'old')
    expect(await d.checkDockerAvailability()).toBe(true)
    expect(d.state.get('lastError')).toBeUndefined()
    spawn.mockResolvedValueOnce(result('', 1))
    expect(await d.checkDockerAvailability()).toBe(false)
    spawn.mockRejectedValueOnce(new Error('missing binary'))
    expect(await d.checkDockerAvailability()).toBe(false)
    expect(d.state.get('lastError')).toBe('missing binary')
  })
  it('refuses operations when Docker is unavailable', async () => {
    const d = docker(); d.state.set('isDockerAvailable', false)
    spawn.mockResolvedValue(result('', 127))
    await expect(d.listContainers()).rejects.toThrow('Docker is not available')
    expect(calls()).toEqual([['--version']])
  })
  it('parses line-delimited containers, skipping noise and refreshing state', async () => {
    spawn.mockResolvedValue(result('noise\n' + JSON.stringify({ ID: 'id', Names: 'app', Image: 'nginx', Status: 'Up 1 minute', Ports: '80/tcp, 443/tcp', CreatedAt: 'today' }) + '\r\n'))
    const d = docker(true)
    const containers = await d.listContainers({ all: true })
    expect(containers).toEqual([{ id: 'id', name: 'app', image: 'nginx', status: 'Up 1 minute', ports: ['80/tcp', '443/tcp'], created: 'today' }])
    expect(d.state.get('containers')).toEqual(containers)
    expect(calls()).toEqual([['ps', '--format', 'json', '--all']])
  })
  it('parses images, skipping malformed output and retaining cache', async () => {
    spawn.mockResolvedValue(result('invalid\n' + JSON.stringify({ ID: 'img', Repository: 'node', Tag: '22', Size: '100MB', CreatedAt: 'today' })))
    const d = docker(true)
    const images = await d.listImages()
    expect(images).toEqual([{ id: 'img', repository: 'node', tag: '22', size: '100MB', created: 'today' }])
    expect(d.state.get('images')).toEqual(images)
  })
  it('preserves run arguments, environment values and command boundaries', async () => {
    spawn.mockResolvedValue(result('container-id\n'))
    expect(await docker().runContainer('image:tag', { detach: true, interactive: true, tty: true, name: 'app', workdir: '/app space', user: '1000', entrypoint: 'sh', network: 'private', restart: 'unless-stopped', envFile: '/tmp/my env', ports: ['8080:80'], volumes: ['/tmp/my data:/data'], environment: { MESSAGE: 'hello; $world' }, command: ['-c', 'echo hello'] })).toBe('container-id')
    expect(calls()[0]).toEqual(['run', '--detach', '--interactive', '--tty', '--name', 'app', '--workdir', '/app space', '--user', '1000', '--entrypoint', 'sh', '--network', 'private', '--restart', 'unless-stopped', '--env-file', '/tmp/my env', '--publish', '8080:80', '--volume', '/tmp/my data:/data', '--env', 'MESSAGE=hello; $world', 'image:tag', '-c', 'echo hello'])
  })
  it('passes exec flags and returns nonzero exit codes for caller inspection', async () => {
    spawn.mockResolvedValue(result('output', 7, 'failure'))
    const d = docker()
    expect(await d.execCommand('app', ['sh', '-c', 'exit 7'], { interactive: true, tty: true, detach: true, user: 'user', workdir: '/app', environment: { X: 'a b' } })).toMatchObject({ stdout: 'output', exitCode: 7, stderr: 'failure' })
    expect(calls()[0]).toEqual(['exec', '--interactive', '--tty', '--user', 'user', '--workdir', '/app', '--detach', '--env', 'X=a b', 'app', 'sh', '-c', 'exit 7'])
    expect(d.state.get('lastError')).toBe('failure')
  })
  it('uses an ephemeral run when exec needs additional mounts', async () => {
    spawn.mockResolvedValueOnce(result('image:tag\n')).mockResolvedValueOnce(result('done'))
    expect((await docker().execCommand('app', ['ls'], { volumes: ['/host:/data'], workdir: '/data', user: 'user', interactive: true, tty: true, environment: { X: '1' } })).stdout).toBe('done')
    expect(calls()).toEqual([['inspect', '--format', '{{.Config.Image}}', 'app'], ['run', '--rm', '--volume', '/host:/data', '--interactive', '--tty', '--user', 'user', '--workdir', '/data', '--env', 'X=1', 'image:tag', 'ls']])
  })
  it('does not create a mounted exec when image inspection fails', async () => {
    spawn.mockResolvedValue(result('', 1, 'missing container'))
    await expect(docker().execCommand('gone', ['ls'], { volumes: ['/a:/b'] })).rejects.toThrow('Failed to inspect')
    expect(spawn).toHaveBeenCalledTimes(1)
  })
  it('shells retain their last result and never destroy an existing container', async () => {
    const shell = await docker().createShell('existing', { user: 'user', workdir: '/app' })
    expect(shell.last).toBeNull()
    expect(shell.containerId).toBe('existing')
    spawn.mockResolvedValue(result('hello'))
    expect(await shell.run('echo hello')).toMatchObject({ stdout: 'hello' })
    expect(shell.last?.stdout).toBe('hello')
    await shell.destroy()
    expect(calls()).toEqual([['exec', '--user', 'user', '--workdir', '/app', 'existing', 'sh', '-c', 'echo hello']])
  })
  it('mounted shells own and clean up only their temporary container', async () => {
    spawn.mockResolvedValueOnce(result('image')).mockResolvedValueOnce(result('temporary\n'))
    const shell = await docker().createShell('existing', { volumes: ['/a:/b'], workdir: '/b', user: 'user', environment: { X: '1' } })
    expect(shell.containerId).toBe('temporary')
    await shell.run('pwd'); await shell.destroy(); await shell.destroy()
    expect(calls()).toEqual([
      ['inspect', '--format', '{{.Config.Image}}', 'existing'],
      ['run', '-d', '--rm', '--volume', '/a:/b', '--workdir', '/b', '--user', 'user', '--env', 'X=1', 'image', 'sleep', 'infinity'],
      ['exec', 'temporary', 'sh', '-c', 'pwd'], ['stop', 'temporary'],
    ])
  })
  it('rejects a failed temporary shell creation', async () => {
    spawn.mockResolvedValueOnce(result('image')).mockResolvedValueOnce(result('', 1, 'run failed'))
    await expect(docker().createShell('app', { volumes: ['/a:/b'] })).rejects.toThrow('Failed to create shell container')
  })
  it('builds images with all supported options', async () => {
    await docker().buildImage('/build context', { tag: 'app:test', dockerfile: 'Dockerfile.test', target: 'test', nocache: true, buildArgs: { MESSAGE: 'a b' } })
    expect(calls()).toEqual([['build', '--tag', 'app:test', '--file', 'Dockerfile.test', '--target', 'test', '--no-cache', '--build-arg', 'MESSAGE=a b', '/build context']])
  })
  it('forwards lifecycle and image commands and refreshes relevant caches', async () => {
    const d = docker(true)
    await d.startContainer('app'); await d.stopContainer('app', 3); await d.removeContainer('app', { force: true })
    await d.pullImage('image'); await d.removeImage('image', { force: true })
    expect(calls()).toEqual([
      ['start', 'app'], ['ps', '--format', 'json', '--all'],
      ['stop', '--time', '3', 'app'], ['ps', '--format', 'json', '--all'],
      ['rm', '--force', 'app'], ['ps', '--format', 'json', '--all'],
      ['pull', 'image'], ['images', '--format', 'json'], ['rmi', '--force', 'image'], ['images', '--format', 'json'],
    ])
  })
  it('preserves logs and parses system information', async () => {
    spawn.mockResolvedValueOnce(result('raw\nlogs\n')).mockResolvedValueOnce(result('{"Containers":2}'))
    const d = docker()
    expect(await d.getLogs('app', { follow: true, tail: 5, since: '1h', timestamps: true })).toBe('raw\nlogs\n')
    expect(calls()[0]).toEqual(['logs', '--follow', '--tail', '5', '--since', '1h', '--timestamps', 'app'])
    expect(await d.getSystemInfo()).toEqual({ Containers: 2 })
  })
  it('prunes only selected resource types or all when requested', async () => {
    const d = docker()
    await d.prune({ volumes: true }); await d.prune({ all: true, force: true }); await d.prune()
    expect(calls()).toEqual([['volume', 'prune', '--force'], ['container', 'prune', '--force'], ['image', 'prune', '--force'], ['volume', 'prune', '--force'], ['network', 'prune', '--force'], ['system', 'prune', '--force']])
  })
  it.each(['listContainers', 'listImages', 'startContainer', 'stopContainer', 'removeContainer', 'runContainer', 'pullImage', 'removeImage', 'buildImage', 'getLogs', 'getSystemInfo'] as const)('%s rejects unsuccessful CLI output', async (method) => {
    spawn.mockResolvedValue(result('', 1, 'daemon rejected request'))
    const d = docker()
    const action = method === 'listContainers' || method === 'listImages' || method === 'getSystemInfo' ? d[method]() : d[method]('target')
    await expect(action).rejects.toThrow('daemon rejected request')
    expect(d.state.get('lastError')).toBe('daemon rejected request')
  })
  it('records thrown process errors without replacing their identity', async () => {
    const error = new Error('spawn failed'); spawn.mockRejectedValue(error)
    const d = docker()
    await expect(d.listImages()).rejects.toBe(error)
    expect(d.state.get('lastError')).toBe(error.message)
  })
})
