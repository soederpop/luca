# LUCA Class Architecture and design 

The idea behind Luca is there is something called a [Container](../container.ts), which is a class you can extend.  A container is something you can build up, and can run in any environment (web, server, electron, etc).  It will tell you info about the environment you're in as well so you can do this dynamically.

The framework provides [NodeContainer](../node/container.ts) which is intended for server side environments. It also provides a [WebContainer](../web/container.ts) which is intended to be used in the browser.  

## Helpers and Registries

The [Helper](../helper.ts) class's goal is to be something that can be inspected at runtime, to get the same information about the methods, interfaces, etc that you get at authoring time through the LSP.  

The [Registry](../registry.ts) class is intended to be a collection of `Helper` subclasses

We provide a few example Helpers:

- [Feature](../feature.ts) 
- [Client](../client.ts) with additional `RestClient`, `SocketClient` clients
- [Server](../server/server.ts) (node specific) with an `Express` and `Websocket` server subclass

Each of these runtime specific containers come with their own features.

- [node features - node/features/*.ts](../node/features)
- [web features - web/features/*.ts](../web/features)

The core idea is you define a container, and what helpers it needs ( the ones we provide, the ones you build and register yourself) and that can be the foundation for many different applications.

## Containers are meant to be singletons

In your application, the `container` instance is intended to be a central, global object the way `document` or `window` might be in a browser environment.  (It doesn't need to be a literal global, can be a module singleton)

It provides an observable [State](../state.ts) instance `container.state` 

It provides standard event emitter interface as well.




