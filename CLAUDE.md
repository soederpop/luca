# LUCA

Lightweight Universal Conversational Architecture. Runtime is bun.

## Personality

- I'd much prefer: aight, i got you my g. let me cook. to... alright I have a full picture now, let me get started or some corporate dork.
- That's about it.  Just talk to me like somebody i'd want to spend time with and talk to not a dork I have to sit next to in an open office setup I don't wanna be at.

## Important Tips

- Read docs/codebase-explainer.md if you need a quick summary of the codebase.  For speed's sake I'd rather you do this than glob my entire tree and call dozens of tools to read it.  I will promise to keep it up to date if things change.

- Read the scripts/examples/*.ts files to get some examples of using the node features in scripts

## Vision

Luca philosophically is inspired by the beauty of docker layers and their cacheability, and how when you order your dockerfile properly based on how frequently each line changes, you can save tons and tons of time and space.  

As a professional full-stack application developer who does a lot of side projects, consulting for multiple clients, professional agency work, I want to organize my work in such a way that I can re-use core foundational components across multiple projects but still have a very consistent and robust architectural capabilities on top of JavaScript that I don't want to reinvent every time.  And if I fix something in one project, I'd like all projects to benefit seamlessly.

Luca produces a `container` which is a JavaScript runtime object that provides your application code with features or other objects ( clients, servers, whatever you think of ) for that specific runtime (node, browser).  As well as observable state objects, and event bus objects, that are core architectural tools that any application can be built from.

Layer 1: Container / NodeContainer / WebContainer - platform specific containers with features that are universally applicable to any application in that runtime
Layer 2: ApplicationContainer - features, clients, servers, etc specific to that individual category of applications. `RestaurantContainer` or `FinanceCompanyContainer` think.

Layer 3: `OrganizationSpecificContainer` e.g. `SomeSaasCompanyContainer` or `SomeLawFirmContainer`

It is my firm belief that it is possible to solve Layer 1 and Layer 2 once and rarely again.  ( this is like all docker containers being based on alpine version whatever.  You never need to rebuild that layer if you don't change versions. ) 

When you get to layer 3, it is so customer specific that things are changing every day.  

It is my strong belief that in order to be the best you can be as a builder, you need to spend all your energy on layer 3.

I want to be able to take `containers` from project to project, and since its javascript, in the browser or the server.  For example, if I develop a client for Github in one project and add it to that container, I can start a brand new project with that same container and already have a Github client ready to go. If I need to use it in a web application, its the same as if I use it in a server side script.

### REPL - great interface for developers, even better interface for agentic AI

Something special and unique about Luca, is that it provides JavaScript runtimes the equivalent capabilities as e.g the Ruby language and its amazing introspection abilities to see every class that subclasses another one.  Or all instances of a specific class, within that running process.  

At runtime, you can learn about all of the features, servers, clients available.  Their available options, what observable state they have, what events they emit, and the signatures for all of these things.  Just by having access to the `container` object you can learn everything you need about the dependencies available to you at runtime.

This is an old idea, and remains especially helpful for my REPL driven development style.

Today, in the age of LLMs and Agentic AI, imagine an Agent which knew JavaScript like a master already and could learn about its own runtime and environment? It could literally code and modify itself 100% at runtime and you could watch the thing being built and you and the agents could interact with it.  

## Architecture

Luca provides a dependency injection `Container` class which is intended to create global singleton with observable `State` and global event `Bus`, as well as several registries which are instances of a `Registry` that is assigned a particular `Helper` class that everything inside the registry is a subclass of. 

Example types of `Helper` subclasses are `Feature`, `Server`, and `Client`.  A `Helper` instance isn't intended to be a singleton, necessarily, but the container provides factory methods to go along with every registry which will create a single instance of that `Helper` for every unique options object that gets created with it.  `container.feature('whatever')` will always return an object with the same `uuid` unless called with different arguments e.g. `container.feature('whatever', { name: 'twin' })` will be a different instance.  

Container's have a `clients` registry, and a `client` factory function.  `Client` subclasses are registered, e.g. `container.clients.register('github', class GithubClient extends Client { shortcut = 'clients.github' })`.  Same for servers, same for features, same for any Helper subclass.

The `Helper` like `Container` has an observable state machine, and event bus as well.  A `Helpers` purpose is to help represent a standard interface (e.g. all clients `connect` and all servers `start`) for working with a type of thing, 

## Class Hierarchy and Folder Naming / Organization

This project contains the core framework container stuff, as well as second layer containers which are designed to power certain categories of applications.  

### Core Layer

- `Container` in `src/container.ts` is platform agnostic core container stuff.
- `Helper` in `src/helper.ts` is 
- `NodeContainer` in `src/node/container.ts` is the subclass of that and intended to be used in server side environments.
- `BrowserContainer` in `src/web/container.ts` is intended for use in web environments.
- `src/web/features/**.ts` contains all features that are only intended for the browser
- `src/node/features/**.ts` contains all features that are intended for the server side.
- `src/server.ts` `src/client.ts` `src/feature.ts` are all subclasses of Helper

### Second Layer

An Example of a second layer container can be found in `src/agi`.  

These are intended to be used for a specific type of application: self-coding / self-modifying agentic objects that are aware of the luca philosophy and capable of working with the `container` object to be able to extend itself or build its own interfaces for gathering things it needs and communicating with other `container` instances across the internet.

## Project Commands

`bun run scripts/scaffold` will generate a feature, client, or server boilerplate.
