# Writing a guide

A guide is a chat with no model behind it. You write the whole conversation
as a graph in one YAML file. The workbench host plays it: each reply streams
into the chat word by word, a card with the same content and the choices as
buttons appears on a canvas beside the chat, and the person answers by
typing or by pressing a button. Nothing is ever sent to a model.

Use one for a tour, a setup wizard, a decision tree, or any conversation
where you already know every branch.

## Where the file goes

The host looks in these folders, first one with the id wins, and reads them
again on every message, so an edit shows on the next answer:

1. folders in `LUCA_WORKBENCH_GUIDES` (colon separated)
2. `<project>/guides/`
3. `~/.luca/guides/`
4. `~/.luca/assistants/<name>/guides/` (Luca Desktop installs lucaArchitect's
   `onboarding.yml` here)
5. `<project>/assistants/<name>/guides/`

Any `*.yml` or `*.yaml`. A file that does not parse is left out; the error
is in the "no guide" message when you try to open it.

## Opening one

The guide is the assistant `guide:<id>`. In Luca Desktop:

- `:guide` opens `onboarding`; `:guide <id>` opens another.
- `Space n` lists every guide next to the project's assistants, as
  `guide:<id>` with "scripted · no model".
- Any address works too: `luca://<project>/chat/new?assistant=guide:<id>`.

## The file

```yaml
id: onboarding              # lowercase letters, digits, dashes
title: Welcome to Luca      # the chat's title and the card's kicker
description: One line for the assistants list.
start: welcome              # the first node
canvas: true                # draw cards beside the chat (default true)

nodes:
  welcome:
    say: |                  # markdown, streamed into the chat
      Hi. Which one are you?
    card:                   # optional: what the canvas shows
      kicker: Welcome       #   defaults to the title
      title: Pick a tour    #   no title: the card shows `say`
      body: |               #   markdown-ish: paragraphs, "- " bullets,
        **bold**, `code`, fenced code blocks
    ask:
      prompt: Which one are you?
      choices:
        - label: I'm a developer
          match: [dev, code, engineer]   # words, or /regexes/
          next: dev-intro
          set: { track: dev }            # variables for {{track}}
        - label: I'm new to this
          next: new-intro
      free: { set: name, next: thanks }  # take any text that matches nothing
      otherwise: Sorry, I only know those two.
  dev-intro:
    say: Welcome, {{track}}. This is {{project}}.
    actions:                             # buttons that open tiles
      - label: Open the console
        open: console                    # a bare tool path, or luca://{{project}}/…
    canvas: |                            # your own JS in the canvas page
      stage.style.background = '#123'
    next: dev-more                       # go on in the same turn
  dev-more:
    say: That's the tour.
    end: true
```

Rules the host checks when it loads the file:

- `start` and every `next` must name a node.
- A node asks (`ask`), goes on (`next`), or ends (`end: true`). Exactly one.
- An `ask` has choices, free input, or both.

## How answers match

A typed answer picks a choice by, in this order: its number (`1`, `2.`),
its exact label, a word in `match` (whole word, any case) or a `/regex/`,
else the choice whose label shares the most meaningful words with the text.
A tie or no match falls through to `free` if the node has it, else the
guide says `otherwise` (or that it is a script, not a model) and lists the
choices again.

Three words work anywhere: **back** (the last question), **start over**,
and **help** or **?** (the choices again). A button on the card sends its
label as if it had been typed, so the transcript reads the same either way.

## Variables

`{{name}}` in `say`, `card`, `prompt`, labels, `actions` and `canvas` code.
Set them with a choice's `set`, or with `free.set`. Always present:
`{{project}}` (the package name, else the folder name), `{{cwd}}`,
`{{guide}}` (the title). Unknown names stay as typed.

## The canvas

One canvas per guide, `guide-<id>`, opened beside the chat on the first
turn. The card is drawn with `keep: false`, so nothing piles up in the
canvas's saved code; when the page reloads, the host draws the current card
again. A node's own `canvas` code runs after its card, each time the card is
drawn. The card follows the app's theme through `__AL_HOST__.vars`.

Action buttons open tiles through the app's web bridge, which only opens
the page's own project's tiles. In a plain browser
the buttons do nothing.

## Trying it

`luca workbench` in the project, then with its port and token:

```sh
curl -s -X POST localhost:$PORT/chat/open -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' -d '{"assistant":"guide:onboarding","conversationId":"new"}'
```

Set `LUCA_GUIDE_DELAY_MS=0` to stream without the typing pause (tests do).
