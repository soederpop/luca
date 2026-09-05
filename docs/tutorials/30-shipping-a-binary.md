# Ship and verify a standalone binary

Use `luca bundle` when a project should run as its own executable. For embedding the package into an existing application, see [embedding Luca](21-embedding-luca.md).

## Choose the runtime and command surface

```sh
luca bundle --help
luca bundle workshop --targets darwin-arm64,linux-x64 --builtins eval,describe
```

The default target is darwin-arm64; choose explicit targets for the machines you support. `--runtime` controls the Luca package used to build: `auto` uses the local checkout when available and otherwise the latest published package. Pin a package version for reproducible release builds.

Built-in commands are opt-in through `--builtins`; `run` is always present, and bundled assistants imply `chat` and `assistant`. Include `eval` and `describe` if consumers need runtime exploration. Review that choice as part of the product's command surface.

`--dryRun` generates the bundle project without installing or compiling it. Inspect that output before a release when changing discovery, imports, or bundled assets.

## Verify the compiled artifact outside the source project

After compilation, confirm the expected `dist/<name>-<platform>` artifact exists. Run the target that matches your machine, using an absolute binary path from a fresh directory outside the checkout:

```sh
/path/to/project/dist/workshop-darwin-arm64 --help
/path/to/project/dist/workshop-darwin-arm64 your-command --help
/path/to/project/dist/workshop-darwin-arm64 your-command
/path/to/project/dist/workshop-darwin-arm64 describe yourFeature
```

Replace command/helper placeholders with your project's actual names. The last command requires `--builtins describe`. Exercise at least one real behavior and failure path; help output only verifies dispatch and metadata. Test other targets on their native platform or appropriate CI runner.

Check that commands, features, routes, selectors, and required assets work without your source folders or local node_modules. For services, start the binary, verify a request, then stop it and confirm listener cleanup. Supply test configuration explicitly: a fresh cwd still shares machine-level Luca configuration and external services.

Bundled assistants are materialized under `~/.luca/bundles/<name>/assistants`. Editing source assistant files does not update an already compiled binary; rebuild and verify the new artifact.
