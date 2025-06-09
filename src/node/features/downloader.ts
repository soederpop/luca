import { Feature, features } from '../feature.js'
import fetch from 'cross-fetch'
import { writeFile } from 'fs/promises'

export class Downloader extends Feature {
  static override shortcut = 'features.downloader' as const
  
  async download(url: string, targetPath: string) {
    const buffer = await fetch(url).then(res => res.arrayBuffer())
    await writeFile(
      this.container.paths.resolve(targetPath),
      Buffer.from(buffer)
    )
    
    return this.container.paths.resolve(targetPath)
  }
  
}

export default features.register('downloader', Downloader)