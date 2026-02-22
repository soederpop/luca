import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from '../../schemas/base.js'
import { Feature, features } from '../feature.js'
import { google, type drive_v3 } from 'googleapis'
import type { GoogleAuth } from './google-auth.js'
import { writeFile } from 'fs/promises'

export type DriveFile = {
  id: string
  name: string
  mimeType: string
  size?: string
  createdTime?: string
  modifiedTime?: string
  parents?: string[]
  webViewLink?: string
  iconLink?: string
  owners?: Array<{ displayName?: string | null; emailAddress?: string | null }>
}

export type DriveFileList = {
  files: DriveFile[]
  nextPageToken?: string
}

export type DriveBrowseResult = {
  folder: DriveFile
  files: DriveFile[]
  folders: DriveFile[]
  nextPageToken?: string
}

export type ListFilesOptions = {
  pageSize?: number
  pageToken?: string
  orderBy?: string
  fields?: string
  corpora?: 'user' | 'drive' | 'allDrives'
}

export type SearchOptions = ListFilesOptions & {
  mimeType?: string
  inFolder?: string
}

export type SharedDrive = {
  id: string
  name: string
  colorRgb?: string
}

export const GoogleDriveStateSchema = FeatureStateSchema.extend({
  lastQuery: z.string().optional()
    .describe('Last search query or folder ID browsed'),
  lastResultCount: z.number().optional()
    .describe('Number of results from last list/search operation'),
  lastError: z.string().optional()
    .describe('Last Drive API error message'),
})
export type GoogleDriveState = z.infer<typeof GoogleDriveStateSchema>

export const GoogleDriveOptionsSchema = FeatureOptionsSchema.extend({
  defaultCorpora: z.enum(['user', 'drive', 'allDrives']).optional()
    .describe('Default corpus for file queries (default: user)'),
  pageSize: z.number().optional()
    .describe('Default number of results per page (default: 100)'),
})
export type GoogleDriveOptions = z.infer<typeof GoogleDriveOptionsSchema>

export const GoogleDriveEventsSchema = FeatureEventsSchema.extend({
  filesFetched: z.tuple([z.number().describe('Number of files returned')])
    .describe('Files were fetched from Drive'),
  fileDownloaded: z.tuple([z.string().describe('File ID')])
    .describe('A file was downloaded'),
  error: z.tuple([z.any().describe('The error')]).describe('Drive API error occurred'),
})

const DEFAULT_FIELDS = 'files(id,name,mimeType,size,createdTime,modifiedTime,parents,webViewLink,iconLink,owners),nextPageToken'

/**
 * Google Drive feature for listing, searching, browsing, and downloading files.
 *
 * Depends on the googleAuth feature for authentication. Creates a Drive v3 API
 * client lazily and passes the auth client from googleAuth.
 *
 * @example
 * ```typescript
 * const drive = container.feature('googleDrive')
 *
 * // List recent files
 * const { files } = await drive.listFiles()
 *
 * // Search for documents
 * const { files: docs } = await drive.search('quarterly report', { mimeType: 'application/pdf' })
 *
 * // Browse a folder
 * const contents = await drive.browse('folder-id-here')
 *
 * // Download a file to disk
 * await drive.downloadTo('file-id', './downloads/report.pdf')
 * ```
 */
export class GoogleDrive extends Feature<GoogleDriveState, GoogleDriveOptions> {
  static override shortcut = 'features.googleDrive' as const
  static override stateSchema = GoogleDriveStateSchema
  static override optionsSchema = GoogleDriveOptionsSchema
  static override eventsSchema = GoogleDriveEventsSchema

  private _drive?: drive_v3.Drive

  override get initialState(): GoogleDriveState {
    return { ...super.initialState }
  }

  /** Access the google-auth feature lazily. */
  get auth(): GoogleAuth {
    return this.container.feature('googleAuth') as unknown as GoogleAuth
  }

  /** Get or create the Drive v3 API client. */
  private async getDrive(): Promise<drive_v3.Drive> {
    if (this._drive) return this._drive
    const auth = await this.auth.getAuthClient()
    this._drive = google.drive({ version: 'v3', auth: auth as any })
    return this._drive
  }

  /**
   * List files in the user's Drive with an optional query filter.
   *
   * @param query - Drive search query (e.g. "name contains 'report'", "mimeType='application/pdf'")
   * @param options - Pagination and filtering options
   * @returns Files array and optional nextPageToken
   */
  async listFiles(query?: string, options: ListFilesOptions = {}): Promise<DriveFileList> {
    try {
      const drive = await this.getDrive()
      const res = await drive.files.list({
        q: query || undefined,
        pageSize: options.pageSize || this.options.pageSize || 100,
        pageToken: options.pageToken || undefined,
        orderBy: options.orderBy || 'modifiedTime desc',
        fields: options.fields || DEFAULT_FIELDS,
        corpora: options.corpora || this.options.defaultCorpora || 'user',
        includeItemsFromAllDrives: (options.corpora || this.options.defaultCorpora) === 'allDrives',
        supportsAllDrives: true,
      })

      const files = (res.data.files || []).map(normalizeDriveFile)
      this.setState({ lastQuery: query, lastResultCount: files.length })
      this.emit('filesFetched', files.length)
      return { files, nextPageToken: res.data.nextPageToken || undefined }
    } catch (err: any) {
      this.setState({ lastError: err.message })
      this.emit('error', err)
      throw err
    }
  }

  /**
   * List files within a specific folder.
   *
   * @param folderId - The Drive folder ID
   * @param options - Pagination and filtering options
   */
  async listFolder(folderId: string, options: ListFilesOptions = {}): Promise<DriveFileList> {
    const query = `'${folderId}' in parents and trashed = false`
    return this.listFiles(query, options)
  }

  /**
   * Browse a folder's contents, separating files from subfolders.
   *
   * @param folderId - Folder ID to browse (defaults to 'root')
   * @returns Folder metadata, child files, and child folders
   */
  async browse(folderId: string = 'root'): Promise<DriveBrowseResult> {
    const drive = await this.getDrive()

    // Get folder metadata
    const folderRes = await drive.files.get({
      fileId: folderId,
      fields: 'id,name,mimeType,createdTime,modifiedTime,parents,webViewLink',
      supportsAllDrives: true,
    })
    const folder = normalizeDriveFile(folderRes.data)

    // List folder contents
    const { files } = await this.listFolder(folderId, { pageSize: 1000 })
    const folders = files.filter(f => f.mimeType === 'application/vnd.google-apps.folder')
    const nonFolders = files.filter(f => f.mimeType !== 'application/vnd.google-apps.folder')

    return { folder, files: nonFolders, folders }
  }

  /**
   * Search files by name, content, or MIME type.
   *
   * @param term - Search term to look for in file names and content
   * @param options - Additional search options like mimeType filter or folder restriction
   */
  async search(term: string, options: SearchOptions = {}): Promise<DriveFileList> {
    const parts: string[] = [`fullText contains '${term.replace(/'/g, "\\'")}'`]

    if (options.mimeType) {
      parts.push(`mimeType = '${options.mimeType}'`)
    }
    if (options.inFolder) {
      parts.push(`'${options.inFolder}' in parents`)
    }
    parts.push('trashed = false')

    return this.listFiles(parts.join(' and '), options)
  }

  /**
   * Get file metadata by file ID.
   *
   * @param fileId - The Drive file ID
   * @param fields - Specific fields to request (defaults to common fields)
   */
  async getFile(fileId: string, fields?: string): Promise<DriveFile> {
    try {
      const drive = await this.getDrive()
      const res = await drive.files.get({
        fileId,
        fields: fields || 'id,name,mimeType,size,createdTime,modifiedTime,parents,webViewLink,iconLink,owners',
        supportsAllDrives: true,
      })
      return normalizeDriveFile(res.data)
    } catch (err: any) {
      this.setState({ lastError: err.message })
      this.emit('error', err)
      throw err
    }
  }

  /**
   * Download a file's content as a Buffer.
   * Uses alt=media for binary download of non-Google files.
   *
   * @param fileId - The Drive file ID
   */
  async download(fileId: string): Promise<Buffer> {
    try {
      const drive = await this.getDrive()
      const res = await drive.files.get(
        { fileId, alt: 'media', supportsAllDrives: true },
        { responseType: 'arraybuffer' }
      )
      this.emit('fileDownloaded', fileId)
      return Buffer.from(res.data as ArrayBuffer)
    } catch (err: any) {
      this.setState({ lastError: err.message })
      this.emit('error', err)
      throw err
    }
  }

  /**
   * Download a file and save it to a local path.
   *
   * @param fileId - The Drive file ID
   * @param localPath - Local file path (resolved relative to container cwd)
   * @returns Absolute path of the saved file
   */
  async downloadTo(fileId: string, localPath: string): Promise<string> {
    const buffer = await this.download(fileId)
    const outPath = this.container.paths.resolve(localPath)
    await writeFile(outPath, buffer)
    return outPath
  }

  /**
   * Export a Google Workspace file (Docs, Sheets, Slides) to a given MIME type.
   * Uses the Files.export endpoint.
   *
   * @param fileId - The Drive file ID of a Google Workspace document
   * @param mimeType - Target MIME type (e.g. 'text/plain', 'application/pdf', 'text/csv')
   */
  async exportFile(fileId: string, mimeType: string): Promise<Buffer> {
    try {
      const drive = await this.getDrive()
      const res = await drive.files.export(
        { fileId, mimeType },
        { responseType: 'arraybuffer' }
      )
      this.emit('fileDownloaded', fileId)
      return Buffer.from(res.data as ArrayBuffer)
    } catch (err: any) {
      this.setState({ lastError: err.message })
      this.emit('error', err)
      throw err
    }
  }

  /**
   * List all shared drives the user has access to.
   *
   * @returns Array of shared drive objects
   */
  async listDrives(): Promise<SharedDrive[]> {
    try {
      const drive = await this.getDrive()
      const res = await drive.drives.list({ pageSize: 100 })
      return (res.data.drives || []).map(d => ({
        id: d.id || '',
        name: d.name || '',
        colorRgb: d.colorRgb || undefined,
      }))
    } catch (err: any) {
      this.setState({ lastError: err.message })
      this.emit('error', err)
      throw err
    }
  }
}

function normalizeDriveFile(f: drive_v3.Schema$File): DriveFile {
  return {
    id: f.id || '',
    name: f.name || '',
    mimeType: f.mimeType || '',
    size: f.size || undefined,
    createdTime: f.createdTime || undefined,
    modifiedTime: f.modifiedTime || undefined,
    parents: f.parents || undefined,
    webViewLink: f.webViewLink || undefined,
    iconLink: f.iconLink || undefined,
    owners: f.owners?.map(o => ({ displayName: o.displayName, emailAddress: o.emailAddress })) || undefined,
  }
}

declare module '../../feature' {
  interface AvailableFeatures {
    googleDrive: typeof GoogleDrive
  }
}

export default features.register('googleDrive', GoogleDrive)
