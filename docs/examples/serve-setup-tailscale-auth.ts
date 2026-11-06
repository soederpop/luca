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
 *   before(app, server)          — runs first, ahead of cors, body parsing and static
 *   middleware                   — handlers mounted before any endpoint, in array order
 *   create(app, server)          — same timing as middleware, for anything more involved
 *   beforeStart(options, server) — inside start(), right before listen
 *   default (server)             — after endpoints mount, before start (the original hook)
 *
 * Express runs handlers in registration order, so auth belongs in `before`: it is the
 * only hook that runs ahead of express.static, so files under public/ are gated too.
 * `middleware` and `create` run after static but still before endpoints mount.
 */

declare const container: any

const ALLOWED = new Set(['jon@example.com'])

export function before(app: any) {
  app.use(container.feature('tailscale').authMiddleware({
    ttl: 20 * 60 * 1000,
    authorize: (user: any) => ALLOWED.has(user.login),
  }))
  return app
}

// Endpoint handlers receive the express request as ctx.request, so `ctx.request.user`
// is the identity resolved above. This default export shows it without an endpoints/ folder.
export default function (server: any) {
  server.app.get('/whoami', (req: any, res: any) => res.json(req.user))
}
