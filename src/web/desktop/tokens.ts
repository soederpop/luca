/**
 * The Luca Desktop look, as data: the default dark and light palettes, the
 * type scale, spacing, radii and motion. `css.ts` turns it into `kit.css`;
 * the Swift app holds the same values in `apps/desktop/Sources/Theme/Tokens.swift`
 * (`test/desktop-kit.test.ts` fails when the two drift).
 *
 * Named themes (Monokai, Nord, …) live only in the app. A page never needs
 * them: the app pushes the live palette into the page as `--al-*` variables
 * through the host bridge, so `kit.css` holds the default colors only.
 */

export type DesktopPalette = {
	ground: string
	surface: string
	raised: string
	inset: string
	border: string
	borderStrong: string
	text: string
	textBody: string
	textMuted: string
	textFaint: string
	accent: string
	accentOn: string
	accentSoft: string
	good: string
	warn: string
	bad: string
	info: string
	idle: string
	shadow: string
	syntax: {
		keyword: string
		string: string
		number: string
		comment: string
		property: string
		type: string
		function: string
	}
	/** Spare hues: project colors, and the kind colors that are not code colors. */
	hues: string[]
}

export const DARK: DesktopPalette = {
	ground: '#070D18',
	surface: '#0E1A2D',
	raised: '#16283F',
	inset: '#0A1524',
	border: '#7EA0D624',
	borderStrong: '#7EA0D642',
	text: '#EAF3FD',
	textBody: '#C9D8EA',
	textMuted: '#97ADC6',
	textFaint: '#7D97B7',
	accent: '#57E0C4',
	accentOn: '#04241D',
	accentSoft: '#57E0C429',
	good: '#4ADE80',
	warn: '#F5C46B',
	bad: '#FA8484',
	info: '#7CB4F5',
	idle: '#97ADC6',
	shadow: '#00000073',
	syntax: {
		keyword: '#57E0C4',
		string: '#4ADE80',
		number: '#F5C46B',
		comment: '#7D97B7',
		property: '#7CB4F5',
		type: '#B4A3F8',
		function: '#F0A96B',
	},
	hues: ['#F0A96B', '#7CB4F5', '#B4A3F8', '#F57FB0', '#F5C46B', '#6BD6C6', '#9BD66B', '#F08A7A'],
}

export const LIGHT: DesktopPalette = {
	ground: '#EFF4F9',
	surface: '#FFFFFF',
	raised: '#E4ECF5',
	inset: '#EDF2F8',
	border: '#14375C24',
	borderStrong: '#14375C42',
	text: '#0C1B2C',
	textBody: '#22384F',
	textMuted: '#465B70',
	textFaint: '#52667A',
	accent: '#086B5C',
	accentOn: '#FFFFFF',
	accentSoft: '#086B5C1F',
	good: '#11683A',
	warn: '#755109',
	bad: '#A32F22',
	info: '#1B50A6',
	idle: '#465B70',
	shadow: '#0A1A2B29',
	syntax: {
		keyword: '#086B5C',
		string: '#11683A',
		number: '#755109',
		comment: '#52667A',
		property: '#1B50A6',
		type: '#6242C4',
		function: '#A8500A',
	},
	hues: ['#B8590C', '#2563C9', '#6242C4', '#C0367A', '#8A600C', '#0F7A8C', '#3F7F1A', '#B5422F'],
}

/** Pixels. The app pushes the same sizes, so a page reads the same with or without the host. */
export const TYPE_SCALE = { xs: 18, sm: 19, base: 20, md: 21, lg: 23, xl: 27, '2xl': 33, '3xl': 40 } as const
export const SPACE = { 1: 2, 2: 4, 3: 6, 4: 8, 5: 12, 6: 16, 7: 24, 8: 32 } as const
export const RADIUS = { sm: 4, md: 8, lg: 12, pill: 999 } as const
export const LAYOUT = { 'tile-header': 34, 'status-line': 36, 'tile-gap': 6, 'focus-ring': 1 } as const
/** Milliseconds. */
export const MOTION = { fast: 120, base: 180, slow: 320 } as const
export const FONTS = {
	sans: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif',
	mono: 'ui-monospace, "SF Mono", Menlo, monospace',
} as const
export const LEADING = { tight: 1.2, normal: 1.45 } as const

/** The `--al-*` color variables of one palette, in the order the app sends them. */
export function paletteVars(p: DesktopPalette): Record<string, string> {
	const vars: Record<string, string> = {
		'--al-ground': p.ground,
		'--al-surface': p.surface,
		'--al-raised': p.raised,
		'--al-inset': p.inset,
		'--al-border': p.border,
		'--al-border-strong': p.borderStrong,
		'--al-text': p.text,
		'--al-text-body': p.textBody,
		'--al-text-muted': p.textMuted,
		'--al-text-faint': p.textFaint,
		'--al-accent': p.accent,
		'--al-accent-on': p.accentOn,
		'--al-accent-soft': p.accentSoft,
		'--al-good': p.good,
		'--al-warn': p.warn,
		'--al-bad': p.bad,
		'--al-info': p.info,
		'--al-idle': p.idle,
		'--al-shadow': p.shadow,
	}
	p.hues.forEach((hex, i) => { vars[`--al-hue-${i + 1}`] = hex })
	for (const [name, hex] of Object.entries(p.syntax)) vars[`--al-syntax-${name}`] = hex
	return vars
}

/** The variables that do not change with the palette: type, space, radii, motion, layout. */
export function scaleVars(): Record<string, string> {
	const vars: Record<string, string> = {
		'--al-font-sans': FONTS.sans,
		'--al-font-mono': FONTS.mono,
	}
	for (const [k, v] of Object.entries(TYPE_SCALE)) vars[`--al-text-${k}`] = `${v}px`
	for (const [k, v] of Object.entries(LEADING)) vars[`--al-leading-${k}`] = String(v)
	for (const [k, v] of Object.entries(SPACE)) vars[`--al-space-${k}`] = `${v}px`
	for (const [k, v] of Object.entries(RADIUS)) vars[`--al-radius-${k}`] = `${v}px`
	for (const [k, v] of Object.entries(MOTION)) vars[`--al-motion-${k}`] = `${v}ms`
	vars['--al-motion-ease'] = 'cubic-bezier(0.2, 0.8, 0.2, 1)'
	for (const [k, v] of Object.entries(LAYOUT)) vars[`--al-${k}`] = `${v}px`
	return vars
}

/** Every token as plain JSON, for `luca desktop sdk` and for tools that read tokens. */
export function tokensJson() {
	return {
		prefix: '--al-',
		dark: DARK,
		light: LIGHT,
		type: TYPE_SCALE,
		space: SPACE,
		radius: RADIUS,
		layout: LAYOUT,
		motion: MOTION,
		fonts: FONTS,
		leading: LEADING,
	}
}
