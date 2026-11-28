// Shared shell for the local-inference demo suite. Every page imports the luca
// web container from here, mounts the header + download progress strip, and
// gets a live "container inspector" that mirrors feature state and events.
import container from './luca.mjs'
import { logo } from '../assets/bricks.js'

export { container }

// The same top bar as every other page on the site, so the demos feel like part of it.
export const SITE_BAR = `<div class="in">
  <a class="logo" href="../">${logo}<span>luca</span></a>
  <nav>
    <a href="../">Story</a><a href="../cli/">CLI</a><a href="../sdk/">SDK</a><a href="../desktop/">Desktop</a>
    <a href="./" aria-current="page">Browser AI</a><a href="https://github.com/soederpop/luca">GitHub</a>
  </nav></div>`
window.luca = container

const PAGES = [
  ['index.html', 'Overview'],
  ['search.html', 'Search'],
  ['chat.html', 'Chat'],
  ['transcribe.html', 'Transcribe'],
  ['vision.html', 'Vision'],
  ['voice.html', 'Voice'],
  ['bench.html', 'Benchmark'],
]

const Transformers = container.features.lookup('transformers')
export const webgpu = Transformers.webgpuAvailable

export const fmtBytes = (n) => n > 1e9 ? `${(n / 1e9).toFixed(2)} GB` : n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.round(n / 1e3)} KB`
const fmtValue = (v) => {
  if (v === undefined || v === null) return ''
  if (Array.isArray(v)) return `[${v.length}]`
  if (typeof v === 'object') return Object.keys(v).length ? `{${Object.keys(v).length}}` : '{}'
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(2)
  const s = String(v)
  return s.length > 60 ? s.slice(0, 57) + '…' : s
}

/**
 * Mount the page chrome. `features` are the feature instances this page
 * drives; the inspector shows their state live. Returns helpers for the page.
 */
export function mount({ features = [], inspectorNote } = {}) {
  const here = location.pathname.split('/').pop() || 'index.html'
  const siteBar = document.createElement('header')
  siteBar.className = 'sitebar'
  siteBar.innerHTML = SITE_BAR
  const header = document.createElement('div')
  header.className = 'top'
  header.innerHTML = `
    <div class="brand"><a href="./">Browser AI</a><span class="slash">/</span><span class="section">${(PAGES.find(([h]) => h === here) || PAGES[0])[1]}</span></div>
    <nav class="nav">${PAGES.map(([href, label]) => `<a href="${href}" ${href === here ? 'aria-current="page"' : ''}>${label}</a>`).join('')}</nav>
    <span class="badge ${webgpu ? 'ok' : 'no'}" title="${webgpu ? 'navigator.gpu is present' : 'No navigator.gpu; models run on WASM'}"><span class="dot"></span>${webgpu ? 'WebGPU' : 'WASM only'}</span>`
  const progress = document.createElement('div')
  progress.className = 'progress'
  progress.innerHTML = '<div class="fill"></div>'
  const progressLabel = document.createElement('div')
  progressLabel.className = 'progress-label'
  document.body.prepend(siteBar, header, progress, progressLabel)

  // One transformers loader is shared by every feature; its state is the download strip.
  const transformers = container.feature('transformers')
  const fill = progress.querySelector('.fill')
  const renderProgress = () => {
    const s = transformers.state.current
    const files = Object.entries(s.downloading || {})
    const loaded = files.reduce((a, [, f]) => a + f.loaded, 0)
    const total = files.reduce((a, [, f]) => a + f.total, 0)
    if (files.length === 0) {
      fill.style.width = '0'
      progressLabel.textContent = s.status === 'loading' ? 'Loading transformers.js from CDN…' : ''
      return
    }
    fill.style.width = `${s.progress}%`
    progressLabel.textContent = `Downloading ${files.length} file${files.length > 1 ? 's' : ''} · ${fmtBytes(loaded)} / ${fmtBytes(total)} (${s.progress}%) · cached by the browser after this`
  }
  transformers.state.observe(renderProgress)

  const inspect = (list) => renderInspector([transformers, ...list], inspectorNote)
  inspect(features)

  const statusEl = document.getElementById('status')
  const logEl = document.getElementById('log')
  return {
    transformers,
    inspect,
    status: (text, isError = false) => { if (statusEl) { statusEl.textContent = text; statusEl.classList.toggle('err', isError) } },
    log: (text) => { if (logEl) { logEl.textContent += text + '\n'; logEl.scrollTop = logEl.scrollHeight } },
    busy: async (fn) => {
      const buttons = [...document.querySelectorAll('main button:not([data-keep])')]
      buttons.forEach(b => b.disabled = true)
      try { return await fn() } catch (error) {
        console.error(error)
        if (statusEl) { statusEl.textContent = error.message; statusEl.classList.add('err') }
      } finally { buttons.forEach(b => b.disabled = false) }
    },
  }
}

/** Render (or re-render) the inspector for a list of feature instances. */
function renderInspector(all, note) {
  const aside = document.querySelector('aside.inspector')
  if (!aside) return
  aside.innerHTML = `<div class="panel"><h3>Container</h3><div class="features"></div>${note ? `<p class="hint" style="margin:0.8rem 0 0">${note}</p>` : ''}</div>
    <div class="panel"><h3>Events</h3><ul class="events"></ul></div>`
  const list = aside.querySelector('.features')
  const events = aside.querySelector('.events')
  for (const f of all) {
    if (f._inspected) f._inspected()
    const el = document.createElement('div')
    el.className = 'feature'
    list.appendChild(el)
    const id = f.constructor.shortcut.replace('features.', '')
    const render = () => {
      const s = f.state.current
      const rows = Object.entries(s).filter(([k]) => !['messages', 'downloading', 'voices'].includes(k))
      el.innerHTML = `<div class="name"><span>container.feature('${id}')</span><span class="pill" data-s="${s.status || ''}">${s.status || 'idle'}</span></div>
        <table>${rows.map(([k, v]) => `<tr><td>${k}</td><td class="v">${fmtValue(v)}</td></tr>`).join('')}</table>`
    }
    render()
    const unobserve = f.state.observe(render)
    const onEvent = (event, ...args) => {
      if (event === 'stateChange' || event === 'progress' || event === 'token') return
      const li = document.createElement('li')
      const arg = args[0]
      const detail = typeof arg === 'string' ? arg : arg && typeof arg === 'object' ? fmtValue(arg.text ?? arg.model ?? arg.labels?.[0]?.label ?? '') : ''
      li.innerHTML = `<b>${id}</b> ${event} ${detail ? `<span>${detail}</span>` : ''}`
      events.prepend(li)
      while (events.children.length > 10) events.lastChild.remove()
    }
    f.on('*', onEvent)
    f._inspected = () => { unobserve(); f.off?.('*', onEvent) }
  }
}
