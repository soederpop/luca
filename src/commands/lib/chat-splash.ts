/**
 * Animated splash screen for `luca chat`, built on ui.canvas + ui.animate.
 *
 * Three stacked elements animate together for ~1.5s and then settle:
 * a figlet LUCA wordmark with a gradient sweep, a braille waveform whose
 * amplitude eases in (a voice signal — this is a conversational framework),
 * and a typewriter-revealed tagline. The final frame is the static intro
 * art: ui.animate overwrites in place, so whatever the last frame shows is
 * what stays in the scrollback above the chat session.
 *
 * Skipped when stdout is not a TTY (the plain-chat pipe path stays clean),
 * when --no-splash is passed, or when LUCA_NO_SPLASH is set.
 */

const TAGLINE = 'Lightweight Universal Conversational Architecture'

// Wordmark sweep palette and the waveform's edge-to-edge blend
const SWEEP = ['#4ecdc4', '#45b7d1', '#a06cd5', '#e94560']
const WAVE_A = ['#4ecdc4', '#e94560'] as const
const WAVE_B = ['#45b7d1', '#ffd166'] as const

/**
 * Truecolor horizontal sweep. ui.applyGradient cycles named chalk colors per
 * character; for a smooth 24-bit blend we sample the palette per column with
 * lerpColor and paint via colors.hex. `phase` shifts the palette per frame.
 */
function sweep(ui: any, lines: string[], palette: string[], phase: number, width: number): string {
	// close the loop so the moving sweep never shows a hard seam mid-word
	const stops = [...palette, palette[0]!]
	const span = stops.length - 1
	return lines
		.map((line) =>
			line
				.split('')
				.map((ch, x) => {
					if (ch === ' ') return ch
					const p = (x / Math.max(1, width - 1) + phase) % 1
					const scaled = p * span
					const idx = Math.min(span - 1, Math.floor(scaled))
					const color = ui.lerpColor(stops[idx], stops[idx + 1], scaled - idx)
					return ui.colors.hex(color)(ch)
				})
				.join(''),
		)
		.join('\n')
}

export async function runChatSplash(container: any): Promise<void> {
	if (!process.stdout.isTTY) return
	if (process.env.LUCA_NO_SPLASH) return

	const ui = container.feature('ui')
	const columns = Math.max(44, Math.min(process.stdout.columns || 80, 76))

	let art: string
	try {
		art = ui.asciiArt('LUCA', 'Big')
	} catch {
		return // figlet font unavailable — chat works fine without ceremony
	}

	const artLines: string[] = art.replace(/\s+$/, '').split('\n')
	const artWidth = Math.max(...artLines.map((line: string) => line.length))
	const artPad = ' '.repeat(Math.max(0, Math.floor((columns - artWidth) / 2)))

	// braille cells are 2x4 pixels, so the canvas is columns*2 wide and
	// 16px tall (4 terminal rows)
	const waveWidth = columns * 2
	const waveHeight = 16
	const waveMid = waveHeight / 2

	const taglinePad = ' '.repeat(Math.max(0, Math.floor((columns - TAGLINE.length) / 2)))

	const totalFrames = 45
	const settleAt = totalFrames - 8 // hold the finished art for the last frames

	const { done } = ui.animate(
		(frame: number) => {
			const t = Math.min(1, frame / settleAt)
			const eased = 1 - Math.pow(1 - t, 3)

			// wordmark: gradient sweep that decelerates to a stop with the easing
			const banner = sweep(ui, artLines, SWEEP, (1 - eased) * 0.75, artWidth)
				.split('\n')
				.map((line: string) => artPad + line)
				.join('\n')

			// waveform: two phase-drifting sines, amplitude eased in and tapered
			// toward the edges so the signal reads as emerging, not clipped
			const wave = ui.canvas(waveWidth, waveHeight)
			for (let x = 0; x < waveWidth; x++) {
				const p = x / (waveWidth - 1)
				const amp = eased * (waveMid - 1) * Math.sin(p * Math.PI)
				wave.set(x, Math.round(waveMid + Math.sin(x / 7 + frame / 3) * amp), ui.lerpColor(WAVE_A[0], WAVE_A[1], p))
				wave.set(x, Math.round(waveMid + Math.sin(x / 3.1 - frame / 4) * amp * 0.55), ui.lerpColor(WAVE_B[0], WAVE_B[1], p))
			}

			// tagline: typewriter reveal, space-padded so line width stays stable
			const shown = Math.round(eased * TAGLINE.length)
			const tagline = taglinePad + ui.colors.dim(TAGLINE.slice(0, shown)) + ' '.repeat(TAGLINE.length - shown)

			return [banner, wave.render('braille'), tagline].join('\n')
		},
		{ fps: 30, frames: totalFrames },
	)
	await done
	console.log()
}
