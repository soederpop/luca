import { describe, it, expect, afterAll } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
	desktopKitCss, desktopKitFile, desktopKitFiles, serveDesktopKit, DESKTOP_KIT_JS, DESKTOP_KIT_MJS, DESKTOP_KIT_ROUTE,
	DARK, LIGHT, TYPE_SCALE, SPACE, RADIUS, LAYOUT, MOTION, paletteVars, scaleVars,
} from '../src/web/desktop/index'

const LUCA_ROOT = join(import.meta.dir, '..')

describe('desktop kit: tokens and css', () => {
	it('declares every color of both palettes and the scale on :root', () => {
		const css = desktopKitCss()
		expect(css.startsWith('/* Luca Desktop kit')).toBe(true)
		expect(css).toContain('@layer al-kit {')
		for (const [name, value] of Object.entries({ ...paletteVars(LIGHT), ...scaleVars() })) {
			expect(css).toContain(`${name}: ${value};`)
		}
		for (const [name, value] of Object.entries(paletteVars(DARK))) expect(css).toContain(`${name}: ${value};`)
		// The four ways a scheme is picked, in cascade order.
		for (const sel of ['@media (prefers-color-scheme: dark)', ':root.light', ':root.dark', ':root[data-al-scheme="light"]', ':root[data-al-scheme="dark"]']) {
			expect(css).toContain(sel)
		}
	})

	it('names the hues and project color the way the app pushes them, not the old loop names', () => {
		const vars = paletteVars(DARK)
		expect(vars['--al-hue-1']).toBe(DARK.hues[0]!)
		expect(vars['--al-hue-8']).toBe(DARK.hues[7]!)
		expect(Object.keys(vars).some((k) => k.includes('loop'))).toBe(false)
		expect(desktopKitCss()).toContain('var(--al-project, var(--al-idle))')
	})

	it('styles only al- classes: no element selectors, no resets', () => {
		const css = desktopKitCss()
		const selectors = css.split('\n').filter((l) => /^\s{2}[.a-z:@\[]/.test(l) && l.trimEnd().endsWith('{')).map((l) => l.trim())
		for (const s of selectors) {
			expect(s.startsWith('.al-') || s.startsWith(':root') || s.startsWith('@media')).toBe(true)
		}
		expect(css).not.toMatch(/^\s*(body|html|h1|p|a|button|input)\s*[{,]/m)
	})
})

describe('desktop kit: the Swift app agrees', () => {
	const swift = readFileSync(join(LUCA_ROOT, 'apps/desktop/Sources/Theme/Tokens.swift'), 'utf8')

	/** The hex colors of one `static let <name> = KitPalette(` block, in order. */
	const swiftPalette = (name: string): string[] => {
		const start = swift.indexOf(`static let ${name} = KitPalette(`)
		expect(start).toBeGreaterThan(0)
		const end = swift.indexOf('\n    )\n', start)
		return [...swift.slice(start, end).matchAll(/hex: "(#[0-9A-Fa-f]+)"/g)].map((m) => m[1]!)
	}
	const tsPalette = (p: typeof DARK): string[] => [
		p.ground, p.surface, p.raised, p.inset, p.border, p.borderStrong, p.text, p.textBody, p.textMuted, p.textFaint,
		p.accent, p.accentOn, p.accentSoft, p.good, p.warn, p.bad, p.info, p.idle, p.shadow,
		p.syntax.keyword, p.syntax.string, p.syntax.number, p.syntax.comment, p.syntax.property, p.syntax.type, p.syntax.function,
		...p.hues,
	]

	it('has the same default dark and light colors as Tokens.swift', () => {
		expect(swiftPalette('dark')).toEqual(tsPalette(DARK))
		expect(swiftPalette('light')).toEqual(tsPalette(LIGHT))
	})

	const swiftScale = (enumName: string): Record<string, number> => {
		const start = swift.indexOf(`enum ${enumName} {`)
		expect(start).toBeGreaterThan(0)
		const end = swift.indexOf('\n    }', start)
		return Object.fromEntries([...swift.slice(start, end).matchAll(/static let (\w+): (?:CGFloat|Double) = ([\d.]+)/g)].map((m) => [m[1]!, Number(m[2])]))
	}

	it('has the same type scale, spacing, radii, layout and motion', () => {
		const type = swiftScale('TypeScale')
		expect([type.xs, type.sm, type.base, type.md, type.lg, type.xl, type.xxl, type.xxxl]).toEqual([
			TYPE_SCALE.xs, TYPE_SCALE.sm, TYPE_SCALE.base, TYPE_SCALE.md, TYPE_SCALE.lg, TYPE_SCALE.xl, TYPE_SCALE['2xl'], TYPE_SCALE['3xl'],
		])
		const space = swiftScale('Space')
		expect([1, 2, 3, 4, 5, 6, 7, 8].map((n) => space[`s${n}`])).toEqual([1, 2, 3, 4, 5, 6, 7, 8].map((n) => SPACE[n as keyof typeof SPACE]))
		const radius = swiftScale('Radius')
		expect([radius.sm, radius.md, radius.lg, radius.pill]).toEqual([RADIUS.sm, RADIUS.md, RADIUS.lg, RADIUS.pill])
		const layout = swiftScale('Layout')
		expect([layout.tileHeader, layout.statusLine, layout.tileGap, layout.focusRing]).toEqual([LAYOUT['tile-header'], LAYOUT['status-line'], LAYOUT['tile-gap'], LAYOUT['focus-ring']])
		const motion = swiftScale('Motion')
		expect([motion.fast, motion.base, motion.slow].map((s) => Math.round(s * 1000))).toEqual([MOTION.fast, MOTION.base, MOTION.slow])
	})

	it('pushes every variable name kit.css declares (ThemeSettings.hostTheme)', () => {
		const settings = readFileSync(join(LUCA_ROOT, 'apps/desktop/Sources/Theme/ThemeSettings.swift'), 'utf8')
		for (const name of Object.keys(paletteVars(DARK))) {
			if (/^--al-(hue|syntax)-/.test(name)) continue // built in loops there
			expect(settings).toContain(`"${name}"`)
		}
		expect(settings).toContain('--al-hue-\\(index + 1)')
		expect(settings).toContain('--al-syntax-\\(name)')
	})
})

describe('desktop kit: the script', () => {
	it('parses, defines window.lucaDesktop once, and speaks the app\'s bridge', () => {
		expect(() => new Function(DESKTOP_KIT_JS)).not.toThrow()
		expect(DESKTOP_KIT_JS).toContain('if (window.lucaDesktop) return')
		for (const word of ['__AL_HOST__', "'al:host'", "'al:reply'", 'messageHandlers', 'alHost', "kind: 'keys'", "kind: 'open'", 'data-al-scheme', '--al-project']) {
			expect(DESKTOP_KIT_JS).toContain(word)
		}
		// Shell names the Swift side answers (ShellRequest.names).
		const swift = readFileSync(join(LUCA_ROOT, 'apps/desktop/Sources/Tiles/Web/ShellRequest.swift'), 'utf8')
		const names = swift.match(/static let names = \[([^\]]+)\]/)![1]!.match(/"(\w+)"/g)!.map((s) => s.replaceAll('"', ''))
		expect(names.sort()).toEqual(['ask', 'choose', 'confirm', 'flash', 'keys', 'open'])
		for (const name of ['choose', 'ask', 'confirm', 'flash']) expect(DESKTOP_KIT_JS).toContain(`${name}: function`)
	})

	it('is served byte for byte: the regex escapes survived the template', () => {
		expect(DESKTOP_KIT_JS).toContain('/kit\\.css(\\?|$)/')
		expect(DESKTOP_KIT_JS).not.toContain('${')
	})

	it('has an ES module twin with lucaDesktop as the default export', () => {
		expect(DESKTOP_KIT_MJS.startsWith(DESKTOP_KIT_JS)).toBe(true)
		expect(DESKTOP_KIT_MJS.trimEnd().endsWith('export default window.lucaDesktop')).toBe(true)
	})
})

describe('desktop kit: routes', () => {
	it('names the files under /_luca/desktop and ignores everything else', () => {
		expect(DESKTOP_KIT_ROUTE).toBe('/_luca/desktop')
		expect(desktopKitFiles().map((f) => f.name)).toEqual(['kit.css', 'kit.js', 'kit.mjs', 'tokens.json'])
		expect(desktopKitFile('/_luca/desktop/kit.css')?.type).toBe('text/css; charset=utf-8')
		expect(desktopKitFile('/_luca/desktop/kit.js?v=2')?.name).toBe('kit.js')
		expect(desktopKitFile('/_luca/desktop/')).toBeUndefined()
		expect(desktopKitFile('/_luca/desktop/other.css')).toBeUndefined()
		expect(desktopKitFile('/kit.css')).toBeUndefined()
		expect(JSON.parse(desktopKitFile('/_luca/desktop/tokens.json')!.body).dark.accent).toBe(DARK.accent)
	})

	it('answers GET and HEAD with a node response, and leaves other requests alone', () => {
		const sent: any[] = []
		const res = { writeHead: (s: number, h: any) => sent.push(['head', s, h]), end: (b?: string) => sent.push(['end', b]) }
		expect(serveDesktopKit({ url: '/_luca/desktop/kit.css?x=1', method: 'GET' }, res)).toBe(true)
		expect(sent[0][1]).toBe(200)
		expect(sent[0][2]['content-type']).toBe('text/css; charset=utf-8')
		expect(sent[0][2].etag).toContain('luca-desktop-kit-')
		expect(sent[1][1]).toBe(desktopKitCss())
		sent.length = 0
		expect(serveDesktopKit({ url: '/_luca/desktop/kit.js', method: 'HEAD' }, res)).toBe(true)
		expect(sent[1][1]).toBeUndefined()
		expect(serveDesktopKit({ url: '/_luca/desktop/kit.js', method: 'POST' }, res)).toBe(false)
		expect(serveDesktopKit({ url: '/api/things', method: 'GET' }, res)).toBe(false)
	})
})

describe('desktop kit: every express server mounts it', () => {
	const servers: any[] = []
	afterAll(async () => { for (const s of servers) { try { await s.stop() } catch {} } })

	it('serves kit.css and kit.js with no options', async () => {
		const { default: container } = await import('../src/node')
		const server = container.server('express', { cors: false }) as any
		servers.push(server)
		const port = await (container as any).feature('networking').findOpenPort(4300)
		await server.start({ port })
		const css = await fetch(`http://127.0.0.1:${port}/_luca/desktop/kit.css`)
		expect(css.status).toBe(200)
		expect(css.headers.get('content-type')).toContain('text/css')
		expect(await css.text()).toBe(desktopKitCss())
		const js = await fetch(`http://127.0.0.1:${port}/_luca/desktop/kit.js`)
		expect(await js.text()).toBe(DESKTOP_KIT_JS)
		expect((await fetch(`http://127.0.0.1:${port}/_luca/desktop/nope.js`)).status).toBe(404)
	})
})
