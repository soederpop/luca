---
name: drawing-on-canvas
description: Draws, charts and builds small interactive views on a canvas — a locked-down web page the workbench host serves and an assistant drives with createCanvas, canvasEval and canvasSnapshot. The page has the Luca web runtime, loads packages from unpkg, and talks to servers the assistant starts and to the workbench host's read-only routes. Use when someone asks to draw, sketch, chart, plot, visualize, diagram or prototype something on screen, to "show me" data, or to build a live view of data that a project server provides.
---

# Drawing on a Canvas

A canvas is a blank web page in a Luca Desktop tile. You make it, then run code in it. The page is yours to draw on: a `<canvas>`, the DOM, SVG, WebGL, any package from unpkg.

The workbench host serves the page, so canvas tools exist only in a chat the workbench host runs (Luca Desktop's chat tile). The page also opens in a plain browser: `createCanvas` and `listCanvases` give its `url`.

## The tools

| Tool | What it does |
|---|---|
| `createCanvas({ title })` | Makes a canvas and opens it beside the chat. Returns `canvas.id`. `createCanvas({ id })` reopens one. |
| `canvasEval({ id, code })` | Runs JavaScript or TypeScript in the page. Returns `{ ok, value, logs }` or `{ ok: false, error, stack, logs }`. |
| `canvasSnapshot({ id })` | Gives you a PNG of the page. **Look after you draw.** |
| `canvasEvents({ id, since })` | Events the page sent with `emit(name, data)`, and page errors (name `error`). |
| `listCanvases()` | All canvases of the project, open or not. |
| `resetCanvas({ id })` | Drops the saved code and reloads: a blank canvas. |

## The loop: draw, look, fix

1. `createCanvas` with a short title.
2. `canvasEval` small steps: load a library, then draw, then add labels. A small step that fails is easy to fix.
3. `canvasSnapshot` after each visible change. Read the picture. Fix what is wrong before you say it is done.

## How code runs

- **One expression gives back its value.** `canvas.width` works. For more than one statement, use `return`.
- **Top-level `await` works.**
- **Local variables end with the call.** Keep what later calls need on `window`: `window.chart = ...`.
- **Code that worked is saved** and runs again, in order, when the page reloads or the canvas opens again after a restart. So write each step so it can run again from a blank page. Pass `keep: false` for a question that draws nothing (`canvasEval({ id, code: 'stage.clientWidth', keep: false })`).
- `console.log` output comes back in `logs`.

## Globals in the page

| Name | What it is |
|---|---|
| `container` (also `luca`) | The Luca web container. `container.feature('assetLoader')`, `container.client('rest', { baseURL })`, `container.feature('vm')`, `container.feature('esbuild')` and the rest of the web runtime. |
| `stage` | The full-page `<div>`. Put DOM and SVG here. |
| `canvas` | A `<canvas>` that fills the stage. Its bitmap is in device pixels. |
| `ctx` | Its 2D context, **already scaled to CSS pixels**: `ctx.fillRect(0, 0, stage.clientWidth, stage.clientHeight)` fills the stage. Made on first use, so `canvas.getContext('webgl')` still works if you never touch `ctx`. |
| `dpr` | `devicePixelRatio`. |
| `unpkg(pkg)` | Imports an ES module from unpkg: `const d3 = await unpkg('d3@7')`. |
| `unpkg(pkg, globalName)` | Loads a UMD script and returns its global: `await unpkg('chart.js@4', 'Chart')`. |
| `loadStylesheet(href)` | A stylesheet from unpkg: `loadStylesheet('leaflet@1.9.4/dist/leaflet.css')`. |
| `workbench.get(path, query?)` | Reads the workbench host (routes below). |
| `emit(name, data)` | Sends an event you read with `canvasEvents`. Use it for clicks and picks. |
| `clear()` | Wipes the stage now. The saved code still runs on reload: use `resetCanvas` to start over for real. |

Pin versions (`d3@7`, `three@0.170.0`). An unpinned package can change under a saved canvas.

## What the page can reach

The page is locked down. The host's CSP header and Luca Desktop's content rules both enforce it.

- **Scripts**: the host itself and `https://unpkg.com`. Nothing else: not esm.sh, not jsdelivr, not inline `<script>` tags.
- **Network**: its own host, `127.0.0.1` and `localhost` on any port, Tailscale by MagicDNS name (`*.ts.net`), and unpkg.
- **Tailscale by IP (`100.x.y.z`) does not work** from code: the CSP can only match names. Use the machine's `*.ts.net` name.
- Packages that fetch from their own CDN (map tiles, fonts from Google) do not load. Pick packages that bundle their assets, or serve the assets yourself (below).

## Data: start a server, then a client in the page

You run in the workbench host's process, so a server you start there is up for as long as the host is. The page connects to it like any client.

1. Start the server with `evalCode` (in your own process, not the page). Express turns CORS on by default, and the page needs it, because the server's port is a different origin:

   ```ts
   const server = container.server('express', { port: 43917 })
   server.app.get('/sales', (req, res) => res.json(rows))
   await server.start()
   ```

   For a live feed, a websocket server:

   ```ts
   const ws = container.server('websocket', { port: 43918, json: true })
   ws.on('connection', (socket) => socket.send(JSON.stringify(latest)))
   await ws.start()
   ```

   A project with `endpoints/` can use `luca serve` instead. The workbench's servers tile shows what is running.

2. Read it in the page:

   ```js
   const api = container.client('rest', { baseURL: 'http://127.0.0.1:43917' })
   window.rows = await api.get('/sales')
   ```

   Or `new WebSocket('ws://127.0.0.1:43918')` for the feed.

Pick a port that is free; `luca` gives you `container.feature('networking').findOpenPort(43000)` in your own process.

**A project on another machine** (opened over ssh): the host and your servers run there, but `127.0.0.1` in the page is this Mac. Bind the server to that machine's Tailscale address and use its `*.ts.net` name in the page.

## Reading the workbench host

`workbench.get(path)` reads these routes, and only these. They are read-only.

| Path | What it gives |
|---|---|
| `/project` | name, folder, Luca version, registry counts |
| `/registries`, `/registry/<name>` | the project's helpers, as card stacks |
| `/helper/<registry>/<id>` | one helper's docs, methods, live state |
| `/docs`, `/docs/models`, `/docs/item?id=` | contentbase documents and models |
| `/servers` | running servers and the servers registry |
| `/endpoints`, `/serve` | the project's routes and the `luca serve` child |

Everything else (eval, files, saving, chat) is refused with the canvas key. When the page needs other data, give it a server of your own.

## Patterns

**A chart with d3:**

```js
const d3 = await unpkg('d3@7')
const rows = await container.client('rest', { baseURL: 'http://127.0.0.1:43917' }).get('/sales')
const w = stage.clientWidth, h = stage.clientHeight, m = 40
const x = d3.scaleBand(rows.map((r) => r.month), [m, w - m]).padding(0.2)
const y = d3.scaleLinear([0, d3.max(rows, (r) => r.total)], [h - m, m])
const svg = d3.select(stage).append('svg').attr('width', w).attr('height', h).style('position', 'absolute').style('inset', 0)
svg.selectAll('rect').data(rows).join('rect')
  .attr('x', (r) => x(r.month)).attr('y', (r) => y(r.total))
  .attr('width', x.bandwidth()).attr('height', (r) => y(0) - y(r.total)).attr('fill', '#3a7bd5')
svg.append('g').attr('transform', `translate(0,${h - m})`).call(d3.axisBottom(x))
svg.append('g').attr('transform', `translate(${m},0)`).call(d3.axisLeft(y))
return rows.length
```

**Ask the user to pick:**

```js
stage.addEventListener('click', (e) => emit('picked', { x: e.clientX, y: e.clientY }))
```

Then `canvasEvents({ id })` after they say they clicked.

## Gotchas

- **A snapshot from Luca Desktop is the whole page.** Without the app (a browser), the page can copy only its `<canvas>` elements: SVG and HTML are left out, and the answer says `partial: true`.
- **The tile can be resized.** The default canvas keeps its drawing, but layout you computed from `stage.clientWidth` does not follow. Redraw in a `window.addEventListener('resize', ...)` handler when it matters.
- **A saved step that fails on replay** is logged on the host and skipped. If a canvas comes back wrong, `resetCanvas` and draw again.
- **Big results are cut.** Return a summary (`rows.length`), not the whole data set.
