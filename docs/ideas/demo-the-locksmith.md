# The Locksmith

A secrets management workflow built entirely on Luca's Vault, DiskCache, and FS features. Encrypt, store, retrieve, rotate, and audit secrets for your projects — all from the terminal, no external service required.

## The Demo

A CLI tool for managing project secrets:

1. `locksmith init` — creates an encrypted vault for the current project
2. `locksmith set DATABASE_URL "postgres://..."` — encrypts and stores a secret
3. `locksmith get DATABASE_URL` — decrypts and prints it
4. `locksmith env` — generates a `.env` file from all stored secrets (decrypted)
5. `locksmith rotate` — re-encrypts everything with a new key
6. `locksmith audit` — shows when each secret was last accessed/modified
7. `locksmith export --encrypted` — exports the vault for backup (stays encrypted)
8. `locksmith diff` — compares secrets between environments (dev vs staging vs prod)

Secrets never touch disk unencrypted. The audit trail lives in the DiskCache. Git integration ensures the encrypted vault is committed but `.env` files are always gitignored.

## What It Demonstrates

- The Vault feature's encryption/decryption capabilities
- DiskCache as an audit trail / metadata store
- FS for file I/O that respects security boundaries
- Git integration for safe secret management alongside code
- A practical, zero-dependency alternative to tools like `dotenv-vault` or `sops`

## Features Used

- `Vault` — encrypt, decrypt, secret storage
- `DiskCache` — audit log, metadata (last accessed, created date, environment tags)
- `FS` — reading/writing `.env` files, vault files, gitignore management
- `Git` — ensuring vault files are tracked, `.env` files are ignored
- `UI` — formatted secret tables, masked values, colored status indicators
- `YAML` — optional vault export format

## Key Moments

- Setting a secret and seeing the encrypted blob (no plaintext on disk)
- Running `locksmith env` and watching a `.env` file materialize
- The audit trail showing exactly when each secret was last touched
- Comparing dev vs prod secrets side by side with diffs highlighted
