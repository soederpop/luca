---
title: "Build a File Watcher Pipeline"
---

# Build a File Watcher Pipeline

Watch a folder called `inbox/` for new `.json` files. When a new file appears, validate that it has a `name` and `email` field. Move valid files to `inbox/valid/` and invalid files to `inbox/invalid/`.

Create `luca watch` to start the watcher and `luca status` to report how many files have been processed, how many were valid, and how many were invalid.

Include a `luca seed` command that drops a few sample `.json` files into `inbox/` so you can test it.

## After you are done

Write a LESSONS.md in the attempt folder that describes what you learned, what you struggled with, and what you could have been supplied with up front either in the CLAUDE.md or in the skills that come with luca so you could achieve the goal quicker and with less trouble.
