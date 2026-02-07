import container from '@/agi'

async function main() {
const fileManager = await container.feature('fileManager').enable()
await fileManager.start()

const fileIds = fileManager.fileIds
const typescriptFiles = fileManager.matchFiles("**/*.ts")

console.log(fileIds)
console.log(typescriptFiles)
}

main()