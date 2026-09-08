import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { NodeContainer } from '../src/node/container'
import { googleTransport } from './support/google-transport'
let c: NodeContainer
let root: string
let t: ReturnType<typeof googleTransport>
beforeEach(() => {
  const host = new NodeContainer()
  root = host.paths.join(host.os.tmpdir, `luca-docs-${host.utils.uuid()}`)
  host.fs.ensureFolder(root); c = new NodeContainer({ cwd: root }); t = googleTransport()
})
afterEach(() => c.fs.rmSync(root, { recursive: true, force: true }))
const docs = () => c.feature('googleDocs', { auth: t.auth })
const paragraph = (text: string, style: any = {}, extra: any = {}) => ({ paragraph: { elements: [{ textRun: { content: text, textStyle: style } }], ...extra } })
const respond = (content: any[], extra = {}) => t.request.mockResolvedValue({ data: { title: 'Example', body: { content }, ...extra } })

describe('Google Docs conversion', () => {
  it('returns the raw document, tracks metadata and reuses authentication', async () => {
    respond([paragraph('Hello\n')])
    const feature = docs()
    const fetched = mock(() => {})
    feature.on('documentFetched', fetched)
    expect(await feature.getDocument('doc')).toMatchObject({ title: 'Example' })
    expect(feature.state.get('lastDocId')).toBe('doc')
    expect(feature.state.get('lastDocTitle')).toBe('Example')
    expect(fetched).toHaveBeenCalledWith('doc', 'Example')
    await feature.getDocument('doc')
    expect(t.getAuthClient).toHaveBeenCalledTimes(1)
  })
  it.each([['TITLE', '#'], ['SUBTITLE', '##'], ['HEADING_1', '#'], ['HEADING_2', '##'], ['HEADING_3', '###'], ['HEADING_4', '####'], ['HEADING_5', '#####'], ['HEADING_6', '######']])('converts %s headings', async (style, prefix) => {
    respond([paragraph('Heading\n', {}, { paragraphStyle: { namedStyleType: style } })])
    expect(await docs().getAsMarkdown('doc')).toBe(`${prefix} Heading\n`)
  })
  it.each([
    [{ bold: true }, '**text**'], [{ italic: true }, '*text*'], [{ strikethrough: true }, '~~text~~'],
    [{ bold: true, italic: true, strikethrough: true }, '***~~text~~***'],
    [{ weightedFontFamily: { fontFamily: 'Courier New' }, bold: true }, '`text`'],
    [{ link: { url: 'https://example.test' }, bold: true }, '[**text**](https://example.test)'],
  ])('converts inline styles %j', async (style, expected) => {
    respond([paragraph('text\n', style)])
    expect(await docs().getAsMarkdown('doc')).toBe(`${expected}\n`)
  })
  it('preserves ordered and nested unordered lists', async () => {
    respond([
      paragraph('first\n', {}, { bullet: { listId: 'ordered' } }),
      paragraph('nested\n', {}, { bullet: { listId: 'unordered', nestingLevel: 1 } }),
    ], { lists: { ordered: { listProperties: { nestingLevels: [{ glyphType: 'DECIMAL' }] } }, unordered: { listProperties: { nestingLevels: [{}, {}] } } } })
    expect(await docs().getAsMarkdown('doc')).toBe('1. first\n  - nested\n')
  })
  it('renders images, skips missing objects, and falls back to source URI and description', async () => {
    respond([{ paragraph: { elements: [{ inlineObjectElement: { inlineObjectId: 'image' } }, { inlineObjectElement: { inlineObjectId: 'missing' } }] } }], {
      inlineObjects: { image: { inlineObjectProperties: { embeddedObject: { description: 'Alt', imageProperties: { sourceUri: 'https://example.test/image.png' } } } } },
    })
    expect(await docs().getAsMarkdown('doc')).toBe('![Alt](https://example.test/image.png)\n')
  })
  it('converts table cells and escapes Markdown pipes', async () => {
    respond([{ table: { tableRows: [
      { tableCells: [{ content: [paragraph('A\n')] }, { content: [paragraph('B\n')] }] },
      { tableCells: [{ content: [paragraph('x|y\n')] }, { content: [paragraph('z\n')] }] },
    ] } }])
    expect(await docs().getAsMarkdown('doc')).toBe('| A | B |\n| --- | --- |\n| x\\|y | z |\n')
  })
  it('extracts unformatted paragraphs and tab-separated table text', async () => {
    respond([paragraph('Hello\n', { bold: true }), { table: { tableRows: [{ tableCells: [{ content: [paragraph('a')] }, { content: [paragraph('b\n')] }] }] } }])
    expect(await docs().getAsText('doc')).toBe('Hello\na\tb\n')
  })
  it('handles empty bodies, empty tables and section breaks', async () => {
    const feature = docs()
    expect(await feature.getAsText('empty')).toBe('\n')
    respond([paragraph('\n', { bold: true }), { table: {} }, { sectionBreak: {} }, paragraph('end\n')])
    expect(await feature.getAsMarkdown('doc')).toBe('---\n\nend\n')
  })
  it('writes converted Markdown to a resolved local path', async () => {
    respond([paragraph('Saved\n')])
    expect(await docs().saveAsMarkdown('doc', 'saved.md')).toBe(c.paths.resolve('saved.md'))
    expect(c.fs.readFile('saved.md')).toBe('Saved\n')
  })
  it('publishes and rethrows document errors', async () => {
    const feature = docs(); const failed = mock(() => {}); const error = new Error('not found')
    feature.on('error', failed); t.request.mockRejectedValue(error)
    await expect(feature.getDocument('doc')).rejects.toBe(error)
    expect(failed).toHaveBeenCalledWith(error)
    expect(feature.state.get('lastError')).toBe(error.message)
  })
  it('uses the supplied authentication when searching through Drive', async () => {
    t.request.mockResolvedValue({ data: { files: [{ id: 'doc' }] } })
    const feature = docs()
    expect((await feature.listDocs("owner's", { pageSize: 3 }))[0]?.id).toBe('doc')
    expect(t.request.mock.calls[0]![0].params.q).toBe("mimeType = 'application/vnd.google-apps.document' and trashed = false and name contains 'owner\\'s'")
    expect((await feature.searchDocs('topic'))[0]?.id).toBe('doc')
    expect(t.request.mock.calls[1]![0].params.q).toContain("mimeType = 'application/vnd.google-apps.document'")
  })
})
