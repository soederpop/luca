# Runnable Markdown Demo

This demo combines the `contentbase` library along with the container's `vm` feature to turn markdown documents with codeblocks into runnable documentation which renders in the terminal and runs the actual code.  

This allows me to write some server side scripts which use the luca node container as markdown documents.

This allows me to iteratively in english write 

```ts
const whatever = 'whatever'
```

Then continue on with explanation, and context is shared between code blocks which is cool.

```ts whatever and a bunch of other flags=true yes=no
console.log('Whatever is shared?', typeof whatever)
```

Also, the global context of the code blocks includes the container's context as globals

```ts
console.log(typeof container, 'See container is defined')
```

And they're async so I can ask you questions

```ts
let answer

container.ui.askQuestion('How you doin?').then((result) => {
	answer = result.question
})
```

and you know, write some additional docs, with a codeblock that references your answer

```ts
console.log('I am either sad or happy that you are doing ' + answer)
```