import { describe, it, expect, beforeEach } from 'bun:test'
import { AGIContainer } from '../src/agi/container.server'

describe('AssistantsManager option overrides', () => {
	let container: AGIContainer
	let manager: any

	beforeEach(() => {
		container = new AGIContainer()
		manager = container.feature('assistantsManager')
	})

	it('overridesFor returns {} when nothing is set', () => {
		expect(manager.overridesFor('chiefOfStaff')).toEqual({})
	})

	it('overridesFor merges defaults with the per-assistant entry', () => {
		manager.setOptionOverrides({
			defaults: { providerOptions: { cwd: '/tmp/ws' }, temperature: 0.3 },
			chiefOfStaff: { model: 'qwen3-coder', temperature: 0.5 },
		})
		expect(manager.overridesFor('chiefOfStaff')).toEqual({
			providerOptions: { cwd: '/tmp/ws' },
			temperature: 0.5,
			model: 'qwen3-coder',
		})
		expect(manager.overridesFor('other')).toEqual({
			providerOptions: { cwd: '/tmp/ws' },
			temperature: 0.3,
		})
	})

	it('overridesFor strips the assistants/ prefix', () => {
		manager.setOptionOverrides({ chiefOfStaff: { model: 'x' } })
		expect(manager.overridesFor('assistants/chiefOfStaff').model).toBe('x')
	})

	it('create applies overrides but explicit call-site options win', () => {
		manager.setOptionOverrides({
			defaults: { temperature: 0.3 },
			bot: { model: 'config-model', allowTools: ['a', 'b'] },
		})

		let received: Record<string, any> = {}
		manager.register('bot', (options: Record<string, any>) => {
			received = options
			return container.feature('assistant', { name: 'bot-instance', ...options })
		})

		manager.create('bot', { model: 'cli-model', allowTools: ['c'] })

		expect(received.model).toBe('cli-model')
		expect(received.temperature).toBe(0.3)
		// arrays are replaced wholesale, not merged index-wise
		expect(received.allowTools).toEqual(['c'])
	})

	it('nested providerOptions deep-merge between defaults and per-assistant entries', () => {
		manager.setOptionOverrides({
			defaults: { providerOptions: { cwd: '/tmp/ws', askOptions: { stream: true } } },
			bot: { providerOptions: { askOptions: { stream: false } } },
		})
		expect(manager.overridesFor('bot').providerOptions).toEqual({
			cwd: '/tmp/ws',
			askOptions: { stream: false },
		})
	})
})
