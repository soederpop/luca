// Draws the site's bricks as isometric SVG. The brick is an original shape:
// a block with square tabs on top, not a copy of any toy brand's round stud.
// Every visual on the site is built from brick() so they all match.

const COLORS = {
  red: '#d7301f', blue: '#1d5fc4', yellow: '#f2b705', green: '#1f8a52',
  orange: '#ee7a1a', purple: '#7a4bc4', teal: '#138a8a', pink: '#d94e8f',
  slate: '#5a6675', grey: '#b9bec3', white: '#f7f7f2', black: '#2b2b2e', plate: '#c9c2b3',
}
const INK = '#1a1815'
const COS = Math.cos(Math.PI / 6)

function hex(c) { return COLORS[c] || c }
function shade(h, f) {
  const n = parseInt(hex(h).slice(1), 16)
  const ch = (v) => Math.max(0, Math.min(255, Math.round(v * f)))
  const r = ch(n >> 16), g = ch((n >> 8) & 255), b = ch(n & 255)
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)
}
function iso(x, y, z, U) { return [(x - y) * COS * U, (x + y) * 0.5 * U - z * U] }
function poly(pts, fill, U, sw = 1.3) {
  return `<polygon points="${pts.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' ')}" fill="${fill}" stroke="${INK}" stroke-width="${sw}" stroke-linejoin="round"/>`
}

// One box with visible top, left-front and right-front faces.
function box(x, y, z, w, d, h, color, U, sw) {
  const P = (a, b, c) => iso(a, b, c, U)
  const top = [P(x, y, z + h), P(x + w, y, z + h), P(x + w, y + d, z + h), P(x, y + d, z + h)]
  const left = [P(x, y + d, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x, y + d, z + h)]
  const right = [P(x + w, y, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x + w, y, z + h)]
  return poly(left, shade(color, 0.82), U, sw) + poly(right, shade(color, 0.66), U, sw) + poly(top, hex(color), U, sw)
}

/** A brick: w x d cells, h tall, with one square tab per cell. */
export function brick({ x = 0, y = 0, z = 0, w = 2, d = 1, h = 1.1, color = 'red', tabs = true }, U = 20, sw = 1.3) {
  let s = box(x, y, z, w, d, h, color, U, sw)
  if (tabs) {
    const cells = []
    for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) cells.push([i, j])
    cells.sort((a, b) => a[0] + a[1] - (b[0] + b[1]))
    for (const [i, j] of cells) s += box(x + i + 0.25, y + j + 0.25, z + h, 0.5, 0.5, 0.22, color, U, sw * 0.9)
  }
  return s
}

function bounds(pieces, U) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const p of pieces) {
    const lift = (p.explode || 0)
    for (const zz of [p.z || 0, (p.z || 0) + (p.h ?? 1.1) + 0.3 + lift])
      for (const [a, b] of [[0, 0], [p.w, 0], [p.w, p.d], [0, p.d]]) {
        const [px, py] = iso((p.x || 0) + a, (p.y || 0) + b, zz, U)
        minX = Math.min(minX, px); maxX = Math.max(maxX, px); minY = Math.min(minY, py); maxY = Math.max(maxY, py)
      }
  }
  return { minX, minY, maxX, maxY }
}

/** Build an exploded-view scene. Pieces with `explode` float above their seat until snapped. */
export function scene(el, spec) {
  const U = spec.unit || 22
  const pieces = spec.pieces.slice().sort((a, b) => (a.z || 0) - (b.z || 0) || (a.x + a.y) - (b.x + b.y))
  const b = bounds(pieces, U)
  const padL = spec.padLeft ?? 20, padR = spec.padRight ?? 150, padT = 20, padB = spec.padBottom ?? 20
  const vb = [b.minX - padL, b.minY - padT, b.maxX - b.minX + padL + padR, b.maxY - b.minY + padT + padB]
  let body = ''
  for (const p of pieces) {
    const lift = (p.explode || 0) * U
    const h = p.h ?? 1.1
    let g = brick({ ...p, h }, U)
    if (p.label) {
      const [ax, ay] = iso(p.x + p.w, p.y, (p.z || 0) + h * 0.6, U)
      const tx = Math.max(ax + 18, b.maxX + 14)
      g += `<polyline class="lead" points="${ax.toFixed(1)},${ay.toFixed(1)} ${(ax + 10).toFixed(1)},${(ay - 8).toFixed(1)} ${tx.toFixed(1)},${(ay - 8).toFixed(1)}"/>`
      g += `<text x="${(tx + 4).toFixed(1)}" y="${(ay - 4).toFixed(1)}">${p.label}</text>`
    }
    let guide = ''
    if (lift) {
      const [cx, cy] = iso(p.x + p.w / 2, p.y + p.d / 2, (p.z || 0), U)
      guide = `<line class="drop" x1="${cx.toFixed(1)}" y1="${(cy - lift + 6).toFixed(1)}" x2="${cx.toFixed(1)}" y2="${(cy - 4).toFixed(1)}"/>` +
        `<polygon class="arrow" points="${(cx - 5).toFixed(1)},${(cy - 12).toFixed(1)} ${(cx + 5).toFixed(1)},${(cy - 12).toFixed(1)} ${cx.toFixed(1)},${(cy - 3).toFixed(1)}"/>`
    }
    body += guide + `<g class="piece" data-lift="${lift}" style="transform: translateY(${-lift}px)">${g}</g>`
  }
  body += spec.extra ? spec.extra(U) : ''
  el.innerHTML = `<svg class="scene" viewBox="${vb.map((v) => v.toFixed(0)).join(' ')}" role="img" aria-label="${spec.label || ''}">${body}</svg>`
  return el.querySelector('svg')
}

export function snap(svg, on = true) {
  svg.classList.toggle('snapped', on)
  for (const g of svg.querySelectorAll('.piece')) g.style.transform = on ? 'translateY(0px)' : `translateY(${-g.dataset.lift}px)`
}

/** A small single brick icon, sized to fit its box. */
export function icon(color, w = 2, d = 1) {
  const U = 11
  const p = { x: 0, y: 0, z: 0, w, d, h: 1.1, color }
  const b = bounds([p], U)
  return `<svg viewBox="${(b.minX - 3).toFixed(0)} ${(b.minY - 3).toFixed(0)} ${(b.maxX - b.minX + 6).toFixed(0)} ${(b.maxY - b.minY + 6).toFixed(0)}" aria-hidden="true">${brick(p, U, 1.1)}</svg>`
}

// The "dependency pile": mismatched, tilted shapes nobody chose.
function mess(el) {
  const labels = ['is-odd@0.0.3', 'left-pad', 'event-stream', 'colors@1.4.44', 'pkg-??', 'utils-v2-final', 'post-install.sh', 'node-ipc', 'ua-parser', '412 more']
  let seed = 7
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  let s = ''
  for (let i = 0; i < 26; i++) {
    const x = 30 + rnd() * 420, y = 40 + rnd() * 210, r = 14 + rnd() * 22, rot = rnd() * 360
    const kind = i % 4
    const fill = ['#b9bec3', '#a59d8e', '#c9c2b3', '#8d949b'][i % 4]
    if (kind === 0) s += `<circle cx="${x}" cy="${y}" r="${r * 0.7}" fill="${fill}" stroke="${INK}" stroke-width="1.3"/>`
    else if (kind === 1) s += `<polygon transform="rotate(${rot} ${x} ${y})" points="${x},${y - r} ${x + r},${y + r * 0.7} ${x - r},${y + r * 0.6}" fill="${fill}" stroke="${INK}" stroke-width="1.3"/>`
    else if (kind === 2) s += `<rect transform="rotate(${rot} ${x} ${y})" x="${x - r}" y="${y - r * 0.4}" width="${r * 1.9}" height="${r * 0.8}" fill="${fill}" stroke="${INK}" stroke-width="1.3" stroke-dasharray="${i % 3 ? 0 : '3 3'}"/>`
    else s += `<polygon transform="rotate(${rot} ${x} ${y})" points="${x - r},${y} ${x - r / 3},${y - r} ${x + r},${y - r / 2} ${x + r / 2},${y + r} ${x - r / 2},${y + r * 0.8}" fill="${fill}" stroke="${INK}" stroke-width="1.3"/>`
  }
  labels.forEach((t, i) => {
    const x = 20 + (i % 3) * 165 + rnd() * 20, y = 34 + Math.floor(i / 3) * 70 + rnd() * 20
    s += `<g transform="rotate(${(rnd() - 0.5) * 14} ${x} ${y})"><rect x="${x - 4}" y="${y - 14}" width="${t.length * 7.4 + 10}" height="20" fill="#fbf8f1" stroke="${INK}" stroke-width="1"/><text x="${x + 1}" y="${y}" style="font-family: var(--mono); font-size: 12px; fill: #1a1815">${t}</text></g>`
  })
  el.innerHTML = `<svg class="scene" viewBox="0 0 500 300" role="img" aria-label="A pile of mismatched packages from strangers">${s}</svg>`
}

// Three vibe-coded apps, each built from a different family of shapes, joined by untested glue.
function islands(el) {
  let seed = 11
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  const fills = ['#b9bec3', '#a59d8e', '#c9c2b3', '#8d949b']
  const shape = (kind, x, y, r, rot, fill) => {
    const st = `fill="${fill}" stroke="${INK}" stroke-width="1.3"`
    if (kind === 0) return `<circle cx="${x}" cy="${y}" r="${r * 0.7}" ${st}/>`
    if (kind === 1) return `<polygon transform="rotate(${rot} ${x} ${y})" points="${x},${y - r} ${x + r},${y + r * 0.7} ${x - r},${y + r * 0.6}" ${st}/>`
    return `<polygon transform="rotate(${rot} ${x} ${y})" points="${x - r},${y} ${x - r / 3},${y - r} ${x + r},${y - r / 2} ${x + r / 2},${y + r} ${x - r / 2},${y + r * 0.8}" ${st}/>`
  }
  const apps = [[95, 95, 'app 1'], [405, 95, 'app 2'], [250, 255, 'app 3']]
  let s = ''
  // Glue lines first so the piles sit on top of them.
  const joins = [[0, 1], [1, 2], [2, 0]]
  for (const [a, b] of joins) {
    const [x1, y1] = apps[a], [x2, y2] = apps[b]
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2
    s += `<path d="M${x1},${y1} Q${mx + (rnd() - 0.5) * 60},${my + (rnd() - 0.5) * 60} ${x2},${y2}" fill="none" stroke="${COLORS.red}" stroke-width="2" stroke-dasharray="6 5"/>`
    s += `<circle cx="${mx}" cy="${my}" r="13" fill="${COLORS.red}" stroke="${INK}" stroke-width="1.5"/><text x="${mx}" y="${my + 5}" text-anchor="middle" style="font-family: var(--display); font-size: 15px; fill: #fff">?</text>`
  }
  apps.forEach(([cx, cy, label], i) => {
    s += `<rect x="${cx - 78}" y="${cy - 58}" width="156" height="108" fill="#fbf8f1" stroke="${INK}" stroke-width="1.5" stroke-dasharray="4 4"/>`
    for (let k = 0; k < 9; k++) {
      const x = cx - 55 + rnd() * 110, y = cy - 36 + rnd() * 66, r = 10 + rnd() * 12
      s += shape(i, x, y, r, rnd() * 360, fills[k % 4])
    }
    s += `<rect x="${cx - 78}" y="${cy - 76}" width="${label.length * 8 + 14}" height="20" fill="${INK}"/><text x="${cx - 71}" y="${cy - 62}" style="font-family: var(--mono); font-size: 12px; fill: #f4efe4">${label}</text>`
  })
  s += `<text x="250" y="340" text-anchor="middle" style="font-family: var(--mono); font-size: 12px; fill: var(--muted)">? = glue code an AI wrote to make them fit</text>`
  el.innerHTML = `<svg class="scene" viewBox="0 10 500 340" role="img" aria-label="Three apps built in different ways, joined by untested glue code">${s}</svg>`
}

function wire() {
  for (const el of document.querySelectorAll('[data-islands]')) islands(el)
  for (const el of document.querySelectorAll('[data-parts]')) {
    const items = el.dataset.parts.split(',').map((s) => s.trim().split('|'))
    el.innerHTML = items.map(([name, color, w = 2, d = 1, q = 1]) => `<li>${icon(color, +w, +d)}<span class="qty">${q}x</span><span>${name}</span></li>`).join('')
  }
  for (const el of document.querySelectorAll('[data-brick]')) {
    const [color, w = 2, d = 1] = el.dataset.brick.split('|')
    el.outerHTML = icon(color, +w, +d)
  }
  for (const el of document.querySelectorAll('[data-mess]')) mess(el)
  for (const btn of document.querySelectorAll('[data-copy]')) {
    btn.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(btn.dataset.copy); btn.textContent = 'Copied' } catch { btn.textContent = 'Select and copy' }
      setTimeout(() => (btn.textContent = 'Copy'), 1600)
    })
  }
}

export const logo = `<svg viewBox="-24 -26 48 44" aria-hidden="true">${brick({ x: -1, y: -1, z: 0, w: 2, d: 2, h: 1, color: 'red' }, 12, 1.4)}</svg>`

export function boot() {
  for (const el of document.querySelectorAll('[data-logo]')) el.innerHTML = logo
  wire()
}
