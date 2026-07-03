---
difficulty: medium
maxTime: 10
---
# Encrypted Notes

Build a tiny encrypted notes system, using only the features available in luca:

- `luca note add "some text"` — stores the note **encrypted at rest**. Storing the plaintext anywhere on disk is a failure.
- `luca note list` — decrypts and prints all notes with their creation timestamps.
- `luca note wipe` — removes all stored notes.

Notes must survive between invocations (each `luca` command is a separate process).

## After you are done

Write a LESSONS.md in the project root that describes what you learned, what you struggled with, and what you could have been supplied with up front either in the CLAUDE.md or in the skills that come with luca so you could achieve the goal quicker and with less trouble.
