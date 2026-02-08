#!/usr/bin/env bun 

import { __INTROSPECTION__ } from '@/introspection'
import '@/introspection/generated'
import container from '@/node'

const { ui } = container

async function main() {
	ui.print.green('Hello, world!')
}

main()