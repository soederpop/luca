# SkillsLibrary (features.skillsLibrary)

> Stability: `stable`

Manages a registry of skill locations — folders containing SKILL.md files. Persists known locations to ~/.luca/skills.json and scans them on start. Each skill folder can be opened as a DocsReader for AI-assisted Q&A. Exposes tools for assistant integration via assistant.use(skillsLibrary). No paths are scanned by default — callers must explicitly provide locations via the `locations` option or `addLocation()`. Set `useAgentsFolders: true` to automatically scan conventional agent skill folders (.claude/skills and .agents/skills in both $HOME and cwd).

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

**Returns:** `Promise<void>`



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



### findRelevantSkillsForAssistant

Fork the given assistant and ask it which skills (if any) are relevant to the user's query. Returns an array of skill names that should be loaded before the real question is answered. The fork is ephemeral (historyMode: 'none') and uses structured output so the result is always a clean string array — never free text.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `assistant` | `Assistant` | ✓ | The assistant instance to fork |
| `userQuery` | `string` | ✓ | The user's original question |

**Returns:** `Promise<string[]>`



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



### foundSkills

Event emitted by SkillsLibrary



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

