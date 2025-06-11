# Additional Node Feature Ideas

## Python VM

- Example instantiation `container.feature('python', { dir: "/path/to/python/project", installCommand?: "custom install command", contextScript: "/path/to/python-script-which-will-populate-locals })`
- If the project uses `uv` or `conda` or whatever, will make sure to use the right python
- `installDependencies` if no `installCommand` specified, method will do the right thing (e.g. if it is uv then `uv sync` otherwise pip install requirements )

## Secure Shell Feature ( Version 1 / shell wrapper )

- File already exists in src/node/features/secure-shell.ts
- Use the `container.feature('proc')` to implement the ssh / scp functionality via shell commands
- If possible, is there a way to keep the shell open and execute commands without the connection overhead?

## BUN Compatible REPL

- Existing src/node/features/repl.ts only works in node
- Can use our `container.feature('vm')`

