# UI (features.ui)

> Stability: `core`

UI Feature - Interactive Terminal User Interface Builder Unified interface for building professional CLI experiences using chalk (colors/styles), figlet (ASCII art), and inquirer (interactive prompts). Provides rich color management, automatic color assignment, text gradients, banner generation, padding utilities, markdown rendering, and interactive wizards.

## Usage

```ts
container.feature('ui')
```

## Methods

### print

Enhanced print function with color methods for convenient terminal output. Call it directly like console.log, or use the attached color/style methods (red, green, blue, yellow, cyan, dim, bold, italic, underline, bg* variants) and semantic helpers (error, info, success, warn). NOTE: `ui.print.<color>(text)` is NOT a string formatter — it writes the colored text to stdout immediately and returns `undefined`. To compose a colored string (e.g. to embed inside a larger message), use `ui.colors.<color>(text)`, which returns the styled string.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `args` | `any[]` |  | Parameter args |

**Returns:** `ColoredPrintFunction`

```ts
const ui = container.feature('ui')
ui.print('plain text')
ui.print.cyan('cyan text')
ui.print.error('printed in red')
ui.print.success('printed in green')

// Composing strings: use ui.colors, not ui.print
ui.print(`Status: ${ui.colors.green('OK')}`)   // correct
ui.print(`Status: ${ui.print.green('OK')}`)    // wrong — prints "OK" on its own line, interpolates "undefined"
```



### markdown

Parse markdown text and render it for terminal display using marked-terminal. Headings, bold text, inline code, lists, and other markdown constructs come back styled for the terminal.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `text` | `string` | ✓ | The markdown string to parse and render |

**Returns:** `string | Promise<string>`

```ts
const ui = container.feature('ui')
const rendered = ui.markdown('## Features\n\n- **Bold** text\n- `inline code`\n- Regular paragraph text\n')
console.log(rendered)
```



### assignColor

Assigns a consistent color to a named entity. This method provides automatic color assignment that remains consistent across the application session. Each unique name gets assigned a color from the palette, and subsequent calls with the same name return the same color function. **Assignment Strategy:** - First call with a name assigns the next available palette color - Subsequent calls return the previously assigned color - Colors cycle through the palette when all colors are used - Returns a chalk hex color function for styling text

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `name` | `string` | ✓ | The unique identifier to assign a color to |

**Returns:** `(str: string) => string`

```ts
// Assign colors to users
const johnColor = ui.assignColor('john');
const janeColor = ui.assignColor('jane');

// Use consistently throughout the app
console.log(johnColor('John: Hello there!'));
console.log(janeColor('Jane: Hi John!'));
console.log(johnColor('John: How are you?')); // Same color as before

// Different entities get different colors
const errorColor = ui.assignColor('error');
const successColor = ui.assignColor('success');
```



### wizard

Creates an interactive wizard using inquirer prompts. This method provides a convenient wrapper around inquirer for creating interactive command-line wizards. It supports all inquirer question types and can handle complex validation and conditional logic. **Supported Question Types:** - input: Text input fields - confirm: Yes/no confirmations - list: Single selection from options - checkbox: Multiple selections - password: Hidden text input - editor: External editor integration **Advanced Features:** - Conditional questions based on previous answers - Input validation and transformation - Custom prompts and styling - Initial answer pre-population

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `questions` | `any[]` | ✓ | Array of inquirer question objects |
| `initialAnswers` | `any` |  | Pre-populated answers to skip questions or provide defaults |

**Returns:** `Promise<any>`

```ts
// (no-run) interactive — waits for keyboard input

// Basic wizard
const answers = await ui.wizard([
 {
   type: 'input',
   name: 'projectName',
   message: 'What is your project name?',
   validate: (input) => input.length > 0 || 'Name is required'
 },
 {
   type: 'list',
   name: 'framework',
   message: 'Choose a framework:',
   choices: ['React', 'Vue', 'Angular', 'Svelte']
 },
 {
   type: 'confirm',
   name: 'typescript',
   message: 'Use TypeScript?',
   default: true
 }
]);

console.log(`Creating ${answers.projectName} with ${answers.framework}`);

// With initial answers
const moreAnswers = await ui.wizard([
 { type: 'input', name: 'version', message: 'Version?' }
], { version: '1.0.0' });
```



### askQuestion

Prompt the user with a single text input question.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `question` | `string` | ✓ | The question message to display |

**Returns:** `Promise<any>`



### openInEditor

Opens text in the user's external editor for editing. This method integrates with the user's configured editor (via $EDITOR or $VISUAL environment variables) to allow editing of text content. The edited content is returned when the user saves and closes the editor. **Editor Integration:** - Respects $EDITOR and $VISUAL environment variables - Creates temporary file with specified extension - Returns modified content after editor closes - Handles editor cancellation gracefully

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `text` | `string` | ✓ | The initial text content to edit |
| `extension` | `any` |  | File extension for syntax highlighting (default: ".ts") |

**Returns:** `Promise<unknown>`

```ts
// (no-run) interactive — opens $EDITOR and waits for the user

// Edit code snippet
const code = `function hello() {\n  console.log('Hello');\n}`;
const editedCode = await ui.openInEditor(code, '.js');

// Edit configuration
const config = JSON.stringify({ port: 3000 }, null, 2);
const newConfig = await ui.openInEditor(config, '.json');

// Edit markdown content
const markdown = '# Title\n\nContent here...';
const editedMarkdown = await ui.openInEditor(markdown, '.md');
```



### asciiArt

Generates ASCII art from text using the specified font. This method converts regular text into stylized ASCII art using figlet's extensive font collection. Perfect for creating eye-catching headers, logos, and decorative text in terminal applications. **Font Capabilities:** - Large collection of artistic fonts - Various styles: block, script, decorative, technical - Different sizes and character sets - Consistent spacing and alignment

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `text` | `string` | ✓ | The text to convert to ASCII art |
| `font` | `Fonts` | ✓ | The figlet font to use (see fonts property for available options) |

**Returns:** `string`

```ts
// Create a banner
const banner = ui.asciiArt('WELCOME', 'Big');
console.log(banner);

// Different fonts for different purposes
const title = ui.asciiArt('MyApp', 'Standard');
const subtitle = ui.asciiArt('v2.0', 'Small');

// Technical/coding themes
const code = ui.asciiArt('CODE', '3D-ASCII');

// List available fonts first
console.log('Available fonts:', ui.fonts.slice(0, 10).join(', '));
```



### banner

Creates a styled banner with ASCII art and color gradients. This method combines ASCII art generation with color gradient effects to create visually striking banners for terminal applications. It automatically applies color gradients to the generated ASCII art based on the specified options. **Banner Features:** - ASCII art text generation - Automatic color gradient application - Customizable gradient directions - Multiple color combinations - Professional terminal presentation NOTE: the gradient colors rely on chalk, which auto-disables ANSI codes when stdout is not a TTY (pipes, command substitution, CI, sandboxes) — in those contexts the banner renders as plain ASCII art with no color. Not a bug; set `FORCE_COLOR=1` to force color codes into non-TTY output.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `text` | `string` | ✓ | The text to convert to a styled banner |
| `options` | `{ font: Fonts; colors: Color[] }` |  | Banner styling options |

`{ font: Fonts; colors: Color[] }` properties:

| Property | Type | Description |
|----------|------|-------------|
| `font` | `any` | The figlet font to use for ASCII art generation |
| `colors` | `any` | Array of colors for the gradient effect |

**Returns:** `string`

```ts
// Classic patriotic banner
const banner = ui.banner('AMERICA', {
 font: 'Big',
 colors: ['red', 'white', 'blue']
});
console.log(banner);

// Tech company banner
const techBanner = ui.banner('TechCorp', {
 font: 'Slant',
 colors: ['cyan', 'blue', 'magenta']
});

// Warning banner
const warningBanner = ui.banner('WARNING', {
 font: 'Standard',
 colors: ['yellow', 'red']
});

// Available fonts: see ui.fonts property
// Available colors: any chalk color names
```



### canvas

Creates a truecolor pixel canvas that renders to terminal characters. The high-fidelity tier above `asciiArt`/`banner`: instead of pre-drawn figlet glyphs you get an RGB framebuffer with drawing primitives (set, line, rect, circle, fillGradient) that renders in two modes: - `render('half')` — each cell is 2 vertical pixels (`▀` with 24-bit fg + bg). Full color; resolution = width x height/2 cells. - `render('braille')` — each cell packs 2x4 pixels (`⠁`-`⣿`), 4x the dot density but one averaged color per cell. Best for line art and plots. Dimensions are in PIXELS, not terminal cells. For a canvas spanning N columns use width N (half mode) or N*2 (braille mode). NOTE: colors rely on chalk, which strips ANSI when stdout is not a TTY — set FORCE_COLOR=1 to keep color through pipes.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `width` | `number` | ✓ | Canvas width in pixels |
| `height` | `number` | ✓ | Canvas height in pixels (even for half mode, multiple of 4 for braille) |

**Returns:** `TerminalCanvas`

```ts
const ui = container.feature('ui')

// A gradient panel with a circle, at 2-pixels-per-cell resolution
const canvas = ui.canvas(60, 20)
canvas.fillGradient('#1a1a2e', '#e94560', 'diagonal')
canvas.circle(30, 10, 7, '#ffd166', { fill: true })
console.log(canvas.render('half'))

// A sine wave in braille (2x4 dots per cell)
const wave = ui.canvas(120, 24)
for (let x = 0; x < 120; x++) {
 wave.set(x, 12 + Math.round(Math.sin(x / 8) * 10), '#4ecdc4')
}
console.log(wave.render('braille'))
```



### registerRenderMode

Registers a canvas render mode from outside luca core, making `canvas.render(name)` work process-wide — including for canvases created by code that doesn't know the backend exists (e.g. `luca chat` output). This is the extension point for terminal-specific pixel backends: a project feature or plugin detects its terminal (Ghostty, Kitty, WezTerm) and registers a renderer that emits that terminal's protocol. The renderer receives the canvas and returns the string to print — read pixels with `canvas.get(x, y)` or grab the raw buffer with `canvas.toRGBA()` (RGBA bytes, the kitty graphics interchange format). Registering an existing name replaces it. Built-ins ('half', 'braille') cannot be replaced.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `name` | `string` | ✓ | The mode name callers pass to canvas.render() |
| `renderer` | `CanvasRenderer` | ✓ | Function receiving the canvas, returning the printable string |

**Returns:** `void`

```ts
const ui = container.feature('ui')
ui.registerRenderMode('dots', (canvas) => {
 let out = ''
 for (let y = 0; y < canvas.height; y++) {
   for (let x = 0; x < canvas.width; x++) out += canvas.get(x, y) ? '•' : ' '
   out += '\n'
 }
 return out.trimEnd()
})
const c = ui.canvas(4, 1)
c.set(1, 0, '#fff')
console.log(c.render('dots')) // ' •'
console.log(ui.renderModes)   // ['half', 'braille', 'dots']
```



### registerCapability

Declares a named terminal capability with a detector function, so feature code can branch on what the running terminal supports without knowing which plugin provides the knowledge. Detectors run lazily on the first `hasCapability` check and the result is cached for the process (terminals don't change mid-run). Registering the same name again replaces the detector and clears the cached result.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `name` | `string` | ✓ | Capability name, e.g. 'kittyGraphics', 'syncOutput' |
| `detect` | `() => boolean` | ✓ | Returns true when the running terminal supports it |

**Returns:** `void`

```ts
const ui = container.feature('ui')
ui.registerCapability('kittyGraphics', () => process.env.TERM_PROGRAM === 'ghostty')

const mode = ui.hasCapability('kittyGraphics') ? 'kitty' : 'half'
```



### hasCapability

Checks a declared terminal capability. Unknown names are simply false — callers can probe optimistically without coordinating with the plugin that may or may not have registered the capability.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `name` | `string` | ✓ | The capability name to check |

**Returns:** `boolean`



### registerFrameDecorator

Registers a decorator applied to every frame `ui.animate` writes. The decorator receives the full payload for one frame (cursor movement plus frame text) and returns the string actually written — the hook for terminal protocols that wrap output, like DEC 2026 synchronized updates (flicker-free repaints in Ghostty/Kitty/WezTerm). Decorators are keyed by name: registering the same name replaces it, and multiple named decorators apply in registration order.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `name` | `string` | ✓ | Unique decorator name (replaces any previous registration) |
| `decorate` | `(payload: string) => string` | ✓ | Receives the frame payload, returns what gets written |

**Returns:** `void`

```ts
const ui = container.feature('ui')
// Wrap every animation frame in a synchronized-update block
ui.registerFrameDecorator('syncOutput', (payload) =>
 `\x1b[?2026h${payload}\x1b[?2026l`)
```



### lerpColor

Linearly interpolate between two colors. Accepts hex strings, [r,g,b] tuples, or {r,g,b} objects; returns an {r,g,b} object usable with `ui.colors.rgb()` or `canvas.set()`.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `from` | `CanvasColor` | ✓ | Start color |
| `to` | `CanvasColor` | ✓ | End color |
| `t` | `number` | ✓ | Blend position, 0 (from) to 1 (to), clamped |

**Returns:** `{ r: number; g: number; b: number }`

```ts
const ui = container.feature('ui')
const mid = ui.lerpColor('#ff0000', '#0000ff', 0.5)
console.log(ui.colors.rgb(mid.r, mid.g, mid.b)('purple-ish'))
```



### animate

Runs a frame-rendering loop that redraws in place, for animated banners, gradient sweeps, and live canvas scenes. Each tick your callback returns the full frame as a string; the previous frame is overwritten in place with ANSI cursor movement (no flicker, no scrollback spam). The cursor is hidden while running and restored on stop. **Non-TTY behavior:** when stdout is not a TTY (pipes, CI), the first frame is rendered once and the animation resolves immediately — output stays clean and nothing busy-loops. Frames should keep a constant line count; when a frame has fewer lines than the previous one, each rewritten line is cleared but extra old lines below are not.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `renderFrame` | `(frame: number) => string` | ✓ | Called with the frame number; returns the frame text |
| `options` | `{ fps?: number; frames?: number }` |  | Animation options |

`{ fps?: number; frames?: number }` properties:

| Property | Type | Description |
|----------|------|-------------|
| `fps` | `any` | Frames per second (default 20) |
| `frames` | `any` | Total frames to render; omit to run until stop() is called |

**Returns:** `{ stop: () => void; done: Promise<void> }`

```ts
const ui = container.feature('ui')

// Animated gradient sweep across a banner (finite, awaitable)
const art = ui.asciiArt('LUCA', 'Big')
const { done } = ui.animate(
 (frame) => ui.applyGradient(art, ['cyan', 'blue', 'magenta'], 'horizontal', frame),
 { fps: 24, frames: 48 }
)
await done

// Open-ended canvas scene — stop it yourself
const anim = ui.animate((frame) => {
 const c = ui.canvas(60, 16)
 c.fillGradient('#16213e', '#0f3460')
 c.circle(10 + (frame % 40), 8, 5, '#e94560', { fill: true })
 return c.render('half')
})
setTimeout(() => anim.stop(), 100)
await anim.done
```



### endent

Dedent and format a tagged template literal using endent. Strips leading indentation while preserving relative indentation.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `args` | `any[]` | ✓ | Tagged template literal arguments |

**Returns:** `string`



### applyGradient

Applies color gradients to text with configurable direction. This method creates smooth color transitions across text content, supporting both horizontal (character-by-character) and vertical (line-by-line) gradients. Perfect for creating visually appealing terminal output and ASCII art effects. **Gradient Types:** - Horizontal: Colors transition across characters in each line - Vertical: Colors transition across lines of text - Customizable color sequences and transitions - Automatic color cycling for long content

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `text` | `string` | ✓ | The text content to apply gradients to |
| `lineColors` | `Color[]` |  | Array of colors to cycle through in the gradient |
| `direction` | `"horizontal" | "vertical"` |  | Gradient direction: 'horizontal' or 'vertical' |
| `offset` | `any` |  | Phase offset shifting where the color cycle starts — increment it per frame (e.g. inside `ui.animate`) for a sweeping animation |

**Returns:** `string`

```ts
// Horizontal rainbow effect
const rainbow = ui.applyGradient('Hello World!', 
 ['red', 'yellow', 'green', 'cyan', 'blue', 'magenta'], 
 'horizontal'
);

// Vertical gradient for multi-line text
const multiline = 'Line 1\nLine 2\nLine 3\nLine 4';
const vertical = ui.applyGradient(multiline, 
 ['red', 'white', 'blue'], 
 'vertical'
);

// Fire effect
const fire = ui.applyGradient('FIRE', ['red', 'yellow'], 'horizontal');

// Ocean effect
const ocean = ui.applyGradient('OCEAN', ['blue', 'cyan', 'white'], 'vertical');
```



### applyHorizontalGradient

Applies horizontal color gradients character by character. This method creates color transitions across characters within the text, cycling through the provided colors to create smooth horizontal gradients. Each character gets assigned a color based on its position in the sequence. **Horizontal Gradient Behavior:** - Each character is individually colored - Colors cycle through the provided array - Creates smooth transitions across text width - Works well with ASCII art and single lines

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `text` | `string` | ✓ | The text to apply horizontal gradients to |
| `lineColors` | `Color[]` |  | Array of colors to cycle through |
| `offset` | `any` |  | Phase offset shifting where the cycle starts (animate by incrementing per frame) |

**Returns:** `string`

```ts
// Rainbow effect across characters
const rainbow = ui.applyHorizontalGradient('RAINBOW', 
 ['red', 'yellow', 'green', 'cyan', 'blue', 'magenta']
);

// Simple two-color transition
const sunset = ui.applyHorizontalGradient('SUNSET', ['red', 'yellow']);

// Great for short text and ASCII art
const art = ui.asciiArt('COOL', 'Big');
const coloredArt = ui.applyHorizontalGradient(art, ['cyan', 'blue']);
```



### applyVerticalGradient

Applies vertical color gradients line by line. This method creates color transitions across lines of text, with each line getting a different color from the sequence. Perfect for multi-line content like ASCII art, banners, and structured output. **Vertical Gradient Behavior:** - Each line is colored uniformly - Colors cycle through the provided array - Creates smooth transitions across text height - Ideal for multi-line ASCII art and structured content

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `text` | `string` | ✓ | The text to apply vertical gradients to (supports newlines) |
| `lineColors` | `Color[]` |  | Array of colors to cycle through for each line |
| `offset` | `any` |  | Phase offset shifting where the cycle starts (animate by incrementing per frame) |

**Returns:** `string`

```ts
// Patriotic vertical gradient
const flag = 'USA\nUSA\nUSA\nUSA';
const patriotic = ui.applyVerticalGradient(flag, ['red', 'white', 'blue']);

// Sunset effect on ASCII art
const banner = ui.asciiArt('SUNSET', 'Big');
const sunset = ui.applyVerticalGradient(banner,
 ['yellow', 'red', 'magenta', 'blue']
);

// Ocean waves effect
const waves = 'Wave 1\nWave 2\nWave 3\nWave 4\nWave 5';
const ocean = ui.applyVerticalGradient(waves, ['cyan', 'blue']);
```



### padLeft

Pads text on the left to reach the specified length. This utility method adds padding characters to the left side of text to achieve a desired total length. Useful for creating aligned columns, formatted tables, and consistent text layout in terminal applications. **Padding Behavior:** - Adds padding to the left (start) of the string - Uses specified padding character (default: space) - Returns original string if already at or beyond target length - Handles multi-character padding by repeating the character

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `str` | `string` | ✓ | The string to pad |
| `length` | `number` | ✓ | The desired total length after padding |
| `padChar` | `any` |  | The character to use for padding (default: " ") |

**Returns:** `string`

```ts
// Number alignment
const numbers = ['1', '23', '456'];
numbers.forEach(num => {
 console.log(ui.padLeft(num, 5, '0')); // '00001', '00023', '00456'
});

// Text alignment in columns
const items = ['apple', 'banana', 'cherry'];
items.forEach(item => {
 console.log(ui.padLeft(item, 10) + ' | Price: $1.00');
});

// Custom padding character
const title = ui.padLeft('TITLE', 20, '-'); // '---------------TITLE'
```



### padRight

Pads text on the right to reach the specified length. This utility method adds padding characters to the right side of text to achieve a desired total length. Essential for creating properly aligned columns, tables, and formatted output in terminal applications. **Padding Behavior:** - Adds padding to the right (end) of the string - Uses specified padding character (default: space) - Returns original string if already at or beyond target length - Handles multi-character padding by repeating the character

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `str` | `string` | ✓ | The string to pad |
| `length` | `number` | ✓ | The desired total length after padding |
| `padChar` | `any` |  | The character to use for padding (default: " ") |

**Returns:** `string`

```ts
// Create aligned table columns
const data = [
 ['Name', 'Age', 'City'],
 ['John', '25', 'NYC'],
 ['Jane', '30', 'LA'],
 ['Bob', '35', 'Chicago']
];

data.forEach(row => {
 const formatted = row.map((cell, i) => {
   const widths = [15, 5, 10];
   return ui.padRight(cell, widths[i]);
 }).join(' | ');
 console.log(formatted);
});

// Progress bars
const progress = ui.padRight('████', 20, '░'); // '████░░░░░░░░░░░░░░░░'

// Menu items with dots
const menuItem = ui.padRight('Coffee', 20, '.') + '$3.50';
```



## Getters

| Property | Type | Description |
|----------|------|-------------|
| `colors` | `typeof colors` | Provides access to the full chalk colors API. Chalk provides extensive color and styling capabilities including: - Basic colors: red, green, blue, yellow, etc. - Background colors: bgRed, bgGreen, etc. - Styles: bold, italic, underline, strikethrough - Advanced: rgb, hex, hsl color support Colors and styles can be chained for complex formatting. NOTE: chalk auto-detects color support and DISABLES all ANSI codes when stdout is not a TTY — piped output, `$(...)` capture, CI, and sandboxed environments all produce plain uncolored text. This is expected behavior, not a bug. To verify that output actually contains ANSI codes (or to force color through a pipe), set `FORCE_COLOR=1` in the environment. |
| `colorPalette` | `string[]` | Gets the current color palette used for automatic color assignment. The color palette is a predefined set of hex colors that are automatically assigned to named entities in a cycling fashion. This ensures consistent color assignment across the application. |
| `randomColor` | `string | undefined` | Gets a random color name from the available chalk colors. This provides access to a randomly selected color from chalk's built-in color set. Useful for adding variety to terminal output or testing. |
| `fonts` | `string[]` | Gets an array of available fonts for ASCII art generation. This method provides access to all fonts available through figlet for creating ASCII art. The fonts are automatically discovered and cached on first access for performance. **Font Discovery:** - Fonts are loaded from figlet's built-in font collection - Results are cached in state to avoid repeated file system access - Returns comprehensive list of available font names |
| `renderModes` | `string[]` | Every canvas render mode currently available: the built-ins plus anything registered via registerRenderMode. |

## State (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | `boolean` | Whether this feature is currently enabled |

## Examples

**print**

```ts
const ui = container.feature('ui')
ui.print('plain text')
ui.print.cyan('cyan text')
ui.print.error('printed in red')
ui.print.success('printed in green')

// Composing strings: use ui.colors, not ui.print
ui.print(`Status: ${ui.colors.green('OK')}`)   // correct
ui.print(`Status: ${ui.print.green('OK')}`)    // wrong — prints "OK" on its own line, interpolates "undefined"
```



**markdown**

```ts
const ui = container.feature('ui')
const rendered = ui.markdown('## Features\n\n- **Bold** text\n- `inline code`\n- Regular paragraph text\n')
console.log(rendered)
```



**assignColor**

```ts
// Assign colors to users
const johnColor = ui.assignColor('john');
const janeColor = ui.assignColor('jane');

// Use consistently throughout the app
console.log(johnColor('John: Hello there!'));
console.log(janeColor('Jane: Hi John!'));
console.log(johnColor('John: How are you?')); // Same color as before

// Different entities get different colors
const errorColor = ui.assignColor('error');
const successColor = ui.assignColor('success');
```



**wizard**

```ts
// (no-run) interactive — waits for keyboard input

// Basic wizard
const answers = await ui.wizard([
 {
   type: 'input',
   name: 'projectName',
   message: 'What is your project name?',
   validate: (input) => input.length > 0 || 'Name is required'
 },
 {
   type: 'list',
   name: 'framework',
   message: 'Choose a framework:',
   choices: ['React', 'Vue', 'Angular', 'Svelte']
 },
 {
   type: 'confirm',
   name: 'typescript',
   message: 'Use TypeScript?',
   default: true
 }
]);

console.log(`Creating ${answers.projectName} with ${answers.framework}`);

// With initial answers
const moreAnswers = await ui.wizard([
 { type: 'input', name: 'version', message: 'Version?' }
], { version: '1.0.0' });
```



**openInEditor**

```ts
// (no-run) interactive — opens $EDITOR and waits for the user

// Edit code snippet
const code = `function hello() {\n  console.log('Hello');\n}`;
const editedCode = await ui.openInEditor(code, '.js');

// Edit configuration
const config = JSON.stringify({ port: 3000 }, null, 2);
const newConfig = await ui.openInEditor(config, '.json');

// Edit markdown content
const markdown = '# Title\n\nContent here...';
const editedMarkdown = await ui.openInEditor(markdown, '.md');
```



**asciiArt**

```ts
// Create a banner
const banner = ui.asciiArt('WELCOME', 'Big');
console.log(banner);

// Different fonts for different purposes
const title = ui.asciiArt('MyApp', 'Standard');
const subtitle = ui.asciiArt('v2.0', 'Small');

// Technical/coding themes
const code = ui.asciiArt('CODE', '3D-ASCII');

// List available fonts first
console.log('Available fonts:', ui.fonts.slice(0, 10).join(', '));
```



**banner**

```ts
// Classic patriotic banner
const banner = ui.banner('AMERICA', {
 font: 'Big',
 colors: ['red', 'white', 'blue']
});
console.log(banner);

// Tech company banner
const techBanner = ui.banner('TechCorp', {
 font: 'Slant',
 colors: ['cyan', 'blue', 'magenta']
});

// Warning banner
const warningBanner = ui.banner('WARNING', {
 font: 'Standard',
 colors: ['yellow', 'red']
});

// Available fonts: see ui.fonts property
// Available colors: any chalk color names
```



**canvas**

```ts
const ui = container.feature('ui')

// A gradient panel with a circle, at 2-pixels-per-cell resolution
const canvas = ui.canvas(60, 20)
canvas.fillGradient('#1a1a2e', '#e94560', 'diagonal')
canvas.circle(30, 10, 7, '#ffd166', { fill: true })
console.log(canvas.render('half'))

// A sine wave in braille (2x4 dots per cell)
const wave = ui.canvas(120, 24)
for (let x = 0; x < 120; x++) {
 wave.set(x, 12 + Math.round(Math.sin(x / 8) * 10), '#4ecdc4')
}
console.log(wave.render('braille'))
```



**registerRenderMode**

```ts
const ui = container.feature('ui')
ui.registerRenderMode('dots', (canvas) => {
 let out = ''
 for (let y = 0; y < canvas.height; y++) {
   for (let x = 0; x < canvas.width; x++) out += canvas.get(x, y) ? '•' : ' '
   out += '\n'
 }
 return out.trimEnd()
})
const c = ui.canvas(4, 1)
c.set(1, 0, '#fff')
console.log(c.render('dots')) // ' •'
console.log(ui.renderModes)   // ['half', 'braille', 'dots']
```



**registerCapability**

```ts
const ui = container.feature('ui')
ui.registerCapability('kittyGraphics', () => process.env.TERM_PROGRAM === 'ghostty')

const mode = ui.hasCapability('kittyGraphics') ? 'kitty' : 'half'
```



**registerFrameDecorator**

```ts
const ui = container.feature('ui')
// Wrap every animation frame in a synchronized-update block
ui.registerFrameDecorator('syncOutput', (payload) =>
 `\x1b[?2026h${payload}\x1b[?2026l`)
```



**lerpColor**

```ts
const ui = container.feature('ui')
const mid = ui.lerpColor('#ff0000', '#0000ff', 0.5)
console.log(ui.colors.rgb(mid.r, mid.g, mid.b)('purple-ish'))
```



**animate**

```ts
const ui = container.feature('ui')

// Animated gradient sweep across a banner (finite, awaitable)
const art = ui.asciiArt('LUCA', 'Big')
const { done } = ui.animate(
 (frame) => ui.applyGradient(art, ['cyan', 'blue', 'magenta'], 'horizontal', frame),
 { fps: 24, frames: 48 }
)
await done

// Open-ended canvas scene — stop it yourself
const anim = ui.animate((frame) => {
 const c = ui.canvas(60, 16)
 c.fillGradient('#16213e', '#0f3460')
 c.circle(10 + (frame % 40), 8, 5, '#e94560', { fill: true })
 return c.render('half')
})
setTimeout(() => anim.stop(), 100)
await anim.done
```



**applyGradient**

```ts
// Horizontal rainbow effect
const rainbow = ui.applyGradient('Hello World!', 
 ['red', 'yellow', 'green', 'cyan', 'blue', 'magenta'], 
 'horizontal'
);

// Vertical gradient for multi-line text
const multiline = 'Line 1\nLine 2\nLine 3\nLine 4';
const vertical = ui.applyGradient(multiline, 
 ['red', 'white', 'blue'], 
 'vertical'
);

// Fire effect
const fire = ui.applyGradient('FIRE', ['red', 'yellow'], 'horizontal');

// Ocean effect
const ocean = ui.applyGradient('OCEAN', ['blue', 'cyan', 'white'], 'vertical');
```



**applyHorizontalGradient**

```ts
// Rainbow effect across characters
const rainbow = ui.applyHorizontalGradient('RAINBOW', 
 ['red', 'yellow', 'green', 'cyan', 'blue', 'magenta']
);

// Simple two-color transition
const sunset = ui.applyHorizontalGradient('SUNSET', ['red', 'yellow']);

// Great for short text and ASCII art
const art = ui.asciiArt('COOL', 'Big');
const coloredArt = ui.applyHorizontalGradient(art, ['cyan', 'blue']);
```



**applyVerticalGradient**

```ts
// Patriotic vertical gradient
const flag = 'USA\nUSA\nUSA\nUSA';
const patriotic = ui.applyVerticalGradient(flag, ['red', 'white', 'blue']);

// Sunset effect on ASCII art
const banner = ui.asciiArt('SUNSET', 'Big');
const sunset = ui.applyVerticalGradient(banner,
 ['yellow', 'red', 'magenta', 'blue']
);

// Ocean waves effect
const waves = 'Wave 1\nWave 2\nWave 3\nWave 4\nWave 5';
const ocean = ui.applyVerticalGradient(waves, ['cyan', 'blue']);
```



**padLeft**

```ts
// Number alignment
const numbers = ['1', '23', '456'];
numbers.forEach(num => {
 console.log(ui.padLeft(num, 5, '0')); // '00001', '00023', '00456'
});

// Text alignment in columns
const items = ['apple', 'banana', 'cherry'];
items.forEach(item => {
 console.log(ui.padLeft(item, 10) + ' | Price: $1.00');
});

// Custom padding character
const title = ui.padLeft('TITLE', 20, '-'); // '---------------TITLE'
```



**padRight**

```ts
// Create aligned table columns
const data = [
 ['Name', 'Age', 'City'],
 ['John', '25', 'NYC'],
 ['Jane', '30', 'LA'],
 ['Bob', '35', 'Chicago']
];

data.forEach(row => {
 const formatted = row.map((cell, i) => {
   const widths = [15, 5, 10];
   return ui.padRight(cell, widths[i]);
 }).join(' | ');
 console.log(formatted);
});

// Progress bars
const progress = ui.padRight('████', 20, '░'); // '████░░░░░░░░░░░░░░░░'

// Menu items with dots
const menuItem = ui.padRight('Coffee', 20, '.') + '$3.50';
```



**colors**

```ts
// Basic colors
ui.colors.red('Error message')
ui.colors.green('Success!')

// Chained styling
ui.colors.blue.bold.underline('Important link')
ui.colors.white.bgRed.bold(' ALERT ')

// Hex and RGB colors
ui.colors.hex('#FF5733')('Custom color')
ui.colors.rgb(255, 87, 51)('RGB color')
```



**randomColor**

```ts
const randomColor = ui.randomColor;
console.log(ui.colors[randomColor]('This text is a random color!'));

// Use in loops for varied output
const items = ['alpha', 'beta', 'gamma'];
items.forEach(item => {
 const color = ui.randomColor;
 console.log(ui.colors[color](`- ${item}`));
});
```



**fonts**

```ts
// List all available fonts
const fonts = ui.fonts;
console.log(`Available fonts: ${fonts.join(', ')}`);

// Use random font for variety
const randomFont = fonts[Math.floor(Math.random() * fonts.length)];
const art = ui.asciiArt('Hello', randomFont);

// Common fonts: 'Big', 'Standard', 'Small', 'Slant', '3D-ASCII'
```

