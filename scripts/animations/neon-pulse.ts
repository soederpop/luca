import type { AsciiAnimation } from './types'

const frames = [
  String.raw`
             .-""-.
           .' .--. '.
          /  /    \  \
          | | 0  0 | |
          | |  __  | |
          | | /__\ | |
          | | \__/ | |
          | |      | |
         /|  '.__.'  |\
       .' |   /::\   | '.
      /   |  |::::|  |   \
     /____|__|::::|__|____\
        /_/   |::|   \_\
             /____\
     ~ ~ ~  SIGNAL: STABLE  ~ ~ ~
`,
  String.raw`
             .-""-.
           .' .--. '.
          /  / /\ \  \
          | | ^  ^ | |
          | |  --  | |
          | | /__\ | |
          | | \__/ | |
          | |  /\  | |
         /|  '.__.'  |\
       .' |  _/::\_  | '.
      /   | |::::::| |   \
     /____|_|::::::|_|____\
        /_/   |::|   \_\
             /____\
     ~ ~ ~  SIGNAL: BREATHING  ~ ~ ~
`,
  String.raw`
             .-""-.
           .' .--. '.
          /  / __ \  \
          | | o  o | |
          | |  ..  | |
          | | /__\ | |
          | | \__/ | |
          | | .--. | |
         /|  '.__.'  |\
       .' |   /::\   | '.
      /   |  |::::|  |   \
     /____|__|::::|__|____\
        /_/   |::|   \_\
             /____\
     ~ ~ ~  SIGNAL: SCANNING  ~ ~ ~
`,
]

const neonPulse: AsciiAnimation = {
  id: 'neonPulse',
  name: 'Neon Pulse Bot',
  fps: 4,
  frames,
}

export default neonPulse
