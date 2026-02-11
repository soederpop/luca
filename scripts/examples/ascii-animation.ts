import container from '@/node'

const ui = container.feature('ui')
const { colors } = ui

// Consistent color theme
const brick = colors.hex('#E87D3E')    // warm orange for bricks
const brickLight = colors.hex('#F4A460') // lighter accent brick
const accent = colors.hex('#4ECDC4')   // teal accent
const dim = colors.dim
const eye = colors.hex('#4ECDC4')
const mouth = colors.hex('#4ECDC4')
const label = colors.hex('#888888')

// The robot/assistant being built brick by brick, from bottom to top
// Each stage adds more bricks. The figure is ~18 lines tall.
const stages = [
  // Stage 0: empty platform
  [
    "                              ",
    "                              ",
    "                              ",
    "                              ",
    "                              ",
    "                              ",
    "                              ",
    "                              ",
    "                              ",
    "                              ",
    "                              ",
    "                              ",
    "                              ",
    "                              ",
    "         ████████████████     ",
    "         ████████████████     ",
  ],
  // Stage 1: feet
  [
    "                              ",
    "                              ",
    "                              ",
    "                              ",
    "                              ",
    "                              ",
    "                              ",
    "                              ",
    "                              ",
    "                              ",
    "                              ",
    "                              ",
    "           ████    ████       ",
    "           ████    ████       ",
    "         ████████████████     ",
    "         ████████████████     ",
  ],
  // Stage 2: legs
  [
    "                              ",
    "                              ",
    "                              ",
    "                              ",
    "                              ",
    "                              ",
    "                              ",
    "                              ",
    "                              ",
    "                              ",
    "            ██      ██        ",
    "            ██      ██        ",
    "           ████    ████       ",
    "           ████    ████       ",
    "         ████████████████     ",
    "         ████████████████     ",
  ],
  // Stage 3: lower torso
  [
    "                              ",
    "                              ",
    "                              ",
    "                              ",
    "                              ",
    "                              ",
    "                              ",
    "                              ",
    "          ████████████        ",
    "          ████████████        ",
    "            ██      ██        ",
    "            ██      ██        ",
    "           ████    ████       ",
    "           ████    ████       ",
    "         ████████████████     ",
    "         ████████████████     ",
  ],
  // Stage 4: upper torso
  [
    "                              ",
    "                              ",
    "                              ",
    "                              ",
    "                              ",
    "                              ",
    "          ████████████        ",
    "          ██  ⚙   ██        ",
    "          ████████████        ",
    "          ████████████        ",
    "            ██      ██        ",
    "            ██      ██        ",
    "           ████    ████       ",
    "           ████    ████       ",
    "         ████████████████     ",
    "         ████████████████     ",
  ],
  // Stage 5: arms
  [
    "                              ",
    "                              ",
    "                              ",
    "                              ",
    "                              ",
    "                              ",
    "       █  ████████████  █     ",
    "       █  ██  ⚙   ██  █     ",
    "       █  ████████████  █     ",
    "      ██  ████████████  ██    ",
    "            ██      ██        ",
    "            ██      ██        ",
    "           ████    ████       ",
    "           ████    ████       ",
    "         ████████████████     ",
    "         ████████████████     ",
  ],
  // Stage 6: neck
  [
    "                              ",
    "                              ",
    "                              ",
    "                              ",
    "                              ",
    "             ██████           ",
    "       █  ████████████  █     ",
    "       █  ██  ⚙   ██  █     ",
    "       █  ████████████  █     ",
    "      ██  ████████████  ██    ",
    "            ██      ██        ",
    "            ██      ██        ",
    "           ████    ████       ",
    "           ████    ████       ",
    "         ████████████████     ",
    "         ████████████████     ",
  ],
  // Stage 7: head shell
  [
    "                              ",
    "                              ",
    "          ██████████████      ",
    "          ██          ██      ",
    "          ██          ██      ",
    "          ██████████████      ",
    "       █  ████████████  █     ",
    "       █  ██  ⚙   ██  █     ",
    "       █  ████████████  █     ",
    "      ██  ████████████  ██    ",
    "            ██      ██        ",
    "            ██      ██        ",
    "           ████    ████       ",
    "           ████    ████       ",
    "         ████████████████     ",
    "         ████████████████     ",
  ],
  // Stage 8: eyes
  [
    "                              ",
    "                              ",
    "          ██████████████      ",
    "          ██ ◉    ◉  ██      ",
    "          ██          ██      ",
    "          ██████████████      ",
    "       █  ████████████  █     ",
    "       █  ██  ⚙   ██  █     ",
    "       █  ████████████  █     ",
    "      ██  ████████████  ██    ",
    "            ██      ██        ",
    "            ██      ██        ",
    "           ████    ████       ",
    "           ████    ████       ",
    "         ████████████████     ",
    "         ████████████████     ",
  ],
  // Stage 9: mouth + antenna — complete!
  [
    "              ██              ",
    "             ████             ",
    "          ██████████████      ",
    "          ██ ◉    ◉  ██      ",
    "          ██   ▬▬    ██      ",
    "          ██████████████      ",
    "       █  ████████████  █     ",
    "       █  ██  ⚙   ██  █     ",
    "       █  ████████████  █     ",
    "      ██  ████████████  ██    ",
    "            ██      ██        ",
    "            ██      ██        ",
    "           ████    ████       ",
    "           ████    ████       ",
    "         ████████████████     ",
    "         ████████████████     ",
  ],
]

// Status messages shown during build
const statusMessages = [
  'Laying foundation...',
  'Placing feet modules...',
  'Assembling leg struts...',
  'Building lower chassis...',
  'Installing core processor...',
  'Attaching arm servos...',
  'Connecting neck joint...',
  'Constructing cranial housing...',
  'Wiring optical sensors...',
  'Initializing personality...',
]

// Brick-laying animation: a small block that "flies" to position
const brickAnim = ['▪', '▫', '▪']

function colorRobotLine(line: string, stageIdx: number): string {
  let result = ''
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '◉') {
      result += eye(ch)
    } else if (ch === '▬') {
      result += mouth(ch)
    } else if (ch === '⚙') {
      result += accent(ch)
    } else if (ch === '█') {
      // Alternate brick colors slightly for texture
      result += (i + stageIdx) % 3 === 0 ? brickLight(ch) : brick(ch)
    } else {
      result += ch
    }
  }
  return result
}

async function animate() {
  const frameDelay = 90
  const stageHold = 6 // frames to hold each completed stage

  process.stdout.write('\x1B[?25l') // hide cursor
  process.stdout.write('\x1B[2J\x1B[H') // clear

  for (let s = 0; s < stages.length; s++) {
    const stage = stages[s]
    const prevStage = s > 0 ? stages[s - 1] : stage.map(() => ' '.repeat(30))
    const status = statusMessages[s]

    // Find which lines changed (new bricks added)
    const changedLines: number[] = []
    for (let l = 0; l < stage.length; l++) {
      if (stage[l] !== prevStage[l]) changedLines.push(l)
    }

    // Animate bricks appearing line by line from bottom to top
    const sortedChanged = [...changedLines].sort((a, b) => b - a)

    for (let ci = 0; ci < sortedChanged.length; ci++) {
      const targetLine = sortedChanged[ci]

      // Build a transitional frame: previous stage + lines revealed so far
      for (let brickFrame = 0; brickFrame < 3; brickFrame++) {
        process.stdout.write('\x1B[H')

        // Title
        process.stdout.write('\n')
        process.stdout.write(accent('  ┌─────────────────────────────────────┐') + '\n')
        process.stdout.write(accent('  │') + colors.bold.white('   LUCA  ') + dim('Building Assistant...') + accent('       │') + '\n')
        process.stdout.write(accent('  └─────────────────────────────────────┘') + '\n')
        process.stdout.write('\n')

        for (let l = 0; l < stage.length; l++) {
          const alreadyRevealed = sortedChanged.slice(0, ci).includes(l)
          const isCurrentLine = l === targetLine

          if (alreadyRevealed || (isCurrentLine && brickFrame === 2)) {
            // Show final brick line
            process.stdout.write(colorRobotLine(stage[l], s) + '\n')
          } else if (isCurrentLine && brickFrame < 2) {
            // Show shimmer/placing effect
            let shimmer = ''
            for (let c = 0; c < stage[l].length; c++) {
              if (stage[l][c] === '█' && prevStage[l][c] !== '█') {
                shimmer += brickFrame === 0 ? dim('░') : brickLight('▓')
              } else if (stage[l][c] !== ' ' && prevStage[l][c] === ' ') {
                shimmer += dim(stage[l][c])
              } else {
                shimmer += colorRobotLine(prevStage[l][c], s)
              }
            }
            process.stdout.write(shimmer + '\n')
          } else {
            // Show previous stage line
            process.stdout.write(colorRobotLine(prevStage[l], s) + '\n')
          }
        }

        process.stdout.write('\n')

        // Status line
        const progress = (s + (ci / sortedChanged.length)) / stages.length
        const barWidth = 30
        const filled = Math.floor(progress * barWidth)
        let bar = ''
        for (let b = 0; b < barWidth; b++) {
          bar += b < filled ? brick('█') : dim('░')
        }
        const pct = Math.floor(progress * 100)
        process.stdout.write(`  ${bar} ${dim(String(pct).padStart(3) + '%')}\n`)
        process.stdout.write(`  ${label(status)}\n`)
        process.stdout.write('\n')

        await new Promise(r => setTimeout(r, frameDelay))
      }
    }

    // Hold the completed stage for a moment
    for (let h = 0; h < stageHold; h++) {
      process.stdout.write('\x1B[H')

      process.stdout.write('\n')
      process.stdout.write(accent('  ┌─────────────────────────────────────┐') + '\n')
      process.stdout.write(accent('  │') + colors.bold.white('   LUCA  ') + dim('Building Assistant...') + accent('       │') + '\n')
      process.stdout.write(accent('  └─────────────────────────────────────┘') + '\n')
      process.stdout.write('\n')

      for (let l = 0; l < stage.length; l++) {
        process.stdout.write(colorRobotLine(stage[l], s) + '\n')
      }

      process.stdout.write('\n')

      const progress = (s + 1) / stages.length
      const barWidth = 30
      const filled = Math.floor(progress * barWidth)
      let bar = ''
      for (let b = 0; b < barWidth; b++) {
        bar += b < filled ? brick('█') : dim('░')
      }
      const pct = Math.floor(progress * 100)
      process.stdout.write(`  ${bar} ${dim(String(pct).padStart(3) + '%')}\n`)
      process.stdout.write(`  ${label(status)}\n`)
      process.stdout.write('\n')

      await new Promise(r => setTimeout(r, frameDelay))
    }
  }

  // Final "boot up" sequence - eyes blink
  const completeStage = stages[stages.length - 1]
  for (let blink = 0; blink < 3; blink++) {
    for (const eyeState of ['off', 'on'] as const) {
      process.stdout.write('\x1B[H')

      process.stdout.write('\n')
      process.stdout.write(accent('  ┌─────────────────────────────────────┐') + '\n')
      process.stdout.write(accent('  │') + colors.bold.white('   LUCA  ') + accent('Assistant Online       ') + accent('│') + '\n')
      process.stdout.write(accent('  └─────────────────────────────────────┘') + '\n')
      process.stdout.write('\n')

      for (let l = 0; l < completeStage.length; l++) {
        let line = completeStage[l]
        if (eyeState === 'off') {
          line = line.replace(/◉/g, '─')
        }
        process.stdout.write(colorRobotLine(line, stages.length - 1) + '\n')
      }

      process.stdout.write('\n')
      const bar = brick('█'.repeat(30))
      process.stdout.write(`  ${bar} ${accent('100%')}\n`)
      process.stdout.write(`  ${eyeState === 'on' ? accent('✓ Ready') : label('Booting...')}\n`)
      process.stdout.write('\n')

      await new Promise(r => setTimeout(r, eyeState === 'off' ? 120 : 250))
    }
  }

  // Final hold
  await new Promise(r => setTimeout(r, 500))

  process.stdout.write('\x1B[?25h') // show cursor
}

animate().catch(console.error)
