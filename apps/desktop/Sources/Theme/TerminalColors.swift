/// The 16 ANSI colors a terminal tile installs for the live theme.
///
/// A theme that ports an editor theme with its own terminal colors sets
/// `KitPalette.ansi`. Every other theme gets colors made from its status
/// and syntax colors, so `ls`, git and prompts match the rest of the app.
extension KitPalette {
    /// Black, red, green, yellow, blue, magenta, cyan, white, then the
    /// bright eight in the same order.
    func terminalColors(dark: Bool) -> [KitColor] {
        if let ansi, ansi.count == 16 { return ansi }
        // Black and white swap ends on a light theme: "black" text must
        // still read on the light ground, "white" must still read as pale.
        let black = dark ? raised : text
        let brightBlack = dark ? textFaint : textMuted
        let white = dark ? textBody : raised
        let brightWhite = dark ? text : surface
        let normal = [black, bad, good, warn, info, syntax.type, accent, white]
        let bright = [brightBlack, bad, good, warn, info, syntax.type, accent, brightWhite]
        return normal + bright
    }
}
