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
  let renderedProgress = NaN
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
    const focus = clamp(progress, 0, 4)
    const stage = Math.round(focus)
    // Rigid plates seat on 24-unit locating pins above a 22-unit deck.
    // Only the joint above the current compartment opens. Upper plates move
    // together; advancing hands the opening to the next joint without overlap.
    const pitch = 46
    const origin = 640
    const release = ease((progress + 0.8) / 0.8)
    const gaps = layers.map((_, index) =>
      reduceMotion.matches ? 44 : 230 * release * ease(1 - Math.abs(focus - index)),
    )
    const elevations = layers.map(
      (_, index) => index * pitch + gaps.slice(0, index).reduce((sum, gap) => sum + gap, 0),
    )
    const lidZ = layers.length * pitch + gaps.reduce((sum, gap) => sum + gap, 0)
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
    layers.forEach((layer, index) => {
      const emphasis = Math.max(0, 1 - Math.abs(focus - index))
      const size = 258
      const half = size / 2
      const offset = 0
      const z = elevations[index]
      markup += `<g data-layer="${index}" data-z="${z}" data-size="${size}"><g filter="url(#tray-shadow)">`
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
      // Locating pins and mating collars make the seating axis explicit.
      for (const [x, y] of [
        [-119, -119],
        [119, -119],
        [-119, 119],
        [119, 119],
      ]) {
        const base = projection(x, y, z + 22, origin)
        const tip = projection(x, y, z + pitch, origin)
        markup += `<ellipse cx="${base[0]}" cy="${base[1]}" rx="6" ry="3" fill="#0c1423" stroke="${layer.color}" stroke-width="1"/>`
        markup += `<path d="M${base[0] - 2} ${base[1]} V${tip[1]} H${tip[0] + 2} V${base[1]}" fill="#8294ac" stroke="#b7c9dd" stroke-width=".65"/>`
        markup += `<ellipse cx="${tip[0]}" cy="${tip[1]}" rx="2" ry="1.2" fill="#e2ebf7"/>`
        if (gaps[index] > 2) {
          const socket = projection(x, y, z + pitch + gaps[index], origin)
          markup += `<path d="M${tip.join(' ')} L${socket.join(' ')}" stroke="${layer.color}" stroke-dasharray="2 5" stroke-width=".7" opacity=".45"/>`
        }
      }
      // Components remain bolted to their plate: fixed size, pitch, and height.
      layer.items.forEach((name, itemIndex) => {
        const col = itemIndex % 2,
          row = Math.floor(itemIndex / 2)
        const x = -106 + col * 111
        const y = -109 + row * 72
        const lift = 18
        markup += '<g>'
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
      if (release > 0.2 || reduceMotion.matches) {
        const target = projection(-half, half, z + 14, origin, offset)
        markup += `<g opacity="1"><path d="M42 ${target[1]} H${target[0] - 13} L${target[0]} ${target[1]}" fill="none" stroke="${layer.color}" stroke-width=".7"/><circle cx="${target[0]}" cy="${target[1]}" r="2" fill="${layer.color}"/><text class="layer-label" x="42" y="${target[1] - 9}" fill="${layer.color}">${layer.label}</text></g>`
      }
      markup += '</g>'
    })
    // Painter order always follows physical height. The lid is a real part,
    // remains opaque, and seats on the top layer's pins when its joint closes.
    markup +=
      `<g data-lid="true" data-z="${lidZ}" filter="url(#tray-shadow)">` +
      cuboid(-129, -129, 258, 258, lidZ, 15, origin, 0, {
        top: 'url(#lid-material)',
        left: '#26395d',
        right: '#15243e',
        line: '#8fbfff',
      })
    const label = projection(-41, 10, lidZ + 16, origin)
    markup += `<text class="lid-title" x="${label[0]}" y="${label[1]}" fill="#dce4e9" transform="rotate(30 ${label[0]} ${label[1]})">luca</text></g>`
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
    let progress = (viewportAnchor - chapterCenters[0]) / (chapterCenters[1] - chapterCenters[0])
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
    draw(clamp(progress, -1, 4))
  }
  function schedule() {
    if (!pending) {
      pending = true
      requestAnimationFrame(frame)
    }
  }
  function resize() {
    measure()
    renderedProgress = NaN
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
