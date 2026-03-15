import { scaffolds } from './generated.js'

/** Convert a string to PascalCase */
export function toPascalCase(str: string): string {
	return str
		.replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
		.replace(/^(.)/, (_, c) => c.toUpperCase())
}

/** Convert a string to camelCase */
export function toCamelCase(str: string): string {
	const pascal = toPascalCase(str)
	return pascal.charAt(0).toLowerCase() + pascal.slice(1)
}

/** Convert a string to kebab-case */
export function toKebabCase(str: string): string {
	return str
		.replace(/([a-z])([A-Z])/g, '$1-$2')
		.replace(/[_\s]+/g, '-')
		.toLowerCase()
}

/** Apply mustache-style template variables to scaffold code */
export function applyTemplate(template: string, vars: Record<string, string>): string {
	let result = template
	for (const [key, value] of Object.entries(vars)) {
		result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
	}
	return result
}

/** Generate scaffolded code for a given helper type */
export function generateScaffold(type: string, name: string, description?: string): string | null {
	const scaffold = scaffolds[type]
	if (!scaffold?.full) return null

	const vars = {
		PascalName: toPascalCase(name),
		camelName: toCamelCase(name),
		kebabName: toKebabCase(name),
		description: description || `A ${type} that does something useful`,
	}

	return applyTemplate(scaffold.full, vars)
}
