import container from '@soederpop/luca/agi'

async function main() {
	const vm = container.feature('vm')
	const skillsFile = container.paths.resolve('experts/luca-core-framework/skills.ts')
	const skills = await container.fs.readFile(skillsFile)
	const transformedSkills = await container.feature('esbuild').transform(skills.toString(), { format: 'cjs' })

	const mod = { exports: {} as Record<string, any> }
	await vm.run(transformedSkills.code, { container, module: mod, exports: mod.exports })

	console.log('Loaded skills:', Object.keys(mod.exports))
	console.log(mod.exports)
}

main()