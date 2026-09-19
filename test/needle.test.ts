import { describe, it, expect } from 'bun:test'
import {
	needlePlatformFolder,
	needleBinaryName,
	needleWeightsPath,
	normalizeTools,
	hashToolSet,
	probeNeedle,
	NEEDLE_HF_REPO,
	NEEDLE_WEIGHTS_FILE,
} from '../src/node/features/needle'
import { z } from 'zod'

describe('needle', () => {
	it('maps this platform to a Hugging Face folder', () => {
		// The dev/CI platforms are all in the map; an unknown platform returns null
		const folder = needlePlatformFolder()
		if (process.platform === 'darwin' && process.arch === 'arm64') {
			expect(folder).toBe('macos-arm64')
		} else {
			expect(typeof folder === 'string' || folder === null).toBe(true)
		}
	})

	it('respects the LUCA_NEEDLE_PLATFORM override', () => {
		process.env.LUCA_NEEDLE_PLATFORM = 'linux-riscv64'
		try {
			expect(needlePlatformFolder()).toBe('linux-riscv64')
		} finally {
			delete process.env.LUCA_NEEDLE_PLATFORM
		}
	})

	it('names the binary per platform', () => {
		expect(needleBinaryName()).toBe(process.platform === 'win32' ? 'needle.exe' : 'needle')
	})

	it('puts weights in the shared model cache', () => {
		expect(needleWeightsPath()).toContain('luca')
		expect(needleWeightsPath().endsWith(NEEDLE_WEIGHTS_FILE)).toBe(true)
	})

	it('pins the expected Hugging Face repo', () => {
		expect(NEEDLE_HF_REPO).toBe('Cactus-Compute/needle3')
	})

	describe('normalizeTools', () => {
		it('passes plain JSON Schema parameters through unchanged', () => {
			const params = {
				type: 'object',
				properties: { city: { type: 'string' } },
				required: ['city'],
			}
			const [tool] = normalizeTools([{ name: 'get_weather', description: 'x', parameters: params }])
			expect(tool!.parameters).toEqual(params)
		})

		it('converts zod object schemas to JSON Schema', () => {
			const [tool] = normalizeTools([{
				name: 'set_timer',
				description: 'Set a countdown timer.',
				parameters: z.object({ minutes: z.number().describe('Timer length in minutes') }),
			}])
			const params = tool!.parameters as any
			expect(params.type).toBe('object')
			expect(params.properties.minutes.type).toBe('number')
			expect(params.properties.minutes.description).toBe('Timer length in minutes')
			expect(params.required).toEqual(['minutes'])
		})
	})

	describe('hashToolSet', () => {
		const tools = [{ name: 'a', description: 'b', parameters: { type: 'object' } }]

		it('is deterministic', () => {
			expect(hashToolSet(tools)).toBe(hashToolSet(tools))
			expect(hashToolSet(tools)).toMatch(/^[0-9a-f]{16}$/)
		})

		it('changes when tools or system prompt change', () => {
			const other = [{ name: 'a2', description: 'b', parameters: { type: 'object' } }]
			expect(hashToolSet(other)).not.toBe(hashToolSet(tools))
			expect(hashToolSet(tools, 'locale: de')).not.toBe(hashToolSet(tools))
		})
	})

	it('probeNeedle reports a closed port as down', async () => {
		expect(await probeNeedle(1, 300)).toBe(false)
	})
})
