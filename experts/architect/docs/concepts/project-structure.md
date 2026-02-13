# Project Structure Guidance for Luca Projects

## Where to save files

- Everything in a Luca project will be in a src folder
- `container.server.ts`
- `container.web.ts` will contain the container module intended for the web
- `clients` folder will contain Client implementations
- `servers` folder will contain different server implementations
- `web/features` for web only features `node/features` for server side features
- `features` for features that work in either
