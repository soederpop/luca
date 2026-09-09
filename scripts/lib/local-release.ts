const REGISTRY = 'https://registry.npmjs.org/'
const ASSETS = ['luca-linux-x64', 'luca-linux-arm64', 'luca-darwin-x64', 'luca-darwin-arm64', 'luca-windows-x64.exe']

export interface ReleaseWaitOptions {
  /** Maximum readiness wait in seconds; defaults to 30 minutes. */
  waitTimeout?: number
  /** Time between readiness checks in seconds; defaults to 15. */
  pollInterval?: number
}

/** Publish a tested tag from an isolated source snapshot, then promote its GitHub release. */
export async function publishRelease(container: any, tag: string, dryRun = false, wait: ReleaseWaitOptions = {}) {
  if (!/^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(tag)) throw new Error('Expected a version tag such as v3.12.1')
  const timeout = wait.waitTimeout ?? 1800
  const interval = wait.pollInterval ?? 15
  if (!Number.isFinite(timeout) || timeout < 0 || !Number.isFinite(interval) || interval <= 0) throw new Error('Invalid release wait settings')
  const fs = container.feature('fs')
  const proc = container.feature('proc')
  const token = process.env.NPM_TOKEN
  const redact = (text: string) => token ? text.split(token).join('[REDACTED]') : text
  const run = async (command: string, args: string[], options: any = {}) => {
    const result = await proc.spawnAndCapture(command, args, options)
    if (result.exitCode !== 0 || result.error) {
      const detail = redact(result.stderr || result.stdout || 'Unable to start command')
      throw Object.assign(new Error(`${command} ${args[0]} failed: ${detail}`), {
        retryable: /HTTP (404|429|5\d\d)|release not found|couldn't find remote ref|error connecting to|could not resolve host|connection (?:reset|refused)|timed? out|TLS handshake timeout|rate limit exceeded/i.test(detail),
      })
    }
    return result.stdout.trim()
  }
  const started = Date.now()
  const deadline = started + timeout * 1000
  let sha = ''
  let repo = ''
  let release: any
  while (true) {
    let pending = ''
    try {
      if (!repo) repo = JSON.parse(await run('gh', ['repo', 'view', '--json', 'nameWithOwner'])).nameWithOwner
      if (!sha) {
        const local = await proc.spawnAndCapture('git', ['show-ref', '--verify', '--quiet', `refs/tags/${tag}`])
        if (local.exitCode === 1) {
          await run('git', ['fetch', '--no-tags', 'origin', `refs/tags/${tag}:refs/tags/${tag}`])
        } else if (local.exitCode !== 0 || local.error) {
          throw new Error('Unable to inspect local git tags')
        }
        sha = await run('git', ['rev-parse', '--verify', `${tag}^{commit}`])
      }
      const remote = JSON.parse(await run('gh', ['api', `repos/${repo}/commits/${tag}`]))
      if (remote.sha !== sha) throw new Error('Local and GitHub tags point to different commits')
      const runs = JSON.parse(await run('gh', ['run', 'list', '--repo', repo, '--workflow', 'release.yaml', '--branch', tag,
        '--commit', sha, '--event', 'push', '--limit', '1', '--json', 'status,conclusion,headSha']))
      const latest = runs[0]
      if (!latest) pending = 'waiting for the Release workflow to appear'
      else {
        if (latest.headSha !== sha) throw new Error('Release workflow commit does not match the tag')
        if (latest.status !== 'completed') pending = `Release workflow is ${latest.status}`
        else if (latest.conclusion !== 'success') throw new Error(`Release workflow for ${tag} ended with ${latest.conclusion}; fix or rerun it before publishing`)
        else {
          release = JSON.parse(await run('gh', ['release', 'view', tag, '--repo', repo, '--json', 'tagName,isPrerelease,assets']))
          if (release.tagName !== tag) throw new Error('GitHub release tag does not match')
          const missing = ASSETS.filter(name => !release.assets.some((asset: any) => asset.name === name && asset.size > 0))
          if (missing.length) pending = `waiting for binary uploads: ${missing.join(', ')}`
        }
      }
    } catch (error: any) {
      if (!error.retryable) throw error
      pending = error.message
    }
    if (!pending) break
    const remaining = deadline - Date.now()
    if (remaining <= 0) throw new Error(`Timed out waiting for ${tag}: ${pending}. Rerun luca release ${tag} to resume, or increase --wait-timeout.`)
    const delay = Math.min(interval * 1000, remaining)
    console.log(`→ ${tag}: ${pending} (${Math.round((Date.now() - started) / 1000)}s elapsed; retry in ${delay / 1000}s)`)
    await new Promise(resolve => setTimeout(resolve, delay))
  }
  const prerelease = tag.includes('-')
  if (!prerelease && release.isPrerelease) throw new Error('A stable version tag is marked as a GitHub prerelease')
  const distTag = prerelease ? 'next' : 'latest'
  const scratch = container.paths.resolve(container.os.tmpdir(), `luca-release-${container.utils.uuid()}`)
  const source = container.paths.resolve(scratch, 'source')
  fs.ensureFolder(source)
  try {
    const archive = container.paths.resolve(scratch, 'source.tar')
    await run('git', ['archive', '--format=tar', `--output=${archive}`, sha])
    await run('tar', ['-xf', archive, '-C', source])
    const pkg = fs.readJson(container.paths.resolve(source, 'package.json'))
    if (pkg.name !== 'luca' || `v${pkg.version}` !== tag) throw new Error('Tag must match the Luca package version')
    const buildOptions = { cwd: source, environment: { NPM_TOKEN: '', NODE_AUTH_TOKEN: '' } }
    console.log(`→ Installing, testing, and building ${tag} in an isolated directory`)
    await run('bun', ['install', '--frozen-lockfile'], buildOptions)
    await run('bun', ['run', 'test'], buildOptions)
    await run('bun', ['run', 'typecheck'], buildOptions)
    await run('bun', ['run', 'build:types'], buildOptions)
    const packs = JSON.parse(await run('npm', ['pack', '--json', '--ignore-scripts', '--pack-destination', scratch], buildOptions))
    const pack = packs[0]
    if (packs.length !== 1 || pack.name !== pkg.name || pack.version !== pkg.version || !pack.integrity
      || !pack.files.some((file: any) => file.path === 'dist/node.d.ts')) throw new Error('Invalid npm package output')
    const tarball = container.paths.resolve(scratch, pack.filename)
    // Only a placeholder is written; the token stays in the npm child environment.
    const npmOptions: any = { cwd: scratch, environment: {} }
    if (token) {
      const userconfig = container.paths.resolve(scratch, 'npmrc')
      fs.writeFile(userconfig, '//registry.npmjs.org/:_authToken=${NPM_TOKEN}\n')
      npmOptions.environment = { NPM_CONFIG_USERCONFIG: userconfig, NPM_TOKEN: token }
    }
    const spec = `${pkg.name}@${pkg.version}`
    const published = await proc.spawnAndCapture('npm', ['view', spec, 'dist.integrity', '--json', '--registry', REGISTRY], npmOptions)
    if (published.exitCode !== 0 || published.error) {
      let error: any
      try { error = JSON.parse(published.stdout || published.stderr).error } catch {}
      if (error?.code !== 'E404') throw new Error(redact(`Unable to check npm version: ${published.stderr || published.stdout}`))
    } else if (JSON.parse(published.stdout) !== pack.integrity) {
      throw new Error(`${spec} already exists with different package contents; refusing to promote it`)
    }
    const exists = published.exitCode === 0 && !published.error
    console.log(`→ ${exists ? 'Verify existing' : 'Publish'} ${spec} (${distTag}), then ${prerelease ? 'publish prerelease' : 'mark GitHub release latest'}`)
    if (dryRun) {
      console.log('Dry run complete. Nothing was published or promoted.')
      return
    }
    await run('npm', ['whoami', '--registry', REGISTRY], npmOptions)
    if (!exists) await run('npm', ['publish', tarball, '--access', 'public', '--tag', distTag, '--ignore-scripts', '--registry', REGISTRY], npmOptions)
    const integrity = JSON.parse(await run('npm', ['view', spec, 'dist.integrity', '--json', '--registry', REGISTRY], npmOptions))
    if (integrity !== pack.integrity) throw new Error('Published npm integrity does not match; GitHub release was not promoted')
    if (exists) await run('npm', ['dist-tag', 'add', spec, distTag, '--registry', REGISTRY], npmOptions)
    await run('gh', ['release', 'edit', tag, '--repo', repo, '--draft=false', `--prerelease=${prerelease}`, `--latest=${!prerelease}`, '--verify-tag'])
    console.log(`✓ Published ${spec}: https://github.com/${repo}/releases/tag/${tag}`)
  } finally {
    await fs.remove(scratch)
  }
}
