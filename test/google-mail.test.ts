import { beforeEach, afterEach, describe, expect, it, mock } from 'bun:test'
import { NodeContainer } from '../src/node/container'
import { googleTransport } from './support/google-transport'
let c: NodeContainer
let t: ReturnType<typeof googleTransport>
let feature: ReturnType<NodeContainer['feature']> | undefined
beforeEach(() => { c = new NodeContainer(); t = googleTransport(); feature = undefined })
const mail = (options = {}) => {
  const instance = c.feature('googleMail', { auth: t.auth, ...options })
  feature = instance
  return instance
}
afterEach(() => { if (feature && 'stopWatching' in feature) (feature as any).stopWatching() })
const encoded = (text: string) => Buffer.from(text).toString('base64url')

describe('Google Mail', () => {
  it('builds combined search filters, fetches message references and retains pagination', async () => {
    t.request.mockResolvedValueOnce({ data: { messages: [{ id: 'one' }, {}], nextPageToken: 'next', resultSizeEstimate: 9 } })
      .mockResolvedValueOnce({ data: { id: 'one', labelIds: ['UNREAD'], payload: { headers: [{ name: 'sUbJeCt', value: 'Hello' }], body: { data: encoded('café') } } } })
    const m = mail(); const fetched = mock(() => {}); m.on('messagesFetched', fetched)
    const result = await m.search({ query: 'report', from: 'a@example.test', to: 'b@example.test', subject: 'budget', after: '2026/01/01', before: '2026/02/01', hasAttachment: true, label: 'work', isUnread: true, maxResults: 5, pageToken: 'page' })
    expect(result).toMatchObject({ messages: [{ id: 'one', subject: 'Hello', body: 'café', isUnread: true }], nextPageToken: 'next', resultSizeEstimate: 9 })
    expect(t.request.mock.calls[0]![0].params).toMatchObject({ q: 'report from:a@example.test to:b@example.test subject:budget after:2026/01/01 before:2026/02/01 has:attachment label:work is:unread', maxResults: 5, pageToken: 'page' })
    expect(fetched).toHaveBeenCalledWith(1)
    expect(m.state.get('lastResultCount')).toBe(1)
    expect(t.getAuthClient).toHaveBeenCalledTimes(1)
  })
  it('returns an empty search without trying to fetch messages', async () => {
    expect((await mail().search()).messages).toEqual([])
    expect(t.request).toHaveBeenCalledTimes(1)
  })
  it('prefers plain text and preserves HTML and nested attachment metadata', async () => {
    t.request.mockResolvedValue({ data: { id: 'm', payload: { headers: [{ name: 'From', value: 'sender' }, { name: 'To', value: 'recipient' }, { name: 'Cc', value: 'copy' }, { name: 'Date', value: 'today' }], parts: [
      { mimeType: 'text/html', body: { data: encoded('<b>rich</b>') } },
      { mimeType: 'text/plain', body: { data: encoded('plain') } },
      { parts: [{ filename: 'file.pdf', mimeType: 'application/pdf', body: { attachmentId: 'attachment', size: 42 } }] },
    ] } } })
    expect(await mail().getMessage('m')).toMatchObject({ body: 'plain', bodyHtml: '<b>rich</b>', from: 'sender', to: 'recipient', cc: 'copy', date: 'today', isUnread: false, hasAttachments: true, attachments: [{ filename: 'file.pdf', mimeType: 'application/pdf', size: 42, attachmentId: 'attachment' }] })
  })
  it.each([
    { mimeType: 'text/html', body: { data: encoded('<p>hello</p>') } },
    { parts: [{ parts: [{ mimeType: 'text/html', body: { data: encoded('<p>hello</p>') } }] }] },
  ])('extracts HTML-only and nested messages %j', async (payload) => {
    t.request.mockResolvedValue({ data: { payload } })
    expect(await mail().getMessage('m')).toMatchObject({ body: '<p>hello</p>', bodyHtml: '<p>hello</p>' })
  })
  it('normalizes missing payloads and honors user and format overrides', async () => {
    expect(await mail({ userId: 'other', format: 'minimal' }).getMessage('m', 'metadata')).toMatchObject({ id: '', body: '', subject: '', labelIds: [], attachments: [], hasAttachments: false })
    expect(String(t.request.mock.calls[0]![0].url)).toContain('/users/other/messages/m')
    expect(t.request.mock.calls[0]![0].params.format).toBe('metadata')
  })
  it('normalizes threads with and without messages', async () => {
    t.request.mockResolvedValueOnce({ data: { id: 'thread', historyId: '2', messages: [{ id: 'm' }] } })
    const m = mail()
    expect(await m.getThread('thread')).toMatchObject({ id: 'thread', historyId: '2', messages: [{ id: 'm' }] })
    expect(await m.getThread('empty')).toEqual({ id: '', historyId: '', snippet: '', messages: [] })
  })
  it('falls back to basic labels when a detail request fails', async () => {
    t.request.mockResolvedValueOnce({ data: { labels: [{ id: 'one', name: 'One' }, { id: 'two', name: 'Two' }, {}] } })
      .mockResolvedValueOnce({ data: { id: 'one', name: 'One', type: 'user', messagesTotal: 5, messagesUnread: 2 } })
      .mockRejectedValueOnce(new Error('label removed'))
    expect(await mail().listLabels()).toEqual([{ id: 'one', name: 'One', type: 'user', messagesTotal: 5, messagesUnread: 2 }, { id: 'two', name: 'Two', type: '' }])
  })
  it.each(['search', 'getMessage', 'getThread', 'listLabels'] as const)('%s records and rethrows API errors', async (method) => {
    const m = mail(); const error = new Error('mail denied'); const failed = mock(() => {})
    m.on('error', failed); t.request.mockRejectedValue(error)
    const result = method === 'search' || method === 'listLabels' ? m[method]() : m[method]('id')
    await expect(result).rejects.toBe(error)
    expect(m.state.get('lastError')).toBe(error.message)
    expect(failed).toHaveBeenCalledWith(error)
  })
  it('watch lifecycle is idempotent and stops polling', async () => {
    t.request.mockResolvedValue({ data: { historyId: '100' } })
    const m = mail({ pollInterval: 1000 }); const started = mock(() => {}); const stopped = mock(() => {})
    m.on('watchStarted', started); m.on('watchStopped', stopped)
    await m.startWatching(); await m.startWatching(); m.stopWatching(); m.stopWatching()
    expect(t.request).toHaveBeenCalledTimes(1)
    expect(started).toHaveBeenCalledTimes(1)
    expect(stopped).toHaveBeenCalledTimes(1)
  })
  it('deduplicates message additions, advances history and emits new mail', async () => {
    t.request.mockImplementation(async (options) => {
      const url = String(options.url)
      if (url.endsWith('/profile')) return { data: { historyId: '100' } }
      if (url.endsWith('/history')) return { data: { historyId: '101', history: [{ messagesAdded: [{ message: { id: 'new' } }, { message: { id: 'new' } }, {}] }] } }
      return { data: { id: 'new', payload: { body: { data: encoded('new mail') } } } }
    })
    const m = mail({ pollInterval: 1 })
    const received = new Promise<any[]>(resolve => m.once('newMail', resolve))
    await m.startWatching()
    const messages = await received
    m.stopWatching()
    expect(messages.map(message => message.id)).toEqual(['new'])
    expect(t.request.mock.calls.filter(([options]) => String(options.url).includes('/messages/'))).toHaveLength(1)
  })
})
