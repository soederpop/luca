/**
 * Example `luca serve --setup` file: auto-authenticate requests that arrive over Tailscale.
 *
 *   luca serve --setup docs/examples/serve-setup-tailscale-auth.ts --tailnet
 *
 * A setup module can export any of these lifecycle hooks:
 *
 *   middleware                 — handlers mounted before any endpoint, in array order
 *   create(app, server)        — same timing as middleware, for anything more involved
 *   beforeStart(options, server) — inside start(), right before listen
 *   default (server)           — after endpoints mount, before start (the original hook)
 *
 * Only `middleware` and `create` run before endpoints mount. Express runs handlers in
 * registration order, so auth belongs there, not in the default export.
 *
 * Two identity sources, checked in order:
 *
 * 1. `tailscale serve` / `luca serve --tailnet` proxies from loopback and adds
 *    Tailscale-User-Login / -Name / -Profile-Pic headers. Trusted only when the
 *    connection itself came from 127.0.0.1, otherwise anyone on the LAN could forge them.
 * 2. A direct tailnet connection (100.64.0.0/10 or fd7a:115c:a1e0::/48) is resolved
 *    with `tailscale whois`, cached per IP so we don't shell out on every request.
 *
 * Anything else gets 401. Note that static files (cors, body parsing, express.static)
 * are mounted before setup middleware, so this gates endpoints and the SPA fallback,
 * not files under public/.
 */

declare const container: any

type TailscaleUser = { login: string; name?: string; profilePic?: string; via: 'serve-headers' | 'whois' }

const whoisCache = new Map<string, Promise<TailscaleUser | null>>()

function stripIPv4Mapped(ip: string): string {
  return ip.startsWith('::ffff:') ? ip.slice(7) : ip
}

function isLoopback(ip: string): boolean {
  return ip === '127.0.0.1' || ip === '::1'
}

function isTailnetAddress(ip: string): boolean {
  if (ip.startsWith('fd7a:115c:a1e0:')) return true
  const [a, b] = ip.split('.').map(Number)
  // CGNAT range tailscale assigns: 100.64.0.0/10 => 100.64 - 100.127
  return a === 100 && b >= 64 && b <= 127
}

function fromServeHeaders(req: any): TailscaleUser | null {
  const login = req.get('Tailscale-User-Login')
  if (!login) return null
  return {
    login,
    name: req.get('Tailscale-User-Name'),
    profilePic: req.get('Tailscale-User-Profile-Pic'),
    via: 'serve-headers',
  }
}

function fromWhois(ip: string): Promise<TailscaleUser | null> {
  if (!whoisCache.has(ip)) {
    const lookup = container
      .feature('tailscale')
      .whois(ip)
      .then((info: any) => {
        const profile = info?.UserProfile
        if (!profile?.LoginName) return null
        return {
          login: profile.LoginName,
          name: profile.DisplayName,
          profilePic: profile.ProfilePicURL,
          via: 'whois' as const,
        }
      })
      .catch(() => null)
    whoisCache.set(ip, lookup)
    // A failed lookup shouldn't poison the cache forever; the next request retries.
    lookup.then((user: TailscaleUser | null) => { if (!user) whoisCache.delete(ip) })
  }
  return whoisCache.get(ip)!
}

async function tailscaleAuth(req: any, res: any, next: any) {
  const ip = stripIPv4Mapped(req.socket?.remoteAddress || '')

  let user: TailscaleUser | null = null
  if (isLoopback(ip)) user = fromServeHeaders(req)
  else if (isTailnetAddress(ip)) user = await fromWhois(ip)

  if (!user) {
    return res.status(401).json({ error: 'This server is only reachable through Tailscale' })
  }

  req.user = user
  next()
}

export const middleware = [tailscaleAuth]

// Endpoint handlers receive the express request as ctx.request, so `ctx.request.user`
// is the identity resolved above. This default export shows it without an endpoints/ folder.
export default function (server: any) {
  server.app.get('/whoami', (req: any, res: any) => res.json(req.user))
}
