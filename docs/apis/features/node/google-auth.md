# GoogleAuth (features.googleAuth)

> Stability: `stable`

Google authentication feature supporting OAuth2 browser flow and service account auth. Handles the complete OAuth2 lifecycle: authorization URL generation, local callback server, token exchange, refresh token storage (via diskCache), and automatic token refresh. Also supports non-interactive service account authentication via JSON key files. Two modes: - **oauth2** (default) — opens a browser for user consent. Requires `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` env vars (or `clientId` / `clientSecret` options). The refresh token is cached in diskCache, so subsequent runs restore authentication without a browser. - **service-account** — non-interactive, uses a JSON key file. Auto-selected when `serviceAccountKeyPath`, `serviceAccountKey`, or the `GOOGLE_SERVICE_ACCOUNT_KEY` env var is set. Ideal for automation, CI/CD, and background services. Note: a service account can only see files, sheets, and calendars that have been shared with its `client_email`. If no scopes are passed, `defaultScopes` is used — read-only access to Drive, Sheets, Calendar, Docs, and Gmail. Other Google features (drive, sheets, calendar, docs) depend on this feature and access it lazily via `container.feature('googleAuth')` — authenticate once and every Google feature picks it up automatically.

## Usage

```ts
container.feature('googleAuth', {
  // Authentication mode. Auto-detected if serviceAccountKeyPath is set
  mode,
  // OAuth2 client ID (falls back to GOOGLE_CLIENT_ID env var)
  clientId,
  // OAuth2 client secret (falls back to GOOGLE_CLIENT_SECRET env var)
  clientSecret,
  // Path to service account JSON key file (falls back to GOOGLE_SERVICE_ACCOUNT_KEY env var)
  serviceAccountKeyPath,
  // Service account key as a parsed JSON object (alternative to file path)
  serviceAccountKey,
  // OAuth2 scopes to request
  scopes,
  // Port for OAuth2 callback server (falls back to GOOGLE_OAUTH_REDIRECT_PORT env var, then 3000)
  redirectPort,
  // DiskCache key for storing OAuth2 refresh token
  tokenCacheKey,
})
```

## Options (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `mode` | `string` | Authentication mode. Auto-detected if serviceAccountKeyPath is set |
| `clientId` | `string` | OAuth2 client ID (falls back to GOOGLE_CLIENT_ID env var) |
| `clientSecret` | `string` | OAuth2 client secret (falls back to GOOGLE_CLIENT_SECRET env var) |
| `serviceAccountKeyPath` | `string` | Path to service account JSON key file (falls back to GOOGLE_SERVICE_ACCOUNT_KEY env var) |
| `serviceAccountKey` | `object` | Service account key as a parsed JSON object (alternative to file path) |
| `scopes` | `array` | OAuth2 scopes to request |
| `redirectPort` | `number` | Port for OAuth2 callback server (falls back to GOOGLE_OAUTH_REDIRECT_PORT env var, then 3000) |
| `tokenCacheKey` | `string` | DiskCache key for storing OAuth2 refresh token |

## Methods

### getOAuth2Client

Get the OAuth2Client instance, creating it lazily. After authentication, this client has valid credentials set.

**Returns:** `OAuth2Client`



### getAuthClient

Get the authenticated auth client for passing to googleapis service constructors. Handles token refresh automatically for OAuth2 (refreshes when the access token is within a minute of expiry, emitting `tokenRefreshed`). For service accounts, returns the JWT auth client. If not yet authenticated, attempts to restore cached tokens first and throws if that fails.

**Returns:** `Promise<OAuth2Client | ReturnType<typeof google.auth.fromJSON>>`

```ts
// (no-run) requires Google OAuth credentials
const auth = container.feature('googleAuth')
// Tries cached tokens automatically; throws if never authorized
const client = await auth.getAuthClient()
// Pass to any googleapis constructor
// google.drive({ version: 'v3', auth: client })
```



### authorize

Start the OAuth2 authorization flow. 1. Spins up a temporary Express callback server on a free port 2. Generates the Google authorization URL 3. Opens the browser to the consent page 4. Waits for the callback with the authorization code 5. Exchanges the code for access + refresh tokens 6. Stores the refresh token in diskCache 7. Shuts down the callback server Emits `authorizationRequired` with the consent URL, then `authenticated` on success. Times out after 5 minutes if the user never completes consent.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `scopes` | `string[]` |  | OAuth2 scopes to request (defaults to options.scopes or defaultScopes) |

**Returns:** `Promise<this>`

```ts
// (no-run) requires Google OAuth credentials
const auth = container.feature('googleAuth', {
 scopes: ['https://www.googleapis.com/auth/drive.readonly'],
})
await auth.authorize()
console.log(auth.isAuthenticated)         // true
console.log(auth.state.get('scopes'))     // the authorized scopes
// The refresh token is now cached — future runs won't need the browser
```



### authenticateServiceAccount

Authenticate using a service account JSON key file. Reads the key from options.serviceAccountKeyPath, options.serviceAccountKey, or the GOOGLE_SERVICE_ACCOUNT_KEY env var. Non-interactive — ideal for automation, CI/CD, and background services. Remember to share the Drive files, Sheets, or Calendars you need with the service account's client_email.

**Returns:** `Promise<this>`

```ts
// (no-run) requires Google OAuth credentials
const auth = container.feature('googleAuth', {
 serviceAccountKeyPath: '/path/to/service-account-key.json',
 scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
})
await auth.authenticateServiceAccount()
console.log(auth.state.get('email'))  // service account email
```



### tryRestoreTokens

Attempt to restore authentication from a cached refresh token. Called automatically by getAuthClient() if not yet authenticated. In service-account mode, this simply re-authenticates with the key file.

**Returns:** `Promise<boolean>`

```ts
// (no-run) requires Google OAuth credentials
// Restore-or-authorize pattern for scripts
const auth = container.feature('googleAuth')
const restored = await auth.tryRestoreTokens()
if (!restored) {
 await auth.authorize()  // falls back to the browser flow
}
```



### revoke

Revoke the current credentials and clear the cached refresh token from diskCache.

**Returns:** `Promise<this>`

```ts
// (no-run) requires Google OAuth credentials
const auth = container.feature('googleAuth')
await auth.revoke()
console.log(auth.isAuthenticated)  // false — next run will need authorize() again
```



## Getters

| Property | Type | Description |
|----------|------|-------------|
| `clientId` | `string` | OAuth2 client ID from options or GOOGLE_CLIENT_ID env var. |
| `clientSecret` | `string` | OAuth2 client secret from options or GOOGLE_CLIENT_SECRET env var. |
| `authMode` | `'oauth2' | 'service-account'` | Resolved authentication mode based on options. |
| `isAuthenticated` | `boolean` | Whether valid credentials are currently available. |
| `defaultScopes` | `string[]` | Default scopes covering Drive, Sheets, Calendar, and Docs read access. |
| `redirectPort` | `number` | Resolved redirect port from options, GOOGLE_OAUTH_REDIRECT_PORT env var, or default 3000. |
| `tokenCacheKey` | `string` | DiskCache key used for storing the refresh token. |

## Events (Zod v4 schema)

### tokenRefreshed

Access token was refreshed



### error

Authentication error occurred

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `any` | The error |



### authorizationRequired

User must visit this URL to authorize

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | Authorization URL to visit |



### authenticated

Authentication successful

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `mode` | `string` | Auth mode used |
| `email` | `string` | User or service account email |



## State (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | `boolean` | Whether this feature is currently enabled |
| `authMode` | `string` | Current authentication mode |
| `isAuthenticated` | `boolean` | Whether valid credentials are currently available |
| `email` | `string` | Authenticated user or service account email |
| `scopes` | `array` | OAuth2 scopes that have been authorized |
| `tokenExpiry` | `string` | ISO timestamp when the current access token expires |
| `lastError` | `string` | Last authentication error message |

## Environment Variables

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_SERVICE_ACCOUNT_KEY`
- `GOOGLE_OAUTH_REDIRECT_PORT`

## Examples

**features.googleAuth**

```ts
// (no-run) requires Google OAuth credentials
// OAuth2 flow — reads GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET from env,
// opens a browser for consent, caches the refresh token in diskCache
const auth = container.feature('googleAuth', {
 scopes: ['https://www.googleapis.com/auth/drive.readonly'],
})
await auth.authorize()
console.log(auth.isAuthenticated)        // true
console.log(auth.state.get('email'))     // your Google email

// Other Google features use the same auth automatically
const drive = container.feature('googleDrive')
const { files } = await drive.listFiles()
```

```ts
// (no-run) requires Google OAuth credentials
// Service account flow — no browser needed
const sa = container.feature('googleAuth', {
 serviceAccountKeyPath: '/path/to/service-account-key.json',
 scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
})
await sa.authenticateServiceAccount()
console.log(sa.state.get('email'))       // the service account's client_email
```



**getAuthClient**

```ts
// (no-run) requires Google OAuth credentials
const auth = container.feature('googleAuth')
// Tries cached tokens automatically; throws if never authorized
const client = await auth.getAuthClient()
// Pass to any googleapis constructor
// google.drive({ version: 'v3', auth: client })
```



**authorize**

```ts
// (no-run) requires Google OAuth credentials
const auth = container.feature('googleAuth', {
 scopes: ['https://www.googleapis.com/auth/drive.readonly'],
})
await auth.authorize()
console.log(auth.isAuthenticated)         // true
console.log(auth.state.get('scopes'))     // the authorized scopes
// The refresh token is now cached — future runs won't need the browser
```



**authenticateServiceAccount**

```ts
// (no-run) requires Google OAuth credentials
const auth = container.feature('googleAuth', {
 serviceAccountKeyPath: '/path/to/service-account-key.json',
 scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
})
await auth.authenticateServiceAccount()
console.log(auth.state.get('email'))  // service account email
```



**tryRestoreTokens**

```ts
// (no-run) requires Google OAuth credentials
// Restore-or-authorize pattern for scripts
const auth = container.feature('googleAuth')
const restored = await auth.tryRestoreTokens()
if (!restored) {
 await auth.authorize()  // falls back to the browser flow
}
```



**revoke**

```ts
// (no-run) requires Google OAuth credentials
const auth = container.feature('googleAuth')
await auth.revoke()
console.log(auth.isAuthenticated)  // false — next run will need authorize() again
```

