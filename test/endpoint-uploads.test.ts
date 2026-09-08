import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { z } from 'zod'
import { NodeContainer } from '../src/node/container'

/**
 * Uploads are buffered in memory on purpose, so the contract that matters is:
 * files reach the handler as named params, and anything oversized, unexpected,
 * or the wrong content type fails fast with a real status code instead of
 * being swallowed (or eating the heap).
 */
const container = new NodeContainer()
let server: any
let baseUrl: string

const PDF = Buffer.from('%PDF-1.7 fake invoice bytes')

beforeAll(async () => {
  server = container.server('express')

  await server.useEndpointModules([
    {
      path: '/v1/text-extract/sync',
      postUpload: {
        fields: { file: { accept: ['application/pdf'], maxSize: '1kb', required: true } },
      },
      postSchema: z.object({ mode: z.enum(['fast', 'accurate']).default('fast') }),
      post: async (params: any) => ({
        filename: params.file.filename,
        mimeType: params.file.mimeType,
        size: params.file.size,
        head: params.file.buffer.subarray(0, 8).toString(),
        mode: params.mode,
      }),
    },
    {
      path: '/v1/batch',
      postUpload: { fields: { pages: { multiple: true } }, maxFiles: 2 },
      post: async (params: any) => ({ count: params.pages.length }),
    },
  ])

  const port = await container.feature('networking').findOpenPort(3480)
  await server.start({ port })
  baseUrl = `http://localhost:${port}`
})

afterAll(async () => {
  await server?.stop()
})

/** Post a multipart body with the given file parts and text fields. */
async function upload(path: string, parts: Array<[string, Buffer, string, string]>, fields: Record<string, string> = {}) {
  const form = new FormData()
  for (const [name, buffer, filename, type] of parts) {
    form.append(name, new Blob([new Uint8Array(buffer)], { type }), filename)
  }
  for (const [name, value] of Object.entries(fields)) form.append(name, value)

  const res = await fetch(`${baseUrl}${path}`, { method: 'POST', body: form })
  return { status: res.status, body: await res.json() }
}

describe('Endpoint multipart uploads', () => {
  it('hands the file to the handler alongside validated text fields', async () => {
    const { status, body } = await upload(
      '/v1/text-extract/sync',
      [['file', PDF, 'invoice.pdf', 'application/pdf']],
      { mode: 'accurate' }
    )

    expect(status).toBe(200)
    expect(body.filename).toBe('invoice.pdf')
    expect(body.mimeType).toBe('application/pdf')
    expect(body.size).toBe(PDF.length)
    expect(body.head).toBe('%PDF-1.7')
    expect(body.mode).toBe('accurate')
  })

  it('applies schema defaults when the text field is omitted', async () => {
    const { body } = await upload('/v1/text-extract/sync', [['file', PDF, 'a.pdf', 'application/pdf']])
    expect(body.mode).toBe('fast')
  })

  it('rejects a file over the declared size cap with 413', async () => {
    const big = Buffer.alloc(2048, 0x41)
    const { status, body } = await upload('/v1/text-extract/sync', [['file', big, 'big.pdf', 'application/pdf']])

    expect(status).toBe(413)
    expect(body.error).toMatch(/too large/i)
  })

  it('rejects a disallowed content type with 415', async () => {
    const { status, body } = await upload('/v1/text-extract/sync', [
      ['file', Buffer.from('hello'), 'note.txt', 'text/plain'],
    ])

    expect(status).toBe(415)
    expect(body.error).toMatch(/unsupported content type/i)
  })

  it('rejects a file field the endpoint never declared with 400', async () => {
    const { status, body } = await upload('/v1/text-extract/sync', [
      ['file', PDF, 'invoice.pdf', 'application/pdf'],
      ['sneaky', PDF, 'other.pdf', 'application/pdf'],
    ])

    expect(status).toBe(400)
    expect(body.error).toMatch(/unexpected file field/i)
  })

  it('requires multipart when a required file field is declared', async () => {
    const res = await fetch(`${baseUrl}/v1/text-extract/sync`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode: 'fast' }),
    })

    expect(res.status).toBe(415)
  })

  it('collects a multiple field into an array', async () => {
    const { status, body } = await upload('/v1/batch', [
      ['pages', Buffer.from('one'), 'p1.png', 'image/png'],
      ['pages', Buffer.from('two'), 'p2.png', 'image/png'],
    ])

    expect(status).toBe(200)
    expect(body.count).toBe(2)
  })

  it('rejects more files than maxFiles allows with 413', async () => {
    const { status } = await upload('/v1/batch', [
      ['pages', Buffer.from('one'), 'p1.png', 'image/png'],
      ['pages', Buffer.from('two'), 'p2.png', 'image/png'],
      ['pages', Buffer.from('three'), 'p3.png', 'image/png'],
    ])

    expect(status).toBe(413)
  })
})
