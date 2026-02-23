# DX Improvements for Introspection

I would like to see 

```
container.features.describeAll()
```

instead of showing the full markdown for everything, to look soemthing like this

```markdown
# Available Features

## whatever 

The description content goes here

### Usage

```ts
container.feature('contentDb', {
  // description for optionOne
	optionOne,
	// description for optionTwo
	optionTwo
	// description for optionThree (optional) if it is optional
	optionThree
})
```
```

The usage should be statically generated from the options schema.  

The usage section might be new, but we can easily generate that statically as well.

actually i don't think usage should even be in describeAll, but just the individual introspectAsText calls that should show up
