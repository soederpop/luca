# Introspection Audit

This audit is a periodic test, does the introspectAsText output actually help an LLM use that
particular feature.

## Files

- `src/node/features/*.ts` NodeContainer features
- `src/agi/features/*.ts` AGIContainer features

## Your Task

For each feature, you can run the following shell command:

```shell
luca describe feature-id
```

This command will accept diskCache, disk-cache.  Generally you want to go with the shortcut that is defined on the feature class.

Your job is to take what you learn from that command, and build an idea of 3-4 example usecases of that feature.

Compile all of this into a document in docs/reports/introspection-audit-tasks.md.

I'd like the following format

```
# Introspection Audit Results

## Features

### [diskCache](src/node/features/disk-cache.ts)

The purpose of this feature is to provided a consistent disk backed key-value store for large blobs and json objects.  It includes the ability to have an encrypted store that can only be read with a secret.

- securely set / get a key across processes
- query information about available keys
- check if a key is present, if not write to it
```

Do that for every feature.

## Next Steps

Once we have this report written, I will review the use cases and descriptions to see how accurate they are and if I like them.

Then we will have you attempt to eval your code and see if it works. If it doesn't, sugggest how the documentation could be improved or how the API might be improved.


