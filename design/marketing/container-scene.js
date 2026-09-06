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
      color: '#7baeff',
      tray: '#224aa2',
      block: '#477ce5',
      left: '#172c60',
      right: '#101d41',
      items: ['express', 'websocket', 'commands', 'clients', 'state', 'events'],
    },
    {
      name: 'Embedded assistants',
      label: 'Assistants',
      color: '#b195ff',
      tray: '#583297',
      block: '#9562dc',
      left: '#38235f',
      right: '#24193f',
      items: ['assistant', 'models', 'hooks', 'conversation', 'tools', 'delegation'],
    },
    {
      name: 'Markdown brain',
      label: 'Knowledge',
      color: '#f4c773',
      tray: '#806023',
      block: '#bc8c37',
      left: '#513b18',
      right: '#332712',
      items: ['contentDb', 'Markdown', 'models', 'semantic', 'queries', 'memory'],
    },
    {
      name: 'Operational toolkit',
      label: 'Operations',
      color: '#60d9ca',
      tray: '#166c69',
      block: '#319d90',
      left: '#134641',
      right: '#0b302e',
      items: ['secureShell', 'telnyx', 'docker', 'browser', 'databases', 'processes'],
    },
    {
      name: 'Live execution',
      label: 'Execution',
      color: '#ef98c5',
      tray: '#86385f',
      block: '#be6394',
      left: '#54263e',
      right: '#351d2c',
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
    let markup = `<defs>
      <filter id="tray-shadow" x="-35%" y="-45%" width="180%" height="220%"><feDropShadow dx="0" dy="17" stdDeviation="12" flood-color="#020510" flood-opacity=".8"/></filter>
      <filter id="contact-shadow" x="-40%" y="-40%" width="200%" height="210%"><feGaussianBlur stdDeviation="3"/></filter>
      <radialGradient id="floor-light"><stop stop-color="#507ff5" stop-opacity=".22"/><stop offset="1" stop-color="#507ff5" stop-opacity="0"/></radialGradient>
      <linearGradient id="lid-material" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#6295e3"/><stop offset=".5" stop-color="#334b83"/><stop offset="1" stop-color="#253354"/></linearGradient>
      ${layers.map((layer, index) => `<linearGradient id="tray-${index}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${layer.tray}"/><stop offset="1" stop-color="${layer.right}"/></linearGradient><linearGradient id="block-${index}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${layer.block}"/><stop offset="1" stop-color="${layer.tray}"/></linearGradient>`).join('')}
    </defs>`
    const shadow = [
      projection(-158, -158, -18, origin),
      projection(158, -158, -18, origin),
      projection(158, 158, -18, origin),
      projection(-158, 158, -18, origin),
    ]
    markup += `<ellipse cx="445" cy="${origin + 38}" rx="335" ry="142" fill="url(#floor-light)"/>`
    markup += polygon(shadow, '#0b1120', '#344d76')
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
      const opacity = 0.78 + emphasis * 0.22
      markup += `<g opacity="${opacity}" data-layer="${index}"><g filter="url(#tray-shadow)">`
      markup += cuboid(-half, -half, size, size, z, 22, origin, offset, {
        top: `url(#tray-${index})`,
        left: layer.left,
        right: layer.right,
        line: layer.color,
      })
      // Inset seam defines each category as a physical compartment.
      const seam = [
        [-half + 8, -half + 8],
        [half - 8, -half + 8],
        [half - 8, half - 8],
        [-half + 8, half - 8],
      ].map(([x, y]) => projection(x, y, z + 22.1, origin, offset))
      markup += polygon(seam, 'none', layer.color, 0.45)
      const front = projection(-half + 14, half, z + 7, origin, offset)
      markup += `<text x="${front[0]}" y="${front[1]}" fill="${layer.color}" font-size="8" transform="rotate(30 ${front[0]} ${front[1]})">${layer.label}</text>`
      // Six smaller volumes live inside each tray and separate with its reveal.
      layer.items.forEach((name, itemIndex) => {
        const col = itemIndex % 2,
          row = Math.floor(itemIndex / 2)
        const x = -106 + col * (111 + spread * 4)
        const y = -109 + row * (72 + spread * 3)
        const lift = 14 + spread * 17
        markup += `<g opacity="${0.18 + opened * 0.82}">`
        const contact = [
          [x + 4, y + 6],
          [x + 102, y + 6],
          [x + 102, y + 65],
          [x + 4, y + 65],
        ].map(([a, b]) => projection(a, b, z + 22.5, origin, offset))
        markup += `<g filter="url(#contact-shadow)">${polygon(contact, '#020612', 'none', 0.65)}</g>`
        markup += cuboid(x, y, 96, 57, z + 23, lift, origin, offset, {
          top: `url(#block-${index})`,
          left: layer.left,
          right: layer.right,
          line: layer.color,
        })
        const label = projection(x + 7, y + 33, z + 24 + lift, origin, offset)
        markup += `<text class="module-label" x="${label[0]}" y="${label[1]}" fill="#f4f5ff" transform="rotate(30 ${label[0]} ${label[1]})">${name}</text></g>`
      })
      markup += '</g>'
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
          top: 'url(#lid-material)',
          left: '#26395d',
          right: '#15243e',
          line: '#8fbfff',
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
