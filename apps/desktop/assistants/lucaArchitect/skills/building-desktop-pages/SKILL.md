---
name: building-desktop-pages
description: Builds a web page for a project that opens as a tile in Luca Desktop — a plain HTML file in public/ served by luca serve, styled with the kit's --al-* tokens and al-* classes, with keys the app routes to it and the app's palette for picks, prompts and confirms. Use when someone asks for a page, a board, a dashboard, a form, an admin view or a small UI for their project that should live in Luca Desktop, open beside their chat, or "feel like part of the app". Not for a one-off drawing or chart inside a chat, which is drawing-on-canvas.
---

# Building a Luca Desktop Page

A desktop page is an ordinary web page the project serves. The person opens it as a tile in Luca Desktop, and two files make it look and behave like the rest of the app. The page also works in a plain browser: nothing in it needs the app.

The page is a file, not a canvas. It survives restarts, it is in the project's repo, and anyone can open it. Reach for a canvas (`drawing-on-canvas`) for a quick picture inside a chat; reach for a page when the thing should stay.

## The kit

Every Luca express server, `luca serve`, and the workbench host serve the kit at `/_luca/desktop/`. Load it with two tags and one class:

```html
<link rel="stylesheet" href="/_luca/desktop/kit.css">
<script src="/_luca/desktop/kit.js"></script>
<body class="al-page">
```

| File | What it gives |
|---|---|
| `kit.css` | `--al-*` tokens (colors, type, space, radius, motion) and `al-*` classes (`al-page`, `al-card`, `al-row`, `al-button`, `al-input`, `al-table`, `al-badge`, `al-key`, `al-tile-header`, …). One cascade layer, no element selectors, so your own CSS wins. |
| `kit.js` | `window.lucaDesktop`: `available`, `host`, `theme`, `keys`, `shell`, `open(uri)`, `on(event, fn)`. Also `kit.mjs` as an ES module. |
| `tokens.json` | every token as JSON |

Do not restate the API from memory. Read `kit.js` from the running server (`curl -s localhost:<port>/_luca/desktop/kit.js | head -40` lists every member in its header comment), or `luca desktop sdk --print kit.js`. The project's Luca version decides what is there.

The two rules of the look:

- **Every color is an `--al-*` variable.** Never a fixed hex. The app pushes the theme the person picked (`Space T`) into the page with no reload, and a hex color stays behind.
- **`al-page` on `<body>`.** It sets the ground, the body text and the font. `al-page-body` on a wrapper pads content to a readable width. A tile is often 600 to 900 points wide: lay the page out for that.

## Keys

Luca Desktop is modal. In Normal mode the page gets **no key** unless the page bound it. Two ways:

```html
<button class="al-button" data-key="n" data-key-label="new order">New</button>
```

```js
const unbind = lucaDesktop.keys.bind('F', 'filter by project', pickProject)
```

The element gets a key cap, the key clicks it (or focuses a field), and the keys view (`?`) lists it. A key is the DOM `KeyboardEvent.key` (`F`, `Enter`, `ArrowLeft`), with `ctrl+`, `alt+`, `shift+` before it when needed.

- **Never take `Space`, `:`, `?` or `Esc`.** The app keeps them.
- **A page key wins over the tile's own keys** (`r` reload, `f` hints, `j` `k` scroll). Pick capitals or letters the tile does not use.
- **A text field needs no code.** Focus in it puts the app in Insert mode; `Esc` gives the keyboard back.

## The shell, with a fallback

`lucaDesktop.shell` is the app's palette: `choose(title, items)`, `ask(title, initial)`, `confirm(question, yes)`, `flash(text)`. Each returns a Promise; `choose` and `ask` give `null` on Esc. Only the focused tile may open the palette, and in a browser nothing answers.

So **check `shell.can(name)` first and keep the page's own control for the browser.** This is the pattern for every shell call:

```js
async function pickProject() {
  if (!lucaDesktop.shell.can('choose')) return document.querySelector('[name=project]').focus()
  const pick = await lucaDesktop.shell.choose('show which project', projects.map((p) => ({
    title: p.name, detail: `${p.items} items`, value: p.name,
  })))
  if (!pick) return // Esc
  await fetch('/api/board/filter', { method: 'POST', body: JSON.stringify({ project: pick.value }) })
  lucaDesktop.shell.flash(`Board: ${pick.value}`)
}
```

The app sees only `title` and `detail`; you get your own item back. `lucaDesktop.open('doc/notes/plan.md')` opens another tile of the same project beside the page; another project's address is refused.

## Recipe: a page in `public/`

`luca serve` serves `public/` as static files and `endpoints/` as routes, on the same origin. A page there needs nothing else.

1. Write `public/<name>.html`:

   ```html
   <!doctype html>
   <html lang="en">
   <head>
     <meta charset="utf-8">
     <title>Orders</title>
     <link rel="stylesheet" href="/_luca/desktop/kit.css">
     <script src="/_luca/desktop/kit.js"></script>
     <style>
       .orders { display: grid; gap: var(--al-space-3); }
       .total { color: var(--al-text-muted); font-size: var(--al-text-sm); }
     </style>
   </head>
   <body class="al-page">
     <div class="al-page-body">
       <header class="al-tile-header">
         <span class="al-title">Orders</span>
         <button class="al-button" data-key="N" data-key-label="new order">New</button>
         <button class="al-button al-button-ghost" data-key="S" data-key-label="status">Status</button>
         <select name="status" class="al-input"><option>open</option><option>shipped</option><option>all</option></select>
       </header>
       <div class="orders" id="orders"></div>
     </div>
     <script>
       const api = (path, init) => fetch(path, init).then((r) => r.json())
       async function load(status = 'open') {
         const rows = await api(`/api/orders?status=${status}`)
         document.getElementById('orders').innerHTML = rows.map((o) => `
           <div class="al-card">
             <div class="al-card-title">${o.customer}</div>
             <div class="al-card-meta"><span class="al-badge" data-status="${o.status}">${o.status}</span> <span class="total">${o.total}</span></div>
           </div>`).join('')
       }
       async function pickStatus() {
         const field = document.querySelector('[name=status]')
         // In a browser the <select> is the control. In the app, the palette is.
         if (!lucaDesktop.shell.can('choose')) return field.focus()
         const pick = await lucaDesktop.shell.choose('show orders', [
           { title: 'Open', detail: 'not shipped yet', value: 'open' },
           { title: 'Shipped', value: 'shipped' },
           { title: 'All', value: 'all' },
         ])
         if (!pick) return
         field.value = pick.value
         await load(pick.value)
         lucaDesktop.shell.flash(`Orders: ${pick.title}`)
       }
       document.querySelector('[data-key=S]').addEventListener('click', pickStatus)
       document.querySelector('[data-key=N]').addEventListener('click', () => (location.href = '/orders-new.html'))
       document.querySelector('[name=status]').addEventListener('change', (e) => load(e.target.value))
       load()
     </script>
   </body>
   </html>
   ```

   The `data-key` buttons are plain buttons: the key clicks them in the app, the mouse clicks them anywhere. The one `choose` call falls back to the `<select>`.

2. Put the data behind a route in `endpoints/` (`luca scaffold endpoint orders`), on the same server, so the page needs no CORS and no port.

3. Prove it. A server in the foreground hangs your tool call, so start, check, stop in one command:

   ```shell
   luca serve --port 38123 & pid=$!; sleep 3; curl -s -o /dev/null -w '%{http_code}\n' localhost:38123/orders.html; curl -s -o /dev/null -w '%{http_code}\n' localhost:38123/_luca/desktop/kit.css; kill $pid
   ```

   Both must be `200`. Then open it in a browser once, and read the console.

4. Tell the person how to open it in Luca Desktop:

   | To | Do |
   |---|---|
   | Open it on `luca serve` | `Space g`, type `/orders.html`, `Enter` (`s` starts the server if it is not running) |
   | By command | `:page orders.html` (`:page orders.html?status=all` with a query) |
   | By address | `:open luca://<project>/page/orders.html` |
   | Keep it in a layout | `luca://<project>/page/orders.html` in a layout file (`Space l`) |

## When the server is not `luca serve`

`container.server('express')` serves the kit too. For any other server, write the files into the project with `luca desktop sdk` (default `public/_luca/desktop/`) and serve that folder, or `luca desktop sdk --print kit.css` to see one file. In code: `import { desktopKitCss, DESKTOP_KIT_JS } from 'luca/web/desktop'`.

## Gotchas

- **A fixed color looks right once and wrong after `Space T`.** Use the tokens. `--al-accent` is the one highlight; `--al-good`, `--al-warn`, `--al-bad` for status; `--al-hue-1` to `--al-hue-8` when a series needs colors.
- **Prose is the UI font.** `al-code` is for identifiers, paths and values, not for sentences.
- **`shell.*` resolves to `null` or `false` in a browser**, it does not throw. A page that forgets the `can` check silently does nothing outside the app.
- **Lower-case keys collide with the tile.** `r`, `f`, `j`, `k` are the tile's; a page that takes them changes what the person expects everywhere. Capitals are safe.
- **A page opens only its own project's tiles** with `lucaDesktop.open`. Another project's `luca://` address is refused with a note in the status line.
- **The tutorial is authoritative.** `docs/tutorials/31-luca-desktop-pages.md` in the Luca repo, or the "Web pages that open as tiles" guide in the project's skill references, covers every class and member for the installed version. Read it before you write the second page.
