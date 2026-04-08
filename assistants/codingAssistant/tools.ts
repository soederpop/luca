import { z } from 'zod'

const fileTools = container.feature('fileTools')

export const use = [
	container.feature('codingTools'),
	fileTools.toTools({ only: ['editFile', 'writeFile', 'deleteFile'] }),
	container.feature('processManager'),
	container.feature('skillsLibrary'),
]

export const schemas = {}
