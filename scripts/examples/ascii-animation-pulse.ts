import container from '@/node'

const ui = container.feature('ui')
const { colors } = ui

// Pulsing heartbeat / vital signs monitor
const red = colors.hex('#FF4444')
const redBright = colors.hex('#FF0000').bold
const green = colors.hex('#00FF41')
const greenDim = colors.hex('#008F11')
const cyan = colors.hex('#4ECDC4')
const yellow = colors.hex('#FFD700')
const dim = colors.dim
const labelColor = colors.hex('#888888')
const gridColor = colors.hex('#1A2A1A')

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
const height = 16

// ECG heartbeat pattern (one cycle)
const ecgPattern = [0, 0, 0, 0, 0, 0.1, 0, -0.1, 0, 0, 0, 0.8, -0.6, 0.3, 0, 0, 0, 0, 0.15, 0.2, 0.15, 0, 0, 0, 0, 0]

function getECGValue(x: number, frame: number): number {
  const scrollX = x + frame * 0.5
  const patternLen = ecgPattern.length
  const idx = ((scrollX % patternLen) + patternLen) % patternLen
  const lower = Math.floor(idx)
  const upper = (lower + 1) % patternLen
  const frac = idx - lower
  return ecgPattern[lower] * (1 - frac) + ecgPattern[upper] * frac
}

// Heart ASCII art for the pulsing display
const heartSmall = [
  ' ♥♥ ♥♥ ',
  '♥♥♥♥♥♥♥',
  ' ♥♥♥♥♥ ',
  '  ♥♥♥  ',
  '   ♥   ',
]

const heartLarge = [
  ' ♥♥♥ ♥♥♥ ',
  '♥♥♥♥♥♥♥♥♥',
  '♥♥♥♥♥♥♥♥♥',
  ' ♥♥♥♥♥♥♥ ',
  '  ♥♥♥♥♥  ',
  '   ♥♥♥   ',
  '    ♥    ',
]

// Vital stats
const vitals = {
  hr: 72,
  bp: '120/80',
  o2: 98,
  temp: 98.6,
}

async function animate() {
  const totalFrames = 240
  const frameDelay = 50
  let bpm = 72

  process.stdout.write('\x1B[?25l')
  process.stdout.write('\x1B[2J\x1B[H')

  for (let frame = 0; frame < totalFrames; frame++) {
    // Heart pulse timing
    const beatCycle = 60 / bpm // seconds per beat
    const beatFrame = (frame * frameDelay / 1000) % beatCycle
    const beatPhase = beatFrame / beatCycle
    const isPeak = beatPhase < 0.15
    const isExpanding = beatPhase < 0.08
    const heart = isPeak ? heartLarge : heartSmall

    // Slowly change BPM for drama
    if (frame > 100 && frame < 160) {
      bpm = 72 + Math.floor((frame - 100) * 0.5)
    } else if (frame >= 160) {
      bpm = Math.max(72, bpm - 0.3)
    }

    // Build ECG trace grid
    const ecgGrid: string[][] = Array.from({ length: height }, () => new Array(width).fill(' '))

    // Draw grid lines
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (y === Math.floor(height / 2)) {
          ecgGrid[y][x] = gridColor('─')
        } else if (x % 8 === 0) {
          ecgGrid[y][x] = gridColor('│')
        } else if (y % 4 === 0 && x % 4 === 0) {
          ecgGrid[y][x] = gridColor('·')
        }
      }
    }

    // Draw ECG waveform
    const midY = Math.floor(height / 2)
    const amplitude = height / 2 - 1

    for (let x = 0; x < width; x++) {
      const val = getECGValue(x, frame)
      const plotY = Math.round(midY - val * amplitude)

      if (plotY >= 0 && plotY < height) {
        // Color based on how recent (right side = newest)
        const age = (width - x) / width
        if (age < 0.1) {
          ecgGrid[plotY][x] = greenDim('█')  // leading edge dimmer
        } else if (x > width - 5) {
          ecgGrid[plotY][x] = green('█')
        } else {
          ecgGrid[plotY][x] = green('│')
        }

        // Draw vertical line from baseline for peaks
        if (Math.abs(val) > 0.3) {
          const startY = Math.min(plotY, midY)
          const endY = Math.max(plotY, midY)
          for (let fy = startY; fy <= endY; fy++) {
            if (ecgGrid[fy][x] === gridColor('─') || ecgGrid[fy][x] === ' ' || ecgGrid[fy][x] === gridColor('·')) {
              ecgGrid[fy][x] = greenDim('│')
            }
          }
        }
      }
    }

    // Render
    process.stdout.write('\x1B[H')

    const titleBar = '┌──────────────────────────────────────────────────────────┐'
    const titleMid = red('│') + colors.bold.white('   LUCA  ') + dim('Vital Signs Monitor') + red('                        │')
    const titleBot = '└──────────────────────────────────────────────────────────┘'
    process.stdout.write('\n')
    process.stdout.write(center(red(titleBar)) + '\n')
    process.stdout.write(center(titleMid, titleBar.length) + '\n')
    process.stdout.write(center(red(titleBot)) + '\n')
    process.stdout.write('\n')

    // ECG display
    for (let y = 0; y < height; y++) {
      process.stdout.write(center(ecgGrid[y].join(''), width) + '\n')
    }

    process.stdout.write('\n')

    // Vitals readout with heart
    const heartColor = isPeak ? redBright : red
    const bpmStr = `${Math.round(bpm)} BPM`
    const heartLine = heart.length > 5 ? heartLarge[2] : heartSmall[1]
    const vitalsLine = `${heartColor('♥')} ${red(bpmStr)}   ${cyan('BP')} ${dim(vitals.bp)}   ${green('O₂')} ${dim(vitals.o2 + '%')}   ${yellow('T')} ${dim(vitals.temp + '°F')}`

    process.stdout.write(center(vitalsLine, 55) + '\n')

    // Pulse bar that throbs
    const barWidth = 30
    const pulseWidth = isPeak ? barWidth : Math.floor(barWidth * 0.7)
    let bar = ''
    for (let b = 0; b < barWidth; b++) {
      if (b < pulseWidth) {
        bar += isPeak ? redBright('█') : red('█')
      } else {
        bar += dim('░')
      }
    }
    process.stdout.write(center(`${bar} ${isPeak ? redBright('♥') : dim('♡')}`, barWidth + 3) + '\n')

    const msgs = ['Calibrating sensors...', 'Reading vitals...', 'Monitoring heart rate...', 'Checking O₂ levels...', 'Analyzing rhythm...', 'Patient stable ✓']
    const progress = frame / totalFrames
    const msgIdx = Math.min(Math.floor(progress * msgs.length), msgs.length - 1)
    process.stdout.write(center(labelColor(msgs[msgIdx]), msgs[msgIdx].length) + '\n')
    process.stdout.write('\n')

    await new Promise(r => setTimeout(r, frameDelay))
  }

  await new Promise(r => setTimeout(r, 1500))
  process.stdout.write('\x1B[?25h')
}

animate().catch(console.error)
