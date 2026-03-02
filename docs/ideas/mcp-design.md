# MCP Design

I have a hunch that the best way to get coding assistants to be aware of our MCP is to have as verbose of tool descriptions as the spec allows, as this seems to be the primary form of guidance.

One neat trick I learned from the excalidraw and other mcps is to have a tool_call called read_me, which we can probably really tune the tool description for, to make sure it gets called as early on as possible by the MCP, and as a way to further refine how it understands to use tool calls.

## Current State

We've got a `luca sandbox-mcp` command in this project which can be used to eval snippets of code inside the luca vm, as well as some other tools.  Claude code consistently fails to use them, however.
