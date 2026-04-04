// Bootstrap stub — replaced by: bun run build:scaffolds

export interface ScaffoldSection {
  heading: string
  code: string
}

export interface ScaffoldData {
  sections: ScaffoldSection[]
  full: string
  tutorial: string
}

export const scaffolds: Record<string, ScaffoldData> = {}

export const assistantFiles: Record<string, string> = {}

export const mcpReadme = ``
