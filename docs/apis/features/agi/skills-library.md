# SkillsLibrary (features.skillsLibrary)

> Stability: `stable`

Manages a registry of skill locations — folders containing SKILL.md files. Persists known locations to ~/.luca/skills.json and scans them on start. Each skill folder can be opened as a DocsReader for AI-assisted Q&A. Exposes tools for assistant integration via assistant.use(skillsLibrary). A local `skills/` folder in the project cwd is scanned automatically when it exists. Beyond that, callers must explicitly provide locations via the `locations` option or `addLocation()`. Set `useAgentsFolders: true` to also scan conventional agent skill folders (.claude/skills and .agents/skills in both $HOME and cwd).

## Usage

```ts
container.feature('skillsLibrary', {
  // Override path for skills.json (defaults to ~/.luca/skills.json)
  configPath,
  // Glob patterns to filter which skills are exposed. When set, only matching skills are available. Supports * wildcards (e.g. "luca-*", "react-ink").
  only,
  // Additional skill location directories to scan for this instance only. Not persisted to skills.json — other consumers will not see these.
  locations,
  // When true, automatically scan conventional agent skill folders: .claude/skills and .agents/skills in both the home directory and project cwd.
  useAgentsFolders,
})
```

## Options (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `configPath` | `string` | Override path for skills.json (defaults to ~/.luca/skills.json) |
| `only` | `array` | Glob patterns to filter which skills are exposed. When set, only matching skills are available. Supports * wildcards (e.g. "luca-*", "react-ink"). |
| `locations` | `array` | Additional skill location directories to scan for this instance only. Not persisted to skills.json — other consumers will not see these. |
| `useAgentsFolders` | `boolean` | When true, automatically scan conventional agent skill folders: .claude/skills and .agents/skills in both the home directory and project cwd. |

## Methods

### warnAboutUnmatchedFilters

Report `only` patterns that match no discovered skill. A filter is a claim about what should be available, so a pattern matching nothing is almost always a typo or a location that failed to scan. Silently narrowing to nothing is the failure mode that hides both.

**Returns:** `string[]`



### setupToolsConsumer

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `assistant` | `Feature` | ✓ | Parameter assistant |

**Returns:** `void`



### start

Start the skills library: read config, scan all locations.

**Returns:** `Promise<SkillsLibrary>`



### addLocation

Add a new skill location folder and scan it for skills.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `locationPath` | `string` | ✓ | Path to a directory containing skill subfolders with SKILL.md |
| `options` | `{ persist?: boolean }` |  | Optional settings |

`{ persist?: boolean }` properties:

| Property | Type | Description |
|----------|------|-------------|
| `persist` | `any` | When false, the location applies to this process only and |

**Returns:** `Promise<void>`

```ts
// A plugin lending its skills for this run only
await lib.addLocation(`${pluginDir}/skills`, { persist: false })
```



### removeLocation

Remove a skill location and its skills from the library.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `locationPath` | `string` | ✓ | The location path to remove |

**Returns:** `Promise<void>`



### scanLocation

Scan a location folder for skill subfolders containing SKILL.md.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `locationPath` | `string` | ✓ | Absolute path to scan |

**Returns:** `Promise<void>`



### list

Return all discovered skills (respects the `only` filter).

**Returns:** `SkillInfo[]`



### find

Find a skill by name.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `skillName` | `string` | ✓ | Parameter skillName |

**Returns:** `SkillInfo | undefined`



### createSkillReader

Create a DocsReader for a skill's folder, enabling AI-assisted Q&A.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `skillName` | `string` | ✓ | Name of the skill to create a reader for |

**Returns:** `DocsReader`



### ensureFolderCreatedWithSkillsByName

Create a tmp directory containing symlinked/copied skill folders by name, suitable for passing to claude --add-dir.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `skillNames` | `string[]` | ✓ | Array of skill names to include |

**Returns:** `string`



### resolveSkillFolders

Resolve skill folders out of a set of skill names and/or location folders. Names are looked up in the library (so it must be started). Folders are scanned directly for subfolders containing a SKILL.md, which needs no library state — a folder can be turned into a plugin before `start()` has ever run.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `spec` | `SkillsPluginSpec` | ✓ | Skill names and/or folders containing skill subfolders |

`SkillsPluginSpec` properties:

| Property | Type | Description |
|----------|------|-------------|
| `skills` | `string[]` | Skill names to resolve out of the library (requires the library to be started). |
| `folders` | `string[]` | Folders containing skill subfolders; every subfolder with a SKILL.md is included. |
| `pluginName` | `string` | Plugin name, which becomes the `<pluginName>:<skill>` namespace. Defaults to "luca-skills". |

**Returns:** `Array<{ name: string; path: string }>`



### installToFolder

Symlink resolved skill folders into a target folder, leaving anything already present alone. This is the building block behind {@link ensurePluginWithSkills}, and is useful on its own for laying skills into a `.claude/skills` folder, a scratch directory, or any other place a tool expects to find them.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `skills` | `string[] | SkillsPluginSpec` | ✓ | Skill names, or a spec mixing names and folders to scan |
| `folder` | `string` | ✓ | Target folder; created if missing |

**Returns:** `SkillInstallResult[]`

```ts
const lib = await container.feature('skillsLibrary').start()
lib.installToFolder(['luca-framework', 'react-ink'], './.claude/skills')
// => [{ name: 'luca-framework', path: '/…/skills/luca-framework', linkPath: '…', installed: true }, …]
```



### ensurePluginWithSkills

Build a Claude Code plugin directory that exposes the given skills, and return its path for passing to `claude --plugin-dir`. Unlike {@link ensureFolderCreatedWithSkillsByName} — which only makes skill files *readable* via `--add-dir` — a plugin actually registers the skills, so Claude lists them and can invoke them as `<pluginName>:<skill>`. The plugin lives at `~/.luca/skills-plugins/<hash>`, where the hash covers each skill's **absolute path**, not just its name: two projects can each have a `contentbase` skill with different content, and they must not collide on one cached plugin. Skill folders are symlinked rather than copied, so edits to the source skill show up immediately and never go stale.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `spec` | `SkillsPluginSpec` | ✓ | Skill names to resolve from the library and/or folders to scan |

`SkillsPluginSpec` properties:

| Property | Type | Description |
|----------|------|-------------|
| `skills` | `string[]` | Skill names to resolve out of the library (requires the library to be started). |
| `folders` | `string[]` | Folders containing skill subfolders; every subfolder with a SKILL.md is included. |
| `pluginName` | `string` | Plugin name, which becomes the `<pluginName>:<skill>` namespace. Defaults to "luca-skills". |

**Returns:** `string | undefined`

```ts
const lib = await container.feature('skillsLibrary').start()
const dir = lib.ensurePluginWithSkills({ skills: ['luca-framework', 'react-ink'] })
// => ~/.luca/skills-plugins/ab12cd…  (pass as claude --plugin-dir <dir>)
```



### searchAvailableSkills

Search available skills, optionally filtered by a query string. Respects the `only` filter.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `{ query }` | `{ query?: string }` |  | Parameter { query } |

**Returns:** `Promise<string>`



### loadSkill

Load a skill's full SKILL.md content and metadata.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `{ skillName }` | `{ skillName: string }` | ✓ | Parameter { skillName } |

**Returns:** `Promise<string>`



### askSkillBasedQuestion

Ask a question about a specific skill using a DocsReader.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `{ skillName, question }` | `{ skillName: string; question: string }` | ✓ | Parameter { skillName, question } |

**Returns:** `Promise<string>`



## Getters

| Property | Type | Description |
|----------|------|-------------|
| `skills` | `Record<string, SkillInfo>` | Discovered skills keyed by name (unfiltered). |
| `filteredSkills` | `Record<string, SkillInfo>` | Skills filtered by the `only` option when set. |
| `availableSkills` | `any` |  |
| `skillsTable` | `Record<string, string>` |  |
| `configPath` | `string` | Resolved path to the skills.json config file. |
| `isStarted` | `boolean` | Whether the library has been loaded. |

## Events (Zod v4 schema)

### started

Fired after all skill locations have been scanned



### locationAdded

Fired when a new skill location is registered

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | The absolute path of the added location |



### skillDiscovered

Fired when a skill is discovered during scanning

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `any` | The SkillInfo object |



## State (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | `boolean` | Whether this feature is currently enabled |
| `loaded` | `boolean` | Whether skill locations have been scanned |
| `locations` | `array` | Tracked skill location folder paths |
| `skillCount` | `number` | Total number of discovered skills |
| `skills` | `object` | Discovered skills keyed by name |

## Examples

**features.skillsLibrary**

```ts
const lib = container.feature('skillsLibrary', { locations: ['./my-skills'] })
await lib.start()
lib.list() // => SkillInfo[]

// Or opt in to conventional agent folders:
const lib2 = container.feature('skillsLibrary', { useAgentsFolders: true })
await lib2.start()
```



**addLocation**

```ts
// A plugin lending its skills for this run only
await lib.addLocation(`${pluginDir}/skills`, { persist: false })
```



**installToFolder**

```ts
const lib = await container.feature('skillsLibrary').start()
lib.installToFolder(['luca-framework', 'react-ink'], './.claude/skills')
// => [{ name: 'luca-framework', path: '/…/skills/luca-framework', linkPath: '…', installed: true }, …]
```



**ensurePluginWithSkills**

```ts
const lib = await container.feature('skillsLibrary').start()
const dir = lib.ensurePluginWithSkills({ skills: ['luca-framework', 'react-ink'] })
// => ~/.luca/skills-plugins/ab12cd…  (pass as claude --plugin-dir <dir>)
```

