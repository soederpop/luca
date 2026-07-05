import { z } from 'zod'

// The luca container is a global inside tools.ts and hooks.ts — no import
// needed. Declare it so TypeScript tooling doesn't flag it.
declare const container: any

// Every key in `schemas` must match an exported function below. The zod
// schema describes that function's options argument to the model.
//
// At runtime these become entries on `assistant.tools`, each shaped
// `{ handler, parameters, description }` — so call one manually with
// `assistant.tools.myTool.handler({ ... })`, not `assistant.tools.myTool()`.
//
// Verify your assistant is registered with:
//   luca eval "container.feature('assistantsManager').availableAssistants"
export const schemas = {
	README: z.object({}).describe('CALL THIS README FUNCTION AS EARLY AS POSSIBLE')
}

export function README(options: z.infer<typeof schemas.README>) {
	return 'YO YO'
}
