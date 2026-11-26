// Draws the Luca Desktop app icon and writes packaging/AppIcon.icns and AppIcon.png.
// Run from apps/desktop: swift scripts/make-icon.swift
// The icon is a console prompt on a night sky: a chevron and a block cursor,
// lit, over a faint bench of tiles. Violet to teal.
import AppKit

func color(_ hex: UInt32, _ alpha: CGFloat = 1) -> CGColor {
    CGColor(
        srgbRed: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255,
        blue: CGFloat(hex & 0xFF) / 255, alpha: alpha)
}

let space = CGColorSpace(name: CGColorSpace.sRGB)!

func rounded(_ rect: CGRect, _ radius: CGFloat) -> CGPath {
    CGPath(roundedRect: rect, cornerWidth: radius, cornerHeight: radius, transform: nil)
}

/// A linear gradient inside `path`, from `from` to `to`.
func linear(_ ctx: CGContext, in path: CGPath, _ colors: [CGColor], from: CGPoint, to: CGPoint) {
    ctx.saveGState()
    ctx.addPath(path)
    ctx.clip()
    let g = CGGradient(colorsSpace: space, colors: colors as CFArray, locations: nil)!
    ctx.drawLinearGradient(g, start: from, end: to, options: [.drawsBeforeStartLocation, .drawsAfterEndLocation])
    ctx.restoreGState()
}

/// A soft round light inside `path`.
func glow(_ ctx: CGContext, in path: CGPath, at center: CGPoint, radius: CGFloat, _ hex: UInt32, _ alpha: CGFloat) {
    ctx.saveGState()
    ctx.addPath(path)
    ctx.clip()
    let g = CGGradient(colorsSpace: space, colors: [color(hex, alpha), color(hex, 0)] as CFArray, locations: [0, 1])!
    ctx.drawRadialGradient(g, startCenter: center, startRadius: 0, endCenter: center, endRadius: radius, options: [])
    ctx.restoreGState()
}

/// Draws on a 1024 point canvas, scaled to `pixels`.
func draw(pixels: Int) -> Data {
    let rep = NSBitmapImageRep(
        bitmapDataPlanes: nil, pixelsWide: pixels, pixelsHigh: pixels, bitsPerSample: 8, samplesPerPixel: 4,
        hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
    let ns = NSGraphicsContext(bitmapImageRep: rep)!
    let ctx = ns.cgContext
    ctx.scaleBy(x: CGFloat(pixels) / 1024, y: CGFloat(pixels) / 1024)

    // The macOS icon grid: an 824 point body centered on 1024, with a shadow.
    let body = CGRect(x: 100, y: 100, width: 824, height: 824)
    let bodyPath = rounded(body, 185)
    ctx.saveGState()
    ctx.setShadow(offset: CGSize(width: 0, height: -12), blur: 28, color: color(0x000000, 0.5))
    ctx.addPath(bodyPath)
    ctx.setFillColor(color(0x070818))
    ctx.fillPath()
    ctx.restoreGState()

    // Night: deep violet at the top left, near black teal at the bottom right, two lights.
    linear(ctx, in: bodyPath, [color(0x2A1A66), color(0x101236), color(0x04161C)],
           from: CGPoint(x: body.minX, y: body.maxY), to: CGPoint(x: body.maxX, y: body.minY))
    glow(ctx, in: bodyPath, at: CGPoint(x: body.minX + 170, y: body.maxY - 130), radius: 560, 0x9B5CFF, 0.55)
    glow(ctx, in: bodyPath, at: CGPoint(x: body.maxX - 120, y: body.minY + 110), radius: 600, 0x19E3C2, 0.42)
    glow(ctx, in: bodyPath, at: CGPoint(x: body.maxX - 60, y: body.maxY - 60), radius: 330, 0xFF4FA3, 0.30)

    // The bench: a faint grid of tiles behind the mark.
    ctx.saveGState()
    ctx.addPath(bodyPath)
    ctx.clip()
    let cell: CGFloat = 206
    for row in 0..<4 {
        for col in 0..<4 {
            let rect = CGRect(x: body.minX + CGFloat(col) * cell + 10, y: body.minY + CGFloat(row) * cell + 10, width: cell - 20, height: cell - 20)
            ctx.addPath(rounded(rect, 34))
            ctx.setStrokeColor(color(0xFFFFFF, (row + col) % 2 == 0 ? 0.055 : 0.03))
            ctx.setLineWidth(4)
            ctx.strokePath()
        }
    }
    ctx.restoreGState()

    // The prompt: a thick chevron, teal to cyan, with its own light.
    let chevron = CGMutablePath()
    chevron.move(to: CGPoint(x: 300, y: 705))
    chevron.addLine(to: CGPoint(x: 512, y: 512))
    chevron.addLine(to: CGPoint(x: 300, y: 319))
    let stroked = chevron.copy(strokingWithWidth: 104, lineCap: .round, lineJoin: .round, miterLimit: 10)
    ctx.saveGState()
    ctx.setShadow(offset: .zero, blur: 70, color: color(0x2CF5D2, 0.75))
    ctx.addPath(stroked)
    ctx.setFillColor(color(0x2CF5D2))
    ctx.fillPath()
    ctx.restoreGState()
    linear(ctx, in: stroked, [color(0xB8FFF1), color(0x2CF5D2), color(0x16A8E0)],
           from: CGPoint(x: 300, y: 760), to: CGPoint(x: 520, y: 270))

    // The cursor: a block, magenta to amber. It is what you type at.
    let cursor = CGRect(x: 572, y: 300, width: 176, height: 100)
    let cursorPath = rounded(cursor, 30)
    ctx.saveGState()
    ctx.setShadow(offset: .zero, blur: 64, color: color(0xFF5CA8, 0.8))
    ctx.addPath(cursorPath)
    ctx.setFillColor(color(0xFF5CA8))
    ctx.fillPath()
    ctx.restoreGState()
    linear(ctx, in: cursorPath, [color(0xFFB45C), color(0xFF5CA8), color(0xB45CFF)],
           from: CGPoint(x: cursor.minX, y: cursor.maxY), to: CGPoint(x: cursor.maxX, y: cursor.minY))

    // Three small lights, top right: features, clients, servers.
    for (index, hex) in [UInt32(0x7CF0D8), 0x8FB4FF, 0xFFC978].enumerated() {
        let dot = CGRect(x: 640 + CGFloat(index) * 66, y: 690, width: 40, height: 40)
        ctx.saveGState()
        ctx.setShadow(offset: .zero, blur: 22, color: color(hex, 0.8))
        ctx.addEllipse(in: dot)
        ctx.setFillColor(color(hex))
        ctx.fillPath()
        ctx.restoreGState()
    }

    // A glass edge: light on top, a thin rim all round.
    linear(ctx, in: bodyPath, [color(0xFFFFFF, 0.16), color(0xFFFFFF, 0)],
           from: CGPoint(x: body.midX, y: body.maxY), to: CGPoint(x: body.midX, y: body.maxY - 300))
    ctx.addPath(rounded(body.insetBy(dx: 3, dy: 3), 182))
    ctx.setStrokeColor(color(0xC8B6FF, 0.35))
    ctx.setLineWidth(6)
    ctx.strokePath()

    return rep.representation(using: .png, properties: [:])!
}

let fm = FileManager.default
let packaging = URL(fileURLWithPath: "packaging")
let iconset = fm.temporaryDirectory.appendingPathComponent("LucaDesktop-\(ProcessInfo.processInfo.processIdentifier).iconset")
try? fm.removeItem(at: iconset)
try fm.createDirectory(at: iconset, withIntermediateDirectories: true)
for size in [16, 32, 128, 256, 512] {
    try draw(pixels: size).write(to: iconset.appendingPathComponent("icon_\(size)x\(size).png"))
    try draw(pixels: size * 2).write(to: iconset.appendingPathComponent("icon_\(size)x\(size)@2x.png"))
}
try draw(pixels: 1024).write(to: packaging.appendingPathComponent("AppIcon.png"))

let iconutil = Process()
iconutil.executableURL = URL(fileURLWithPath: "/usr/bin/iconutil")
iconutil.arguments = ["-c", "icns", iconset.path, "-o", packaging.appendingPathComponent("AppIcon.icns").path]
try iconutil.run()
iconutil.waitUntilExit()
try? fm.removeItem(at: iconset)
guard iconutil.terminationStatus == 0 else { fatalError("iconutil failed") }
print("Wrote packaging/AppIcon.icns and packaging/AppIcon.png")
