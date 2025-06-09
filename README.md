# LUCA
> Typescript programs you can talk to

Luca is designed for building Agentic TypeScript applications.

## Core Components 

LUCA is a system for building container objects, which act as a state machine, event bus, and a provider of 
Helper registries for creating instances of Helpers.

A Helper is a standard interface on top of different providers of functionality, for example, you might expect every instance of a `Server` to be able to be `start()` and `stop()`.  Every server is different to stop or start, but who cares? Every `Feature` is either `supported` or not, and can be `enabled`.  Every `Client` is something you can `connect` with, etc.

A `Helper` class is registered with a registry on the container, so you can see which ones are available.

The `container` instance can tell you all of the `features.available` or `clients.available` or `servers.available`.

it can tell you `container.isNode` or `container.isBun` or `container.isBrowser` etc.  

This provides a standard environment for an `Agent` to orient itself and understand its capabilities, as well as a way to learn deeper information about the helpers it has available.



