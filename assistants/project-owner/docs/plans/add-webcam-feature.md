---
status: approved
---

# Webcam Feature for WebContainer

## Context

The WebContainer has features wrapping browser APIs (Speech, VoiceRecognition, Network) but nothing for camera/video. This adds a `webcam` feature that wraps `getUserMedia`, `MediaRecorder`, and `OffscreenCanvas` to provide camera streaming, still image capture, and video recording — following the exact same patterns as the existing web features.

## Files to Modify

| File | Change |
|------|--------|
| `src/web/features/webcam.ts` | **New file** — full Webcam feature |
| `src/web/container.ts` | Add `webcam` to `WebFeatures` and `WebContainer` interfaces |
| `src/web/extension.ts` | Import Webcam and add `.use(Webcam)` |

## Feature Design

### Options (WebcamOptionsSchema)

- `facingMode` — `'user' | 'environment'` (front/back camera preference)
- `deviceId` — explicit camera device ID (overrides facingMode)
- `width`, `height`, `frameRate` — video constraint hints
- `audio` — include audio track (default: false)
- `autoStart` — auto-request camera on creation
- `imageFormat` — default capture format (`image/png`, `image/jpeg`, `image/webp`)
- `imageQuality` — default JPEG/WebP quality (0-1)
- `recordingMimeType` — default recording MIME type

### State (WebcamStateSchema)

- `streaming` — camera is active
- `recording` — recording in progress
- `activeDeviceId`, `activeDeviceLabel` — current camera
- `devices` — array of `{ deviceId, label, groupId }`
- `width`, `height` — actual video dimensions
- `permissionState` — `'prompt' | 'granted' | 'denied' | 'unknown'`
- `lastError` — most recent error message

### Public API

**Lifecycle:**
- `start(overrides?)` → `Promise<MediaStream>` — request camera, emit `'start'`
- `stop()` — release all resources, emit `'stop'`
- `switchCamera(deviceId)` → `Promise<MediaStream>` — switch to specific camera
- `cycleCamera()` → `Promise<MediaStream>` — rotate to next available camera

**Image capture:**
- `captureImage(options?)` → `Promise<Blob>` — grab current frame as image blob
- `captureImageAsDataURL(options?)` → `Promise<string>` — same but returns data URL

**Video recording:**
- `startRecording(options?)` — begin recording via MediaRecorder
- `stopRecording()` → `Promise<Blob>` — stop and return recorded video blob
- `pauseRecording()` / `resumeRecording()` — pause/resume support

**Device management:**
- `enumerateDevices()` → `Promise<Device[]>` — refresh available cameras
- `attachToVideo(el)` / `detachFromVideo(el)` — convenience for connecting stream to `<video>` element

**Getters:** `isStreaming`, `isRecording`, `mediaStream`, `activeDeviceId`, `activeDeviceLabel`, `devices`, `dimensions`, `permissionState`, `supportedRecordingTypes`

### Events

| Event | Payload | When |
|-------|---------|------|
| `start` | `MediaStream` | Camera stream started |
| `stop` | — | Stream stopped |
| `error` | `Error` | getUserMedia or operation failed |
| `switch` | `deviceId` | Camera switched |
| `trackEnded` | — | Video track ended unexpectedly |
| `capture` | `Blob` | Still image captured |
| `devicesChanged` | `Device[]` | Camera list changed |
| `recordingStart` | — | Recording began |
| `recordingStop` | `Blob` | Recording finished |
| `recordingData` | `Blob` | Recording chunk available (timeslice mode) |
| `recordingPause`/`Resume` | — | Recording paused/resumed |
| `recordingError` | `Event` | MediaRecorder error |

### Image Capture Strategy

1. **Preferred:** `ImageCapture` API → `grabFrame()` → draw to `OffscreenCanvas` → `convertToBlob()`
2. **Fallback:** Temporary muted `<video>` element → `ctx.drawImage()` on `OffscreenCanvas` → `convertToBlob()`

Both paths support format, quality, and resize options.

### Key Design Decisions

- **No managed video element** — feature provides the `MediaStream`; consumer attaches to their own `<video>` via `attachToVideo()`. Keeps it DOM-agnostic (works with React refs, vanilla DOM, headless).
- **Audio off by default** — camera feature, not a full A/V capture suite. Opt-in for recording use cases.
- **OffscreenCanvas** — modern browsers only (Safari 16.4+). Could add regular canvas fallback if needed.
- **Clean resource management** — `stop()` releases all tracks, stops recording first if active. Track `ended` event handles browser-revoked permissions.

## Implementation Steps

### Phase 1: Webcam Feature

1. Create `src/web/features/webcam.ts` with schemas, types, and the `Webcam` class
2. Update `src/web/container.ts` — add import and interface entries
3. Update `src/web/extension.ts` — add import and `.use(Webcam)`
4. Run `bun run typecheck`
5. Run `bun run build:introspection`

### Phase 2: Vision Playground Project

Build a playground project at `playground/vision-lab/` that demonstrates the webcam feature streaming frames to a backend where they can be routed to a computer vision pipeline.

#### Architecture

```
Browser (WebContainer)              Server (NodeContainer)
┌─────────────────────┐             ┌──────────────────────────┐
│ Webcam feature       │            │ Express (static + API)   │
│   ↓ captureImage()  │  WebSocket  │ WebSocket server         │
│ Frame capture loop   │───frames──→│   ↓                      │
│   (base64 JPEG)     │            │ VisionPipeline            │
│                      │←─results──│   ↓ process(frame)        │
│ Results overlay UI   │            │ [pluggable processor]    │
└─────────────────────┘             └──────────────────────────┘
```

#### Files to Create

| File | Purpose |
|------|---------|
| `playground/vision-lab/package.json` | Project metadata, `luca serve` script |
| `playground/vision-lab/server.ts` | Backend entry: Express + WebSocket + vision pipeline |
| `playground/vision-lab/vision-pipeline.ts` | Pluggable frame processor interface and stub |
| `playground/vision-lab/public/index.html` | Frontend UI — video preview, controls, results |
| `playground/vision-lab/public/app.js` | Frontend logic — webcam feature, WebSocket frame sender |

#### Backend: `server.ts`

- Create a `NodeContainer`
- Start Express on port 3000, serving `public/` as static files
- Start WebSocket server on port 8081
- On WebSocket `message`, decode the frame and pass it to the vision pipeline
- Send pipeline results back to the client over WebSocket

#### Backend: `vision-pipeline.ts`

A pluggable processor interface. Ships with a no-op stub that returns frame metadata (dimensions, timestamp). Designed to be swapped out for a real CV backend later.

```typescript
export interface VisionProcessor {
  name: string
  process(frame: { data: string; timestamp: number; width: number; height: number }): Promise<VisionResult>
}

export interface VisionResult {
  processor: string
  timestamp: number
  detections: Array<{
    label: string
    confidence: number
    bbox?: { x: number; y: number; w: number; h: number }
  }>
  metadata?: Record<string, any>
}
```

Ships with two processor stubs:

1. **`EchoProcessor`** — returns frame metadata (proves the pipeline works end-to-end)
2. **`OpenAIVisionProcessor`** (scaffolded, not wired) — shows how you'd send a frame to an LLM vision API

The pipeline class manages the active processor and handles frame throttling (configurable FPS cap so you don't flood the backend).

#### Frontend: `public/index.html`

Minimal UI:
- `<video>` element for live preview
- Start/Stop camera button
- FPS slider (frames sent per second to backend)
- Results panel showing latest detections
- Status indicator (connected/streaming/processing)

#### Frontend: `public/app.js`

- Creates a `WebContainer`, gets the `webcam` feature
- On start: opens WebSocket to `ws://localhost:8081`
- Runs a capture loop at the configured FPS: calls `webcam.captureImage({ format: 'image/jpeg', quality: 0.7 })`, converts to base64, sends over WebSocket with timestamp and dimensions
- Receives results from WebSocket and renders them in the results panel

#### Frame Protocol (WebSocket messages)

**Client → Server:**
```json
{
  "type": "frame",
  "data": "<base64 JPEG>",
  "timestamp": 1708000000000,
  "width": 640,
  "height": 480
}
```

**Server → Client:**
```json
{
  "type": "result",
  "processor": "echo",
  "timestamp": 1708000000000,
  "detections": [],
  "metadata": { "frameSize": 12345 },
  "processingMs": 2
}
```

**Control messages:**
```json
{ "type": "setProcessor", "processor": "echo" }
{ "type": "setFps", "fps": 5 }
```

### Phase 2 Implementation Order

6. Create `playground/vision-lab/package.json`
7. Create `playground/vision-lab/vision-pipeline.ts` — processor interface + stubs
8. Create `playground/vision-lab/server.ts` — Express + WebSocket + pipeline wiring
9. Create `playground/vision-lab/public/index.html` — UI
10. Create `playground/vision-lab/public/app.js` — frontend webcam + WebSocket logic

## Verification

### Phase 1
1. `bun run typecheck` passes
2. `bun run build:introspection` generates metadata for `features.webcam`
3. `container.feature('webcam')` returns typed Webcam instance
4. `container.features.available` includes `webcam`

### Phase 2
1. `cd playground/vision-lab && bun run server.ts` starts Express on 3000 and WebSocket on 8081
2. Open `http://localhost:3000` — camera preview appears after granting permission
3. Clicking Start streams frames to server, results panel shows echo processor responses
4. FPS slider adjusts capture rate
5. WebSocket reconnects gracefully on disconnect
