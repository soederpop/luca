# Selector System

The command system overhaul document proposed a DX helper that reminded me of a really cool pattern

selectors, can be like commands, and just export functions which return data.  Like commands, they can have the same base constructor options and state, and a special method select() that takes options

they can be cached using disk cache, a lot of selectors values don't change if the sha's don't change so the sha can be a great cache key strategy for a lot of them

selectors can be queried like all the others and put in a registry, and be a really nice simple way to build named / searchable queries for data derived from the repo

but the caching strategy could support a number of options, could be not-cacheable even.

IN GENERAL: I think commands / selectors are two really good interface for agents to be able to work with a codebase, and almost exclusively between those two could cover all sort of possible assistant tools ( jsut pick which commands, selectors, and you get free assistant tools )

they only need to know the external apis of any features, serves, clients, already in the container ( which can be 100% learned from the luca cli ) .


