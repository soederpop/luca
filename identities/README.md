# Identities Folder

The `Identity` feature [src/agi/features/identity.ts](../src/agi/features/identity.ts) will load data from the subfolders here.  

An `Identity` consists of a core system prompt that is a markdown file, and a memories.json file that is an array of memories.

This info will be used to build a prompt to help identity the agent.