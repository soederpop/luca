# Luca Setup Command

We should use `~/.luca` as a store for system wide settings, and to contain a secured disk cache where we can store metadata like keys.  This representation of the home folder, should be a feature.  Just like container.paths.resolve we should have homeFolder.paths.resolve helpers

The luca setup command will ask the user for a password that they have to remember, which can be supplied by an environment variable, and will be used to unlock the vault.

It should ask for keys (all of them are optional)

- OPENAI_API_KEY
- CLAUDE_API_KEY
- RUNPOD_API_TOKEN
- NGROK_AUTH_TOKEN

It should also have an assistants folder that the `luca chat` command looks for, and a commands folder that it automatically scans for commands as well.