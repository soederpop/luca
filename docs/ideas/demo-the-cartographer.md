# The Cartographer

A monorepo exploration and analysis tool. Point it at any JavaScript/TypeScript monorepo and it maps the entire territory: package dependency graphs, cross-package imports, circular dependencies, code hotspots, and dead packages. Outputs interactive reports to the terminal.

## The Demo

Run `cartographer scan` at the root of a monorepo:

1. PackageFinder discovers all packages, workspaces, scopes
2. FileManager scans every source file
3. Grep traces import/require statements across package boundaries
4. Git blame identifies code hotspots (most frequently changed files)
5. The analysis runs:
   - **Dependency graph:** which packages depend on which (with depth)
   - **Circular dependencies:** flagged in red with the exact cycle path
   - **Orphan packages:** packages nothing depends on (candidates for removal)
   - **Duplicate dependencies:** same package at different versions across workspaces
   - **Hotspot analysis:** files changed most in the last 30/90/180 days
   - **Cross-boundary imports:** files that reach across package boundaries without declaring the dependency

Results render as formatted terminal tables and tree views. Optionally export as JSON for further processing.

## What It Demonstrates

- PackageFinder's deep monorepo analysis capabilities
- Grep for architectural analysis (tracing imports at scale)
- Git for historical analysis (what's changing most?)
- FileManager for comprehensive file indexing
- Luca as a tool for understanding, not just building
- Zero AI — pure computation and analysis

## Features Used

- `PackageFinder` — package discovery, dependency graph, duplicate detection, scope analysis
- `FileManager` — file scanning, pattern matching across the monorepo
- `Grep` — tracing import statements, finding cross-package references
- `Git` — blame, log frequency analysis, file change history
- `FS` — reading package.json files, tsconfig files for path aliases
- `DiskCache` — caching analysis results (re-scan is incremental)
- `UI` — tree rendering, tables, colored dependency graphs, progress bars
- `YAML` / `JsonTree` — parsing config files (turbo.json, pnpm-workspace.yaml, etc.)

## Key Moments

- The dependency tree rendering with color-coded depth levels
- A circular dependency being flagged with the exact A → B → C → A cycle
- Discovering a package that nothing uses anymore
- The hotspot analysis revealing that 80% of changes happen in 5% of files
- Running it again and the cache making it near-instant
