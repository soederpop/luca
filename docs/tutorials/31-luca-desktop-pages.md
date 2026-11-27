# Web pages that open as tiles in Luca Desktop

Luca Desktop is the keyboard-first workbench for a Luca project. Any web page
your project serves can open in it as a tile (`Space g`, or `:page <path>`).
This guide is about making that page feel like part of the app: its colors
and type, its keys, its palette.

Two files do it. Every Luca server already serves them:

```html
<link rel="stylesheet" href="/_luca/desktop/kit.css">
<script src="/_luca/desktop/kit.js"></script>
<body class="al-page">
```

`luca serve` and `container.server('express')` answer `/_luca/desktop/kit.css`,
`kit.js`, `kit.mjs` and `tokens.json` on every project. So does the workbench
host, for canvas and guide pages. For a page served by anything else, write
the files with `luca desktop sdk` (default `public/_luca/desktop/`), or
`luca desktop sdk --print kit.css`. In code the same content is
`import { desktopKitCss, DESKTOP_KIT_JS } from 'luca/web/desktop'`.

The page stays an ordinary web page. In a browser `kit.css` follows the
system scheme and `kit.js` keeps every key working in the page; nothing
needs the app.

## The look: `kit.css`

Colors are `--al-*` variables. Use them for every color and never a fixed
hex, so the theme the person picked (`Space T`) reaches your page: the app
pushes its live palette into the page with no reload.

| Variables | For |
|---|---|
| `--al-ground`, `--al-surface`, `--al-raised`, `--al-inset` | the page, a card, a hovered row, a field |
| `--al-border`, `--al-border-strong` | hairlines, field borders |
| `--al-text`, `--al-text-body`, `--al-text-muted`, `--al-text-faint` | titles, prose, labels, hints |
| `--al-accent`, `--al-accent-on`, `--al-accent-soft` | the one highlight color, text on it, its tint |
| `--al-good`, `--al-warn`, `--al-bad`, `--al-info`, `--al-idle` | status |
| `--al-hue-1` to `--al-hue-8` | spare hues; `--al-project` is this project's own |
| `--al-syntax-keyword`, `-string`, `-number`, `-comment`, `-property`, `-type`, `-function` | code |
| `--al-text-xs` to `--al-text-3xl`, `--al-font-sans`, `--al-font-mono` | type |
| `--al-space-1` to `--al-space-8`, `--al-radius-sm/md/lg/pill`, `--al-motion-fast/base/slow` | space, corners, motion |

Classes are all `al-*`, inside one cascade layer, so your own CSS wins. There
are no element selectors and no resets: a page with no `al-` class looks as
it did.

| Class | What it is |
|---|---|
| `al-page` (on `<body>`) | the app's ground, body text and font. `al-page-body` pads content to a readable width |
| `al-title`, `al-heading`, `al-body`, `al-meta`, `al-faint`, `al-code`, `al-link` | type roles. Prose is the UI font; `al-code` for identifiers, paths and values |
| `al-section`, `al-section-title` | a titled block with a colored bar (`--al-section`) |
| `al-card`, `al-card-title`, `al-card-meta`, `al-card-tint` (`--al-tint`) | a card; `al-stacks` > `al-stack` > `al-stack-title` + cards is a card-stack index |
| `al-row`, `al-row-title`, `al-row-meta` | a list row; `al-focus` or `aria-selected="true"` highlights it |
| `al-chip`, `al-dot`, `al-badge` (`data-status="running"`, or `al-badge-good/info/warn/bad/accent`) | small labels |
| `al-key`, `al-key-badge` | a key cap, as the app draws them |
| `al-button`, `al-button-primary`, `al-button-ghost`, `al-input`, `al-textarea` | controls |
| `al-table`, `al-meter` + `al-meter-fill` (`--al-value: 0.6`) | data |
| `al-tile-header`, `al-keys` + `al-keys-item` | a header bar and a key strip like the app's |

A tile is often 600 to 900 points wide. Lay the page out for that.

## The bridge: `kit.js`

It defines `window.lucaDesktop` (or `import lucaDesktop from '/_luca/desktop/kit.mjs'`).

| Member | What it does |
|---|---|
| `available` | true inside Luca Desktop |
| `host` | `{ kind: 'tile' \| 'browser', width, height, focused, scheme, theme, accent, textSize, project: { id, color }, shell }` |
| `theme.scheme`, `theme.get('accent')`, `theme.values()`, `theme.onChange(fn)` | the live tokens |
| `keys.bind(key, label, fn)` | a page key. Returns an unbind function |
| `keys.list()` | every live key, newest first |
| `shell.can(name)` | true when the app answers `'choose'`, `'ask'`, `'confirm'`, `'flash'`, `'open'`, `'keys'` |
| `shell.choose(title, items)` | the app's palette with your rows; a Promise of the picked item, or null on Esc |
| `shell.ask(title, initial)` | one line of text in the palette; a Promise of the text, or null |
| `shell.confirm(question, yes)` | Cancel first, then your label; a Promise of true or false |
| `shell.flash(text)` | a note in the status line |
| `open(uri)` | open a tile: `console`, `doc/notes/a.md`, `helper/features/fs`, or a full `luca://<project>/…` address of this project |
| `on(event, fn)` | `'host'`, `'theme'`, `'focus'`, `'resize'`, `'keys'`. Returns an unsubscribe |

### Keys

Luca Desktop is modal. In Normal mode the page gets **no key** unless the
page has bound it. Bind with `keys.bind`, or put `data-key` on an element:

```html
<button class="al-button" data-key="n" data-key-label="new order">New</button>
```

```js
lucaDesktop.keys.bind('F', 'filter by project', pickProject)
```

The element gets a key cap, the key clicks it (or focuses a field), the app
routes the key to the page in Normal mode, and the keys view (`?`) lists it.
A key is the DOM `KeyboardEvent.key` (`F`, `Enter`, `ArrowLeft`) with
`ctrl+`, `alt+`, `shift+` before it when needed.

Rules:

- Do not take `Space`, `:`, `?` or `Esc`. The app keeps them.
- A page key wins over the tile's own keys (`r` reload, `f` hints, `j` `k`
  scroll). Pick capitals or letters the tile does not use.
- A text field needs no code: focus in it puts the app in Insert mode, `Esc`
  gives the keyboard back. For an editor or shortcuts of your own, the person
  presses `i` on the tile: every key goes to the page until `Mod-Esc`.

### The palette, with a fallback

Only the tile in focus may open the palette. Call it from a key or a click,
check `can` first and keep the page's own control for a browser:

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

The app sees only `title` and `detail`; you get your own item back.

### Opening tiles from the page

`lucaDesktop.open('doc/notes/plan.md')` opens that document beside the page.
A page opens only its own project's tiles; any other address is refused with
a note in the status line.

## Opening the page in the app

| To | Do |
|---|---|
| Pick a path on `luca serve` | `Space g`, type `/board.html`, `Enter` (`s` starts the server if it is not running) |
| Open any URL | `Space g`, type `https://…` |
| By command | `:page board.html?team=ops` |
| By address | `:open luca://<project>/page/board.html` |
| Keep it in a layout | `luca://<project>/page/board.html` in a layout file (`Space l`) |

The app and the kit share one source for their look:
`src/web/desktop/tokens.ts` here, `apps/desktop/Sources/Theme/Tokens.swift`
there, and a test that fails when they drift.
