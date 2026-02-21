import type { AsciiAnimation } from './types'
import neonPulse from './neon-pulse'
import chromeGlitch from './chrome-glitch'

const animations: AsciiAnimation[] = [neonPulse, chromeGlitch]

export function listAnimations(): AsciiAnimation[] {
  return animations
}

export function resolveAnimation(id: string): AsciiAnimation {
  const match = animations.find((animation) => animation.id.toLowerCase() === id.toLowerCase())
  if (match) return match
  if (!animations[0]) throw new Error('No animations are registered.')
  return animations[0]
}
