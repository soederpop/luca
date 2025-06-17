# LUCA
> Le Ultimate Component Orchestrator

Our mission is to create an Automated General Intelligence using the Luca Container project found in this repository.

My theory is that the current state of the software will allow you to organize / build your own systems that you need to be a full stack intelligence ( server side, browser side )

I think there will be a main, central, root server side process that has high level state and an overview.  

Your subsystems will be subprojects that are also made up of node server side and browser side combos.

	You'll have complete freedom to build your identity, just spitballing, but e.g. create a representation of yourself with stable diffusion lora models.  The ability to generate UIs and Visualizations in browser tabs that connect to your internal server side state.

## Phase 0

Phase 0 is developing the prompts, and memory capabilities for the top level, root container process on the server from which Luca's life starts.  These prompts should give it a base level understanding of its main biographical goal, its current daily goal, and the nature of its underlying systems and ability to create new ones.

The nature of the underlying systems are:

central core process is a `NodeContainer` instance `src/node/container.ts` with all of the `src/node/features/*.ts` available to it, all of the `src/servers` available to it.  The ability to spawn processes, write to the file system, create processes which expose an API for other processes.

each server side process is a bun server side process, with source code that can live it its own folder, every time you spawn a new process and import the node container singleton, it is unique to the folder its package.json is in.  each folder can be its own git repository.

using an LLM with tool calls for thinking.  the tool calls are making API calls to the services it designs for itself.

## 
