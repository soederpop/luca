/**
 * `kit.js`: the page side of the Luca Desktop bridge, one classic script.
 *
 *   <script src="/_luca/desktop/kit.js"></script>
 *
 * It defines `window.lucaDesktop` and nothing else. In a plain browser every
 * call is safe: `available` is false, the shell promises answer null, keys
 * still work in the page. Inside Luca Desktop the app seeds
 * `window.__AL_HOST__` before the page loads and fires `al:host` with each
 * change; this script reads both and posts to the `alHost` message handler.
 * The Swift side is `apps/desktop/Sources/Tiles/Web/WebTileHost.swift`.
 *
 * Kept as a string so the compiled `luca` binary carries it. The only template
 * expression in it is the version number: the rest is served byte for byte.
 */
export const DESKTOP_KIT_VERSION = 1

export const DESKTOP_KIT_JS = `// Luca Desktop kit. The page side of the app's bridge: theme, keys, shell, open.
//
//   lucaDesktop.available        true inside Luca Desktop
//   lucaDesktop.host             { kind, width, height, focused, scheme, theme, accent, textSize, project, shell }
//   lucaDesktop.theme            scheme, get(name), names, onChange(fn)
//   lucaDesktop.keys             bind(key, label, fn) -> unbind, list(); any element with data-key takes that key
//   lucaDesktop.shell            can(name), choose(title, items), ask(title, initial), confirm(question, yes), flash(text)
//   lucaDesktop.open(uri)        open a luca:// address of this project, or a bare tool path ('console', 'doc/notes/a.md')
//   lucaDesktop.on(event, fn)    'host' | 'theme' | 'focus' | 'resize' | 'keys' -> unsubscribe
(function () {
  if (window.lucaDesktop) return
  var root = document.documentElement

  // ── The channel to the app ────────────────────────────────────────────────
  var channel = function () {
    var h = window.webkit && window.webkit.messageHandlers
    return h && h.alHost ? h.alHost : null
  }
  var post = function (msg) {
    var c = channel()
    if (!c) return false
    try { c.postMessage(msg); return true } catch (_) { return false }
  }

  var listeners = {}
  var on = function (name, fn) {
    if (typeof fn !== 'function') return function () {}
    ;(listeners[name] || (listeners[name] = [])).push(fn)
    return function () { listeners[name] = (listeners[name] || []).filter(function (f) { return f !== fn }) }
  }
  var emit = function (name, detail) {
    ;(listeners[name] || []).slice().forEach(function (fn) {
      try { fn(detail) } catch (err) { console.error('lucaDesktop.on(' + name + '): ' + (err && err.message || err)) }
    })
  }

  // ── Host values ───────────────────────────────────────────────────────────
  var host = {
    kind: 'browser',
    width: window.innerWidth,
    height: window.innerHeight,
    focused: document.hasFocus(),
    scheme: null,
    theme: 'default',
    accent: null,
    textSize: null,
    project: null,
    shell: [],
  }
  var hostSized = false

  // Values the app sends: kind, width, height, focused, scheme, theme, accent,
  // textSize, project { id, color }, shell [names], vars { --al-*: value }.
  var applyHost = function (values) {
    var changed = { themed: false, sized: false, focused: false }
    if (!values || typeof values !== 'object') return changed
    ;['kind', 'theme', 'accent', 'textSize', 'shell'].forEach(function (k) { if (k in values) host[k] = values[k] })
    if ('focused' in values && values.focused !== host.focused) { host.focused = !!values.focused; changed.focused = true }
    if ('width' in values || 'height' in values) {
      hostSized = true
      if ('width' in values) host.width = values.width
      if ('height' in values) host.height = values.height
      changed.sized = true
    }
    if (values.scheme === 'dark' || values.scheme === 'light') {
      host.scheme = values.scheme
      if (root.getAttribute('data-al-scheme') !== values.scheme) changed.themed = true
      root.setAttribute('data-al-scheme', values.scheme)
    }
    if (values.vars && typeof values.vars === 'object') {
      Object.keys(values.vars).forEach(function (name) {
        if (name.indexOf('--al-') !== 0) return
        root.style.setProperty(name, String(values.vars[name]))
        changed.themed = true
      })
    }
    if (values.project && typeof values.project === 'object') {
      host.project = { id: String(values.project.id || ''), color: values.project.color || null }
      if (host.project.color) root.style.setProperty('--al-project', String(host.project.color))
    }
    return changed
  }

  // ── Theme ─────────────────────────────────────────────────────────────────
  var camel = function (name) {
    return name.replace(/^--al-/, '').replace(/-([a-z0-9])/g, function (_, c) { return c.toUpperCase() })
  }
  // The token names: what the app sent, else what kit.css declares on :root.
  var tokenNames = function () {
    var names = {}
    var seed = window.__AL_HOST__ && window.__AL_HOST__.vars
    if (seed) Object.keys(seed).forEach(function (n) { if (n.indexOf('--al-') === 0) names[n] = true })
    var walk = function (rules) {
      for (var i = 0; i < rules.length; i++) {
        var r = rules[i]
        if (r.cssRules && !r.selectorText) walk(r.cssRules)
        else if (r.selectorText === ':root' && r.style) {
          for (var j = 0; j < r.style.length; j++) if (r.style[j].indexOf('--al-') === 0) names[r.style[j]] = true
        }
      }
    }
    for (var s = 0; s < document.styleSheets.length; s++) {
      var sheet = document.styleSheets[s]
      if (!sheet.href || !/kit\\.css(\\?|$)/.test(sheet.href)) continue
      try { walk(sheet.cssRules) } catch (_) {}
    }
    return Object.keys(names)
  }
  var darkQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null
  var currentScheme = function () {
    var forced = root.getAttribute('data-al-scheme')
    if (forced === 'dark' || forced === 'light') return forced
    if (root.classList.contains('dark')) return 'dark'
    if (root.classList.contains('light')) return 'light'
    return darkQuery && darkQuery.matches ? 'dark' : 'light'
  }

  var theme = {
    scheme: 'dark',
    names: [],
    /** A token's current value: 'accent', 'text-muted' or '--al-accent'. */
    get: function (name) {
      var prop = name.indexOf('--') === 0 ? name : '--al-' + name
      return getComputedStyle(root).getPropertyValue(prop).trim()
    },
    /** Called with the theme when the scheme or any color changes. Returns an unsubscribe. */
    onChange: function (fn) { return on('theme', fn) },
    /** Every token as { name: value }, camelCase keys. */
    values: function () {
      var out = {}
      theme.names.forEach(function (n) { out[camel(n)] = theme.get(n) })
      return out
    },
  }
  var refresh = function () {
    theme.scheme = currentScheme()
    theme.names = tokenNames()
    theme.names.forEach(function (n) { theme[camel(n)] = theme.get(n) })
  }

  // ── Keys ──────────────────────────────────────────────────────────────────
  var bindings = []
  var keyLabel = function (key) {
    return ({ ' ': 'Space', Escape: 'Esc', ArrowUp: '\\u2191', ArrowDown: '\\u2193', ArrowLeft: '\\u2190', ArrowRight: '\\u2192', Enter: '\\u21B5' })[key] || key
  }
  // 'k', 'Enter', 'ctrl+k', 'alt+shift+Enter'. A single character already
  // carries its shift ('K'), so shift only counts for named keys.
  var parseKey = function (spec) {
    var parts = String(spec).split('+')
    var key = parts.pop() || '+'
    var mods = {}
    parts.forEach(function (m) { mods[m.toLowerCase()] = true })
    return { key: key, ctrl: !!mods.ctrl, alt: !!mods.alt || !!mods.option, meta: !!mods.meta || !!mods.cmd, shift: !!mods.shift }
  }
  var matches = function (b, e) {
    if (e.key !== b.parsed.key) return false
    if (e.ctrlKey !== b.parsed.ctrl || e.altKey !== b.parsed.alt || e.metaKey !== b.parsed.meta) return false
    return b.parsed.key.length === 1 || e.shiftKey === b.parsed.shift
  }
  var editable = function (el) {
    if (!el || el === document.body) return false
    var tag = el.tagName
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
  }
  var announce = function () {
    var list = keys.list()
    emit('keys', list)
    post({ kind: 'keys', keys: list })
  }

  var keys = {
    /**
     * Bind a page key. It fires while focus is not in a text field, the app
     * routes it to the page in Normal mode and lists it in the keys view.
     * Returns a function that unbinds it.
     */
    bind: function (key, label, fn) {
      var b = { key: String(key), label: String(label || key), fn: fn, parsed: parseKey(key), el: null }
      bindings.push(b)
      announce()
      return function () {
        bindings = bindings.filter(function (x) { return x !== b })
        announce()
      }
    },
    /** Every live page key, newest first: [{ key, label }]. */
    list: function () {
      return bindings.filter(function (b) { return !b.el || b.el.isConnected }).slice().reverse().map(function (b) { return { key: b.key, label: b.label } })
    },
    /** The label the app shows for a key: 'Esc', 'Space', an arrow. */
    label: keyLabel,
  }

  document.addEventListener('keydown', function (e) {
    if (e.defaultPrevented || e.isComposing || editable(e.target)) return
    for (var i = bindings.length - 1; i >= 0; i--) {
      var b = bindings[i]
      if (b.el && !b.el.isConnected) { bindings.splice(i, 1); continue }
      if (!matches(b, e)) continue
      if (b.el && (b.el.disabled || b.el.getAttribute('aria-disabled') === 'true')) continue
      e.preventDefault()
      try { b.fn(e) } catch (err) { console.error('lucaDesktop.keys ' + b.key + ': ' + (err && err.message || err)) }
      return
    }
  })

  // Any element with data-key gets a key badge and takes that key. Fields take
  // focus; everything else is clicked.
  var VOID = { INPUT: 1, TEXTAREA: 1, SELECT: 1, IMG: 1, BR: 1, HR: 1 }
  var wire = function (el) {
    if (el.hasAttribute('data-al-key')) return
    var key = el.getAttribute('data-key')
    if (!key) return
    el.setAttribute('data-al-key', '')
    var label = el.getAttribute('data-key-label') || el.getAttribute('aria-label') || el.getAttribute('title') || el.getAttribute('placeholder') || (el.textContent || '').trim().slice(0, 40) || key
    var badge = document.createElement('span')
    badge.className = 'al-key al-key-badge'
    badge.setAttribute('aria-hidden', 'true')
    badge.textContent = keyLabel(parseKey(key).key)
    if (VOID[el.tagName]) el.insertAdjacentElement('afterend', badge)
    else el.appendChild(badge)
    var unbind = keys.bind(key, label, function () {
      if (VOID[el.tagName] && el.tagName !== 'IMG') el.focus()
      else el.click()
    })
    bindings[bindings.length - 1].el = el
    el.__alUnbindKey = function () { unbind(); badge.remove(); el.removeAttribute('data-al-key') }
  }
  var scan = function (node) {
    if (!node || node.nodeType !== 1) return
    if (node.hasAttribute('data-key')) wire(node)
    var found = node.querySelectorAll('[data-key]:not([data-al-key])')
    for (var i = 0; i < found.length; i++) wire(found[i])
  }
  var start = function () {
    scan(document.body)
    new MutationObserver(function (records) {
      records.forEach(function (r) {
        if (r.type === 'attributes') {
          if (r.target.__alUnbindKey) r.target.__alUnbindKey()
          scan(r.target)
        } else {
          r.addedNodes.forEach(scan)
        }
      })
    }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-key'] })
  }
  if (document.body) start()
  else document.addEventListener('DOMContentLoaded', start, { once: true })

  // ── Shell elements: the palette as a picker, a question, a confirm, a note ──
  // An app from before the list has the channel and no names: open and keys only.
  var shellNames = function () {
    if (!channel()) return []
    return Array.isArray(host.shell) && host.shell.length ? host.shell : ['open', 'keys']
  }
  var can = function (name) { return shellNames().indexOf(name) !== -1 }

  var waiting = {}
  var count = 0
  window.addEventListener('al:reply', function (e) {
    var d = e && e.detail
    if (!d || !waiting[d.id]) return
    var done = waiting[d.id]
    delete waiting[d.id]
    done(d.value === undefined ? null : d.value)
  })
  var request = function (kind, fields, none) {
    return new Promise(function (resolve) {
      if (!can(kind)) return resolve(none)
      var id = 'r' + (++count) + '-' + Date.now().toString(36)
      waiting[id] = resolve
      fields.kind = kind
      fields.id = id
      if (!post(fields)) { delete waiting[id]; resolve(none) }
    })
  }

  var shell = {
    /** True when the app answers this: 'choose', 'ask', 'confirm', 'flash', 'open', 'keys'. Always false in a browser. */
    can: can,
    /** The app's palette with your rows. An item is a string or { title, detail, value }. Resolves to the picked item, or null on Esc. */
    choose: function (title, items) {
      var list = (items || []).slice(0, 500)
      var rows = list.map(function (it) {
        return typeof it === 'string' ? { title: it } : { title: String(it.title == null ? '' : it.title), detail: it.detail == null ? '' : String(it.detail) }
      })
      if (!rows.length) return Promise.resolve(null)
      return request('choose', { title: String(title || ''), items: rows }, null).then(function (index) {
        return typeof index === 'number' && index >= 0 && index < list.length ? list[index] : null
      })
    },
    /** One line of text in the palette. Resolves to the text, or null. */
    ask: function (title, initial) {
      return request('ask', { title: String(title || ''), initial: initial == null ? '' : String(initial) }, null).then(function (text) {
        return typeof text === 'string' ? text : null
      })
    },
    /** Cancel first, then your yes label. Resolves to true or false. */
    confirm: function (question, yes) {
      return request('confirm', { question: String(question || ''), yes: String(yes || 'Yes') }, false).then(function (ok) { return ok === true })
    },
    /** A note in the status line. */
    flash: function (text) { return can('flash') && post({ kind: 'flash', text: String(text) }) },
  }

  /** Open a tile: a luca:// address of this project, or a bare tool path under it. False in a browser. */
  var open = function (uri) { return can('open') && post({ kind: 'open', uri: String(uri) }) }

  // ── Wire it up ────────────────────────────────────────────────────────────
  var seeded = applyHost(window.__AL_HOST__)
  if (channel()) host.kind = host.kind === 'browser' ? 'tile' : host.kind
  refresh()
  if (darkQuery && darkQuery.addEventListener) darkQuery.addEventListener('change', function () { refresh(); emit('theme', theme) })
  window.addEventListener('al:host', function (e) {
    var values = (e && e.detail) || window.__AL_HOST__
    var changed = applyHost(values)
    if (changed.themed) { refresh(); emit('theme', theme) }
    if (changed.sized) emit('resize', { width: host.width, height: host.height })
    if (changed.focused) emit('focus', host.focused)
    emit('host', host)
    try { window.dispatchEvent(new CustomEvent('luca:host', { detail: values })) } catch (_) {}
  })
  window.addEventListener('resize', function () {
    if (hostSized) return
    host.width = window.innerWidth
    host.height = window.innerHeight
    emit('resize', { width: host.width, height: host.height })
  })
  window.addEventListener('focus', function () { if (!channel()) { host.focused = true; emit('focus', true) } })
  window.addEventListener('blur', function () { if (!channel()) { host.focused = false; emit('focus', false) } })
  if (seeded.themed) root.setAttribute('data-al-kit', 'host')

  window.lucaDesktop = {
    version: ${DESKTOP_KIT_VERSION},
    get available() { return !!channel() },
    host: host,
    theme: theme,
    keys: keys,
    shell: shell,
    open: open,
    on: on,
  }
})()
`

/** The same script as an ES module: `import lucaDesktop from '/_luca/desktop/kit.mjs'`. */
export const DESKTOP_KIT_MJS = DESKTOP_KIT_JS + '\nexport default window.lucaDesktop\n'
