import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { AGIContainer } from '../src/agi/container.server'
import { withDefaultProvider, writeDefaultProvider } from '../src/commands/setup'
import { agentMcpServers, codexMcpConfig, codexModel } from '../src/agi/features/model-providers'
import { toMcpContent } from '../src/workbench/canvas'

describe('withDefaultProvider', () => {
	it('writes a fresh file', () => {
		expect(withDefaultProvider('', 'claude-code')).toBe('# The provider Luca assistants use when they name none (`luca setup`).\ndefault: claude-code\n')
	})

	it('adds the line after the header comments and keeps every comment', () => {
		const raw = '# Machine-wide model providers.\n# Shape: luca describe modelProviders\n\nhosts:\n  chief: http://chief:1234/v1 # LM Studio\nqwen: chief\n'
		const out = withDefaultProvider(raw, 'codex')
		expect(out).toContain('# Machine-wide model providers.\n# Shape: luca describe modelProviders\n')
		expect(out).toContain('default: codex\n')
		expect(out).toContain('  chief: http://chief:1234/v1 # LM Studio')
		expect(out.indexOf('default: codex')).toBeLessThan(out.indexOf('hosts:'))
	})

	it('replaces an existing default line only', () => {
		const raw = '# keep me\ndefault: codex\nqwen: chief\n'
		expect(withDefaultProvider(raw, 'claude-code')).toBe('# keep me\ndefault: claude-code\nqwen: chief\n')
	})
})

describe('the configured default provider', () => {
	let tmp: string
	let home: string
	let cwd: string
	let prevHome: string | undefined
	let prevEnv: string | undefined

	beforeEach(() => {
		tmp = mkdtempSync(join(tmpdir(), 'default-provider-'))
		home = join(tmp, 'luca-home')
		cwd = join(tmp, 'project')
		mkdirSync(home, { recursive: true })
		mkdirSync(join(cwd, 'assistants'), { recursive: true })
		prevHome = process.env.LUCA_HOME
		prevEnv = process.env.LUCA_DEFAULT_PROVIDER
		process.env.LUCA_HOME = home
		delete process.env.LUCA_DEFAULT_PROVIDER
	})

	afterEach(() => {
		if (prevHome === undefined) delete process.env.LUCA_HOME
		else process.env.LUCA_HOME = prevHome
		if (prevEnv === undefined) delete process.env.LUCA_DEFAULT_PROVIDER
		else process.env.LUCA_DEFAULT_PROVIDER = prevEnv
		rmSync(tmp, { recursive: true, force: true })
	})

	it('reads default: from ~/.luca/model-providers.yml and does not register it as a provider', () => {
		writeFileSync(join(home, 'model-providers.yml'), 'default: claude-code\nqwen: http://10.0.0.5:8000/v1\n')
		const mp = new AGIContainer({ cwd }).feature('modelProviders') as any
		expect(mp.configuredDefault).toBe('claude-code')
		expect(mp.resolveDefaultId()).toBe('claude-code')
		expect(mp.configuredProviderIds).toEqual(['qwen'])
	})

	it('lets the project file win, and the env var win over both', () => {
		writeFileSync(join(home, 'model-providers.yml'), 'default: claude-code\n')
		writeFileSync(join(cwd, 'assistants', 'options.yml'), 'providers:\n  default: codex\n')
		expect((new AGIContainer({ cwd }).feature('modelProviders') as any).resolveDefaultId()).toBe('codex')
		process.env.LUCA_DEFAULT_PROVIDER = 'claude-code'
		expect((new AGIContainer({ cwd }).feature('modelProviders') as any).resolveDefaultId()).toBe('claude-code')
	})

	it('writeDefaultProvider edits the machine file and reloads', () => {
		writeFileSync(join(home, 'model-providers.yml'), '# mine\nqwen: http://10.0.0.5:8000/v1\n')
		const container = new AGIContainer({ cwd }) as any
		writeDefaultProvider(container, 'codex')
		expect(readFileSync(join(home, 'model-providers.yml'), 'utf8')).toContain('# mine\n')
		expect(container.feature('modelProviders').resolveDefaultId()).toBe('codex')
	})

	it('routes an assistant with no provider to a coding-agent default, with its own tool server', () => {
		writeFileSync(join(home, 'model-providers.yml'), 'default: claude-code\n')
		mkdirSync(join(cwd, 'assistants', 'helper'), { recursive: true })
		writeFileSync(join(cwd, 'assistants', 'helper', 'CORE.md'), 'You help.\n')
		const container = new AGIContainer({ cwd }) as any
		const assistant = container.feature('assistant', { folder: join(cwd, 'assistants', 'helper') })
		const conv = assistant.conversation
		expect(conv.options.provider).toBe('claude-code')
		expect(conv.options.providerOptions.assistant).toBe('helper')
	})

	it('knows which providers are coding agents', () => {
		const mp = new AGIContainer({ cwd }).feature('modelProviders') as any
		expect(mp.isAgentProvider('claude-code')).toBe(true)
		expect(mp.isAgentProvider('codex')).toBe(true)
		expect(mp.isAgentProvider('openai')).toBe(false)
		expect(mp.isAgentProvider(undefined)).toBe(false)
	})
})

describe('coding-agent MCP wiring', () => {
	it('gives the assistant its own server plus the extra ones', () => {
		const servers = agentMcpServers({ assistant: 'lucaExpert', mcpServers: { 'luca-canvas': { type: 'http', url: 'http://127.0.0.1:9/mcp/canvas', headers: { Authorization: 'Bearer t' } } } })
		expect(Object.keys(servers).sort()).toEqual(['luca-canvas', 'luca-lucaExpert'])
		expect(servers['luca-lucaExpert'].args).toEqual(['mcp', '--assistant', 'lucaExpert', '--transport', 'stdio'])
	})

	it('turns servers into codex -c entries', () => {
		expect(codexMcpConfig({
			'luca-helper': { command: 'luca', args: ['mcp', '--assistant', 'helper'] },
			'luca-canvas': { type: 'http', url: 'http://127.0.0.1:9/mcp/canvas', headers: { Authorization: 'Bearer t' } },
		})).toEqual({
			'mcp_servers.luca-helper.command': 'luca',
			'mcp_servers.luca-helper.args': ['mcp', '--assistant', 'helper'],
			'mcp_servers.luca-canvas.url': 'http://127.0.0.1:9/mcp/canvas',
			'mcp_servers.luca-canvas.http_headers.Authorization': 'Bearer t',
		})
	})

	it('lets codex pick its own model for the placeholder', () => {
		expect(codexModel('codex')).toBeUndefined()
		expect(codexModel(undefined)).toBeUndefined()
		expect(codexModel('gpt-5.4')).toBe('gpt-5.4')
	})

	it('sends a snapshot to an agent as an MCP image', () => {
		const out = toMcpContent({ ok: true, source: 'page', images: ['data:image/png;base64,AAAA'] })
		expect(out.content[0]).toEqual({ type: 'text', text: JSON.stringify({ ok: true, source: 'page' }) })
		expect(out.content[1]).toEqual({ type: 'image', mimeType: 'image/png', data: 'AAAA' })
		expect(toMcpContent({ ok: false, error: 'x' }).isError).toBe(true)
	})
})
