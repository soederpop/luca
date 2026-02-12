import container from '@/node'

const ui = container.feature('ui')
const { colors } = ui

// Encryption/decryption visualization: plaintext -> cipher scramble -> decrypt
const green = colors.hex('#00FF41')
const greenDim = colors.hex('#008F11')
const cyan = colors.hex('#4ECDC4')
const amber = colors.hex('#FFB000')
const red = colors.hex('#FF4444')
const magenta = colors.hex('#C850C0')
const gold = colors.hex('#FFD700')
const white = colors.bold.white
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

function randomHex(len: number): string {
  let s = ''
  for (let i = 0; i < len; i++) s += '0123456789ABCDEF'[Math.floor(Math.random() * 16)]
  return s
}

const width = 58
const cipherChars = '0123456789ABCDEFabcdef!@#$%^&*(){}[]|;:,.<>?/~`αβγδεζηθ'

// The message to encrypt then decrypt
const plaintext = [
  '┌────────────────────────────────────────────────────┐',
  '│                                                    │',
  '│   FROM: LUCA Central Command                       │',
  '│   TO:   All Field Operatives                       │',
  '│   RE:   Operation Nightfall                        │',
  '│                                                    │',
  '│   Rendezvous at coordinates:                       │',
  '│     LAT:  40.7128° N                               │',
  '│     LONG: 74.0060° W                               │',
  '│                                                    │',
  '│   Asset codename: ARCHITECT                        │',
  '│   Window: 0200-0400 UTC                            │',
  '│   Auth code: LUCA-7749-OMEGA                       │',
  '│                                                    │',
  '│   Destroy after reading.                           │',
  '│                                                    │',
  '└────────────────────────────────────────────────────┘',
]

const keyDisplay = 'AES-256-GCM // SHA-384 // ECDH-P521'
const hashSteps = [
  'Generating ephemeral keypair...',
  'ECDH key agreement...',
  'Deriving session key (HKDF)...',
  'Initializing AES-256-GCM...',
  'Encrypting plaintext blocks...',
  'Computing authentication tag...',
  'Cipher sealed ✓',
]
const decryptSteps = [
  'Receiving ciphertext...',
  'Validating authentication tag...',
  'Deriving decryption key...',
  'Decrypting blocks...',
  'Verifying integrity...',
  'Plaintext recovered ✓',
]

// Per-character encryption state: 0 = plain, 1 = encrypting, 2 = encrypted, 3 = decrypting, 4 = decrypted
type CharState = 0 | 1 | 2 | 3 | 4

async function animate() {
  const totalFrames = 360
  const frameDelay = 40

  const textHeight = plaintext.length

  // Per-character state
  const state: CharState[][] = Array.from({ length: textHeight }, (_, y) =>
    new Array(plaintext[y].length).fill(0)
  )

  // Track encryption and decryption waves
  let encryptCol = -1
  let decryptCol = -1

  process.stdout.write('\x1B[?25l')
  process.stdout.write('\x1B[2J\x1B[H')

  for (let frame = 0; frame < totalFrames; frame++) {
    // Phase 1 (0-40): show plaintext
    // Phase 2 (40-160): encrypt left to right
    // Phase 3 (160-200): hold encrypted
    // Phase 4 (200-320): decrypt left to right
    // Phase 5 (320-360): show decrypted

    const phase = frame < 40 ? 'plain' :
      frame < 160 ? 'encrypt' :
      frame < 200 ? 'encrypted' :
      frame < 320 ? 'decrypt' : 'decrypted'

    if (phase === 'encrypt') {
      encryptCol = Math.floor(((frame - 40) / 120) * (width + 5))
    } else if (phase === 'decrypt') {
      decryptCol = Math.floor(((frame - 200) / 120) * (width + 5))
    }

    // Update character states
    for (let y = 0; y < textHeight; y++) {
      for (let x = 0; x < plaintext[y].length; x++) {
        if (plaintext[y][x] === ' ') continue

        if (phase === 'encrypt') {
          if (x < encryptCol - 3) {
            state[y][x] = 2  // encrypted
          } else if (x < encryptCol) {
            state[y][x] = 1  // encrypting (transition)
          }
        } else if (phase === 'decrypt') {
          if (x < decryptCol - 3) {
            state[y][x] = 4  // decrypted
          } else if (x < decryptCol) {
            state[y][x] = 3  // decrypting (transition)
          }
        }
      }
    }

    // Render
    process.stdout.write('\x1B[H')

    const phaseLabel = phase === 'plain' ? '🔓 PLAINTEXT' :
      phase === 'encrypt' ? '🔒 ENCRYPTING...' :
      phase === 'encrypted' ? '🔒 ENCRYPTED' :
      phase === 'decrypt' ? '🔓 DECRYPTING...' : '🔓 DECRYPTED ✓'
    const phaseCol = (phase === 'plain' || phase === 'decrypted') ? green :
      (phase === 'encrypted') ? red : amber

    const titleBar = '┌──────────────────────────────────────────────────────────┐'
    const titleMid = cyan('│') + colors.bold.white('   LUCA  ') + dim('Secure Channel · ') + phaseCol(phaseLabel) + cyan('          │')
    const titleBot = '└──────────────────────────────────────────────────────────┘'
    process.stdout.write('\n')
    process.stdout.write(center(cyan(titleBar)) + '\n')
    process.stdout.write(center(titleMid, titleBar.length) + '\n')
    process.stdout.write(center(cyan(titleBot)) + '\n')

    // Key info
    if (phase !== 'plain') {
      const keyLine = `${dim('KEY:')} ${cyan(keyDisplay)}`
      process.stdout.write(center(keyLine, keyDisplay.length + 5) + '\n')
    } else {
      process.stdout.write('\n')
    }

    // Message area
    for (let y = 0; y < textHeight; y++) {
      let line = ''
      for (let x = 0; x < plaintext[y].length; x++) {
        const ch = plaintext[y][x]
        const s = state[y][x]

        if (ch === ' ') {
          line += ' '
        } else if (s === 0 || s === 4) {
          // Plain or decrypted - show original
          if (ch === '┌' || ch === '┐' || ch === '└' || ch === '┘' || ch === '│' || ch === '─') {
            line += (s === 4 ? green : cyan)(ch)
          } else {
            line += (s === 4 ? green : dim)(ch)
          }
        } else if (s === 1) {
          // Encrypting transition - rapid scramble
          line += amber(cipherChars[Math.floor(Math.random() * cipherChars.length)])
        } else if (s === 2) {
          // Fully encrypted - show hex-like cipher
          const cipherIdx = (x * 7 + y * 13 + frame * 3) % cipherChars.length
          // Slow mutation of cipher chars
          if (Math.random() < 0.05) {
            line += magenta(cipherChars[Math.floor(Math.random() * cipherChars.length)])
          } else {
            line += red(cipherChars[cipherIdx])
          }
        } else if (s === 3) {
          // Decrypting transition
          line += gold(cipherChars[Math.floor(Math.random() * cipherChars.length)])
        }
      }
      process.stdout.write(center(line, width) + '\n')
    }

    process.stdout.write('\n')

    // Crypto operation status
    let stepMsg = ''
    if (phase === 'encrypt') {
      const stepIdx = Math.min(Math.floor(((frame - 40) / 120) * hashSteps.length), hashSteps.length - 1)
      stepMsg = hashSteps[stepIdx]
    } else if (phase === 'encrypted') {
      stepMsg = 'Transmitting ciphertext over secure channel...'
    } else if (phase === 'decrypt') {
      const stepIdx = Math.min(Math.floor(((frame - 200) / 120) * decryptSteps.length), decryptSteps.length - 1)
      stepMsg = decryptSteps[stepIdx]
    } else if (phase === 'plain') {
      stepMsg = 'Preparing secure transmission...'
    } else {
      stepMsg = 'Message authenticated and verified ✓'
    }

    // Hash display that rotates
    if (phase !== 'plain' && phase !== 'decrypted') {
      const hash = randomHex(32)
      process.stdout.write(center(`${dim('HMAC:')} ${greenDim(hash)}`, 38) + '\n')
    } else {
      process.stdout.write('\n')
    }

    const barWidth = 30
    let progress = 0
    if (phase === 'plain') progress = 0
    else if (phase === 'encrypt') progress = (frame - 40) / 120 * 0.45
    else if (phase === 'encrypted') progress = 0.45 + ((frame - 160) / 40) * 0.1
    else if (phase === 'decrypt') progress = 0.55 + ((frame - 200) / 120) * 0.45
    else progress = 1.0

    const filled = Math.floor(progress * barWidth)
    let bar = ''
    for (let b = 0; b < barWidth; b++) {
      if (b < filled) {
        bar += (progress < 0.5 ? red : green)('█')
      } else {
        bar += dim('░')
      }
    }
    const pct = Math.floor(progress * 100)
    process.stdout.write(center(`${bar} ${dim(String(pct).padStart(3) + '%')}`, barWidth + 5) + '\n')
    process.stdout.write(center(labelColor(stepMsg), stepMsg.length) + '\n')
    process.stdout.write('\n')

    await new Promise(r => setTimeout(r, frameDelay))
  }

  await new Promise(r => setTimeout(r, 2000))
  process.stdout.write('\x1B[?25h')
}

animate().catch(console.error)
