import { afterEach, beforeEach, describe, expect, it, spyOn, type Mock } from 'bun:test'
import { NodeContainer } from '../src/node/container'
import { TmuxPane, TmuxSession, type Tmux } from '../src/node/features/tmux'
let tmux: Tmux
let run: Mock<Tmux['run']>
let oldPane: string | undefined
beforeEach(() => {
  oldPane = process.env.TMUX_PANE
  delete process.env.TMUX_PANE
  tmux = new NodeContainer().feature('tmux', { tmuxPath: '/nonexistent/luca-test-tmux' })
  run = spyOn(tmux, 'run').mockResolvedValue({ stdout: '', stderr: '' })
})
afterEach(() => {
  run.mockRestore()
  if (oldPane === undefined) delete process.env.TMUX_PANE
  else process.env.TMUX_PANE = oldPane
})
const calls = () => run.mock.calls.map(call => call[0])

describe('Tmux', () => {
  it('reports unavailable binaries and rejects unmocked execution', async () => {
    run.mockRestore()
    expect(tmux.available).toBe(false)
    expect(tmux.tmuxPath).toBeNull()
    await expect(tmux.run(['list-sessions'])).rejects.toThrow('tmux is not installed')
    await expect(tmux.hasSession('missing')).rejects.toThrow('tmux is not installed')
  })
  it('parses session listings and handles an empty server', async () => {
    run.mockResolvedValueOnce({ stdout: 'work\t2\t1700000000\nscratch\t1\t1700000010\n', stderr: '' })
    expect(await tmux.listSessions()).toEqual([{ name: 'work', windows: 2, created: 1700000000 }, { name: 'scratch', windows: 1, created: 1700000010 }])
    expect(await tmux.listSessions()).toEqual([])
  })
  it('creates missing sessions with explicit dimensions, cwd and command', async () => {
    const has = spyOn(tmux, 'hasSession').mockResolvedValue(false)
    try {
      const session = await tmux.createSession('work', { width: 120, height: 40, cwd: '/project space', command: 'bun run app.ts' })
      expect(session.name).toBe('work')
      expect(calls()).toEqual([['new-session', '-d', '-s', 'work', '-x', '120', '-y', '40', '-c', '/project space', 'bun run app.ts']])
    } finally { has.mockRestore() }
  })
  it('reuses existing sessions without issuing create commands', async () => {
    const has = spyOn(tmux, 'hasSession').mockResolvedValue(true)
    try {
      const session = await tmux.session('work')
      expect(await session.exists()).toBe(true)
      expect(run).not.toHaveBeenCalled()
    } finally { has.mockRestore() }
  })
  it('uses default dimensions and dispatches session termination', async () => {
    const has = spyOn(tmux, 'hasSession').mockResolvedValue(false)
    try {
      await tmux.session('work'); await tmux.killSession('work')
      expect(calls()).toEqual([['new-session', '-d', '-s', 'work', '-x', '220', '-y', '50'], ['kill-session', '-t', 'work']])
    } finally { has.mockRestore() }
  })
  for (const kind of ['session', 'pane'] as const) {
    describe(kind, () => {
      const subject = () => kind === 'session' ? new TmuxSession('target', tmux) : new TmuxPane('target', 'label', tmux)
      it('distinguishes literal input submission from special keys', async () => {
        const target = subject()
        await target.send('hello world'); await target.sendKeys('C-c')
        expect(calls()).toEqual([['send-keys', '-t', 'target', 'hello world', 'Enter'], ['send-keys', '-t', 'target', 'C-c']])
      })
      it('strips ANSI sequences and passes requested scrollback', async () => {
        run.mockResolvedValue({ stdout: '\x1b[31mhello\x1b[0m\n\x1b]0;title\x07world\n', stderr: '' })
        expect(await subject().capture({ lines: -100 })).toBe('hello\nworld\n')
        expect(calls()).toEqual([['capture-pane', '-t', 'target', '-p', '-S', '-100']])
      })
      it.each(['$', '❯', '>', '?', '#', '%', '…', '...'])('recognizes the %s prompt after blank lines', async (prompt) => {
        run.mockResolvedValue({ stdout: `working\n${prompt}  \n\n`, stderr: '' })
        expect(await subject().isWaitingForInput()).toBe(true)
      })
      it('rejects ordinary output and honors custom patterns', async () => {
        run.mockResolvedValue({ stdout: 'Ready: ', stderr: '' })
        expect(await subject().isWaitingForInput()).toBe(false)
        expect(await subject().isWaitingForInput({ patterns: [/Ready:$/] })).toBe(true)
      })
      it('requires the requested command when checking a prompt', async () => {
        run.mockImplementation(async (args) => ({ stdout: args[0] === 'capture-pane' ? '$\n' : 'bash\n', stderr: '' }))
        expect(await subject().isWaitingForInput({ commandName: 'python' })).toBe(false)
        expect(await subject().isWaitingForInput({ commandName: 'bash' })).toBe(true)
        expect(await subject().currentCommand()).toBe('bash')
      })
      it('dispatches resize and kill to the right target type', async () => {
        const target = subject(); await target.resize(80, 24); await target.kill()
        expect(calls()).toEqual([[kind === 'session' ? 'resize-window' : 'resize-pane', '-t', 'target', '-x', '80', '-y', '24'], [kind === 'session' ? 'kill-session' : 'kill-pane', '-t', 'target']])
      })
    })
  }
  it('types Unicode characters individually and optionally submits', async () => {
    const pane = new TmuxPane('%1', 'input', tmux)
    await pane.type('a🔐', { delay: 0, submit: true })
    expect(calls()).toEqual([['send-keys', '-t', '%1', 'a'], ['send-keys', '-t', '%1', '🔐'], ['send-keys', '-t', '%1', 'Enter']])
  })
  it('splits panes with explicit target, orientation, size and name', async () => {
    run.mockResolvedValue({ stdout: '%2\n', stderr: '' })
    const pane = await new TmuxSession('session', tmux).splitPane({ target: '%1', direction: 'horizontal', size: 25, before: true, command: 'top', name: 'monitor' })
    expect(pane.id).toBe('%2'); expect(pane.name).toBe('monitor')
    expect(calls()).toEqual([['split-window', '-t', '%1', '-P', '-F', '#{pane_id}', '-h', '-b', '-l', '25', 'top']])
  })
  it('uses the current pane and vertical orientation by default', async () => {
    process.env.TMUX_PANE = '%current'
    run.mockResolvedValue({ stdout: '%new', stderr: '' })
    expect((await new TmuxSession('session', tmux).splitPane()).name).toBe('%new')
    expect(calls()[0]).toEqual(['split-window', '-t', '%current', '-P', '-F', '#{pane_id}', '-v'])
  })
  it('rejects layouts and splits without a target and empty layouts', async () => {
    const session = new TmuxSession('session', tmux)
    await expect(session.splitPane()).rejects.toThrow('target pane')
    await expect(session.createLayout({ panels: [] })).rejects.toThrow('TMUX_PANE')
    process.env.TMUX_PANE = '%1'
    await expect(session.createLayout({ panels: [] })).rejects.toThrow('at least one panel')
    expect(run).not.toHaveBeenCalled()
  })
  it('builds named panels and returns focus to the control strip', async () => {
    process.env.TMUX_PANE = '%1'
    run.mockImplementation(async (args) => ({ stdout: args[0] === 'split-window' ? (args.includes('-v') ? '%control' : '%second') : '', stderr: '' }))
    const layout = await new TmuxSession('session', tmux).createLayout({ panels: [{ name: 'main', command: 'bun main.ts' }, { name: 'logs', command: 'tail -f log', cwd: '/workspace logs' }] })
    expect(layout.control.id).toBe('%control')
    expect([...layout.panels.keys()]).toEqual(['main', 'logs'])
    expect(layout.panels.get('main')?.id).toBe('%1')
    expect(layout.panels.get('logs')?.id).toBe('%second')
    expect(calls()).toContainEqual(['split-window', '-t', '%1', '-h', '-P', '-F', '#{pane_id}', '-c', '/workspace logs'])
    expect(calls().at(-1)).toEqual(['select-pane', '-t', '%control'])
  })
})
