/**
 * Example `luca serve --setup` file: Tailscale auth plus an allowlist.
 *
 *   luca serve --setup docs/examples/serve-setup-tailscale-auth.ts --tailnet
 *
 * For plain "anyone on my tailnet" auth you don't need a setup file at all:
 * `luca serve --tailnet --tailscale-auth` mounts the same middleware for you.
 * Reach for a setup file when you want options, like the `authorize` allowlist below.
 *
 * A setup module can export any of these lifecycle hooks:
 *
 *   middleware                   — handlers mounted before any endpoint, in array order
 *   create(app, server)          — same timing as middleware, for anything more involved
 *   beforeStart(options, server) — inside start(), right before listen
 *   default (server)             — after endpoints mount, before start (the original hook)
 *
 * Only `middleware` and `create` run before endpoints mount. Express runs handlers in
 * registration order, so auth belongs there, not in the default export.
 *
 * Note that cors, body parsing and express.static are mounted before setup middleware,
 * so this gates endpoints and the SPA fallback, not files under public/.
 */

declare const container: any

const ALLOWED = new Set(['jon@example.com'])

export const middleware = [
  container.feature('tailscale').authMiddleware({
    ttl: 20 * 60 * 1000,
    authorize: (user) => ALLOWED.has(user.login),
  }),
]

// Endpoint handlers receive the express request as ctx.request, so `ctx.request.user`
// is the identity resolved above. This default export shows it without an endpoints/ folder.
export default function (server: any) {
  server.app.get('/whoami', (req: any, res: any) => res.json(req.user))
}
