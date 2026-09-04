---
title: Terminal Canvas Showcase
tags:
  - ui
  - canvas
  - braille
  - animation
  - gradients
lastTested: '2026-09-04'
lastTestPassed: true
---

# Terminal Canvas Showcase

A tour of every visual tier the `ui` feature offers, from figlet banners up to
truecolor pixel rendering and in-place animation. Run it with:

```sh
luca run docs/examples/terminal-canvas-showcase.md
```

Colors rely on chalk's TTY detection — in a pipe or CI the shapes render as
bare characters. Set `FORCE_COLOR=3` to keep truecolor through a pipe.

## Tier 1 — the classics: figlet + gradient banner

The low-fi tier: pre-drawn glyph fonts with a color cycle painted over.

```ts
ui = container.feature('ui')

console.log(ui.banner('LUCA', { font: 'Big', colors: ['cyan', 'blue', 'magenta'] }))
console.log(ui.colors.dim('  tier 1: figlet + applyGradient\n'))
```

## Tier 2 — half-block canvas: a real framebuffer

`ui.canvas(width, height)` is an RGB pixel buffer. `render('half')` packs two
vertical pixels into every terminal cell using `▀` with a 24-bit foreground
(top pixel) and background (bottom pixel) — full color at double the vertical
resolution of plain characters.

```ts
// A sunset scene: gradient sky, sun, horizon line
sky = ui.canvas(64, 24)
sky.fillGradient('#0f0c29', '#f77f00', 'vertical')
sky.circle(48, 16, 6, '#ffd166', { fill: true })
for (let x = 0; x < 64; x++) sky.set(x, 21, '#1a1a2e')
sky.rect(0, 22, 64, 2, '#16213e', { fill: true })
console.log(sky.render('half'))
console.log(ui.colors.dim('  tier 2: half-block canvas — 2 truecolor pixels per cell\n'))
```

Smooth truecolor gradients come from `ui.lerpColor` — blend any two colors at
any position instead of cycling through a fixed palette:

```ts
bars = ui.canvas(64, 8)
for (let x = 0; x < 64; x++) {
  const c = ui.lerpColor('#4ecdc4', '#e94560', x / 63)
  const h = Math.round(4 + Math.sin(x / 4) * 3)
  bars.rect(x, 8 - h, 1, h, c, { fill: true })
}
console.log(bars.render('half'))
console.log(ui.colors.dim('  tier 2b: lerpColor — smooth blends, not palette cycling\n'))
```

## Tier 3 — braille canvas: 4x the dot density

`render('braille')` packs 2x4 pixels into each cell (`⠁`–`⣿`). One color per
cell (set pixels are averaged), but the resolution makes it the right mode for
line art, waveforms, and plots.

```ts
plot = ui.canvas(128, 32)
for (let x = 0; x < 128; x++) {
  plot.set(x, Math.round(16 + Math.sin(x / 9) * 13), '#4ecdc4')          // slow wave
  plot.set(x, Math.round(16 + Math.sin(x / 3.5) * 7), '#ffd166')         // fast wave
}
plot.line(0, 16, 127, 16, '#533568')                                     // axis
console.log(plot.render('braille'))
console.log(ui.colors.dim('  tier 3: braille — 2x4 dots per cell, built for plots\n'))
```

## Tier 4 — animation: redraw in place

`ui.animate(renderFrame, { fps, frames })` overwrites the previous frame with
cursor movement — no scrollback spam, cursor hidden while running. Give it
`frames` for a finite, awaitable run; omit it and call `stop()` yourself.
Without a TTY it renders one frame and resolves immediately, so this document
stays fast under `luca test-examples`.

```ts
// A gradient sweep across the banner — the offset param IS the animation
art = ui.asciiArt('CANVAS', 'Small')
sweep = ui.animate(
  (frame) => ui.applyGradient(art, ['cyan', 'blue', 'magenta'], 'horizontal', frame),
  { fps: 24, frames: 36 }
)
await sweep.done
```

```ts
// A canvas scene per frame: bouncing ball over a live-shifting gradient
bounce = ui.animate((frame) => {
  const c = ui.canvas(64, 16)
  const t = frame / 30
  c.fillGradient(ui.lerpColor('#0f0c29', '#16213e', Math.sin(t)), '#302b63', 'diagonal')
  const x = 8 + Math.round((Math.sin(t * 2) + 1) * 24)
  const y = 3 + Math.round(Math.abs(Math.sin(t * 3)) * 9)
  c.circle(x, y, 3, '#e94560', { fill: true })
  c.rect(0, 14, 64, 2, '#533568', { fill: true })
  return c.render('half')
}, { fps: 30, frames: 60 })
await bounce.done

console.log(ui.colors.dim('  tier 4: ui.animate — in-place redraw, TTY-aware\n'))
console.log(ui.colors.green('✓ showcase complete'))
```

## Takeaways

- **Pick the mode by content**: half-block for filled color areas, braille for
  lines and plots, figlet when you want lettering without drawing pixels.
- **Canvas dimensions are pixels, not cells** — a 64x24 half-block canvas
  occupies 64 columns x 12 rows; a 128x32 braille canvas occupies 64 x 8.
- **Animate by parameter, not by re-layout**: the sweep animates a single
  `offset` integer; the ball animates two coordinates. Keep the frame's line
  count constant.
