/**
 * Deep-merges option objects left to right, the way assistant option layers
 * stack: CORE.md frontmatter < assistants/options.yml `defaults` <
 * assistants/options.yml `<name>` < explicit `create()` options.
 *
 * Plain objects merge recursively; arrays and every other value type are
 * replaced wholesale (a later `allowTools: [...]` fully replaces an earlier one
 * rather than merging by index). `undefined` values are skipped so an absent
 * layer can't blank out a configured one.
 *
 * Exported so plugins and workspace hooks can compose the same layers before
 * handing options to `assistantsManager.create()`.
 *
 * @param sources - Option objects, weakest first
 * @returns A new merged object; inputs are never mutated
 *
 * @example
 * ```typescript
 * deepMergeOptions({ config: { a: 1, b: 2 } }, { config: { b: 3 } })
 * // => { config: { a: 1, b: 3 } }
 * ```
 */
export function deepMergeOptions(...sources: Record<string, any>[]): Record<string, any> {
	// Realm-safe plain-object check: options may come from VM contexts (eval,
	// assistant hooks) whose object literals have a different Object constructor.
	const isPlainObject = (v: any) => {
		if (v === null || typeof v !== 'object' || Array.isArray(v)) return false
		const proto = Object.getPrototypeOf(v)
		return proto === null || proto.constructor === undefined || proto.constructor.name === 'Object'
	}

	const result: Record<string, any> = {}
	for (const source of sources) {
		if (!isPlainObject(source)) continue
		for (const [key, value] of Object.entries(source)) {
			if (value === undefined) continue
			result[key] = isPlainObject(value) && isPlainObject(result[key])
				? deepMergeOptions(result[key], value)
				: value
		}
	}
	return result
}

export default deepMergeOptions
