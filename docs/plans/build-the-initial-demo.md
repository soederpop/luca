# Initial Demo Plan

## Summary 

I want to be able to run `luca demo` and then be able to open two chrome tabs

The server should expose a `/introspect` and a `/current` endpoint which serve two html files.

The `/introspect` view will be a chat with the server side object ( TBD ) with who you will be building
some sort of Luca based application with as it attempts to accomplish one of your goals with you

The `/current` view will contain a visualization that is entirely up to the server side object to create using the various tools available to it (which will include claude code!) 

The `/introspect` view should be able to trigger a page reload / refresh or something similar in `/current`

## Introspection App

The core Agent loop for inspection should be a frontend focused and a server focused expert, and an architect expert that is responsible for planning the various tasks / acceptance criteria


