import container from "../src/node"

const { ui } = container

async function main() {
	await start()
	await crawlLookingForClassesWhichDefineAStaticShortcutProperty()
}

main()

async function start() {
	const fileManager = container.feature("fileManager")
	await fileManager.start()
}

async function crawlLookingForClassesWhichDefineAStaticShortcutProperty() {

}