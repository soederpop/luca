import container from '@/agi'

async function main() {
  const tmux = container.feature('tmux', { enable: true })
  await tmux.ensureSession()

  const layout = await tmux.split({ count: 2, orientation: 'horizontal' })
  const [left, right] = layout.panes

  // Left pane: matrix rain
  await left.run('bun run scripts/examples/ascii-animation-matrix.ts')

  // Right pane: oracle REPL
  await right.run('bun run scripts/examples/oracle.ts')

  // Wait for the matrix to finish (~10 seconds)
  await left.await()

  // Kill the animation pane, leaving just the oracle
  await left.kill()

  // Wait for user to exit the oracle
  await right.await()

  await layout.collapse()
}

main().catch(console.error)
