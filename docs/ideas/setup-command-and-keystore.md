# Luca Setup Command & Keystore

## Overview

`~/.luca` serves as the system-wide home directory for Luca. It stores encrypted API keys, global settings, and user-level extensions (assistants, commands). A `HomeFolder` feature provides `homeFolder.paths.resolve()` helpers, mirroring the project-level `container.paths.resolve` pattern.

## `luca setup` Command

Interactive command that initializes `~/.luca` and configures the keystore.

1. Ask the user for a **vault password** (used to derive the encryption key via scrypt/pbkdf2). Can also be supplied via `LUCA_VAULT_PASSWORD` env var for headless/CI use.
2. Prompt for API keys (all optional, user can skip any):
   - `OPENAI_API_KEY`
   - `ANTHROPIC_API_KEY`
   - `RUNPOD_API_TOKEN`
   - `NGROK_AUTH_TOKEN`
3. Store encrypted keys in `~/.luca/keystore` using `DiskCache` with `encrypt: true` and the password-derived secret.

The command should be **idempotent** — re-running it lets the user add, update, or remove keys without losing existing ones.

## CLI-Level Key Injection

The keystore is a **CLI-level concern only**. Individual features never interact with it directly.

Early in the `luca` CLI boot process (before any command runs), the CLI:

1. Checks if `~/.luca/keystore` exists
2. If it does, unlocks the vault (password from `LUCA_VAULT_PASSWORD` env var, or prompts interactively)
3. For each stored key, injects it into the process using `process.env.KEY ??= storedValue`

Because this uses `??=`, explicitly set env vars (from the shell, `.env` files, CI config) always take precedence. Features, clients, and scripts just read `process.env` as they normally would — zero changes needed downstream.

## Existing Infrastructure

The building blocks already exist:

- **`Vault` feature** — AES-256-GCM encryption/decryption with secret key management
- **`DiskCache` feature** — file-backed key-value store with `securely.get()` / `securely.set()` that delegates to Vault

The only addition needed is **password-to-secret derivation** (scrypt or pbkdf2) to convert the user's memorable password into the 32-byte Buffer that Vault expects.

## `~/.luca` Directory Structure

```
~/.luca/
  keystore/       # encrypted DiskCache for API keys
  assistants/     # global assistants (discovered by `luca chat`)
  commands/       # global commands (auto-scanned by CLI)
  config.json     # general settings (non-sensitive)
```

## HomeFolder Feature

A node feature that manages `~/.luca`:

- `homeFolder.paths.resolve(...)` — resolve paths relative to `~/.luca`
- Discovery of global assistants and commands, merged with project-local ones (local takes precedence)
- Initialization of the directory structure on first use
