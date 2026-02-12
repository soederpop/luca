import container from '@/node'

const ui = container.feature('ui')
const { colors } = ui

// Campfire with flickering flames
const red = colors.hex('#FF4500')
const orange = colors.hex('#FF8C00')
const yellow = colors.hex('#FFD700')
const yellowBright = colors.hex('#FFFF00')
const brown = colors.hex('#8B4513')
const brownLight = colors.hex('#A0522D')
const dim = colors.dim
const labelColor = colors.hex('#888888')
const accent = colors.hex('#4ECDC4')
const ember = colors.hex('#FF6347')

function stripAnsi(str: string): string {
  return str.replace(/\x1B\[[0-9;]*m/g, '')
}

function center(line: string, rawLength?: number): string {
  const cols = process.stdout.columns || 80
  const len = rawLength ?? stripAnsi(line).length
  const pad = Math.max(0, Math.floor((cols - len) / 2))
  return ' '.repeat(pad) + line
}

const width = 44
const height = 20

// Fire particle system
interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  char: string
}

const fireChars = ['░', '▒', '▓', '█', '▲', '◆', '*', '·', '•']

function createParticle(): Particle {
  return {
    x: width / 2 + (Math.random() - 0.5) * 8,
    y: height - 5,
    vx: (Math.random() - 0.5) * 0.6,
    vy: -(0.3 + Math.random() * 0.5),
    life: 0,
    maxLife: 8 + Math.floor(Math.random() * 12),
    char: fireChars[Math.floor(Math.random() * fireChars.length)],
  }
}

// The campfire logs (static base)
const logs = [
  '          ╲▓▓▓▓▓▓▓▓▓▓▓▓▓▓╱            ',
  '        ═══════════════════════          ',
  '      ╱▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓╲        ',
  '       ══════════════════════           ',
]

// Ember sparkles that float up
const sparkleChars = ['✦', '✧', '·', '∘', '°']

function colorForLife(ratio: number, ch: string): string {
  if (ratio < 0.2) return yellowBright(ch)
  if (ratio < 0.4) return yellow(ch)
  if (ratio < 0.6) return orange(ch)
  if (ratio < 0.8) return red(ch)
  return ember(ch)
}

async function animate() {
  const totalFrames = 200
  const frameDelay = 60

  let particles: Particle[] = []

  // Pre-populate some particles
  for (let i = 0; i < 40; i++) {
    const p = createParticle()
    p.life = Math.floor(Math.random() * p.maxLife)
    p.y -= p.life * Math.abs(p.vy)
    particles.push(p)
  }

  process.stdout.write('\x1B[?25l')
  process.stdout.write('\x1B[2J\x1B[H')

  for (let frame = 0; frame < totalFrames; frame++) {
    // Spawn new particles
    for (let i = 0; i < 3; i++) {
      particles.push(createParticle())
    }

    // Update particles
    for (const p of particles) {
      p.x += p.vx + (Math.random() - 0.5) * 0.3
      p.y += p.vy
      p.vx += (Math.random() - 0.5) * 0.1
      p.life++
    }

    // Remove dead particles
    particles = particles.filter(p => p.life < p.maxLife && p.y > 0)

    // Build the grid
    const grid: string[][] = Array.from({ length: height }, () => new Array(width).fill(' '))

    // Place particles on grid
    for (const p of particles) {
      const px = Math.round(p.x)
      const py = Math.round(p.y)
      if (px >= 0 && px < width && py >= 0 && py < height - logs.length) {
        const ratio = p.life / p.maxLife
        grid[py][px] = colorForLife(ratio, p.char)
      }
    }

    // Random sparkles/embers floating up
    if (frame % 3 === 0) {
      const sx = Math.floor(width / 2 + (Math.random() - 0.5) * 20)
      const sy = Math.floor(Math.random() * (height - 8))
      if (sx >= 0 && sx < width && sy >= 0 && sy < height) {
        grid[sy][sx] = yellow(sparkleChars[Math.floor(Math.random() * sparkleChars.length)])
      }
    }

    // Render
    process.stdout.write('\x1B[H')

    const titleBar = '┌──────────────────────────────────────────────┐'
    const titleMid = orange('│') + colors.bold.white('   LUCA  ') + dim('Campfire Mode') + orange('                    │')
    const titleBot = '└──────────────────────────────────────────────┘'
    process.stdout.write('\n')
    process.stdout.write(center(orange(titleBar)) + '\n')
    process.stdout.write(center(titleMid, titleBar.length) + '\n')
    process.stdout.write(center(orange(titleBot)) + '\n')

    // Fire area
    for (let y = 0; y < height - logs.length; y++) {
      process.stdout.write(center(grid[y].join(''), width) + '\n')
    }

    // Logs (with color variation)
    for (let i = 0; i < logs.length; i++) {
      let coloredLog = ''
      for (const ch of logs[i]) {
        if (ch === '▓') {
          coloredLog += (Math.random() > 0.7 ? brownLight : brown)(ch)
        } else if (ch === '═') {
          coloredLog += brown(ch)
        } else if (ch === '╲' || ch === '╱') {
          coloredLog += brownLight(ch)
        } else {
          coloredLog += ch
        }
      }
      process.stdout.write(center(coloredLog, width) + '\n')
    }

    process.stdout.write('\n')

    // Warmth meter instead of progress bar
    const warmth = Math.min(1, frame / (totalFrames * 0.6))
    const barWidth = 30
    const filled = Math.floor(warmth * barWidth)
    let bar = ''
    for (let b = 0; b < barWidth; b++) {
      if (b < filled) {
        const ratio = b / barWidth
        if (ratio < 0.3) bar += red('█')
        else if (ratio < 0.6) bar += orange('█')
        else bar += yellow('█')
      } else {
        bar += dim('░')
      }
    }
    const temp = Math.floor(warmth * 100)
    process.stdout.write(center(`${bar} ${dim('🔥 ' + temp + '°')}`, barWidth + 7) + '\n')

    const msgs = ['Striking flint...', 'Catching spark...', 'Feeding kindling...', 'Stoking flames...', 'Roaring fire...', 'Cozy warmth ✓']
    const msgIdx = Math.min(Math.floor((frame / totalFrames) * msgs.length), msgs.length - 1)
    process.stdout.write(center(labelColor(msgs[msgIdx]), msgs[msgIdx].length) + '\n')
    process.stdout.write('\n')

    await new Promise(r => setTimeout(r, frameDelay))
  }

  await new Promise(r => setTimeout(r, 1500))
  process.stdout.write('\x1B[?25h')
}

animate().catch(console.error)
