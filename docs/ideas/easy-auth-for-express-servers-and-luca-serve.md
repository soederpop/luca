---
tags: [auth, express, serve, security, feature]
status: spark
---

# Easy Auth for Express Servers and `luca serve`

Right now `luca serve` spins up an Express server, mounts endpoints, generates OpenAPI specs, handles rate limiting and validation — but there's no story for auth. Every project that needs protected routes is on its own. This should be a first-class container feature.

## The Vision

Auth should feel like rate limiting does today — declare it, and it works. No middleware wiring, no passport.js dependency graphs, no ceremony.

```typescript
// endpoints/admin/users.ts
export const path = '/admin/users'
export const auth = true // that's it — requires a valid token

export async function get(params, ctx) {
  // ctx.auth.user is already populated
  return ctx.auth.user
}
```

Or with roles:

```typescript
export const auth = { role: 'admin' }
```

Or wide open:

```typescript
export const auth = false // explicit opt-out (same as omitting it)
```

## The Feature: `container.feature('auth')`

A proper container feature that owns session/token lifecycle, pluggable providers, and middleware generation.

```typescript
const auth = container.feature('auth', {
  provider: 'jwt',
  secret: process.env.JWT_SECRET,
  expiresIn: '7d',
})

// Create tokens
const token = auth.sign({ userId: 123, role: 'admin' })

// Verify tokens
const payload = auth.verify(token)

// Middleware (for manual use outside luca serve)
app.use(auth.middleware())
```

### Provider Interface

The feature should support swappable providers through a clean interface:

```typescript
interface AuthProvider {
  name: string
  sign(payload: Record<string, any>): string | Promise<string>
  verify(token: string): Record<string, any> | Promise<Record<string, any>>
  middleware(): ExpressMiddleware
}
```

### Built-in Providers

**JWT** — the default, covers 90% of cases:

```typescript
container.feature('auth', {
  provider: 'jwt',
  secret: process.env.JWT_SECRET,
  expiresIn: '7d',
})
```

**API Key** — for service-to-service or simple scripts:

```typescript
container.feature('auth', {
  provider: 'apiKey',
  keys: ['sk-abc123', 'sk-def456'],
  header: 'x-api-key', // default
})
```

**Cloudflare Access / Zero Trust** — for when the server sits behind a tunnel and Cloudflare handles the identity layer:

```typescript
container.feature('auth', {
  provider: 'cloudflare-access',
  teamDomain: 'myteam.cloudflareaccess.com',
  audience: process.env.CF_ACCESS_AUD,
})
```

This provider would:
- Validate the `Cf-Access-Jwt-Assertion` header against Cloudflare's JWKS endpoint (`https://<teamDomain>/cdn-cgi/access/certs`)
- Populate `ctx.auth.user` with the identity from the JWT (email, groups, etc.)
- Trust Cloudflare as the auth boundary — no local password/session management needed
- Optionally map Cloudflare groups to local roles

**Composite** — layer multiple providers for different contexts:

```typescript
container.feature('auth', {
  provider: 'composite',
  providers: [
    { provider: 'cloudflare-access', teamDomain: '...', audience: '...' },
    { provider: 'apiKey', keys: ['...'], header: 'x-api-key' },
  ],
  // First provider that successfully authenticates wins
})
```

This is the real-world pattern: Cloudflare Access protects the browser-facing routes, API keys protect the programmatic ones, and the endpoint code doesn't care which one authenticated the request.

## Integration with `luca serve`

When the auth feature is enabled and `luca serve` starts, the Express server should automatically:

1. Apply auth middleware globally
2. Respect per-endpoint `auth` exports (opt-in or opt-out depending on config)
3. Inject `ctx.auth` into the EndpointContext

### Default Behavior Modes

**Opt-in** (default) — endpoints are public unless they declare `auth`:

```typescript
container.feature('auth', {
  provider: 'jwt',
  secret: '...',
  mode: 'opt-in', // default
})
```

**Opt-out** — everything requires auth unless explicitly marked public:

```typescript
container.feature('auth', {
  provider: 'jwt',
  secret: '...',
  mode: 'opt-out', // lock it down, whitelist public routes
})
```

Then in an endpoint:

```typescript
export const auth = false // public health check
export const path = '/health'
export async function get() { return { status: 'ok' } }
```

## EndpointContext Extension

```typescript
export type AuthContext = {
  authenticated: boolean
  user?: Record<string, any>  // provider-specific payload
  token?: string              // raw token
  provider?: string           // which provider authenticated this request
}

// Available in every handler
export async function get(params, ctx) {
  if (ctx.auth.user.role !== 'admin') {
    ctx.response.status(403)
    return { error: 'forbidden' }
  }
}
```

## WebSocket Auth

The websocket server should participate too. Auth on connection upgrade:

```typescript
const ws = container.server('websocket', {
  auth: true, // validate token on connection
})

ws.on('connection', (socket) => {
  console.log(socket.auth.user) // populated from handshake
})
```

Token could come from:
- `Authorization` header on upgrade request
- Query parameter (`?token=...`) for browser WebSocket which can't set headers
- First message protocol (send token as first frame)

## Cloudflare Tunnel Considerations

A common deployment pattern: local `luca serve` behind `cloudflared tunnel`, protected by Cloudflare Access policies. The auth feature should make this seamless:

```typescript
container.feature('auth', {
  provider: 'cloudflare-access',
  teamDomain: 'myteam.cloudflareaccess.com',
  audience: process.env.CF_ACCESS_AUD,
  // Trust Cf-Connecting-IP for rate limiting
  trustProxy: 'cloudflare',
})
```

Things to handle:
- **JWKS caching** — don't hit Cloudflare's cert endpoint on every request, cache the public keys with a reasonable TTL
- **Identity mapping** — Cloudflare gives you an email and group memberships. The feature should let you map those to local roles/permissions
- **Development mode** — when running locally without a tunnel, bypass Cloudflare validation and use a local JWT or no auth
- **Service tokens** — Cloudflare Access supports non-interactive service tokens (`CF-Access-Client-Id` + `CF-Access-Client-Secret`) for API access. The provider should handle both browser (JWT) and service (client credentials) flows

```typescript
container.feature('auth', {
  provider: 'cloudflare-access',
  teamDomain: '...',
  audience: '...',
  roleMapping: {
    'admin@soederpop.com': 'admin',
    'engineering': 'developer', // Cloudflare group → local role
  },
  dev: {
    // In development, fall back to simple JWT
    provider: 'jwt',
    secret: 'dev-secret',
  },
})
```

## Config-File Based Setup

For projects that use `luca serve` without custom code, support auth config in the project config or a dedicated file:

```yaml
# .luca/auth.yml
provider: cloudflare-access
teamDomain: myteam.cloudflareaccess.com
audience: ${CF_ACCESS_AUD}
mode: opt-out
public:
  - /health
  - /openapi.json
```

Or in the serve command:

```bash
luca serve --auth jwt --auth-secret $JWT_SECRET
luca serve --auth cloudflare-access --auth-team myteam
```

## What This Doesn't Try to Be

- **Not a user database.** Auth verifies identity, it doesn't store users. If you need user management, that's a separate feature (or your app's job).
- **Not a permissions framework.** Roles are a thin convenience. If you need RBAC/ABAC, build that on top of `ctx.auth`.
- **Not Passport.js.** We're not trying to support 500 OAuth strategies. JWT, API key, and Cloudflare Access cover the real use cases. Adding a new provider should be easy, but we're not building a plugin marketplace for auth.

## Implementation Order

1. **Auth feature** with JWT provider — sign, verify, middleware. The foundation.
2. **Endpoint integration** — `auth` export, `ctx.auth`, opt-in/opt-out modes.
3. **API key provider** — simple, useful for service-to-service.
4. **Cloudflare Access provider** — JWKS validation, identity mapping, service tokens.
5. **Composite provider** — layer multiple providers.
6. **WebSocket auth** — connection-level token validation.
7. **CLI flags and config file** — `luca serve --auth` and `.luca/auth.yml`.

## Open Questions

- Should the auth feature manage refresh tokens, or is that the client's problem?
- How does this interact with the OpenAPI spec generation? Auth schemes should show up in the spec.
- Should there be a `container.feature('auth').protect(app)` for non-luca Express apps that just want the middleware?
- Rate limiting currently keys on IP. When auth is present, should it key on user identity instead (or both)?
