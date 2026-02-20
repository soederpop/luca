# Native Command Launcher Client Spec (Bun Server)

This document defines how the Bun process should talk to the macOS launcher app.

## 1. Transport

- Protocol: Unix domain socket (`AF_UNIX`, `SOCK_STREAM`)
- Message framing: NDJSON (one JSON object per line, `\n` terminated)
- Default socket path expected by app:
  - `~/Library/Application Support/NativeCommandLauncherApp/ipc.sock`
- Fallback socket path (app-side fallback behavior):
  - `/tmp/native-command-launcher.<uid>.sock`

## 2. Direction

- App is the client.
- Bun is the server.
- App writes command events to Bun.
- Bun writes status/result messages back on the same connection.

## 3. Correlation

Every Bun response **must include** the same `id` received from the app command event.

## 4. App -> Bun command event

Example:

```json
{
  "id": "0f93ea18-2d5b-418f-93dd-04a42fcb95fc",
  "type": "command",
  "payload": {
    "text": "open notes",
    "transcript": "open notes",
    "source": "voice",
    "user": {
      "uid": 501,
      "username": "jon"
    },
    "timestamp": "2026-02-20T05:07:12Z",
    "meta": {
      "hotkey": "Cmd+Space"
    }
  },
  "status": "queued"
}
```

## 5. Bun -> App response schema

Base fields:

- `id` (string UUID, required)
- `status` (string, required): one of `processing`, `progress`, `finished`

Optional common fields:

- `timestamp` (ISO-8601 string)
- `worker` (string)
- `pid` (number)
- `message` (string)

### 5.1 Processing acknowledgement

```json
{
  "id": "0f93ea18-2d5b-418f-93dd-04a42fcb95fc",
  "status": "processing",
  "worker": "bun-1234",
  "timestamp": "2026-02-20T05:07:13Z"
}
```

### 5.2 Progress update (optional)

```json
{
  "id": "0f93ea18-2d5b-418f-93dd-04a42fcb95fc",
  "status": "progress",
  "progress": 0.42,
  "message": "Looking up app",
  "timestamp": "2026-02-20T05:07:13Z"
}
```

### 5.3 Finished success

```json
{
  "id": "0f93ea18-2d5b-418f-93dd-04a42fcb95fc",
  "status": "finished",
  "success": true,
  "result": {
    "action": "open",
    "target": "/Applications/Notes.app"
  },
  "timestamp": "2026-02-20T05:07:15Z"
}
```

### 5.4 Finished failure

```json
{
  "id": "0f93ea18-2d5b-418f-93dd-04a42fcb95fc",
  "status": "finished",
  "success": false,
  "error": "app-not-found: notes",
  "timestamp": "2026-02-20T05:07:15Z"
}
```

## 6. Spoken-response extension (implemented)

The macOS app now supports optional speech text in Bun responses.

If Bun includes either of these fields, the app will speak the phrase using macOS TTS:

- `speech` (preferred)
- `speak` (alias)

This can be sent with `processing`, `progress`, or `finished`.

Example (ack + speech):

```json
{
  "id": "0f93ea18-2d5b-418f-93dd-04a42fcb95fc",
  "status": "processing",
  "worker": "bun-1234",
  "speech": "Working on it"
}
```

Example (finished + speech):

```json
{
  "id": "0f93ea18-2d5b-418f-93dd-04a42fcb95fc",
  "status": "finished",
  "success": true,
  "result": {
    "action": "open",
    "target": "/Applications/Notes.app"
  },
  "speech": "Done. Opened Notes."
}
```

Backward-compatible fallback:

- If needed, app also checks `result.speech` and `result.speak`.

## 7. Window-dispatch extension (implemented)

The app now supports optional window commands in Bun responses on the same IPC connection.

Top-level field:

- `window` (object, optional)

Supported `window.action` values:

- `open` / `spawn`
- `focus`
- `close`
- `navigate`
- `eval`

`open`/`spawn` accepts either `request` or flat fields.

Example:

```json
{
  "id": "0f93ea18-2d5b-418f-93dd-04a42fcb95fc",
  "status": "processing",
  "window": {
    "action": "open",
    "url": "https://example.com",
    "width": 1024,
    "height": 768,
    "x": 180,
    "y": 140,
    "alwaysOnTop": false
  }
}
```

Or nested:

```json
{
  "id": "0f93ea18-2d5b-418f-93dd-04a42fcb95fc",
  "status": "processing",
  "window": {
    "action": "open",
    "request": {
      "url": "https://example.com",
      "width": 1024,
      "height": 768,
      "window": {
        "decorations": "hiddenTitleBar",
        "alwaysOnTop": true
      }
    }
  }
}
```

For `focus` or `close`, provide optional `windowId` (UUID string). If omitted, app uses most-recent window.

`navigate` requires `url` plus optional `windowId`.

Example:

```json
{
  "id": "0f93ea18-2d5b-418f-93dd-04a42fcb95fc",
  "status": "processing",
  "window": {
    "action": "navigate",
    "windowId": "74D5A3C6-26D0-4E60-84AA-17E0AC46D219",
    "url": "https://news.ycombinator.com"
  }
}
```

`eval` requires `code` plus optional `windowId`.

- `timeoutMs` (optional, default `5000`, minimum effective `100`)
- `returnJson` (optional, default `true`)

Example:

```json
{
  "id": "0f93ea18-2d5b-418f-93dd-04a42fcb95fc",
  "status": "processing",
  "window": {
    "action": "eval",
    "windowId": "74D5A3C6-26D0-4E60-84AA-17E0AC46D219",
    "code": "({ title: document.title, href: location.href })",
    "timeoutMs": 3000,
    "returnJson": true
  }
}
```

### 7.1 Window Ack (app -> Bun)

After each window command, app sends an acknowledgement on the same socket:

- `type`: `"windowAck"`
- `id`: original request id
- `status`: `"finished"`
- `success`: boolean
- `action`: window action
- `result`: object when `success=true`
- `error`: string when `success=false`
- `timestamp`: ISO-8601

Success example:

```json
{
  "id": "0f93ea18-2d5b-418f-93dd-04a42fcb95fc",
  "type": "windowAck",
  "status": "finished",
  "success": true,
  "action": "eval",
  "result": {
    "ok": true,
    "windowId": "74D5A3C6-26D0-4E60-84AA-17E0AC46D219",
    "value": "{\"title\":\"Hacker News\",\"href\":\"https://news.ycombinator.com/\"}",
    "json": {
      "title": "Hacker News",
      "href": "https://news.ycombinator.com/"
    }
  },
  "timestamp": "2026-02-20T05:07:15Z"
}
```

Failure example:

```json
{
  "id": "0f93ea18-2d5b-418f-93dd-04a42fcb95fc",
  "type": "windowAck",
  "status": "finished",
  "success": false,
  "action": "navigate",
  "error": "no target window",
  "timestamp": "2026-02-20T05:07:15Z"
}
```

## 8. Timing expectations

- Send `processing` quickly after command receipt (target: near-immediate).
- Send `finished` exactly once per command id.
- App marks commands stalled if no processing response is received within configured timeout (default 30s).

## 9. Error handling

- Unknown fields are ignored by app.
- Malformed JSON line is ignored by app; next lines continue parsing.
- Missing `id` prevents correlation and should be treated as protocol error on Bun side.
