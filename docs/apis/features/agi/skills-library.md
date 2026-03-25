# SkillsLibrary (features.skillsLibrary)

Manages a registry of skill locations — folders containing SKILL.md files. Persists known locations to ~/.luca/skills.json and scans them on start. Each skill folder can be opened as a DocsReader for AI-assisted Q&A. Exposes tools for assistant integration via assistant.use(skillsLibrary).

## Usage

```ts
container.feature('skillsLibrary', {
  // Override path for skills.json (defaults to ~/.luca/skills.json)
  configPath,
})
```

## Options (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `configPath` | `string` | Override path for skills.json (defaults to ~/.luca/skills.json) |

## Methods

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

Return all discovered skills.

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

Search available skills, optionally filtered by a query string.

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
| `skills` | `Record<string, SkillInfo>` | Discovered skills keyed by name. |
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
const lib = container.feature('skillsLibrary')
await lib.start()
await lib.addLocation('~/.claude/skills')
lib.list() // => SkillInfo[]
const reader = lib.createSkillReader('my-skill')
```

