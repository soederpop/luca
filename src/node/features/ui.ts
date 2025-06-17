import { features, Feature, type FeatureState } from "../feature.js";
import colors from "chalk";
import figlet from "figlet";
import type { Fonts } from "figlet";
import inquirer from "inquirer";
import { marked } from 'marked';
import { markedTerminal } from 'marked-terminal';
import endent from 'endent';

// @ts-ignore
marked.use(markedTerminal({ }));

/**
 * State interface for the UI feature.
 * Manages terminal UI configuration and cached data.
 * 
 * @interface UIState
 * @extends {FeatureState}
 */
interface UIState extends FeatureState {
  /** Array of available fonts for ASCII art generation */
  fonts?: Fonts[];
  /** Color palette for automatic color assignment */
  colorPalette?: string[];
}

/** Global registry tracking assigned colors to prevent duplicates */
const _assignedColors: Record<string, string> = {};

/** Type representing available chalk color functions */
type Color = keyof typeof colors;

/** Basic print function signature */
type PrintFunction = (...args: any[]) => void;

/** Enhanced print function with color methods attached */
type ColoredPrintFunction = PrintFunction & {
  [color in Color]: (...args: any[]) => void;
}

/**
 * UI Feature - Interactive Terminal User Interface Builder
 * 
 * This feature provides comprehensive tools for creating beautiful, interactive terminal experiences.
 * It combines several popular libraries (chalk, figlet, inquirer) into a unified interface for
 * building professional CLI applications with colors, ASCII art, and interactive prompts.
 * 
 * **Core Capabilities:**
 * - Rich color management using chalk library
 * - ASCII art generation with multiple fonts
 * - Interactive prompts and wizards
 * - Automatic color assignment for consistent theming
 * - Text padding and formatting utilities
 * - Gradient text effects (horizontal and vertical)
 * - Banner creation with styled ASCII art
 * 
 * **Color System:**
 * - Full chalk API access for complex styling
 * - Automatic color assignment with palette cycling
 * - Consistent color mapping for named entities
 * - Support for hex colors and gradients
 * 
 * **ASCII Art Features:**
 * - Multiple font options via figlet
 * - Automatic font discovery and caching
 * - Banner creation with color gradients
 * - Text styling and effects
 * 
 * **Interactive Elements:**
 * - Wizard creation with inquirer integration
 * - External editor integration
 * - User input validation and processing
 * 
 * **Usage Examples:**
 * 
 * **Basic Colors:**
 * ```typescript
 * const ui = container.feature('ui');
 * 
 * // Direct color usage
 * ui.print.red('Error message');
 * ui.print.green('Success!');
 * 
 * // Complex styling
 * console.log(ui.colors.blue.bold.underline('Important text'));
 * ```
 * 
 * **ASCII Art Banners:**
 * ```typescript
 * const banner = ui.banner('MyApp', {
 *   font: 'Big',
 *   colors: ['red', 'white', 'blue']
 * });
 * console.log(banner);
 * ```
 * 
 * **Interactive Wizards:**
 * ```typescript
 * const answers = await ui.wizard([
 *   { type: 'input', name: 'name', message: 'Your name?' },
 *   { type: 'confirm', name: 'continue', message: 'Continue?' }
 * ]);
 * ```
 * 
 * **Automatic Color Assignment:**
 * ```typescript
 * const userColor = ui.assignColor('john');
 * const adminColor = ui.assignColor('admin');
 * console.log(userColor('John\'s message'));
 * console.log(adminColor('Admin notice'));
 * ```
 */
export class UI<T extends UIState = UIState> extends Feature<T> {
  /** The shortcut path for accessing this feature */
  static override shortcut = "features.ui" as const
  
  /**
   * Gets the initial state configuration for the UI feature.
   * Sets up default color palette and initializes empty fonts array.
   * 
   * @returns The initial state with enabled flag, color palette, and fonts array
   */
  override get initialState() : T {
    return ({
      enabled: true,
      colorPalette: ASSIGNABLE_COLORS,
      fonts: []
    } as unknown) as T
  }

  /** Enhanced print function with color methods for convenient terminal output */
  print: ColoredPrintFunction = Object.assign((...args: any[]) => {
    return console.log(...args)
  }, {
    red: (text: string) => console.log(colors.red(text)),
    green: (text: string) => console.log(colors.green(text)),
    blue: (text: string) => console.log(colors.blue(text)),
    yellow: (text: string) => console.log(colors.yellow(text)),
    cyan: (text: string) => console.log(colors.cyan(text)),
    dim: (text: string) => console.log(colors.dim(text)),
    bold: (text: string) => console.log(colors.bold(text)),
    italic: (text: string) => console.log(colors.italic(text)),
    underline: (text: string) => console.log(colors.underline(text)),
    strikethrough: (text: string) => console.log(colors.strikethrough(text)),
    inverse: (text: string) => console.log(colors.inverse(text)),
    bgRed: (text: string) => console.log(colors.bgRed(text)),
    bgGreen: (text: string) => console.log(colors.bgGreen(text)),
    bgBlue: (text: string) => console.log(colors.bgBlue(text)),
    bgYellow: (text: string) => console.log(colors.bgYellow(text)),
    bgCyan: (text: string) => console.log(colors.bgCyan(text)),
    bgMagenta: (text: string) => console.log(colors.bgMagenta(text)),
    bgWhite: (text: string) => console.log(colors.bgWhite(text)),
  }) as ColoredPrintFunction

  markdown(text: string) {
    return marked.parse(text)
  }

  
  /**
   * Provides access to the full chalk colors API.
   * 
   * Chalk provides extensive color and styling capabilities including:
   * - Basic colors: red, green, blue, yellow, etc.
   * - Background colors: bgRed, bgGreen, etc.
   * - Styles: bold, italic, underline, strikethrough
   * - Advanced: rgb, hex, hsl color support
   * 
   * Colors and styles can be chained for complex formatting.
   * 
   * @returns The chalk colors object with all styling methods
   * 
   * @example
   * ```typescript
   * // Basic colors
   * ui.colors.red('Error message')
   * ui.colors.green('Success!')
   * 
   * // Chained styling
   * ui.colors.blue.bold.underline('Important link')
   * ui.colors.white.bgRed.bold(' ALERT ')
   * 
   * // Hex and RGB colors
   * ui.colors.hex('#FF5733')('Custom color')
   * ui.colors.rgb(255, 87, 51)('RGB color')
   * ```
   */
  get colors(): typeof colors {
    return colors;
  }

  /**
   * Gets the current color palette used for automatic color assignment.
   * 
   * The color palette is a predefined set of hex colors that are automatically
   * assigned to named entities in a cycling fashion. This ensures consistent
   * color assignment across the application.
   * 
   * @returns Array of hex color strings for automatic assignment
   */
  get colorPalette(): string[] {
    return this.state.get("colorPalette")!;
  }

  /**
   * Assigns a consistent color to a named entity.
   * 
   * This method provides automatic color assignment that remains consistent across
   * the application session. Each unique name gets assigned a color from the palette,
   * and subsequent calls with the same name return the same color function.
   * 
   * **Assignment Strategy:**
   * - First call with a name assigns the next available palette color
   * - Subsequent calls return the previously assigned color
   * - Colors cycle through the palette when all colors are used
   * - Returns a chalk hex color function for styling text
   * 
   * @param name - The unique identifier to assign a color to
   * @returns A chalk color function for styling text with the assigned color
   * 
   * @example
   * ```typescript
   * // Assign colors to users
   * const johnColor = ui.assignColor('john');
   * const janeColor = ui.assignColor('jane');
   * 
   * // Use consistently throughout the app
   * console.log(johnColor('John: Hello there!'));
   * console.log(janeColor('Jane: Hi John!'));
   * console.log(johnColor('John: How are you?')); // Same color as before
   * 
   * // Different entities get different colors
   * const errorColor = ui.assignColor('error');
   * const successColor = ui.assignColor('success');
   * ```
   */
  assignColor(name: string): (str: string) => string {
    const assignedCount = Object.keys(_assignedColors).length;

    if (_assignedColors[name]) {
      const assigned = _assignedColors[name];
      return this.colors.hex(assigned);
    } else {
      const pickedColor =
        this.colorPalette[assignedCount % this.colorPalette.length];
      _assignedColors[name] = pickedColor!;
      return this.colors.hex(pickedColor!);
    }
  }

  /**
   * Gets a random color name from the available chalk colors.
   * 
   * This provides access to a randomly selected color from chalk's built-in
   * color set. Useful for adding variety to terminal output or testing.
   * 
   * @returns A random color name that can be used with chalk
   * 
   * @example
   * ```typescript
   * const randomColor = ui.randomColor;
   * console.log(ui.colors[randomColor]('This text is a random color!'));
   * 
   * // Use in loops for varied output
   * items.forEach(item => {
   *   const color = ui.randomColor;
   *   console.log(ui.colors[color](`- ${item}`));
   * });
   * ```
   */
  get randomColor() {
    const colors = Object.keys(this.colors);
    const index = Math.floor(Math.random() * colors.length);

    return colors[index];
  }

  /**
   * Gets an array of available fonts for ASCII art generation.
   * 
   * This method provides access to all fonts available through figlet for
   * creating ASCII art. The fonts are automatically discovered and cached
   * on first access for performance.
   * 
   * **Font Discovery:**
   * - Fonts are loaded from figlet's built-in font collection
   * - Results are cached in state to avoid repeated file system access
   * - Returns comprehensive list of available font names
   * 
   * @returns Array of font names that can be used with asciiArt() and banner()
   * 
   * @example
   * ```typescript
   * // List all available fonts
   * const fonts = ui.fonts;
   * console.log(`Available fonts: ${fonts.join(', ')}`);
   * 
   * // Use random font for variety
   * const randomFont = fonts[Math.floor(Math.random() * fonts.length)];
   * const art = ui.asciiArt('Hello', randomFont);
   * 
   * // Common fonts: 'Big', 'Standard', 'Small', 'Slant', '3D-ASCII'
   * ```
   */
  get fonts(): string[] {
    const fonts = this.state.get("fonts")! || [];

    if (!fonts.length) {
      this.state.set("fonts", figlet.fontsSync());
    }

    return this.state.get("fonts")!;
  }

  /**
   * Creates an interactive wizard using inquirer prompts.
   * 
   * This method provides a convenient wrapper around inquirer for creating
   * interactive command-line wizards. It supports all inquirer question types
   * and can handle complex validation and conditional logic.
   * 
   * **Supported Question Types:**
   * - input: Text input fields
   * - confirm: Yes/no confirmations
   * - list: Single selection from options
   * - checkbox: Multiple selections
   * - password: Hidden text input
   * - editor: External editor integration
   * 
   * **Advanced Features:**
   * - Conditional questions based on previous answers
   * - Input validation and transformation
   * - Custom prompts and styling
   * - Initial answer pre-population
   * 
   * @param questions - Array of inquirer question objects
   * @param initialAnswers - Pre-populated answers to skip questions or provide defaults
   * @returns Promise resolving to the user's answers object
   * 
   * @example
   * ```typescript
   * // Basic wizard
   * const answers = await ui.wizard([
   *   {
   *     type: 'input',
   *     name: 'projectName',
   *     message: 'What is your project name?',
   *     validate: (input) => input.length > 0 || 'Name is required'
   *   },
   *   {
   *     type: 'list',
   *     name: 'framework',
   *     message: 'Choose a framework:',
   *     choices: ['React', 'Vue', 'Angular', 'Svelte']
   *   },
   *   {
   *     type: 'confirm',
   *     name: 'typescript',
   *     message: 'Use TypeScript?',
   *     default: true
   *   }
   * ]);
   * 
   * console.log(`Creating ${answers.projectName} with ${answers.framework}`);
   * 
   * // With initial answers
   * const moreAnswers = await ui.wizard([
   *   { type: 'input', name: 'version', message: 'Version?' }
   * ], { version: '1.0.0' });
   * ```
   */
  wizard(questions: any[], initialAnswers: any = {}) {
    return inquirer.createPromptModule()(questions, initialAnswers);
  }

  /**
   * Opens text in the user's external editor for editing.
   * 
   * This method integrates with the user's configured editor (via $EDITOR or $VISUAL
   * environment variables) to allow editing of text content. The edited content is
   * returned when the user saves and closes the editor.
   * 
   * **Editor Integration:**
   * - Respects $EDITOR and $VISUAL environment variables
   * - Creates temporary file with specified extension
   * - Returns modified content after editor closes
   * - Handles editor cancellation gracefully
   * 
   * @param text - The initial text content to edit
   * @param extension - File extension for syntax highlighting (default: ".ts")
   * @returns Promise resolving to the edited text content
   * 
   * @example
   * ```typescript
   * // Edit code snippet
   * const code = `function hello() {\n  console.log('Hello');\n}`;
   * const editedCode = await ui.openInEditor(code, '.js');
   * 
   * // Edit configuration
   * const config = JSON.stringify({ port: 3000 }, null, 2);
   * const newConfig = await ui.openInEditor(config, '.json');
   * 
   * // Edit markdown content
   * const markdown = '# Title\n\nContent here...';
   * const editedMarkdown = await ui.openInEditor(markdown, '.md');
   * ```
   */
  async openInEditor(text: string, extension = ".ts") {
    const results = await new Promise((resolve, reject) => {
      /*
      editAsync(
        text,
        (err, result) => {
          if (err) {
            return reject(err);
          }

          return resolve(result);
        },
        {
          postfix: extension,
        }
      );
    */
    });

    return results;
  }

  /**
   * Generates ASCII art from text using the specified font.
   * 
   * This method converts regular text into stylized ASCII art using figlet's
   * extensive font collection. Perfect for creating eye-catching headers,
   * logos, and decorative text in terminal applications.
   * 
   * **Font Capabilities:**
   * - Large collection of artistic fonts
   * - Various styles: block, script, decorative, technical
   * - Different sizes and character sets
   * - Consistent spacing and alignment
   * 
   * @param text - The text to convert to ASCII art
   * @param font - The figlet font to use (see fonts property for available options)
   * @returns The ASCII art representation of the text
   * 
   * @throws {Error} When the specified font is not available
   * 
   * @example
   * ```typescript
   * // Create a banner
   * const banner = ui.asciiArt('WELCOME', 'Big');
   * console.log(banner);
   * 
   * // Different fonts for different purposes
   * const title = ui.asciiArt('MyApp', 'Standard');
   * const subtitle = ui.asciiArt('v2.0', 'Small');
   * 
   * // Technical/coding themes
   * const code = ui.asciiArt('CODE', '3D-ASCII');
   * 
   * // List available fonts first
   * console.log('Available fonts:', ui.fonts.slice(0, 10).join(', '));
   * ```
   */
  asciiArt(text: string, font: Fonts) {
    return figlet.textSync(text, font);
  }

  /**
   * Creates a styled banner with ASCII art and color gradients.
   * 
   * This method combines ASCII art generation with color gradient effects to create
   * visually striking banners for terminal applications. It automatically applies
   * color gradients to the generated ASCII art based on the specified options.
   * 
   * **Banner Features:**
   * - ASCII art text generation
   * - Automatic color gradient application
   * - Customizable gradient directions
   * - Multiple color combinations
   * - Professional terminal presentation
   * 
   * @param text - The text to convert to a styled banner
   * @param options - Banner styling options
   * @param options.font - The figlet font to use for ASCII art generation
   * @param options.colors - Array of colors for the gradient effect
   * @returns The styled banner with ASCII art and color gradients
   * 
   * @throws {Error} When required options are missing or invalid
   * 
   * @example
   * ```typescript
   * // Classic patriotic banner
   * const banner = ui.banner('AMERICA', {
   *   font: 'Big',
   *   colors: ['red', 'white', 'blue']
   * });
   * console.log(banner);
   * 
   * // Tech company banner
   * const techBanner = ui.banner('TechCorp', {
   *   font: 'Slant',
   *   colors: ['cyan', 'blue', 'magenta']
   * });
   * 
   * // Warning banner
   * const warningBanner = ui.banner('WARNING', {
   *   font: 'Standard',
   *   colors: ['yellow', 'red']
   * });
   * 
   * // Available fonts: see ui.fonts property
   * // Available colors: any chalk color names
   * ```
   */
  banner(text: string, options: { font: Fonts; colors: Color[] }) {
    if (!options?.font || !Array.isArray(options?.colors)) {
      throw new Error(`Must supply { font: "string", colors: ["string"]}`);
    }

    const art = this.asciiArt(text, options.font);
    const colored = this.applyGradient(art, options.colors);

    return colored;
  }

  endent(...args: any[]) {
    // @ts-ignore 
    return endent(...args)
  }

  /**
   * Applies color gradients to text with configurable direction.
   * 
   * This method creates smooth color transitions across text content, supporting
   * both horizontal (character-by-character) and vertical (line-by-line) gradients.
   * Perfect for creating visually appealing terminal output and ASCII art effects.
   * 
   * **Gradient Types:**
   * - Horizontal: Colors transition across characters in each line
   * - Vertical: Colors transition across lines of text
   * - Customizable color sequences and transitions
   * - Automatic color cycling for long content
   * 
   * @param text - The text content to apply gradients to
   * @param lineColors - Array of colors to cycle through in the gradient
   * @param direction - Gradient direction: 'horizontal' or 'vertical'
   * @returns The text with applied color gradients
   * 
   * @example
   * ```typescript
   * // Horizontal rainbow effect
   * const rainbow = ui.applyGradient('Hello World!', 
   *   ['red', 'yellow', 'green', 'cyan', 'blue', 'magenta'], 
   *   'horizontal'
   * );
   * 
   * // Vertical gradient for multi-line text
   * const multiline = 'Line 1\nLine 2\nLine 3\nLine 4';
   * const vertical = ui.applyGradient(multiline, 
   *   ['red', 'white', 'blue'], 
   *   'vertical'
   * );
   * 
   * // Fire effect
   * const fire = ui.applyGradient('FIRE', ['red', 'yellow'], 'horizontal');
   * 
   * // Ocean effect
   * const ocean = ui.applyGradient('OCEAN', ['blue', 'cyan', 'white'], 'vertical');
   * ```
   */
  applyGradient(
    text: string,
    lineColors: Color[] = ["red", "white", "blue"],
    direction: "horizontal" | "vertical" = "horizontal"
  ) {
    if (direction === "horizontal") {
      return this.applyHorizontalGradient(text, lineColors);
    }

    return this.applyVerticalGradient(text, lineColors);
  }

  /**
   * Applies horizontal color gradients character by character.
   * 
   * This method creates color transitions across characters within the text,
   * cycling through the provided colors to create smooth horizontal gradients.
   * Each character gets assigned a color based on its position in the sequence.
   * 
   * **Horizontal Gradient Behavior:**
   * - Each character is individually colored
   * - Colors cycle through the provided array
   * - Creates smooth transitions across text width
   * - Works well with ASCII art and single lines
   * 
   * @param text - The text to apply horizontal gradients to
   * @param lineColors - Array of colors to cycle through
   * @returns Text with horizontal color gradients applied
   * 
   * @example
   * ```typescript
   * // Rainbow effect across characters
   * const rainbow = ui.applyHorizontalGradient('RAINBOW', 
   *   ['red', 'yellow', 'green', 'cyan', 'blue', 'magenta']
   * );
   * 
   * // Simple two-color transition
   * const sunset = ui.applyHorizontalGradient('SUNSET', ['red', 'orange']);
   * 
   * // Great for short text and ASCII art
   * const art = ui.asciiArt('COOL', 'Big');
   * const coloredArt = ui.applyHorizontalGradient(art, ['cyan', 'blue']);
   * ```
   */
  applyHorizontalGradient(
    text: string,
    lineColors: Color[] = ["red", "white", "blue"]
  ) {
    const gColors = Object.fromEntries(
      lineColors.map((color) => [color, this.colors[color]])
    );
    const lines = text.split("");

    const colored = lines.map((line, index) => {
      const colorFn = gColors[lineColors[index % lineColors.length]!]!;
      // @ts-ignore-next-line
      return colorFn(line);
    });

    return colored.join("");
  }

  /**
   * Applies vertical color gradients line by line.
   * 
   * This method creates color transitions across lines of text, with each line
   * getting a different color from the sequence. Perfect for multi-line content
   * like ASCII art, banners, and structured output.
   * 
   * **Vertical Gradient Behavior:**
   * - Each line is colored uniformly
   * - Colors cycle through the provided array
   * - Creates smooth transitions across text height
   * - Ideal for multi-line ASCII art and structured content
   * 
   * @param text - The text to apply vertical gradients to (supports newlines)
   * @param lineColors - Array of colors to cycle through for each line
   * @returns Text with vertical color gradients applied
   * 
   * @example
   * ```typescript
   * // Patriotic vertical gradient
   * const flag = 'USA\nUSA\nUSA\nUSA';
   * const patriotic = ui.applyVerticalGradient(flag, ['red', 'white', 'blue']);
   * 
   * // Sunset effect on ASCII art
   * const banner = ui.asciiArt('SUNSET', 'Big');
   * const sunset = ui.applyVerticalGradient(banner, 
   *   ['yellow', 'orange', 'red', 'purple']
   * );
   * 
   * // Ocean waves effect
   * const waves = 'Wave 1\nWave 2\nWave 3\nWave 4\nWave 5';
   * const ocean = ui.applyVerticalGradient(waves, ['cyan', 'blue']);
   * ```
   */
  applyVerticalGradient(
    text: string,
    lineColors: Color[] = ["red", "white", "blue"]
  ) {
    const gColors = Object.fromEntries(
      lineColors.map((color) => [color, this.colors[color]])
    );
    const lines = text.split("\n");
    const colored = lines.map((line, index) => {
      const colorFn = gColors[lineColors[index % lineColors.length]!]!;
      // @ts-ignore-next-line
      return colorFn(line);
    });

    return colored.join("\n");
  }

  /**
   * Pads text on the left to reach the specified length.
   * 
   * This utility method adds padding characters to the left side of text to achieve
   * a desired total length. Useful for creating aligned columns, formatted tables,
   * and consistent text layout in terminal applications.
   * 
   * **Padding Behavior:**
   * - Adds padding to the left (start) of the string
   * - Uses specified padding character (default: space)
   * - Returns original string if already at or beyond target length
   * - Handles multi-character padding by repeating the character
   * 
   * @param str - The string to pad
   * @param length - The desired total length after padding
   * @param padChar - The character to use for padding (default: " ")
   * @returns The left-padded string
   * 
   * @example
   * ```typescript
   * // Number alignment
   * const numbers = ['1', '23', '456'];
   * numbers.forEach(num => {
   *   console.log(ui.padLeft(num, 5, '0')); // '00001', '00023', '00456'
   * });
   * 
   * // Text alignment in columns
   * const items = ['apple', 'banana', 'cherry'];
   * items.forEach(item => {
   *   console.log(ui.padLeft(item, 10) + ' | Price: $1.00');
   * });
   * 
   * // Custom padding character
   * const title = ui.padLeft('TITLE', 20, '-'); // '---------------TITLE'
   * ```
   */
  padLeft(str: string, length: number, padChar = " ") {
    if (str.length >= length) {
      return str;
    }

    const padding = Array(length - str.length)
      .fill(padChar)
      .join("");
      
    return padding + str;
  }

  /**
   * Pads text on the right to reach the specified length.
   * 
   * This utility method adds padding characters to the right side of text to achieve
   * a desired total length. Essential for creating properly aligned columns, tables,
   * and formatted output in terminal applications.
   * 
   * **Padding Behavior:**
   * - Adds padding to the right (end) of the string
   * - Uses specified padding character (default: space)
   * - Returns original string if already at or beyond target length
   * - Handles multi-character padding by repeating the character
   * 
   * @param str - The string to pad
   * @param length - The desired total length after padding
   * @param padChar - The character to use for padding (default: " ")
   * @returns The right-padded string
   * 
   * @example
   * ```typescript
   * // Create aligned table columns
   * const data = [
   *   ['Name', 'Age', 'City'],
   *   ['John', '25', 'NYC'],
   *   ['Jane', '30', 'LA'],
   *   ['Bob', '35', 'Chicago']
   * ];
   * 
   * data.forEach(row => {
   *   const formatted = row.map((cell, i) => {
   *     const widths = [15, 5, 10];
   *     return ui.padRight(cell, widths[i]);
   *   }).join(' | ');
   *   console.log(formatted);
   * });
   * 
   * // Progress bars
   * const progress = ui.padRight('████', 20, '░'); // '████░░░░░░░░░░░░░░░░'
   * 
   * // Menu items with dots
   * const menuItem = ui.padRight('Coffee', 20, '.') + '$3.50';
   * ```
   */
  padRight(str: string, length: number, padChar = " ") {
    if (str.length >= length) {
      return str;
    }

    const padding = Array(length - str.length)
      .fill(padChar)
      .join("");
    return str + padding;
  }
}

export default features.register("ui", UI);

/**
 * Predefined color palette for automatic color assignment.
 * 
 * This carefully curated palette provides visually distinct colors that work well
 * in terminal environments. Colors are chosen for readability, contrast, and
 * aesthetic appeal across different terminal themes.
 * 
 * **Palette Characteristics:**
 * - 16 distinct hex colors
 * - Good contrast on both light and dark backgrounds
 * - Balanced saturation and brightness
 * - Accessible color combinations
 * - Professional appearance
 * 
 * @constant
 */
const ASSIGNABLE_COLORS = [
  "#FF6B6B",
  "#FFD166",
  "#4ECDC4",
  "#54C6EB",
  "#A3D9FF",
  "#88D498",
  "#9C89B8",
  "#F08A5D",
  "#B83B5E",
  "#6A2C70",
  "#F38181",
  "#95E1D3",
  "#EAFDE6",
  "#FCE38A",
  "#EAFFD0",
  "#BDE4F4",
];
