/**
 * Excalidraw Expert Skills
 *
 * Skills for generating, rendering, evaluating, and iterating on Excalidraw diagrams.
 * The container global is injected at runtime by the VM execution context.
 */
import type { AGIContainer } from '@/agi/container.server'

declare global {
	const container: AGIContainer
}

const { z } = container

// Style presets that control the look and feel of generated diagrams
const STYLE_PRESETS: Record<string, any> = {
	'hand-drawn': {
		roughness: 1,
		fontFamily: 1,
		fillStyle: 'hachure',
		strokeWidth: 2,
		backgroundColor: '#ffffff',
		palette: {
			shapes: ['#a5d8ff', '#b2f2bb', '#ffec99', '#ffc9c9', '#d0bfff', '#99e9f2'],
			strokes: ['#1e1e1e', '#1971c2', '#2f9e44', '#e03131', '#f08c00', '#9c36b5'],
		}
	},
	'clean': {
		roughness: 0,
		fontFamily: 2,
		fillStyle: 'solid',
		strokeWidth: 2,
		backgroundColor: '#ffffff',
		palette: {
			shapes: ['#dbe4ff', '#d3f9d8', '#fff3bf', '#ffe3e3', '#e5dbff', '#c3fae8'],
			strokes: ['#343a40', '#1971c2', '#2f9e44', '#e03131', '#f08c00', '#7048e8'],
		}
	},
	'blueprint': {
		roughness: 0,
		fontFamily: 3,
		fillStyle: 'solid',
		strokeWidth: 1,
		backgroundColor: '#1e2a3a',
		palette: {
			shapes: ['#2d4a6f', '#1a3a5c', '#3d5a80', '#2c4a6a', '#1e3a5a', '#2a4a70'],
			strokes: ['#88c0d0', '#81a1c1', '#5e81ac', '#8fbcbb', '#a3be8c', '#b48ead'],
		}
	},
	'minimal': {
		roughness: 0,
		fontFamily: 2,
		fillStyle: 'solid',
		strokeWidth: 1,
		backgroundColor: '#ffffff',
		palette: {
			shapes: ['transparent', 'transparent', 'transparent', 'transparent'],
			strokes: ['#495057', '#868e96', '#adb5bd', '#343a40'],
		}
	},
	'colorful': {
		roughness: 1,
		fontFamily: 1,
		fillStyle: 'solid',
		strokeWidth: 4,
		backgroundColor: '#ffffff',
		palette: {
			shapes: ['#4dabf7', '#51cf66', '#fcc419', '#ff6b6b', '#cc5de8', '#20c997'],
			strokes: ['#1864ab', '#2b8a3e', '#e67700', '#c92a2a', '#862e9c', '#087f5b'],
		}
	},
}

// Track the current working diagram state
let currentDiagram: any = null
let currentStyle = 'hand-drawn'
let currentOutputPath = ''
let iterationCount = 0

function getStyle() {
	return STYLE_PRESETS[currentStyle] || STYLE_PRESETS['hand-drawn']
}

function makeSeed() {
	return Math.floor(Math.random() * 2147483647)
}

function makeId(prefix: string, index: number) {
	return `${prefix}-${index}`
}

function makeBaseElement(id: string, type: string, x: number, y: number, w: number, h: number, overrides: any = {}) {
	const style = getStyle()
	return {
		id,
		type,
		x,
		y,
		width: w,
		height: h,
		angle: 0,
		strokeColor: overrides.strokeColor || style.palette.strokes[0],
		backgroundColor: overrides.backgroundColor || style.palette.shapes[0],
		fillStyle: overrides.fillStyle || style.fillStyle,
		strokeWidth: overrides.strokeWidth || style.strokeWidth,
		strokeStyle: overrides.strokeStyle || 'solid',
		roughness: style.roughness,
		opacity: 100,
		seed: makeSeed(),
		version: 1,
		versionNonce: makeSeed(),
		isDeleted: false,
		groupIds: overrides.groupIds || [],
		boundElements: overrides.boundElements || null,
		frameId: null,
		link: null,
		locked: false,
		roundness: type === 'diamond' ? null : { type: 3 },
		updated: Date.now(),
		...overrides,
	}
}

function makeRect(id: string, x: number, y: number, w: number, h: number, overrides: any = {}) {
	return makeBaseElement(id, 'rectangle', x, y, w, h, overrides)
}

function makeEllipse(id: string, x: number, y: number, w: number, h: number, overrides: any = {}) {
	return makeBaseElement(id, 'ellipse', x, y, w, h, { ...overrides, roundness: null })
}

function makeDiamond(id: string, x: number, y: number, w: number, h: number, overrides: any = {}) {
	return makeBaseElement(id, 'diamond', x, y, w, h, overrides)
}

function makeText(id: string, x: number, y: number, text: string, overrides: any = {}) {
	const style = getStyle()
	const fontSize = overrides.fontSize || 20
	const lines = text.split('\n')
	const lineHeight = overrides.lineHeight || 1.25
	const width = overrides.width || Math.max(...lines.map((l: string) => l.length * fontSize * 0.6))
	const height = overrides.height || lines.length * fontSize * lineHeight

	return {
		...makeBaseElement(id, 'text', x, y, width, height, {
			backgroundColor: 'transparent',
			strokeColor: overrides.strokeColor || style.palette.strokes[0],
			...overrides,
		}),
		text,
		fontSize,
		fontFamily: style.fontFamily,
		textAlign: overrides.textAlign || 'center',
		verticalAlign: overrides.verticalAlign || 'middle',
		containerId: overrides.containerId || null,
		originalText: text,
		autoResize: true,
		lineHeight,
	}
}

function makeArrow(id: string, startX: number, startY: number, endX: number, endY: number, overrides: any = {}) {
	const style = getStyle()
	const dx = endX - startX
	const dy = endY - startY
	return {
		...makeBaseElement(id, 'arrow', startX, startY, Math.abs(dx), Math.abs(dy), {
			backgroundColor: 'transparent',
			strokeColor: overrides.strokeColor || style.palette.strokes[0],
			roundness: { type: 2 },
			...overrides,
		}),
		points: [[0, 0], [dx, dy]],
		startArrowhead: overrides.startArrowhead || null,
		endArrowhead: overrides.endArrowhead ?? 'arrow',
		startBinding: overrides.startBinding || null,
		endBinding: overrides.endBinding || null,
	}
}

function makeLine(id: string, startX: number, startY: number, endX: number, endY: number, overrides: any = {}) {
	const dx = endX - startX
	const dy = endY - startY
	return {
		...makeBaseElement(id, 'line', startX, startY, Math.abs(dx), Math.abs(dy), {
			backgroundColor: 'transparent',
			...overrides,
		}),
		points: [[0, 0], [dx, dy]],
		startArrowhead: null,
		endArrowhead: null,
		startBinding: null,
		endBinding: null,
	}
}

function buildExcalidrawFile(elements: any[], bgColor?: string) {
	const style = getStyle()
	return {
		type: 'excalidraw',
		version: 2,
		source: 'https://excalidraw.com',
		elements,
		appState: {
			viewBackgroundColor: bgColor || style.backgroundColor,
			gridSize: null,
		},
		files: {},
	}
}

function bindArrowToShapes(arrow: any, startShape: any, endShape: any) {
	if (startShape) {
		arrow.startBinding = { elementId: startShape.id, focus: 0, gap: 5 }
		if (!startShape.boundElements) startShape.boundElements = []
		startShape.boundElements.push({ id: arrow.id, type: 'arrow' })
	}
	if (endShape) {
		arrow.endBinding = { elementId: endShape.id, focus: 0, gap: 5 }
		if (!endShape.boundElements) endShape.boundElements = []
		endShape.boundElements.push({ id: arrow.id, type: 'arrow' })
	}
}

function bindTextToShape(textEl: any, shapeEl: any) {
	textEl.containerId = shapeEl.id
	if (!shapeEl.boundElements) shapeEl.boundElements = []
	shapeEl.boundElements.push({ id: textEl.id, type: 'text' })
}

async function renderToImage(diagram: any, outputPath: string): Promise<string> {
	const excalidrawToSvg = require('excalidraw-to-svg')
	const { Resvg } = require('@resvg/resvg-js')

	const svgElement = await excalidrawToSvg(diagram)
	const svgString = svgElement.outerHTML

	const resvg = new Resvg(svgString, {
		background: diagram.appState?.viewBackgroundColor || '#ffffff',
		fitTo: { mode: 'width', value: 1600 },
	})

	const pngData = resvg.render()
	const pngBuffer = pngData.asPng()

	const fs = container.feature('fs')
	await fs.writeFileAsync(outputPath, pngBuffer)

	return outputPath
}

function imageToBase64(imagePath: string): string {
	const fs = require('fs')
	const buffer = fs.readFileSync(imagePath)
	return `data:image/png;base64,${buffer.toString('base64')}`
}

// === SKILL SCHEMAS ===

export const schemas = {
	generateDiagram: z.object({
		description: z.string().describe('A description of the diagram to generate. Be detailed about what elements, relationships, and flow to include.'),
		style: z.enum(['hand-drawn', 'clean', 'blueprint', 'minimal', 'colorful']).optional().describe('Visual style preset. Default: hand-drawn'),
		outputPath: z.string().optional().describe('Where to save the .excalidraw and .png files. Default: experts/excalidraw/output'),
		elements: z.array(z.object({
			type: z.enum(['rectangle', 'ellipse', 'diamond', 'text', 'arrow', 'line']).describe('Element type'),
			id: z.string().describe('Unique element ID'),
			x: z.number().describe('X position'),
			y: z.number().describe('Y position'),
			width: z.number().optional().describe('Width (for shapes)'),
			height: z.number().optional().describe('Height (for shapes)'),
			text: z.string().optional().describe('Text content (for text elements or shape labels)'),
			label: z.string().optional().describe('Label text to place inside this shape'),
			endX: z.number().optional().describe('End X position (for arrows/lines)'),
			endY: z.number().optional().describe('End Y position (for arrows/lines)'),
			startBinding: z.string().optional().describe('ID of the element to bind arrow start to'),
			endBinding: z.string().optional().describe('ID of the element to bind arrow end to'),
			strokeColor: z.string().optional().describe('Override stroke color'),
			backgroundColor: z.string().optional().describe('Override background color'),
			colorIndex: z.number().optional().describe('Index into the style palette for background color (0-5)'),
			strokeColorIndex: z.number().optional().describe('Index into the style palette for stroke color (0-5)'),
			fontSize: z.number().optional().describe('Font size for text elements'),
			groupId: z.string().optional().describe('Group ID to visually group elements'),
		})).describe('The elements to render in the diagram'),
	}).describe('Generate an Excalidraw diagram from a structured element description. Returns the file paths.'),

	evaluateDiagram: z.object({
		feedback: z.string().optional().describe('Specific aspects to evaluate or user feedback to consider'),
	}).describe('Evaluate the current diagram by examining the rendered image. Returns a quality assessment.'),

	reviseDiagram: z.object({
		changes: z.string().describe('Description of what changes to make to improve the diagram'),
		elements: z.array(z.object({
			type: z.enum(['rectangle', 'ellipse', 'diamond', 'text', 'arrow', 'line']).describe('Element type'),
			id: z.string().describe('Unique element ID'),
			x: z.number().describe('X position'),
			y: z.number().describe('Y position'),
			width: z.number().optional().describe('Width (for shapes)'),
			height: z.number().optional().describe('Height (for shapes)'),
			text: z.string().optional().describe('Text content (for text elements or shape labels)'),
			label: z.string().optional().describe('Label text to place inside this shape'),
			endX: z.number().optional().describe('End X position (for arrows/lines)'),
			endY: z.number().optional().describe('End Y position (for arrows/lines)'),
			startBinding: z.string().optional().describe('ID of the element to bind arrow start to'),
			endBinding: z.string().optional().describe('ID of the element to bind arrow end to'),
			strokeColor: z.string().optional().describe('Override stroke color'),
			backgroundColor: z.string().optional().describe('Override background color'),
			colorIndex: z.number().optional().describe('Index into the style palette for background color (0-5)'),
			strokeColorIndex: z.number().optional().describe('Index into the style palette for stroke color (0-5)'),
			fontSize: z.number().optional().describe('Font size for text elements'),
			groupId: z.string().optional().describe('Group ID to visually group elements'),
		})).describe('The complete revised set of elements'),
	}).describe('Revise the current diagram with improvements. Replaces all elements with the new set.'),

	getStyleInfo: z.object({
		style: z.string().optional().describe('Style name to get info about. If omitted, returns all styles.'),
	}).describe('Get information about available diagram styles and their visual properties.'),
}

// === SKILL IMPLEMENTATIONS ===

function buildElementsFromSpec(elementSpecs: any[]): any[] {
	const style = getStyle()
	const elements: any[] = []
	const shapeMap: Record<string, any> = {}

	// First pass: create shapes and text
	for (const spec of elementSpecs) {
		const colorIdx = spec.colorIndex ?? 0
		const strokeIdx = spec.strokeColorIndex ?? 0
		const bgColor = spec.backgroundColor || style.palette.shapes[colorIdx % style.palette.shapes.length]
		const strokeColor = spec.strokeColor || style.palette.strokes[strokeIdx % style.palette.strokes.length]
		const groupIds = spec.groupId ? [spec.groupId] : []

		if (spec.type === 'rectangle') {
			const rect = makeRect(spec.id, spec.x, spec.y, spec.width || 200, spec.height || 100, { backgroundColor: bgColor, strokeColor, groupIds })
			elements.push(rect)
			shapeMap[spec.id] = rect

			if (spec.label || spec.text) {
				const txt = makeText(`${spec.id}-text`, spec.x, spec.y, spec.label || spec.text, {
					containerId: spec.id,
					strokeColor,
					fontSize: spec.fontSize,
					groupIds,
				})
				bindTextToShape(txt, rect)
				elements.push(txt)
			}
		} else if (spec.type === 'ellipse') {
			const ell = makeEllipse(spec.id, spec.x, spec.y, spec.width || 150, spec.height || 100, { backgroundColor: bgColor, strokeColor, groupIds })
			elements.push(ell)
			shapeMap[spec.id] = ell

			if (spec.label || spec.text) {
				const txt = makeText(`${spec.id}-text`, spec.x, spec.y, spec.label || spec.text, {
					containerId: spec.id,
					strokeColor,
					fontSize: spec.fontSize,
					groupIds,
				})
				bindTextToShape(txt, ell)
				elements.push(txt)
			}
		} else if (spec.type === 'diamond') {
			const dia = makeDiamond(spec.id, spec.x, spec.y, spec.width || 150, spec.height || 150, { backgroundColor: bgColor, strokeColor, groupIds })
			elements.push(dia)
			shapeMap[spec.id] = dia

			if (spec.label || spec.text) {
				const txt = makeText(`${spec.id}-text`, spec.x, spec.y, spec.label || spec.text, {
					containerId: spec.id,
					strokeColor,
					fontSize: spec.fontSize,
					groupIds,
				})
				bindTextToShape(txt, dia)
				elements.push(txt)
			}
		} else if (spec.type === 'text') {
			const txt = makeText(spec.id, spec.x, spec.y, spec.text || '', {
				strokeColor,
				fontSize: spec.fontSize || 20,
				groupIds,
			})
			elements.push(txt)
		}
	}

	// Second pass: create arrows and lines with bindings
	for (const spec of elementSpecs) {
		const strokeIdx = spec.strokeColorIndex ?? 0
		const strokeColor = spec.strokeColor || style.palette.strokes[strokeIdx % style.palette.strokes.length]

		if (spec.type === 'arrow') {
			const arrow = makeArrow(spec.id, spec.x, spec.y, spec.endX || spec.x + 200, spec.endY || spec.y, { strokeColor })
			const startShape = spec.startBinding ? shapeMap[spec.startBinding] : null
			const endShape = spec.endBinding ? shapeMap[spec.endBinding] : null
			bindArrowToShapes(arrow, startShape, endShape)

			if (spec.label || spec.text) {
				const midX = spec.x + ((spec.endX || spec.x + 200) - spec.x) / 2
				const midY = spec.y + ((spec.endY || spec.y) - spec.y) / 2
				const labelText = makeText(`${spec.id}-label`, midX - 40, midY - 15, spec.label || spec.text, {
					fontSize: spec.fontSize || 14,
					strokeColor,
				})
				elements.push(labelText)
			}

			elements.push(arrow)
		} else if (spec.type === 'line') {
			const line = makeLine(spec.id, spec.x, spec.y, spec.endX || spec.x + 200, spec.endY || spec.y, { strokeColor })
			elements.push(line)
		}
	}

	return elements
}

export async function generateDiagram(options: any) {
	currentStyle = options.style || 'hand-drawn'
	iterationCount = 0

	const basePath = options.outputPath || container.paths.resolve('experts', 'excalidraw', 'output')
	const fs = container.feature('fs')

	// Ensure output directory exists
	await fs.ensureFile(basePath + '/.gitkeep')

	const elements = buildElementsFromSpec(options.elements)
	currentDiagram = buildExcalidrawFile(elements)

	const excalidrawPath = container.paths.resolve(basePath, 'diagram.excalidraw')
	const pngPath = container.paths.resolve(basePath, 'diagram.png')
	currentOutputPath = basePath

	// Save the .excalidraw file
	await fs.writeFileAsync(excalidrawPath, JSON.stringify(currentDiagram, null, 2))

	// Render to PNG
	await renderToImage(currentDiagram, pngPath)

	return JSON.stringify({
		success: true,
		excalidrawPath,
		pngPath,
		elementCount: elements.length,
		style: currentStyle,
		message: `Diagram generated with ${elements.length} elements in "${currentStyle}" style. Use evaluateDiagram to check the quality.`,
	})
}

export async function evaluateDiagram(options: any) {
	if (!currentDiagram || !currentOutputPath) {
		return JSON.stringify({ error: 'No diagram has been generated yet. Use generateDiagram first.' })
	}

	const pngPath = container.paths.resolve(currentOutputPath, 'diagram.png')
	const base64Image = imageToBase64(pngPath)

	const openai = container.client('openai') as any
	const evaluationPrompt = `You are evaluating an Excalidraw diagram that was generated programmatically. Score each criterion 1-5 and provide specific feedback.

${options.feedback ? `The user has this specific feedback: ${options.feedback}` : ''}

Evaluate:
1. **Clarity** (1-5): Can you immediately understand what's being communicated?
2. **Layout** (1-5): Is spacing even? Flow direction consistent? No overlapping?
3. **Labels** (1-5): Are they readable, well-positioned, and informative?
4. **Connections** (1-5): Do arrows clearly show relationships?
5. **Style** (1-5): Is it visually cohesive and appealing?
6. **Completeness** (1-5): Does it look like a finished diagram?

Respond in JSON format:
{
  "scores": { "clarity": N, "layout": N, "labels": N, "connections": N, "style": N, "completeness": N },
  "overall": N,
  "needsRevision": boolean,
  "issues": ["specific issue 1", "specific issue 2"],
  "suggestions": ["specific suggestion 1", "specific suggestion 2"]
}`

	const response = await openai.raw.chat.completions.create({
		model: 'gpt-4o',
		messages: [
			{
				role: 'user',
				content: [
					{ type: 'text', text: evaluationPrompt },
					{ type: 'image_url', image_url: { url: base64Image, detail: 'high' } },
				],
			},
		],
		response_format: { type: 'json_object' },
	})

	const evaluation = response.choices[0]?.message?.content || '{}'
	return evaluation
}

export async function reviseDiagram(options: any) {
	if (!currentOutputPath) {
		return JSON.stringify({ error: 'No diagram has been generated yet. Use generateDiagram first.' })
	}

	iterationCount++

	const elements = buildElementsFromSpec(options.elements)
	currentDiagram = buildExcalidrawFile(elements)

	const fs = container.feature('fs')
	const excalidrawPath = container.paths.resolve(currentOutputPath, 'diagram.excalidraw')
	const pngPath = container.paths.resolve(currentOutputPath, 'diagram.png')

	// Also save the previous version
	const prevPath = container.paths.resolve(currentOutputPath, `diagram-v${iterationCount - 1}.png`)
	if (fs.exists(pngPath)) {
		const prevData = require('fs').readFileSync(pngPath)
		await fs.writeFileAsync(prevPath, prevData)
	}

	await fs.writeFileAsync(excalidrawPath, JSON.stringify(currentDiagram, null, 2))
	await renderToImage(currentDiagram, pngPath)

	return JSON.stringify({
		success: true,
		excalidrawPath,
		pngPath,
		elementCount: elements.length,
		iteration: iterationCount,
		changes: options.changes,
		message: `Diagram revised (iteration ${iterationCount}). ${elements.length} elements. Previous version saved as diagram-v${iterationCount - 1}.png. Use evaluateDiagram to check quality.`,
	})
}

export async function getStyleInfo(options: any) {
	if (options.style) {
		const preset = STYLE_PRESETS[options.style]
		if (!preset) {
			return JSON.stringify({ error: `Unknown style: ${options.style}. Available: ${Object.keys(STYLE_PRESETS).join(', ')}` })
		}
		return JSON.stringify({ style: options.style, ...preset })
	}

	return JSON.stringify({
		available: Object.keys(STYLE_PRESETS),
		styles: Object.fromEntries(
			Object.entries(STYLE_PRESETS).map(([name, preset]: [string, any]) => [
				name,
				{
					roughness: preset.roughness,
					font: preset.fontFamily === 1 ? 'Virgil (hand)' : preset.fontFamily === 2 ? 'Helvetica' : 'Cascadia (mono)',
					fillStyle: preset.fillStyle,
					backgroundColor: preset.backgroundColor,
				},
			])
		),
	})
}
