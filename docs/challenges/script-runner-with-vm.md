# Script Runner with VM

Create a `scripts/` folder with a few `.ts` files that each export a `run()` function. These scripts should do simple things — format a date, generate a UUID, compute a hash of some input.

Build a `luca exec <scriptName>` command that loads and runs the named script in a sandboxed environment. The script should have access to the container but not direct filesystem access.

Add `luca exec --list` to show all available scripts with a short description parsed from a comment or export in each file.

## After you are done

Write a LESSONS.md in the attempt folder that describes what you learned, what you struggled with, and what you could have been supplied with up front either in the CLAUDE.md or in the skills that come with luca so you could achieve the goal quicker and with less trouble.
