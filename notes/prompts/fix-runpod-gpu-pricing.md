# Fix RunPod GPU pricing in the runpod feature

`runpod.listSecureGPUs()` in `src/node/features/runpod.ts` returns no prices. It parses `runpodctl get cloud --secure`, which is deprecated in runpodctl 2.1.9 and now prints `Reserved` in every price column. The method drops every row containing `Reserved`, so only the header row is left, and it comes back as `{ gpuType: 'GPU TYPE', memory: NaN, ... }`. The table also wraps long GPU names onto a second line, which the parser does not handle.

RunPod's GraphQL API returns the real prices with the same API key:

```
POST https://api.runpod.io/graphql
Authorization: Bearer <RUNPOD_API_KEY>
{ "query": "{ gpuTypes { id displayName memoryInGb securePrice communityPrice secureSpotPrice communitySpotPrice } }" }
```

Checked on 2026-11-11: `NVIDIA RTX PRO 6000 Blackwell Server Edition` returns memoryInGb 96, securePrice 2.49, communityPrice 1.69, and both spot prices null.

## What to do

1. Add a method that lists GPU types with pricing from the GraphQL API, using the feature's existing API key and container clients (no new dependencies, no Node builtins). Return both Secure and Community prices, the spot prices (null when RunPod gives none), memory, and the RunPod GPU type id that `createPod` accepts. Use a clear name, for example `listGPUTypes()`, with an option to filter by cloud type.
2. Change `listSecureGPUs()` to use the new method, keep its return shape (`gpuType`, `memory`, `cpuCount`, `spotPrice`, `ondemandPrice`) so existing callers keep working, and drop the runpodctl dependency from it. Leave out GPUs that have no Secure price. If `cpuCount` is not in the GraphQL data, find the right field or return null, and document which.
3. Write JSDoc on both methods so `luca describe runpod` explains them accurately. Run `bun run src/cli/cli.ts introspect`, then check `bun run src/cli/cli.ts describe runpod.listSecureGPUs` and the new method.
4. Add or update tests in `test/runpod.test.ts` with a mocked GraphQL response. Do not make network calls in tests. Run `bun test test/runpod.test.ts`.
5. Do one real check with the key in the environment: `bun run src/cli/cli.ts eval "await container.feature('runpod').listSecureGPUs()"` must show real prices, including the RTX PRO 6000 rows.

## Rules

- Change only what this fix needs. Do not bump the version, publish, or push.
- Commit only the files you changed, with a message that explains why, on main.
- Report what changed, the test result, and the output of the real check.
