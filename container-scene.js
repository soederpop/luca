/* Scroll-linked isometric architecture. No rendering library or remote assets. */
;(() => {
  const svg = document.getElementById('container-scene')
  const chapters = [...document.querySelectorAll('[data-chapter]')]
  const links = [...document.querySelectorAll('.chapter-nav a')]
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  const mobile = window.matchMedia('(max-width: 760px)')
  // One tray per registry surface. Items are real helper ids (or a category
  // with one name), taken from `luca describe features|clients|servers`.
  const layers = [
    {
      name: 'The application',
      label: 'Application',
      color: '#7baeff',
      tray: '#224aa2',
      block: '#477ce5',
      left: '#172c60',
      right: '#101d41',
      items: ['express', 'websocket', 'static site', 'endpoints', 'commands', 'state', 'events', 'ipcSocket'],
    },
    {
      name: 'The features it uses',
      label: 'Features',
      color: '#f4c773',
      tray: '#806023',
      block: '#bc8c37',
      left: '#513b18',
      right: '#332712',
      items: ['postgres', 'contentDb', 'sqlite', 'scheduler', 'secureShell', 'git', 'docker', 'fs'],
    },
    {
      name: 'The assistants wired in',
      label: 'Assistants',
      color: '#b195ff',
      tray: '#583297',
      block: '#9562dc',
      left: '#38235f',
      right: '#24193f',
      items: ['ops', 'support', 'coder', 'CORE.md', 'tools.ts', 'hooks.ts', 'memory', 'skillsLibrary'],
    },
    {
      name: 'The doors that reach them',
      label: 'Access',
      color: '#8fdc95',
      tray: '#2c7a44',
      block: '#4aa964',
      left: '#1d4d2e',
      right: '#133320',
      items: ['/admin endpoints', 'phone', 'SMS', 'telegram', 'mcp', 'websocket', 'ipc', 'rest'],
    },
    {
      name: 'Self-repair',
      label: 'Repair',
      color: '#ef98c5',
      tray: '#86385f',
      block: '#be6394',
      left: '#54263e',
      right: '#351d2c',
      items: ['vm', 'evalCode', 'processManager', 'claudeCode', 'codex', 'assistantsManager', 'testAssistant', 'rollback'],
    },
    {
      name: 'The shipped binary',
      label: 'Binary',
      color: '#8fd4ff',
      tray: '#1f6a92',
      block: '#3d9bd0',
      left: '#164459',
      right: '#0e2e3d',
      items: ['luca bundle', 'darwin-arm64', 'linux-x64', 'no install', 'your commands', 'your assistants', 'describe', 'bun runtime'],
    },
  ]
  const last = layers.length - 1
  const pad = (n) => String(n).padStart(2, '0')
  const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value))
  const ease = (value) => {
    const t = clamp(value)
    return t * t * (3 - 2 * t)
  }
  const round = (value) => Math.round(value * 100) / 100
  let renderedProgress = NaN
  let activeIndex = -1
  let pending = false
  let needsMeasure = false
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

  const pitch = 44
  const origin = 670
  let parts = []
  let lid
  let labels = []

  // Build geometry once. Scroll only translates existing rigid parts.
  function buildScene() {
    const lidZ = 0
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
    // Chapters descend from Application to Execution. Paint from the execution
    // foundation upward so the physical stack keeps its depth as joints open.
    layers
      .map((layer, index) => ({ layer, index }))
      .reverse()
      .forEach(({ layer, index }) => {
        const size = 258
        const half = size / 2
        const offset = 0
        const z = 0
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
          markup += `<path data-guide d="M${tip.join(' ')} v0" stroke="${layer.color}" stroke-dasharray="2 5" stroke-width=".7" opacity=".45"/>`
        }
        // Components remain bolted to their plate: fixed size, pitch, and height.
        const rows = Math.ceil(layer.items.length / 2)
        const rowPitch = rows > 3 ? 54 : 72
        const depth = rowPitch - 15
        const y0 = -(rows * rowPitch - 15) / 2
        layer.items.forEach((name, itemIndex) => {
          const col = itemIndex % 2,
            row = Math.floor(itemIndex / 2)
          const x = -106 + col * 111
          const y = y0 + row * rowPitch
          const lift = 18
          markup += '<g>'
          const contact = [
            [x + 4, y + 6],
            [x + 102, y + 6],
            [x + 102, y + depth + 8],
            [x + 4, y + depth + 8],
          ].map(([a, b]) => projection(a, b, z + 22.5, origin, offset))
          markup += `<g filter="url(#contact-shadow)">${polygon(contact, '#020612', 'none', 0.65)}</g>`
          markup += cuboid(x, y, 96, depth, z + 23, lift, origin, offset, {
            top: `url(#block-${index})`,
            left: layer.left,
            right: layer.right,
            line: layer.color,
          })
          const label = projection(x + 7, y + depth / 2 + 4, z + 24 + lift, origin, offset)
          markup += `<text class="module-label" x="${label[0]}" y="${label[1]}" fill="#f4f5ff" transform="rotate(30 ${label[0]} ${label[1]})">${name}</text></g>`
        })
        markup += '</g>'
        {
          const target = projection(-half, half, z + 14, origin, offset)
          markup += `<g data-layer-label><path d="M42 ${target[1]} H${target[0] - 13} L${target[0]} ${target[1]}" fill="none" stroke="${layer.color}" stroke-width=".7"/><circle cx="${target[0]}" cy="${target[1]}" r="2" fill="${layer.color}"/><text class="layer-label" x="42" y="${target[1] - 9}" fill="${layer.color}">${layer.label}</text></g>`
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
    parts = layers.map((_, index) => {
      const node = art.querySelector(`[data-layer="${index}"]`)
      const guides = [...node.querySelectorAll('[data-guide]')].map((guide) => ({
        node: guide,
        start: guide.getAttribute('d').split(' v')[0],
      }))
      return { node, guides, z: NaN, gap: NaN }
    })
    lid = art.querySelector('[data-lid]')
    labels = [...art.querySelectorAll('[data-layer-label]')]
  }

  function draw(progress) {
    if (Math.abs(progress - renderedProgress) < 0.002) return
    renderedProgress = progress
    const focus = clamp(progress, 0, last)
    const stage = Math.round(focus)
    const release = ease((progress + 0.8) / 0.8)
    const gaps = layers.map((_, index) =>
      reduceMotion.matches ? 40 : 210 * release * ease(1 - Math.abs(focus - index)),
    )
    let elevation = 0
    for (let index = last; index >= 0; index--) {
      const part = parts[index]
      const z = round(elevation)
      const gap = round(gaps[index])
      if (z !== part.z) {
        part.node.setAttribute('transform', `translate(0 ${-z})`)
        part.node.setAttribute('data-z', z)
        part.z = z
      }
      if (gap !== part.gap) {
        part.guides.forEach((guide) => {
          // Preserve the pin endpoint while extending toward the mating tray.
          guide.node.setAttribute('d', `${guide.start} v${-gap}`)
        })
        part.gap = gap
      }
      elevation += pitch + gaps[index]
    }
    const lidZ = round(elevation)
    if (lid.getAttribute('data-z') !== String(lidZ)) {
      lid.setAttribute('transform', `translate(0 ${-lidZ})`)
      lid.setAttribute('data-z', lidZ)
    }
    const visible = release > 0.2 || reduceMotion.matches ? 'visible' : 'hidden'
    if (labels[0]?.getAttribute('visibility') !== visible) {
      labels.forEach((label) => label.setAttribute('visibility', visible))
    }
    if (stage !== activeIndex) {
      activeIndex = stage
      document.getElementById('scene-description').textContent =
        `${layers[stage].name}: ${layers[stage].items.join(', ')}. ` +
        `One container with ${layers.length} layers: ${layers.map((layer) => layer.label.toLowerCase()).join(', ')}.`
      document.getElementById('scene-category').textContent = layers[stage].name
      document.getElementById('scene-position').textContent =
        `${pad(stage + 1)} / ${pad(layers.length)}`
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
    if (needsMeasure) {
      measure()
      needsMeasure = false
    }
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
    if (viewportAnchor >= chapterCenters[last]) progress = last
    draw(clamp(progress, -1, last))
  }
  function schedule() {
    if (!pending) {
      pending = true
      requestAnimationFrame(frame)
    }
  }
  function resize() {
    // Mobile browser chrome can emit bursts of resize events during a swipe.
    needsMeasure = true
    renderedProgress = NaN
    schedule()
  }
  window.addEventListener('scroll', schedule, { passive: true })
  window.addEventListener('resize', resize)
  reduceMotion.addEventListener('change', resize)
  mobile.addEventListener('change', resize)
  window.addEventListener('pageshow', resize)
  if (document.fonts) document.fonts.ready.then(resize)
  buildScene()
  measure()
  frame()
})()
