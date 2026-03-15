import { defineModel, z } from 'contentbase'

/**
 * Define your content models here. Each model maps to a folder prefix
 * inside the docs/ directory. Documents in those folders follow the
 * model's metadata schema.
 *
 * Access documents at runtime:
 *   const docs = container.docs          // contentDb feature
 *   if (!docs.isLoaded) await docs.load()
 *   const notes = await docs.query(docs.models.Note).fetchAll()
 *
 * See https://github.com/soederpop/contentbase for full documentation.
 */

export const Note = defineModel('Note', {
  prefix: 'notes',
  meta: z.object({
    tags: z.array(z.string()).default([]),
    status: z.enum(['draft', 'published']).default('draft'),
  }),
})
