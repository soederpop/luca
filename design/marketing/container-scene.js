/* Scroll-linked isometric architecture. No rendering library or remote assets. */
;(() => {
  const svg = document.getElementById('container-scene')
  const chapters = [...document.querySelectorAll('[data-chapter]')]
  const links = [...document.querySelectorAll('.chapter-nav a')]
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  const mobile = window.matchMedia('(max-width: 760px)')
  const layers = [
    {
      name: 'Application runtime',
      label: 'Application',
      color: '#8b9dab',
      items: ['express', 'websocket', 'commands', 'clients', 'state', 'events'],
    },
    {
      name: 'Embedded assistants',
      label: 'Assistants',
      color: '#a8b4c0',
      items: ['assistant', 'models', 'hooks', 'conversation', 'tools', 'delegation'],
    },
    {
      name: 'Markdown brain',
      label: 'Knowledge',
      color: '#b9bdaf',
      items: ['contentDb', 'Markdown', 'models', 'semantic', 'queries', 'memory'],
    },
    {
      name: 'Operational toolkit',
      label: 'Operations',
      color: '#9bb3b4',
      items: ['secureShell', 'telnyx', 'docker', 'browser', 'databases', 'processes'],
    },
    {
      name: 'Live execution',
      label: 'Execution',
      color: '#abb2cb',
      items: ['vm', 'evalCode', 'claudeCode', 'Codex', 'Hermes', 'TypeScript'],
    },
  ]
  const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value))
  const ease = (value) => {
    const t = clamp(value)
    return t * t * (3 - 2 * t)
  }
  const round = (value) => Math.round(value * 100) / 100
  let renderedProgress = -1
  let activeIndex = -1
  let pending = false
  let chapterCenters = []

  function projection(x, y, z, origin, offset = 0) {
    return [round(445 + (x - y) * 0.866 + offset), round(origin + (x + y) * 0.5 - z)]
  }
  const points = (vertices) => vertices.map((point) => point.join(',')).join(' ')
  const polygon = (vertices, fill, stroke, opacity = 1) =>
    `<polygon points="${points(vertices)}" fill="${fill}" stroke="${stroke}" stroke-width=".8" opacity="${opacity}" stroke-linejoin="round"/>`

  function cuboid(x, y, width, depth, z, height, origin, offset, colors) {
    const p = (a, b, c) => projection(a, b, c, origin, offset)
    const a = p(x, y, z + height),
      b = p(x + width, y, z + height)
    const c = p(x + width, y + depth, z + height),
      d = p(x, y + depth, z + height)
    return (
      polygon([d, c, p(x + width, y + depth, z), p(x, y + depth, z)], colors.left, colors.line) +
      polygon([b, c, p(x + width, y + depth, z), p(x + width, y, z)], colors.right, colors.line) +
      polygon([a, b, c, d], colors.top, colors.line)
    )
  }

  function draw(progress) {
    if (Math.abs(progress - renderedProgress) < 0.002) return
    renderedProgress = progress
    const stage = Math.round(progress)
    // Reduced-motion users get a fully exploded still image; only emphasis changes.
    const expansion = reduceMotion.matches ? 1 : ease(progress / 3.5)
    const origin = 506 + 123 * expansion
    const spacing = 29 + 84 * expansion
    const lidOpen = reduceMotion.matches ? 1 : ease(progress / 0.8)
    let markup = ''
    const shadow = [
      projection(-158, -158, -18, origin),
      projection(158, -158, -18, origin),
      projection(158, 158, -18, origin),
      projection(-158, 158, -18, origin),
    ]
    markup += polygon(shadow, '#101315', '#242b30')
    // Registration rails keep the exploded parts visibly part of one assembly.
    for (const [x, y] of [
      [-132, -132],
      [132, -132],
      [132, 132],
      [-132, 132],
    ]) {
      const [a, b] = [projection(x, y, 0, origin), projection(x, y, 4 * spacing + 40, origin)]
      markup += `<path d="M${a.join(' ')} L${b.join(' ')}" stroke="#50606c" stroke-width=".7" stroke-dasharray="3 7" opacity="${0.18 + expansion * 0.25}"/>`
    }
    const layerArtwork = []
    layers.forEach((layer, index) => {
      const prefixLength = markup.length
      const emphasis = reduceMotion.matches
        ? Number(index === stage)
        : Math.max(0, 1 - Math.abs(progress - index))
      const opened = reduceMotion.matches ? 1 : ease(progress - index + 0.82)
      const spread = opened * expansion
      const geometryEmphasis = reduceMotion.matches ? 0 : emphasis
      const size = 258 + geometryEmphasis * expansion * 30
      const half = size / 2
      const offset = -geometryEmphasis * expansion * 72
      const z = index * spacing
      const opacity = 0.58 + emphasis * 0.42
      markup += `<g opacity="${opacity}" data-layer="${index}">`
      markup += cuboid(-half, -half, size, size, z, 14, origin, offset, {
        top: emphasis > 0.35 ? '#2b343c' : '#222a30',
        left: '#1b2228',
        right: '#141b20',
        line: emphasis > 0.35 ? layer.color : '#586571',
      })
      // Inset seam defines each category as a physical compartment.
      const seam = [
        [-half + 8, -half + 8],
        [half - 8, -half + 8],
        [half - 8, half - 8],
        [-half + 8, half - 8],
      ].map(([x, y]) => projection(x, y, z + 14.1, origin, offset))
      markup += polygon(seam, 'none', '#45525d', 0.5)
      const front = projection(-half + 14, half, z + 7, origin, offset)
      markup += `<text x="${front[0]}" y="${front[1]}" fill="${layer.color}" font-size="8" transform="rotate(30 ${front[0]} ${front[1]})">${layer.label}</text>`
      // Six smaller volumes live inside each tray and separate with its reveal.
      layer.items.forEach((name, itemIndex) => {
        const col = itemIndex % 2,
          row = Math.floor(itemIndex / 2)
        const x = -106 + col * (111 + spread * 4)
        const y = -109 + row * (72 + spread * 3)
        const lift = 6 + spread * 12
        markup += `<g opacity="${0.18 + opened * 0.82}">`
        markup += cuboid(x, y, 96, 57, z + 15, lift, origin, offset, {
          top: emphasis > 0.35 ? '#42515d' : '#303c46',
          left: '#25313a',
          right: '#1c2730',
          line: emphasis > 0.35 ? layer.color : '#62717e',
        })
        const label = projection(x + 7, y + 33, z + 16 + lift, origin, offset)
        markup += `<text class="module-label" x="${label[0]}" y="${label[1]}" fill="${emphasis > 0.35 ? '#f0f2ef' : '#b5c0c9'}" transform="rotate(30 ${label[0]} ${label[1]})">${name}</text></g>`
      })
      if (expansion > 0.2) {
        const target = projection(-half, half, z + 14, origin, offset)
        markup += `<g opacity="${expansion}"><path d="M42 ${target[1]} H${target[0] - 13} L${target[0]} ${target[1]}" fill="none" stroke="${layer.color}" stroke-width=".7"/><circle cx="${target[0]}" cy="${target[1]}" r="2" fill="${layer.color}"/><text class="layer-label" x="42" y="${target[1] - 9}" fill="${layer.color}">${layer.label}</text></g>`
      }
      markup += '</g>'
      layerArtwork.push(markup.slice(prefixLength))
      markup = markup.slice(0, prefixLength)
    })
    // Pull the focused compartment into the foreground so its contents stay legible.
    layerArtwork.forEach((artwork, index) => {
      if (index !== stage) markup += artwork
    })
    markup += layerArtwork[stage]
    // A machined lid lifts away before the category trays separate.
    if (lidOpen < 0.995) {
      const lidZ = 4 * spacing + 51 + lidOpen * 180
      markup +=
        `<g opacity="${1 - lidOpen}">` +
        cuboid(-137, -137, 274, 274, lidZ, 15, origin, 0, {
          top: '#3b454d',
          left: '#242d34',
          right: '#1c252c',
          line: '#95a5b2',
        })
      const label = projection(-41, 10, lidZ + 16, origin)
      markup += `<text class="lid-title" x="${label[0]}" y="${label[1]}" fill="#dce4e9" transform="rotate(30 ${label[0]} ${label[1]})">luca</text></g>`
    }
    let art = svg.querySelector('#scene-art')
    if (!art) {
      art = document.createElementNS('http://www.w3.org/2000/svg', 'g')
      art.id = 'scene-art'
      svg.append(art)
    }
    art.innerHTML = markup
    if (stage !== activeIndex) {
      activeIndex = stage
      document.getElementById('scene-description').textContent =
        `${layers[stage].name}: ${layers[stage].items.join(', ')}. ` +
        'Part of one container with application, assistant, knowledge, operations, and execution layers.'
      document.getElementById('scene-category').textContent = layers[stage].name
      document.getElementById('scene-position').textContent = `0${stage + 1} / 05`
      document.getElementById('scene-features').textContent = layers[stage].items.join(' · ')
      links.forEach((link, index) => {
        if (index === stage) link.setAttribute('aria-current', 'step')
        else link.removeAttribute('aria-current')
      })
    }
  }

  function measure() {
    chapterCenters = chapters.map((chapter) => {
      const rect = chapter.getBoundingClientRect()
      return window.scrollY + rect.top + rect.height * 0.5
    })
  }
  function frame() {
    pending = false
    const viewportAnchor = window.scrollY + window.innerHeight * (mobile.matches ? 0.7 : 0.5)
    let progress = 0
    for (let index = 0; index < chapterCenters.length - 1; index++) {
      if (viewportAnchor >= chapterCenters[index]) {
        progress =
          index +
          clamp(
            (viewportAnchor - chapterCenters[index]) /
              (chapterCenters[index + 1] - chapterCenters[index]),
          )
      }
    }
    if (viewportAnchor >= chapterCenters[4]) progress = 4
    draw(clamp(progress, 0, 4))
  }
  function schedule() {
    if (!pending) {
      pending = true
      requestAnimationFrame(frame)
    }
  }
  function resize() {
    measure()
    renderedProgress = -1
    schedule()
  }
  window.addEventListener('scroll', schedule, { passive: true })
  window.addEventListener('resize', resize)
  reduceMotion.addEventListener('change', resize)
  mobile.addEventListener('change', resize)
  window.addEventListener('pageshow', resize)
  if (document.fonts) document.fonts.ready.then(resize)
  measure()
  frame()
})()
