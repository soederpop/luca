# Content Assistant

Prompt an Assistant with code documentation for contentbase, and the contentbase collections ability to generate a `MODELS.md` summary file of the structure of each document.  It can then use this to generate its own query code in response to natural language and run that in a REPL.

Training the Assistant on the markdown structure format we can ask it to write documents that adhere to the structure.

## Imagine

We have a folder of `ideas/` which are things we want to do but don't have plans for
We have a folder of `plans/` which are things claude code can do and verify works.
We have a folder of `notes/` that are unstructured documents that have titles.

Plans can use YAML frontmatter metadata to store attributes, e.g. tags.  Ideas can have categories, short or long term horizons.  Plans can be pending, approved, in progress, etc.

The content assistant can help build these collections.  We could build a voting system and have multiple agents debate about ideas.  Plans can reference the idea in the metadata, so we can run multiple plans side by side and compare them against the idea.

All of this is human and agent readable / writeable.

## Current Status

The `Assistant` has access to a `docsReader` and a tool for researching questions, and a few other functions. `docsReader` uses `contentDb` under the hood.  I think we need to develop a canned prompt `SKILL.md` perhaps for writing queries and understanding the model, to allow the assistant to get exactly the content it wants as either data or writing.  It can select certain sections from multiple documents at once, run actions on the collection or on individual models.  Luca's container vm can be used to execute the queries for the assistant and report any errors.
