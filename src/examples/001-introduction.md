# LUCA 

Luca is a typescript library that gives you `container` objects which are global singleton type objects, with observable state, an event bus, and multiple registries of its internal helper classes that you can add to.  

you can also define your own helper classes.

## Helpers

A Helper is a base class that defines a standard, common interface on top of potentially wildly different implementations with different dependencies.  For example, a `Server` class is something you want to be able to `start()` or `stop()`.  a `Client` class is something you want to be able to `connect()` with. `Features` are things you can `enable()` depending on whatever conditions you can think of.

## Containers have Helper Registries and factory functions

```typescript
import container from '@/node'

container.features.register('myFeature', FeatureSubClass)
container.feature('myFeature')
```

## Helpers can be introspected

You can call `introspect()` on an instance of a helper and get information about its interface.