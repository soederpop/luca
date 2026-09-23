// Runs in its own process: importing the web container replaces the node vault in the
// shared feature registry, which would break every other test in the same bun run.
import { WebContainer } from '../../src/web/container'

const { KEY, NODE_PAYLOAD } = process.env
const container = new WebContainer()
const results: Record<string, any> = {}

const attempt = async (fn: () => Promise<any>) => {
  try { return { ok: true, value: await fn() } } catch (e: any) { return { ok: false, error: e.message } }
}

const vault = container.feature('vault', { secret: KEY! })
results.roundTrip = await vault.decrypt(await vault.encrypt('🔐 café\n日本語'))
results.json = await vault.decryptJson(await vault.encryptJson({ a: [1, 2] }))
results.webPayload = await vault.encrypt('hi from web')
results.fromNode = await vault.decrypt(NODE_PAYLOAD!)

const other = container.feature('vault', { secret: vault.generateKey() })
results.wrongKey = await attempt(() => other.decrypt(results.webPayload))

const parts = results.webPayload.split(':')
parts[4] = (parts[4][0] === 'A' ? 'B' : 'A') + parts[4].slice(1)
results.tampered = await attempt(() => vault.decrypt(parts.join(':')))

results.noVaultId = await attempt(() => container.feature('vault').encrypt('x'))
results.noIndexedDb = await attempt(() => container.feature('vault', { vaultId: 'app-a' }).encrypt('x'))

const a1 = container.feature('vault', { vaultId: 'sync-a' })
const a2 = container.feature('vault', { vaultId: 'sync-a', dbName: 'second-instance' })
const b = container.feature('vault', { vaultId: 'sync-b' })
const fpA1 = await a1.unlock('correct horse')
const fpA2 = await a2.unlock('correct horse')
const fpB = await b.unlock('correct horse')
results.passphraseSameVault = fpA1 === fpA2 && (await a2.decrypt(await a1.encrypt('synced'))) === 'synced'
results.passphraseOtherVaultDiffers = fpA1 !== fpB
a1.lock()
results.lockedIsUnlocked = a1.isUnlocked

console.log(JSON.stringify(results))
