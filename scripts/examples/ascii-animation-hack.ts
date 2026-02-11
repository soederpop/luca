import container from '@/node'

const ui = container.feature('ui')
const { colors } = ui

// Terminal hacking sequence with scrolling code, password cracking, system breach
const green = colors.hex('#00FF41')
const greenDim = colors.hex('#008F11')
const red = colors.hex('#FF4444')
const amber = colors.hex('#FFB000')
const cyan = colors.hex('#4ECDC4')
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

const width = 62
const height = 22

// Random hex strings
function randomHex(len: number): string {
  let s = ''
  for (let i = 0; i < len; i++) s += '0123456789ABCDEF'[Math.floor(Math.random() * 16)]
  return s
}

// Random IP
function randomIP(): string {
  return `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`
}

// Fake file paths
const filePaths = [
  '/etc/shadow', '/var/log/auth.log', '/root/.ssh/id_rsa',
  '/proc/kcore', '/sys/firmware/efi', '/dev/mem',
  '/opt/luca/core.bin', '/opt/luca/secrets.enc',
  '/var/run/containerd.sock', '/etc/ssl/private/key.pem',
]

// Sequence phases
type Phase = 'scan' | 'crack' | 'inject' | 'breach' | 'download' | 'complete'

interface TermLine {
  text: string
  color: (s: string) => string
}

async function animate() {
  const frameDelay = 45
  const termBuffer: TermLine[] = []
  const maxLines = height - 2

  function addLine(text: string, color: (s: string) => string = green) {
    termBuffer.push({ text, color })
    if (termBuffer.length > maxLines) termBuffer.shift()
  }

  function addBlank() {
    addLine('', dim)
  }

  process.stdout.write('\x1B[?25l')
  process.stdout.write('\x1B[2J\x1B[H')

  let phase: Phase = 'scan'
  let phaseFrame = 0
  let totalFrame = 0
  const totalDuration = 320

  while (totalFrame < totalDuration) {
    // Phase logic
    switch (phase) {
      case 'scan': {
        if (phaseFrame === 0) {
          addLine('$ nmap -sS -O -p- target.luca.network', amber)
          addBlank()
          addLine('Starting Nmap 7.94 ( https://nmap.org )', dim)
        }
        if (phaseFrame > 5 && phaseFrame % 4 === 0 && phaseFrame < 50) {
          const port = [22, 80, 443, 3306, 5432, 6379, 8080, 8443, 9090, 27017][Math.floor(Math.random() * 10)]
          const service = ['ssh', 'http', 'https', 'mysql', 'postgres', 'redis', 'http-alt', 'https-alt', 'prometheus', 'mongodb'][Math.floor(Math.random() * 10)]
          const state = Math.random() > 0.3 ? green('open') : red('filtered')
          addLine(`  ${String(port).padEnd(8)} ${state}    ${service}`, green)
        }
        if (phaseFrame === 55) {
          addLine(`OS detection: Linux 5.15 (98% confidence)`, dim)
          addLine(`Scan complete: 10 hosts, 847 ports scanned`, green)
          addBlank()
        }
        if (phaseFrame >= 60) { phase = 'crack'; phaseFrame = -1 }
        break
      }

      case 'crack': {
        if (phaseFrame === 0) {
          addLine('$ hydra -l root -P rockyou.txt ssh://target.luca.network', amber)
          addBlank()
          addLine('[DATA] attacking ssh://target.luca.network:22', dim)
        }
        if (phaseFrame > 3 && phaseFrame % 2 === 0 && phaseFrame < 60) {
          const attempt = randomHex(8).toLowerCase()
          const status = phaseFrame < 55 ? red('FAILED') : green('SUCCESS')
          addLine(`  [ATTEMPT] root:${attempt}  ${status}`, phaseFrame < 55 ? dim : green)
          if (phaseFrame >= 55) {
            addLine(`  [22][ssh] host: target.luca.network  login: root  password: ████████`, green)
            addBlank()
          }
        }
        if (phaseFrame >= 65) { phase = 'inject'; phaseFrame = -1 }
        break
      }

      case 'inject': {
        if (phaseFrame === 0) {
          addLine('$ ssh root@target.luca.network', amber)
          addLine('Connection established. Injecting payload...', green)
          addBlank()
        }
        if (phaseFrame > 5 && phaseFrame % 6 === 0 && phaseFrame < 40) {
          const addr = `0x${randomHex(8)}`
          addLine(`  [INJECT] Writing shellcode to ${addr}`, cyan)
        }
        if (phaseFrame === 42) {
          addLine('  [INJECT] Payload deployed successfully', green)
          addLine('  [PRIV]   Escalating privileges...', amber)
        }
        if (phaseFrame === 50) {
          addLine('  [PRIV]   root access confirmed ✓', green)
          addBlank()
        }
        if (phaseFrame >= 55) { phase = 'breach'; phaseFrame = -1 }
        break
      }

      case 'breach': {
        if (phaseFrame === 0) {
          addLine('$ find / -name "*.enc" -o -name "*.key" -o -name "*.pem"', amber)
          addBlank()
        }
        if (phaseFrame > 3 && phaseFrame % 4 === 0 && phaseFrame < 35) {
          const path = filePaths[Math.floor(Math.random() * filePaths.length)]
          addLine(`  ${path}`, green)
        }
        if (phaseFrame === 38) {
          addBlank()
          addLine('$ cat /opt/luca/secrets.enc | openssl dec -aes-256-cbc', amber)
          addLine('  Decrypting...', dim)
        }
        if (phaseFrame === 45) {
          addLine('  ─────────────────────────────────', dim)
          addLine('  LUCA_CORE_KEY=████████████████████', green)
          addLine('  LUCA_API_SECRET=██████████████████', green)
          addLine('  LUCA_MASTER_TOKEN=██████████████', green)
          addLine('  ─────────────────────────────────', dim)
          addBlank()
        }
        if (phaseFrame >= 52) { phase = 'download'; phaseFrame = -1 }
        break
      }

      case 'download': {
        if (phaseFrame === 0) {
          addLine('$ exfiltrate --compress --encrypt /opt/luca/', amber)
          addBlank()
        }
        if (phaseFrame > 2 && phaseFrame % 3 === 0 && phaseFrame < 40) {
          const pct = Math.min(100, Math.floor((phaseFrame / 40) * 100))
          const barW = 20
          const filled = Math.floor((pct / 100) * barW)
          let progressBar = ''
          for (let i = 0; i < barW; i++) progressBar += i < filled ? '█' : '░'
          const size = (pct * 4.7).toFixed(1)
          addLine(`  [${progressBar}] ${pct}%  ${size}MB / 470MB`, cyan)
        }
        if (phaseFrame === 42) {
          addBlank()
          addLine('  Transfer complete. Cleaning traces...', green)
        }
        if (phaseFrame === 50) {
          addLine('  $ history -c && rm -rf /var/log/*', amber)
          addLine('  Logs purged. Disconnecting...', green)
          addBlank()
        }
        if (phaseFrame >= 55) { phase = 'complete'; phaseFrame = -1 }
        break
      }

      case 'complete': {
        if (phaseFrame === 0) {
          addLine('  ═══════════════════════════════════════════', green)
          addLine('  ║  OPERATION COMPLETE                     ║', green)
          addLine('  ║  Status: SUCCESS                        ║', green)
          addLine('  ║  Data exfiltrated: 470MB                ║', green)
          addLine('  ║  Traces: CLEANED                        ║', green)
          addLine('  ║  Connection: TERMINATED                 ║', green)
          addLine('  ═══════════════════════════════════════════', green)
        }
        if (phaseFrame >= 30) break
        break
      }
    }

    // Render
    process.stdout.write('\x1B[H')

    const titleBar = '┌──────────────────────────────────────────────────────────────┐'
    const titleMid = green('│') + colors.bold.white('   LUCA  ') + dim('Penetration Test Simulation') + green('                    │')
    const titleBot = '└──────────────────────────────────────────────────────────────┘'
    process.stdout.write('\n')
    process.stdout.write(center(green(titleBar)) + '\n')
    process.stdout.write(center(titleMid, titleBar.length) + '\n')
    process.stdout.write(center(green(titleBot)) + '\n')

    // Terminal content
    for (let i = 0; i < maxLines; i++) {
      if (i < termBuffer.length) {
        const tl = termBuffer[i]
        const padded = tl.text.padEnd(width).slice(0, width)
        process.stdout.write(center(tl.color(padded), width) + '\n')
      } else {
        process.stdout.write(center(' '.repeat(width), width) + '\n')
      }
    }

    process.stdout.write('\n')

    // Blinking cursor
    const cursorChar = totalFrame % 10 < 5 ? '█' : ' '
    const prompt = phase !== 'complete' ? `root@luca:~# ${green(cursorChar)}` : green('✓ Session closed')
    process.stdout.write(center(prompt, 20) + '\n')
    process.stdout.write('\n')

    phaseFrame++
    totalFrame++
    await new Promise(r => setTimeout(r, frameDelay))
  }

  await new Promise(r => setTimeout(r, 2000))
  process.stdout.write('\x1B[?25h')
}

animate().catch(console.error)
