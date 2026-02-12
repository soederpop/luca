import container from '@/node'

const ui = container.feature('ui')
const { colors } = ui

// DNA double helix spinning animation
const cyan = colors.hex('#4ECDC4')
const magenta = colors.hex('#C850C0')
const gold = colors.hex('#FFD700')
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

const basePairs = ['A-T', 'T-A', 'G-C', 'C-G']
const helixHeight = 20
const helixWidth = 40

function renderHelix(frame: number): string[] {
  const lines: string[] = []

  for (let y = 0; y < helixHeight; y++) {
    const phase = (y * 0.4 + frame * 0.15)
    const sin = Math.sin(phase)
    const cos = Math.cos(phase)

    // Two strands of the helix
    const leftX = Math.floor(helixWidth / 2 + sin * (helixWidth / 2 - 4))
    const rightX = Math.floor(helixWidth / 2 - sin * (helixWidth / 2 - 4))

    const chars: string[] = new Array(helixWidth).fill(' ')
    const rawChars: string[] = new Array(helixWidth).fill(' ')

    // Draw the connecting rungs when strands are close enough
    const minX = Math.min(leftX, rightX)
    const maxX = Math.max(leftX, rightX)
    const dist = maxX - minX

    if (dist > 2 && dist < helixWidth - 6) {
      const pair = basePairs[(y + frame) % basePairs.length]
      // Draw rungs
      for (let x = minX + 1; x < maxX; x++) {
        chars[x] = dim('─')
        rawChars[x] = '─'
      }
      // Base pair label in the middle
      const midX = Math.floor((minX + maxX) / 2) - 1
      if (midX > 0 && midX + 2 < helixWidth) {
        const pairStr = pair
        for (let i = 0; i < pairStr.length; i++) {
          chars[midX + i] = gold(pairStr[i])
          rawChars[midX + i] = pairStr[i]
        }
      }
    }

    // Draw the two backbone strands
    const leftDepth = cos > 0
    const leftChar = leftDepth ? '●' : '○'
    const rightChar = leftDepth ? '○' : '●'

    if (leftX >= 0 && leftX < helixWidth) {
      chars[leftX] = leftDepth ? cyan(leftChar) : magenta(leftChar)
      rawChars[leftX] = leftChar
    }
    if (rightX >= 0 && rightX < helixWidth) {
      chars[rightX] = leftDepth ? magenta(rightChar) : cyan(rightChar)
      rawChars[rightX] = rightChar
    }

    lines.push(chars.join(''))
  }

  return lines
}

const messages = [
  'Unwinding double helix...',
  'Reading base pairs...',
  'Transcribing sequence...',
  'Folding proteins...',
  'Splicing genes...',
  'Replicating strand...',
]

async function animate() {
  const totalFrames = 180
  const frameDelay = 50

  process.stdout.write('\x1B[?25l')
  process.stdout.write('\x1B[2J\x1B[H')

  for (let frame = 0; frame < totalFrames; frame++) {
    process.stdout.write('\x1B[H')

    const titleBar = '┌──────────────────────────────────────────┐'
    const titleMid = cyan('│') + colors.bold.white('   LUCA  ') + dim('DNA Helix Visualization') + cyan('        │')
    const titleBot = '└──────────────────────────────────────────┘'
    process.stdout.write('\n')
    process.stdout.write(center(cyan(titleBar)) + '\n')
    process.stdout.write(center(titleMid, titleBar.length) + '\n')
    process.stdout.write(center(cyan(titleBot)) + '\n')
    process.stdout.write('\n')

    const helix = renderHelix(frame)
    for (const line of helix) {
      process.stdout.write(center(line, helixWidth) + '\n')
    }

    process.stdout.write('\n')

    // Spinning progress indicator
    const spinChars = ['◜', '◠', '◝', '◞', '◡', '◟']
    const spinner = cyan(spinChars[frame % spinChars.length])
    const msgIdx = Math.floor((frame / totalFrames) * messages.length)
    const msg = messages[Math.min(msgIdx, messages.length - 1)]

    // Progress bar
    const progress = frame / totalFrames
    const barWidth = 30
    const filled = Math.floor(progress * barWidth)
    let bar = ''
    for (let b = 0; b < barWidth; b++) {
      if (b < filled) {
        bar += b % 2 === 0 ? cyan('█') : magenta('█')
      } else {
        bar += dim('░')
      }
    }
    const pct = Math.floor(progress * 100)
    process.stdout.write(center(`${bar} ${dim(String(pct).padStart(3) + '%')}`, barWidth + 5) + '\n')
    process.stdout.write(center(`${spinner} ${labelColor(msg)}`, msg.length + 3) + '\n')
    process.stdout.write('\n')

    await new Promise(r => setTimeout(r, frameDelay))
  }

  // Final frame
  process.stdout.write('\x1B[H')
  const titleBar = '┌──────────────────────────────────────────┐'
  const titleMid = cyan('│') + colors.bold.white('   LUCA  ') + gold('Sequence Complete ✓') + cyan('            │')
  const titleBot = '└──────────────────────────────────────────┘'
  process.stdout.write('\n')
  process.stdout.write(center(cyan(titleBar)) + '\n')
  process.stdout.write(center(titleMid, titleBar.length) + '\n')
  process.stdout.write(center(cyan(titleBot)) + '\n')
  process.stdout.write('\n')

  const helix = renderHelix(180)
  for (const line of helix) {
    process.stdout.write(center(line, helixWidth) + '\n')
  }

  process.stdout.write('\n')
  const bar = cyan('█'.repeat(15)) + magenta('█'.repeat(15))
  process.stdout.write(center(`${bar} ${gold('100%')}`, 35) + '\n')
  process.stdout.write(center(gold('✓ Genome mapped'), 15) + '\n')
  process.stdout.write('\n')

  await new Promise(r => setTimeout(r, 1500))
  process.stdout.write('\x1B[?25h')
}

animate().catch(console.error)
