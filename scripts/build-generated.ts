/**
 * Builds every git-ignored generated source file: introspection data,
 * scaffolds, bootstrap content, the python bridge, and the types bundle.
 *
 * A fresh clone has none of these files, but the CLI that produces them
 * imports them at startup. So we first write an empty stub for each missing
 * file, then run the real builds, which overwrite the stubs.
 *
 * This script uses Bun globals instead of the container on purpose: importing
 * NodeContainer pulls in features that import these very files, so no
 * container can exist until the stubs are written.
 *
 * The feature barrels (src/node/features.generated.ts and
 * src/agi/features.generated.ts) stay in git for the same reason: the barrel
 * generator boots NodeContainer, which needs them.
 *
 * Runs from `prepare` (every bun install), `prepack`, `compile`, CI, and the
 * release flow.
 */

const STUB_HEADER = '// Stub written by scripts/build-generated.ts. The real build overwrites it.\n'

const introspectionStub = `${STUB_HEADER}export const introspectionData: Record<string, any>[] = []
export const containerIntrospectionData: Record<string, any>[] = []
`

const stubs: Record<string, string> = {
  'src/introspection/generated.node.ts': introspectionStub,
  'src/introspection/generated.agi.ts': introspectionStub,
  'src/introspection/generated.web.ts': introspectionStub,
  'src/scaffolds/generated.ts': `${STUB_HEADER}export interface ScaffoldSection {
  heading: string
  code: string
}

export interface ScaffoldData {
  sections: ScaffoldSection[]
  full: string
  tutorial: string
}

export const scaffolds: Record<string, ScaffoldData> = {}
export const assistantFiles: Record<string, string> = {}
export const mcpReadme = ''
`,
  'src/bootstrap/generated.ts': `${STUB_HEADER}export const bootstrapFiles: Record<string, string> = {}
export const bootstrapTemplates: Record<string, string> = {}
export const bootstrapExamples: Record<string, string> = {}
export const bootstrapTutorials: Record<string, string> = {}
export const bootstrapReferences: Record<string, string> = {}
`,
  'src/python/generated.ts': `${STUB_HEADER}export const bridgeScript = ''
`,
  'src/setup/generated-types.ts': `${STUB_HEADER}export const typesBundleVersion = ''
export const typesBundle: Record<string, string> = {}
`,
}

// Order matters: introspection first (later steps run the CLI, which reads
// it), types bundle last (it compiles declarations for everything above).
const steps = [
  'build:introspection',
  'build:scaffolds',
  'build:bootstrap',
  'build:python-bridge',
  'build:types-bundle',
]

// import.meta.dir, not URL.pathname: the latter yields "/D:/..." on Windows.
const root = `${import.meta.dir}/../`

for (const [relativePath, contents] of Object.entries(stubs)) {
  const file = Bun.file(root + relativePath)
  if (!(await file.exists())) {
    await Bun.write(file, contents)
    console.log(`stubbed ${relativePath}`)
  }
}

for (const step of steps) {
  const started = Date.now()
  const result = Bun.spawnSync(['bun', 'run', step], {
    cwd: root,
    stdout: 'ignore',
    stderr: 'inherit',
  })
  if (result.exitCode !== 0) {
    console.error(`build-generated: ${step} failed (exit ${result.exitCode})`)
    process.exit(result.exitCode ?? 1)
  }
  console.log(`${step} ok (${((Date.now() - started) / 1000).toFixed(1)}s)`)
}
