import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { NodeContainer } from '../src/node/container'
import os from 'os'
import { join } from 'path'
import { mkdtempSync, readFileSync, existsSync } from 'fs'

const container = new NodeContainer()
const downloader = container.feature('downloader')
const outDir = mkdtempSync(join(os.tmpdir(), 'luca-downloader-test-'))

let server: ReturnType<typeof Bun.serve>
let baseUrl: string

beforeAll(() => {
  server = Bun.serve({
    port: 0,
    fetch(req) {
      const { pathname } = new URL(req.url)
      if (pathname === '/data.json') {
        return Response.json({ hello: 'world', n: 1 })
      }
      if (pathname === '/file.txt') {
        return new Response('file contents')
      }
      if (pathname === '/empty') {
        return new Response('')
      }
      if (pathname === '/error-500') {
        return new Response('server exploded', { status: 500 })
      }
      if (pathname === '/not-json') {
        return new Response('<html>not json</html>')
      }
      if (pathname === '/echo-header') {
        return Response.json({ token: req.headers.get('x-token') })
      }
      return new Response('<html>404 page</html>', { status: 404 })
    },
  })
  baseUrl = `http://localhost:${server.port}`
})

afterAll(() => {
  server.stop(true)
})

describe('downloader.downloadJson', () => {
  it('parses a 2xx JSON response', async () => {
    const data = await downloader.downloadJson<{ hello: string; n: number }>(`${baseUrl}/data.json`)
    expect(data).toEqual({ hello: 'world', n: 1 })
  })

  it('throws on non-2xx with status and body in the message', async () => {
    await expect(downloader.downloadJson(`${baseUrl}/missing.json`)).rejects.toThrow(/HTTP 404.*404 page/s)
    await expect(downloader.downloadJson(`${baseUrl}/error-500`)).rejects.toThrow(/HTTP 500.*server exploded/s)
  })

  it('throws when the body is not valid JSON', async () => {
    await expect(downloader.downloadJson(`${baseUrl}/not-json`)).rejects.toThrow(/not valid JSON/)
  })

  it('passes fetch options through', async () => {
    const data = await downloader.downloadJson<{ token: string }>(`${baseUrl}/echo-header`, {
      headers: { 'x-token': 'abc123' },
    })
    expect(data.token).toBe('abc123')
  })
})

describe('downloader.downloadFile', () => {
  it('saves a 2xx response to the target path', async () => {
    const target = join(outDir, 'file.txt')
    const saved = await downloader.downloadFile(`${baseUrl}/file.txt`, target)
    expect(saved).toBe(target)
    expect(readFileSync(target, 'utf8')).toBe('file contents')
  })

  it('throws on 404 and writes nothing', async () => {
    const target = join(outDir, 'should-not-exist.txt')
    await expect(downloader.downloadFile(`${baseUrl}/nope.txt`, target)).rejects.toThrow(/HTTP 404/)
    expect(existsSync(target)).toBe(false)
  })

  it('throws on 500', async () => {
    const target = join(outDir, 'should-not-exist-500.txt')
    await expect(downloader.downloadFile(`${baseUrl}/error-500`, target)).rejects.toThrow(/HTTP 500/)
    expect(existsSync(target)).toBe(false)
  })

  it('throws on an empty body and writes nothing', async () => {
    const target = join(outDir, 'should-not-exist-empty.txt')
    await expect(downloader.downloadFile(`${baseUrl}/empty`, target)).rejects.toThrow(/empty response body/)
    expect(existsSync(target)).toBe(false)
  })
})

describe('downloader.download (unchanged behavior)', () => {
  it('still writes the body of a 404 response as-is', async () => {
    const target = join(outDir, 'legacy-404.html')
    const saved = await downloader.download(`${baseUrl}/nope.txt`, target)
    expect(readFileSync(saved, 'utf8')).toBe('<html>404 page</html>')
  })
})
