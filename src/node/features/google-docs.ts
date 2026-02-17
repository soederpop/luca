import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from '../../schemas/base.js'
import { Feature, features } from '../feature.js'
import { google, type docs_v1 } from 'googleapis'
import type { GoogleAuth } from './google-auth.js'
import type { GoogleDrive, DriveFile } from './google-drive.js'
import { writeFile } from 'fs/promises'

export const GoogleDocsStateSchema = FeatureStateSchema.extend({
  lastDocId: z.string().optional()
    .describe('Last document ID accessed'),
  lastDocTitle: z.string().optional()
    .describe('Title of the last document accessed'),
  lastError: z.string().optional()
    .describe('Last Docs API error message'),
})
export type GoogleDocsState = z.infer<typeof GoogleDocsStateSchema>

export const GoogleDocsOptionsSchema = FeatureOptionsSchema.extend({})
export type GoogleDocsOptions = z.infer<typeof GoogleDocsOptionsSchema>

export const GoogleDocsEventsSchema = FeatureEventsSchema.extend({
  documentFetched: z.tuple([z.string().describe('Document ID'), z.string().describe('Title')])
    .describe('A document was fetched'),
  error: z.tuple([z.any().describe('The error')]).describe('Docs API error occurred'),
})

/**
 * Google Docs feature for reading documents and converting them to Markdown.
 *
 * Depends on googleAuth for authentication and optionally googleDrive for listing docs.
 * The markdown converter handles headings, text formatting, links, lists, tables, and images.
 *
 * @example
 * ```typescript
 * const docs = container.feature('googleDocs')
 *
 * // Get a doc as markdown
 * const markdown = await docs.getAsMarkdown('1abc_document_id')
 *
 * // Save to file
 * await docs.saveAsMarkdown('1abc_document_id', './output/doc.md')
 *
 * // List all Google Docs in Drive
 * const allDocs = await docs.listDocs()
 *
 * // Get raw document structure
 * const rawDoc = await docs.getDocument('1abc_document_id')
 *
 * // Plain text extraction
 * const text = await docs.getAsText('1abc_document_id')
 * ```
 */
export class GoogleDocs extends Feature<GoogleDocsState, GoogleDocsOptions> {
  static override shortcut = 'features.googleDocs' as const
  static override stateSchema = GoogleDocsStateSchema
  static override optionsSchema = GoogleDocsOptionsSchema
  static override eventsSchema = GoogleDocsEventsSchema

  private _docs?: docs_v1.Docs

  override get initialState(): GoogleDocsState {
    return { ...super.initialState }
  }

  /** Access the google-auth feature lazily. */
  get auth(): GoogleAuth {
    return this.container.feature('googleAuth') as unknown as GoogleAuth
  }

  /** Access the google-drive feature lazily. */
  get drive(): GoogleDrive {
    return this.container.feature('googleDrive') as unknown as GoogleDrive
  }

  /** Get or create the Docs v1 API client. */
  private async getDocs(): Promise<docs_v1.Docs> {
    if (this._docs) return this._docs
    const auth = await this.auth.getAuthClient()
    this._docs = google.docs({ version: 'v1', auth: auth as any })
    return this._docs
  }

  /**
   * Get the raw document structure from the Docs API.
   *
   * @param documentId - The Google Docs document ID
   * @returns Full document JSON including body, lists, inlineObjects, etc.
   */
  async getDocument(documentId: string): Promise<docs_v1.Schema$Document> {
    try {
      const docs = await this.getDocs()
      const res = await docs.documents.get({ documentId })
      const doc = res.data

      this.setState({
        lastDocId: documentId,
        lastDocTitle: doc.title || undefined,
      })
      this.emit('documentFetched', documentId, doc.title || '')
      return doc
    } catch (err: any) {
      this.setState({ lastError: err.message })
      this.emit('error', err)
      throw err
    }
  }

  /**
   * Read a Google Doc and convert it to Markdown.
   *
   * Handles headings, bold/italic/strikethrough, links, code fonts, ordered/unordered
   * lists with nesting, tables, images, and section breaks.
   *
   * @param documentId - The Google Docs document ID
   * @returns Markdown string representation of the document
   */
  async getAsMarkdown(documentId: string): Promise<string> {
    const doc = await this.getDocument(documentId)
    return convertDocToMarkdown(doc)
  }

  /**
   * Read a Google Doc as plain text (strips all formatting).
   *
   * @param documentId - The Google Docs document ID
   */
  async getAsText(documentId: string): Promise<string> {
    const doc = await this.getDocument(documentId)
    return extractPlainText(doc)
  }

  /**
   * Download a Google Doc as Markdown and save to a local file.
   *
   * @param documentId - The Google Docs document ID
   * @param localPath - Local file path (resolved relative to container cwd)
   * @returns Absolute path of the saved file
   */
  async saveAsMarkdown(documentId: string, localPath: string): Promise<string> {
    const markdown = await this.getAsMarkdown(documentId)
    const outPath = this.container.paths.resolve(localPath)
    await writeFile(outPath, markdown)
    return outPath
  }

  /**
   * List Google Docs in Drive (filters by Docs MIME type).
   *
   * @param query - Optional additional Drive search query
   * @param options - Pagination options
   */
  async listDocs(query?: string, options?: { pageSize?: number; pageToken?: string }): Promise<DriveFile[]> {
    const parts = ["mimeType = 'application/vnd.google-apps.document'", 'trashed = false']
    if (query) parts.push(`name contains '${query.replace(/'/g, "\\'")}'`)
    const { files } = await this.drive.listFiles(parts.join(' and '), options)
    return files
  }

  /**
   * Search for Google Docs by name or content.
   *
   * @param term - Search term
   */
  async searchDocs(term: string): Promise<DriveFile[]> {
    const { files } = await this.drive.search(term, {
      mimeType: 'application/vnd.google-apps.document',
    })
    return files
  }
}

// ─── Markdown Converter ─────────────────────────────────────────────────────

type ListInfo = {
  ordered: boolean
}

/**
 * Convert a Google Docs API document to Markdown.
 */
function convertDocToMarkdown(doc: docs_v1.Schema$Document): string {
  const body = doc.body?.content || []
  const lists = doc.lists || {}
  const inlineObjects = doc.inlineObjects || {}
  const lines: string[] = []

  // Build list type lookup: listId + nestingLevel → ordered/unordered
  const listLookup = new Map<string, ListInfo>()
  for (const [listId, listDef] of Object.entries(lists)) {
    const levels = listDef.listProperties?.nestingLevels || []
    levels.forEach((level, i) => {
      const glyphType = level.glyphType
      // DECIMAL, ALPHA, ROMAN = ordered; everything else (bullet/none) = unordered
      const ordered = glyphType === 'DECIMAL' || glyphType === 'ALPHA' || glyphType === 'UPPER_ALPHA'
        || glyphType === 'ROMAN' || glyphType === 'UPPER_ROMAN'
      listLookup.set(`${listId}:${i}`, { ordered })
    })
  }

  for (const element of body) {
    if (element.paragraph) {
      const para = element.paragraph
      const line = convertParagraph(para, listLookup, inlineObjects)
      lines.push(line)
    } else if (element.table) {
      const tableLines = convertTable(element.table, listLookup, inlineObjects)
      lines.push('', ...tableLines, '')
    } else if (element.sectionBreak) {
      lines.push('', '---', '')
    }
  }

  // Clean up: collapse 3+ consecutive blank lines into 2
  let result = lines.join('\n')
  result = result.replace(/\n{3,}/g, '\n\n')
  return result.trim() + '\n'
}

function convertParagraph(
  para: docs_v1.Schema$Paragraph,
  listLookup: Map<string, ListInfo>,
  inlineObjects: Record<string, docs_v1.Schema$InlineObject>
): string {
  const style = para.paragraphStyle?.namedStyleType || 'NORMAL_TEXT'
  const elements = para.elements || []
  const bullet = para.bullet

  // Build the inline text content
  let text = ''
  for (const el of elements) {
    if (el.textRun) {
      text += formatTextRun(el.textRun)
    } else if (el.inlineObjectElement) {
      const objId = el.inlineObjectElement.inlineObjectId
      if (objId && inlineObjects[objId]) {
        const obj = inlineObjects[objId]
        const embedded = obj.inlineObjectProperties?.embeddedObject
        const uri = embedded?.imageProperties?.contentUri || embedded?.imageProperties?.sourceUri || ''
        const alt = embedded?.title || embedded?.description || 'image'
        if (uri) {
          text += `![${alt}](${uri})`
        }
      }
    }
  }

  // Trim trailing newline that Google Docs adds to every paragraph
  text = text.replace(/\n$/, '')

  // If the paragraph is empty, return a blank line
  if (!text.trim()) return ''

  // Apply heading prefix
  const headingMap: Record<string, string> = {
    TITLE: '# ',
    SUBTITLE: '## ',
    HEADING_1: '# ',
    HEADING_2: '## ',
    HEADING_3: '### ',
    HEADING_4: '#### ',
    HEADING_5: '##### ',
    HEADING_6: '###### ',
  }

  if (headingMap[style]) {
    return `\n${headingMap[style]}${text}\n`
  }

  // Apply list prefix
  if (bullet) {
    const listId = bullet.listId || ''
    const nestingLevel = bullet.nestingLevel || 0
    const key = `${listId}:${nestingLevel}`
    const info = listLookup.get(key)
    const indent = '  '.repeat(nestingLevel)
    const prefix = info?.ordered ? '1. ' : '- '
    return `${indent}${prefix}${text}`
  }

  return text
}

function formatTextRun(run: docs_v1.Schema$TextRun): string {
  let content = run.content || ''
  const style = run.textStyle

  if (!style || content === '\n') return content

  // Don't format whitespace-only content
  const trimmed = content.replace(/\n$/, '')
  if (!trimmed.trim()) return content

  // Detect code font (Courier variants)
  const fontFamily = style.weightedFontFamily?.fontFamily || ''
  const isCode = /courier/i.test(fontFamily) || /consolas/i.test(fontFamily) || /mono/i.test(fontFamily)

  // Extract trailing newline to preserve it outside formatting
  const trailingNewline = content.endsWith('\n') ? '\n' : ''
  let formatted = content.replace(/\n$/, '')

  if (isCode) {
    formatted = `\`${formatted}\``
  } else {
    // Apply formatting — order matters: bold wraps italic wraps strikethrough
    if (style.strikethrough) {
      formatted = `~~${formatted}~~`
    }
    if (style.italic) {
      formatted = `*${formatted}*`
    }
    if (style.bold) {
      formatted = `**${formatted}**`
    }
  }

  // Apply link
  if (style.link?.url) {
    formatted = `[${formatted}](${style.link.url})`
  }

  return formatted + trailingNewline
}

function convertTable(
  table: docs_v1.Schema$Table,
  listLookup: Map<string, ListInfo>,
  inlineObjects: Record<string, docs_v1.Schema$InlineObject>
): string[] {
  const rows = table.tableRows || []
  if (rows.length === 0) return []

  const tableData: string[][] = rows.map(row => {
    const cells = row.tableCells || []
    return cells.map(cell => {
      const content = cell.content || []
      const cellText = content.map(el => {
        if (el.paragraph) {
          return convertParagraph(el.paragraph, listLookup, inlineObjects)
        }
        return ''
      }).join(' ').trim()
      // Escape pipes in cell content
      return cellText.replace(/\|/g, '\\|')
    })
  })

  if (tableData.length === 0) return []

  const lines: string[] = []

  const header = tableData[0]!
  // Header row
  lines.push('| ' + header.join(' | ') + ' |')
  // Separator
  lines.push('| ' + header.map(() => '---').join(' | ') + ' |')
  // Data rows
  for (let i = 1; i < tableData.length; i++) {
    lines.push('| ' + tableData[i]!.join(' | ') + ' |')
  }

  return lines
}

/**
 * Extract plain text from a Google Docs document, stripping all formatting.
 */
function extractPlainText(doc: docs_v1.Schema$Document): string {
  const body = doc.body?.content || []
  const parts: string[] = []

  for (const element of body) {
    if (element.paragraph) {
      const text = (element.paragraph.elements || [])
        .map(el => el.textRun?.content || '')
        .join('')
      parts.push(text)
    } else if (element.table) {
      const rows = element.table.tableRows || []
      for (const row of rows) {
        const cells = row.tableCells || []
        const cellTexts = cells.map(cell => {
          return (cell.content || []).map(el => {
            return (el.paragraph?.elements || [])
              .map(pe => pe.textRun?.content || '')
              .join('')
          }).join('')
        })
        parts.push(cellTexts.join('\t'))
      }
    }
  }

  return parts.join('').trim() + '\n'
}

declare module '../../feature' {
  interface AvailableFeatures {
    googleDocs: typeof GoogleDocs
  }
}

export default features.register('googleDocs', GoogleDocs)
