// @ts-nocheck
// Builds the self-contained browser bundle at dist/browser.mjs.
//
// The package.json "browser" field and "./web" export point at this artifact,
// so CDNs like esm.sh serve a prebuilt ESM file instead of compiling the TS
// source on the fly. Compiling on the fly was fragile two ways: per-module ESM
// cannot use the require() tricks node tolerates, and esm.sh's ?bundle mode
// deduped our zod v4 onto a transitive zod v3, breaking z.looseObject.
// Bundling here means zod is compiled in and the file has no bare imports.
import path from "path"

const result = await Bun.build({
  entrypoints: [path.resolve(import.meta.dir, "../src/browser.ts")],
  outdir: path.resolve(import.meta.dir, "../dist"),
  target: "browser",
  format: "esm",
  naming: "browser.mjs",
  external: [
    "react",
    "react-dom",
  ],
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
    "process.env.NODE_DEBUG": JSON.stringify(""),
  },
})

if (!result.success) {
  console.error("Build failed:")
  for (const log of result.logs) {
    console.error(log)
  }
  process.exit(1)
}

console.log(`Built browser bundle: dist/browser.mjs (${(result.outputs[0].size / 1024).toFixed(1)}KB)`)
