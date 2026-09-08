import { HttpError } from './http-error.js'

/**
 * Per-field upload rules declared by an endpoint module.
 */
export interface UploadFieldConfig {
  /** Allowed content types. Exact (`application/pdf`) or wildcard (`image/*`). Anything else is rejected with 415. */
  accept?: string[]
  /** Per-file size cap for this field. Number of bytes, or a string like '25mb'. Overrides the upload-level maxSize. */
  maxSize?: string | number
  /** Accept more than one file for this field. The handler receives an array. */
  multiple?: boolean
  /** Reject the request with 400 when this field is absent. */
  required?: boolean
  /** Shown in the generated OpenAPI spec. */
  description?: string
}

/**
 * The `<method>Upload` export on an endpoint module. Declaring it does three
 * things at once: turns on multipart parsing for that method, enforces the
 * limits, and tells the OpenAPI generator to describe the body as
 * `multipart/form-data`.
 */
export interface UploadConfig {
  /** The file fields this endpoint accepts, keyed by form field name. */
  fields: Record<string, UploadFieldConfig>
  /** Default per-file size cap when a field does not set its own (default: '25mb'). */
  maxSize?: string | number
  /** Maximum number of files in one request (default: 10). */
  maxFiles?: number
}

/** A file parsed out of a multipart request and buffered in memory. */
export interface UploadedFile {
  /** The form field the file arrived on */
  fieldName: string
  /** The client-supplied file name (never trust it as a path) */
  filename: string
  /** The client-supplied content type */
  mimeType: string
  /** Size in bytes */
  size: number
  /** The file contents */
  buffer: Buffer
}

/** Files are buffered in memory, so the default cap is deliberately modest. */
export const DEFAULT_MAX_FILE_SIZE = 25 * 1024 * 1024
export const DEFAULT_MAX_FILES = 10

const UNITS: Record<string, number> = {
  b: 1,
  kb: 1024,
  mb: 1024 * 1024,
  gb: 1024 * 1024 * 1024,
}

/** Turn '25mb' into a byte count. Numbers pass through untouched. */
export function parseBytes(value: string | number | undefined, fallback: number): number {
  if (value === undefined || value === null) return fallback
  if (typeof value === 'number') return value

  const match = /^\s*([\d.]+)\s*(b|kb|mb|gb)?\s*$/i.exec(value)
  if (!match) throw new Error(`Cannot parse size: ${value}`)

  const amount = parseFloat(match[1] as string)
  const unit = (match[2] || 'b').toLowerCase()
  return Math.floor(amount * (UNITS[unit] as number))
}

/** True when the request carries a multipart body we should parse. */
export function isMultipartRequest(req: any): boolean {
  const type = req?.headers?.['content-type'] || req?.headers?.['Content-Type'] || ''
  return typeof type === 'string' && type.toLowerCase().startsWith('multipart/form-data')
}

/** `image/*` and exact matches both count. */
function accepts(accept: string[] | undefined, mimeType: string): boolean {
  if (!accept || accept.length === 0) return true
  return accept.some(pattern => {
    if (pattern === '*/*') return true
    if (pattern.endsWith('/*')) return mimeType.startsWith(`${pattern.slice(0, -1)}`)
    return pattern.toLowerCase() === mimeType.toLowerCase()
  })
}

/**
 * Parse a multipart/form-data request into buffered files plus text fields.
 *
 * Files are held in memory (never written to disk) and capped per field, so an
 * oversized upload fails fast with a 413 instead of exhausting the process.
 * For genuinely large files, hand out a pre-signed URL to object storage
 * instead of routing the bytes through the endpoint.
 *
 * @param req - The incoming request stream (an Express/Node IncomingMessage)
 * @param config - The endpoint's `<method>Upload` declaration
 * @returns The uploaded files keyed by field name (an array when `multiple`), plus the text fields
 */
export async function parseMultipart(
  req: any,
  config: UploadConfig
): Promise<{ files: Record<string, UploadedFile | UploadedFile[]>; fields: Record<string, string> }> {
  const { default: busboy } = await import('busboy')

  const defaultMax = parseBytes(config.maxSize, DEFAULT_MAX_FILE_SIZE)
  const maxFiles = config.maxFiles ?? DEFAULT_MAX_FILES
  // Busboy takes one global fileSize limit, so give it the most permissive
  // per-field cap and enforce the tighter per-field ones as bytes arrive.
  const globalMax = Math.max(
    defaultMax,
    ...Object.values(config.fields).map(f => parseBytes(f.maxSize, defaultMax))
  )

  return new Promise((resolve, reject) => {
    const files: Record<string, UploadedFile | UploadedFile[]> = {}
    const fields: Record<string, string> = {}
    let pending = 0
    let finished = false
    let settled = false

    const bb = busboy({ headers: req.headers, limits: { fileSize: globalMax, files: maxFiles } })

    /** Stop reading the body and reject once — later events are noise. */
    const fail = (err: Error) => {
      if (settled) return
      settled = true
      req.unpipe?.(bb)
      req.resume?.()
      reject(err)
    }

    const done = () => {
      if (settled || !finished || pending > 0) return

      for (const [name, field] of Object.entries(config.fields)) {
        if (field.required && files[name] === undefined) {
          fail(new HttpError(400, `Missing required file field: ${name}`))
          return
        }
      }

      settled = true
      resolve({ files, fields })
    }

    bb.on('file', (name: string, stream: any, info: any) => {
      const field = config.fields[name]

      if (!field) {
        stream.resume()
        fail(new HttpError(400, `Unexpected file field: ${name}`))
        return
      }

      const { filename, mimeType } = info

      if (!accepts(field.accept, mimeType)) {
        stream.resume()
        fail(
          new HttpError(
            415,
            `Unsupported content type for ${name}: ${mimeType} (accepts ${field.accept?.join(', ')})`
          )
        )
        return
      }

      const limit = parseBytes(field.maxSize, defaultMax)
      const chunks: Buffer[] = []
      let size = 0
      let aborted = false

      pending++

      stream.on('data', (chunk: Buffer) => {
        if (aborted) return
        size += chunk.length
        if (size > limit) {
          aborted = true
          stream.resume()
          fail(new HttpError(413, `File too large for ${name}: exceeds ${limit} bytes`))
          return
        }
        chunks.push(chunk)
      })

      // Busboy's own cap — reachable when the per-field limit is the global one.
      stream.on('limit', () => {
        if (aborted) return
        aborted = true
        fail(new HttpError(413, `File too large for ${name}: exceeds ${limit} bytes`))
      })

      stream.on('end', () => {
        pending--
        if (aborted) return

        const file: UploadedFile = {
          fieldName: name,
          filename,
          mimeType,
          size,
          buffer: Buffer.concat(chunks),
        }

        if (field.multiple) {
          const existing = (files[name] as UploadedFile[]) || []
          existing.push(file)
          files[name] = existing
        } else {
          files[name] = file
        }

        done()
      })

      stream.on('error', (err: Error) => {
        pending--
        fail(err)
      })
    })

    bb.on('field', (name: string, value: string) => {
      fields[name] = value
    })

    bb.on('filesLimit', () => fail(new HttpError(413, `Too many files: limit is ${maxFiles}`)))
    bb.on('error', (err: Error) => fail(err instanceof Error ? err : new Error(String(err))))

    bb.on('close', () => {
      finished = true
      done()
    })

    req.pipe(bb)
  })
}
