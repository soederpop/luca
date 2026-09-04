import { describe, it, expect } from "bun:test";
import { TerminalCanvas, toRGB, lerpColor } from "../src/node/features/terminal-canvas.js";

// chalk strips ANSI under the test runner (no TTY), so renders come back as
// bare characters — which is exactly what we want to assert on.
const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");

describe("toRGB", () => {
  it("parses hex strings, tuples, and objects", () => {
    expect(toRGB("#ff8000")).toEqual({ r: 255, g: 128, b: 0 });
    expect(toRGB("ff8000")).toEqual({ r: 255, g: 128, b: 0 });
    expect(toRGB("#f80")).toEqual({ r: 255, g: 136, b: 0 });
    expect(toRGB([1, 2, 3])).toEqual({ r: 1, g: 2, b: 3 });
    expect(toRGB({ r: 4, g: 5, b: 6 })).toEqual({ r: 4, g: 5, b: 6 });
  });
});

describe("lerpColor", () => {
  it("interpolates and clamps t", () => {
    expect(lerpColor("#000000", "#ffffff", 0.5)).toEqual({ r: 128, g: 128, b: 128 });
    expect(lerpColor("#000000", "#ffffff", -1)).toEqual({ r: 0, g: 0, b: 0 });
    expect(lerpColor("#000000", "#ffffff", 2)).toEqual({ r: 255, g: 255, b: 255 });
  });
});

describe("TerminalCanvas half-block rendering", () => {
  it("renders 2 pixels per cell with the right block characters", () => {
    const c = new TerminalCanvas(3, 2);
    c.set(0, 0, "#ff0000"); // top only → ▀
    c.set(1, 1, "#00ff00"); // bottom only → ▄
    c.set(2, 0, "#0000ff"); // both → ▀
    c.set(2, 1, "#0000ff");
    expect(stripAnsi(c.render("half"))).toBe("▀▄▀");
  });

  it("renders unset pixels as spaces and one row per 2 pixels", () => {
    const c = new TerminalCanvas(2, 4);
    const out = stripAnsi(c.render("half"));
    expect(out).toBe("  \n  ");
  });

  it("ignores out-of-bounds set calls", () => {
    const c = new TerminalCanvas(2, 2);
    c.set(-1, 0, "#fff").set(5, 5, "#fff");
    expect(stripAnsi(c.render("half"))).toBe("  ");
  });
});

describe("TerminalCanvas braille rendering", () => {
  it("packs a full 2x4 cell into ⣿", () => {
    const c = new TerminalCanvas(2, 4);
    c.rect(0, 0, 2, 4, "#ffffff", { fill: true });
    expect(stripAnsi(c.render("braille"))).toBe("⣿");
  });

  it("maps a single top-left pixel to dot 1 (⠁)", () => {
    const c = new TerminalCanvas(2, 4);
    c.set(0, 0, "#ffffff");
    expect(stripAnsi(c.render("braille"))).toBe("⠁");
  });

  it("maps the bottom row to dots 7 and 8 (⣀)", () => {
    const c = new TerminalCanvas(2, 4);
    c.set(0, 3, "#ffffff");
    c.set(1, 3, "#ffffff");
    expect(stripAnsi(c.render("braille"))).toBe("⣀");
  });
});

describe("TerminalCanvas drawing primitives", () => {
  it("line draws endpoints and stays connected", () => {
    const c = new TerminalCanvas(5, 5);
    c.line(0, 0, 4, 4, "#fff");
    expect(c.get(0, 0)).not.toBeNull();
    expect(c.get(2, 2)).not.toBeNull();
    expect(c.get(4, 4)).not.toBeNull();
  });

  it("rect outline leaves the interior empty; fill paints it", () => {
    const c = new TerminalCanvas(5, 5);
    c.rect(0, 0, 5, 5, "#fff");
    expect(c.get(0, 0)).not.toBeNull();
    expect(c.get(2, 2)).toBeNull();
    c.rect(0, 0, 5, 5, "#fff", { fill: true });
    expect(c.get(2, 2)).not.toBeNull();
  });

  it("fillGradient blends between the two colors", () => {
    const c = new TerminalCanvas(3, 1);
    c.fillGradient("#000000", "#ffffff", "horizontal");
    expect(c.get(0, 0)).toEqual({ r: 0, g: 0, b: 0 });
    expect(c.get(1, 0)).toEqual({ r: 128, g: 128, b: 128 });
    expect(c.get(2, 0)).toEqual({ r: 255, g: 255, b: 255 });
  });
});
