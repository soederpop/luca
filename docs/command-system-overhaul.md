# Command System Overhaul

The command system was pretty much 100% vibe coded and not reviewed.  It was only until the first round of evals that I noticed some issues with it and dug into the code and noticed a few things with its implementation that are not consistent with the rest of the project.

My main issue is it doesn't actually use the luca Registry, the Command is not even a subclass of Helper, even though it is easily one of the most obvious examples, however there are quirks to it that let me empathize with the agent for its choices, so I want to resolve those conflicts so we can arrive at the correct design.

## Original Vision For Commands

1) For a user of the compiled `luca` binary, any `commands/:commandName.ts` will be available as `luca commandName` 
2) The luca framework itself comes with core commands in `src/commands/*` that are bundled with the `luca` binary from bun
3) A user can also have `~/.luca/commands` folder which gets picked up
4) commands can export a zod schema that can be used for validation, documentation for CLI help screens

## Command Helper Options / State 

A Command's constructor options are higher level things about the environment the command is being invoked in:

- target ( cli (output to stdout, stderr etc), headless (e.g. run through the js api in code, stdout, stderr needs to be captured and returned) 


## Developer Experience Requirements

Unlike features, clients, servers, which necessarily require a lot more forethought, a command should be very quick to author

for this reason, there needs to be a way that we can dynamically generate Command helper subclasses, without requiring the user to go through the ceremony of doing that.

Instead, a command module should be able to simply export a couple of expected named objects / types, and have the Command helper subclass generated and registered in the command registry at runtime.

## Idea for General Reusable DX Feature

This approach will allow us to accomplish the DX requirement for commands in a way that could make authoring every type of helper simpler as well, without having to modify the core class based implementation. 

Given a typescript module called serve


```ts
import type { SimpleCommand } from '@soederpop/luca'

// SimpleCommand is a ts generic that makes it simpler to construct the actual class ServeCommand<CommandHelperOptions,COmmandHelperState> since all commands share the same base constructor options and have the same state, but we will need to capture
// the run options schema 
declare module '@soederpop/luca' {
  interface AvailableCommands {
    serve: typeof Command  
  }
}


// container is gonna be global here if they don't import anything
// because this module will be run through the container's vm instead of being directly imported
const runOptionsSchema = z.object({

})

export type ServeRunOptions = z.infer<typeof runOptionsSchema> 

export async function run(options: ServeRunOptions) {

}
```

This module could be grafted on to a subclass that gets generated at runtime and meets all the requirements 

## CLI Internal Implementation idea 

This is pseudocode, but will illustrate how I think we can accomplish the above.

The CLI would just call the execute method with whatever container.argv is as its input (container.argv is the result of minimist)

Any other kind of dispatcher that is using commands and wants to accept arbitrary subclasses can also use this execute method, and not have to worry about the simple command overriding the run method

```ts
type CommandOptions, CommandState etc ( zod schema inferred, make sure to follow feature, client, server implementations )

class Command extends Helper<CommandOptions,CommandState,COmmandEvents> {
    // private, but we should allow the CLI to reach in and call this ?
    private async execute(params) {
        return this.run(params)
    }
    
    // NOTE: CommandRunOptions is not the same as the CommandOptions or HelperOptions passed to the constructor
    // In fact the command options are more high level (e.g, is it running from the CLI? dispatched over RPC, an MCP call
    // an agent tool? Commands are just atomic units of work that can be requested.
    run(options: CommandRunOptions) {
        // you don't need to super this ever, any subclass of command implements its own run
        // SimpleCommands can export run and safely override this, because the CLI doesn't call run directly it calls execute
    }
}
```






