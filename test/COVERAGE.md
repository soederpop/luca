# Feature coverage work

Work lives on `codex/feature-test-coverage` in the separate `luca-tests` clone, based on `c3136f0`.

## Validation

- First batch: 77 new tests across six modules; 1,365 tests passing.
- Second batch: 222 new tests across 13 features; 1,587 tests passing, zero failures, 4,530 assertions.
- Bun all-files line coverage: 57.74% before either batch, 60.08% after the first, 65.69% after the second.
- Bun all-files function coverage after the second batch: 58.26%.
- Full suite command: `bun test --coverage` (about 54 seconds on this machine).
- Source and coverage-suite typecheck: `bun x --no-install tsc -p test/tsconfig.features.json --noEmit`.

The typecheck config retains the normal project source context and explicitly adds these coverage suites because the main tsconfig excludes test files.

## Second-batch line coverage

- `docker`: 16.26% → 92.36%.
- `google-auth`: 12.75% → 99.68%.
- `google-calendar`: 12.50% → 99.34%.
- `google-docs`: 8.62% → 99.59%.
- `google-drive`: 12.54% → 99.40%.
- `google-mail`: 12.94% → 99.67%.
- `google-sheets`: 15.35% → 99.32%.
- `process-manager`: 21.60% → 89.80%.
- `redis`: 22.91% → 98.94%.
- `runpod`: 3.48% → 94.42%.
- `telegram`: 22.58% → 98.72%.
- `tmux`: 8.52% → 98.61%.
- `tts`: 23.63% → 99.06%.

## Regressions exposed and fixed

1. Google Docs now forwards its supplied auth to Drive for list/search operations.
2. Drive browse returns the next-page token so callers can continue listing children.
3. Redis subscriber state waits for the actual connection event.
4. Redis unsubscribe with no channel arguments clears all local subscriptions and handlers.
5. Redis reuses Docker containers using the Docker feature’s singular name and human-readable status fields.
6. Runpod quotes apostrophes in remote download paths and URLs before encoding the command.
7. ProcessManager forwards per-process environment variables to the child process.
8. Google OAuth authorization clears its timeout on success, denial, exchange failure, and timeout.

Each fix has a regression assertion that failed before the implementation change.

## Test boundaries

- Google APIs: real SDK request construction with a fake auth transport; no account or remote API calls.
- Docker and launcher commands: process-boundary spies; no Docker daemon or tmux server required.
- Redis: real lazy ioredis clients with mocked command transport; subscriptions never connect to a server.
- Telegram: actual bot middleware with fake API responses; polling and webhook server startup are intercepted.
- Runpod: feature API transport and process spies; no cloud resources are provisioned. Remote download commands are inspected without execution.
- TTS: mocked fetch responses with exact binary files written to isolated temporary directories.
- ProcessManager: actual short-lived Bun child processes, streamed output, stdin, exit codes, termination, and cleanup.
- Filesystem fixtures use container paths and filesystem features, with unique temporary roots and teardown.

Coverage measures code exercised by Bun’s loaded-file instrumentation. It does not replace live integration tests or establish full branch coverage.

## Remaining priorities

- `telnyx-connector`: 9.40% line coverage.
- `repl`: 12.50% line coverage.
- `cipher-social`: 12.77% line coverage.
- `socket-repl`: 13.90% line coverage.
- `ui`: 23.72% line coverage.
- `os`: 26.42% line coverage.
- `ink`: 27.16% line coverage.
- `networking`: 29.35% line coverage.
- `content-db`: 33.23% line coverage.
- `git`: 43.91% line coverage.

These are measured gaps, not claims that the features have no tests. Several have narrow regression coverage but large unexercised surfaces.
