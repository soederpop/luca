# TypeScriptAst (features.typescript)

> Stability: `stable`

The typescript feature exposes the bundled TypeScript compiler for parsing source files and working with their ASTs — no install required, the compiler ships inside the luca binary. It has two layers. The `framework` getter hands you the entire `typescript` module (`ts.createSourceFile`, `ts.SyntaxKind`, the works) so anything the compiler can do, you can build on. On top of that sit purpose-built helpers for the common structural questions: list a module's exports, pull the full code of one export, read the leading JSDoc block on an export or a class member, enumerate class members, and surgically read or replace a single function body without disturbing any other byte of the file. Everything is syntax-only — files parse in isolation with no type checker, so it is fast and needs no tsconfig or lib files. Edits are text splices at AST-derived spans: formatting, comments, and untouched code stay byte-identical, and `replaceFunctionBody` re-parses the result so you can reject a broken edit before writing it.

## Usage

```ts
container.feature('typescript')
```

## Methods

### parse

Parses TypeScript (or TSX/JS) source into a `ts.SourceFile` AST. Parsing is syntactic only — no type checking, no file system access — so it works on any string and is fast enough to call per keystroke. Parent pointers are set, so `node.getText()` and `node.getSourceFile()` work on every node.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `source` | `string` | ✓ | The module source text |
| `fileName` | `string` |  | Virtual file name; the extension picks the dialect (.ts, .tsx, .js) |

**Returns:** `ts.SourceFile`

```ts
const sf = container.feature('typescript').parse('export const x = 1')
console.log(sf.statements.length) // 1
```



### diagnostics

Returns the syntax errors in a source string (or already-parsed file). Only parse errors are reported — this is not a type check. An empty array means the source is syntactically valid.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `source` | `SourceInput` | ✓ | Source text or a parsed source file |

**Returns:** `TsSyntaxDiagnostic[]`

```ts
container.feature('typescript').diagnostics('function broken( {')
// [{ message: "'}' expected.", line: 1, column: 19 }]
```



### exports

Lists every export of a module: declarations marked `export`, the default export, and `export { a, b as c }` clauses (resolved to their local declarations). Each entry carries the export's full source code (JSDoc excluded), its span in the original text, and its parsed leading JSDoc block. Variable exports whose initializer is a function or arrow expression report `kind: 'function'`.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `source` | `SourceInput` | ✓ | Source text or a parsed source file |

**Returns:** `TsExportInfo[]`

```ts
const tsf = container.feature('typescript')
const found = tsf.exports('export const go = async () => 1')
console.log(found[0].kind) // 'function' — arrow initializers count
```



### defaultExport

Returns the default export of a module, or null when there is none. `export default class Foo {}`, `export default function () {}`, and `export default Foo` (resolved to the local declaration) are all handled.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `source` | `SourceInput` | ✓ | Source text or a parsed source file |

**Returns:** `TsExportInfo | null`

```ts
const info = container.feature('typescript').defaultExport('class A {}\nexport default A')
console.log(info?.kind, info?.localName) // 'class' 'A'
```



### classExports

Returns only the class exports of a module (default export included when it is a class).

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `source` | `SourceInput` | ✓ | Source text or a parsed source file |

**Returns:** `TsExportInfo[]`

```ts
container.feature('typescript').classExports('export class A {}\nexport class B {}').length // 2
```



### functionExports

Returns only the function exports of a module — `export function` and `export async function` declarations plus exported consts whose initializer is a function or arrow expression. This is the shape of an assistant's tools.ts: each entry here whose name matches a key of the `schemas` export is a tool handler.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `source` | `SourceInput` | ✓ | Source text or a parsed source file |

**Returns:** `TsExportInfo[]`

```ts
const fns = container.feature('typescript').functionExports(await fs.readFile('tools.ts'))
console.log(fns.map(f => f.name))
```



### exportCode

Returns the full source code of one export by name, or null when the module has no export by that name. The leading JSDoc block is excluded — fetch it with `jsdoc()`.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `source` | `SourceInput` | ✓ | Source text or a parsed source file |
| `name` | `string` | ✓ | The exported name ('default' for the default export) |

**Returns:** `string | null`

```ts
container.feature('typescript').exportCode('export const x = 1', 'x')
// 'export const x = 1'
```



### jsdoc

Returns the parsed leading JSDoc block of one export, or null when the export doesn't exist or has no JSDoc.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `source` | `SourceInput` | ✓ | Source text or a parsed source file |
| `name` | `string` | ✓ | The exported name ('default' for the default export) |

**Returns:** `TsJsdocBlock | null`

```ts
const block = container.feature('typescript').jsdoc(src, 'searchDocs')
console.log(block?.description)
console.log(block?.tags) // [{ tag: 'param', text: '...' }]
```



### classMembers

Lists the members of a class: methods, getters, setters, properties, the constructor, and static blocks — each with its code, span, JSDoc, and static/private flags. With no `className` the target is the default-exported class, or the module's only class when there is exactly one.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `source` | `SourceInput` | ✓ | Source text or a parsed source file |
| `className` | `string` |  | Which class to inspect; optional when unambiguous |

**Returns:** `TsClassMemberInfo[]`

```ts
const members = container.feature('typescript').classMembers(src, 'Widget')
members.filter(m => m.kind === 'getter').map(m => m.name)
```



### memberJsdoc

Returns the parsed leading JSDoc block of one class member, or null.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `source` | `SourceInput` | ✓ | Source text or a parsed source file |
| `memberName` | `string` | ✓ | The member's name ('constructor' for the constructor) |
| `className` | `string` |  | Which class; optional when unambiguous |

**Returns:** `TsJsdocBlock | null`

```ts
container.feature('typescript').memberJsdoc(src, 'render', 'Widget')?.description
```



### functionBody

Returns the body of an exported function — the text between the braces, plus its exact span in the source. Works on `export function` declarations and exported consts holding a function or arrow expression. A braceless arrow reports its expression with `isExpression: true`.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `source` | `SourceInput` | ✓ | Source text or a parsed source file |
| `name` | `string` | ✓ | The exported function's name |

**Returns:** `TsFunctionBody | null`

```ts
const body = container.feature('typescript').functionBody(src, 'searchDocs')
console.log(body?.text) // the statements between the braces
```



### replaceFunctionBody

Replaces the body of one exported function and leaves every other byte of the module untouched — a text splice at the AST-derived span, never a re-print, so formatting and comments survive. For a braced function, `newBody` is the statement text that goes between the braces (the braces stay). For a braceless arrow it replaces the expression. The result is re-parsed: check `diagnostics` is empty before writing the file, and throw away the edit when it isn't.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `source` | `SourceInput` | ✓ | Source text or a parsed source file |
| `name` | `string` | ✓ | The exported function's name |
| `newBody` | `string` | ✓ | Replacement body text (without braces) |

**Returns:** `TsEditResult`

```ts
const tsf = container.feature('typescript')
const edit = tsf.replaceFunctionBody(src, 'greet', `\n  return 'hi ' + params.name\n`)
if (edit.diagnostics.length === 0) await fs.writeFile('tools.ts', edit.source)
```



## Getters

| Property | Type | Description |
|----------|------|-------------|
| `framework` | `typeof ts` | The entire bundled TypeScript compiler API — the `typescript` module itself. Use this to build anything the helpers below don't cover: create source files, walk nodes with `ts.forEachChild`, inspect `ts.SyntaxKind`, print nodes, transform, and so on. |

## State (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | `boolean` | Whether this feature is currently enabled |

## Examples

**features.typescript**

```ts
const tsf = container.feature('typescript')

const source = `
/** Adds two numbers. *\/
export function add(a: number, b: number) { return a + b }
export const nums = [1, 2, 3]
export default class Calculator {
 /** Runs the calculation. *\/
 run() { return 42 }
}
`

// List every export with kind, code, and jsdoc
tsf.exports(source).map(e => `${e.name}:${e.kind}`)
// ['add:function', 'nums:variable', 'default:class']

// Full code of one export
tsf.exportCode(source, 'add')
// 'export function add(a: number, b: number) { return a + b }'

// Leading JSDoc of an export, and of a class member
tsf.jsdoc(source, 'add')?.description          // 'Adds two numbers.'
tsf.classMembers(source)[0].jsdoc?.description // 'Runs the calculation.'

// Surgical function-body edit — only the body changes
const edit = tsf.replaceFunctionBody(source, 'add', ' return a * b ')
edit.diagnostics // [] — the edit parses cleanly

// Drop to the raw compiler API for anything else
const ts = tsf.framework
const sf = tsf.parse(source)
ts.forEachChild(sf, node => console.log(ts.SyntaxKind[node.kind]))
```



**parse**

```ts
const sf = container.feature('typescript').parse('export const x = 1')
console.log(sf.statements.length) // 1
```



**diagnostics**

```ts
container.feature('typescript').diagnostics('function broken( {')
// [{ message: "'}' expected.", line: 1, column: 19 }]
```



**exports**

```ts
const tsf = container.feature('typescript')
const found = tsf.exports('export const go = async () => 1')
console.log(found[0].kind) // 'function' — arrow initializers count
```



**defaultExport**

```ts
const info = container.feature('typescript').defaultExport('class A {}\nexport default A')
console.log(info?.kind, info?.localName) // 'class' 'A'
```



**classExports**

```ts
container.feature('typescript').classExports('export class A {}\nexport class B {}').length // 2
```



**functionExports**

```ts
const fns = container.feature('typescript').functionExports(await fs.readFile('tools.ts'))
console.log(fns.map(f => f.name))
```



**exportCode**

```ts
container.feature('typescript').exportCode('export const x = 1', 'x')
// 'export const x = 1'
```



**jsdoc**

```ts
const block = container.feature('typescript').jsdoc(src, 'searchDocs')
console.log(block?.description)
console.log(block?.tags) // [{ tag: 'param', text: '...' }]
```



**classMembers**

```ts
const members = container.feature('typescript').classMembers(src, 'Widget')
members.filter(m => m.kind === 'getter').map(m => m.name)
```



**memberJsdoc**

```ts
container.feature('typescript').memberJsdoc(src, 'render', 'Widget')?.description
```



**functionBody**

```ts
const body = container.feature('typescript').functionBody(src, 'searchDocs')
console.log(body?.text) // the statements between the braces
```



**replaceFunctionBody**

```ts
const tsf = container.feature('typescript')
const edit = tsf.replaceFunctionBody(src, 'greet', `\n  return 'hi ' + params.name\n`)
if (edit.diagnostics.length === 0) await fs.writeFile('tools.ts', edit.source)
```



**framework**

```ts
const ts = container.feature('typescript').framework
console.log(ts.version) // e.g. '5.9.3'
```

