import container from '@/node'

const ui = container.feature('ui')
const { colors } = ui

// Radar / sonar sweep with blips
const green = colors.hex('#00FF41')
const greenDim = colors.hex('#008F11')
const greenFaint = colors.hex('#004F00')
const greenBright = colors.hex('#00FF41').bold
const amber = colors.hex('#FFB000')
const red = colors.hex('#FF4444')
const cyan = colors.hex('#4ECDC4')
const dim = colors.dim
const labelColor = colors.hex('#888888')

function stripAnsi(str: string): string {
  return str.replace(/\x1B\[[0-9;]*m/g, '')
}

function center(line: string, rawLength?: number): string {
  const cols = process.stdout.columns || 80
  const len = rawLength ?? stripAnsi(line).length
  const pad = Math.max(0, Math.floor((cols - len) / 2))
  return ' '.repeat(pad) + line
}

const width = 50
const height = 25
const cx = Math.floor(width / 2)
const cy = Math.floor(height / 2)
const maxRadius = Math.min(cx - 2, cy - 1)

interface Blip {
  angle: number  // radians
  distance: number  // 0-1 normalized
  brightness: number
  label: string
  threat: boolean
}

// Some persistent radar contacts
const contacts: Blip[] = [
  { angle: 0.7, distance: 0.4, brightness: 0, label: 'SRV-01', threat: false },
  { angle: 2.1, distance: 0.7, brightness: 0, label: 'NODE-7', threat: false },
  { angle: 3.5, distance: 0.55, brightness: 0, label: 'API-GW', threat: false },
  { angle: 4.8, distance: 0.85, brightness: 0, label: 'DB-03', threat: false },
  { angle: 1.4, distance: 0.3, brightness: 0, label: 'CACHE', threat: false },
  { angle: 5.5, distance: 0.6, brightness: 0, label: '???', threat: true },
  { angle: 0.3, distance: 0.9, brightness: 0, label: 'CDN', threat: false },
]

async function animate() {
  const totalFrames = 300
  const frameDelay = 40
  const sweepSpeed = 0.04 // radians per frame

  let sweepAngle = 0

  process.stdout.write('\x1B[?25l')
  process.stdout.write('\x1B[2J\x1B[H')

  for (let frame = 0; frame < totalFrames; frame++) {
    sweepAngle = (sweepAngle + sweepSpeed) % (Math.PI * 2)

    // Update blip brightness based on sweep proximity
    for (const blip of contacts) {
      const angleDiff = Math.abs(sweepAngle - blip.angle)
      const normalizedDiff = Math.min(angleDiff, Math.PI * 2 - angleDiff)
      if (normalizedDiff < 0.15) {
        blip.brightness = 1.0
      } else {
        blip.brightness = Math.max(0, blip.brightness - 0.015)
      }
    }

    // Build the radar grid
    const grid: string[][] = Array.from({ length: height }, () => new Array(width).fill(' '))
    const gridColor: ((s: string) => string)[][] = Array.from({ length: height }, () => new Array(width).fill(dim))

    // Draw range rings
    for (const ringRatio of [0.33, 0.66, 1.0]) {
      const r = maxRadius * ringRatio
      for (let a = 0; a < Math.PI * 2; a += 0.05) {
        const rx = Math.round(cx + r * 2 * Math.cos(a))
        const ry = Math.round(cy + r * Math.sin(a))
        if (rx >= 0 && rx < width && ry >= 0 && ry < height) {
          if (grid[ry][rx] === ' ') {
            grid[ry][rx] = '·'
            gridColor[ry][rx] = greenFaint
          }
        }
      }
    }

    // Draw crosshairs
    for (let x = cx - maxRadius * 2; x <= cx + maxRadius * 2; x++) {
      if (x >= 0 && x < width && x !== cx) {
        if (grid[cy][x] === ' ' || grid[cy][x] === '·') {
          grid[cy][x] = '─'
          gridColor[cy][x] = greenFaint
        }
      }
    }
    for (let y = cy - maxRadius; y <= cy + maxRadius; y++) {
      if (y >= 0 && y < height && y !== cy) {
        if (grid[y][cx] === ' ' || grid[y][cx] === '·') {
          grid[y][cx] = '│'
          gridColor[y][cx] = greenFaint
        }
      }
    }
    grid[cy][cx] = '┼'
    gridColor[cy][cx] = green

    // Draw sweep line (fading trail)
    for (let trailOffset = 0; trailOffset < 25; trailOffset++) {
      const trailAngle = sweepAngle - trailOffset * 0.02
      const trailBrightness = 1.0 - (trailOffset / 25)
      for (let d = 1; d <= maxRadius; d++) {
        const sx = Math.round(cx + d * 2 * Math.cos(trailAngle))
        const sy = Math.round(cy + d * Math.sin(trailAngle))
        if (sx >= 0 && sx < width && sy >= 0 && sy < height) {
          if (trailOffset === 0) {
            grid[sy][sx] = '█'
            gridColor[sy][sx] = greenBright
          } else if (trailBrightness > 0.5) {
            if (grid[sy][sx] === ' ' || grid[sy][sx] === '·' || grid[sy][sx] === '─' || grid[sy][sx] === '│') {
              grid[sy][sx] = '▓'
              gridColor[sy][sx] = green
            }
          } else if (trailBrightness > 0.2) {
            if (grid[sy][sx] === ' ' || grid[sy][sx] === '·') {
              grid[sy][sx] = '░'
              gridColor[sy][sx] = greenDim
            }
          }
        }
      }
    }

    // Draw blips
    for (const blip of contacts) {
      if (blip.brightness > 0.05) {
        const bx = Math.round(cx + blip.distance * maxRadius * 2 * Math.cos(blip.angle))
        const by = Math.round(cy + blip.distance * maxRadius * Math.sin(blip.angle))
        if (bx >= 0 && bx < width && by >= 0 && by < height) {
          if (blip.brightness > 0.6) {
            grid[by][bx] = blip.threat ? '◆' : '●'
            gridColor[by][bx] = blip.threat ? red : greenBright
            // Label
            const labelX = bx + 2
            if (labelX + blip.label.length < width && blip.brightness > 0.7) {
              for (let i = 0; i < blip.label.length; i++) {
                if (labelX + i < width) {
                  grid[by][labelX + i] = blip.label[i]
                  gridColor[by][labelX + i] = blip.threat ? amber : cyan
                }
              }
            }
          } else if (blip.brightness > 0.3) {
            grid[by][bx] = '◉'
            gridColor[by][bx] = greenDim
          } else {
            grid[by][bx] = '○'
            gridColor[by][bx] = greenFaint
          }
        }
      }
    }

    // Render
    process.stdout.write('\x1B[H')

    const titleBar = '┌────────────────────────────────────────────────────┐'
    const titleMid = green('│') + colors.bold.white('   LUCA  ') + dim('Network Radar · Sweep Mode') + green('         │')
    const titleBot = '└────────────────────────────────────────────────────┘'
    process.stdout.write('\n')
    process.stdout.write(center(green(titleBar)) + '\n')
    process.stdout.write(center(titleMid, titleBar.length) + '\n')
    process.stdout.write(center(green(titleBot)) + '\n')

    for (let y = 0; y < height; y++) {
      let line = ''
      for (let x = 0; x < width; x++) {
        line += gridColor[y][x](grid[y][x])
      }
      process.stdout.write(center(line, width) + '\n')
    }

    // Stats bar
    const threatCount = contacts.filter(b => b.threat && b.brightness > 0.3).length
    const activeCount = contacts.filter(b => b.brightness > 0.1).length
    const bearing = Math.floor((sweepAngle * 180 / Math.PI) % 360)
    const stats = `${green('●')} ${dim('Active:')} ${green(String(activeCount))}  ${red('◆')} ${dim('Threats:')} ${(threatCount > 0 ? red : dim)(String(threatCount))}  ${dim('Bearing:')} ${cyan(String(bearing) + '°')}`
    process.stdout.write('\n')
    process.stdout.write(center(stats, 50) + '\n')
    process.stdout.write('\n')

    await new Promise(r => setTimeout(r, frameDelay))
  }

  await new Promise(r => setTimeout(r, 1500))
  process.stdout.write('\x1B[?25h')
}

animate().catch(console.error)
