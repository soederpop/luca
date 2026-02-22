import container from '@soederpop/luca/agi'

const fs = container.feature('fs')

const data = await fs.readJson('package.json') as { name: string, version: string }

console.log(data.name)

const info = container.feature('git').branch

console.log(info)

const opener = container.feature('opener')

await opener.open('https://www.tiktok.com')