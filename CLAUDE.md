# LUCA

Lightweight Universal Conversational Architecture. Runtime is bun.

Luca provides a system for building runtime `container` objects which provide server and browser applications with all of the dependencies they need to build complete applications.  A `container` is a per process global singleton, event bus, state machine, and dependency injector.  A `container` is either based on a node or browser runtime, and comes with features optimized for that environment.  You can build your own container on top of it, with your own features, clients, servers.  It is very much inspired by docker layer caching.

A `container` could be used for all "business logic" and state, and be a headless provider for an entire application.  The UI, Scripting output, input, etc, are all just functional interfaces and event bindings to the core container and all of its helpers, and their state.

Dependencies consist of Helpers - Features, Clients, Servers, as well as primitives like event buses, observable state.  The `container` contains registries of all available components: `container.features`, `container.clients`, `container.servers`, `container.commands`, `container.endpoints` as well as factory functions to create instances of them: `container.feature('fileManager')`, `container.server('express')`. 

The `container` and its helpers are perfect for scripts and long running services on the backend, or highly reactive and stateful applications on the frontend.  The components can easily talk to eachother, as the `container` on the server provides servers like `container.server('express')` and `container.server('websocket')` as well as `container.client('rest')` and `container.client('websocket')` and others.  

On the frontend the browser container is perfect for highly reactive, stateful web applications, especially works well with React.

## Dev-time and Run-time typed interfaces

Helpers, registries, and factory functions on the container are all typed, and as you add your own components to a container, you can use module augmentation to extend the `AvailableFeatures` and `AvailableClients` etc.  Defining subclasses of the helpers involves using types for the `HelperOptions` and `HelperState` and `HelperEvents` which provide dev-time autocompletion through types when creating instances through the factories, as well as working with the `helper.state` and using helper events `helper.on()`, `helper.once()` etc.  

Since these types are based on Zod schemas, we also get runtime introspection of these things. Every helper, as well as the container, have methods like `introspect()` and `introspectAsText()` that contain information derived from the Zod schemas, as well as static metadata derived from the docblocks on the classes, methods, and properties.

This allows every server, feature, endpoint, command, to have built in help for working with it.

What is a `Feature`? A `Feature` is a thing, that emits events, has state, and provide an interface for doing something meaningful.  It has a well typed, well documented interface.  A `Feature` can combine other features, clients, servers.  

Like all helpers, features, clients, servers, etc can access the container that created them:  `feature.container` 

For more information about why we did all this consult the [Philosophy](./docs/philosophy.md)

## Optimized for Developer and LLM Agent Experience

Luca is optimized for developers authoring applications, as well as AI Agents, because you can learn about it at dev time and run time.  If all you know is the general purpose of the container and its registries and factories, the existence of basic primitives like state and event buses, you could learn about everything that is available to you and build an application without reading very many docs. `container.features.available` will tell you everything that is there.  `container.features.describeAll()` will give you documentation for all features.

## Development Guidelines

Never break the type system.  I should always be able to get type information as I complete each component of this: `const someFeature : NowIShouldKnowTheType = container.feature('nowIShouldGEtAutoComplete', andNowHereAsWellIShouldGetAvailableKeysDescriptionsTypeEtc)`

Document the classes you create when creating any Helper subclass.  Document all methods on the helpers you create, and document all getters as well.

Types are based on Zod and zod's type inference system.  `.describe()` things when you can.

Use the components that are available, the features, etc.  Instead of reinventing things that the features might already do.

Commit all your changes after you're done.  Only include the changes you made. Leave a commit message that is descriptive, and an explanation in the body or whatever of the message not just the title.

Folders of markdown should be organized as `contentbase` collections. See [docs/contentbase-readme.md](./docs/contentbase-readme.md) for its API and usage.

## Project Commands

Generally, before every commit, you'll want to run the typecheck, tests.  After the commit you should compile.

### Run the Test Suite

```shell
bun test
```

### Generate Introspection Metadata

You'll run this command to capture method, getter, class descriptions from the various helper implementations contained in this project. Run this any time you add or change a feature and are happy with its interface and documentation.

```shell
bun run build:introspection 
```

### Update Codebase Explainer

This document is intended to be a summary of the layout of each file and its purpose, mainly for a new developer or an AI coder.  We should periodically update this document as the project evolves and things are added or removed.  No need to do it after every minor change.

```shell
luca explain-codebase
```

### Typecheck

The type information is very important, and maintaining the `container.feature(string, options)` type system even as new features are added on top of the core is a big priority.

```shell
bun run typecheck
```

### Compile

Builds the single file `luca` executable.  This CLI will run commands available in `src/commands/*.ts` which are instances of the `Command` helper. 