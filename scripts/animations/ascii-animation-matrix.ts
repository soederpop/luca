import container from '@/node'

const ui = container.feature('ui')
const { colors } = ui

// Full-screen Matrix digital rain effect
const green = colors.hex('#00FF41')
const greenDim = colors.hex('#008F11')
const greenBright = colors.hex('#00FF41').bold
const greenFaint = colors.hex('#004F00')
const dim = colors.dim
const white = colors.bold.white

const matrixChars = 'ﾊﾐﾋｰｳｼﾅﾓﾆｻﾜﾂｵﾘｱﾎﾃﾏｹﾒｴｶｷﾑﾕﾗｾﾈｽﾀﾇﾍ01234567890ABCDEF:.="*+-<>¦|╌ꟼ⌐¬░▒▓'

interface Drop {
  x: number
  y: number
  speed: number
  length: number
  chars: string[]
}

function randomChar(): string {
  return matrixChars[Math.floor(Math.random() * matrixChars.length)]
}

function createDrop(x: number, width: number): Drop {
  const length = 4 + Math.floor(Math.random() * 16)
  return {
    x: x ?? Math.floor(Math.random() * width),
    y: -length - Math.floor(Math.random() * 10),
    speed: 0.3 + Math.random() * 0.8,
    length,
    chars: Array.from({ length }, () => randomChar()),
  }
}

// LUCA text to reveal (wider version for full screen)
const revealText = [
  '██       ██  ██  ██████   █████  ',
  '██       ██  ██  ██      ██   ██ ',
  '██       ██  ██  ██      ███████ ',
  '██       ██  ██  ██      ██   ██ ',
  '██████   ██████  ██████  ██   ██ ',
]

async function animate() {
  const totalFrames = 280
  const frameDelay = 35

  // Use actual terminal dimensions
  const width = process.stdout.columns || 80
  const height = (process.stdout.rows || 24) - 1 // leave 1 row margin

  // Initialize drops - one every ~2 columns for density
  const dropCount = Math.floor(width / 2)
  let drops: Drop[] = []
  for (let i = 0; i < dropCount; i++) {
    const d = createDrop(Math.floor(Math.random() * width), width)
    d.y = Math.floor(Math.random() * height) // scatter initially
    drops.push(d)
  }

  // Grid
  const grid: string[][] = Array.from({ length: height }, () => new Array(width).fill(' '))
  const brightness: number[][] = Array.from({ length: height }, () => new Array(width).fill(0))

  process.stdout.write('\x1B[?25l')
  process.stdout.write('\x1B[2J\x1B[H')

  for (let frame = 0; frame < totalFrames; frame++) {
    // Decay brightness
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        brightness[y][x] = Math.max(0, brightness[y][x] - 0.05)
        if (brightness[y][x] < 0.03) {
          grid[y][x] = ' '
          brightness[y][x] = 0
        }
      }
    }

    // Update drops
    for (const drop of drops) {
      drop.y += drop.speed

      for (let i = 0; i < drop.length; i++) {
        const dy = Math.floor(drop.y) - i
        if (dy >= 0 && dy < height && drop.x >= 0 && drop.x < width) {
          grid[dy][drop.x] = drop.chars[i]
          brightness[dy][drop.x] = i === 0 ? 1.0 : Math.max(brightness[dy][drop.x], 1.0 - (i / drop.length))
          if (Math.random() < 0.04) {
            drop.chars[i] = randomChar()
          }
        }
      }
    }

    // Remove off-screen drops and respawn
    drops = drops.filter(d => Math.floor(d.y) - d.length < height)
    while (drops.length < dropCount) {
      drops.push(createDrop(Math.floor(Math.random() * width), width))
    }

    // Reveal LUCA text in the center during final phase
    const revealPhase = frame > 180
    const revealStartRow = Math.floor((height - revealText.length) / 2)
    const revealStartCol = Math.floor((width - revealText[0].length) / 2)

    // Render frame
    process.stdout.write('\x1B[H')

    for (let y = 0; y < height; y++) {
      let line = ''
      for (let x = 0; x < width; x++) {
        // Check if this position should show reveal text
        if (revealPhase) {
          const textRow = y - revealStartRow
          const textCol = x - revealStartCol
          if (textRow >= 0 && textRow < revealText.length && textCol >= 0 && textCol < revealText[textRow].length) {
            if (revealText[textRow][textCol] === '█') {
              const revealProgress = (frame - 180) / 100
              if (revealProgress > Math.random() * 0.8) {
                // Glitch the reveal occasionally
                if (Math.random() > 0.95 && frame < 250) {
                  line += green(randomChar())
                } else {
                  line += white('█')
                }
                continue
              }
            }
          }
        }

        const b = brightness[y][x]
        const ch = grid[y][x]
        if (b <= 0 || ch === ' ') {
          line += ' '
        } else if (b > 0.9) {
          line += white(ch) // leading head is white
        } else if (b > 0.65) {
          line += greenBright(ch)
        } else if (b > 0.4) {
          line += green(ch)
        } else if (b > 0.2) {
          line += greenDim(ch)
        } else {
          line += greenFaint(ch)
        }
      }
      process.stdout.write(line + '\n')
    }

    await new Promise(r => setTimeout(r, frameDelay))
  }

  // Hold final frame
  await new Promise(r => setTimeout(r, 2000))
  process.stdout.write('\x1B[?25h')
}

animate().catch(console.error)
