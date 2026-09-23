---
title: 'Vault as a Secrets Manager: a 1Password-style workflow for env secrets'
tags:
  - vault
  - secrets
  - encryption
  - env
  - proc
  - fs
  - composition
---

# Vault as a Secrets Manager: a 1Password-style workflow for env secrets

1Password (and its `op` CLI) gives you three things: a **master key** that unlocks everything, a set of **encrypted items** you can safely sync, and **`op run`**, which starts a program with the secrets injected as environment variables so they never touch a `.env` file.

The `vault` feature is only the crypto (AES-256-GCM `encrypt()` / `decrypt()`). This doc adds the other two parts from container primitives:

- **Master key** — one base64 key in a file outside the repo (`~/.luca/vault.key`, mode `600`), or in the `LUCA_VAULT_KEY` env var for CI.
- **Encrypted items** — `secrets.enc.json` in the repo. Names are plaintext (so diffs are readable), values are ciphertext. Safe to commit.
- **`op run`** — decrypt in memory, pass the values to a child process through `proc.spawnAndCapture(..., { environment })`.

Two rules to remember:

- **The vault does not save its key.** Without a `secret` option, every process mints a new random key, and anything it encrypted is lost when it exits. The whole "unlock" step below exists to fix that.
- **`container.feature('vault')` is cached by its options.** Calling it twice with no options returns the *same* instance and the same key. To get a genuinely new key (first run, rotation), generate the bytes yourself and pass them as `secret`.

## Unlock: load the master key, or create it once

Resolution order, same as most secret tools: env var first (CI, containers), then the key file, then create a new key file. The demo points at a temp folder; a real setup uses `os.homedir`.

```ts
demoDir = container.paths.resolve(os.tmpdir, `vault-demo-${Date.now()}`)
fs.ensureFolder(demoDir)

keyPath = container.paths.resolve(demoDir, 'vault.key')          // real: ~/.luca/vault.key
secretsPath = container.paths.resolve(demoDir, 'secrets.enc.json') // real: <project>/secrets.enc.json

// 32 random bytes as base64. Always pass keys explicitly, never rely on the vault minting one.
newKey = () => Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64')

unlock = () => {
  const fromEnv = process.env.LUCA_VAULT_KEY
  if (fromEnv) return container.feature('vault', { secret: fromEnv })

  if (fs.exists(keyPath)) {
    return container.feature('vault', { secret: String(fs.readFile(keyPath)).trim() })
  }

  // First run: mint a key and save it before encrypting anything with it.
  const key = newKey()
  fs.writeFile(keyPath, key)
  // The fs feature has no chmod, so shell out. Owner read/write only, like ~/.ssh keys.
  proc.execSync(`chmod 600 ${JSON.stringify(keyPath)}`)
  return container.feature('vault', { secret: key })
}

vault = unlock()
console.log('key file created:', fs.exists(keyPath))
console.log('key mode:', proc.execSync(`stat -f %Lp ${JSON.stringify(keyPath)} 2>/dev/null || stat -c %a ${JSON.stringify(keyPath)}`))
```

## Items: set, get, list

The secrets file is a flat `{ NAME: ciphertext }` map. Each `encrypt()` call uses a fresh random IV, so re-saving the same value still changes the ciphertext. That is expected, and it means nobody can tell from the file which two secrets are equal.

```ts
readItems = () => (fs.exists(secretsPath) ? fs.readJson(secretsPath) : {})

setSecret = (name, value) => {
  const items = readItems()
  items[name] = vault.encrypt(value)
  fs.writeJson(secretsPath, items)
}

getSecret = (name) => {
  const items = readItems()
  if (!(name in items)) throw new Error(`no secret named ${name}`)
  return vault.decrypt(items[name])
}

listSecrets = () => Object.keys(readItems()).sort()

setSecret('DATABASE_URL', 'postgres://app:hunter2@db.internal:5432/app')
setSecret('STRIPE_SECRET_KEY', 'sk_live_51Hdemo000000000')
setSecret('OPENAI_API_KEY', 'sk-proj-demo-000000')

console.log('items:', listSecrets().join(', '))
if (getSecret('STRIPE_SECRET_KEY') !== 'sk_live_51Hdemo000000000') throw new Error('round-trip failed')
```

## The file is safe to commit

No plaintext value appears anywhere in the file. Only the names do.

```ts
const onDisk = String(fs.readFile(secretsPath))
console.log(onDisk)

for (const leaked of ['hunter2', 'sk_live_51Hdemo', 'sk-proj-demo']) {
  if (onDisk.includes(leaked)) throw new Error(`plaintext leaked into secrets file: ${leaked}`)
}
console.log('no plaintext values in secrets.enc.json')
```

## `op run`: inject secrets into a child process

This is the part that replaces `.env` files. Decrypt everything in memory, hand it to the child as its environment, and the values never hit disk. `spawnAndCapture` merges `environment` on top of the parent's `process.env`.

```ts
runWithSecrets = async (command, args) => {
  const items = readItems()
  const environment = Object.fromEntries(
    Object.entries(items).map(([name, payload]) => [name, vault.decrypt(payload)]),
  )
  return proc.spawnAndCapture(command, args, { environment })
}

// The child proves it got the values without printing them
const child = await runWithSecrets('sh', ['-c', 'echo "DATABASE_URL has ${#DATABASE_URL} chars"; test -n "$STRIPE_SECRET_KEY" && echo STRIPE_OK'])

if (child.exitCode !== 0) throw new Error(`child failed: ${child.stderr}`)
if (!child.stdout.includes('STRIPE_OK')) throw new Error('child did not receive STRIPE_SECRET_KEY')
console.log(child.stdout.trim())
```

In real use the command is your app: `runWithSecrets('bun', ['run', 'server.ts'])`.

## Prove it: a fresh process unlocks with the same key

The key file is what makes this work across runs. A brand-new `luca eval` process, which shares no memory with this one, reads the key and decrypts an item.

```ts
const devCli = container.paths.resolve('src', 'cli', 'cli.ts')
const [cmd, baseArgs] = fs.exists(devCli) ? ['bun', ['run', devCli, 'eval']] : ['luca', ['eval']]

const expr = `
  const key = String(container.fs.readFile(${JSON.stringify(keyPath)})).trim()
  const v = container.feature('vault', { secret: key })
  const items = container.fs.readJson(${JSON.stringify(secretsPath)})
  console.log('CHILD_OK=' + (v.decrypt(items.OPENAI_API_KEY) === 'sk-proj-demo-000000'))
`
const fresh = await proc.spawnAndCapture(cmd, [...baseArgs, expr])

if (!fresh.stdout.includes('CHILD_OK=true')) throw new Error(`fresh process could not decrypt: ${fresh.stderr.slice(-300)}`)
console.log('fresh process decrypted OPENAI_API_KEY with the saved key')
```

The same child with the key passed through `LUCA_VAULT_KEY` is how CI works: store the base64 key as one CI secret, commit `secrets.enc.json`, done.

## Wrong key or tampered file: decrypt throws

GCM is authenticated encryption. A wrong key or a changed byte fails loudly. You never get silent garbage in your env.

```ts
const stranger = container.feature('vault', { secret: newKey() }) // a different key
let wrongKeyThrew = false
try { stranger.decrypt(readItems().DATABASE_URL) } catch { wrongKeyThrew = true }
if (!wrongKeyThrew) throw new Error('wrong key should throw')

const items = readItems()
const payload = items.DATABASE_URL
const flipped = payload.slice(0, 5) + (payload[5] === 'A' ? 'B' : 'A') + payload.slice(6)
let tamperThrew = false
try { vault.decrypt(flipped) } catch { tamperThrew = true }
if (!tamperThrew) throw new Error('tampered payload should throw')

console.log('wrong key threw:', wrongKeyThrew, '| tampered payload threw:', tamperThrew)
```

## Rotate the master key

If the key leaks, rotate it: decrypt every item with the old key, encrypt it with a new one, then replace the key file. Write the new secrets file **before** the new key, so a crash in between leaves you with the old key and old file still matching.

```ts
const oldVault = vault
const nextKey = newKey()
const newVault = container.feature('vault', { secret: nextKey })

const rotated = Object.fromEntries(
  Object.entries(readItems()).map(([name, payload]) => [name, newVault.encrypt(oldVault.decrypt(payload))]),
)
fs.writeJson(secretsPath, rotated)
fs.writeFile(keyPath, nextKey)
vault = newVault

let oldKeyThrew = false
try { oldVault.decrypt(readItems().DATABASE_URL) } catch { oldKeyThrew = true }
if (!oldKeyThrew) throw new Error('old key should no longer decrypt')
if (getSecret('DATABASE_URL') !== 'postgres://app:hunter2@db.internal:5432/app') throw new Error('rotation lost a value')
console.log('rotated: old key rejected, all items readable with the new key')
```

A caution: rotation does not help with values that already leaked. If someone had the old key, rotate the actual API keys at the provider too.

## Cleanup

```ts
await fs.rm(demoDir, { recursive: true, force: true })
console.log('demo folder removed')
```

## Where to put the key: tradeoffs

- **Key file (`~/.luca/vault.key`, mode 600)** — simplest, works everywhere. Anyone who can read your home folder can read it, same as `~/.ssh/id_ed25519`.
- **macOS Keychain** — closer to 1Password's "unlock" feel. Store with `security add-generic-password -a "$USER" -s luca-vault -w <base64key>` and read with `proc.execSync('security find-generic-password -a "$USER" -s luca-vault -w')`, then pass the result as `secret`. macOS may prompt to allow access.
- **`LUCA_VAULT_KEY` env var** — for CI and containers. Put the base64 key in the CI provider's secret store.

Never commit the key, and never put it in the same place as `secrets.enc.json`. The ciphertext is only as safe as the key is separate.

## Turning this into a command

To use this every day, wrap the helpers above in a project command with subcommands `set`, `get`, `list`, `run`, and `rotate` (see `luca scaffold command --tutorial`). The shape:

```ts skip
// commands/secrets.ts
export const positionals = ['action', '...rest']
export const subcommands = {
  set: { args: '<NAME> <value>', description: 'Encrypt and store a secret' },
  get: { args: '<NAME>', description: 'Print one decrypted secret' },
  list: { description: 'List secret names (never values)' },
  run: { args: '-- <command...>', description: 'Run a command with all secrets in its env' },
  rotate: { description: 'Re-encrypt every secret with a new master key' },
}
```

Then `luca secrets run -- bun run server.ts` is your `op run -- bun run server.ts`.
