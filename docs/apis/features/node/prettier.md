# Prettier (features.prettier)

> Stability: `stable`

The Prettier feature formats TypeScript, Markdown, and YAML source with prettier's standalone engine. It wraps `prettier/standalone` with exactly three parsers — typescript, markdown, and yaml — so it stays lightweight in the compiled binary (the full prettier package would cost ~5.5MB; this set is well under 2MB). Markdown documents with YAML frontmatter are handled in one pass: the frontmatter is formatted by the yaml parser and the body by the markdown parser. There is no CSS, HTML, or flow support by design. All formatting is async (prettier v3), and the parser is inferred from a `filepath` extension when you have one, so callers usually just hand over source text. Feature options set project-wide defaults (quote style, semicolons, print width) that every call inherits and can override.

## Usage

```ts
container.feature('prettier', {
  // Default preferred line length for every format call
  printWidth,
  // Default spaces per indentation level
  tabWidth,
  // Default: end statements with semicolons
  semi,
  // Default: prefer single quotes
  singleQuote,
  // Default trailing comma style
  trailingComma,
})
```

## Options (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `printWidth` | `number` | Default preferred line length for every format call |
| `tabWidth` | `number` | Default spaces per indentation level |
| `semi` | `boolean` | Default: end statements with semicolons |
| `singleQuote` | `boolean` | Default: prefer single quotes |
| `trailingComma` | `string` | Default trailing comma style |

## Methods

### format

Formats source text with prettier. The parser is chosen in this order: an explicit `parser` option, the extension of a `filepath` option, then `typescript` as the fallback. Options given here override the feature's own option defaults for this one call. Malformed source throws a SyntaxError from prettier with line and column info.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `source` | `string` | ✓ | The source text to format |
| `options` | `PrettierFormatOptions` |  | Parser selection and prettier style options |

**Returns:** `Promise<string>`

```ts
const prettier = container.feature('prettier')

const out = await prettier.format('const   x=1', { semi: false })
console.log(out) // 'const x = 1\n'

// Parser inferred from a path — no need to name it
const md = await prettier.format('#    Title', { filepath: 'README.md' })
console.log(md) // '# Title\n'
```



### check

Checks whether source text is already prettier-formatted. Useful as a cheap lint gate: it returns a boolean instead of the formatted text, so you can report unformatted files without rewriting them. Uses the same parser inference and defaults as `format()`.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `source` | `string` | ✓ | The source text to check |
| `options` | `PrettierFormatOptions` |  | Parser selection and prettier style options |

**Returns:** `Promise<boolean>`

```ts
const prettier = container.feature('prettier')
console.log(await prettier.check('const x = 1;\n')) // true
console.log(await prettier.check('const   x=1'))    // false
```



### formatTypeScript

Formats TypeScript (or JavaScript) source. A convenience wrapper over `format()` with the typescript parser pinned.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `source` | `string` | ✓ | The TypeScript source to format |
| `options` | `PrettierFormatOptions` |  | Prettier style options |

**Returns:** `Promise<string>`

```ts
const prettier = container.feature('prettier')
const out = await prettier.formatTypeScript('type A={x:number}')
console.log(out) // 'type A = { x: number };\n'
```



### formatMarkdown

Formats a Markdown document, including any YAML frontmatter. The markdown parser hands the frontmatter block to the yaml parser, so a contentDb-style document (frontmatter + body) comes back fully formatted in one call. Fenced code blocks are left as-is — prettier does not reformat embedded code without the matching language plugin.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `source` | `string` | ✓ | The Markdown source to format |
| `options` | `PrettierFormatOptions` |  | Prettier style options |

**Returns:** `Promise<string>`

```ts
const prettier = container.feature('prettier')
const doc = await prettier.formatMarkdown('---\ntitle:   Hi\n---\n#  Heading')
console.log(doc)
// ---
// title: Hi
// ---
//
// # Heading
```



### formatYaml

Formats a standalone YAML document.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `source` | `string` | ✓ | The YAML source to format |
| `options` | `PrettierFormatOptions` |  | Prettier style options |

**Returns:** `Promise<string>`

```ts
const prettier = container.feature('prettier')
const out = await prettier.formatYaml('a:    1\nb:   [1,2]')
console.log(out) // 'a: 1\nb: [1, 2]\n'
```



## State (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | `boolean` | Whether this feature is currently enabled |

## Examples

**features.prettier**

```ts
const prettier = container.feature('prettier')

// TypeScript — the default parser
const code = await prettier.format(`const x={a:1,b:2};function f(  ){return x}`)
console.log(code)
// const x = { a: 1, b: 2 };
// function f() {
//   return x;
// }

// Markdown with YAML frontmatter — both parts formatted in one pass
const doc = await prettier.format(
 '---\ntitle:    Hello\ntags:   [a,b]\n---\n# Heading\n\nSome    text',
 { parser: 'markdown' },
)

// Infer the parser from a file path
const yml = await prettier.format('a:   1', { filepath: 'config.yml' })

// Project-wide defaults via feature options
const p2 = container.feature('prettier', { singleQuote: true, semi: false })
console.log(await p2.format('const s = "hi"')) // const s = 'hi'
```



**format**

```ts
const prettier = container.feature('prettier')

const out = await prettier.format('const   x=1', { semi: false })
console.log(out) // 'const x = 1\n'

// Parser inferred from a path — no need to name it
const md = await prettier.format('#    Title', { filepath: 'README.md' })
console.log(md) // '# Title\n'
```



**check**

```ts
const prettier = container.feature('prettier')
console.log(await prettier.check('const x = 1;\n')) // true
console.log(await prettier.check('const   x=1'))    // false
```



**formatTypeScript**

```ts
const prettier = container.feature('prettier')
const out = await prettier.formatTypeScript('type A={x:number}')
console.log(out) // 'type A = { x: number };\n'
```



**formatMarkdown**

```ts
const prettier = container.feature('prettier')
const doc = await prettier.formatMarkdown('---\ntitle:   Hi\n---\n#  Heading')
console.log(doc)
// ---
// title: Hi
// ---
//
// # Heading
```



**formatYaml**

```ts
const prettier = container.feature('prettier')
const out = await prettier.formatYaml('a:    1\nb:   [1,2]')
console.log(out) // 'a: 1\nb: [1, 2]\n'
```

