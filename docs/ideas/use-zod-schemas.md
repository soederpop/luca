# Zod Schemas

Currently the various subclasses of `Helper` such as `Feature`, `Client`, `Server` all extend the `HelperOptions` and `HelperState` at multiple levels.

Instead, I'd rather each of the options and state definitions to be zod schemas.  I like the type inference at coding time, and I like that I can expose them on the helper themselves at runtime.