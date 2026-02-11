import container from '@/node'

const ui = container.feature('ui')
const { colors } = ui

// Tree growing from seed to full bloom
const trunk = colors.hex('#8B4513')
const trunkLight = colors.hex('#A0522D')
const leaf = colors.hex('#228B22')
const leafLight = colors.hex('#32CD32')
const leafDark = colors.hex('#006400')
const flower = colors.hex('#FF69B4')
const flowerGold = colors.hex('#FFD700')
const ground = colors.hex('#654321')
const grass = colors.hex('#228B22')
const accent = colors.hex('#4ECDC4')
const dim = colors.dim
const labelColor = colors.hex('#888888')
const sky = colors.hex('#87CEEB')

function stripAnsi(str: string): string {
  return str.replace(/\x1B\[[0-9;]*m/g, '')
}

function center(line: string, rawLength?: number): string {
  const cols = process.stdout.columns || 80
  const len = rawLength ?? stripAnsi(line).length
  const pad = Math.max(0, Math.floor((cols - len) / 2))
  return ' '.repeat(pad) + line
}

// Tree stages from seed to full tree with flowers
const stages = [
  // Stage 0: bare ground with seed
  [
    "                                        ",
    "                                        ",
    "                                        ",
    "                                        ",
    "                                        ",
    "                                        ",
    "                                        ",
    "                                        ",
    "                                        ",
    "                                        ",
    "                                        ",
    "                                        ",
    "                                        ",
    "                                        ",
    "                    ·                    ",
    "  ▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁  ",
    "  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  ",
  ],
  // Stage 1: sprout
  [
    "                                        ",
    "                                        ",
    "                                        ",
    "                                        ",
    "                                        ",
    "                                        ",
    "                                        ",
    "                                        ",
    "                                        ",
    "                                        ",
    "                                        ",
    "                                        ",
    "                    ╿                    ",
    "                   ╱ ╲                   ",
    "                    │                    ",
    "  ▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁  ",
    "  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  ",
  ],
  // Stage 2: sapling
  [
    "                                        ",
    "                                        ",
    "                                        ",
    "                                        ",
    "                                        ",
    "                                        ",
    "                                        ",
    "                                        ",
    "                                        ",
    "                   ⌠♠⌡                  ",
    "                  ⌠♠♠♠⌡                 ",
    "                    ║                    ",
    "                    ║                    ",
    "                    ║                    ",
    "                    │                    ",
    "  ▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁  ",
    "  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  ",
  ],
  // Stage 3: young tree
  [
    "                                        ",
    "                                        ",
    "                                        ",
    "                                        ",
    "                                        ",
    "                                        ",
    "                  ♣♠♣♠♣                  ",
    "                ♠♣♠♣♠♣♠♣                 ",
    "                 ♣♠♣♠♣♠♣                 ",
    "                  ♠♣♠♣♠                  ",
    "               ╱    ║    ╲              ",
    "                    ║                    ",
    "                    ║                    ",
    "                    ║                    ",
    "                    │                    ",
    "  ▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁  ",
    "  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  ",
  ],
  // Stage 4: medium tree
  [
    "                                        ",
    "                                        ",
    "                                        ",
    "               ♣♠♣♠♣♠♣♠♣                ",
    "             ♠♣♠♣♠♣♠♣♠♣♠♣♠              ",
    "            ♣♠♣♠♣♠♣♠♣♠♣♠♣♠♣             ",
    "             ♠♣♠♣♠♣♠♣♠♣♠♣♠              ",
    "              ♣♠♣♠♣♠♣♠♣♠♣               ",
    "               ♠♣♠♣♠♣♠♣♠                ",
    "                 ♣♠♣♠♣                   ",
    "            ╱      ║      ╲             ",
    "                   ║║                    ",
    "                   ║║                    ",
    "                   ║║                    ",
    "                    │                    ",
    "  ▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁  ",
    "  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  ",
  ],
  // Stage 5: full tree with branches
  [
    "                                        ",
    "                ♣♠♣♠♣♠♣                  ",
    "           ♠♣♠♣♠♣♠♣♠♣♠♣♠♣♠♣             ",
    "          ♣♠♣♠♣♠♣♠♣♠♣♠♣♠♣♠♣♠            ",
    "         ♠♣♠♣♠♣♠♣♠♣♠♣♠♣♠♣♠♣♠♣           ",
    "          ♣♠♣♠♣♠♣♠♣♠♣♠♣♠♣♠♣♠            ",
    "           ♠♣♠♣♠♣♠♣♠♣♠♣♠♣♠♣             ",
    "        ♣♠♣  ♠♣♠♣♠♣♠♣♠♣  ♣♠♣            ",
    "       ♠♣♠♣    ♣♠♣♠♣♠♣   ♠♣♠♣           ",
    "        ♣♠♣      ║║      ♣♠♣            ",
    "                 ║║║                     ",
    "                 ║║║                     ",
    "                 ║║║                     ",
    "                 ║║║                     ",
    "                  │                      ",
    "  ▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁  ",
    "  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  ",
  ],
  // Stage 6: full tree with flowers!
  [
    "                  ✿                      ",
    "              ✿ ♣♠♣♠♣♠♣ ❀               ",
    "           ♠♣♠♣♠♣♠♣♠♣♠♣♠♣♠♣             ",
    "        ❀ ♣♠♣♠♣✿♠♣♠♣♠♣✿♣♠♣♠ ✿          ",
    "         ♠♣♠♣♠♣♠♣♠♣♠♣♠♣♠♣♠♣♠♣           ",
    "        ✿ ♣♠♣♠♣♠♣♠♣♠♣♠♣♠♣♠♣♠ ❀         ",
    "           ♠♣♠♣♠♣♠♣♠♣♠♣♠♣♠♣             ",
    "      ❀ ♣♠♣  ♠♣♠♣♠♣♠♣♠♣  ♣♠♣ ✿         ",
    "       ♠♣♠♣    ♣♠♣♠♣♠♣   ♠♣♠♣           ",
    "        ♣♠♣      ║║      ♣♠♣            ",
    "                 ║║║                     ",
    "                 ║║║                     ",
    "                 ║║║                     ",
    "                 ║║║                     ",
    "                  │                      ",
    "  ▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁  ",
    "  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  ",
  ],
]

const statusMessages = [
  'Planting seed...',
  'Sprouting...',
  'Growing sapling...',
  'Branching out...',
  'Reaching skyward...',
  'Maturing canopy...',
  'Blooming flowers!',
]

function colorTreeLine(line: string, stageIdx: number): string {
  let result = ''
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '♠' || ch === '♣') {
      result += (i + stageIdx) % 3 === 0 ? leafLight(ch) : ((i + stageIdx) % 3 === 1 ? leaf(ch) : leafDark(ch))
    } else if (ch === '✿') {
      result += flower(ch)
    } else if (ch === '❀') {
      result += flowerGold(ch)
    } else if (ch === '║' || ch === '│') {
      result += (i % 2 === 0 ? trunk : trunkLight)(ch)
    } else if (ch === '╱' || ch === '╲' || ch === '╿') {
      result += leaf(ch)
    } else if (ch === '▁') {
      result += ground(ch)
    } else if (ch === '░') {
      result += ground(ch)
    } else if (ch === '·') {
      result += trunk(ch)
    } else {
      result += ch
    }
  }
  return result
}

async function animate() {
  const frameDelay = 100
  const stageHold = 12
  const artWidth = 40

  process.stdout.write('\x1B[?25l')
  process.stdout.write('\x1B[2J\x1B[H')

  for (let s = 0; s < stages.length; s++) {
    const stage = stages[s]
    const status = statusMessages[s]

    // Grow-in animation: reveal lines from bottom to top
    for (let reveal = stage.length; reveal >= 0; reveal--) {
      process.stdout.write('\x1B[H')

      const titleBar = '┌──────────────────────────────────────────┐'
      const titleMid = leaf('│') + colors.bold.white('   LUCA  ') + dim('Growing...') + leaf('                     │')
      const titleBot = '└──────────────────────────────────────────┘'
      process.stdout.write('\n')
      process.stdout.write(center(leaf(titleBar)) + '\n')
      process.stdout.write(center(titleMid, titleBar.length) + '\n')
      process.stdout.write(center(leaf(titleBot)) + '\n')
      process.stdout.write('\n')

      for (let l = 0; l < stage.length; l++) {
        if (l < reveal) {
          // Show previous stage or blank
          const prev = s > 0 ? stages[s - 1] : stages[0]
          process.stdout.write(center(colorTreeLine(prev[l] || ' '.repeat(artWidth), s), artWidth) + '\n')
        } else {
          process.stdout.write(center(colorTreeLine(stage[l], s), artWidth) + '\n')
        }
      }

      process.stdout.write('\n')

      const progress = (s + (1 - reveal / stage.length)) / stages.length
      const barWidth = 30
      const filled = Math.floor(progress * barWidth)
      let bar = ''
      for (let b = 0; b < barWidth; b++) {
        if (b < filled) {
          const ratio = b / barWidth
          if (ratio < 0.3) bar += ground('█')
          else if (ratio < 0.7) bar += leaf('█')
          else bar += flower('█')
        } else {
          bar += dim('░')
        }
      }
      const pct = Math.floor(progress * 100)
      process.stdout.write(center(`${bar} ${dim(String(pct).padStart(3) + '%')}`, barWidth + 5) + '\n')
      process.stdout.write(center(labelColor(status), status.length) + '\n')
      process.stdout.write('\n')

      await new Promise(r => setTimeout(r, frameDelay))
    }

    // Hold
    for (let h = 0; h < stageHold; h++) {
      process.stdout.write('\x1B[H')

      const titleBar = '┌──────────────────────────────────────────┐'
      const titleMid = leaf('│') + colors.bold.white('   LUCA  ') + dim('Growing...') + leaf('                     │')
      const titleBot = '└──────────────────────────────────────────┘'
      process.stdout.write('\n')
      process.stdout.write(center(leaf(titleBar)) + '\n')
      process.stdout.write(center(titleMid, titleBar.length) + '\n')
      process.stdout.write(center(leaf(titleBot)) + '\n')
      process.stdout.write('\n')

      for (let l = 0; l < stage.length; l++) {
        // Add subtle wind sway to leaves on hold frames for final stages
        let line = stage[l]
        if (s >= 4 && h % 4 < 2 && (line.includes('♠') || line.includes('♣'))) {
          // Subtle shimmer
        }
        process.stdout.write(center(colorTreeLine(line, s + h), artWidth) + '\n')
      }

      process.stdout.write('\n')

      const progress = (s + 1) / stages.length
      const barWidth = 30
      const filled = Math.floor(progress * barWidth)
      let bar = ''
      for (let b = 0; b < barWidth; b++) {
        if (b < filled) {
          const ratio = b / barWidth
          if (ratio < 0.3) bar += ground('█')
          else if (ratio < 0.7) bar += leaf('█')
          else bar += flower('█')
        } else {
          bar += dim('░')
        }
      }
      const pct = Math.floor(progress * 100)
      process.stdout.write(center(`${bar} ${dim(String(pct).padStart(3) + '%')}`, barWidth + 5) + '\n')
      process.stdout.write(center(labelColor(status), status.length) + '\n')
      process.stdout.write('\n')

      await new Promise(r => setTimeout(r, frameDelay))
    }
  }

  // Final breeze animation - leaves flutter
  const finalStage = stages[stages.length - 1]
  for (let f = 0; f < 20; f++) {
    process.stdout.write('\x1B[H')

    const titleBar = '┌──────────────────────────────────────────┐'
    const titleMid = leaf('│') + colors.bold.white('   LUCA  ') + flowerGold('In Full Bloom ✿') + leaf('              │')
    const titleBot = '└──────────────────────────────────────────┘'
    process.stdout.write('\n')
    process.stdout.write(center(leaf(titleBar)) + '\n')
    process.stdout.write(center(titleMid, titleBar.length) + '\n')
    process.stdout.write(center(leaf(titleBot)) + '\n')
    process.stdout.write('\n')

    for (let l = 0; l < finalStage.length; l++) {
      process.stdout.write(center(colorTreeLine(finalStage[l], f), artWidth) + '\n')
    }

    process.stdout.write('\n')
    const bar = ground('█'.repeat(10)) + leaf('█'.repeat(12)) + flower('█'.repeat(8))
    process.stdout.write(center(`${bar} ${flowerGold('100%')}`, 35) + '\n')
    process.stdout.write(center(flowerGold('✿ Life finds a way'), 18) + '\n')
    process.stdout.write('\n')

    await new Promise(r => setTimeout(r, 120))
  }

  await new Promise(r => setTimeout(r, 1500))
  process.stdout.write('\x1B[?25h')
}

animate().catch(console.error)
