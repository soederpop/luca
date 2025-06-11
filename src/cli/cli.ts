#!/usr/bin/env bun 

import container from '../node'
import '../introspection/generated'

console.log(container.cwd)
console.log(container.git.isRepo)

if (container.git.isRepo) {
	console.log(container.git.sha)
}

console.log(container.feature('fileManager').introspect())
