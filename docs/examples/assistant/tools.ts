import { z } from 'zod'

// `container` (the luca container) and `assistant` (this assistant) are
// globals in tools.ts and hooks.ts. Declared here so editors do not flag them.
declare const container: any
declare const assistant: any

// Every key in `schemas` names an exported function below. The zod schema
// describes that function's one options argument; its `.describe()` strings
// are all the model sees, so say what the tool does and when not to use it.
//
// At runtime `assistant.tools.<name>` is `{ handler, parameters, description }`:
// call one by hand with `assistant.tools.README.handler({})`.
//
// Check the assistant is discovered with:
//   luca eval "container.feature('assistantsManager').availableAssistants"
export const schemas = {
	README: z.object({}).describe('Describe this assistant: its folder, its files and the container features it can reach. Call it when asked what you can do.'),
}

export function README(_options: z.infer<typeof schemas.README>) {
	return [
		`Assistant "${assistant.name}" in ${assistant.resolvedFolder}`,
		`Tools: ${Object.keys(assistant.tools).join(', ')}`,
		`Container features available: ${container.features.available.length}`,
		`Project: ${container.cwd}`,
	].join('\n')
}

// Optional: features whose tools this assistant also gets. Anything with a
// `toTools()` works; `container.features.availableToolsProviders` lists them.
// export const use = [
// 	container.feature('fileTools').toTools({ only: ['readFile', 'searchFiles'] }),
// ]
