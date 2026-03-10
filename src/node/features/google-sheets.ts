import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from '../../schemas/base.js'
import { Feature } from '../feature.js'
import { google, type sheets_v4 } from 'googleapis'
import type { GoogleAuth } from './google-auth.js'

export type SpreadsheetMeta = {
  spreadsheetId: string
  title: string
  locale: string
  sheets: SheetInfo[]
}

export type SheetInfo = {
  sheetId: number
  title: string
  index: number
  rowCount: number
  columnCount: number
}

export const GoogleSheetsStateSchema = FeatureStateSchema.extend({
  lastSpreadsheetId: z.string().optional()
    .describe('Last spreadsheet ID accessed'),
  lastSheetName: z.string().optional()
    .describe('Last sheet/tab name accessed'),
  lastRowCount: z.number().optional()
    .describe('Number of rows returned in last read'),
  lastError: z.string().optional()
    .describe('Last Sheets API error message'),
})
export type GoogleSheetsState = z.infer<typeof GoogleSheetsStateSchema>

export const GoogleSheetsOptionsSchema = FeatureOptionsSchema.extend({
  defaultSpreadsheetId: z.string().optional()
    .describe('Default spreadsheet ID for operations'),
})
export type GoogleSheetsOptions = z.infer<typeof GoogleSheetsOptionsSchema>

export const GoogleSheetsEventsSchema = FeatureEventsSchema.extend({
  dataFetched: z.tuple([z.number().describe('Number of rows')])
    .describe('Sheet data was fetched'),
  error: z.tuple([z.any().describe('The error')]).describe('Sheets API error occurred'),
})

/**
 * Google Sheets feature for reading spreadsheet data as JSON, CSV, or raw arrays.
 *
 * Depends on the googleAuth feature for authentication. Creates a Sheets v4 API
 * client lazily and provides convenient methods for reading tabular data.
 *
 * @example
 * ```typescript
 * const sheets = container.feature('googleSheets', {
 *   defaultSpreadsheetId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms'
 * })
 *
 * // Read as JSON objects (first row = headers)
 * const data = await sheets.getAsJson('Sheet1')
 * // => [{ name: 'Alice', age: '30' }, { name: 'Bob', age: '25' }]
 *
 * // Read as CSV string
 * const csv = await sheets.getAsCsv('Revenue')
 *
 * // Read a specific range
 * const values = await sheets.getRange('Sheet1!A1:D10')
 *
 * // Save to file
 * await sheets.saveAsJson('./data/export.json')
 * ```
 */
export class GoogleSheets extends Feature<GoogleSheetsState, GoogleSheetsOptions> {
  static override shortcut = 'features.googleSheets' as const
  static override stateSchema = GoogleSheetsStateSchema
  static override optionsSchema = GoogleSheetsOptionsSchema
  static override eventsSchema = GoogleSheetsEventsSchema
  static { Feature.register(this, 'googleSheets') }

  private _sheets?: sheets_v4.Sheets

  override get initialState(): GoogleSheetsState {
    return { ...super.initialState }
  }

  /** Access the google-auth feature lazily. */
  get auth(): GoogleAuth {
    return this.container.feature('googleAuth') as unknown as GoogleAuth
  }

  /** Get or create the Sheets v4 API client. */
  private async getSheets(): Promise<sheets_v4.Sheets> {
    if (this._sheets) return this._sheets
    const auth = await this.auth.getAuthClient()
    this._sheets = google.sheets({ version: 'v4', auth: auth as any })
    return this._sheets
  }

  /** Resolve spreadsheet ID from argument or default option. */
  private resolveId(spreadsheetId?: string): string {
    const id = spreadsheetId || this.options.defaultSpreadsheetId
    if (!id) throw new Error('Spreadsheet ID required. Pass it as argument or set options.defaultSpreadsheetId.')
    return id
  }

  /**
   * Get spreadsheet metadata including title, locale, and sheet list.
   *
   * @param spreadsheetId - The spreadsheet ID (defaults to options.defaultSpreadsheetId)
   */
  async getSpreadsheet(spreadsheetId?: string): Promise<SpreadsheetMeta> {
    const id = this.resolveId(spreadsheetId)
    try {
      const sheets = await this.getSheets()
      const res = await sheets.spreadsheets.get({ spreadsheetId: id })
      const data = res.data

      this.setState({ lastSpreadsheetId: id })
      return {
        spreadsheetId: data.spreadsheetId || id,
        title: data.properties?.title || '',
        locale: data.properties?.locale || 'en_US',
        sheets: (data.sheets || []).map(s => ({
          sheetId: s.properties?.sheetId || 0,
          title: s.properties?.title || '',
          index: s.properties?.index || 0,
          rowCount: s.properties?.gridProperties?.rowCount || 0,
          columnCount: s.properties?.gridProperties?.columnCount || 0,
        })),
      }
    } catch (err: any) {
      this.setState({ lastError: err.message })
      this.emit('error', err)
      throw err
    }
  }

  /**
   * List all sheets (tabs) in a spreadsheet.
   *
   * @param spreadsheetId - The spreadsheet ID
   */
  async listSheets(spreadsheetId?: string): Promise<SheetInfo[]> {
    const meta = await this.getSpreadsheet(spreadsheetId)
    return meta.sheets
  }

  /**
   * Read a range of values from a sheet.
   *
   * @param range - A1 notation range (e.g. "Sheet1!A1:D10" or "Sheet1" for entire sheet)
   * @param spreadsheetId - The spreadsheet ID
   * @returns Raw values as a 2D string array
   */
  async getRange(range: string, spreadsheetId?: string): Promise<string[][]> {
    const id = this.resolveId(spreadsheetId)
    try {
      const sheets = await this.getSheets()
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: id,
        range,
        valueRenderOption: 'FORMATTED_VALUE',
      })

      const values = (res.data.values || []) as string[][]
      this.setState({
        lastSpreadsheetId: id,
        lastSheetName: range.split('!')[0],
        lastRowCount: values.length,
      })
      this.emit('dataFetched', values.length)
      return values
    } catch (err: any) {
      this.setState({ lastError: err.message })
      this.emit('error', err)
      throw err
    }
  }

  /**
   * Read a sheet as an array of JSON objects.
   * The first row is treated as headers; subsequent rows become objects keyed by those headers.
   *
   * @param sheetName - Name of the sheet tab (if omitted, reads the first sheet)
   * @param spreadsheetId - The spreadsheet ID
   */
  async getAsJson<T extends Record<string, any> = Record<string, string>>(
    sheetName?: string,
    spreadsheetId?: string
  ): Promise<T[]> {
    const id = this.resolveId(spreadsheetId)

    // If no sheet name, get the first sheet's name
    let range: string
    if (sheetName) {
      range = sheetName
    } else {
      const meta = await this.getSpreadsheet(id)
      range = meta.sheets[0]?.title || 'Sheet1'
    }

    const values = await this.getRange(range, id)
    if (values.length < 2) return []

    const headers = values[0]!
    return values.slice(1).map(row => {
      const obj: Record<string, string> = {}
      headers.forEach((header, i) => {
        obj[header] = row[i] || ''
      })
      return obj as T
    })
  }

  /**
   * Read a sheet and return it as a CSV string.
   *
   * @param sheetName - Name of the sheet tab (if omitted, reads the first sheet)
   * @param spreadsheetId - The spreadsheet ID
   */
  async getAsCsv(sheetName?: string, spreadsheetId?: string): Promise<string> {
    const id = this.resolveId(spreadsheetId)

    let range: string
    if (sheetName) {
      range = sheetName
    } else {
      const meta = await this.getSpreadsheet(id)
      range = meta.sheets[0]?.title || 'Sheet1'
    }

    const values = await this.getRange(range, id)
    return values.map(row =>
      row.map(cell => {
        const str = String(cell)
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`
        }
        return str
      }).join(',')
    ).join('\n')
  }

  /**
   * Download sheet data as JSON and save to a local file.
   *
   * @param localPath - Local file path (resolved relative to container cwd)
   * @param sheetName - Sheet tab name (defaults to first sheet)
   * @param spreadsheetId - The spreadsheet ID
   * @returns Absolute path of the saved file
   */
  async saveAsJson(localPath: string, sheetName?: string, spreadsheetId?: string): Promise<string> {
    const data = await this.getAsJson(sheetName, spreadsheetId)
    const outPath = this.container.paths.resolve(localPath)
    await this.container.fs.writeFileAsync(outPath, JSON.stringify(data, null, 2))
    return outPath
  }

  /**
   * Download sheet data as CSV and save to a local file.
   *
   * @param localPath - Local file path (resolved relative to container cwd)
   * @param sheetName - Sheet tab name (defaults to first sheet)
   * @param spreadsheetId - The spreadsheet ID
   * @returns Absolute path of the saved file
   */
  async saveAsCsv(localPath: string, sheetName?: string, spreadsheetId?: string): Promise<string> {
    const csv = await this.getAsCsv(sheetName, spreadsheetId)
    const outPath = this.container.paths.resolve(localPath)
    await this.container.fs.writeFileAsync(outPath, csv)
    return outPath
  }
}

declare module '../../feature' {
  interface AvailableFeatures {
    googleSheets: typeof GoogleSheets
  }
}

export default GoogleSheets