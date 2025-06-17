#!/usr/bin/env bun 

import container, { ui } from '@/node'
import '@/introspection/generated'

async function main() {
	const featureDef = container.features.lookup('vm')	

	console.log(featureDef)
}

main()