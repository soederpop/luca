import container from '@/node'

const ui = container.feature('ui')
const { colors } = ui

// Circuit board traces lighting up, signals traveling along paths
const copper = colors.hex('#E87D3E')
const copperBright = colors.hex('#FFB347').bold
const copperDim = colors.hex('#8B5E3C')
const signalColor = colors.hex('#00FF41')
const signalBright = colors.hex('#00FF41').bold
const chipColor = colors.hex('#4ECDC4')
const chipDim = colors.hex('#2A7A74')
const dim = colors.dim
const labelColor = colors.hex('#888888')
const via = colors.hex('#FFD700')

function stripAnsi(str: string): string {
  return str.replace(/\x1B\[[0-9;]*m/g, '')
}

function center(line: string, rawLength?: number): string {
  const cols = process.stdout.columns || 80
  const len = rawLength ?? stripAnsi(line).length
  const pad = Math.max(0, Math.floor((cols - len) / 2))
  return ' '.repeat(pad) + line
}

const width = 56
const height = 22

// Pre-defined circuit board layout
// Characters: ─ │ ┌ ┐ └ ┘ ├ ┤ ┬ ┴ ┼ for traces
// ■ for chips/components, ● for vias/nodes, ◆ for LEDs
const board = [
  '                                                        ',
  '  ┌──────┐    ┌───────────────────┐    ┌──────┐        ',
  '  │ CORE │────┤                   ├────│ MEM  │        ',
  '  │  ■■  │    │    ┌──────────┐   │    │  ■■  │        ',
  '  └──┬───┘    │    │  ■■■■■■  │   │    └──┬───┘        ',
  '     │        │    │  LUCA    │   │       │             ',
  '     ●────────┘    │  ■■■■■■  │   └───────●             ',
  '     │             └────┬─────┘           │             ',
  '     │                  │                 │             ',
  '  ┌──┴───┐         ┌───┴───┐         ┌───┴──┐          ',
  '  │ GPU  │─────────┤  BUS  ├─────────│ NET  │          ',
  '  │  ■■  │         │  ●●●  │         │  ■■  │          ',
  '  └──┬───┘         └───┬───┘         └───┬──┘          ',
  '     │                 │                 │              ',
  '     ●─────────────────●─────────────────●              ',
  '     │                 │                 │              ',
  '  ┌──┴───┐         ┌───┴───┐         ┌───┴──┐          ',
  '  │ I/O  │         │ CACHE │         │ PWR  │          ',
  '  │  ◆◆  │         │  ■■   │         │  ◆◆  │          ',
  '  └──────┘         └───────┘         └──────┘          ',
  '                                                        ',
  '                                                        ',
]

// Define signal paths (sequences of [x, y] coordinates along traces)
const signalPaths: number[][][] = [
  // Core -> LUCA chip
  [[5, 4], [5, 5], [5, 6], [6, 6], [7, 6], [8, 6], [9, 6], [10, 6], [11, 6], [12, 6], [13, 6], [14, 6], [15, 6], [16, 6], [17, 6], [18, 6], [19, 6]],
  // LUCA -> BUS
  [[23, 7], [23, 8], [23, 9]],
  // BUS -> GPU
  [[19, 10], [18, 10], [17, 10], [16, 10], [15, 10], [14, 10], [13, 10], [12, 10], [11, 10], [10, 10], [9, 10], [8, 10]],
  // BUS -> NET
  [[27, 10], [28, 10], [29, 10], [30, 10], [31, 10], [32, 10], [33, 10], [34, 10], [35, 10], [36, 10], [37, 10], [38, 10]],
  // Bottom bus
  [[5, 14], [6, 14], [7, 14], [8, 14], [9, 14], [10, 14], [11, 14], [12, 14], [13, 14], [14, 14], [15, 14], [16, 14], [17, 14], [18, 14], [19, 14], [20, 14], [21, 14], [22, 14], [23, 14], [24, 14], [25, 14], [26, 14], [27, 14], [28, 14], [29, 14], [30, 14], [31, 14], [32, 14], [33, 14], [34, 14], [35, 14], [36, 14], [37, 14], [38, 14], [39, 14]],
]

// Track which cells are "lit up" and their brightness
const litCells: Map<string, number> = new Map()

function key(x: number, y: number): string {
  return `${x},${y}`
}

// Signal positions moving along paths
interface Signal {
  pathIdx: number
  pos: number
  speed: number
  tailLength: number
}

async function animate() {
  const totalFrames = 240
  const frameDelay = 50

  // Track active signals
  let signals: Signal[] = []
  let nextSignalFrame = 0

  // Board cells that are traces (non-space chars)
  const traceChars = new Set('─│┌┐└┘├┤┬┴┼')
  const componentChars = new Set('■●◆')

  // Progressive board reveal
  let revealedRows = 0

  process.stdout.write('\x1B[?25l')
  process.stdout.write('\x1B[2J\x1B[H')

  for (let frame = 0; frame < totalFrames; frame++) {
    // Gradually reveal the board
    if (frame < 80) {
      revealedRows = Math.min(board.length, Math.floor(frame / 3.5))
    } else {
      revealedRows = board.length
    }

    // Spawn signals periodically
    if (frame >= 40 && frame % 20 === 0 && frame < 200) {
      const pathIdx = Math.floor(Math.random() * signalPaths.length)
      signals.push({
        pathIdx,
        pos: 0,
        speed: 0.5 + Math.random() * 0.5,
        tailLength: 3 + Math.floor(Math.random() * 4),
      })
    }

    // Update signals
    for (const sig of signals) {
      sig.pos += sig.speed
    }
    signals = signals.filter(s => s.pos < signalPaths[s.pathIdx].length + s.tailLength + 5)

    // Decay lit cells
    for (const [k, v] of litCells) {
      const newVal = v - 0.04
      if (newVal <= 0) {
        litCells.delete(k)
      } else {
        litCells.set(k, newVal)
      }
    }

    // Light up cells from active signals
    for (const sig of signals) {
      const path = signalPaths[sig.pathIdx]
      const headPos = Math.floor(sig.pos)
      for (let i = 0; i < sig.tailLength; i++) {
        const idx = headPos - i
        if (idx >= 0 && idx < path.length) {
          const [px, py] = path[idx]
          const brightness = i === 0 ? 1.0 : 1.0 - (i / sig.tailLength)
          litCells.set(key(px, py), Math.max(litCells.get(key(px, py)) || 0, brightness))
        }
      }
    }

    // All traces glow in final phase
    if (frame > 200) {
      const glowProgress = (frame - 200) / 40
      for (let y = 0; y < board.length; y++) {
        for (let x = 0; x < board[y].length; x++) {
          const ch = board[y][x]
          if (ch !== ' ') {
            const current = litCells.get(key(x, y)) || 0
            litCells.set(key(x, y), Math.min(1, Math.max(current, glowProgress * 0.6)))
          }
        }
      }
    }

    // Render
    process.stdout.write('\x1B[H')

    const titleBar = '┌──────────────────────────────────────────────────────────┐'
    const titleMid = copper('│') + colors.bold.white('   LUCA  ') + dim('Circuit Board Initialization') + copper('               │')
    const titleBot = '└──────────────────────────────────────────────────────────┘'
    process.stdout.write('\n')
    process.stdout.write(center(copper(titleBar)) + '\n')
    process.stdout.write(center(titleMid, titleBar.length) + '\n')
    process.stdout.write(center(copper(titleBot)) + '\n')

    for (let y = 0; y < board.length; y++) {
      if (y >= revealedRows) {
        process.stdout.write(center(' '.repeat(width), width) + '\n')
        continue
      }

      let line = ''
      for (let x = 0; x < board[y].length; x++) {
        const ch = board[y][x]
        const lit = litCells.get(key(x, y)) || 0

        if (ch === ' ') {
          line += ' '
        } else if (ch === '■') {
          line += lit > 0.3 ? chipColor(ch) : chipDim(ch)
        } else if (ch === '●') {
          line += lit > 0.5 ? via(ch) : (lit > 0 ? copperBright(ch) : copperDim(ch))
        } else if (ch === '◆') {
          // LEDs blink
          const ledOn = lit > 0.3 || (frame % 12 < 6 && frame > 120)
          line += ledOn ? signalBright(ch) : copperDim(ch)
        } else if (traceChars.has(ch)) {
          if (lit > 0.8) {
            line += signalBright(ch)
          } else if (lit > 0.4) {
            line += signalColor(ch)
          } else if (lit > 0.1) {
            line += copperBright(ch)
          } else {
            line += copperDim(ch)
          }
        } else {
          // Text labels
          if (lit > 0.3) {
            line += chipColor(ch)
          } else {
            line += dim(ch)
          }
        }
      }
      process.stdout.write(center(line, width) + '\n')
    }

    process.stdout.write('\n')

    // Progress
    const progress = frame / totalFrames
    const barWidth = 30
    const filled = Math.floor(progress * barWidth)
    let bar = ''
    for (let b = 0; b < barWidth; b++) {
      if (b < filled) {
        bar += (b % 3 === 0) ? signalColor('█') : copper('█')
      } else {
        bar += dim('░')
      }
    }
    const pct = Math.floor(progress * 100)
    process.stdout.write(center(`${bar} ${dim(String(pct).padStart(3) + '%')}`, barWidth + 5) + '\n')

    const msgs = ['Etching traces...', 'Soldering components...', 'Testing connectivity...', 'Signal routing...', 'Power regulation...', 'Board online ✓']
    const msgIdx = Math.min(Math.floor(progress * msgs.length), msgs.length - 1)
    process.stdout.write(center(labelColor(msgs[msgIdx]), msgs[msgIdx].length) + '\n')
    process.stdout.write('\n')

    await new Promise(r => setTimeout(r, frameDelay))
  }

  await new Promise(r => setTimeout(r, 1500))
  process.stdout.write('\x1B[?25h')
}

animate().catch(console.error)
