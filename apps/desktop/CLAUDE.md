# Luca Desktop

The keyboard-first workbench for any Luca project folder. It lives in
`apps/desktop` of the luca repo.

- Product `LucaDesktop`, app `Luca Desktop.app`, id `com.soederpop.luca.desktop`.
  Env vars are `LUCA_DESKTOP_*`.
- App files are in `~/.luca/desktop/` (`keymap.yml`, `state.json`,
  `projects.json`, `settings.yml`, `layouts/`, `console/`, `logs/`).
- **It talks only to the workbench host** (`luca workbench`, one per open
  project). The host's code is `src/workbench/` in this repo.
- Two pieces are kept prebuilt in this folder: the Markdown engine in
  `Vendor/swift-markdown-engine` (read its `VENDORED.md`) and
  `Resources/source-editor.html`, a single-file CodeMirror page.
- Internal type names stay (`TilesPaths`, `TilesMain`, `tilesMarkdown()`):
  renaming them is churn.
- **Releases.** `.github/workflows/desktop.yaml` builds, signs and
  notarizes the app on each push to `main` that changes `apps/desktop/`,
  and publishes it as a `desktop-v<version>-<build>` GitHub release (never
  marked latest, so `luca self-update` is not affected). `luca desktop
  install` downloads the newest one into `/Applications`.

## Bundled assistants

`build-app.sh` copies `assistants/lucaArchitect` (with its `skills/`) into
`Contents/Resources/assistants/lucaArchitect`, adds the `luca-framework` skill
that this checkout's `luca bootstrap --update-skill` writes, and stamps it
with `.luca-desktop-build` (a hash of the files). On launch
`BundledAssistants` installs it to `~/.luca/assistants/`, where every Luca
project discovers it. An installed copy is replaced only when it has a stamp
and the stamp differs; a folder with no stamp is the user's and is left
alone. `LUCA_DESKTOP_ASSISTANTS_HOME` moves the target for check runs. A new
skill goes in `assistants/lucaArchitect/skills/` and in its `only:` list.

## The portfolio project

`portfolio/` here is a small Luca project: `lucaPortfolio` (the projects
tile's assistant), the `portfolio` feature it uses (scan and search every Luca project on the Mac, and send helpers
between them for review), and `portfolio.yml` (which folders
are scanned). `build-app.sh` copies it to `Contents/Resources/portfolio`;
on launch `BundledPortfolio` installs it **file by file** at
`~/.luca/portfolio`. Its manifest (`.luca-desktop-build.json`) holds each
file's hash as the app wrote it: a file is replaced only while it still has
that hash, so the user's edits (their `portfolio.yml` above all) stay.
`LUCA_DESKTOP_PORTFOLIO_HOME` moves it for check runs (a debug build has no
bundle: copy `portfolio/` there by hand).

- It is the project `luca-portfolio` (`PortfolioProject`): `ProjectHub.project`
  answers it without `projects.json`, so it never shows in the list, and no
  folder is given that id. Its tiles are ordinary `luca://luca-portfolio/…`
  tiles on their own host.
- `c` in the projects tile (`appProjects.ask`), the card's Chat button, or
  `:portfolio` opens `luca://luca-portfolio/chat/new?assistant=lucaPortfolio`
  beside the tile in focus.
- **Copies go through change tiles.** lucaPortfolio never writes a copy.
  Its `reviewCopy` tool calls the feature's `reviewCopy`, which emits
  `review` (`{ target, changes: [{registry, id, file, root}] }`). The host
  forwards it as an `event` frame; `ProjectHub` reads it only from the
  portfolio host (`PortfolioReview`), and `Shell.showReview` remembers the
  receiving project (matched by real path, else added to `projects.json`)
  and opens one `luca-change` tile per helper (`route=borrow&op=copy`)
  beside the lucaPortfolio chat (`Shell.openBeside`: one column right or
  left of it, or the chat's right half when the screen has no room; a
  canvas opens the same way). The human writes each there with `a`. The tool's result
  names what the tiles cannot see: helpers the code needs that the target
  lacks, env vars, files that are not helpers. `checkCopy` runs
  `luca describe` in the target afterwards.
- Test the feature with `luca eval` in `portfolio/`; pass
  `{configFile}` to scan scratch roots. Swift: `BundledPortfolioTests`.

## Rules

- **A change to this app ends with** `swift test`, then
  `bash scripts/build-app.sh` and `bash scripts/install-app.sh` from
  `apps/desktop`, each exit 0. Do not pipe build output through `tail`.
- **The Swift side stays dumb.** No derived state, no file or YAML work the
  host can do. Need a fact? Add it to the host (`src/workbench/`).
- **Keys view is a hard requirement.** Every key goes in
  `Sources/Input/DefaultKeymap.swift` with a label and scope. Never type a
  key into a view by hand: use `.keyBadge(action)` and the keymap.
- **Look**: follow the Look section below. Reuse `WorkbenchStyle.swift`.
- **Commit with pathspecs** (`git commit -- <paths>`): other agents share
  the repo.

## Look

All of it lives in `Sources/Tiles/Workbench/WorkbenchStyle.swift` (roles,
components) and `Sources/Theme/Theme.swift` (`kindColor`, `statusColor`,
owner colors). Colors are kit tokens only, so every theme (`Space T`) and
`:set dark|light` keep working; never raw hex in a view.

- **Kind colors** (`WorkbenchStyle.thingColor`): features `syntax.function`,
  clients `syntax.property`, servers `syntax.type`, commands
  `syntax.string`, endpoints `syntax.keyword`, assistants `hues[3]`,
  selectors `syntax.number`, docs `hues[7]`. A theme where two of those
  share a hue gives the later kind the next free one. Used for the glyph
  (`ThingGlyph`, `thingGlyph`), the stack header and card bar (stack tone
  `kind:<registry>`), the registry stat cards and the helper title.
  `Theme.kindColor` maps tile kinds onto the same hues.
- **Other roles**: types `typeNameColor` (signatures, schemas) and
  `valueColor` (values); status `statusColor` (live/running/accepted good,
  starting/exploring info, idle/stopped faint, failed bad); origin
  `originColor`; chat `roleColor`; HTTP `HTTPTone`; doc models
  `slotColor`; key caps tinted by scope in the keys view.
- **Space** (`WorkbenchStyle.Gap`): page 32, section 32, card 16, row 12,
  inline 8, tight 4. Content stops at `Size.readable` (980); one card
  stack alone at `Size.stackMax` (520). Cards: `WorkbenchCard` (radius lg,
  soft raised fill, hairline, optional tint bar). Sections:
  `WorkbenchSection` (colored bar, title, `CountPill`).
- **Type**: `title` (xxl semibold), `heading` (md semibold), `body` (sm),
  `meta` (xs), `caption()` (15, pills and labels). Prose is always the UI
  font; the code font (`WorkbenchStyle.code`) only for code, identifiers,
  paths and values. An index card's subtitle is prose unless the card sets
  `subtitleIsCode`.
- **Data**: a flat JSON value is key/value rows, nested is indented
  (`ValueRows`), never a raw dump. Keys shown always use `BoundKey`
  (reads the keymap); `.keyBadge` stays for keys-view-only badges.

## Layout

- `Sources/App/` launch, menu, paths (`TilesPaths`), state and keymap files,
  `DebugKeys`.
- `Sources/Support/` `AppLogger` (to `logs/luca-desktop.log`) and
  `JSONValue`.
- `Sources/Layout/` tree, workspace, focus by direction, layout files. Pure, tested.
- `Sources/Input/` keys, keymap file parser, router, page keys. Pure, tested.
- `Sources/Shell/` windows, status line, keys panel, which-key, palette,
  `Shell+Projects` (project workspaces, file and page pickers),
  `Shell+Borrow`, `Shell+Layouts`.
- `Sources/Projects/` project folders and their hosts (`ProjectHub`), the
  host client and its shapes.
- `Sources/Tiles/` `TileURI`, the kind registry (`TileKind.swift`), and:
  `Workbench/` the project tools, `File/` the file tile, `App/` the projects
  tile, `Terminal/`, `Web/` the page tile and its web bridge, `Index/` the
  card-stack base, `Doc/` source editor, rich editor theme, markdown theme,
  `DocText`, `Shared/` `CodeHighlighter`.

## Addresses, owners and saved state

- `luca://<project>/<tool>/<id>?<options>`: a workbench tool. `<project>` is
  the id in `projects.json` (the folder name, slugged: `~/code/luca` is `luca`).
  The registry knows it as `luca-<tool>` (`TileURI.kindKey`).
- `app://desktop/<kind>/<id>`: the app's own tiles, kind `app-<kind>`:
  `app://desktop/projects` and `app://desktop/file/<path under the app folder>`
  (`:keymap edit`, `:layout edit <name>`).
- No other scheme parses. A tile's owner (`TileContent.owner`) is
  `luca:<project>` (`ProjectHub.ownerId`) or `app` (`Shell.appOwner`): solo,
  colors (`Theme.ownerColor`, slots from `OwnerColors`) and workspace names
  (`Shell.workspaceLabel`, `mainOwner`) go by it. App tiles never count for
  a workspace's name.
- **Old state never crashes.** `SavedState` decodes tiles one by one: an
  address that does not parse (another scheme) lands in `skipped` and is
  logged (`state.json: skipped …`); a parsed address with no kind is logged
  and dropped in `Shell.restore`. A workspace left empty starts fresh. With
  nothing restored, the projects tile opens. `LayoutFile.resolve` returns
  `[TileURI?]`: a slot that does not parse is nil and `Shell.apply` skips it
  with a log line; a layout of only unknown tiles changes nothing.
- First launch (no `state.json`): the projects tile, which says how to open
  a project.

## Projects and the workbench host

`ProjectHub` keeps the known folders in `projects.json` under the app folder
(so `LUCA_DESKTOP_HOME` moves it) and runs one host per open project.

- `:open-project <path>` (or `:project`) remembers a folder and goes to its
  workspace, or a free one with its `project` tile. `:chat [assistant]`
  starts a chat (`Tab` completes the assistant's name from the project's
  list, cycling through matches; no name opens the picker). `Space p`
  (`palette.projects`), the projects tile (`Space P`) and the palette list
  known projects.
- The host lives while a tile holds its project; the last tile's close
  stops it 5 s later. Quit stops every host (`stopAll`). The app keeps the
  host's stdin open, so a crash ends the host too. Its stderr is in
  `logs/hosts/<project>.log`.
- **Host command.** Default `luca workbench`. `hostCommand: [bun, /x/cli.ts, workbench]`
  in `settings.yml` sets it; `LUCA_DESKTOP_HOST_COMMAND` (space separated)
  wins. The first word is found through the login shell's PATH (read once
  with `$SHELL -ilc`), then `~/.bun/bin`, Homebrew and `/usr/local/bin`.
  The installed `luca` has no `workbench` yet; check runs use
  `LUCA_DESKTOP_HOST_COMMAND='bun <luca checkout>/src/cli/cli.ts workbench'`.
- `WorkbenchClient` is the HTTP and socket client: bearer token,
  `get` / `post` / `request`, `events` (socket frames on main),
  `subscribe(registry:id:)`. It decodes the host's shapes as they are.
- `WorkbenchHostWatch.watch(project)` gives a tile the host's status and
  client. `WorkbenchContent` uses it; so do the card-stack tools
  (`RegistryContent`, `LucaDocsContent`, `AssistantsContent`, which subclass
  `IndexContent`) and `FileContent`.

### Host routes

All in `src/workbench/` (`host.ts` routes and socket, `views.ts`
shapes, `console.ts` console sessions and result trees, `runs.ts` command
children, `origins.ts`, `borrow.ts`, `plugins.ts`, `cli-file.ts`,
`changes.ts`, `endpoints.ts`, `docs.ts` and `chat.ts`, `models.ts` for the contentbase tile, `files.ts`, `tools.ts`), tests in `test/workbench*.test.ts`. Every shape is drawn as
sent: the host does the display work (signatures, pretty JSON, notes).

| Route | Answer |
|---|---|
| `GET /project` | name, cwd, Luca version, registries with counts |
| `GET /registries` | `stacks`: one per registry, project helpers first (`badge: project`). A card's `address` (`helper/features/fs`, `command/<id>` for commands) is its tile after `luca://<project>/`. Each card has an `origin` (below) |
| `GET /registry/<name>` | one registry as Project / Built in stacks |
| `GET /helper/<registry>/<id>` | `title`, `summary`, `markdown` (describe docs), `live`, `stateText`, `liveNote`, `callable`, `optionFields`, `stateFields`, `getters`, `methods` (`signature`, `argsHint`, `askArgs`), `events`, `examples` (the `@example` blocks of the class, then each method's and getter's by name: `id` `class`/`method:<name>`/`getter:<name>`, `title` `fs.readFile()`, `code`, `language`, `from`, `member`; `examplesOf`, pure); `options` (JSON schema) and `state` stay for other readers |
| `GET /helper/<registry>/<id>/source` | the helper's file (from its origin) in `GET /file`'s shape, `pathDisplay` with `~`, plus `editable`, `readOnly` (why not) and `origin` (`src/workbench/helper-source.ts`). Own, borrowed and `~/.luca` files are editable; a plugin's reads but is read only; a built-in helper is 404 with its `origin` |
| `POST /helper/<registry>/<id>/source/save` | `{text, digest}` as `/file/save` on that file; 403 (`readOnly: true`) for a plugin's or built-in helper |
| `POST /helper/<registry>/<id>/call` | `{method, args}`; `args` is the text the user typed. The host reads it: empty is none, plain text is one string, JSON is one value, a JSON array spreads unless the method takes one argument. Answers `{ok, call, text, type, ms, created}` or `{ok: false, error}`. A feature with no instance is created (`container.feature(id)`); other registries answer 409 without one. 30 s timeout |
| `POST /eval` | `{code}`, as `luca eval` |
| `POST /console` | `{code, session?}` (session `default`). One vm context per session, so names stay between entries: top-level `const/let/var x =` becomes an assignment to the scope (`persistDeclarations`), also under top-level await. Entries of a session run in order; 60 s timeout. Answers `{ok, entry, input, type, text, tree, logs, ms}` or `{ok: false, error, name, stack, hint?, logs, ms}`. `tree` is `{key?, type, text, children?, more?, open?}`; `text` is a leaf's value or a container's preview. The stack drops the console's own frames. `?name` or `name?` is a question, not code (`docQuery`): the answer has `type: "docs"` and `doc`. A helper or the container as the result also carries its `doc`. `_` is the last result |
| `POST /console/complete` | `{code, cursor, session?}` (`cursor` is a UTF-16 offset). Answers `{from, to, items, signature?, hover?}` from the session's live scope and Luca's introspection (`src/workbench/complete.ts`). `items` are `{label, kind, detail, insert, doc}`; `signature` is `{doc, active}` for the call the caret is in; `hover` is the doc of the name the caret is on. A `doc` is a `DocCard`: `{title, kind, signature?, summary, params?, returns?, examples?, owner?, members?, value?, type?, documented}`. It never runs code: a chain is walked by reading properties, a call stops it, except `container.feature('x')`, `.client('x')`, `.server('x')`, which resolve to that helper's class. Inside those strings the items are the registry's ids |
| `POST /console/describe` | `{target, session?}`: `{doc}` for a name in scope or a helper by id (`fs.readFile`, `features.fs`, `rest`); 404 when there are none |
| `POST /console/reset` | `{session?}`: forget that session's names |
| `GET /ai` | The project's AI environment (`src/workbench/ai.ts`): `{defaultProvider, defaultText, providers, keys, local, agents, servers, scannedAt, configFiles, envWarning}`. Read from `modelProviders` (`summary`, `resolveDefaultId`, `discoveredServers`), the `luca setup` checks, and each coding agent feature's `checkAvailability` (cached; `POST /ai/agents` asks again). A key's value is never in an answer |
| `POST /ai/discover` | `modelProviders.discover({refresh: true})`: this Mac and the tailnet. Answers the new view. Takes a few seconds |
| `POST /ai/providers/add` | `{baseURL, target, model?}`: add a server of the last scan to `~/.luca/model-providers.yml` (`machine`) or `assistants/options.yml` under `providers:` (`project`), with `suggestConfig` and `mergeProviderConfig`, then `loadConfigFiles()`. Answers `{added, file, view}` |
| `POST /ai/key` | `{env, value}`: write the key to the project's `.env` (mode 600) and to the host's own environment, so it works at once. Only a name a provider reads is taken. Answers `{env, file, view}` |
| `POST /prompt/targets` | `{doc}` or `{file}`: `{file, defaultTarget, targets}`. `file` is the path to give `luca prompt`, from the project folder; `targets` are the project's assistants, then claude, codex and hermes with `available` |
| `GET /servers` | `{kinds, instances, text}` (`src/workbench/servers.ts`). `kinds` are the `servers` registry: `{id, title, summary, options, optionsHint, address, running, origin?}`. `instances` are the ones the workbench started plus any the project's own code has listening: `{key, id, title, status, port, host, url, by, optionsText, state, error}`; `status` is `starting`, `listening`, `stopped` or `failed`; `by` is `workbench` or `project` |
| `POST /servers/start` | `{id, options}`. `options` is what was typed: empty, a port, `name=value` pairs or a JSON object (`parseServerOptions`). Makes a fresh instance in the host's container (`cached: false`) and starts it; answers at once with `{instance}` and a `servers` frame follows each change. Host defaults to `127.0.0.1`; with no port it takes the first free one from the server's default. `mcp` is always `transport=http`: stdio is the host's line to the app |
| `POST /servers/<key>/stop` | Stop that instance (a failed one is only cleared). Every instance the workbench started stops when the host closes |
| `GET /command/<id>` | `title`, `summary`, `badge`, `usage`, `examples`, `subcommands` (`name`, `args`, `description`, from `export const subcommands`; empty for most), `fields` (`name`, `flag`, `type` string/number/boolean/enum/array/unknown, `options`, `default` as text, `description`, `required`, `positional`, `position`); the last field `__extra__` (`extra: true`) is free text of more arguments |
| `POST /command/<id>/run` | `{values: {name: text or bool}}`. The host builds the argv (`buildArgs`: positionals in order up to the first empty one, later ones as flags; booleans only when they differ from the default) and starts a child `luca <id> …` in the project folder, the way the host started (`childPrefix`: `bun /x/cli.ts`, or the compiled binary). 400 lists missing required fields. Answers the run (below) |
| `GET /runs/<runId>` | `{runId, command, display, status, code, signal, stopped, statusText, ms, chunks [{seq, stream, text}], dropped}`. 1 MB of text per run, oldest chunks dropped; the last 20 finished runs are kept |
| `POST /runs/<runId>/stop` | SIGTERM to the child's process group, SIGKILL 3 s later |
| `GET /plugins` | `envFile`, `line` (the `LUCA_PLUGINS` line), `pluginsDir`, `loaded` (what this host loaded), `plugins` (`name`, `link`, `target`, `entry`, `on`, `loaded`, `adds`, `addsText`), `missing` (entries that resolve to no installed plugin), `borrowed` (the app's block in `luca.cli.ts`: `id`, `type`, `directory`, `helpers`) |
| `POST /borrow/preview`, `/borrow/apply` | `{op: copy, registry, id, file, root, withImports?, overwrite?}`, `{op: borrow, registry, dir, overwrite?}`, `{op: unborrow, id}`. Preview answers a `ChangeView`: `title`, `summary`, `ok`, `blocked`, `clashes`, `needsOverwrite`, `notes`, `files` (`display`, `action` create/overwrite/edit/delete/link/same, `lines` add/del/same/gap, `added`, `removed`), `imports`, `helpers`, `digest`. Apply takes the same body plus the preview's `digest`: 409 when the files changed since, or the plan is blocked or has clashes without `overwrite`. Answers `{ok, op, written, restart, text}` |
| `POST /plugins/preview`, `/plugins/apply` | `{op: on\|off, name, entry?}` edits only the `LUCA_PLUGINS` line of `.env`; `{op: link, folder, name?}` makes one link in the plugins folder (the folder needs `luca.plugin.ts`). Same plan, digest and 409 rules |
| `GET /endpoints` | `dir`, `dirDisplay`, `notice` (one line when there is no `endpoints/` or no route), `count`, `groups` (`tag`, `routes`), `errors` (`file`, `error`: files that did not load), `server` (below). A route: `id` (`GET /users/:id`), `method`, `path`, `openapiPath`, `summary`, `tags`, `file`, `address` (`request/GET/users/:id`), `fields` (`name`, `in` path/query/body, `type` string/number/integer/boolean/enum/array/object, `required`, `description`, `default` as text, `options`), `body`, `upload`, `rateLimit`. Read in-process, no server needed |
| `GET /endpoints/route?method=&path=` | `{route, server}` for one route; 404 if none |
| `POST /endpoints/request` | `{method, path, values: {name: text}, body?}`. The host builds the URL and JSON body from the route's fields (`buildRequest`, text coerced by type; a non-empty `body` is sent as is) and sends it to its serve child. Answers `{ok, method, url, status, statusText, statusClass, ms, headers [{name, value}], contentType, bodyKind json/text/empty, text, tree, size, sizeText, sent}`, or `{ok: false, error, notRunning?, missing?}` (200, so the app can offer to start) |
| `GET /serve`, `POST /serve/start`, `POST /serve/stop` | the serve child: `{status stopped/starting/running/failed, port, url, runId, text, error}` |
| `GET /docs` | `rootDisplay`, `notice` (no docs folder, or empty), `error` (models file did not load), `count`, `stacks` (one per model in the models file's order, `Base` last as `Other`: `id`, `title`, `slot`, `count`, `cards` with `id`, `title`, `subtitle`, `preview`, `badge` = status, `address` `doc/<id>`). Reloads the collection from disk each time |
| `GET /docs/models` | `models`: `name`, `prefix`, `description`, `count`, `slot`, `fields` (`name`, `kind` string/number/boolean/enum/array/date/object/value, `typeText`, `required`, `default` as text, `description`, `options`), `sections`, `relationships` |
| `GET /docs/item?id=` | `id`, `model`, `slot`, `title`, `path`, `pathDisplay`, `file` (exact bytes as text), `digest` (sha1 of the file), `size`, `sizeText`, `fields` (the model's fields in order with `value` text or null, `items` for lists, then `extra: true` keys the model does not name). 404 for an id outside the collection |
| `POST /docs/save` | `{id, text, digest}`: writes `text` as the whole file, byte for byte, only when the disk file still has `digest`; else 409 with `view` (the file now). Answers `{ok, unchanged, view, text}` |
| `POST /docs/create` | `{model?, title}`: a new document, `<prefix>/<slug>.md` under the model's folder (`-2` when the name is taken; no model or `Base` puts it at the root), from the model's template when it has one (`{{title}}`, `{{slug}}`, `{{date}}` filled; a `title:` added to the frontmatter when it names none), else a frontmatter with the title and a heading. Answers `{ok, id, model, path, pathDisplay, view, text}`; 400 with no title, 404 for a model it does not know |
| `GET /contentbase` | `rootDisplay`, `modelsDirDisplay`, `notice`, `error`, `fieldTypes`, `extractKinds`, `loadErrors` (workspace model files that did not load: `file`, `fileDisplay`, `model`, `message`), `models`: `name`, `prefix`, `description`, `slot`, `count`, `source` (`models-file`, `tile`, `workspace`, `builtin`), `sourceText`, `file`, `fileDisplay`, `digest`, `editable`, `readOnlyNote`, `spec` (below), `fields` (as `/docs/models`), `sections` (`key`, `heading`, `alternatives`, `extract` text/list/code/custom), `relationships`, `template` (`file`, `fileDisplay`, `exists`) |
| `GET /contentbase/model?name=` | one model in that shape; 404 for none |
| `POST /contentbase/preview` | `{spec, original?}`: `{spec, problems, file, fileDisplay, text, suggestedPrefix}`. Writes nothing. A spec is `{name, prefix, description, fields [{name, type string/number/boolean/date/enum/list, required, default text, description, options}], sections [{key, heading, alternatives, extract text/list/code}]}` |
| `POST /contentbase/save` | `{spec, original?, digest?}`: writes `docs/models/<kebab name>.md`. 400 with `problems`; 409 when the file changed since `digest`, the target exists, or `original` is not a tile model. A rename moves the file and the template. Answers `{ok, view, loadError, text}` |
| `POST /contentbase/delete` | `{name}`: deletes a tile model's file (409 for any other); its documents and template stay |
| `POST /contentbase/query` | `{model, filters [{path, op, value text}], sort [{path, direction}], columns, limit, offset}` or `{model, where: <DSL JSON text>}`. Values are typed by the field's kind on the host. Answers `{ok, total, count, columns [{key, title, kind}], rows [{id, title, address, cells [{text, kind, items}]}], paths [{key, kind, options}], ops, whereText, sortText, code, ms}`, or `{ok: false, error}` (a 200) |
| `GET /files` | `{files, truncated}`: the project's files, relative and sorted, skipping `.git`, `node_modules`, `.build`, `dist` and other build folders; at most 5000 |
| `GET /file?path=` | the file in a doc's shape (`id` = `pathDisplay` = the relative path, `model` empty, `fields` empty) plus `missing` (no file yet: empty text, the digest of no bytes). 400 for a path outside the folder (`..`, absolute, or a link that leads out) or a folder, 413 over 2 MB, 415 for a binary file |
| `POST /file/save` | `{path, text, digest}`: as `/docs/save`, for any file in the folder; a missing file is made (with its folders) when `digest` is the sha1 of no bytes |
| `GET /assistants` | `notice`, `historyDir`, `assistants` (`name`, `description`, `model`, `provider`, `modelText`, `toolCount`, `tools`, `folderDisplay`, `conversationCount`, `lastText`, `slot`, `error`), `recent` (newest 30 conversations of any assistant) |
| `GET /assistants/<name>/conversations` | `{assistant, conversations}`: `conversationId`, `thread`, `title`, `messageCount`, `updatedAt`, `updatedText` |
| `GET /assistant/<name>` | the assistant editor's view (`src/workbench/assistant-editor.ts`): `folder`, `folderDisplay`, `source` (`project`, `home`, `extra` = a plugin, `registered`), `editable`, `readOnly` (why not), `modelText`, `tools`, `ownTools` (the `schemas` keys of tools.ts), `use` (the `use` array's entries: `feature`, `only`, `text`, `line`), `files` (the five definition files first, present or not, then the rest; `kind`, `language`, `present`, `sizeText`), `hooks` (every hook `assistant.ts` fires: `name`, `kind`, `params`, `description`, `returns`, `present`, `line`), `providers` (container features with tools, `used`, `only`), `history` (`.history/` backups), `shadows`, `error` |
| `GET /assistant/<name>/file?path=` | one file of the folder as `GET /file` draws it (`pathDisplay` is `<name>/<path>`); a plugin's file reads fine |
| `POST /assistant/<name>/file/save` | `{path, text, digest}` as `/file/save`. 403 for a plugin or registered assistant (`readOnly: true`); a `.ts`/`.js` file is loaded in the vm from a `.staged-` copy first and answers 422 (`parse: true`) when it does not load, the file on disk untouched; the old file goes to `.history/<stamp>-<path>` (`backedUp`); then `manager.discover()`, every live instance reloads and an `assistant-changed` frame (`name`) follows |
| `POST /assistant/<name>/edit` | a pure edit of the text sent: `{op: "hook", hook, text}` appends a hook stub (and the `Assistant` type import) to a hooks.ts text; `{op: "use", feature, only?, options?, remove?, text}` adds, replaces or removes a `container.feature('x').toTools(...)` entry of the `use` array in a tools.ts text (a text with no `use` gets one). Answers `{ok, text, line}`; the tile puts it in the buffer and the human saves |
| `POST /assistant/<name>/copy` | copy a plugin's or the home folder's assistant into `<project>/assistants/<name>` (without `.history`, `node_modules`, the desktop's stamp), where it wins the name. 400 for the project's own, 409 when the folder exists |
| `POST /assistant/<name>/rollback` | `{path}`: the newest `.history/` backup of the file back in place |
| `POST /chat/open` | `{assistant, conversationId?, target?, about?}` (empty or `new` makes `desk-<date>-<6>`). `about: {assistant}` opens the chat about an assistant (below); `about: {helper: {registry, id}}` about a helper (the inspector's brief, `src/workbench/helper-brief.ts`: origin, docs, source up to 24 000 characters, how to work; 404 for a helper the registry lacks). Either is kept with the conversation. Answers `{ok, assistant, conversationId, thread, title, modelText, tools, messages, busy, live}`; `messages` are `{id, role user/assistant, text, tools}` (one assistant message per turn, tool results matched by call id); `live` is the reply in flight |
| `POST /chat/send` | `{assistant, conversationId, text}` starts a reply and answers `{ok, turnId}` at once; 409 while a reply runs |
| `GET /chat/extensions?assistant=&conversationId=` | `{features, extensions}`: container features that have tools (`name`, `description`, `builtIn` all/some, `tools` with `builtIn`, `options` that are one plain value), and the conversation's list (`src/workbench/extensions.ts`) |
| `POST /chat/extensions` | `{assistant, conversationId, extensions}`: replace the list. Each entry (`feature`, `only?`, `options?`, `folder?`, `source?`) must build. Answers `{ok, extensions}` or `{ok: false, error}`; a `chat-extensions` frame follows. Kept per thread in the history diskCache |
| `POST /chat/stop` | `{assistant, conversationId}`: aborts the reply (`chat-done` with `aborted: true`). `{ok, stopped}` |
| `POST /chat/settings` | `{assistant, conversationId, provider?, model?, reasoningEffort?}`: this conversation's own routing, saved with it. A missing field stays, an empty one goes back to the assistant's own; a new provider with no model drops the old model. A provider or model change builds the assistant again on the same history. Answers the open view (now with `settings` and `routing` `{provider, model, reasoningEffort}`); 400 for an unknown provider or effort, 409 while a reply runs. A `chat-settings` frame follows |
| `GET /chat/models?assistant=&conversationId=` | `{settings, routing, own {provider, model, text}, efforts, choices [{provider, model, title, detail, ready}]}`, from the AI view (`modelChoices`): providers that can answer, the default first, each with its default model, then models a found server or `KNOWN_MODELS` names |
| `POST /chat/retry` | The last turn again: a failed turn reruns its input; a good one is taken out and its message sent again. `chat-history` (`messages`) comes first, then the turn's frames. Answers `{ok, turnId}` |
| `POST /chat/clear`, `/chat/rename` `{title}`, `/chat/delete` | Clear the transcript (keeps tools and settings; `chat-history` with no messages), name it (history title and `metadata.workbenchTitle`; a chat with nothing saved says so), delete its history and stored settings (`chat-deleted`) |
| `GET /chat/export?assistant=&conversationId=` | `{title, filename, markdown}` (`transcriptMarkdown`) |
| `GET /tools` | the project's own tools: `notice`, `count`, `tools` (`id`, `title`, `hint`, `glyph`, `kind` page/view, `renderer`, `page`, `address` `tool/<id>` or `page/<path>`, `origin` own/plugin, `fileDisplay`, `keys` `{action, key, label}`), `errors` (`file`, `fileDisplay`, `id`, `origin`, `error`: a file that did not load or a bad shape, one line) |
| `GET /tools/<id>?<params>` | `{ok, id, title, hint, origin, fileDisplay, keys, kind, renderer, ms}` plus `stacks` (`id`, `title`, `tone`, `count`, `cards` `{id, title, subtitle, preview, badge, tone, address}`), `tree` (the console's tree) or `markdown` (`table` comes as markdown). `ok: false` with `error` when `data()` throws or returns the wrong shape; a file that did not load answers by its file name with `declarationError: true`. 404 for no such tool |
| `POST /tools/<id>/actions/<action>` | `{params, target: {stack, card}}`. Answers `{ok, done: false, token, step}` (step `{kind: choose, title, items [{title, detail}]}`, `{kind: ask, title, initial}`, `{kind: confirm, question, yes}`) or `{ok, done: true, result: {flash, reload, open}}` or `{ok: false, error}` |
| `POST /tools/actions/<token>/answer`, `…/cancel` | `{value}`: a row index, text or a boolean; a null value cancels. Same answers; a cancel is `{done: true, cancelled: true}`. Unanswered actions end after 10 min |
| `/ws` | `hello`, `subscribed`, and for attached helpers `state` (`text` = pretty state) and `event` (`name`, `text`, `at` ms) frames. For runs: `run-start` (`runId`, `display`), `run-output` (`runId`, `seq`, `stream` stdout/stderr/note, `text`, ANSI stripped), `run-exit` (`runId`, `code`, `signal`, `stopped`, `ms`, `text` = `exit 0 · 1.2 s`). `serve` (`serve` = the serve view) on every serve state change. Chat: `chat-start` (`text` = the user's message), `chat-delta` (`text` = the next piece), `chat-tool` (`tool` = `{id, name, argsText, status running/done/failed, resultText, ms}`, sent at start and at end with the same id), `chat-done` (`text`, `aborted`, `ms`), `chat-error` (`error`), `chat-reasoning` (`text` = the next piece of thinking, never saved), `chat-settings` (`settings`, `routing`, `modelText`, `title`), `chat-history` (`messages`), `chat-deleted`; each has `assistant`, `conversationId`, `turnId` |

Every helper view (registry cards, `GET /helper`, `GET /command`) carries
`origin`: `{kind, tag, label, file?, dir?, root?, plugin?}`, kind `own`,
`borrowed`, `plugin`, `home` (`~/.luca/<type>`) or `builtin`
(`src/workbench/origins.ts`). The host scans the folders the CLI loads, in
its order (plugins from `LUCA_PLUGINS`, literal `discover`/`usePlugin` calls
in `luca.cli.ts`, own folders, `~/.luca`), and names files as the helpers
feature does; the first folder with a name wins, as in a registry. A name
the helpers feature did not register is built in. Read once per host.

Command children run in their own process group with stdin closed,
`FORCE_COLOR=0` and `LUCA_WORKBENCH_RUN=<runId>`. They die with the host: on
close, and in a process `exit` handler. A `kill -9` of the host leaves them
running (nothing can catch that).

### Borrowing helpers

Seeing a helper in one project and getting it into another. The host of
the **receiving** project does all file work (`src/workbench/borrow.ts`,
`plugins.ts`, `cli-file.ts`, `changes.ts`); Swift only draws plans and
sends confirms. The source project is only read. `applyPlan` refuses any
path outside the receiving project (or the plugins folder, for a link).

- **take into…**: `t` on a registry card (`lucaRegistry.take`) or in the
  helper tile (`lucaHelper.take`), or `:take <project> [copy|borrow]`. The
  palette asks for the project (known ones, or `another folder…`), then the
  way. A built-in helper cannot be taken. It opens a `luca-change` tile in
  the receiving project, `luca://<target>/change?route=borrow&op=…`; the
  address holds the whole `ChangeRequest`. Keys there: `a` write (palette
  confirm), `i` include the relative imports (copy), `o` write over clashes
  (confirm, then a new preview), `r` plan again, `u` its registry. After a
  write the tile restarts the host and focuses the registry.
- **Hard copy**: the file goes to the same place under the receiving
  project's `<registry>/` (an assistant folder is copied whole). A file
  that exists and differs, or a name another origin already loads, is a
  clash; a built-in name is blocked (a project helper of that name never
  loads). Relative imports are followed and listed, copied only with `i`.
  Packages the target lacks are named in a note.
- **Borrow**: `luca.cli.ts` gets one marked block
  (`// luca-desktop:borrowed:begin` … `:end`) with
  `async function lucaDesktopBorrowed(container)` holding one
  `await container.helpers.discover("<type>", { directory: "<abs>" })` per
  folder. The CLI calls the file's exported `main(container)` before it
  discovers the project's own folders (`loadCliModule` in `runner.ts`). A
  file with no `main` (or no file) gets `export async function main` inside
  the block; a file with its own `main` gets one marked line,
  `await lucaDesktopBorrowed(container) // luca-desktop:borrowed`, as the
  first statement of it. Removing the last borrow takes out the block and
  that line and gives back the user's file byte for byte (a file only the
  app made is deleted). discover takes a folder, so a borrow brings every
  helper of that type in it; the preview lists them. Luca cannot discover
  one file. Endpoints and assistants cannot be borrowed (discover does not
  register them): hard copy them.
- **Plugins tile** `luca://<project>/plugins` (`Space b`, `b` in the
  registry, the palette's `<project> plugins`): the `LUCA_PLUGINS` line,
  installed plugins with on/off and what they add, entries that resolve to
  nothing, and the borrowed folders. `j`/`k` move, `t` plans on/off (or stop
  a borrow), `l` links a known project folder (`:link-plugin <path> [name]`),
  `:plugin on|off <name>`. The plan shows at the top; `a` writes, `c` drops.
  What a plugin adds is one count pill per helper type (in the type's
  color); `o` (or a pill) opens the names, one block per type, 40 at a time
  with "more", each a link to its tile when the plugin is loaded
  (`PluginsContent.address`: features, clients, servers and selectors to the
  inspector, commands to the command tile; endpoints and assistants have
  none). `/` asks for a filter (`:filter <text>`): only names with that
  text show, in every plugin (`PluginsContent.adds(_:matching:)`).
- **Plugins folder**: `~/.luca/plugins`. `LUCA_WORKBENCH_PLUGINS_DIR` moves
  it (tests, check runs); then `.env` names a plugin by its full path,
  which the CLI also reads. Bun reads `.env` only for variables not already
  set, so a host started with `LUCA_PLUGINS` in its environment ignores the
  project's line: check runs must `unset LUCA_PLUGINS`.
- Origin colors (`WorkbenchStyle.originColor`): own accent, borrowed
  `syntax.function`, plugin `syntax.type`, `~/.luca` `syntax.property`,
  built in faint. Registry cards draw `origin.tag` in that color
  (`IndexCard.badgeTone`). Diffs: added `good`, removed `bad`; clashes `warn`.
- Tests: `test/workbench-borrow.test.ts` (pure parts and a real host
  on scratch projects; `WORKBENCH_TEST_TMP` picks the folder),
  `Tests/LucaDesktopTests/BorrowHelpersTests.swift`.

### Endpoints and requests

- The host reads `endpoints/` (else `src/endpoints/`, as `serve` does)
  itself: each file through `helpers.loadModuleExports`, then the same
  `Endpoint` class `serve` mounts, `toOpenAPIPathItem()` per method. So the
  list needs no server, and matches what the server answers. Modules load
  again only when a file's mtime changes (`EndpointIndex`). A file that
  throws is listed under `errors`; a load runs the file's top-level code in
  the host.
- Groups: the route's first tag, else its first path segment (`/health`).
  Tags first, then path groups. zod marks a field with a default required;
  the host does not (`fieldOf`).
- **One serve child per host** (`ServeControl`). Start picks a free port
  from 3100 (`networking.findOpenPort`) and runs
  `luca serve --port N --no-open` through `CommandRuns`, so it is a run:
  its log is `GET /runs/<runId>` and the run frames, it dies on stop, on
  host close and in the host's exit handler, and the app's quit ends the
  host. `starting` until `GET /openapi.json` answers (30 s, then `failed`
  and stopped); an exit that was not a stop is `failed`, `error` = the
  child's last lines. `CommandRuns.start` takes an `onExit`. Closing the
  endpoints tile does not stop the server; the host's end does. Serve binds
  `0.0.0.0` (express default); requests go to `127.0.0.1`.
- **Endpoints tile** `luca://<project>/endpoints` (`Space h`, the palette's
  `<project> endpoints`): routes with a method pill and the path (`:params`
  in the key color), the server card (`ServeBadge`, start/stop) and its log
  (`RunTranscriptCard`, last 60 lines). `j`/`k`, `Enter` opens the request
  tile, `s` start/stop, `l` the log, `:request <METHOD> <path>`,
  `:serve start|stop`.
- **Request tile** `luca://<project>/request/<METHOD>/<path>` (id
  `GET/users/:id`, `RequestAddress`). Fields grouped Path / Query / Body,
  a raw JSON body, then the response: status, time, size, the URL sent,
  headers (`h`), body as the console's value tree (two levels open) or text
  (`v`). `r` or `Enter` in a field sends; `:arg <name> <value>`,
  `:body <json>`, `:send`. Address options prefill fields (`?id=4`,
  `?body=`). A send with the server stopped asks in the palette to start
  it, then sends when it is up. `u` the endpoints tile.
- `ServeMonitor` (`ServeAndHTTP.swift`) is the shared, dumb view of the
  serve child: the host's state from `serve` frames and its log from the run
  frames. `@Published` sinks fire before the value is stored: act on the
  value passed, or on the next turn (as `RequestContent.serveChanged` does).
- Colors (`HTTPTone`, pure and tested): GET info, POST good, PUT warn,
  PATCH `syntax.type`, DELETE bad; 2xx good, 3xx info, 4xx warn, 5xx bad;
  running good, starting info, failed bad, stopped faint.
- Tests: `test/workbench-endpoints.test.ts`,
  `Tests/LucaDesktopTests/EndpointsTests.swift`. The borrow tests resolve
  their temp folder with realpath (`/var` vs `/private/var`).

### Docs, assistants and chat

- Client shapes: `Sources/Projects/WorkbenchDocsChat.swift`.
- **Docs** `Space d` (palette `<project> docs`): card stacks by model, each
  model in its color (`WorkbenchStyle.slotColor(slot)`, the host's slot;
  `IndexStack.tone` / `IndexCard.tone` = `slot:<n>` draw the dot and card
  bar). `m` the models view, `?model=` focuses a stack. A project with no
  `docs/` gets the host's one-line notice. `n` makes a document: the
  palette asks the model (not with one), then the title; `:new [Model]
  [title]` in the tile and `:new-doc [Model] [title]` anywhere take them
  typed (a first word that names a model, `Other` for none). The host
  writes the file (`POST /docs/create`, `LucaDocsContent.newDocument`),
  the doc opens in source view beside the tile, and the project's docs
  tiles reload.
- **Models** `Space D`: a card per model, fields with kind-colored types
  (`WorkbenchStyle.fieldColor`), enum values as chips, the default marked.
- **Doc**: `WorkbenchDocBuffer` holds the file as `DocText` (byte for byte)
  plus the digest it came from. Preview and rich show the frontmatter as
  fields (`DocFieldsCard`, read only; edit it in source). Rich is
  `WorkbenchRichEditor` (swift-markdown-engine, `RichEditorTheme`); source
  is the shared `SourceEditorController`, which takes any
  `SourceEditorText`. `Cmd-s` / `:w` sends the
  whole text with the digest; a 409 becomes a conflict bar (`d p` keep
  mine, `d o` take the file). `:replace <old> => <new>` edits from the
  command line (quiet check runs).
- **Assistants** `Space c`: an Assistants stack (model, tools, conversation
  count; `Enter` or `n` new chat, `c` past conversations in the palette) and
  Recent conversations (`Enter` reopens). It reloads on `chat-done`.
- **Doc → chat**: `c` in a doc tile picks an assistant (the last one picked
  first, kept in the app's defaults, so `Enter` takes it again) and opens a
  chat beside the tile with the document as its first message
  (`chatOpener`, whole up to 24 000 characters), through the chat address's
  `?say=<text>`, which the chat tile sends once it is open and then drops.
- **Companion tiles.** `Shell.open(uri, near:, group: true)` is how a tile
  opens something that belongs to it (lucaArchitect about an assistant or a
  helper, a chat's tech support, a helper's console). In a free workspace
  the companion takes half of that tile's own space (`Shell.splitFrames`,
  pure: right of a wide tile, below a tall one; the tile keeps the other
  half) and the two are grouped; an organized slot splits the same way
  (`Workspace.add`). Never place a companion by hand; a plain `near:`
  without `group` still opens beside the tile at full size.
- **Chat** `Space n` (one assistant opens straight away, else the palette
  asks): `luca://p/chat/new?assistant=x` asks the host for an id and the tile
  takes it (`uri.with(id:)`), so a restart reopens the same conversation.
  `WorkbenchChatTranscript` (pure) applies the frames: one reply at a time
  per conversation, so every frame of it belongs to the live turn.
  `i` writes, `Enter` sends, `Ctrl-c` stops, `h` history, `n` new,
  `:say <text>` sends from the command line. `t` adds a feature's tools to
  this chat only (tools, folder, options in the palette; a header chip
  opens its settings). `s` opens lucaArchitect as its tech support
  (`?extends=<id>&extendsAssistant=<name>`, `POST /chat/open` `target`): the
  host gives it `extendChat`, `inventChatTools` and friends for that chat. An
  assistant on a coding agent gets its added tools over `/mcp/chat/<token>`.
  Colors: user accent, assistant
  `syntax.function`, tool `syntax.type`; tool state running info, done good,
  failed bad (`roleColor`, `toolStateColor`).
- **Chat settings** (`WorkbenchChatSettings.swift`, the strip under the
  header, `LucaChatSettingsStrip`): a full chat. `, m` model, provider and reasoning effort for this
  conversation (`:model [provider] <name>`, `:effort <level|default>`),
  `, T` show thinking, `, o` show tool output (both app-wide, in the app's
  defaults; with tool output hidden each call is one line), `o` opens one
  message's calls and thinking, `] ]` / `[ [` move between messages,
  `y m` copies one, `, r` retry, `, n` rename, `, e` export (copy, or a
  file in Downloads), `, X` clear, `, D` delete. A chip in a strong tint is
  this chat's own choice. Thinking is streamed only: the host never saves
  it, so a reopened chat has none for old turns.
- Not there yet (the host has no such thing): access mode, project mode,
  presets, skills, handoff, questions, the send queue, attachments, save
  to docs.
- The host keeps one assistant instance per open conversation
  (`manager.create(name, {cached: false, historyMode: 'session'})` +
  `resumeThread(<prefix><conversationId>)`), saves after each reply as
  `luca chat` does. Thread = `<assistant>:<cwdHash>:<conversationId>`, so
  `luca chat`'s daily threads open here too.
- **History location**: `conversationHistory` uses `diskCache` at
  `$XDG_CACHE_HOME/luca/disk-cache-<cwd hash>` (default `~/.cache/luca`),
  one folder per project folder. Tests and check runs set `XDG_CACHE_HOME`
  to a scratch folder; `GET /assistants` reports `historyDir`.
- **No-LLM chat**: the host tests put a stand-in model in the scratch
  project's `luca.cli.ts` (`modelProviders.registerLocal('stub', …)` and
  `registerTransport('openai-chat-completions', …)` yielding `chunk` events
  and a tool call). Use the same trick for a check run.
- Tests: `test/workbench-docs-chat.test.ts`,
  `Tests/LucaDesktopTests/DocsAndChatTests.swift`.

### A project's own tools

Guide for project authors: `docs/declaring-tools.md`.

- **Declaration**: one file per tool in `workbench/` (the project's, then
  each loaded plugin's, from `origins.ts` `sources()`), default export a
  tool or an array. Page tool `{id, title, hint?, glyph?, page}`; view tool
  `{id, title, hint?, glyph?, renderer?, data(ctx), actions?}`, `ctx` =
  `{container, params, project}`. Files load through
  `helpers.loadModuleExports` and again when their mtime changes, so an edit
  shows on the next reload, no restart. The project's own id wins a clash.
- **Host** (`src/workbench/tools.ts`, `ToolIndex`, `ActionRuns`): shapes
  are pure and tested (`shapeTool`, `shapeData`, `shapeStep`,
  `shapeResult`, `loadErrorText`). The last stacks' raw cards are kept per
  tool and params, so an action's `target` is the author's own card object.
  An action whose `run` returns an iterator is a dialogue: one token per
  running action, `gen.return()` on cancel.
- **App**: page tools open the existing page tile (`page/<path>`); view
  tools are `luca-tool` (`ToolContent`, an `IndexContent` in
  `Keymap.indexKinds`): `stacks` draws `IndexView`, `tree`
  `ConsoleTreeRow`, `markdown` `tilesMarkdown()`, an error a bad-tinted card.
  Card ids are `<stack>/<card>`; a card with no address opens nothing.
- **Declared keys** (`Sources/Input/ToolKeys.swift`, pure): one stroke
  each; never a shell chord, `Mod` or `Esc`; a clash with the kind's or
  every tile's keys is a warning in the tile and the built-in wins.
  `TileContent.declaredKeys` / `pressDeclared` carry them; `Shell.handle`
  routes them before the router; the keys view lists them as "This tool's
  actions". Actions run through the palette (`choose`, `ask`, `confirm`);
  `Esc` cancels on the host (`palette.onEnd`, one turn later, as the web
  bridge does). `.` lists every action (clashing ones too), `:action <id>`
  runs one from the command line.
- **Lists**: `ProjectToolsStore` caches `GET /tools` per project on each
  new host (and `r` in the overview). The overview's Tools grid shows
  declared tools after the built-in ones with `DeclaredMark` (a small
  diamond) and a `project` / `plugin` tag, plus a warn card listing failed
  declarations. Palette group `own tool`. `Space w` (`luca.tools`) asks the
  host afresh and lists them. Colors: own `syntax.keyword`, plugin
  `syntax.type` (`WorkbenchStyle.declaredColor`); kind `luca-tool` is
  `syntax.keyword`. Named tones (`good`, `warn`, `bad`, `info`, `accent`,
  `muted`) and `slot:<n>` go through `WorkbenchStyle.toneColor`; a card's
  tone also colors its badge.
- Tests: `test/workbench-tools.test.ts`,
  `Tests/LucaDesktopTests/ProjectToolsTests.swift`.

## Tile kinds

Registered in `TileKinds.registerBuiltIns()`. `*` marks a card-stack index
(in `Keymap.indexKinds`).

| Kind | Address | Source |
|---|---|---|
| `luca-project` | `luca://<project>/project` (`Space o`) | `Tiles/Workbench/ProjectOverviewContent.swift` |
| `luca-registry`* | `luca://<project>/registry?stack=<registry>` (`Space r`) | `Tiles/Workbench/RegistryContent.swift` |
| `luca-helper` | `luca://<project>/helper/<registry>/<id>?view=docs\|source` | `Tiles/Workbench/HelperContent.swift` |
| `luca-ai` | `luca://<project>/ai` (`Space a`) | `Tiles/Workbench/AiContent.swift`: coding agents, API keys, model providers, found servers, local models. `s` scans, `a` adds a found server as a provider (model, then which file), `k` sets a key (a hidden field; `PaletteController.ask(secret:)`), `c` checks the agents again, `x` opens `luca setup` for a missing local model (not run until `r`) |
| `luca-servers` | `luca://<project>/servers` (`Space s`, `s` in the registry) | `Tiles/Workbench/ServersContent.swift`: running instances, then the registry's servers. `s` starts with defaults or stops, `S` asks for options, `Enter` opens an HTTP server as a page tile. `:start <id> [options]`, `:stop`, `:stop all` |
| `luca-console` | `luca://<project>/console[/<session>]?run=<code>` (`Space e`) | `Tiles/Workbench/ConsoleContent.swift` (model, transcript, docs pane), `ConsoleAssist.swift` (what the list shows, when `Enter` runs; pure), `ConsoleInput.swift` (the `NSTextView` input), `ConsoleDocViews.swift` (`DocCardView`, the list, the signature strip) |
| `luca-command` | `luca://<project>/command/<id>?<field>=<value>` (`Space x`) | `Tiles/Workbench/CommandContent.swift` |
| `luca-change` | `luca://<project>/change?route=borrow&op=copy\|borrow\|unborrow&…` | `Tiles/Workbench/ChangeContent.swift`, `ChangePreview.swift` |
| `luca-plugins` | `luca://<project>/plugins` (`Space b`) | `Tiles/Workbench/PluginsContent.swift` |
| `luca-endpoints` | `luca://<project>/endpoints` (`Space h`) | `Tiles/Workbench/EndpointsContent.swift` |
| `luca-request` | `luca://<project>/request/<METHOD>/<path>?<field>=<value>` | `Tiles/Workbench/RequestContent.swift`, `ServeAndHTTP.swift` |
| `luca-docs`* | `luca://<project>/docs?model=<name>` (`Space d`) | `Tiles/Workbench/DocsContent.swift` |
| `luca-models` | `luca://<project>/models` (`Space D`) | `Tiles/Workbench/DocsContent.swift` |
| `luca-contentbase` | `luca://<project>/contentbase?model=<name>&pane=model\|query` (`Space m`, `e` in the models tile) | `Tiles/Workbench/ContentbaseContent.swift`, `ContentbaseViews.swift`, shapes in `Projects/WorkbenchContentbase.swift` |
| `luca-doc` | `luca://<project>/doc/<id>?view=preview\|rich\|source` | `Tiles/Workbench/WorkbenchDocContent.swift` |
| `luca-assistants`* | `luca://<project>/assistants` (`Space c`) | `Tiles/Workbench/AssistantsContent.swift` |
| `luca-chat` | `luca://<project>/chat/<conversationId>?assistant=<name>` (`Space n`) | `Tiles/Workbench/WorkbenchChatContent.swift` |
| `luca-assistant` | `luca://<project>/assistant/<name>?file=<path>&view=preview\|rich\|source` (`e` in the assistants tile, `:edit-assistant [name]`) | `Tiles/Workbench/AssistantEditorContent.swift` |
| `luca-terminal` | `luca://<project>/terminal` (`Space t`, `:terminal`) | `Tiles/Terminal/TerminalContent.swift` |
| `luca-file` | `luca://<project>/file/<path>` (`Space f`, `:file [path]`) | `Tiles/File/FileContent.swift` |
| `luca-page` | `luca://<project>/page/<path>?<query>` or `…/page/https://…` (`Space g`, `:page`) | `Tiles/Web/PageContent.swift` |
| `luca-tool`* | `luca://<project>/tool/<id>?<params>` (`Space w`) | `Tiles/Workbench/ToolContent.swift` |
| `luca-canvas` | `luca://<project>/canvas/<id>` (`:canvas <name>`, or an assistant's `createCanvas`) | `Tiles/Web/CanvasContent.swift`, `CanvasLockdown.swift` |
| `app-projects` | `app://desktop/projects` (`Space P`, `:projects`) | `Tiles/App/ProjectsContent.swift` |
| `app-file` | `app://desktop/file/<path>` (`:keymap edit`, `:layout edit`) | `Tiles/File/FileContent.swift` |

Notes on the kinds:

- Registry: `Space r` opens the focused tile's project, else the one
  project the workspace shows, else the palette asks (`ProjectPick`). `o`
  or a row in the project tile opens it; `?stack=` focuses that registry's
  stack once, at load. Every project key (`Space o/r/e/x/b/h/d/D/c/n/t/f/g`)
  picks the project the same way (`Shell.withProject`), and `Space w`.
- Project: name, folder, Luca version, a Tools grid (each tool with its
  leader key) and the registries as stat cards in their kind colors.
- Helper (the inspector): two views, `docs` and `source`, a toggle in the
  header (`P` / `E`, `?view=`). Docs: last call, live state, events (newest
  first, at most 40, `HelperEventLog`), methods, getters, options, state
  schema, then the docs with `tilesMarkdown()`. `m` picks a method in the
  palette and asks for arguments with the host's `argsHint` (no prompt when
  the host says `askArgs: false`). `x` clears events, `u` the registry.
  Source: the helper's file (`GET …/source`, read on the first switch) in
  the shared `SourceEditorController` on a `WorkbenchDocBuffer`, the doc
  tile's save and conflict flow (`Cmd-s`, `:w`, `:wq`, `:e!`, `:replace`,
  `d p` / `d o`); `i` edits. A plugin's or built-in file shows a lock bar
  and refuses saves; a saved change loads on the next host restart (`R`).
  `e` lists the helper's `@example` blocks in the palette (one runs at
  once) and runs the pick in a console beside the tile, grouped with it:
  the console address is `console/<registry>-<id>?run=<code>`, one host
  scope per helper, so the next example sees the names the last one set;
  an open console for that helper takes the code instead
  (`ConsoleContent.run`). `:example <id>`, `:eval <code>` do the same. `c`
  opens lucaArchitect beside the tile (`?aboutHelper=<registry>/<id>`,
  grouped; one per helper, a second `c` focuses it; without lucaArchitect
  the palette asks who): the host briefs it on the helper (`POST
  /chat/open` `about.helper`) and the chat header shows `about
  features.fs`, a click back to the inspector.
- Console: `luca://<project>/console/<session>` is another host scope
  (`ConsoleContent.session`, `default` with no id; the inspector opens one
  per helper); `?run=<code>` runs once the host is there and the option is
  dropped. Each entry is a card: input, logs, then the host's tree or the
  error with its stack. `Enter` runs, `Shift-Return` adds a line (the shell
  inserts it, as for chat), up and down recall `ConsoleHistory`; `h` picks
  from it. History is `console/<project>.json` under the app folder. `x`
  clears, `X` resets the host scope. `:eval <code>` runs code from the
  command line (quiet check runs: posted keys never reach a text field).
- Command: `Space x` lists the project's commands in the palette (with no
  host yet it opens the registry on the commands stack). `r` (or `Enter` in
  a field) runs, `Ctrl-c` stops, `:arg <name> <value>`. `RunTranscript`
  applies `run-output` frames by `seq`. Closing the tile stops its run.
  `?then=` names what a run that exits 0 leads to, once (`afterSuccess`;
  the option and `run` go, so a restored tile only shows the form):
  `open-project` opens the folder the `output` field names as a project
  (bootstrap), `scaffold` opens the file the output says it wrote
  (`scaffoldedPath`, pure) and restarts the host.
- **New project** (`Space N`, `:bootstrap [path]`, `n` or "New project…"
  in the projects tile; `Shell+New.swift`): the palette asks the folder,
  then which of the machine's plugins the project loads (a pick list that
  stays up: each row ticks one, the first row creates), then
  `luca bootstrap --output <folder> [--use-plugins a,b] --no-setup` runs
  in a command tile on the project in focus's host (else the portfolio's;
  `impliedProject`), with `then=open-project`. The plugin list comes from
  `GET /plugins` of any running host (`ProjectHub.anyClient`), or the
  runner's host is started for it (`ProjectHub.withClient`).
- **Scaffold** (`Space S`, `:scaffold [type] [name]`): the host's form for
  `luca scaffold` gives the types (`type` is a declared positional enum;
  `subcommands` the descriptions); the palette asks the type and the name,
  and the command tile opens with both filled and `then=scaffold`, so a
  description can go in before `r` runs it.
- **Terminal**: a login shell (SwiftTerm) in the project's folder, from
  `projects.json`; it needs no host. `i` gives it the keyboard; then every
  key goes to the shell, `Esc` too, except `Mod` keys and the few `global`
  keys. `Mod-Esc` (`terminal.leave`) goes back to Normal. `R` a new shell
  after an exit. `?run=<name>` types one of `TerminalContent.startCommands`
  into the new shell and takes the keyboard; only those names run (a page
  can open tiles), and the option is dropped once typed so a restore is a
  plain shell. **Running `luca setup`**: `:setup`, or `S` / the "Run luca
  setup" button in the AI tile, opens `luca://<p>/terminal/setup?run=setup`,
  so its questions get a real terminal (command tiles have stdin closed).
- **File**: the source editor (CodeMirror with vim keys) on one file,
  language by extension. A project file reads and saves through the host
  (`GET /file`, `POST /file/save`); an app file reads and writes the app
  folder here (`FileContent.readLocal` / `saveLocal`, same sha1 digest rule).
  Both reuse `WorkbenchDocBuffer`: `Cmd-s` or `:w` sends the whole text with
  the digest it loaded; a changed file on disk is a conflict bar (`d p` keep
  mine, `d o` take the file). `:replace <old> => <new>`, `:e!`, `:wq`. Keys
  `lucaFile.*` and `appFile.*`. Saving `keymap.yml` reloads the keymap;
  saving a layout re-applies it where it is loaded (`Shell.layoutFileSaved`).
  `Space f` lists `GET /files` in the palette; with no host yet it asks for
  a path.
- **Page**: a serve path loads on the project's `luca serve` child (the
  same `ServeMonitor` as the endpoints tile); while it is stopped the tile
  shows its state and `s` starts it. An `https://` id is any page. The page
  stays on its first origin; frames may load others (`TileWebView.allows`).
  Zoom (`+ - 0`) is per address in the app's defaults. A page field takes
  Insert mode; `i` gives the page every key until `Mod-Esc`.
- **Web bridge** (`Tiles/Web/WebTileHost.swift`): seeds
  `window.__AL_HOST__` (`kind, width, height, focused, scheme, accent,
  textSize, project: {id, color}, vars, shell`), fires `al:host` on change,
  and takes `alHost` messages: `open` (only the page's own project:
  `WebTileHost.address`), `keys`, `editing`, and the `ShellRequest` ones
  (`choose`, `ask`, `confirm`, `flash`, answered with `al:reply`). Page keys
  win over tile keys in that tile, never over `Space`, `:`, `?` or `Esc`.
- **Projects**: the known projects with their color, path, host state and
  when last opened; `j`/`k`, `Enter` goes to one, `a` asks for a folder,
  `n` bootstraps a new project.
- Colors: each project has its color (header band, name tag, border, body
  wash, status line). Kinds have hues by family (`Theme.kindColor`).

## Contentbase tile

Define models and query documents. The host does all of it
(`src/workbench/models.ts`, tests `workbench-models.test.ts`).

- **Workspace models** load in every project: luca's `markdownModels`
  feature (`src/node/features/markdown-models.ts`, installed by
  `contentDb.load()`) reads `docs/models.md`, `docs/models/*.md` and
  `docs/models/*.ts` next to `docs/models.ts`, which wins a name clash.
  `extract.text|list|code` are ready-made section extractors in scope.
- **A tile model** is `docs/models/<kebab name>.md`: frontmatter
  `luca-model:` holds the spec, the `## Name` block under it is written
  from the spec. It is editable only while the body is still the one the
  spec gives; a hand edit makes it read only. Every other model shows the
  same form read only, with its file (`e`).
- **Templates** are `docs/models/<name>.template.md`, the first place
  contentbase looks (`collection.readTemplate`, `cnotes create`). They are
  never documents and never model files. `t` opens one in a file tile (a
  missing one is made on its first save).
- Removing or renaming a model leaves an empty stub registered until the
  host restarts (contentbase has no unregister); lists skip it.
- Keys: `j`/`k` models, `m`/`q` panes, `n` new, `a` field, `s` section,
  `w` where row, `o` sort, `r` run, `c` copy as code, `x` delete,
  `Cmd-s`/`:w` save. `:new <Name>`, `:model <Name>`, `:where <path> <op>
  <value>`, `:query <json>` (the DSL as is).
- Tests: `Tests/LucaDesktopTests/ContentbaseTests.swift`.

## The assistant editor

One assistant's folder in a tile (`AssistantEditorContent`, kind
`luca-assistant`), the host doing the reading (`src/workbench/assistant-editor.ts`,
tests `test/workbench-assistant-editor.test.ts`; Swift
`Tests/LucaDesktopTests/AssistantEditorTests.swift`).

- **What it edits**: any file in the folder. The sidebar lists the five
  definition files first (CORE.md, ABOUT.md, tools.ts, hooks.ts, voice.yml;
  a missing one is faint and `+` makes it on the first save), then the rest
  (`skills/`, `guides/`, anything), then the hooks and the tool providers.
  A markdown file has preview, rich and source views (the frontmatter shows
  as a card; edit it in source); any other file is source. The buffer, save
  and conflict flow is the doc tile's (`WorkbenchDocBuffer`, digest, `d p`
  / `d o`).
- **Hooks**: the host lists every hook `assistant.ts` fires
  (`HOOKS` in `assistant-editor.ts`, checked against the source by a test),
  ticked when hooks.ts exports it. `h` (or a row) picks one; the host
  appends the stub (`POST /assistant/<name>/edit`) to the text in the
  buffer and the human saves. A hook that is there opens hooks.ts.
- **Tool providers**: the container features that have tools (the chat
  extensions catalog), ticked when the `use` array names them. `t` adds one
  (`container.feature('x').toTools()`) or takes a used one out; the same
  pure edit of the buffer's text. `:use <feature> [tool,tool]`, `:unuse
  <feature>`. Tools of its own (`schemas`) show as `own:`.
- **Saves are checked**: a `.ts` save is refused (422) when the file does not
  load; the message shows in a bar and the text stays. The old file goes
  to `.history/`, and every live instance of the assistant reloads
  (`chats.reloadAssistant`), so a chat with that assistant has the change
  from its next message. `assistant-changed` frames reload the tile.
- **A plugin's assistant is read only** (`source: extra`): the files read,
  saves answer 403, the tile says why, and `C` copies the folder into the
  project's `assistants/` (`POST /assistant/<name>/copy`), where the copy
  wins the name and is editable. A `home` assistant (`~/.luca/assistants`,
  where the app installs lucaArchitect) is editable in place: it is the
  user's.
- **Build it with lucaArchitect**: `c` opens a chat beside the tile at
  `luca://<project>/chat/new?assistant=lucaArchitect&about=<name>` (one per
  assistant; a second `c` focuses it; without lucaArchitect the palette asks
  who). `POST /chat/open` with `about` keeps the link with the conversation
  (like `target`) and, on each session start, adds the system prompt
  extension `workbenchAssistantEditor` (`AssistantEditor.brief`): the
  folder, every definition file in full (24 000 characters each at most)
  and the small other files, the hooks list, the tool providers, and how
  to work. It also gives the chat the editor's tools
  (`listAssistantFiles`, `readAssistantFile`, `writeAssistantFile`,
  `rollbackAssistantFile`, `testAssistant`, `reloadAssistant`), which go
  through the same save path (parse check, backup, reload; refused for a
  plugin's assistant), so lucaArchitect's own write guard (project roots
  only) never gets in the way for a home assistant. When the chat's
  assistant is the one being edited, the brief says so: a save reloads it.
  If the `luca-framework` skill is not in the prompt already and the
  assistant has a skills library (`loadSkill`), the host loads it on start
  (`ensureSkill`). A coding-agent assistant gets the tools over its MCP
  route like the support tools. The chat header shows `building <name>`;
  clicking it opens the editor.
- `e` in the assistants tile opens the editor for the focused assistant,
  `a` scaffolds a new one (`Shell.scaffold`, type `assistant`, which opens
  the command tile), `:edit-assistant [name]` and the palette's "edit an
  assistant…" too (Tab completes the name).

## Canvases

A page an assistant draws on. The host owns all of it
(`src/workbench/canvas.ts`, tests in `workbench-canvas.test.ts`);
the tile only shows the page and takes screenshots. lucaArchitect's guide is
`skills/drawing-on-canvas`.

- **Host**: `GET /canvases`, `POST /canvases` `{id?, title?, open?}`,
  `GET /canvases/<id>` (`{id, title, open, width, height, evals, createdAt, url}`;
  `url` holds the page key), `GET /canvases/<id>/events?since=`,
  `POST /canvases/<id>/eval` `{code, timeoutMs?, keep?}`, `…/shot` (a PNG
  as `dataUrl`), `…/snapshot` (the app's answer), `…/reset`, `…/remove`.
  Frames: `canvas-open` (`id`, `text` = title), `canvas-snapshot` (`id`,
  `requestId`), `canvas-state`, `canvas-event`, `canvas-closed`.
- **The page** is `/canvas/<id>/?key=<key>`, the runtime
  `/canvas/runtime/luca.mjs` (`dist/browser.mjs` beside the binary or in the
  repo, else the same version from unpkg), the link socket
  `/canvas/<id>/link`. Each canvas has its own key: it opens the page, the
  link and a short list of read-only GET routes (`CANVAS_READ_ROUTES`), never
  the host token's routes. The page never evals in the host.
- **Lockdown**, twice: the host's CSP header (scripts from the host and
  unpkg; connect to loopback, `*.ts.net`, unpkg) and `CanvasLockdown`, a
  `WKContentRuleList` that blocks every load but loopback, `*.ts.net`,
  `100.64.0.0/10`, unpkg and `data:`/`blob:`/`about:`. WebKit's url-filter
  has no `|`: one rule per host. Frames go through `CanvasLockdown.allows`.
- **Chat assistants** get `createCanvas`, `canvasEval`, `canvasSnapshot`,
  `canvasEvents`, `listCanvases`, `resetCanvas` from the host
  (`ChatSessions.extraTools`). A snapshot is a tool result `images` entry,
  so the model sees it. An assistant on Claude Code or Codex (named, or the
  machine's `default:` that `luca setup` asks about) never sees in-process
  tools: it gets the host's `/mcp/canvas` MCP server instead (its own bearer
  token, `ChatSessions.agentMcpServers`), next to `luca mcp --assistant`.
- **Opening**: `ProjectHub` turns a `canvas-open` frame into
  `Shell.showCanvas`: beside the tile in focus, keyboard stays there. An
  address with no canvas on the host makes one, so a saved layout reopens.
- **Snapshot**: the tile answers `canvas-snapshot` with
  `WKWebView.takeSnapshot` (at most 1200 pt wide). Off screen it answers an
  error and the host asks the page, which can copy only its `<canvas>`
  elements (`partial: true`).
- Saved code (what ran without an error) is in
  `<cacheDir>/luca-canvases/<cwd hash>/<id>.json` and replays when a page
  loads fresh; a page that only reconnects keeps its drawing.
- Keys: `i` every key to the page, `r` reload (replays), `R` restart host.

## Adding a workbench tool

1. Subclass `WorkbenchContent` (`Tiles/Workbench/WorkbenchContent.swift`).
   Override `hostChanged(_:)`: a client means load, nil means the host is
   gone. `host`, `hostStatus`, `projectId` and `restartHost()` are there.
   Put `WorkbenchHostLine(status:)` at the top of the view for the
   starting and failed states. A card-stack index subclasses `IndexContent`
   instead: watch the host with `WorkbenchHostWatch` in `start()`, call
   `reload()` when a client comes, fill `loadStacks()`, and add the kind to
   `Keymap.indexKinds`.
2. Give it `static let kind = TileKind(id: "luca-<tool>", ...)` and register
   it in `TileKinds.registerBuiltIns()`. Add it to the project tile's Tools
   grid and `PaletteModel.projectTools` when it stands alone.
3. Keys go in `DefaultKeymap.swift` with scope `kind.luca-<tool>`; a leader
   key with scope `leader` and a `luca.<tool>` action in `Shell.perform`.
4. Ask the user through the palette (`PaletteController.choose / ask /
   confirm`), never a modal alert.

## Documents and editors

- Markdown anywhere is `Markdown(text).tilesMarkdown()`
  (`Tiles/Doc/MarkdownTheme.swift`): the kit theme plus code colors from
  `CodeHighlighter` (highlight.js in JavaScriptCore, `Resources/highlight.min.js`,
  pinned). Roles and colors match the source editor's; change them together.
- The source editor page is `Resources/source-editor.html`, a prebuilt
  single file kept here. `build-app.sh` copies it and highlight.js into `Contents/Resources`.
  `:set vim` / `:set novim` is kept in the app's defaults.
- `DocText` cuts a file into frontmatter and body byte for byte;
  `WorkbenchDocBuffer` holds it with the digest it came from.
- The rich editor's engine is vendored in `Vendor/swift-markdown-engine`.
  Read its `VENDORED.md` before you change it.
- A tile with a non-`NSTextView` editor overrides `editorHasKeyboard` and
  `passesEscape()`; the shell then treats it as Insert mode and keeps `Mod`
  keys away from it.

## Layouts

- Layouts are `layouts/<name>.yml` in the app folder. `LayoutFile` (pure,
  tested) parses with Yams, captures a workspace, fills `{params}` and builds
  a `Workspace`. Organized: `root` tree plus `floating`; free: `tiles` with
  `frame: [x, y, w, h]`, fractions of the screen from the top left. The one
  param the tile in focus gives is `{project}` (`LayoutParams`); the palette
  asks for others. A workspace remembers the layout it loaded; saving the
  file in an app file tile re-applies it there. `:layout save|load|edit
  <name>`, `Space l` picks. `:layout edit` on an empty workspace starts from
  an example (project, console, terminal).

## Projects on other machines (ssh)

`:open-project gpubox:~/@lab`, or `Space R` (pick a host of `~/.ssh/config`,
then the folder). A `KnownProject` with a `host` is remote; its id is
`<folder>-<host>` (`lab-gpubox`). `ProjectHub` starts its host as
`ssh <host> exec "$SHELL" -ilc 'cd <path> && exec <host command>'`
(`RemoteProject.hostArguments`) and keeps ssh's stdin open, so the host
there stops when the project closes or the link drops. It reads the same
handshake, then a second `ssh -N -L` (`SSHTunnel`) brings the host's port
to a free port here, and the client uses that. Nothing else in the app
knows the project is remote.

- ssh gets the host as typed, in batch mode: the alias's user, key and
  ProxyJump apply, and a host that wants a password fails with one line.
- The host command there is `luca workbench`, or
  `hosts.<host>.hostCommand` in `settings.yml`. The local `hostCommand`
  and `LUCA_DESKTOP_HOST_COMMAND` do not go to another machine.
- The terminal tile runs `ssh -t <host>` into the folder.
- A page tile's `localhost` URL is that machine's: `ProjectHub.reachable`
  opens one more tunnel for its port and rewrites the URL. The tunnels
  close with the host.
- Not built: taking or borrowing a helper between machines, and linking a
  local folder as a plugin of a remote project. Both say so.
- A check run against a real machine needs one you can ssh into with a
  luca that has `workbench`.

## Running a doc with luca prompt

`p` in a doc tile or a markdown file tile (`PromptRunner`) saves unsaved
edits, asks the host what can run the file, shows a picker (what works
first, the project's default marked), and opens a command tile beside it
at `luca://<p>/command/prompt?target=<who>&files=<path>&run=1`. `run=1`
runs at once and starts the tile with its form hidden (`f` shows it), so
the output is what you see. `D` in a doc tile does the same with
`--dry-run`: the prompt the file becomes, no model called.

## The registry's group bar

A card-stack index can offer groups (`IndexContent.groupOrder`,
`IndexCard.group`, `CardStackState.group`). The registry groups by origin:
All, This project, Borrowed, Plugins, ~/.luca, Built in, each with its
count, as chips over the stacks. `o` shows this project's helpers alone or
all, `O` goes to the next origin, `:only own|borrowed|plugin|home|builtin|all`,
and `?origin=own` in the address opens it that way. A group leaves out the
stacks it empties; the typed filter (`/`) works inside the group.

## The console is a REPL with docs

The input is an `NSTextView` (`ConsoleInputView`), colored as TypeScript.
The model (`ConsoleContent`) holds the text and the caret and asks the host
`/console/complete` on every change. `ConsoleAssist` decides what shows:
the list opens only after part of a name, a dot, or the quote of a helper
factory; `Tab` or `Ctrl-Space` opens it anywhere. The docs pane (`d`, wide
tiles only) follows the caret: the picked item, then the call being typed,
then the name under the caret, then the docs last asked for; at rest it
lists what is in scope. In a narrow tile the list carries the docs beside
it. `Enter` runs only a whole expression (`ConsoleSyntax.isComplete`).
`Esc` closes the list first (`passesEscape`). In a quiet check run no text
view has the keyboard: `type:` goes to `typeForCheck` and
`do:lucaConsole.key.tab|down|enter|complete` stand in for the keys, so the
real key path through `ConsoleTextView.keyDown` is only checked by hand.

## Checking it on screen

`LUCA_DESKTOP_HOME=<scratch> LUCA_DESKTOP_DEBUG_KEYS='Space|Space|wait:1|type:registry|Enter' .build/debug/LucaDesktop`
posts those keys through the real router after launch
(`Sources/App/DebugKeys.swift`). Tokens: a key (`Space`, `:`, `Mod-h`),
`type:<text>`, `do:<action id>`, `wait:<s>`, `shot:<name>` (the app's windows as one picture
in `<LUCA_DESKTOP_HOME>/shots/`; a web view comes out blank) and `quit`
(the normal way: state saves, hosts stop). `LUCA_DESKTOP_HOME` keeps the
run out of `~/.luca/desktop/`, which the installed app uses. Add
`LUCA_DESKTOP_NO_ACTIVATE=1` when someone is at the Mac (the app never
takes the keyboard) and `LUCA_DESKTOP_NO_KEYCHAIN=1`. In a quiet run,
`type:` after `:` fills the palette's line, so `:|type:open-project <path>|Enter`
opens a project and `:|type:open luca://<p>/helper/features/fs|Enter` any tile.
Check runs `unset LUCA_PLUGINS` and set `XDG_CACHE_HOME` to a scratch folder.
`perl -e 'alarm 120; exec @ARGV' .build/debug/LucaDesktop` bounds a run
(there is no `timeout` on macOS). The icon is drawn by
`swift scripts/make-icon.swift`; commit `packaging/AppIcon.*`.
