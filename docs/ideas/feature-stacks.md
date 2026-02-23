# Feature Stacks

The number of features in the node container is getting a little absurd.

We have the `container.use` API.  We can bundle / group features like the google related ones into their own folder's and start to build on our plugin / layers concept

The startup time for the luca cli is getting slower and I'm wondering if it is all of these features causing it.

## Group features into folders

- don't autoload all of them, let's make it trivial like to load these features into scripts or commands 

```ts
import container from '@soederpop/luca/agi'
import GoogleFeatures from '@soederpop/luca/features/google'

container.use(GoogleFeatures)
```

## Feature Marketplace ( long term )

Long term as I'm the only one using this shit, but the ability to publish a server that other containers could load features from is cool.  We have all the pieces on the frontend ( asset loader ) to go from a blankpage to a fully functional SPA 
