import container from '@/node'

const ui = container.feature('ui')
const { colors } = ui

// Glitch art: corrupted data being repaired, text scrambling and unscrambling
const cyan = colors.hex('#4ECDC4')
const magenta = colors.hex('#FF00FF')
const red = colors.hex('#FF4444')
const green = colors.hex('#00FF41')
const white = colors.bold.white
const dim = colors.dim
const labelColor = colors.hex('#888888')
const glitchRed = colors.hex('#FF0040')
const glitchCyan = colors.hex('#00FFFF')
const glitchYellow = colors.hex('#FFFF00')

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
const height = 20

const glitchChars = '█▓▒░╳╱╲◼◻▪▫▬▭▮▯≡≢≣⌐¬¡¿×÷±∓∞≈'

// The target text that gets "repaired" from glitch
const targetLines = [
  '                                                        ',
  '    ╔══════════════════════════════════════════════╗     ',
  '    ║                                              ║     ',
  '    ║    ██       ██  ██  ██████   █████           ║     ',
  '    ║    ██       ██  ██  ██      ██   ██          ║     ',
  '    ║    ██       ██  ██  ██      ███████          ║     ',
  '    ║    ██       ██  ██  ██      ██   ██          ║     ',
  '    ║    ██████   ██████  ██████  ██   ██          ║     ',
  '    ║                                              ║     ',
  '    ║    LIGHTWEIGHT UNIVERSAL CONVERSATIONAL       ║     ',
  '    ║    ARCHITECTURE v2.0                          ║     ',
  '    ║                                              ║     ',
  '    ║    STATUS: ████████████████████ ONLINE        ║     ',
  '    ║    CORES:  ████████ ACTIVE                    ║     ',
  '    ║    MEMORY: ████████████████ OPTIMAL           ║     ',
  '    ║                                              ║     ',
  '    ╚══════════════════════════════════════════════╝     ',
  '                                                        ',
  '                                                        ',
  '                                                        ',
]

function randomGlitchChar(): string {
  return glitchChars[Math.floor(Math.random() * glitchChars.length)]
}

function glitchColor(): (s: string) => string {
  const r = Math.random()
  if (r < 0.25) return glitchRed
  if (r < 0.5) return glitchCyan
  if (r < 0.75) return magenta
  return glitchYellow
}

async function animate() {
  const totalFrames = 260
  const frameDelay = 40

  // Per-character corruption level (1 = fully corrupted, 0 = clean)
  const corruption: number[][] = Array.from({ length: height }, (_, y) =>
    new Array(width).fill(0).map(() => 1.0) // start fully corrupted
  )

  // Repair waves that travel across the screen
  let repairProgress = -0.2

  process.stdout.write('\x1B[?25l')
  process.stdout.write('\x1B[2J\x1B[H')

  for (let frame = 0; frame < totalFrames; frame++) {
    // Phase 1 (0-60): pure glitch chaos
    // Phase 2 (60-180): progressive repair with glitch bursts
    // Phase 3 (180-260): clean with occasional micro-glitches

    const phase1 = frame < 60
    const phase2 = frame >= 60 && frame < 200
    const phase3 = frame >= 200

    if (phase2) {
      repairProgress = (frame - 60) / 140
    } else if (phase3) {
      repairProgress = 1.0
    }

    // Update corruption levels
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (phase1) {
          // Chaotic: corruption shifts randomly
          corruption[y][x] = 0.5 + Math.random() * 0.5
        } else if (phase2) {
          // Repair wave moves left to right with some randomness
          const cellProgress = x / width
          if (cellProgress < repairProgress - 0.1) {
            // Behind the wave: mostly repaired
            corruption[y][x] = Math.max(0, corruption[y][x] - 0.08)
            // Occasional glitch bursts
            if (Math.random() < 0.005) corruption[y][x] = 0.6 + Math.random() * 0.4
          } else if (cellProgress < repairProgress + 0.05) {
            // At the wave front: active repair, flickering
            corruption[y][x] = 0.2 + Math.random() * 0.6
          } else {
            // Ahead of wave: still corrupted
            corruption[y][x] = Math.max(corruption[y][x] - 0.01, 0.4 + Math.random() * 0.4)
          }
        } else if (phase3) {
          corruption[y][x] = Math.max(0, corruption[y][x] - 0.05)
          // Rare micro-glitches
          if (Math.random() < 0.001) corruption[y][x] = 0.3
        }
      }
    }

    // Horizontal glitch offset (whole-line shifts)
    const lineOffsets: number[] = new Array(height).fill(0)
    if (phase1 || (phase2 && Math.random() < 0.15)) {
      const glitchLines = phase1 ? 5 : 2
      for (let i = 0; i < glitchLines; i++) {
        const ly = Math.floor(Math.random() * height)
        lineOffsets[ly] = Math.floor((Math.random() - 0.5) * 8)
      }
    }

    // Color channel split (RGB offset effect)
    const channelSplit = phase1 ? 2 : (phase2 ? (Math.random() < 0.1 ? 1 : 0) : 0)

    // Render
    process.stdout.write('\x1B[H')

    const titleBar = '┌──────────────────────────────────────────────────────────┐'
    const titleText = phase3 ? 'System Restored ✓' : (phase2 ? 'Repairing Data...' : 'CRITICAL: Data Corruption Detected')
    const titleColor = phase3 ? green : (phase2 ? cyan : red)
    const pad = ' '.repeat(Math.max(0, 40 - titleText.length))
    const titleMid = titleColor('│') + colors.bold.white('   LUCA  ') + titleColor(titleText) + titleColor(pad + '│')
    const titleBot = '└──────────────────────────────────────────────────────────┘'

    // Glitch the title too in phase 1
    if (phase1 && Math.random() < 0.3) {
      let glitchedTitle = ''
      for (const ch of titleBar) {
        glitchedTitle += Math.random() < 0.2 ? randomGlitchChar() : ch
      }
      process.stdout.write('\n')
      process.stdout.write(center(glitchColor()(glitchedTitle)) + '\n')
    } else {
      process.stdout.write('\n')
      process.stdout.write(center(titleColor(titleBar)) + '\n')
    }
    process.stdout.write(center(titleMid, titleBar.length) + '\n')
    process.stdout.write(center(titleColor(titleBot)) + '\n')

    for (let y = 0; y < height; y++) {
      let line = ''
      const offset = lineOffsets[y]

      for (let x = 0; x < width; x++) {
        const srcX = x - offset
        const corr = (srcX >= 0 && srcX < width) ? corruption[y][srcX] : 1.0
        const targetChar = (srcX >= 0 && srcX < width && y < targetLines.length && srcX < targetLines[y].length)
          ? targetLines[y][srcX]
          : ' '

        if (corr < 0.05) {
          // Clean
          if (targetChar === '█') {
            line += cyan(targetChar)
          } else if (targetChar === '═' || targetChar === '║' || targetChar === '╔' || targetChar === '╗' || targetChar === '╚' || targetChar === '╝') {
            line += cyan(targetChar)
          } else if (targetChar === '●' || targetChar === '✓') {
            line += green(targetChar)
          } else {
            line += dim(targetChar)
          }
        } else if (corr < 0.3) {
          // Mostly clean with slight corruption
          if (Math.random() < corr) {
            line += glitchColor()(randomGlitchChar())
          } else {
            line += dim(targetChar)
          }
        } else if (corr < 0.6) {
          // Half corrupted
          if (Math.random() < 0.5) {
            line += glitchColor()(randomGlitchChar())
          } else {
            line += magenta(targetChar === ' ' ? randomGlitchChar() : targetChar)
          }
        } else {
          // Heavily corrupted
          line += glitchColor()(randomGlitchChar())
        }
      }

      // Channel split: output same line slightly shifted in different color
      if (channelSplit > 0 && Math.random() < 0.3) {
        // Just add color noise to simulate RGB split
        let splitLine = ''
        for (let i = 0; i < Math.min(line.length, 3); i++) {
          splitLine += glitchRed(randomGlitchChar())
        }
        line = splitLine + line.slice(3)
      }

      process.stdout.write(center(line, width) + '\n')
    }

    process.stdout.write('\n')

    // Status bar
    const integrity = phase1
      ? Math.floor(Math.random() * 30)
      : phase2
        ? Math.floor(repairProgress * 100)
        : 100
    const barWidth = 30
    const filled = Math.floor((integrity / 100) * barWidth)
    let bar = ''
    for (let b = 0; b < barWidth; b++) {
      if (b < filled) {
        bar += integrity < 50 ? red('█') : (integrity < 80 ? cyan('█') : green('█'))
      } else {
        bar += dim('░')
      }
    }
    const intColor = integrity < 50 ? red : (integrity < 80 ? cyan : green)
    process.stdout.write(center(`${bar} ${intColor(integrity + '% integrity')}`, barWidth + 16) + '\n')
    process.stdout.write('\n')

    await new Promise(r => setTimeout(r, frameDelay))
  }

  await new Promise(r => setTimeout(r, 2000))
  process.stdout.write('\x1B[?25h')
}

animate().catch(console.error)
