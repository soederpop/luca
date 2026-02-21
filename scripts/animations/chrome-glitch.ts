import type { AsciiAnimation } from './types'

const frames = [
  String.raw`
      ######   ######  ########
      ##  ##   ##  ##     ##
      ######   ##  ##     ##
      ##  ##   ##  ##     ##
      ##  ##   ######     ##
      ##  ##   ######     ##

         [o_o]  channel-open
          /|\   packet-sync
          / \   pulse: 71%

      <<..................>>
`,
  String.raw`
      ######   ######  ########
      ##  ##   ##  ##     ##
      ######   ##  ##     ##
      ##  ##   ##  ##     ##
      ##  ##   ######     ##
      ##  ##   ######     ##

         [0_0]  channel-open
          /|\   packet-sync
          / \   pulse: 84%

      <<##..##..##..##..##..>>
`,
  String.raw`
      ######   ######  ########
      ##  ##   ##  ##     ##
      ######   ##  ##     ##
      ##  ##   ##  ##     ##
      ##  ##   ######     ##
      ##  ##   ######     ##

         [O_O]  channel-open
          /|\   packet-sync
          / \   pulse: 96%

      <<##################>>
`,
]

const chromeGlitch: AsciiAnimation = {
  id: 'chromeGlitch',
  name: 'Chrome Glitch Totem',
  fps: 5,
  frames,
}

export default chromeGlitch
