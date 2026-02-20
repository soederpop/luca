// @ts-nocheck
import path from "path"

const result = await Bun.build({
  entrypoints: [path.resolve(import.meta.dir, "../src/browser.ts")],
  outdir: path.resolve(import.meta.dir, "../dist"),
  target: "browser",
  format: "esm",
  naming: "browser.js",
  external: [
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

console.log(`Built browser bundle: dist/browser.js (${(result.outputs[0].size / 1024).toFixed(1)}KB)`)
