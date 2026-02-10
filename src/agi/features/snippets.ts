import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'
import { Feature, features } from '../../feature.js'

// Define the snippet data structure
export interface Snippet {
  id: string
  title: string
  content: string
  language?: string
  tags?: string[]
  category?: string
  createdAt: Date
  updatedAt: Date
  description?: string
}

// Define the feature's state schema
export const SnippetsStateSchema = FeatureStateSchema.extend({
  snippets: z.array(z.any()).describe('Array of all stored snippet objects'),
  categories: z.array(z.string()).describe('List of all snippet categories'),
  totalCount: z.number().describe('Total number of stored snippets'),
  lastUpdated: z.any().optional().describe('Timestamp of the last snippet modification'),
})

// Define the feature's options schema
export const SnippetsOptionsSchema = FeatureOptionsSchema.extend({
  maxSnippets: z.number().optional().describe('Maximum number of snippets to store'),
  autoSave: z.boolean().optional().describe('Whether to automatically persist on changes'),
  storageKey: z.string().optional().describe('Key used for persistent storage'),
  defaultCategory: z.string().optional().describe('Default category for new snippets'),
})

export type SnippetsState = z.infer<typeof SnippetsStateSchema>
export type SnippetsOptions = z.infer<typeof SnippetsOptionsSchema>

// Implement the Snippets feature class
export class Snippets extends Feature<SnippetsState, SnippetsOptions> {
  static override stateSchema = SnippetsStateSchema
  static override optionsSchema = SnippetsOptionsSchema
  // Required: Define the shortcut path for container access
  static override shortcut = 'features.snippets' as const
  
  // Optional: Set default state
  override get initialState(): SnippetsState {
    return {
      ...super.initialState,
      snippets: [],
      categories: [this.options.defaultCategory || 'General'],
      totalCount: 0,
      lastUpdated: undefined
    }
  }

  // Add a new snippet
  async addSnippet(snippet: Omit<Snippet, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const id = this.generateId()
    const now = new Date()
    
    const newSnippet: Snippet = {
      ...snippet,
      id,
      createdAt: now,
      updatedAt: now,
      category: snippet.category || this.options.defaultCategory || 'General'
    }

    const currentSnippets = this.state.get('snippets') || []
    const snippets = [...currentSnippets, newSnippet]
    const categories = this.updateCategories(newSnippet.category)
    
    this.state.setState({
      snippets,
      categories,
      totalCount: snippets.length,
      lastUpdated: now
    })

    this.emit('snippetAdded', newSnippet)
    
    if (this.options.autoSave) {
      await this.save()
    }

    return id
  }

  // Get a snippet by ID
  getSnippet(id: string): Snippet | undefined {
    const snippets = this.state.get('snippets') || []
    return snippets.find(snippet => snippet.id === id)
  }

  // Update an existing snippet
  async updateSnippet(id: string, updates: Partial<Omit<Snippet, 'id' | 'createdAt'>>): Promise<boolean> {
    const snippets = this.state.get('snippets') || []
    const index = snippets.findIndex(snippet => snippet.id === id)
    
    if (index === -1) {
      return false
    }

    const updatedSnippet: Snippet = {
      ...snippets[index]!,
      ...updates,
      id: snippets[index]!.id, // Ensure id is preserved
      createdAt: snippets[index]!.createdAt, // Ensure createdAt is preserved
      updatedAt: new Date()
    }

    const newSnippets = [...snippets]
    newSnippets[index] = updatedSnippet

    const categories = this.updateCategories()
    
    this.state.setState({
      snippets: newSnippets,
      categories,
      lastUpdated: new Date()
    })

    this.emit('snippetUpdated', updatedSnippet)
    
    if (this.options.autoSave) {
      await this.save()
    }

    return true
  }

  // Remove a snippet
  async removeSnippet(id: string): Promise<boolean> {
    const snippets = this.state.get('snippets') || []
    const snippet = snippets.find(s => s.id === id)
    
    if (!snippet) {
      return false
    }

    const newSnippets = snippets.filter(s => s.id !== id)
    const categories = this.updateCategories()
    
    this.state.setState({
      snippets: newSnippets,
      categories,
      totalCount: newSnippets.length,
      lastUpdated: new Date()
    })

    this.emit('snippetRemoved', snippet)
    
    if (this.options.autoSave) {
      await this.save()
    }

    return true
  }

  // Search snippets
  searchSnippets(query: string, options?: {
    searchFields?: ('title' | 'content' | 'description' | 'tags')[]
    category?: string
    language?: string
  }): Snippet[] {
    const snippets = this.state.get('snippets') || []
    const searchFields = options?.searchFields || ['title', 'content', 'description']
    const lowerQuery = query.toLowerCase()

    return snippets.filter(snippet => {
      // Filter by category if specified
      if (options?.category && snippet.category !== options.category) {
        return false
      }

      // Filter by language if specified
      if (options?.language && snippet.language !== options.language) {
        return false
      }

      // Search in specified fields
      return searchFields.some(field => {
        if (field === 'tags') {
          return snippet.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
        }
        const value = snippet[field]
        return value && value.toLowerCase().includes(lowerQuery)
      })
    })
  }

  // Get snippets by category
  getSnippetsByCategory(category: string): Snippet[] {
    const snippets = this.state.get('snippets') || []
    return snippets.filter(snippet => snippet.category === category)
  }

  // Get all categories
  getCategories(): string[] {
    return this.state.get('categories') || []
  }

  /** Returns computed statistics: totalSnippets, categories count, languages count, categoryCounts, and lastUpdated. */
  get stats() {
    const snippets = this.state.get('snippets')!
    const languages = [...new Set(snippets.map(s => s.language).filter(Boolean))]
    const categoryCounts = snippets.reduce((acc, snippet) => {
      const category = snippet.category || 'Uncategorized'
      acc[category] = (acc[category] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return {
      totalSnippets: this.state.get('totalCount'),
      categories: this.state.get('categories')!.length,
      languages: languages.length,
      categoryCounts,
      lastUpdated: this.state.get('lastUpdated')
    }
  }

  // Save snippets (override in subclasses for persistence)
  async save(): Promise<void> {
    // Default implementation - emit event for other features to handle
    this.emit('save', this.state.get('snippets'))
  }

  // Load snippets (override in subclasses for persistence)
  async load(): Promise<void> {
    // Default implementation - emit event for other features to handle
    this.emit('load')
  }

  // Private helper methods
  private generateId(): string {
    return `snippet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private updateCategories(newCategory?: string): string[] {
    const snippets = this.state.get('snippets')!
    const categories = new Set([...this.state.get('categories')!])
    
    if (newCategory) {
      categories.add(newCategory)
    }

    // Add any categories from existing snippets
    snippets.forEach(snippet => {
      if (snippet.category) {
        categories.add(snippet.category)
      }
    })

    return Array.from(categories).sort()
  }
}

// Register the feature
export default features.register('snippets', Snippets)

// Add TypeScript support via module augmentation
declare module '../../feature' {
  interface AvailableFeatures {
    snippets: typeof Snippets
  }
}
