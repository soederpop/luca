/** 
 * This particular file is dynamically loaded as text and then evaled in the VM
 * but it is typescript for type safety and intellisense.
 * 
 * The container global is injected at runtime by the VM execution context.
 */
import type { AGIContainer } from '@/agi/container.server'

declare global {
	// The container is injected into the VM context at runtime
	const container: AGIContainer
}

const { z } = container

export const schemas = {
	getLatestChanges: z.object({
		number: z.number().describe('The number of changes to return'),
	}).describe('Get the latest changes from the codebase'),
	describeFeature: z.object({
		feature: z.string().describe('The feature to describe'),
	}).describe('Describe a feature'),
}

export async function describeFeature(options: any) {
	const feature = container.features.lookup(options.feature) as any
	return feature.introspectAsText(3)
}

export async function getLatestChanges(options:any) {
	const git = container.feature('git')

	const numberOfChanges = options.number || 10

	return await git.getLatestChanges(numberOfChanges)
}