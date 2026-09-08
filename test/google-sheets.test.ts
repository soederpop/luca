import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { NodeContainer } from '../src/node/container'
import { googleTransport } from './support/google-transport'

let c: NodeContainer
let root: string
let transport: ReturnType<typeof googleTransport>
beforeEach(() => {
  const host = new NodeContainer()
  root = host.paths.join(host.os.tmpdir, `luca-sheets-${host.utils.uuid()}`)
  host.fs.ensureFolder(root)
  c = new NodeContainer({ cwd: root })
  transport = googleTransport()
})
afterEach(() => c.fs.rmSync(root, { recursive: true, force: true }))
const sheets = () => c.feature('googleSheets', { auth: transport.auth, defaultSpreadsheetId: 'book' })

describe('Google Sheets', () => {
  it('requires a spreadsheet ID before authenticating', async () => {
    await expect(c.feature('googleSheets', { auth: transport.auth }).getRange('A1')).rejects.toThrow('Spreadsheet ID required')
    expect(transport.getAuthClient).not.toHaveBeenCalled()
  })
  it('normalizes metadata and caches its authenticated SDK client', async () => {
    transport.request.mockResolvedValue({ data: { properties: { title: 'Budget' }, sheets: [{ properties: { sheetId: 2, title: 'Costs', gridProperties: { rowCount: 10, columnCount: 4 } } }, {}] } })
    const feature = sheets()
    const meta = await feature.getSpreadsheet()
    expect(meta).toEqual({ spreadsheetId: 'book', title: 'Budget', locale: 'en_US', sheets: [
      { sheetId: 2, title: 'Costs', index: 0, rowCount: 10, columnCount: 4 },
      { sheetId: 0, title: '', index: 0, rowCount: 0, columnCount: 0 },
    ] })
    expect(await feature.listSheets()).toEqual(meta.sheets)
    expect(transport.getAuthClient).toHaveBeenCalledTimes(1)
    expect(feature.state.get('lastSpreadsheetId')).toBe('book')
  })
  it('requests formatted values with an explicit ID override and emits row counts', async () => {
    transport.request.mockResolvedValue({ data: { values: [['x'], ['2']] } })
    const feature = sheets()
    const fetched = mock(() => {})
    feature.on('dataFetched', fetched)
    expect(await feature.getRange('Costs!A1:A2', 'override')).toEqual([['x'], ['2']])
    const options = transport.request.mock.calls[0]![0]
    expect(String(options.url)).toContain('/spreadsheets/override/values/Costs')
    expect(options.params.valueRenderOption).toBe('FORMATTED_VALUE')
    expect(feature.state.get('lastSheetName')).toBe('Costs')
    expect(feature.state.get('lastRowCount')).toBe(2)
    expect(fetched).toHaveBeenCalledWith(2)
  })
  it('converts header rows to objects and fills missing cells', async () => {
    transport.request.mockResolvedValue({ data: { values: [['name', 'count'], ['one', '0'], ['two']] } })
    expect(await sheets().getAsJson('Data')).toEqual([{ name: 'one', count: '0' }, { name: 'two', count: '' }])
  })
  it.each([{}, { values: [] }, { values: [['header']] }])('returns no JSON records for %j', async (data) => {
    transport.request.mockResolvedValue({ data })
    expect(await sheets().getAsJson('Data')).toEqual([])
  })
  it('discovers the first sheet when no name is supplied', async () => {
    transport.request.mockResolvedValueOnce({ data: { sheets: [{ properties: { title: 'First' } }] } })
      .mockResolvedValueOnce({ data: { values: [['key'], ['value']] } })
    expect(await sheets().getAsJson()).toEqual([{ key: 'value' }])
    expect(String(transport.request.mock.calls[1]![0].url)).toContain('/values/First')
  })
  it('escapes commas, quotes and newlines in CSV', async () => {
    transport.request.mockResolvedValue({ data: { values: [['a,b', 'say "hi"', 'two\nlines', 'plain']] } })
    expect(await sheets().getAsCsv('Data')).toBe('"a,b","say ""hi""","two\nlines",plain')
  })
  it('uses Sheet1 when metadata has no tabs', async () => {
    transport.request.mockResolvedValueOnce({ data: {} }).mockResolvedValueOnce({ data: {} })
    expect(await sheets().getAsCsv()).toBe('')
    expect(String(transport.request.mock.calls[1]![0].url)).toContain('/values/Sheet1')
  })
  it('writes JSON and CSV exports through the container filesystem', async () => {
    transport.request.mockResolvedValue({ data: { values: [['key'], ['value']] } })
    const feature = sheets()
    expect(await feature.saveAsJson('data.json', 'Data')).toBe(c.paths.resolve('data.json'))
    expect(JSON.parse(String(c.fs.readFile('data.json')))).toEqual([{ key: 'value' }])
    expect(await feature.saveAsCsv('data.csv', 'Data')).toBe(c.paths.resolve('data.csv'))
    expect(c.fs.readFile('data.csv')).toBe('key\nvalue')
  })
  it.each(['getSpreadsheet', 'getRange'] as const)('%s records and emits the original API error', async (method) => {
    const error = new Error('quota exceeded')
    transport.request.mockRejectedValue(error)
    const feature = sheets()
    const failed = mock(() => {})
    feature.on('error', failed)
    await expect(feature[method]('Data')).rejects.toBe(error)
    expect(feature.state.get('lastError')).toBe('quota exceeded')
    expect(failed).toHaveBeenCalledWith(error)
  })
})
