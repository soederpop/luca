#!/usr/bin/env bun

import { __INTROSPECTION__ } from '@/introspection'
import container from '@/node'
import { z } from 'zod'
import { zodToTs, printNode, createAuxiliaryTypeStore } from 'zod-to-ts'

const { ui } = container

const store = createAuxiliaryTypeStore()

async function main() {
	const vm = container.feature('vm')
	console.log(ui.markdown(vm.introspectAsText()))
}

main()