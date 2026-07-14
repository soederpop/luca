import { homedir } from 'node:os'
import { join } from 'node:path'

/**
 * The per-machine luca home directory (`~/.luca` by default).
 *
 * Holds user-global helpers, bundles, and the shared `node_modules` where
 * native addons that can't be compiled into the luca binary get installed
 * once per machine. Override with the `LUCA_HOME` environment variable.
 */
export function lucaHome(): string {
	return process.env.LUCA_HOME || join(homedir(), '.luca')
}

/** The shared per-machine node_modules directory under the luca home. */
export function lucaHomeNodeModules(): string {
	return join(lucaHome(), 'node_modules')
}
