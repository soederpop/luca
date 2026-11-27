/**
 * `kit.css`: the Luca Desktop look for a web page, built from `tokens.ts`.
 *
 * Everything sits in one cascade layer, `al-kit`, so a page's own CSS and
 * utility classes still win. The scheme follows the system, then a `dark` or
 * `light` class on `<html>`, and last `data-al-scheme`, which the desktop
 * app sets through `kit.js`. The app also pushes its live palette as inline
 * `--al-*` variables on `<html>`, which beat every rule here: that is how a
 * named theme reaches the page.
 *
 * No element selectors and no resets: a page that uses no `al-` class looks
 * exactly as it did. `al-page` on `<body>` opts into the app's ground, text
 * color and font.
 */
import { DARK, LIGHT, paletteVars, scaleVars } from './tokens.js'

function block(selector: string, vars: Record<string, string>, indent = '  '): string {
	const lines = Object.entries(vars).map(([k, v]) => `${indent}  ${k}: ${v};`)
	return `${indent}${selector} {\n${lines.join('\n')}\n${indent}}`
}

/** The stylesheet. Pure, so it is tested. */
export function desktopKitCss(): string {
	const light = paletteVars(LIGHT)
	const dark = paletteVars(DARK)
	return `/* Luca Desktop kit. Built from luca/web/desktop/tokens.ts: edit the tokens, not this file.
   Layered, so a page's own CSS still wins. Scheme follows the system, a "dark" or
   "light" class on <html>, and last a data-al-scheme attribute set by the app. */
@layer al-kit {
${block(':root', { ...light, ...scaleVars() })}
  @media (prefers-color-scheme: dark) {
${block(':root', dark, '    ')}
  }
${block(':root.light', light)}
${block(':root.dark', dark)}
${block(':root[data-al-scheme="light"]', light)}
${block(':root[data-al-scheme="dark"]', dark)}

  /* The page as a tile: the app's ground behind it, body text and font. Opt in on <body>. */
  .al-page {
    margin: 0;
    min-height: 100vh;
    background: var(--al-ground);
    color: var(--al-text-body);
    font-family: var(--al-font-sans);
    font-size: var(--al-text-base);
    line-height: var(--al-leading-normal);
    -webkit-font-smoothing: antialiased;
  }
  .al-page-body { padding: var(--al-space-7); max-width: 980px; box-sizing: border-box; }

  /* Type roles. Prose is the UI font; code, paths and values take al-code. */
  .al-title { color: var(--al-text); font-size: var(--al-text-2xl); font-weight: 600; line-height: var(--al-leading-tight); margin: 0 0 var(--al-space-4); }
  .al-heading { color: var(--al-text); font-size: var(--al-text-md); font-weight: 600; line-height: var(--al-leading-tight); margin: 0 0 var(--al-space-3); }
  .al-body { color: var(--al-text-body); font-size: var(--al-text-sm); }
  .al-meta { color: var(--al-text-muted); font-size: var(--al-text-xs); }
  .al-faint { color: var(--al-text-faint); }
  .al-code { font-family: var(--al-font-mono); font-size: 0.95em; }
  .al-link { color: var(--al-accent); text-decoration: none; }
  .al-link:hover { text-decoration: underline; }

  .al-section { margin: 0 0 var(--al-space-8); }
  .al-section-title {
    display: flex;
    align-items: center;
    gap: var(--al-space-4);
    color: var(--al-text);
    font-size: var(--al-text-md);
    font-weight: 600;
    margin: 0 0 var(--al-space-5);
    padding-left: var(--al-space-4);
    border-left: 3px solid var(--al-section, var(--al-accent));
  }

  .al-card {
    background: var(--al-surface);
    color: var(--al-text-body);
    border: 1px solid var(--al-border);
    border-radius: var(--al-radius-lg);
    padding: var(--al-space-5) var(--al-space-6);
    font-family: var(--al-font-sans);
    font-size: var(--al-text-sm);
    line-height: var(--al-leading-normal);
    box-sizing: border-box;
  }
  .al-card-title { color: var(--al-text); font-size: var(--al-text-md); font-weight: 600; line-height: var(--al-leading-tight); margin: 0 0 var(--al-space-2); }
  .al-card-meta { color: var(--al-text-faint); font-family: var(--al-font-mono); font-size: var(--al-text-xs); }
  .al-card-tint { border-top: 3px solid var(--al-tint, var(--al-accent)); }
  .al-card.al-focus, .al-card[aria-current="true"] { border-color: var(--al-accent); }

  .al-stacks { display: flex; gap: var(--al-tile-gap); align-items: flex-start; overflow-x: auto; }
  .al-stack { display: flex; flex-direction: column; gap: var(--al-space-3); min-width: 0; flex: 1 1 0; max-width: 520px; }
  .al-stack-title {
    color: var(--al-text-muted);
    font-family: var(--al-font-mono);
    font-size: var(--al-text-xs);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 0 var(--al-space-2);
  }
  .al-stack > .al-card { padding: var(--al-space-4) var(--al-space-5); transition: border-color var(--al-motion-fast) var(--al-motion-ease); }

  .al-row {
    display: flex;
    align-items: center;
    gap: var(--al-space-4);
    min-height: 32px;
    padding: var(--al-space-2) var(--al-space-4);
    border-radius: var(--al-radius-md);
    color: var(--al-text-body);
    font-family: var(--al-font-sans);
    font-size: var(--al-text-sm);
    box-sizing: border-box;
  }
  .al-row + .al-row { border-top: 1px solid var(--al-border); }
  .al-row.al-focus, .al-row[aria-selected="true"] { background: var(--al-raised); color: var(--al-text); }
  .al-row-title { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .al-row-meta { color: var(--al-text-faint); font-family: var(--al-font-mono); font-size: var(--al-text-xs); }

  .al-chip {
    display: inline-flex;
    align-items: center;
    gap: var(--al-space-2);
    padding: 1px var(--al-space-3);
    border: 1px solid var(--al-border);
    border-radius: var(--al-radius-pill);
    background: var(--al-raised);
    color: var(--al-text-body);
    font-family: var(--al-font-mono);
    font-size: var(--al-text-xs);
    line-height: 1.4;
    white-space: nowrap;
  }
  .al-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--al-project, var(--al-idle)); flex: none; }

  .al-badge {
    --al-badge: var(--al-idle);
    display: inline-flex;
    align-items: center;
    padding: 0 var(--al-space-3);
    border-radius: var(--al-radius-sm);
    background: color-mix(in srgb, var(--al-badge) 12%, transparent);
    color: var(--al-badge);
    font-family: var(--al-font-mono);
    font-size: var(--al-text-xs);
    font-weight: 600;
    line-height: 1.4;
    text-transform: lowercase;
    white-space: nowrap;
  }
  .al-badge-good, .al-badge[data-status="done"], .al-badge[data-status="completed"], .al-badge[data-status="approved"], .al-badge[data-status="live"], .al-badge[data-status="running"] { --al-badge: var(--al-good); }
  .al-badge-info, .al-badge[data-status="starting"], .al-badge[data-status="in_progress"], .al-badge[data-status="building"], .al-badge[data-status="exploring"] { --al-badge: var(--al-info); }
  .al-badge-warn, .al-badge[data-status="blocked"], .al-badge[data-status="waiting"], .al-badge[data-status="needs-review"] { --al-badge: var(--al-warn); }
  .al-badge-bad, .al-badge[data-status="failed"], .al-badge[data-status="error"], .al-badge[data-status="rejected"] { --al-badge: var(--al-bad); }
  .al-badge-accent { --al-badge: var(--al-accent); }

  .al-key {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 18px;
    height: 18px;
    padding: 0 var(--al-space-2);
    border: 1px solid var(--al-border-strong);
    border-bottom-width: 2px;
    border-radius: var(--al-radius-sm);
    background: var(--al-inset);
    color: var(--al-text-muted);
    font-family: var(--al-font-mono);
    font-size: 11px;
    font-weight: 600;
    line-height: 1;
    box-sizing: border-box;
    vertical-align: middle;
  }
  .al-key-badge { margin-left: var(--al-space-3); pointer-events: none; }

  .al-button {
    display: inline-flex;
    align-items: center;
    gap: var(--al-space-3);
    height: 32px;
    padding: 0 var(--al-space-5);
    border: 1px solid var(--al-border-strong);
    border-radius: var(--al-radius-md);
    background: var(--al-raised);
    color: var(--al-text);
    font-family: var(--al-font-sans);
    font-size: var(--al-text-sm);
    font-weight: 500;
    cursor: pointer;
    box-sizing: border-box;
    transition: background var(--al-motion-fast) var(--al-motion-ease), border-color var(--al-motion-fast) var(--al-motion-ease);
  }
  .al-button:hover { border-color: var(--al-accent); }
  .al-button:focus-visible { outline: var(--al-focus-ring) solid var(--al-accent); outline-offset: 1px; }
  .al-button:disabled { opacity: 0.5; cursor: default; }
  .al-button-primary { background: var(--al-accent); border-color: var(--al-accent); color: var(--al-accent-on); }
  .al-button-ghost { background: transparent; }

  .al-input {
    height: 32px;
    padding: 0 var(--al-space-4);
    border: 1px solid var(--al-border-strong);
    border-radius: var(--al-radius-md);
    background: var(--al-inset);
    color: var(--al-text);
    font-family: var(--al-font-sans);
    font-size: var(--al-text-sm);
    box-sizing: border-box;
  }
  .al-input.al-textarea { height: auto; min-height: 72px; padding: var(--al-space-3) var(--al-space-4); line-height: var(--al-leading-normal); }
  .al-input::placeholder { color: var(--al-text-faint); }
  .al-input:focus { outline: var(--al-focus-ring) solid var(--al-accent); border-color: var(--al-accent); }

  .al-table { width: 100%; border-collapse: collapse; font-family: var(--al-font-sans); font-size: var(--al-text-sm); color: var(--al-text-body); }
  .al-table th {
    text-align: left;
    padding: var(--al-space-3) var(--al-space-4);
    border-bottom: 1px solid var(--al-border-strong);
    color: var(--al-text-muted);
    font-family: var(--al-font-mono);
    font-size: var(--al-text-xs);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .al-table td { padding: var(--al-space-3) var(--al-space-4); border-bottom: 1px solid var(--al-border); }
  .al-table tr.al-focus td { background: var(--al-raised); color: var(--al-text); }

  .al-meter { position: relative; height: 6px; border-radius: var(--al-radius-pill); background: var(--al-raised); overflow: hidden; }
  .al-meter-fill { height: 100%; width: calc(var(--al-value, 0) * 100%); border-radius: inherit; background: var(--al-meter, var(--al-accent)); transition: width var(--al-motion-base) var(--al-motion-ease); }

  .al-tile-header {
    display: flex;
    align-items: center;
    gap: var(--al-space-3);
    height: var(--al-tile-header);
    padding: 0 var(--al-space-4);
    border-bottom: 1px solid var(--al-border);
    background: var(--al-surface);
    color: var(--al-text-muted);
    font-family: var(--al-font-mono);
    font-size: var(--al-text-xs);
    box-sizing: border-box;
    white-space: nowrap;
  }
  .al-tile-header-title { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; color: var(--al-text); }
  .al-tile-header.al-focus { box-shadow: inset 0 0 0 var(--al-focus-ring) var(--al-accent); }

  .al-keys {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--al-space-3) var(--al-space-6);
    padding: var(--al-space-2) var(--al-space-4);
    color: var(--al-text-muted);
    font-family: var(--al-font-mono);
    font-size: var(--al-text-xs);
  }
  .al-keys-item { display: inline-flex; align-items: center; gap: var(--al-space-2); }

  /* Code colors, for a highlighter that emits these classes. */
  .al-syntax-keyword { color: var(--al-syntax-keyword); }
  .al-syntax-string { color: var(--al-syntax-string); }
  .al-syntax-number { color: var(--al-syntax-number); }
  .al-syntax-comment { color: var(--al-syntax-comment); }
  .al-syntax-property { color: var(--al-syntax-property); }
  .al-syntax-type { color: var(--al-syntax-type); }
  .al-syntax-function { color: var(--al-syntax-function); }
}
`
}
