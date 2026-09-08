import { afterEach, beforeEach, describe, expect, it, spyOn, mock, type Mock } from 'bun:test'
import { NodeContainer } from '../src/node/container'
import type { Runpod } from '../src/node/features/runpod'
let c: NodeContainer
let pod: Runpod
let api: Mock<(path: string, options?: any) => Promise<any>>
let spawn: Mock<NodeContainer['proc']['spawnAndCapture']>
let which: Mock<NodeContainer['os']['whichCommand']>
const result = (stdout: string) => ({ stdout, stderr: '', exitCode: 0, error: null, pid: null })
beforeEach(() => {
  c = new NodeContainer(); pod = c.feature('runpod', { apiKey: 'test-only-key' })
  // The feature's API method is its HTTP transport boundary; never send cloud requests.
  api = spyOn(pod as unknown as { api: (path: string, options?: any) => Promise<any> }, 'api').mockResolvedValue({})
  spawn = spyOn(c.proc, 'spawnAndCapture').mockResolvedValue(result(''))
  which = spyOn(c.os, 'whichCommand').mockReturnValue('/fake/runpodctl')
})
afterEach(() => { api.mockRestore(); spawn.mockRestore(); which.mockRestore() })
const row = (ports = '') => `id\tname\tGPU\timage\tRUNNING\tSECURE\t8\t32\t50\t20\t0.5\t${ports}`

describe('Runpod orchestration', () => {
  it('passes template list defaults and explicit filters', async () => {
    await pod.listTemplates(); await pod.listTemplates({ includePublic: true, includeRunpod: false }); await pod.getTemplate('template')
    expect(api.mock.calls).toEqual([
      ['/templates', { params: { includePublicTemplates: false, includeRunpodTemplates: true } }],
      ['/templates', { params: { includePublicTemplates: true, includeRunpodTemplates: false } }], ['/templates/template'],
    ])
  })
  it('creates pods with documented defaults and normalizes a single GPU type', async () => {
    api.mockResolvedValue({ id: 'created' })
    expect(await pod.createPod({ gpuTypeId: 'gpu', imageName: 'image' })).toMatchObject({ id: 'created' })
    expect(api.mock.calls[0]).toEqual(['/pods', { method: 'POST', data: {
      name: 'luca-pod', imageName: 'image', gpuTypeIds: ['gpu'], gpuCount: 1, templateId: undefined,
      cloudType: 'SECURE', containerDiskInGb: 50, volumeInGb: 20, volumeMountPath: '/workspace', ports: ['8888/http', '22/tcp'],
      env: undefined, interruptible: false, networkVolumeId: undefined, minRAMPerGPU: undefined,
    } }])
  })
  it('preserves template ports unless an explicit override is supplied', async () => {
    await pod.createPod({ gpuTypeId: ['a', 'b'], templateId: 'template', volumeInGb: 0, gpuCount: 2 })
    expect(api.mock.calls[0]![1].data).not.toHaveProperty('ports')
    expect(api.mock.calls[0]![1].data).toMatchObject({ gpuTypeIds: ['a', 'b'], volumeInGb: 0, gpuCount: 2 })
    await pod.createPod({ gpuTypeId: 'a', templateId: 'template', ports: [] })
    expect(api.mock.calls[1]![1].data.ports).toEqual([])
  })
  it('routes pod lifecycle, detail and filtered listing requests', async () => {
    await pod.stopPod('id'); await pod.startPod('id'); await pod.removePod('id'); await pod.getPod('id'); await pod.getpods({ name: 'worker' })
    expect(api.mock.calls).toEqual([['/pods/id/stop', { method: 'POST' }], ['/pods/id/start', { method: 'POST' }], ['/pods/id', { method: 'DELETE' }], ['/pods/id'], ['/pods', { params: { name: 'worker' } }]])
  })
  it('routes network volume CRUD with default and overridden regions', async () => {
    await pod.listVolumes(); await pod.getVolume('v'); await pod.createVolume({ name: 'cache', size: 10 }); await pod.createVolume({ name: 'other', size: 20, dataCenterId: 'EU' }); await pod.removeVolume('v')
    expect(api.mock.calls).toEqual([['/networkvolumes'], ['/networkvolumes/v'], ['/networkvolumes', { method: 'POST', data: { name: 'cache', size: 10, dataCenterId: 'US-TX-3' } }], ['/networkvolumes', { method: 'POST', data: { name: 'other', size: 20, dataCenterId: 'EU' } }], ['/networkvolumes/v', { method: 'DELETE' }]])
  })
  it('waits for both running state and port mappings', async () => {
    api.mockResolvedValueOnce({ desiredStatus: 'EXITED' }).mockResolvedValueOnce({ desiredStatus: 'RUNNING', portMappings: null }).mockResolvedValueOnce({ desiredStatus: 'RUNNING', portMappings: { '22': 1234 } })
    expect(await pod.waitForPod('id', 'RUNNING', { interval: 0, timeout: 1000 })).toMatchObject({ portMappings: { '22': 1234 } })
    expect(api).toHaveBeenCalledTimes(3)
  })
  it('timeouts are bounded and transport errors are preserved', async () => {
    await expect(pod.waitForPod('id', 'RUNNING', { timeout: 0 })).rejects.toThrow('did not reach status RUNNING')
    api.mockRejectedValue(new Error('cloud unavailable'))
    await expect(pod.waitForPod('id')).rejects.toThrow('cloud unavailable')
  })
  it('constructs SSH access from public IP and port mappings', async () => {
    api.mockResolvedValue({ publicIp: '192.0.2.1', portMappings: { '22': 2222 } })
    expect((await pod.getShell('id')).options).toMatchObject({ host: '192.0.2.1', port: 2222, username: 'root' })
  })
  it.each([[{ publicIp: '192.0.2.1' }, 'No SSH port'], [{ portMappings: { '22': 2222 } }, 'No public IP']] as const)('rejects unreachable pod metadata %#', async (data, message) => {
    api.mockResolvedValue(data)
    await expect(pod.getShell('id')).rejects.toThrow(message)
  })
  it('parses CLI tables, filters internal HTTP ports and builds public URLs', async () => {
    spawn.mockResolvedValue(result('HEADER\n' + row('192.0.2.1:2222->22 (pub,tcp),192.0.2.1:8888->8888 (pub,http),192.0.2.1:12345->12345 (prv,http)') + '\n'))
    const pods = await pod.listPods()
    expect(pods[0]).toMatchObject({ id: 'id', name: 'name', gpu: 'GPU', ports: [{ ip: '192.0.2.1', internal: 2222, external: 22, serviceType: 'tcp', isPublic: true }, { external: 8888, serviceType: 'http' }] })
    expect(await pod.getPodHttpURLs('id')).toEqual(['https://id-8888.proxy.runpod.net'])
    expect((await pod.createRemoteShell('id')).options).toMatchObject({ host: '192.0.2.1', port: 2222 })
    expect(which).toHaveBeenCalledTimes(1)
  })
  it('handles empty pod listings and pods without an SSH service', async () => {
    spawn.mockResolvedValueOnce(result('HEADER\n'))
    expect(await pod.listPods()).toEqual([])
    spawn.mockResolvedValue(result('HEADER\n' + row()))
    await expect(pod.createRemoteShell('id')).rejects.toThrow('No SSH service found')
  })
  it('parses GPU pricing and ignores headers and reserved capacity', async () => {
    spawn.mockResolvedValue(result('Reserved\nA100\t80 GB\t16\t1.25\t2.50\n\n'))
    expect(await pod.listSecureGPUs()).toEqual([{ gpuType: 'A100', memory: 80, cpuCount: 16, spotPrice: 1.25, ondemandPrice: 2.5 }])
  })
  it('does not download remote files that already exist', async () => {
    const shell = c.feature('secureShell', { host: '192.0.2.1' })
    const exec = spyOn(shell, 'exec').mockResolvedValue('EXISTS\n')
    const getShell = spyOn(pod, 'getShell').mockResolvedValue(shell)
    try {
      expect(await pod.ensureFileExists('id', '/models/file', 'https://example.test/model')).toEqual({ existed: true, path: '/models/file' })
      expect(exec).toHaveBeenCalledTimes(1)
    } finally { exec.mockRestore(); getShell.mockRestore() }
  })
  it('reports download progress and waits for the atomic final rename', async () => {
    const shell = c.feature('secureShell', { host: '192.0.2.1' })
    const exec = spyOn(shell, 'exec').mockResolvedValueOnce('MISSING').mockResolvedValueOnce('').mockResolvedValueOnce('').mockResolvedValueOnce('128').mockResolvedValueOnce('DONE')
    const getShell = spyOn(pod, 'getShell').mockResolvedValue(shell)
    const progress = mock(() => {})
    try {
      expect(await pod.ensureFileExists('id', '/models/file', 'https://example.test/model', { pollInterval: 0, timeout: 1000, onProgress: progress })).toEqual({ existed: false, path: '/models/file' })
      expect(progress).toHaveBeenCalledWith(128)
    } finally { exec.mockRestore(); getShell.mockRestore() }
  })
  it('shell-quotes apostrophes in the encoded download command', async () => {
    const shell = c.feature('secureShell', { host: '192.0.2.1' })
    const exec = spyOn(shell, 'exec').mockResolvedValue('MISSING')
    const getShell = spyOn(pod, 'getShell').mockResolvedValue(shell)
    try {
      await expect(pod.ensureFileExists('id', "/models/owner's.bin", "https://example.test/owner's", { timeout: 0 })).rejects.toThrow('Timed out')
      const b64 = exec.mock.calls[2]![0].split(' ')[1]!
      expect(Buffer.from(b64, 'base64').toString()).toBe("wget -q -O '/models/owner'\\''s.bin.partial' 'https://example.test/owner'\\''s' && mv '/models/owner'\\''s.bin.partial' '/models/owner'\\''s.bin'")
    } finally { exec.mockRestore(); getShell.mockRestore() }
  })
})
