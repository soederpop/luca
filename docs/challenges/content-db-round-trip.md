---
title: "Content DB Round-Trip"
---

# Content DB Round-Trip

Populate a `docs/recipes/` collection with 5 recipe documents. Each document should have frontmatter with `title`, `tags` (array), `difficulty` (easy/medium/hard), and a markdown body with ingredients and steps.

Create two commands:

- `luca recipes search <term>` — queries the collection by tag or title match and prints matching recipes
- `luca recipes export` — writes a `recipes-summary.json` file with all recipe titles, tags, and difficulty levels

All document access must go through the container's document system, not raw file reads.

## After you are done

Write a LESSONS.md in the attempt folder that describes what you learned, what you struggled with, and what you could have been supplied with up front either in the CLAUDE.md or in the skills that come with luca so you could achieve the goal quicker and with less trouble.
