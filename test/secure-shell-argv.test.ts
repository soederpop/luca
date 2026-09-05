import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { NodeContainer } from '../src/node/container'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, chmodSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

/**
 * Tests that secureShell builds argv arrays instead of interpolating through
 * the local shell.
 *
 * Old behavior: exec() ran `sh -c 'ssh ... "<command>"'`, so $VARS, backticks,
 * and $(...) expanded LOCALLY before ssh ever ran; upload/download went through
 * execAndCapture's naive space-split, mangling any path with a space.
 *
 * The tests point the feature at fake `ssh` and `scp` binaries that print each
 * argv element on its own line, so we can assert exactly what reached execve.
 * (Injecting via PATH doesn't work here: Bun does not propagate process.env
 * mutations to child processes, so we set the resolved binary paths directly.)
 */

let fakeBinDir: string

// Prints one argv element per line
const ARGV_ECHO = '#!/bin/sh\nfor a in "$@"; do printf \'%s\\n\' "$a"; done\n'

beforeAll(() => {
	fakeBinDir = mkdtempSync(join(tmpdir(), 'luca-fakebin-'))
	writeFileSync(join(fakeBinDir, 'ssh'), ARGV_ECHO)
	writeFileSync(join(fakeBinDir, 'scp'), ARGV_ECHO)
	chmodSync(join(fakeBinDir, 'ssh'), 0o755)
	chmodSync(join(fakeBinDir, 'scp'), 0o755)
})

afterAll(() => {
	rmSync(fakeBinDir, { recursive: true, force: true })
})

function shimBinaries(ssh: any) {
	ssh._resolvedSshPath = join(fakeBinDir, 'ssh')
	ssh._resolvedScpPath = join(fakeBinDir, 'scp')
	return ssh
}

function makeShell() {
	// Fresh container per call so nothing is cached across unrelated tests
	const container = new NodeContainer()
	return shimBinaries(container.feature('secureShell', {
		host: 'example.test',
		port: 2222,
		username: 'deploy',
		key: '/keys/id_test',
	}))
}

describe('secureShell.exec argv construction', () => {
	it('passes flags, destination, and command as discrete argv elements', async () => {
		const ssh = makeShell()
		const output = await ssh.exec('uptime')
		const argv = output.split('\n')
		expect(argv).toEqual([
			'-p', '2222',
			'-i', '/keys/id_test',
			'-o', 'BatchMode=yes',
			'-o', 'StrictHostKeyChecking=no',
			'deploy@example.test',
			'uptime',
		])
	})

	it('delivers the command string verbatim — no local shell interpolation', async () => {
		const ssh = makeShell()
		// If this went through a local shell, $TMPDIR, the backticks, and the
		// double quotes would all be consumed locally before reaching ssh
		const command = 'rm -rf "$TMPDIR/build" && echo `hostname`'
		const output = await ssh.exec(command)
		const argv = output.split('\n')
		expect(argv[argv.length - 1]).toBe(command)
	})

	// Regression for issue #1: `test "$(...)" = "..."` used to be wrapped in a
	// second pair of double quotes for the LOCAL shell, so the embedded quotes
	// collided and zsh reported `parse error: condition expected: =`
	it('delivers an embedded $(...) comparison intact (issue #1)', async () => {
		const ssh = makeShell()
		const command = 'test "$(git --git-dir=/home/ubuntu/some.git rev-parse main)" = "abc123"'
		const output = await ssh.exec(command)
		const argv = output.split('\n')
		expect(argv[argv.length - 1]).toBe(command)
		// the whole command is ONE argv element — nothing was split or expanded
		expect(argv.length).toBe(10)
	})

	it('marks connected on success', async () => {
		const ssh = makeShell()
		await ssh.exec('true')
		expect(ssh.state.get('connected')).toBe(true)
	})
})

describe('secureShell scp argv construction', () => {
	it('upload passes local paths with spaces as single argv elements', async () => {
		const ssh = makeShell()
		const output = await ssh.upload('/local/My Documents/app.tar.gz', '/remote/releases dir/app.tar.gz')
		const argv = output.split('\n')
		expect(argv).toEqual([
			'-P', '2222',
			'-i', '/keys/id_test',
			'-o', 'BatchMode=yes',
			'-o', 'StrictHostKeyChecking=no',
			'/local/My Documents/app.tar.gz',
			'deploy@example.test:/remote/releases dir/app.tar.gz',
		])
	})

	it('download passes remote source and local target intact', async () => {
		const ssh = makeShell()
		const output = await ssh.download('/var/log/app log.txt', '/local/logs dir/app.log')
		const argv = output.split('\n')
		expect(argv).toEqual([
			'-P', '2222',
			'-i', '/keys/id_test',
			'-o', 'BatchMode=yes',
			'-o', 'StrictHostKeyChecking=no',
			'deploy@example.test:/var/log/app log.txt',
			'/local/logs dir/app.log',
		])
	})

	it('omits -i when no key is configured', async () => {
		const container = new NodeContainer()
		const ssh = shimBinaries(container.feature('secureShell', {
			host: 'example.test',
			username: 'deploy',
		}))
		const output = await ssh.exec('true')
		const argv = output.split('\n')
		expect(argv).not.toContain('-i')
		expect(argv[0]).toBe('-p')
		expect(argv[1]).toBe('22') // default port
	})

	it('omits user@ when no username is configured', async () => {
		const container = new NodeContainer()
		const ssh = shimBinaries(container.feature('secureShell', { host: 'example.test' }))
		const output = await ssh.exec('true')
		const argv = output.split('\n')
		expect(argv[argv.length - 2]).toBe('example.test')
	})
})

describe('secureShell ssh config parsing and host switching', () => {
	let configDir: string
	let configPath: string

	beforeAll(() => {
		configDir = mkdtempSync(join(tmpdir(), 'luca-sshconf-'))
		mkdirSync(join(configDir, 'config.d'))
		writeFileSync(join(configDir, 'config.d', 'extra.conf'), 'Host extra\n  HostName extra.internal\n')
		writeFileSync(join(configDir, 'config'), [
			'Include config.d/*.conf',
			'',
			'# a comment',
			'Host chief',
			'  HostName 10.0.0.5',
			'  User jon',
			'  Port 2200',
			'  IdentityFile ~/.ssh/id_chief',
			'',
			'Host web1 web2',
			'  User deploy',
			'',
			'Host *',
			'  ServerAliveInterval 60',
		].join('\n'))
	})

	afterAll(() => {
		rmSync(configDir, { recursive: true, force: true })
	})

	function makeConfigShell(options: Record<string, unknown> = {}) {
		const container = new NodeContainer()
		return shimBinaries(container.feature('secureShell', {
			configPath: join(configDir, 'config'),
			...options,
		}))
	}

	it('parses Host entries, follows Include globs, and skips wildcard patterns', () => {
		const ssh = makeConfigShell()
		const hosts = ssh.hosts
		expect(hosts.map((h: any) => h.host)).toEqual(['extra', 'chief', 'web1', 'web2'])
		const chief = hosts.find((h: any) => h.host === 'chief')
		expect(chief).toEqual({ host: 'chief', hostname: '10.0.0.5', user: 'jon', port: 2200, identityFile: '~/.ssh/id_chief' })
		// multi-alias blocks share their directives
		expect(hosts.find((h: any) => h.host === 'web2')?.user).toBe('deploy')
	})

	it('can be created with no host, and exec fails with a helpful error until one is selected', async () => {
		const ssh = makeConfigShell()
		expect(ssh.state.get('currentHost')).toBeUndefined()
		await expect(ssh.exec('true')).rejects.toThrow(/no host selected/)
	})

	it('useHost with a config alias passes only the alias — ssh config resolves the rest', async () => {
		const ssh = makeConfigShell()
		ssh.useHost('chief')
		expect(ssh.state.get('currentHost')).toBe('chief')
		const output = await ssh.exec('uptime')
		expect(output.split('\n')).toEqual([
			'-o', 'BatchMode=yes',
			'-o', 'StrictHostKeyChecking=no',
			'chief',
			'uptime',
		])
	})

	it('useHost with a config alias applies to scp transfers too', async () => {
		const ssh = makeConfigShell()
		ssh.useHost('chief')
		const output = await ssh.download('/var/log/app.log', '/local/app.log')
		expect(output.split('\n')).toEqual([
			'-o', 'BatchMode=yes',
			'-o', 'StrictHostKeyChecking=no',
			'chief:/var/log/app.log',
			'/local/app.log',
		])
	})

	it('useHost with a literal user@host keeps the feature key/port options as defaults', async () => {
		const ssh = makeConfigShell({ port: 2222, key: '/keys/id_test' })
		ssh.useHost('deploy@192.168.1.50')
		expect(ssh.state.get('currentHost')).toBe('deploy@192.168.1.50')
		const output = await ssh.exec('true')
		expect(output.split('\n')).toEqual([
			'-p', '2222',
			'-i', '/keys/id_test',
			'-o', 'BatchMode=yes',
			'-o', 'StrictHostKeyChecking=no',
			'deploy@192.168.1.50',
			'true',
		])
	})

	it('useHost can switch away from an options-configured host at any time', async () => {
		const ssh = makeConfigShell({ host: 'example.test', username: 'deploy' })
		expect(ssh.state.get('currentHost')).toBe('example.test')
		ssh.useHost('chief')
		const output = await ssh.exec('true')
		expect(output.split('\n')).toContain('chief')
		expect(output.split('\n')).not.toContain('deploy@example.test')
	})
})
