# Declaring your project's own tools

Luca Desktop shows a project's own tools next to its built-in ones: in the
project overview's Tools grid, in the palette (`Space Space`, group
`own tool`) and behind `Space w`. You declare them in your project. The app
has no code for any one project.

## Where

Put one file per tool in a `workbench/` folder at the project root. The
workbench host (`luca workbench`) reads every `*.ts` / `*.js` file there.
Files that start with `_` and `*.test.*` files are skipped.

A plugin can carry the same `workbench/` folder. When the project loads the
plugin (`LUCA_PLUGINS` in `.env`, or `usePlugin` in `luca.cli.ts`), its
tools show too, tagged `plugin`. If two tools have one id, the project's
own wins and the other is listed as an error.

Each file's default export is a tool, or an array of tools. A tool is plain
data plus functions. The `id` defaults to the file name.

## A page tool

A page opens as a web page tile: a path on the project's `luca serve`, or a
full URL. The page gets the shell bridge (`window.webkit.messageHandlers.alHost`:
choose, ask, confirm, flash).

```ts
// workbench/board-page.ts
export default {
  id: 'board-page',
  title: 'Board page',
  hint: 'public/board.html on luca serve',
  page: '/board.html',
}
```

## A view tool

`data(ctx)` runs on the host. `ctx` is `{ container, params, project }`.
`params` are the tile address options (`luca://<project>/tool/todo?col=done`
gives `{ col: 'done' }`). The `renderer` says how the app draws the result:

| renderer | `data()` returns |
|---|---|
| `stacks` | `{ stacks: [{ id?, title, tone?, cards: [{ id?, title, subtitle?, preview?, badge?, tone?, address? }] }] }` |
| `tree` | any value: drawn as the console's value tree |
| `markdown` | a string of markdown (or `{ markdown }`) |
| `table` | an array of objects, or `{ columns, rows }`: drawn as a markdown table |

With no renderer, `{ stacks }` is stacks, a string is markdown, and anything
else is a tree.

- `tone` is `accent`, `good`, `warn`, `bad`, `info`, `muted`, or a number
  (a color slot). A stack's tone colors its title and its cards' edge.
- A card's `address` opens a tile on `Enter`: `helper/features/fs`,
  `doc/<id>`, `registry?stack=commands`, or a full `luca://…` address. A
  card with no address opens nothing.
- Keep your own fields on a card (`due`, `owner`…). An action gets the card
  object back as its `target`.

## Actions

`actions` is `{ [id]: { key, label, run(ctx, target) } }`. `key` is one key:
`a`, `A`, `Shift-a`, `Ctrl-x`. It works in the tool's tile and shows in the
keys view (`?`). A key the app or the tile already has (`Space`, `:`, `?`,
`Esc`, `j`, `k`, `r`, `f`, `u`, `E`, `R`, `.`…) stays the app's: the tile
shows a warning and the action is still in the `.` picker.

`target` is the card in focus (with your own fields, plus `id` and `stack`),
or null.

`run` returns `{ flash?, reload?, open? }`, or a string (a flash). `reload`
is true unless you say false. `open` is an address to open after.

To ask the user something, make `run` an async generator and `yield` a step.
The palette shows it and the answer comes back from the `yield`:

| step | answer |
|---|---|
| `{ kind: 'choose', title, items }` | the picked item's `value` (or the item itself) |
| `{ kind: 'ask', title, initial? }` | the typed text |
| `{ kind: 'confirm', question, yes? }` | `true` or `false` |

`Esc` cancels: the generator ends there (its `finally` blocks run) and
nothing else happens.

## A complete example

A todo board backed by `todos.json` in the project folder.

```ts
// workbench/todo.ts
const COLUMNS = [
  { id: 'todo', title: 'To do', tone: 'warn' },
  { id: 'doing', title: 'Doing', tone: 'info' },
  { id: 'done', title: 'Done', tone: 'good' },
]

const file = (ctx) => ctx.container.paths.resolve('todos.json')
const read = (ctx) => (ctx.container.fs.exists(file(ctx)) ? ctx.container.fs.readJson(file(ctx)) : [])
const write = (ctx, todos) => ctx.container.fs.writeJson(file(ctx), todos)

export default {
  id: 'todo',
  title: 'Todo board',
  hint: 'todos.json, one stack per column',
  renderer: 'stacks',

  data(ctx) {
    const todos = read(ctx)
    return {
      stacks: COLUMNS.map((c) => ({
        id: c.id,
        title: c.title,
        tone: c.tone,
        cards: todos.filter((t) => t.col === c.id).map((t) => ({ id: t.id, title: t.title, subtitle: t.note })),
      })),
    }
  },

  actions: {
    add: {
      key: 'a',
      label: 'add a todo',
      async *run(ctx) {
        const col = yield { kind: 'choose', title: 'Which column?', items: COLUMNS.map((c) => ({ title: c.title, value: c.id })) }
        const title = yield { kind: 'ask', title: 'What is the todo?' }
        const ok = yield { kind: 'confirm', question: `Add "${title}"?`, yes: 'Add it' }
        if (!ok) return { flash: 'Nothing added', reload: false }
        write(ctx, [...read(ctx), { id: 't' + Date.now(), title, col }])
        return { flash: `Added ${title}` }
      },
    },
    next: {
      key: 'm',
      label: 'move to the next column',
      async run(ctx, target) {
        if (!target) return { flash: 'No card in focus', reload: false }
        const todos = read(ctx)
        const todo = todos.find((t) => t.id === target.id)
        const i = COLUMNS.findIndex((c) => c.id === todo.col)
        todo.col = COLUMNS[Math.min(i + 1, COLUMNS.length - 1)].id
        write(ctx, todos)
        return `Moved ${todo.title}`
      },
    },
  },
}
```

## Reloading and errors

- `r` in the tool's tile runs `data()` again. A saved declaration file is
  read again on the next list or reload (the host checks the file's time);
  `R` restarts the host if you need a clean start.
- A file that does not load, a bad shape, or a `data()` that throws never
  breaks the app or the host. The overview lists each failed file with its
  reason (`line 4:3: Expected "}" but found "this"`), and the tool's tile
  shows the error.
- `data()` and each action step must answer within 30 s and 60 s.
- Tool code runs in the host process with the project's container. Use the
  container (`ctx.container.fs`, `ctx.container.paths`), as everywhere in
  Luca.

## Host routes

For other clients: `GET /tools` (the list, with `errors`),
`GET /tools/<id>?<params>` (the shaped data), `POST /tools/<id>/actions/<action>`
with `{ params, target: { stack, card } }`, then
`POST /tools/actions/<token>/answer` with `{ value }` (a row index, text, or a
boolean) or `POST /tools/actions/<token>/cancel`. Each answer is either
`{ done: false, token, step }` or `{ done: true, result }`.
