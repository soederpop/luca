import colors from "chalk";

/**
 * An RGB color value used by the terminal canvas.
 */
export interface CanvasRGB {
  r: number;
  g: number;
  b: number;
}

/** Any value the canvas accepts as a color: hex string, [r,g,b] tuple, or {r,g,b} object. */
export type CanvasColor = string | [number, number, number] | CanvasRGB;

/** Rendering mode for TerminalCanvas.render(). */
export type CanvasRenderMode = "half" | "braille";

/**
 * Normalize any accepted color form into an RGB object.
 * Accepts "#rrggbb" (with or without #), [r,g,b], or {r,g,b}.
 */
export function toRGB(color: CanvasColor): CanvasRGB {
  if (Array.isArray(color)) {
    return { r: color[0], g: color[1], b: color[2] };
  }
  if (typeof color === "object") {
    return { r: color.r, g: color.g, b: color.b };
  }
  const hex = color.replace(/^#/, "");
  const value = parseInt(
    hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex,
    16
  );
  return { r: (value >> 16) & 0xff, g: (value >> 8) & 0xff, b: value & 0xff };
}

/**
 * Linearly interpolate between two colors. `t` is clamped to [0, 1].
 */
export function lerpColor(from: CanvasColor, to: CanvasColor, t: number): CanvasRGB {
  const a = toRGB(from);
  const b = toRGB(to);
  const clamped = Math.max(0, Math.min(1, t));
  return {
    r: Math.round(a.r + (b.r - a.r) * clamped),
    g: Math.round(a.g + (b.g - a.g) * clamped),
    b: Math.round(a.b + (b.b - a.b) * clamped),
  };
}

// Braille dot bit for a pixel at (dx, dy) inside a 2x4 cell. The Unicode
// braille block orders dots 1-2-3-7 down the left column and 4-5-6-8 down
// the right, which is why the bottom row bits (0x40, 0x80) break the pattern.
const BRAILLE_BITS = [
  [0x01, 0x08],
  [0x02, 0x10],
  [0x04, 0x20],
  [0x40, 0x80],
] as const;

/**
 * A truecolor pixel framebuffer that renders to terminal characters.
 *
 * Two render modes:
 * - `half` (default): each terminal cell shows 2 vertical pixels via `▀` with
 *   a 24-bit foreground (top pixel) and background (bottom pixel). Full RGB
 *   per pixel; resolution = width x height pixels in width x height/2 cells.
 * - `braille`: each cell packs 2x4 pixels into a braille character (`⠁`-`⣿`).
 *   4x the dot density of half blocks, but one color per cell (set pixels in
 *   a cell are averaged). Best for line art, plots, waveforms.
 *
 * Dimensions are in PIXELS, not cells. For clean output make height even
 * (half mode) or a multiple of 4 (braille mode); partial cells still render.
 *
 * Colors rely on chalk, which strips ANSI when stdout is not a TTY — piped
 * output renders as bare characters. Set FORCE_COLOR=1 to override.
 */
export class TerminalCanvas {
  readonly width: number;
  readonly height: number;
  private pixels: (CanvasRGB | null)[];

  constructor(width: number, height: number) {
    this.width = Math.max(1, Math.floor(width));
    this.height = Math.max(1, Math.floor(height));
    this.pixels = new Array(this.width * this.height).fill(null);
  }

  /** Set one pixel. Out-of-bounds coordinates are silently ignored so drawing code doesn't need clipping. */
  set(x: number, y: number, color: CanvasColor): this {
    const px = Math.round(x);
    const py = Math.round(y);
    if (px < 0 || py < 0 || px >= this.width || py >= this.height) return this;
    this.pixels[py * this.width + px] = toRGB(color);
    return this;
  }

  /** Read one pixel, or null if unset / out of bounds. */
  get(x: number, y: number): CanvasRGB | null {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return null;
    return this.pixels[y * this.width + x] ?? null;
  }

  /** Clear every pixel — to a color, or back to transparent (rendered as spaces). */
  clear(color?: CanvasColor): this {
    const value = color != null ? toRGB(color) : null;
    this.pixels.fill(value);
    return this;
  }

  /** Draw a line between two points (Bresenham). */
  line(x0: number, y0: number, x1: number, y1: number, color: CanvasColor): this {
    let cx = Math.round(x0);
    let cy = Math.round(y0);
    const ex = Math.round(x1);
    const ey = Math.round(y1);
    const dx = Math.abs(ex - cx);
    const dy = -Math.abs(ey - cy);
    const sx = cx < ex ? 1 : -1;
    const sy = cy < ey ? 1 : -1;
    let err = dx + dy;

    for (;;) {
      this.set(cx, cy, color);
      if (cx === ex && cy === ey) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; cx += sx; }
      if (e2 <= dx) { err += dx; cy += sy; }
    }
    return this;
  }

  /** Draw a rectangle. `fill: true` paints the interior, otherwise just the outline. */
  rect(x: number, y: number, w: number, h: number, color: CanvasColor, options: { fill?: boolean } = {}): this {
    if (options.fill) {
      for (let py = y; py < y + h; py++) {
        for (let px = x; px < x + w; px++) this.set(px, py, color);
      }
      return this;
    }
    this.line(x, y, x + w - 1, y, color);
    this.line(x, y + h - 1, x + w - 1, y + h - 1, color);
    this.line(x, y, x, y + h - 1, color);
    this.line(x + w - 1, y, x + w - 1, y + h - 1, color);
    return this;
  }

  /** Draw a circle (midpoint algorithm). `fill: true` paints the disk. */
  circle(cx: number, cy: number, radius: number, color: CanvasColor, options: { fill?: boolean } = {}): this {
    const r = Math.round(radius);
    for (let y = -r; y <= r; y++) {
      for (let x = -r; x <= r; x++) {
        const dist = Math.sqrt(x * x + y * y);
        const onRing = Math.abs(dist - r) < 0.5;
        if (options.fill ? dist <= r : onRing) this.set(cx + x, cy + y, color);
      }
    }
    return this;
  }

  /**
   * Fill the whole canvas with a smooth two-color gradient.
   * Direction 'horizontal' blends left→right, 'vertical' top→bottom,
   * 'diagonal' corner→corner.
   */
  fillGradient(
    from: CanvasColor,
    to: CanvasColor,
    direction: "horizontal" | "vertical" | "diagonal" = "horizontal"
  ): this {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const t =
          direction === "horizontal" ? x / Math.max(1, this.width - 1)
          : direction === "vertical" ? y / Math.max(1, this.height - 1)
          : (x + y) / Math.max(1, this.width + this.height - 2);
        this.set(x, y, lerpColor(from, to, t));
      }
    }
    return this;
  }

  /**
   * Render the framebuffer to a printable string.
   * `half` mode uses ▀/▄ with truecolor fg+bg (2 pixels per cell);
   * `braille` packs 2x4 pixels per cell with one averaged color.
   */
  render(mode: CanvasRenderMode = "half"): string {
    return mode === "braille" ? this.renderBraille() : this.renderHalfBlocks();
  }

  private renderHalfBlocks(): string {
    const rows: string[] = [];
    for (let y = 0; y < this.height; y += 2) {
      let row = "";
      for (let x = 0; x < this.width; x++) {
        const top = this.get(x, y);
        const bottom = this.get(x, y + 1);
        if (top && bottom) {
          row += colors.rgb(top.r, top.g, top.b).bgRgb(bottom.r, bottom.g, bottom.b)("▀");
        } else if (top) {
          row += colors.rgb(top.r, top.g, top.b)("▀");
        } else if (bottom) {
          row += colors.rgb(bottom.r, bottom.g, bottom.b)("▄");
        } else {
          row += " ";
        }
      }
      rows.push(row);
    }
    return rows.join("\n");
  }

  private renderBraille(): string {
    const rows: string[] = [];
    for (let y = 0; y < this.height; y += 4) {
      let row = "";
      for (let x = 0; x < this.width; x += 2) {
        let bits = 0;
        let rSum = 0, gSum = 0, bSum = 0, count = 0;
        for (let dy = 0; dy < 4; dy++) {
          for (let dx = 0; dx < 2; dx++) {
            const pixel = this.get(x + dx, y + dy);
            if (!pixel) continue;
            bits |= BRAILLE_BITS[dy]![dx]!;
            rSum += pixel.r; gSum += pixel.g; bSum += pixel.b;
            count++;
          }
        }
        if (bits === 0) {
          row += " ";
        } else {
          const char = String.fromCharCode(0x2800 + bits);
          row += colors.rgb(
            Math.round(rSum / count),
            Math.round(gSum / count),
            Math.round(bSum / count)
          )(char);
        }
      }
      rows.push(row);
    }
    return rows.join("\n");
  }
}

export default TerminalCanvas;
