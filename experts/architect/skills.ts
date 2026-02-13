/** 
 * This particular file is dynamically loaded as text and then evaled in the VM
 * but it is typescript for type safety and intellisense.
 * 
 * The container global is injected at runtime by the VM execution context.
 */
import type { AGIContainer } from '@/agi/container.server'

const { z } = container

/** 
 * When the Architect comes up with a plan, it needs to conform to a specific schema
 * so that it can be parsed and executed by the planner
*/
export async function validatePlanDocument({ content }: { content: string }) {

}

/** 
 * The Architect will save a plan document and store it to disk for later reference
*/
export async function savePlanDocument({ content, planId }: { content: string, planId: string }) {

}

/** 
 * The Architect can "Research a Question" which will consist of asking Claude code a very specific
 * question with context.  This can be used for code review.
*/
export async function rearchWithCode({ question }: { question: string }) {

}