---
status: approved
---

# Add Google Integration Features

## Summary

Add Google API integration to Luca: Drive files, Calendar events, Sheets data, and Docs-as-markdown. Uses the official `googleapis` npm package which bundles auth + all service clients. Five separate features following the established pattern (telegram, postgres, etc.).

## Steps

- [ ] Add `googleapis` dependency to `package.json`
- [ ] Create `src/node/features/google-auth.ts` — OAuth2 browser flow + service account auth + token storage
- [ ] Create `src/node/features/google-drive.ts` — list, search, browse, download files
- [ ] Create `src/node/features/google-sheets.ts` — read spreadsheet data as JSON/CSV
- [ ] Create `src/node/features/google-calendar.ts` — list calendars, list/search events
- [ ] Create `src/node/features/google-docs.ts` — read docs, convert to markdown
- [ ] Update `src/node/container.ts` — imports, NodeFeatures interface, NodeContainer properties, type exports
- [ ] Run `bun run typecheck`
- [ ] Run `bun run build:introspection`

## Design

### Dependency

```
"googleapis": "^144.0.0"
```

Provides OAuth2Client, service account auth, and typed clients for Drive v3, Sheets v4, Calendar v3, Docs v1.

### Feature: `google-auth.ts`

Central auth feature all others depend on. Handles both OAuth2 (interactive browser flow) and service account (JSON key file).

**Options:** `clientId`, `clientSecret` (fall back to `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` env vars), `serviceAccountKeyPath` / `serviceAccountKey`, `scopes`, `redirectPort`, `tokenCacheKey`, `encrypt`

**State:** `authMode` ('oauth2' | 'service-account' | 'none'), `isAuthenticated`, `email`, `scopes`, `tokenExpiry`, `lastError`

**Events:** `authenticated`, `tokenRefreshed`, `authorizationRequired`, `error`

**Key methods:**
- `authorize(scopes?)` — OAuth2 flow: spins up temp Express callback server, opens browser via opener feature, exchanges code for tokens, stores refresh token in diskCache
- `authenticateServiceAccount()` — Loads JSON key, creates JWT auth
- `tryRestoreTokens()` — Attempts to restore from cached refresh token on enable
- `getAuthClient()` — Returns the authenticated auth instance for passing to googleapis service constructors
- `revoke()` — Revokes credentials, clears cache

### Feature: `google-drive.ts`

**Options:** `defaultCorpora`, `pageSize`

**Key methods:**
- `listFiles(query?, options?)` — Files.list with optional query filter
- `listFolder(folderId, options?)` — List folder contents
- `browse(folderId?)` — Browse folder hierarchy with breadcrumbs
- `search(term, options?)` — Search by name/content/mimeType
- `getFile(fileId)` — File metadata
- `download(fileId)` — Download as Buffer
- `downloadTo(fileId, localPath)` — Download and save to disk
- `exportFile(fileId, mimeType)` — Export Workspace files (Docs/Sheets/Slides)
- `listDrives()` — List shared drives

### Feature: `google-sheets.ts`

**Options:** `defaultSpreadsheetId`

**Key methods:**
- `getSpreadsheet(id?)` — Metadata and sheet list
- `listSheets(id?)` — List tabs
- `getRange(range, id?)` — Raw values as 2D string array
- `getAsJson(sheetName?, id?)` — First row as headers, rest as objects
- `getAsCsv(sheetName?, id?)` — CSV string
- `saveAsJson(localPath, sheetName?, id?)` — Download as JSON file
- `saveAsCsv(localPath, sheetName?, id?)` — Download as CSV file

### Feature: `google-calendar.ts`

**Options:** `defaultCalendarId` (default: 'primary'), `timeZone`

**Key methods:**
- `listCalendars()` — All accessible calendars
- `listEvents(options?)` — Events in time range with query/pagination
- `getToday(calendarId?)` — Today's events
- `getUpcoming(days?, calendarId?)` — Next N days of events
- `getEvent(eventId, calendarId?)` — Single event detail
- `searchEvents(query, options?)` — Freetext search

### Feature: `google-docs.ts`

**Key methods:**
- `getDocument(docId)` — Raw Docs API structured response
- `getAsMarkdown(docId)` — Convert to markdown
- `getAsText(docId)` — Plain text extraction
- `saveAsMarkdown(docId, localPath)` — Save markdown to file
- `listDocs(query?)` — List Google Docs via Drive (mimeType filter)
- `searchDocs(term)` — Search docs by name

Markdown converter handles: headings, bold/italic/strikethrough, links, code font, ordered/unordered lists with nesting, tables, images, section breaks.

### Inter-feature dependencies

```
google-auth (uses: diskCache, vault, networking, opener, express)
    ├── google-drive (uses: google-auth)
    │       └── google-docs (uses: google-auth, google-drive for listing)
    ├── google-sheets (uses: google-auth)
    └── google-calendar (uses: google-auth)
```

Service features access auth lazily: `get auth() { return this.container.feature('googleAuth') }`

### Default scopes

- Drive: `drive.readonly`
- Sheets: `spreadsheets.readonly`
- Calendar: `calendar.readonly`
- Docs: `documents.readonly`

## Test plan

- [ ] `bun run typecheck` passes with all five features registered
- [ ] `bun run build:introspection` generates metadata for all five features
- [ ] OAuth2 flow: authorize, list Drive files, revoke
- [ ] Service account flow: authenticate, read a spreadsheet
- [ ] Sheets: getAsJson returns properly keyed objects
- [ ] Calendar: getToday returns events for current day
- [ ] Docs: getAsMarkdown produces valid markdown with headings, lists, tables

## References

- [Google APIs Node.js Client](https://github.com/googleapis/google-api-nodejs-client)
- [Google Drive API v3](https://developers.google.com/drive/api/v3/reference)
- [Google Sheets API v4](https://developers.google.com/sheets/api/reference/rest)
- [Google Calendar API v3](https://developers.google.com/calendar/api/v3/reference)
- [Google Docs API v1](https://developers.google.com/docs/api/reference/rest)
- See `src/node/features/telegram.ts` for feature pattern reference
- See `src/node/features/disk-cache.ts` for token storage pattern
