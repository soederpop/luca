import { beforeEach, afterEach, describe, expect, it, mock } from 'bun:test'
import { NodeContainer } from '../src/node/container'
import { googleTransport } from './support/google-transport'
let c: NodeContainer
let root: string
let t: ReturnType<typeof googleTransport>
beforeEach(() => {
  const host = new NodeContainer()
  root = host.paths.join(host.os.tmpdir, `luca-drive-${host.utils.uuid()}`)
  host.fs.ensureFolder(root)
  c = new NodeContainer({ cwd: root }); t = googleTransport()
})
afterEach(() => c.fs.rmSync(root, { recursive: true, force: true }))
const drive = (options = {}) => c.feature('googleDrive', { auth: t.auth, ...options })

describe('Google Drive', () => {
  it('normalizes metadata, emits counts and preserves pagination', async () => {
    t.request.mockResolvedValue({ data: { files: [{ id: 'f', name: 'Report', mimeType: 'text/plain', owners: [{ displayName: 'Owner', emailAddress: 'owner@example.test' }] }, {}], nextPageToken: 'next' } })
    const feature = drive()
    const fetched = mock(() => {})
    feature.on('filesFetched', fetched)
    const result = await feature.listFiles('trashed = false')
    expect(result.files[0]).toMatchObject({ id: 'f', name: 'Report', owners: [{ emailAddress: 'owner@example.test' }] })
    expect(result.files[1]).toMatchObject({ id: '', name: '', mimeType: '' })
    expect(result.nextPageToken).toBe('next')
    expect(feature.state.get('lastQuery')).toBe('trashed = false')
    expect(fetched).toHaveBeenCalledWith(2)
  })
  it('sends shared-drive and pagination options while reusing authentication', async () => {
    const feature = drive({ pageSize: 5, defaultCorpora: 'allDrives' })
    expect(await feature.listFiles()).toEqual({ files: [], nextPageToken: undefined })
    expect(t.request.mock.calls[0]![0].params).toMatchObject({ pageSize: 5, corpora: 'allDrives', includeItemsFromAllDrives: true, supportsAllDrives: true })
    await feature.listFiles('name = "x"', { pageSize: 2, corpora: 'user', pageToken: 'p', orderBy: 'name', fields: 'files(id)' })
    expect(t.request.mock.calls[1]![0].params).toMatchObject({ pageSize: 2, corpora: 'user', pageToken: 'p', orderBy: 'name', fields: 'files(id)', includeItemsFromAllDrives: false })
    expect(t.getAuthClient).toHaveBeenCalledTimes(1)
  })
  it('escapes apostrophes in full-text search and combines filters', async () => {
    await drive().search("owner's report", { mimeType: 'text/plain', inFolder: 'folder' })
    expect(t.request.mock.calls[0]![0].params.q).toBe("fullText contains 'owner\\'s report' and mimeType = 'text/plain' and 'folder' in parents and trashed = false")
  })
  it('separates folders from files when browsing root', async () => {
    t.request.mockResolvedValueOnce({ data: { id: 'root', name: 'My Drive' } })
      .mockResolvedValueOnce({ data: { files: [{ id: 'dir', mimeType: 'application/vnd.google-apps.folder' }, { id: 'file', mimeType: 'text/plain' }], nextPageToken: 'more-children' } })
    const result = await drive().browse()
    expect(result.folder.id).toBe('root')
    expect(result.nextPageToken).toBe('more-children')
    expect(result.folders.map(f => f.id)).toEqual(['dir'])
    expect(result.files.map(f => f.id)).toEqual(['file'])
    expect(t.request.mock.calls[1]![0].params.q).toBe("'root' in parents and trashed = false")
  })
  it('retrieves requested metadata fields', async () => {
    t.request.mockResolvedValue({ data: { id: 'f', name: 'hello' } })
    expect(await drive().getFile('f', 'id,name')).toMatchObject({ id: 'f', name: 'hello' })
    expect(t.request.mock.calls[0]![0].params.fields).toBe('id,name')
  })
  it('downloads exact bytes to disk and emits the file ID', async () => {
    const bytes = Buffer.from([0, 1, 128, 255])
    t.request.mockResolvedValue({ data: bytes })
    const feature = drive()
    const downloaded = mock(() => {})
    feature.on('fileDownloaded', downloaded)
    expect(await feature.downloadTo('binary', 'out.bin')).toBe(c.paths.resolve('out.bin'))
    expect(c.fs.readFile('out.bin', null)).toEqual(bytes)
    expect(t.request.mock.calls[0]![0]).toMatchObject({ responseType: 'arraybuffer', params: { alt: 'media' } })
    expect(downloaded).toHaveBeenCalledWith('binary')
  })
  it('exports with the requested MIME type', async () => {
    t.request.mockResolvedValue({ data: Buffer.from('export') })
    expect((await drive().exportFile('doc', 'text/plain')).toString()).toBe('export')
    expect(t.request.mock.calls[0]![0].params.mimeType).toBe('text/plain')
  })
  it('lists shared drives with optional metadata', async () => {
    t.request.mockResolvedValueOnce({ data: { drives: [{ id: 'd', name: 'Team', colorRgb: '#fff' }, {}] } })
    const feature = drive()
    expect(await feature.listDrives()).toEqual([{ id: 'd', name: 'Team', colorRgb: '#fff' }, { id: '', name: '', colorRgb: undefined }])
    expect(await feature.listDrives()).toEqual([])
  })
  it.each(['listFiles', 'getFile', 'download', 'exportFile', 'listDrives'] as const)('%s publishes and rethrows failures', async (method) => {
    const feature = drive()
    const error = new Error('drive denied')
    const failed = mock(() => {})
    feature.on('error', failed)
    t.request.mockRejectedValue(error)
    const result = method === 'exportFile' ? feature.exportFile('id', 'text/plain') : method === 'listDrives' ? feature.listDrives() : feature[method]('id')
    await expect(result).rejects.toBe(error)
    expect(feature.state.get('lastError')).toBe(error.message)
    expect(failed).toHaveBeenCalledWith(error)
  })
})
