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
})
