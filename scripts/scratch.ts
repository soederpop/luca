import container from '@/agi'

const fs = container.feature('fs')

const data = await fs.readJson('package.json') as { name: string, version: string }

console.log(data.name)

const info = container.feature('git').branch

console.log(info)