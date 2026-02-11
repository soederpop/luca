import container from '@/node'

const ui = container.feature('ui')
const { colors } = ui

// Neural network visualization: layers of nodes with signals propagating
const cyan = colors.hex('#4ECDC4')
const cyanDim = colors.hex('#2A7A74')
const magenta = colors.hex('#C850C0')
const magentaDim = colors.hex('#6A2A66')
const gold = colors.hex('#FFD700')
const green = colors.hex('#00FF41')
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

const width = 60
const height = 22

// Network architecture: layers with node counts
const layers = [
  { name: 'INPUT', nodes: 4, x: 4 },
  { name: 'HIDDEN', nodes: 6, x: 16 },
  { name: 'HIDDEN', nodes: 8, x: 28 },
  { name: 'HIDDEN', nodes: 6, x: 40 },
  { name: 'OUTPUT', nodes: 3, x: 52 },
]

// Calculate node positions
interface Node {
  x: number
  y: number
  layer: number
  activation: number
  fired: boolean
}

const nodes: Node[] = []
for (let l = 0; l < layers.length; l++) {
  const layer = layers[l]
  const totalHeight = height - 4
  const spacing = totalHeight / (layer.nodes + 1)
  for (let n = 0; n < layer.nodes; n++) {
    nodes.push({
      x: layer.x,
      y: Math.floor(spacing * (n + 1)) + 1,
      layer: l,
      activation: 0,
      fired: false,
    })
  }
}

// Connections between adjacent layers
interface Connection {
  from: number  // node index
  to: number    // node index
  weight: number
  signal: number  // 0 = no signal, 1 = signal traveling
  signalPos: number  // 0-1 position along connection
}

const connections: Connection[] = []
for (let l = 0; l < layers.length - 1; l++) {
  const fromNodes = nodes.filter(n => n.layer === l)
  const toNodes = nodes.filter(n => n.layer === l + 1)
  for (const from of fromNodes) {
    for (const to of toNodes) {
      // Not all connections — ~60% connectivity
      if (Math.random() < 0.6) {
        connections.push({
          from: nodes.indexOf(from),
          to: nodes.indexOf(to),
          weight: Math.random() * 2 - 1,
          signal: 0,
          signalPos: 0,
        })
      }
    }
  }
}

async function animate() {
  const totalFrames = 300
  const frameDelay = 45
  let fireTimer = 0

  process.stdout.write('\x1B[?25l')
  process.stdout.write('\x1B[2J\x1B[H')

  for (let frame = 0; frame < totalFrames; frame++) {
    // Fire input nodes periodically
    fireTimer++
    if (fireTimer > 25) {
      fireTimer = 0
      const inputNodes = nodes.filter(n => n.layer === 0)
      // Random subset of inputs fire
      for (const n of inputNodes) {
        if (Math.random() < 0.6) {
          n.activation = 0.8 + Math.random() * 0.2
          n.fired = true
          // Activate outgoing connections
          for (const conn of connections) {
            if (conn.from === nodes.indexOf(n)) {
              conn.signal = 1
              conn.signalPos = 0
            }
          }
        }
      }
    }

    // Propagate signals along connections
    for (const conn of connections) {
      if (conn.signal > 0) {
        conn.signalPos += 0.06
        if (conn.signalPos >= 1.0) {
          // Signal reached destination node
          const targetNode = nodes[conn.to]
          targetNode.activation = Math.min(1.0, targetNode.activation + 0.3 * Math.abs(conn.weight))
          targetNode.fired = true

          // Propagate to next layer connections
          for (const nextConn of connections) {
            if (nextConn.from === conn.to && nextConn.signal === 0) {
              nextConn.signal = 1
              nextConn.signalPos = 0
            }
          }

          conn.signal = 0
          conn.signalPos = 0
        }
      }
    }

    // Decay activations
    for (const n of nodes) {
      n.activation = Math.max(0, n.activation - 0.02)
      if (n.activation < 0.05) n.fired = false
    }

    // Build the visual grid
    const grid: string[][] = Array.from({ length: height }, () => new Array(width).fill(' '))
    const gridFn: ((s: string) => string)[][] = Array.from({ length: height }, () => new Array(width).fill(dim))

    // Draw connections first (underneath)
    for (const conn of connections) {
      const fromNode = nodes[conn.from]
      const toNode = nodes[conn.to]
      const dx = toNode.x - fromNode.x
      const dy = toNode.y - fromNode.y
      const steps = Math.max(Math.abs(dx), Math.abs(dy))

      for (let s = 1; s < steps; s++) {
        const t = s / steps
        const px = Math.round(fromNode.x + dx * t)
        const py = Math.round(fromNode.y + dy * t)

        if (px >= 0 && px < width && py >= 0 && py < height) {
          // Check if signal is at this position
          if (conn.signal > 0 && Math.abs(t - conn.signalPos) < 0.15) {
            grid[py][px] = '●'
            gridFn[py][px] = conn.weight > 0 ? cyan : magenta
          } else if (grid[py][px] === ' ') {
            // Determine line character based on direction
            const angle = Math.abs(dy / (dx || 1))
            if (angle < 0.3) {
              grid[py][px] = '─'
            } else if (angle > 3) {
              grid[py][px] = '│'
            } else {
              grid[py][px] = dy > 0 ? (dx > 0 ? '╲' : '╱') : (dx > 0 ? '╱' : '╲')
            }
            gridFn[py][px] = conn.weight > 0 ? cyanDim : magentaDim
          }
        }
      }
    }

    // Draw nodes on top
    for (const n of nodes) {
      if (n.x >= 0 && n.x < width && n.y >= 0 && n.y < height) {
        if (n.activation > 0.6) {
          grid[n.y][n.x] = '◉'
          gridFn[n.y][n.x] = gold
        } else if (n.activation > 0.2) {
          grid[n.y][n.x] = '●'
          gridFn[n.y][n.x] = cyan
        } else {
          grid[n.y][n.x] = '○'
          gridFn[n.y][n.x] = cyanDim
        }
      }
    }

    // Render
    process.stdout.write('\x1B[H')

    const titleBar = '┌──────────────────────────────────────────────────────────────┐'
    const titleMid = cyan('│') + colors.bold.white('   LUCA  ') + dim('Neural Network · Forward Pass') + cyan('                  │')
    const titleBot = '└──────────────────────────────────────────────────────────────┘'
    process.stdout.write('\n')
    process.stdout.write(center(cyan(titleBar)) + '\n')
    process.stdout.write(center(titleMid, titleBar.length) + '\n')
    process.stdout.write(center(cyan(titleBot)) + '\n')

    // Layer labels
    let layerLabels = ''
    let layerLabelsRaw = ''
    for (const layer of layers) {
      const padding = ' '.repeat(Math.max(0, layer.x - layerLabelsRaw.length))
      layerLabels += padding + labelColor(layer.name)
      layerLabelsRaw += padding + layer.name
    }
    process.stdout.write(center(layerLabels, width) + '\n')

    for (let y = 0; y < height; y++) {
      let line = ''
      for (let x = 0; x < width; x++) {
        line += gridFn[y][x](grid[y][x])
      }
      process.stdout.write(center(line, width) + '\n')
    }

    process.stdout.write('\n')

    // Stats
    const activeNodes = nodes.filter(n => n.activation > 0.1).length
    const totalNodes = nodes.length
    const activeConns = connections.filter(c => c.signal > 0).length
    const stats = `${cyan('◉')} ${dim('Neurons:')} ${cyan(activeNodes + '/' + totalNodes)}  ${magenta('→')} ${dim('Signals:')} ${magenta(String(activeConns))}  ${dim('Epoch:')} ${gold(String(Math.floor(frame / 25)))}`
    process.stdout.write(center(stats, 55) + '\n')

    const progress = frame / totalFrames
    const msgs = ['Initializing weights...', 'Forward propagation...', 'Computing activations...', 'Backpropagation...', 'Gradient descent...', 'Model converged ✓']
    const msgIdx = Math.min(Math.floor(progress * msgs.length), msgs.length - 1)
    process.stdout.write(center(labelColor(msgs[msgIdx]), msgs[msgIdx].length) + '\n')
    process.stdout.write('\n')

    await new Promise(r => setTimeout(r, frameDelay))
  }

  await new Promise(r => setTimeout(r, 1500))
  process.stdout.write('\x1B[?25h')
}

animate().catch(console.error)
