import {
  defineModel,
  section,
  hasMany,
  belongsTo,
  AstQuery,
  z,
} from "contentbase";

export const Tutorial = defineModel("Tutorial", {
	description: 'Tutorials on how to compose things together to do neat things',
	prefix: "tutorials",
	meta: z.object({
		tags: z.array(z.string()).default([]).describe("Arbitrary tags for categorizing the tutorial"),
	}),
})

export const Report = defineModel("Report", {
	description: 'Used for e.g. documentation audits, usability audits for agents, or anything else long form project related',
	prefix: "reports",
	meta: z.object({
		tags: z.array(z.string()).default([]).describe("Arbitrary tags for categorizing the report"),
	}),
})

export const Example = defineModel("Example", {
	description: 'Runnable composition patterns that combine multiple luca helpers (single-feature usage lives in JSDoc @example blocks, surfaced by `luca describe`)',
	prefix: "examples",
	meta: z.object({
		tags: z.array(z.string()).default([]).describe("Arbitrary tags for categorizing the example"),
		lastTested: z.string().nullable().optional().describe("Date the doc last ran via `luca test-examples` (stamped automatically)"),
		lastTestPassed: z.boolean().nullable().optional().describe("Whether the last `luca test-examples` run passed (stamped automatically)"),
	}),
})

export const Challenge = defineModel('Challenge', {
  description: 'challenges are used by our evaluation suite to measure the quality of the introspection content and tool, as well as the SKILL.md that gets generated to help coding assistants work with the luca framework',
  prefix: 'challenges',
  meta: z.object({
	 difficulty: z.enum(['easy','medium','hard']).default('easy'),
	 maxTime: z.number().default(5).describe('Number of seconds max time limit default to 5 minutes')
  }),
})
