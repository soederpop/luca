import { describe, it, expect } from 'bun:test'
import { NodeContainer } from '../src/node/container'
import '../src/introspection/scan'
import { HELPER_CATEGORIES, isHelperCategory } from '../src/introspection/categories'
import { tmpdir } from 'os'
import { join } from 'path'
import { writeFileSync, mkdirSync, rmSync } from 'fs'

/**
 * Category metadata: every built-in helper declares `static override category`
 * (mirroring `stability`), the scanner extracts it at build time, and
 * registration propagates it at runtime. `luca introspect` hard-fails when a
 * helper is missing one — these tests are the fast, in-suite version of that
 * guarantee.
 */
describe('introspection: helper categories', () => {
	const container = new NodeContainer()

	describe('scanner extraction', () => {
		it('extracts static override category from source (as const and typed forms)', async () => {
			const dir = join(tmpdir(), `luca-scan-category-${process.pid}-${Date.now()}`)
			mkdirSync(dir, { recursive: true })

			writeFileSync(join(dir, 'categorized.ts'), `
				import { Feature } from '../feature.js'

				/** A fixture feature with an as-const category */
				export class Categorized extends Feature {
					static override shortcut = "features.categorized" as const
					static override stability = 'stable' as const
					static override category = 'dev-tools' as const
				}

				/** A fixture with a typed (annotated) category, like RestClient */
				export class Annotated extends Feature {
					static override shortcut = "features.annotated" as const
					static override stability = 'core' as const
					static override category: any = 'networking'
				}

				/** A fixture with an invalid category slug */
				export class BadCategory extends Feature {
					static override shortcut = "features.badCategory" as const
					static override stability = 'experimental' as const
					static override category = 'not-a-real-category' as const
				}

				/** A fixture with no category at all */
				export class Uncategorized extends Feature {
					static override shortcut = "features.uncategorized" as const
					static override stability = 'experimental' as const
				}
			`)

			try {
				const scanner = container.feature('introspectionScanner', { src: [dir] })
				const results = await scanner.scan()
				const byId = new Map(results.map((r: any) => [r.id, r]))

				expect((byId.get('features.categorized') as any)?.category).toBe('dev-tools')
				expect((byId.get('features.annotated') as any)?.category).toBe('networking')
				// invalid slugs are dropped, not propagated
				expect((byId.get('features.badCategory') as any)?.category).toBeUndefined()
				expect((byId.get('features.uncategorized') as any)?.category).toBeUndefined()
			} finally {
				rmSync(dir, { recursive: true, force: true })
			}
		})
	})

	describe('runtime propagation', () => {
		it('interceptRegistration exposes category through introspect()', () => {
			const Fs = container.features.lookup('fs') as any
			expect(Fs.introspect().category).toBe('filesystem')

			const Rest = (container as any).clients.lookup('rest') as any
			expect(Rest.introspect().category).toBe('networking')
		})
	})

	describe('coverage guard', () => {
		it('every built-in helper in the generated introspection data declares a valid category', async () => {
			// Check the build-time catalog rather than the runtime registries —
			// other test files register fixture helpers into the global
			// registries, which would false-positive here. This mirrors the
			// hard enforcement in `luca introspect`.
			const { introspectionData } = await import('../src/introspection/generated.agi')
			expect(introspectionData.length).toBeGreaterThan(50)

			const missing = introspectionData
				.filter((entry: any) => !isHelperCategory(entry.category))
				.map((entry: any) => `${entry.id} (${entry.category ?? 'none'})`)
			expect(missing).toEqual([])
		})

		it('HELPER_CATEGORIES slugs are unique', () => {
			expect(new Set(HELPER_CATEGORIES).size).toBe(HELPER_CATEGORIES.length)
		})
	})
})
