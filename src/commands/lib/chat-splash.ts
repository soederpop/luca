/**
 * Animated splash screen for `luca chat`, built on ui.canvas + ui.animate.
 *
 * A fast (~0.6s) fade-in: a figlet LUCA wordmark under a truecolor gradient,
 * a braille waveform (a voice signal — this is a conversational framework),
 * and the tagline, all brightening from dark to full. The final frame is the
 * static intro art at full brightness: ui.animate overwrites in place, so
 * whatever the last frame shows is what stays on screen while the chat TUI
 * boots beneath it.
 *
 * Skipped when stdout is not a TTY (the plain-chat pipe path stays clean),
 * when --no-splash is passed, or when LUCA_NO_SPLASH is set.
 */

const TAGLINE = 'Lightweight Universal Conversational Architecture'

// Wordmark gradient and the waveform's edge-to-edge blends
const SWEEP = ['#4ecdc4', '#45b7d1', '#a06cd5', '#e94560']
const WAVE_A = ['#4ecdc4', '#e94560'] as const
const WAVE_B = ['#45b7d1', '#ffd166'] as const

type RGB = { r: number; g: number; b: number }

const dimmed = (c: RGB, k: number): RGB => ({
	r: Math.round(c.r * k),
	g: Math.round(c.g * k),
	b: Math.round(c.b * k),
})

/**
 * Truecolor horizontal gradient across the wordmark. ui.applyGradient cycles
 * named chalk colors per character; for a smooth 24-bit blend we sample the
 * palette per column with lerpColor (which returns {r,g,b} — feed it to
 * colors.rgb, NOT colors.hex, or every glyph comes out black) and scale by
 * `brightness` for the fade-in.
 */
function paintWordmark(ui: any, lines: string[], palette: string[], brightness: number, width: number): string {
	const span = palette.length - 1
	return lines
		.map((line) =>
			line
				.split('')
				.map((ch, x) => {
					if (ch === ' ') return ch
					const scaled = (x / Math.max(1, width - 1)) * span
					const idx = Math.min(span - 1, Math.floor(scaled))
					const c = dimmed(ui.lerpColor(palette[idx], palette[idx + 1], scaled - idx), brightness)
					return ui.colors.rgb(c.r, c.g, c.b)(ch)
				})
				.join(''),
		)
		.join('\n')
}

/**
 * Runs the splash and resolves to the number of terminal lines it left on
 * screen (0 when skipped) — the chat TUI subtracts this from its viewport
 * padding so the settled art stays visible above the session instead of
 * being pushed into scrollback.
 */
export async function runChatSplash(container: any): Promise<number> {
	if (!process.stdout.isTTY) return 0
	if (process.env.LUCA_NO_SPLASH) return 0

	const ui = container.feature('ui')
	const columns = Math.max(44, Math.min(process.stdout.columns || 80, 76))

	let art: string
	try {
		art = ui.asciiArt('LUCA', 'Big')
	} catch {
		return 0 // figlet font unavailable — chat works fine without ceremony
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

	const totalFrames = 36 // ~1.2s at 30fps
	const fadePortion = 0.55 // brightness finishes ramping just past halfway

	const { done } = ui.animate(
		(frame: number) => {
			const t = Math.min(1, frame / (totalFrames - 1))
			const eased = 1 - Math.pow(1 - t, 3)
			// fade completes early so the second half is pure motion settling;
			// never start fully black — the art is visible from frame one
			const fade = Math.min(1, t / fadePortion)
			const brightness = 0.2 + (1 - Math.pow(1 - fade, 3)) * 0.8
			// wave phase decelerates with the easing, so motion glides to a
			// stop instead of freezing — the last frame is the resting art
			const drift = eased * 22

			const banner = paintWordmark(ui, artLines, SWEEP, brightness, artWidth)
				.split('\n')
				.map((line: string) => artPad + line)
				.join('\n')

			// waveform: two phase-drifting sines, amplitude ramping in with the
			// fade, tapered toward the edges so the signal reads as emerging
			const wave = ui.canvas(waveWidth, waveHeight)
			for (let x = 0; x < waveWidth; x++) {
				const p = x / (waveWidth - 1)
				const amp = eased * (waveMid - 1) * Math.sin(p * Math.PI)
				wave.set(
					x,
					Math.round(waveMid + Math.sin(x / 7 + drift) * amp),
					dimmed(ui.lerpColor(WAVE_A[0], WAVE_A[1], p), brightness),
				)
				wave.set(
					x,
					Math.round(waveMid + Math.sin(x / 3.1 - drift * 1.4) * amp * 0.55),
					dimmed(ui.lerpColor(WAVE_B[0], WAVE_B[1], p), brightness),
				)
			}

			// tagline fades in with everything else — explicit gray via rgb, not
			// colors.dim, which can vanish entirely on some dark themes
			const gray = Math.round(150 * brightness)
			const tagline = taglinePad + ui.colors.rgb(gray, gray, gray)(TAGLINE)

			return [banner, wave.render('braille'), tagline].join('\n')
		},
		{ fps: 30, frames: totalFrames },
	)
	await done
	console.log()

	// banner + 4 braille rows + tagline + the trailing blank line
	return artLines.length + waveHeight / 4 + 1 + 1
}
