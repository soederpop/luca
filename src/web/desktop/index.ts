/**
 * The Luca Desktop kit: what a web page loads to look and behave like a
 * tile of the app. Three files, served by every Luca express server and by
 * the workbench host under `/_luca/desktop/`:
 *
 * - `kit.css`: the `--al-*` tokens and the `al-*` classes (`css.ts`)
 * - `kit.js`: `window.lucaDesktop`, the page side of the app's bridge (`sdk.ts`)
 * - `kit.mjs`: the same as an ES module with `lucaDesktop` as its default export
 * - `tokens.json`: every token as JSON
 *
 * ```html
 * <link rel="stylesheet" href="/_luca/desktop/kit.css">
 * <script src="/_luca/desktop/kit.js"></script>
 * <body class="al-page">
 * ```
 *
 * The page needs no server of its own to be a tile: `luca serve` mounts the
 * kit, so does `container.server('express')`, and `luca desktop sdk` writes
 * the files into any folder for other servers.
 */
import { desktopKitCss } from './css.js'
import { DESKTOP_KIT_JS, DESKTOP_KIT_MJS, DESKTOP_KIT_VERSION } from './sdk.js'
import { tokensJson } from './tokens.js'

export * from './tokens.js'
export { desktopKitCss } from './css.js'
export { DESKTOP_KIT_JS, DESKTOP_KIT_MJS, DESKTOP_KIT_VERSION } from './sdk.js'

/** Where every Luca server mounts the kit. */
export const DESKTOP_KIT_ROUTE = '/_luca/desktop'

export type DesktopKitFile = { name: string; type: string; body: string }

/** The kit's files, by name. Built once per process: the content never changes while it runs. */
export function desktopKitFiles(): DesktopKitFile[] {
	return (cached ??= [
		{ name: 'kit.css', type: 'text/css; charset=utf-8', body: desktopKitCss() },
		{ name: 'kit.js', type: 'text/javascript; charset=utf-8', body: DESKTOP_KIT_JS },
		{ name: 'kit.mjs', type: 'text/javascript; charset=utf-8', body: DESKTOP_KIT_MJS },
		{ name: 'tokens.json', type: 'application/json; charset=utf-8', body: JSON.stringify(tokensJson(), null, 2) + '\n' },
	])
}
let cached: DesktopKitFile[] | undefined

/**
 * The kit file a request path names, or undefined for any other path.
 * `/_luca/desktop/kit.css` and `/_luca/desktop/kit.css?v=3` both answer.
 * Pure, so it is tested without a server.
 */
export function desktopKitFile(pathname: string): DesktopKitFile | undefined {
	if (!pathname.startsWith(DESKTOP_KIT_ROUTE + '/')) return undefined
	const name = pathname.slice(DESKTOP_KIT_ROUTE.length + 1).split('?')[0]
	return desktopKitFiles().find((f) => f.name === name)
}

/** The headers a kit file is sent with. The version is in the ETag, so a new binary busts the cache. */
export function desktopKitHeaders(file: DesktopKitFile): Record<string, string> {
	return {
		'content-type': file.type,
		'cache-control': 'public, max-age=3600',
		etag: `"luca-desktop-kit-${DESKTOP_KIT_VERSION}-${file.name}-${file.body.length}"`,
	}
}

/**
 * Serve the kit from a Node `http` handler. True when the request was a kit
 * file and has been answered. Works with express `req`/`res` too.
 */
export function serveDesktopKit(req: { url?: string; method?: string }, res: { writeHead(status: number, headers: Record<string, string>): unknown; end(body?: string): unknown }): boolean {
	const path = String(req.url || '').split('?')[0]!
	const file = desktopKitFile(path)
	if (!file) return false
	if (req.method && req.method !== 'GET' && req.method !== 'HEAD') return false
	res.writeHead(200, desktopKitHeaders(file))
	res.end(req.method === 'HEAD' ? undefined : file.body)
	return true
}

/** Mount the kit on an express app: `app.use(desktopKitMiddleware())`. */
export function desktopKitMiddleware() {
	return (req: any, res: any, next: () => void) => {
		if (!serveDesktopKit(req, res)) next()
	}
}
