---
title: "YAML Config System"
---

# YAML Config System

Build a command suite for managing project configuration stored in `luca.config.yaml`:

- `luca config set <key> <value>` — set a config value (support nested keys like `server.port`)
- `luca config get <key>` — get a config value
- `luca config list` — print the full config as a formatted table
- `luca config delete <key>` — remove a key

Create the config file if it doesn't exist.

## After you are done

Write a LESSONS.md in the attempt folder that describes what you learned, what you struggled with, and what you could have been supplied with up front either in the CLAUDE.md or in the skills that come with luca so you could achieve the goal quicker and with less trouble.
