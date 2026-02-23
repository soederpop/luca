# Helpers Gateway Feature 

This is a proposal for a new feature, that will exist in both the NodeContainer and WebContainer ( separate implementations entirely, but same API interface )

```ts
const helpers = container.feature('helpers')
```

This will be a first class, auto-enabled feature in both containers, which means we can always access its singleton instance via `container.helpers`.  I should be able to say `container.helpers.available` and get the names of the classes, `container.helpers.lookup('server')` and get `Server`

A Helper class like `Client` or `Server` when we `container.use(Client)` can take this opportunity to register themselves with this feature, as an implementation detail.

## Purpose and Vision

This will be a central place to be able to introspect() the various types of helpers available ( which you might not even know about )

There will be an async `await helpers.discover("clients", { searchPath })` type API 

- One place to "discover" local project commands and endpoints and register them which we do in multiple places currently in the code base 
- The CLI would take care of discovering commands/ because it needs to
- Only the serve command would need to discover endpoints currently, but this would also be a single place to do it
- I'd like the CLI to be able to discover ALL helpers now ( so a project can have its own clients, features, servers) folders.  
- For now, custom commands can `container.helpers.discover("features")` if they know they have custom features they've written and want to use them
- There should be a `helpers.discoverAll()` that just works since we have all the references we need

## Browser Implementation

In the browser, we do need some configurability but let's punt on it.

For nor it will expect to find a `/container.manifest.json` that lists the available paths for each type of component.  

What this will allow us to do is have a BUNCH of features for the web that are just sitting there waiting to be dynamically loaded and cached, that we don't have to worry about bunding
