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

/**
 * Escape a value so it is safe to interpolate inside any JS/TS string literal
 * (single-quoted, double-quoted, or template literal). Escapes backslashes,
 * all three quote characters, template interpolation, and newlines.
 */
export function escapeForStringLiteral(value: string): string {
	return value
		.replace(/\\/g, '\\\\')
		.replace(/'/g, "\\'")
		.replace(/"/g, '\\"')
		.replace(/`/g, '\\`')
		.replace(/\$\{/g, '\\${')
		.replace(/\r/g, '\\r')
		.replace(/\n/g, '\\n')
}

/** Apply mustache-style template variables to scaffold code */
export function applyTemplate(template: string, vars: Record<string, string>): string {
	let result = template
	for (const [key, value] of Object.entries(vars)) {
		// Use a function replacement so `$` sequences in the value (e.g. "$&")
		// are inserted literally instead of being treated as replacement patterns
		result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), () => value)
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
		// Descriptions are interpolated into string literals in the templates —
		// escape them so quotes/backslashes/newlines can't produce invalid TS
		description: escapeForStringLiteral(description || `A ${type} that does something useful`),
	}

	return applyTemplate(scaffold.full, vars)
}
