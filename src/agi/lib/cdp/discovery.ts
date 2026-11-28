/**
 * Finding a Chrome to talk to.
 *
 * Three sources, used by browserUseV2:
 *  - an explicit cdpUrl (http:// debug address or ws:// browser URL)
 *  - launch mode: a dedicated debug Chrome with its own profile
 *  - real-profile mode: the person's everyday Chrome, after they tick
 *    "Allow remote debugging" at chrome://inspect/#remote-debugging (Chrome 144+)
 *
 * Lessons carried over from browser-use 1.0's browser_harness/daemon.py.
 * File access comes in through a reader so this module needs no Node builtins.
 */

/** Reads a text file, or returns null when it is missing or unreadable. */
export type ReadText = (path: string) => string | null

/**
 * Probe both address families instead of "localhost". A debug Chrome often
 * binds only [::1], while the main Chrome can squat 127.0.0.1 on the same port
 * and answer 404 to every request (Chrome 136+ disables remote debugging on
 * the default profile but still binds the port).
 */
export const CDP_HOSTS = ['127.0.0.1', '[::1]']
export const DEFAULT_DEBUG_PORTS = [9222, 9223, 9229]

export const PERMISSION_BLOCKED =
  'Chrome is reachable, but its "Allow remote debugging" popup has not been accepted yet. Click Allow in Chrome, then retry.'

/** Where Chrome usually lives, most likely first. Linux lists bare names for a PATH lookup. */
export function chromeExecutableCandidates(platform: string, env: Record<string, string | undefined>, homedir: string): string[] {
  if (platform === 'darwin') {
    const apps = ['Google Chrome.app/Contents/MacOS/Google Chrome', 'Chromium.app/Contents/MacOS/Chromium']
    return [...apps.map((a) => `/Applications/${a}`), ...apps.map((a) => `${homedir}/Applications/${a}`)]
  }
  if (platform === 'win32') {
    const roots = [env.PROGRAMFILES, env['PROGRAMFILES(X86)'], env.LOCALAPPDATA].filter(Boolean) as string[]
    return [
      ...roots.map((r) => `${r}\\Google\\Chrome\\Application\\chrome.exe`),
      ...roots.map((r) => `${r}\\Chromium\\Application\\chrome.exe`),
    ]
  }
  return ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']
}

const MAC_PROFILES = [
  'Library/Application Support/Google/Chrome',
  'Library/Application Support/Google/Chrome Canary',
  'Library/Application Support/Google/Chrome Beta',
  'Library/Application Support/Chromium',
  'Library/Application Support/Arc/User Data',
  'Library/Application Support/Microsoft Edge',
  'Library/Application Support/BraveSoftware/Brave-Browser',
]
const LINUX_PROFILES = [
  '.config/google-chrome',
  '.config/google-chrome-beta',
  '.config/chromium',
  '.config/microsoft-edge',
  '.config/BraveSoftware/Brave-Browser',
  '.var/app/com.google.Chrome/config/google-chrome',
  '.var/app/org.chromium.Chromium/config/chromium',
]
const WINDOWS_PROFILES = [
  'Google/Chrome/User Data',
  'Google/Chrome SxS/User Data',
  'Google/Chrome Beta/User Data',
  'Chromium/User Data',
  'Microsoft/Edge/User Data',
  'BraveSoftware/Brave-Browser/User Data',
]

/** User-data-dirs of everyday browsers, per platform. Pure, so every platform is testable anywhere. */
export function profileDirs(platform: string, env: Record<string, string | undefined>, homedir: string): string[] {
  if (platform === 'win32') {
    const local = env.LOCALAPPDATA || `${homedir}/AppData/Local`
    return WINDOWS_PROFILES.map((p) => `${local}/${p}`)
  }
  const list = platform === 'darwin' ? MAC_PROFILES : LINUX_PROFILES
  return list.map((p) => `${homedir}/${p}`)
}

export type VersionProbe =
  | { kind: 'ok'; ws: string }
  | { kind: 'status'; status: number }
  | { kind: 'down' }

/** GET /json/version on one host:port. Any HTTP answer means the port is live. */
export async function probeVersion(host: string, port: number | string, timeoutMs = 1500): Promise<VersionProbe> {
  try {
    const res = await fetch(`http://${host}:${port}/json/version`, { signal: AbortSignal.timeout(timeoutMs) })
    if (!res.ok) return { kind: 'status', status: res.status }
    const info = (await res.json()) as { webSocketDebuggerUrl?: string }
    if (!info.webSocketDebuggerUrl) return { kind: 'status', status: 500 }
    return { kind: 'ok', ws: info.webSocketDebuggerUrl }
  } catch {
    return { kind: 'down' }
  }
}

/** Parse a DevToolsActivePort file: line 1 is the port, line 2 the browser ws path. */
export function parseDevToolsActivePort(text: string | null): { port: string; wsPath: string } | null {
  if (!text) return null
  const [port = '', wsPath = ''] = text.split(/\r?\n/).map((l) => l.trim())
  if (!/^\d+$/.test(port)) return null
  return { port, wsPath }
}

/**
 * Resolve an explicit cdpUrl to a browser websocket URL.
 * ws:// passes through. For http://, try /json/version on the given host
 * (and the other loopback family when the host is local), then fall back to
 * a DevToolsActivePort file for the same port when Chrome 147+ answers 404.
 */
export async function resolveBrowserWsUrl(cdpUrl: string, opts: { profileDirs?: string[]; readText?: ReadText } = {}): Promise<string> {
  if (/^wss?:\/\//.test(cdpUrl)) return cdpUrl
  const u = new URL(cdpUrl)
  const port = u.port || (u.protocol === 'https:' ? '443' : '80')
  const host = u.hostname.includes(':') ? `[${u.hostname}]` : u.hostname
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(host)
  const hosts = local ? [...new Set([host === 'localhost' ? '127.0.0.1' : host, ...CDP_HOSTS])] : [host]

  let saw404Host: string | null = null
  for (const h of hosts) {
    const r = await probeVersion(h, port, 5000)
    if (r.kind === 'ok') return r.ws
    if (r.kind === 'status' && r.status === 403) throw new Error(PERMISSION_BLOCKED)
    if (r.kind === 'status' && r.status === 404 && !saw404Host) saw404Host = h
  }
  if (saw404Host && opts.readText) {
    for (const dir of opts.profileDirs || []) {
      const active = parseDevToolsActivePort(opts.readText(`${dir}/DevToolsActivePort`))
      if (active && active.port === port && active.wsPath) return `ws://${saw404Host}:${port}${active.wsPath}`
    }
  }
  throw new Error(`No Chrome DevTools endpoint answered at ${cdpUrl}`)
}

/**
 * Find the person's everyday Chrome with remote debugging turned on.
 *
 * Tries /json/version first, because DevToolsActivePort can be stale (left by
 * an earlier Chrome on the same port, with the wrong browser UUID). On 404
 * (Chrome 147+ hides /json/* on the default profile) the ws path in the file
 * still works.
 */
export async function findRealProfileBrowser(dirs: string[], readText: ReadText): Promise<string> {
  let toggleOff = false
  let toggleOn = false
  for (const dir of dirs) {
    const active = parseDevToolsActivePort(readText(`${dir}/DevToolsActivePort`))
    const localState = readText(`${dir}/Local State`)
    if (localState) {
      try {
        const enabled = JSON.parse(localState)?.devtools?.remote_debugging?.['user-enabled']
        if (enabled === true) toggleOn = true
        if (enabled === false) toggleOff = true
      } catch {}
    }
    if (!active) continue
    const r = await probeVersion('127.0.0.1', active.port)
    if (r.kind === 'ok') return r.ws
    if (r.kind === 'status' && r.status === 403) throw new Error(PERMISSION_BLOCKED)
    if (r.kind === 'status' && r.status === 404 && active.wsPath) return `ws://127.0.0.1:${active.port}${active.wsPath}`
    // 'down' means a stale file from a closed browser; keep looking.
  }
  if (toggleOff && !toggleOn) {
    throw new Error('Remote debugging is off for your Chrome. Open chrome://inspect/#remote-debugging and tick "Allow remote debugging for this browser instance".')
  }
  throw new Error('No running Chrome with remote debugging was found. Start Chrome, then turn on chrome://inspect/#remote-debugging (Chrome 144+).')
}
