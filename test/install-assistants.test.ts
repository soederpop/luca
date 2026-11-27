import { NodeContainer } from '../src/node/container'
import { installBundledAssistants, bundledAssistantNames, CLI_STAMP, DESKTOP_STAMP } from '../src/bootstrap/install-assistants'

const container = new NodeContainer()
const fs = container.feature('fs')
const { paths } = container

function scratchHome() {
	const home = paths.resolve(container.os.tmpdir, `luca-install-assistants-${container.utils.uuid()}`)
	fs.ensureFolder(home)
	return home
}

const folderOf = (home: string) => paths.resolve(home, '.luca', 'assistants', 'lucaArchitect')

describe('installBundledAssistants', () => {
	it('ships lucaArchitect', () => {
		expect(bundledAssistantNames()).toContain('lucaArchitect')
	})

	it('installs with both stamps and the luca-framework skill, then is current', async () => {
		const home = scratchHome()
		const first = await installBundledAssistants(container, { home })
		expect(first.find((r) => r.name === 'lucaArchitect')!.outcome).toBe('installed')

		const folder = folderOf(home)
		expect(fs.exists(paths.resolve(folder, 'CORE.md'))).toBe(true)
		expect(fs.exists(paths.resolve(folder, 'skills', 'luca-framework', 'SKILL.md'))).toBe(true)
		expect(String(fs.readFile(paths.resolve(folder, CLI_STAMP))).trim()).toBe(String(fs.readFile(paths.resolve(folder, DESKTOP_STAMP))).trim())

		const second = await installBundledAssistants(container, { home })
		expect(second[0]!.outcome).toBe('current')
	})

	it('replaces its own older copy', async () => {
		const home = scratchHome()
		await installBundledAssistants(container, { home })
		const folder = folderOf(home)
		fs.writeFile(paths.resolve(folder, CLI_STAMP), 'old\n')
		fs.writeFile(paths.resolve(folder, 'stale.txt'), 'gone after update')

		const result = await installBundledAssistants(container, { home })
		expect(result[0]!.outcome).toBe('updated')
		expect(fs.exists(paths.resolve(folder, 'stale.txt'))).toBe(false)
	})

	it("leaves the desktop's copy and a hand-made folder alone", async () => {
		const desktopHome = scratchHome()
		fs.ensureFolder(folderOf(desktopHome))
		fs.writeFile(paths.resolve(folderOf(desktopHome), DESKTOP_STAMP), 'desktop-build\n')
		fs.writeFile(paths.resolve(folderOf(desktopHome), 'CORE.md'), 'desktop')
		expect((await installBundledAssistants(container, { home: desktopHome }))[0]!.outcome).toBe('desktop')
		expect(String(fs.readFile(paths.resolve(folderOf(desktopHome), 'CORE.md')))).toBe('desktop')

		const userHome = scratchHome()
		fs.ensureFolder(folderOf(userHome))
		fs.writeFile(paths.resolve(folderOf(userHome), 'CORE.md'), 'mine')
		expect((await installBundledAssistants(container, { home: userHome }))[0]!.outcome).toBe('handMade')
		expect(String(fs.readFile(paths.resolve(folderOf(userHome), 'CORE.md')))).toBe('mine')
	})
})
