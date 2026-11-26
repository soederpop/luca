// The theme kit's color tokens, one palette per theme. Edit by hand.
import SwiftUI

struct KitColor: Equatable, Sendable {
    let hex: String
    let red: Double
    let green: Double
    let blue: Double
    let alpha: Double

    var color: Color { Color(.sRGB, red: red, green: green, blue: blue, opacity: alpha) }
}

/// Code colors, one per kind of token.
struct KitSyntax: Equatable, Sendable {
    let keyword: KitColor
    let string: KitColor
    let number: KitColor
    let comment: KitColor
    let property: KitColor
    let type: KitColor
    let function: KitColor
}

struct KitPalette: Equatable, Sendable {
    let ground: KitColor
    let surface: KitColor
    let raised: KitColor
    let inset: KitColor
    let border: KitColor
    let borderStrong: KitColor
    let text: KitColor
    let textBody: KitColor
    let textMuted: KitColor
    let textFaint: KitColor
    let accent: KitColor
    let accentOn: KitColor
    let accentSoft: KitColor
    let good: KitColor
    let warn: KitColor
    let bad: KitColor
    let info: KitColor
    let idle: KitColor
    let shadow: KitColor
    let syntax: KitSyntax
    /// Spare hues: project colors and the kind colors that are not syntax colors.
    let hues: [KitColor]
}

/// A named look: one whole palette, dark or light.
struct KitTheme: Equatable, Sendable, Identifiable {
    let id: String
    let label: String
    let dark: Bool
    let palette: KitPalette
}

enum KitTokens {
    static let dark = KitPalette(
        ground: KitColor(hex: "#070D18", red: 0.0275, green: 0.051, blue: 0.0941, alpha: 1),
        surface: KitColor(hex: "#0E1A2D", red: 0.0549, green: 0.102, blue: 0.1765, alpha: 1),
        raised: KitColor(hex: "#16283F", red: 0.0863, green: 0.1569, blue: 0.2471, alpha: 1),
        inset: KitColor(hex: "#0A1524", red: 0.0392, green: 0.0824, blue: 0.1412, alpha: 1),
        border: KitColor(hex: "#7EA0D624", red: 0.4941, green: 0.6275, blue: 0.8392, alpha: 0.1412),
        borderStrong: KitColor(hex: "#7EA0D642", red: 0.4941, green: 0.6275, blue: 0.8392, alpha: 0.2588),
        text: KitColor(hex: "#EAF3FD", red: 0.9176, green: 0.9529, blue: 0.9922, alpha: 1),
        textBody: KitColor(hex: "#C9D8EA", red: 0.7882, green: 0.8471, blue: 0.9176, alpha: 1),
        textMuted: KitColor(hex: "#97ADC6", red: 0.5922, green: 0.6784, blue: 0.7765, alpha: 1),
        textFaint: KitColor(hex: "#7D97B7", red: 0.4902, green: 0.5922, blue: 0.7176, alpha: 1),
        accent: KitColor(hex: "#57E0C4", red: 0.3412, green: 0.8784, blue: 0.7686, alpha: 1),
        accentOn: KitColor(hex: "#04241D", red: 0.0157, green: 0.1412, blue: 0.1137, alpha: 1),
        accentSoft: KitColor(hex: "#57E0C429", red: 0.3412, green: 0.8784, blue: 0.7686, alpha: 0.1608),
        good: KitColor(hex: "#4ADE80", red: 0.2902, green: 0.8706, blue: 0.502, alpha: 1),
        warn: KitColor(hex: "#F5C46B", red: 0.9608, green: 0.7686, blue: 0.4196, alpha: 1),
        bad: KitColor(hex: "#FA8484", red: 0.9804, green: 0.5176, blue: 0.5176, alpha: 1),
        info: KitColor(hex: "#7CB4F5", red: 0.4863, green: 0.7059, blue: 0.9608, alpha: 1),
        idle: KitColor(hex: "#97ADC6", red: 0.5922, green: 0.6784, blue: 0.7765, alpha: 1),
        shadow: KitColor(hex: "#00000073", red: 0, green: 0, blue: 0, alpha: 0.451),
        syntax: KitSyntax(
            keyword: KitColor(hex: "#57E0C4", red: 0.3412, green: 0.8784, blue: 0.7686, alpha: 1),
            string: KitColor(hex: "#4ADE80", red: 0.2902, green: 0.8706, blue: 0.502, alpha: 1),
            number: KitColor(hex: "#F5C46B", red: 0.9608, green: 0.7686, blue: 0.4196, alpha: 1),
            comment: KitColor(hex: "#7D97B7", red: 0.4902, green: 0.5922, blue: 0.7176, alpha: 1),
            property: KitColor(hex: "#7CB4F5", red: 0.4863, green: 0.7059, blue: 0.9608, alpha: 1),
            type: KitColor(hex: "#B4A3F8", red: 0.7059, green: 0.6392, blue: 0.9725, alpha: 1),
            function: KitColor(hex: "#F0A96B", red: 0.9412, green: 0.6627, blue: 0.4196, alpha: 1),
        ),
        hues: [
            KitColor(hex: "#F0A96B", red: 0.9412, green: 0.6627, blue: 0.4196, alpha: 1),
            KitColor(hex: "#7CB4F5", red: 0.4863, green: 0.7059, blue: 0.9608, alpha: 1),
            KitColor(hex: "#B4A3F8", red: 0.7059, green: 0.6392, blue: 0.9725, alpha: 1),
            KitColor(hex: "#F57FB0", red: 0.9608, green: 0.498, blue: 0.6902, alpha: 1),
            KitColor(hex: "#F5C46B", red: 0.9608, green: 0.7686, blue: 0.4196, alpha: 1),
            KitColor(hex: "#6BD6C6", red: 0.4196, green: 0.8392, blue: 0.7765, alpha: 1),
            KitColor(hex: "#9BD66B", red: 0.6078, green: 0.8392, blue: 0.4196, alpha: 1),
            KitColor(hex: "#F08A7A", red: 0.9412, green: 0.5412, blue: 0.4784, alpha: 1),
        ]
    )

    static let light = KitPalette(
        ground: KitColor(hex: "#EFF4F9", red: 0.9373, green: 0.9569, blue: 0.9765, alpha: 1),
        surface: KitColor(hex: "#FFFFFF", red: 1, green: 1, blue: 1, alpha: 1),
        raised: KitColor(hex: "#E4ECF5", red: 0.8941, green: 0.9255, blue: 0.9608, alpha: 1),
        inset: KitColor(hex: "#EDF2F8", red: 0.9294, green: 0.949, blue: 0.9725, alpha: 1),
        border: KitColor(hex: "#14375C24", red: 0.0784, green: 0.2157, blue: 0.3608, alpha: 0.1412),
        borderStrong: KitColor(hex: "#14375C42", red: 0.0784, green: 0.2157, blue: 0.3608, alpha: 0.2588),
        text: KitColor(hex: "#0C1B2C", red: 0.0471, green: 0.1059, blue: 0.1725, alpha: 1),
        textBody: KitColor(hex: "#22384F", red: 0.1333, green: 0.2196, blue: 0.3098, alpha: 1),
        textMuted: KitColor(hex: "#465B70", red: 0.2745, green: 0.3569, blue: 0.4392, alpha: 1),
        textFaint: KitColor(hex: "#52667A", red: 0.3216, green: 0.4, blue: 0.4784, alpha: 1),
        accent: KitColor(hex: "#086B5C", red: 0.0314, green: 0.4196, blue: 0.3608, alpha: 1),
        accentOn: KitColor(hex: "#FFFFFF", red: 1, green: 1, blue: 1, alpha: 1),
        accentSoft: KitColor(hex: "#086B5C1F", red: 0.0314, green: 0.4196, blue: 0.3608, alpha: 0.1216),
        good: KitColor(hex: "#11683A", red: 0.0667, green: 0.4078, blue: 0.2275, alpha: 1),
        warn: KitColor(hex: "#755109", red: 0.4588, green: 0.3176, blue: 0.0353, alpha: 1),
        bad: KitColor(hex: "#A32F22", red: 0.6392, green: 0.1843, blue: 0.1333, alpha: 1),
        info: KitColor(hex: "#1B50A6", red: 0.1059, green: 0.3137, blue: 0.651, alpha: 1),
        idle: KitColor(hex: "#465B70", red: 0.2745, green: 0.3569, blue: 0.4392, alpha: 1),
        shadow: KitColor(hex: "#0A1A2B29", red: 0.0392, green: 0.102, blue: 0.1686, alpha: 0.1608),
        syntax: KitSyntax(
            keyword: KitColor(hex: "#086B5C", red: 0.0314, green: 0.4196, blue: 0.3608, alpha: 1),
            string: KitColor(hex: "#11683A", red: 0.0667, green: 0.4078, blue: 0.2275, alpha: 1),
            number: KitColor(hex: "#755109", red: 0.4588, green: 0.3176, blue: 0.0353, alpha: 1),
            comment: KitColor(hex: "#52667A", red: 0.3216, green: 0.4, blue: 0.4784, alpha: 1),
            property: KitColor(hex: "#1B50A6", red: 0.1059, green: 0.3137, blue: 0.651, alpha: 1),
            type: KitColor(hex: "#6242C4", red: 0.3843, green: 0.2588, blue: 0.7686, alpha: 1),
            function: KitColor(hex: "#A8500A", red: 0.6588, green: 0.3137, blue: 0.0392, alpha: 1),
        ),
        hues: [
            KitColor(hex: "#B8590C", red: 0.7216, green: 0.349, blue: 0.0471, alpha: 1),
            KitColor(hex: "#2563C9", red: 0.1451, green: 0.3882, blue: 0.7882, alpha: 1),
            KitColor(hex: "#6242C4", red: 0.3843, green: 0.2588, blue: 0.7686, alpha: 1),
            KitColor(hex: "#C0367A", red: 0.7529, green: 0.2118, blue: 0.4784, alpha: 1),
            KitColor(hex: "#8A600C", red: 0.5412, green: 0.3765, blue: 0.0471, alpha: 1),
            KitColor(hex: "#0F7A8C", red: 0.0588, green: 0.4784, blue: 0.549, alpha: 1),
            KitColor(hex: "#3F7F1A", red: 0.2471, green: 0.498, blue: 0.102, alpha: 1),
            KitColor(hex: "#B5422F", red: 0.7098, green: 0.2588, blue: 0.1843, alpha: 1),
        ]
    )

    static func palette(dark: Bool) -> KitPalette { dark ? Self.dark : Self.light }

    /// The named themes, in the order of tokens.json.
    static let themes: [KitTheme] = [
        KitTheme(id: "monokai", label: "Monokai", dark: true, palette: KitPalette(
            ground: KitColor(hex: "#1E1F1C", red: 0.1176, green: 0.1216, blue: 0.1098, alpha: 1),
            surface: KitColor(hex: "#272822", red: 0.1529, green: 0.1569, blue: 0.1333, alpha: 1),
            raised: KitColor(hex: "#3E3D32", red: 0.2431, green: 0.2392, blue: 0.1961, alpha: 1),
            inset: KitColor(hex: "#22231E", red: 0.1333, green: 0.1373, blue: 0.1176, alpha: 1),
            border: KitColor(hex: "#A9A7992E", red: 0.6627, green: 0.6549, blue: 0.6, alpha: 0.1804),
            borderStrong: KitColor(hex: "#A9A79957", red: 0.6627, green: 0.6549, blue: 0.6, alpha: 0.3412),
            text: KitColor(hex: "#F8F8F2", red: 0.9725, green: 0.9725, blue: 0.949, alpha: 1),
            textBody: KitColor(hex: "#DFDFD9", red: 0.8745, green: 0.8745, blue: 0.851, alpha: 1),
            textMuted: KitColor(hex: "#BEBEB8", red: 0.7451, green: 0.7451, blue: 0.7216, alpha: 1),
            textFaint: KitColor(hex: "#ABA79B", red: 0.6706, green: 0.6549, blue: 0.6078, alpha: 1),
            accent: KitColor(hex: "#A6E22E", red: 0.651, green: 0.8863, blue: 0.1804, alpha: 1),
            accentOn: KitColor(hex: "#1E1F1C", red: 0.1176, green: 0.1216, blue: 0.1098, alpha: 1),
            accentSoft: KitColor(hex: "#A6E22E29", red: 0.651, green: 0.8863, blue: 0.1804, alpha: 0.1608),
            good: KitColor(hex: "#A6E22E", red: 0.651, green: 0.8863, blue: 0.1804, alpha: 1),
            warn: KitColor(hex: "#E6DB74", red: 0.902, green: 0.8588, blue: 0.4549, alpha: 1),
            bad: KitColor(hex: "#F9A3C3", red: 0.9765, green: 0.6392, blue: 0.7647, alpha: 1),
            info: KitColor(hex: "#66D9EF", red: 0.4, green: 0.851, blue: 0.9373, alpha: 1),
            idle: KitColor(hex: "#BEBEB8", red: 0.7451, green: 0.7451, blue: 0.7216, alpha: 1),
            shadow: KitColor(hex: "#00000073", red: 0, green: 0, blue: 0, alpha: 0.451),
            syntax: KitSyntax(
                keyword: KitColor(hex: "#F980AC", red: 0.9765, green: 0.502, blue: 0.6745, alpha: 1),
                string: KitColor(hex: "#E6DB74", red: 0.902, green: 0.8588, blue: 0.4549, alpha: 1),
                number: KitColor(hex: "#BA94FF", red: 0.7294, green: 0.5804, blue: 1, alpha: 1),
                comment: KitColor(hex: "#ABA79B", red: 0.6706, green: 0.6549, blue: 0.6078, alpha: 1),
                property: KitColor(hex: "#A6E22E", red: 0.651, green: 0.8863, blue: 0.1804, alpha: 1),
                type: KitColor(hex: "#66D9EF", red: 0.4, green: 0.851, blue: 0.9373, alpha: 1),
                function: KitColor(hex: "#A6E22E", red: 0.651, green: 0.8863, blue: 0.1804, alpha: 1),
            ),
            hues: [
                KitColor(hex: "#FD971F", red: 0.9922, green: 0.5922, blue: 0.1216, alpha: 1),
                KitColor(hex: "#66D9EF", red: 0.4, green: 0.851, blue: 0.9373, alpha: 1),
                KitColor(hex: "#AE81FF", red: 0.6824, green: 0.5059, blue: 1, alpha: 1),
                KitColor(hex: "#F9377D", red: 0.9765, green: 0.2157, blue: 0.4902, alpha: 1),
                KitColor(hex: "#E6DB74", red: 0.902, green: 0.8588, blue: 0.4549, alpha: 1),
                KitColor(hex: "#66D9EF", red: 0.4, green: 0.851, blue: 0.9373, alpha: 1),
                KitColor(hex: "#A6E22E", red: 0.651, green: 0.8863, blue: 0.1804, alpha: 1),
                KitColor(hex: "#F9377D", red: 0.9765, green: 0.2157, blue: 0.4902, alpha: 1),
            ]
        )),
        KitTheme(id: "dracula", label: "Dracula", dark: true, palette: KitPalette(
            ground: KitColor(hex: "#21222C", red: 0.1294, green: 0.1333, blue: 0.1725, alpha: 1),
            surface: KitColor(hex: "#282A36", red: 0.1569, green: 0.1647, blue: 0.2118, alpha: 1),
            raised: KitColor(hex: "#44475A", red: 0.2667, green: 0.2784, blue: 0.3529, alpha: 1),
            inset: KitColor(hex: "#242530", red: 0.1412, green: 0.1451, blue: 0.1882, alpha: 1),
            border: KitColor(hex: "#9EA8C32E", red: 0.6196, green: 0.6588, blue: 0.7647, alpha: 0.1804),
            borderStrong: KitColor(hex: "#9EA8C357", red: 0.6196, green: 0.6588, blue: 0.7647, alpha: 0.3412),
            text: KitColor(hex: "#F8F8F2", red: 0.9725, green: 0.9725, blue: 0.949, alpha: 1),
            textBody: KitColor(hex: "#DFDFDB", red: 0.8745, green: 0.8745, blue: 0.8588, alpha: 1),
            textMuted: KitColor(hex: "#CFD0D0", red: 0.8118, green: 0.8157, blue: 0.8157, alpha: 1),
            textFaint: KitColor(hex: "#B0B7D0", red: 0.6902, green: 0.7176, blue: 0.8157, alpha: 1),
            accent: KitColor(hex: "#DCC5F9", red: 0.8627, green: 0.7725, blue: 0.9765, alpha: 1),
            accentOn: KitColor(hex: "#21222C", red: 0.1294, green: 0.1333, blue: 0.1725, alpha: 1),
            accentSoft: KitColor(hex: "#DCC5F929", red: 0.8627, green: 0.7725, blue: 0.9765, alpha: 0.1608),
            good: KitColor(hex: "#50FA7B", red: 0.3137, green: 0.9804, blue: 0.4824, alpha: 1),
            warn: KitColor(hex: "#F1FA8C", red: 0.9451, green: 0.9804, blue: 0.549, alpha: 1),
            bad: KitColor(hex: "#FFC0C0", red: 1, green: 0.7529, blue: 0.7529, alpha: 1),
            info: KitColor(hex: "#8BE9FD", red: 0.5451, green: 0.9137, blue: 0.9922, alpha: 1),
            idle: KitColor(hex: "#CFD0D0", red: 0.8118, green: 0.8157, blue: 0.8157, alpha: 1),
            shadow: KitColor(hex: "#00000073", red: 0, green: 0, blue: 0, alpha: 0.451),
            syntax: KitSyntax(
                keyword: KitColor(hex: "#FF96D2", red: 1, green: 0.5882, blue: 0.8235, alpha: 1),
                string: KitColor(hex: "#F1FA8C", red: 0.9451, green: 0.9804, blue: 0.549, alpha: 1),
                number: KitColor(hex: "#C9A7F9", red: 0.7882, green: 0.6549, blue: 0.9765, alpha: 1),
                comment: KitColor(hex: "#B0B7D0", red: 0.6902, green: 0.7176, blue: 0.8157, alpha: 1),
                property: KitColor(hex: "#50FA7B", red: 0.3137, green: 0.9804, blue: 0.4824, alpha: 1),
                type: KitColor(hex: "#8BE9FD", red: 0.5451, green: 0.9137, blue: 0.9922, alpha: 1),
                function: KitColor(hex: "#50FA7B", red: 0.3137, green: 0.9804, blue: 0.4824, alpha: 1),
            ),
            hues: [
                KitColor(hex: "#FFB86C", red: 1, green: 0.7216, blue: 0.4235, alpha: 1),
                KitColor(hex: "#8BE9FD", red: 0.5451, green: 0.9137, blue: 0.9922, alpha: 1),
                KitColor(hex: "#BD93F9", red: 0.7412, green: 0.5765, blue: 0.9765, alpha: 1),
                KitColor(hex: "#FF79C6", red: 1, green: 0.4745, blue: 0.7765, alpha: 1),
                KitColor(hex: "#F1FA8C", red: 0.9451, green: 0.9804, blue: 0.549, alpha: 1),
                KitColor(hex: "#8BE9FD", red: 0.5451, green: 0.9137, blue: 0.9922, alpha: 1),
                KitColor(hex: "#50FA7B", red: 0.3137, green: 0.9804, blue: 0.4824, alpha: 1),
                KitColor(hex: "#FF5C5C", red: 1, green: 0.3608, blue: 0.3608, alpha: 1),
            ]
        )),
        KitTheme(id: "nord", label: "Nord", dark: true, palette: KitPalette(
            ground: KitColor(hex: "#272C36", red: 0.1529, green: 0.1725, blue: 0.2118, alpha: 1),
            surface: KitColor(hex: "#2E3440", red: 0.1804, green: 0.2039, blue: 0.251, alpha: 1),
            raised: KitColor(hex: "#3B4252", red: 0.2314, green: 0.2588, blue: 0.3216, alpha: 1),
            inset: KitColor(hex: "#2A2F3A", red: 0.1647, green: 0.1843, blue: 0.2275, alpha: 1),
            border: KitColor(hex: "#99A2B32E", red: 0.6, green: 0.6353, blue: 0.702, alpha: 0.1804),
            borderStrong: KitColor(hex: "#99A2B357", red: 0.6, green: 0.6353, blue: 0.702, alpha: 0.3412),
            text: KitColor(hex: "#ECEFF4", red: 0.9255, green: 0.9373, blue: 0.9569, alpha: 1),
            textBody: KitColor(hex: "#D5D9DE", red: 0.8353, green: 0.851, blue: 0.8706, alpha: 1),
            textMuted: KitColor(hex: "#C3C6CB", red: 0.7647, green: 0.7765, blue: 0.7961, alpha: 1),
            textFaint: KitColor(hex: "#ABB1C0", red: 0.6706, green: 0.6941, blue: 0.7529, alpha: 1),
            accent: KitColor(hex: "#A2CDDB", red: 0.6353, green: 0.8039, blue: 0.8588, alpha: 1),
            accentOn: KitColor(hex: "#272C36", red: 0.1529, green: 0.1725, blue: 0.2118, alpha: 1),
            accentSoft: KitColor(hex: "#A2CDDB29", red: 0.6353, green: 0.8039, blue: 0.8588, alpha: 0.1608),
            good: KitColor(hex: "#B7CBA5", red: 0.7176, green: 0.7961, blue: 0.6471, alpha: 1),
            warn: KitColor(hex: "#EBCB8B", red: 0.9216, green: 0.7961, blue: 0.5451, alpha: 1),
            bad: KitColor(hex: "#E2BCC0", red: 0.8863, green: 0.7373, blue: 0.7529, alpha: 1),
            info: KitColor(hex: "#B4C7DB", red: 0.7059, green: 0.7804, blue: 0.8588, alpha: 1),
            idle: KitColor(hex: "#C3C6CB", red: 0.7647, green: 0.7765, blue: 0.7961, alpha: 1),
            shadow: KitColor(hex: "#00000073", red: 0, green: 0, blue: 0, alpha: 0.451),
            syntax: KitSyntax(
                keyword: KitColor(hex: "#98B2CB", red: 0.5961, green: 0.698, blue: 0.7961, alpha: 1),
                string: KitColor(hex: "#A3BE8C", red: 0.6392, green: 0.7451, blue: 0.549, alpha: 1),
                number: KitColor(hex: "#C5A7BF", red: 0.7725, green: 0.6549, blue: 0.749, alpha: 1),
                comment: KitColor(hex: "#ABB1C0", red: 0.6706, green: 0.6941, blue: 0.7529, alpha: 1),
                property: KitColor(hex: "#8FBCBB", red: 0.5608, green: 0.7373, blue: 0.7333, alpha: 1),
                type: KitColor(hex: "#8FBCBB", red: 0.5608, green: 0.7373, blue: 0.7333, alpha: 1),
                function: KitColor(hex: "#88C0D0", red: 0.5333, green: 0.7529, blue: 0.8157, alpha: 1),
            ),
            hues: [
                KitColor(hex: "#D08770", red: 0.8157, green: 0.5294, blue: 0.4392, alpha: 1),
                KitColor(hex: "#81A1C1", red: 0.5059, green: 0.6314, blue: 0.7569, alpha: 1),
                KitColor(hex: "#B48EAD", red: 0.7059, green: 0.5569, blue: 0.6784, alpha: 1),
                KitColor(hex: "#B48EAD", red: 0.7059, green: 0.5569, blue: 0.6784, alpha: 1),
                KitColor(hex: "#EBCB8B", red: 0.9216, green: 0.7961, blue: 0.5451, alpha: 1),
                KitColor(hex: "#88C0D0", red: 0.5333, green: 0.7529, blue: 0.8157, alpha: 1),
                KitColor(hex: "#A3BE8C", red: 0.6392, green: 0.7451, blue: 0.549, alpha: 1),
                KitColor(hex: "#C87980", red: 0.7843, green: 0.4745, blue: 0.502, alpha: 1),
            ]
        )),
        KitTheme(id: "gruvbox-dark", label: "Gruvbox Dark", dark: true, palette: KitPalette(
            ground: KitColor(hex: "#1D2021", red: 0.1137, green: 0.1255, blue: 0.1294, alpha: 1),
            surface: KitColor(hex: "#282828", red: 0.1569, green: 0.1569, blue: 0.1569, alpha: 1),
            raised: KitColor(hex: "#3C3836", red: 0.2353, green: 0.2196, blue: 0.2118, alpha: 1),
            inset: KitColor(hex: "#212324", red: 0.1294, green: 0.1373, blue: 0.1412, alpha: 1),
            border: KitColor(hex: "#B6A68D2E", red: 0.7137, green: 0.651, blue: 0.5529, alpha: 0.1804),
            borderStrong: KitColor(hex: "#B6A68D57", red: 0.7137, green: 0.651, blue: 0.5529, alpha: 0.3412),
            text: KitColor(hex: "#EBDBB2", red: 0.9216, green: 0.8588, blue: 0.698, alpha: 1),
            textBody: KitColor(hex: "#D4C6A1", red: 0.8314, green: 0.7765, blue: 0.6314, alpha: 1),
            textMuted: KitColor(hex: "#BFB6A0", red: 0.749, green: 0.7137, blue: 0.6275, alpha: 1),
            textFaint: KitColor(hex: "#AEA091", red: 0.6824, green: 0.6275, blue: 0.5686, alpha: 1),
            accent: KitColor(hex: "#FABD2F", red: 0.9804, green: 0.7412, blue: 0.1843, alpha: 1),
            accentOn: KitColor(hex: "#1D2021", red: 0.1137, green: 0.1255, blue: 0.1294, alpha: 1),
            accentSoft: KitColor(hex: "#FABD2F29", red: 0.9804, green: 0.7412, blue: 0.1843, alpha: 0.1608),
            good: KitColor(hex: "#BBBE2F", red: 0.7333, green: 0.7451, blue: 0.1843, alpha: 1),
            warn: KitColor(hex: "#FABD2F", red: 0.9804, green: 0.7412, blue: 0.1843, alpha: 1),
            bad: KitColor(hex: "#FB9F95", red: 0.9843, green: 0.6235, blue: 0.5843, alpha: 1),
            info: KitColor(hex: "#A6BEB4", red: 0.651, green: 0.7451, blue: 0.7059, alpha: 1),
            idle: KitColor(hex: "#BFB6A0", red: 0.749, green: 0.7137, blue: 0.6275, alpha: 1),
            shadow: KitColor(hex: "#00000073", red: 0, green: 0, blue: 0, alpha: 0.451),
            syntax: KitSyntax(
                keyword: KitColor(hex: "#FB8072", red: 0.9843, green: 0.502, blue: 0.4471, alpha: 1),
                string: KitColor(hex: "#B8BB26", red: 0.7216, green: 0.7333, blue: 0.149, alpha: 1),
                number: KitColor(hex: "#D790A3", red: 0.8431, green: 0.5647, blue: 0.6392, alpha: 1),
                comment: KitColor(hex: "#AEA091", red: 0.6824, green: 0.6275, blue: 0.5686, alpha: 1),
                property: KitColor(hex: "#88A99C", red: 0.5333, green: 0.6627, blue: 0.6118, alpha: 1),
                type: KitColor(hex: "#FABD2F", red: 0.9804, green: 0.7412, blue: 0.1843, alpha: 1),
                function: KitColor(hex: "#8EC07C", red: 0.5569, green: 0.7529, blue: 0.4863, alpha: 1),
            ),
            hues: [
                KitColor(hex: "#FE8019", red: 0.9961, green: 0.502, blue: 0.098, alpha: 1),
                KitColor(hex: "#83A598", red: 0.5137, green: 0.6471, blue: 0.5961, alpha: 1),
                KitColor(hex: "#D3869B", red: 0.8275, green: 0.5255, blue: 0.6078, alpha: 1),
                KitColor(hex: "#D3869B", red: 0.8275, green: 0.5255, blue: 0.6078, alpha: 1),
                KitColor(hex: "#FABD2F", red: 0.9804, green: 0.7412, blue: 0.1843, alpha: 1),
                KitColor(hex: "#8EC07C", red: 0.5569, green: 0.7529, blue: 0.4863, alpha: 1),
                KitColor(hex: "#B8BB26", red: 0.7216, green: 0.7333, blue: 0.149, alpha: 1),
                KitColor(hex: "#FB4934", red: 0.9843, green: 0.2863, blue: 0.2039, alpha: 1),
            ]
        )),
        KitTheme(id: "tokyo-night", label: "Tokyo Night", dark: true, palette: KitPalette(
            ground: KitColor(hex: "#16161E", red: 0.0863, green: 0.0863, blue: 0.1176, alpha: 1),
            surface: KitColor(hex: "#1A1B26", red: 0.102, green: 0.1059, blue: 0.149, alpha: 1),
            raised: KitColor(hex: "#292E42", red: 0.1608, green: 0.1804, blue: 0.2588, alpha: 1),
            inset: KitColor(hex: "#181821", red: 0.0941, green: 0.0941, blue: 0.1294, alpha: 1),
            border: KitColor(hex: "#808AB42E", red: 0.502, green: 0.5412, blue: 0.7059, alpha: 0.1804),
            borderStrong: KitColor(hex: "#808AB457", red: 0.502, green: 0.5412, blue: 0.7059, alpha: 0.3412),
            text: KitColor(hex: "#C0CAF5", red: 0.7529, green: 0.7922, blue: 0.9608, alpha: 1),
            textBody: KitColor(hex: "#ACB5DC", red: 0.6745, green: 0.7098, blue: 0.8627, alpha: 1),
            textMuted: KitColor(hex: "#A4AAC4", red: 0.6431, green: 0.6667, blue: 0.7686, alpha: 1),
            textFaint: KitColor(hex: "#9197B5", red: 0.5686, green: 0.5922, blue: 0.7098, alpha: 1),
            accent: KitColor(hex: "#84AAF7", red: 0.5176, green: 0.6667, blue: 0.9686, alpha: 1),
            accentOn: KitColor(hex: "#16161E", red: 0.0863, green: 0.0863, blue: 0.1176, alpha: 1),
            accentSoft: KitColor(hex: "#84AAF729", red: 0.5176, green: 0.6667, blue: 0.9686, alpha: 0.1608),
            good: KitColor(hex: "#9ECE6A", red: 0.6196, green: 0.8078, blue: 0.4157, alpha: 1),
            warn: KitColor(hex: "#E0AF68", red: 0.8784, green: 0.6863, blue: 0.4078, alpha: 1),
            bad: KitColor(hex: "#F7859B", red: 0.9686, green: 0.5216, blue: 0.6078, alpha: 1),
            info: KitColor(hex: "#84AAF7", red: 0.5176, green: 0.6667, blue: 0.9686, alpha: 1),
            idle: KitColor(hex: "#A4AAC4", red: 0.6431, green: 0.6667, blue: 0.7686, alpha: 1),
            shadow: KitColor(hex: "#00000073", red: 0, green: 0, blue: 0, alpha: 0.451),
            syntax: KitSyntax(
                keyword: KitColor(hex: "#BB9AF7", red: 0.7333, green: 0.6039, blue: 0.9686, alpha: 1),
                string: KitColor(hex: "#9ECE6A", red: 0.6196, green: 0.8078, blue: 0.4157, alpha: 1),
                number: KitColor(hex: "#FF9E64", red: 1, green: 0.6196, blue: 0.3922, alpha: 1),
                comment: KitColor(hex: "#9197B5", red: 0.5686, green: 0.5922, blue: 0.7098, alpha: 1),
                property: KitColor(hex: "#73DACA", red: 0.451, green: 0.8549, blue: 0.7922, alpha: 1),
                type: KitColor(hex: "#2AC3DE", red: 0.1647, green: 0.7647, blue: 0.8706, alpha: 1),
                function: KitColor(hex: "#7AA2F7", red: 0.4784, green: 0.6353, blue: 0.9686, alpha: 1),
            ),
            hues: [
                KitColor(hex: "#FF9E64", red: 1, green: 0.6196, blue: 0.3922, alpha: 1),
                KitColor(hex: "#7AA2F7", red: 0.4784, green: 0.6353, blue: 0.9686, alpha: 1),
                KitColor(hex: "#BB9AF7", red: 0.7333, green: 0.6039, blue: 0.9686, alpha: 1),
                KitColor(hex: "#F7768E", red: 0.9686, green: 0.4627, blue: 0.5569, alpha: 1),
                KitColor(hex: "#E0AF68", red: 0.8784, green: 0.6863, blue: 0.4078, alpha: 1),
                KitColor(hex: "#7DCFFF", red: 0.4902, green: 0.8118, blue: 1, alpha: 1),
                KitColor(hex: "#9ECE6A", red: 0.6196, green: 0.8078, blue: 0.4157, alpha: 1),
                KitColor(hex: "#F7768E", red: 0.9686, green: 0.4627, blue: 0.5569, alpha: 1),
            ]
        )),
        KitTheme(id: "catppuccin-mocha", label: "Catppuccin Mocha", dark: true, palette: KitPalette(
            ground: KitColor(hex: "#11111B", red: 0.0667, green: 0.0667, blue: 0.1059, alpha: 1),
            surface: KitColor(hex: "#1E1E2E", red: 0.1176, green: 0.1176, blue: 0.1804, alpha: 1),
            raised: KitColor(hex: "#313244", red: 0.1922, green: 0.1961, blue: 0.2667, alpha: 1),
            inset: KitColor(hex: "#161623", red: 0.0863, green: 0.0863, blue: 0.1373, alpha: 1),
            border: KitColor(hex: "#9399B22E", red: 0.5765, green: 0.6, blue: 0.698, alpha: 0.1804),
            borderStrong: KitColor(hex: "#9399B257", red: 0.5765, green: 0.6, blue: 0.698, alpha: 0.3412),
            text: KitColor(hex: "#CDD6F4", red: 0.8039, green: 0.8392, blue: 0.9569, alpha: 1),
            textBody: KitColor(hex: "#B8C0DC", red: 0.7216, green: 0.7529, blue: 0.8627, alpha: 1),
            textMuted: KitColor(hex: "#A9AEC3", red: 0.6627, green: 0.6824, blue: 0.7647, alpha: 1),
            textFaint: KitColor(hex: "#979BAE", red: 0.5922, green: 0.6078, blue: 0.6824, alpha: 1),
            accent: KitColor(hex: "#CBA6F7", red: 0.7961, green: 0.651, blue: 0.9686, alpha: 1),
            accentOn: KitColor(hex: "#11111B", red: 0.0667, green: 0.0667, blue: 0.1059, alpha: 1),
            accentSoft: KitColor(hex: "#CBA6F729", red: 0.7961, green: 0.651, blue: 0.9686, alpha: 0.1608),
            good: KitColor(hex: "#A6E3A1", red: 0.651, green: 0.8902, blue: 0.6314, alpha: 1),
            warn: KitColor(hex: "#F9E2AF", red: 0.9765, green: 0.8863, blue: 0.6863, alpha: 1),
            bad: KitColor(hex: "#F390AB", red: 0.9529, green: 0.5647, blue: 0.6706, alpha: 1),
            info: KitColor(hex: "#89B4FA", red: 0.5373, green: 0.7059, blue: 0.9804, alpha: 1),
            idle: KitColor(hex: "#A9AEC3", red: 0.6627, green: 0.6824, blue: 0.7647, alpha: 1),
            shadow: KitColor(hex: "#00000073", red: 0, green: 0, blue: 0, alpha: 0.451),
            syntax: KitSyntax(
                keyword: KitColor(hex: "#CBA6F7", red: 0.7961, green: 0.651, blue: 0.9686, alpha: 1),
                string: KitColor(hex: "#A6E3A1", red: 0.651, green: 0.8902, blue: 0.6314, alpha: 1),
                number: KitColor(hex: "#FAB387", red: 0.9804, green: 0.702, blue: 0.5294, alpha: 1),
                comment: KitColor(hex: "#979BAE", red: 0.5922, green: 0.6078, blue: 0.6824, alpha: 1),
                property: KitColor(hex: "#94E2D5", red: 0.5804, green: 0.8863, blue: 0.8353, alpha: 1),
                type: KitColor(hex: "#F9E2AF", red: 0.9765, green: 0.8863, blue: 0.6863, alpha: 1),
                function: KitColor(hex: "#89B4FA", red: 0.5373, green: 0.7059, blue: 0.9804, alpha: 1),
            ),
            hues: [
                KitColor(hex: "#FAB387", red: 0.9804, green: 0.702, blue: 0.5294, alpha: 1),
                KitColor(hex: "#89B4FA", red: 0.5373, green: 0.7059, blue: 0.9804, alpha: 1),
                KitColor(hex: "#CBA6F7", red: 0.7961, green: 0.651, blue: 0.9686, alpha: 1),
                KitColor(hex: "#F5C2E7", red: 0.9608, green: 0.7608, blue: 0.9059, alpha: 1),
                KitColor(hex: "#F9E2AF", red: 0.9765, green: 0.8863, blue: 0.6863, alpha: 1),
                KitColor(hex: "#94E2D5", red: 0.5804, green: 0.8863, blue: 0.8353, alpha: 1),
                KitColor(hex: "#A6E3A1", red: 0.651, green: 0.8902, blue: 0.6314, alpha: 1),
                KitColor(hex: "#F38BA8", red: 0.9529, green: 0.5451, blue: 0.6588, alpha: 1),
            ]
        )),
        KitTheme(id: "solarized-dark", label: "Solarized Dark", dark: true, palette: KitPalette(
            ground: KitColor(hex: "#00212B", red: 0, green: 0.1294, blue: 0.1686, alpha: 1),
            surface: KitColor(hex: "#002B36", red: 0, green: 0.1686, blue: 0.2118, alpha: 1),
            raised: KitColor(hex: "#073642", red: 0.0275, green: 0.2118, blue: 0.2588, alpha: 1),
            inset: KitColor(hex: "#00252F", red: 0, green: 0.1451, blue: 0.1843, alpha: 1),
            border: KitColor(hex: "#949F9B2E", red: 0.5804, green: 0.6235, blue: 0.6078, alpha: 0.1804),
            borderStrong: KitColor(hex: "#949F9B57", red: 0.5804, green: 0.6235, blue: 0.6078, alpha: 0.3412),
            text: KitColor(hex: "#EEE8D5", red: 0.9333, green: 0.9098, blue: 0.8353, alpha: 1),
            textBody: KitColor(hex: "#D1D1C2", red: 0.8196, green: 0.8196, blue: 0.7608, alpha: 1),
            textMuted: KitColor(hex: "#A6AFA6", red: 0.651, green: 0.6863, blue: 0.651, alpha: 1),
            textFaint: KitColor(hex: "#8F9B9E", red: 0.5608, green: 0.6078, blue: 0.6196, alpha: 1),
            accent: KitColor(hex: "#75B4E1", red: 0.4588, green: 0.7059, blue: 0.8824, alpha: 1),
            accentOn: KitColor(hex: "#00212B", red: 0, green: 0.1294, blue: 0.1686, alpha: 1),
            accentSoft: KitColor(hex: "#75B4E129", red: 0.4588, green: 0.7059, blue: 0.8824, alpha: 0.1608),
            good: KitColor(hex: "#A3B23F", red: 0.6392, green: 0.698, blue: 0.2471, alpha: 1),
            warn: KitColor(hex: "#C7A73F", red: 0.7804, green: 0.6549, blue: 0.2471, alpha: 1),
            bad: KitColor(hex: "#EB908F", red: 0.9216, green: 0.5647, blue: 0.5608, alpha: 1),
            info: KitColor(hex: "#75B4E1", red: 0.4588, green: 0.7059, blue: 0.8824, alpha: 1),
            idle: KitColor(hex: "#A6AFA6", red: 0.651, green: 0.6863, blue: 0.651, alpha: 1),
            shadow: KitColor(hex: "#00000073", red: 0, green: 0, blue: 0, alpha: 0.451),
            syntax: KitSyntax(
                keyword: KitColor(hex: "#93A51D", red: 0.5765, green: 0.6471, blue: 0.1137, alpha: 1),
                string: KitColor(hex: "#3BA9A0", red: 0.2314, green: 0.6627, blue: 0.6275, alpha: 1),
                number: KitColor(hex: "#E17AAC", red: 0.8824, green: 0.4784, blue: 0.6745, alpha: 1),
                comment: KitColor(hex: "#8F9B9E", red: 0.5608, green: 0.6078, blue: 0.6196, alpha: 1),
                property: KitColor(hex: "#4EA0DB", red: 0.3059, green: 0.6275, blue: 0.8588, alpha: 1),
                type: KitColor(hex: "#BE971D", red: 0.7451, green: 0.5922, blue: 0.1137, alpha: 1),
                function: KitColor(hex: "#4EA0DB", red: 0.3059, green: 0.6275, blue: 0.8588, alpha: 1),
            ),
            hues: [
                KitColor(hex: "#CF5928", red: 0.8118, green: 0.349, blue: 0.1569, alpha: 1),
                KitColor(hex: "#268BD2", red: 0.149, green: 0.5451, blue: 0.8235, alpha: 1),
                KitColor(hex: "#7277C6", red: 0.4471, green: 0.4667, blue: 0.7765, alpha: 1),
                KitColor(hex: "#D7468C", red: 0.8431, green: 0.2745, blue: 0.549, alpha: 1),
                KitColor(hex: "#B58900", red: 0.7098, green: 0.5373, blue: 0, alpha: 1),
                KitColor(hex: "#2AA198", red: 0.1647, green: 0.6314, blue: 0.5961, alpha: 1),
                KitColor(hex: "#859900", red: 0.5216, green: 0.6, blue: 0, alpha: 1),
                KitColor(hex: "#DE423F", red: 0.8706, green: 0.2588, blue: 0.2471, alpha: 1),
            ]
        )),
        KitTheme(id: "one-dark", label: "One Dark", dark: true, palette: KitPalette(
            ground: KitColor(hex: "#21252B", red: 0.1294, green: 0.1451, blue: 0.1686, alpha: 1),
            surface: KitColor(hex: "#282C34", red: 0.1569, green: 0.1725, blue: 0.2039, alpha: 1),
            raised: KitColor(hex: "#3A404B", red: 0.2275, green: 0.251, blue: 0.2941, alpha: 1),
            inset: KitColor(hex: "#24282F", red: 0.1412, green: 0.1569, blue: 0.1843, alpha: 1),
            border: KitColor(hex: "#8D939D2E", red: 0.5529, green: 0.5765, blue: 0.6157, alpha: 0.1804),
            borderStrong: KitColor(hex: "#8D939D57", red: 0.5529, green: 0.5765, blue: 0.6157, alpha: 0.3412),
            text: KitColor(hex: "#D7DAE0", red: 0.8431, green: 0.8549, blue: 0.8784, alpha: 1),
            textBody: KitColor(hex: "#C2C5CB", red: 0.7608, green: 0.7725, blue: 0.7961, alpha: 1),
            textMuted: KitColor(hex: "#C0C2C5", red: 0.7529, green: 0.7608, blue: 0.7725, alpha: 1),
            textFaint: KitColor(hex: "#ABAEB4", red: 0.6706, green: 0.6824, blue: 0.7059, alpha: 1),
            accent: KitColor(hex: "#92C7F3", red: 0.5725, green: 0.7804, blue: 0.9529, alpha: 1),
            accentOn: KitColor(hex: "#21252B", red: 0.1294, green: 0.1451, blue: 0.1686, alpha: 1),
            accentSoft: KitColor(hex: "#92C7F329", red: 0.5725, green: 0.7804, blue: 0.9529, alpha: 0.1608),
            good: KitColor(hex: "#A8CB8D", red: 0.6588, green: 0.7961, blue: 0.5529, alpha: 1),
            warn: KitColor(hex: "#E5C07B", red: 0.898, green: 0.7529, blue: 0.4824, alpha: 1),
            bad: KitColor(hex: "#F0B2B7", red: 0.9412, green: 0.698, blue: 0.7176, alpha: 1),
            info: KitColor(hex: "#92C7F3", red: 0.5725, green: 0.7804, blue: 0.9529, alpha: 1),
            idle: KitColor(hex: "#C0C2C5", red: 0.7529, green: 0.7608, blue: 0.7725, alpha: 1),
            shadow: KitColor(hex: "#00000073", red: 0, green: 0, blue: 0, alpha: 0.451),
            syntax: KitSyntax(
                keyword: KitColor(hex: "#D295E3", red: 0.8235, green: 0.5843, blue: 0.8902, alpha: 1),
                string: KitColor(hex: "#98C379", red: 0.5961, green: 0.7647, blue: 0.4745, alpha: 1),
                number: KitColor(hex: "#D5A272", red: 0.8353, green: 0.6353, blue: 0.4471, alpha: 1),
                comment: KitColor(hex: "#ABAEB4", red: 0.6706, green: 0.6824, blue: 0.7059, alpha: 1),
                property: KitColor(hex: "#E8959B", red: 0.9098, green: 0.5843, blue: 0.6078, alpha: 1),
                type: KitColor(hex: "#E5C07B", red: 0.898, green: 0.7529, blue: 0.4824, alpha: 1),
                function: KitColor(hex: "#67B2F0", red: 0.4039, green: 0.698, blue: 0.9412, alpha: 1),
            ),
            hues: [
                KitColor(hex: "#D19A66", red: 0.8196, green: 0.6039, blue: 0.4, alpha: 1),
                KitColor(hex: "#61AFEF", red: 0.3804, green: 0.6863, blue: 0.9373, alpha: 1),
                KitColor(hex: "#C678DD", red: 0.7765, green: 0.4706, blue: 0.8667, alpha: 1),
                KitColor(hex: "#C678DD", red: 0.7765, green: 0.4706, blue: 0.8667, alpha: 1),
                KitColor(hex: "#E5C07B", red: 0.898, green: 0.7529, blue: 0.4824, alpha: 1),
                KitColor(hex: "#56B6C2", red: 0.3373, green: 0.7137, blue: 0.7608, alpha: 1),
                KitColor(hex: "#98C379", red: 0.5961, green: 0.7647, blue: 0.4745, alpha: 1),
                KitColor(hex: "#E06C75", red: 0.8784, green: 0.4235, blue: 0.4588, alpha: 1),
            ]
        )),
        KitTheme(id: "solarized-light", label: "Solarized Light", dark: false, palette: KitPalette(
            ground: KitColor(hex: "#EEE8D5", red: 0.9333, green: 0.9098, blue: 0.8353, alpha: 1),
            surface: KitColor(hex: "#FDF6E3", red: 0.9922, green: 0.9647, blue: 0.8902, alpha: 1),
            raised: KitColor(hex: "#E4DDC8", red: 0.8941, green: 0.8667, blue: 0.7843, alpha: 1),
            inset: KitColor(hex: "#F4EEDB", red: 0.9569, green: 0.9333, blue: 0.8588, alpha: 1),
            border: KitColor(hex: "#31565F2E", red: 0.1922, green: 0.3373, blue: 0.3725, alpha: 0.1804),
            borderStrong: KitColor(hex: "#31565F57", red: 0.1922, green: 0.3373, blue: 0.3725, alpha: 0.3412),
            text: KitColor(hex: "#073642", red: 0.0275, green: 0.2118, blue: 0.2588, alpha: 1),
            textBody: KitColor(hex: "#254D55", red: 0.1451, green: 0.302, blue: 0.3333, alpha: 1),
            textMuted: KitColor(hex: "#445A5C", red: 0.2667, green: 0.3529, blue: 0.3608, alpha: 1),
            textFaint: KitColor(hex: "#576466", red: 0.3412, green: 0.3922, blue: 0.4, alpha: 1),
            accent: KitColor(hex: "#1A5886", red: 0.102, green: 0.3451, blue: 0.5255, alpha: 1),
            accentOn: KitColor(hex: "#FFFFFF", red: 1, green: 1, blue: 1, alpha: 1),
            accentSoft: KitColor(hex: "#1A58861F", red: 0.102, green: 0.3451, blue: 0.5255, alpha: 0.1216),
            good: KitColor(hex: "#4E5A00", red: 0.3059, green: 0.3529, blue: 0, alpha: 1),
            warn: KitColor(hex: "#93360E", red: 0.5765, green: 0.2118, blue: 0.0549, alpha: 1),
            bad: KitColor(hex: "#9F2322", red: 0.6235, green: 0.1373, blue: 0.1333, alpha: 1),
            info: KitColor(hex: "#1A5886", red: 0.102, green: 0.3451, blue: 0.5255, alpha: 1),
            idle: KitColor(hex: "#445A5C", red: 0.2667, green: 0.3529, blue: 0.3608, alpha: 1),
            shadow: KitColor(hex: "#00000029", red: 0, green: 0, blue: 0, alpha: 0.1608),
            syntax: KitSyntax(
                keyword: KitColor(hex: "#586600", red: 0.3451, green: 0.4, blue: 0, alpha: 1),
                string: KitColor(hex: "#1D6C65", red: 0.1137, green: 0.4235, blue: 0.3961, alpha: 1),
                number: KitColor(hex: "#AD2C6A", red: 0.6784, green: 0.1725, blue: 0.4157, alpha: 1),
                comment: KitColor(hex: "#576466", red: 0.3412, green: 0.3922, blue: 0.4, alpha: 1),
                property: KitColor(hex: "#1D6498", red: 0.1137, green: 0.3922, blue: 0.5961, alpha: 1),
                type: KitColor(hex: "#795C00", red: 0.4745, green: 0.3608, blue: 0, alpha: 1),
                function: KitColor(hex: "#1D6498", red: 0.1137, green: 0.3922, blue: 0.5961, alpha: 1),
            ),
            hues: [
                KitColor(hex: "#CB4B16", red: 0.7961, green: 0.2941, blue: 0.0863, alpha: 1),
                KitColor(hex: "#2380C2", red: 0.1373, green: 0.502, blue: 0.7608, alpha: 1),
                KitColor(hex: "#6C71C4", red: 0.4235, green: 0.4431, blue: 0.7686, alpha: 1),
                KitColor(hex: "#D33682", red: 0.8275, green: 0.2118, blue: 0.5098, alpha: 1),
                KitColor(hex: "#9A7500", red: 0.6039, green: 0.4588, blue: 0, alpha: 1),
                KitColor(hex: "#238981", red: 0.1373, green: 0.5373, blue: 0.5059, alpha: 1),
                KitColor(hex: "#718200", red: 0.4431, green: 0.5098, blue: 0, alpha: 1),
                KitColor(hex: "#DC322F", red: 0.8627, green: 0.1961, blue: 0.1843, alpha: 1),
            ]
        )),
        KitTheme(id: "catppuccin-latte", label: "Catppuccin Latte", dark: false, palette: KitPalette(
            ground: KitColor(hex: "#E6E9EF", red: 0.902, green: 0.9137, blue: 0.9373, alpha: 1),
            surface: KitColor(hex: "#EFF1F5", red: 0.9373, green: 0.9451, blue: 0.9608, alpha: 1),
            raised: KitColor(hex: "#DCE0E8", red: 0.8627, green: 0.8784, blue: 0.9098, alpha: 1),
            inset: KitColor(hex: "#EAECF1", red: 0.9176, green: 0.9255, blue: 0.9451, alpha: 1),
            border: KitColor(hex: "#64677E2E", red: 0.3922, green: 0.4039, blue: 0.4941, alpha: 0.1804),
            borderStrong: KitColor(hex: "#64677E57", red: 0.3922, green: 0.4039, blue: 0.4941, alpha: 0.3412),
            text: KitColor(hex: "#4C4F69", red: 0.298, green: 0.3098, blue: 0.4118, alpha: 1),
            textBody: KitColor(hex: "#5C5E75", red: 0.3608, green: 0.3686, blue: 0.4588, alpha: 1),
            textMuted: KitColor(hex: "#545764", red: 0.3294, green: 0.3412, blue: 0.3922, alpha: 1),
            textFaint: KitColor(hex: "#60636D", red: 0.3765, green: 0.3882, blue: 0.4275, alpha: 1),
            accent: KitColor(hex: "#6F2FC3", red: 0.4353, green: 0.1843, blue: 0.7647, alpha: 1),
            accentOn: KitColor(hex: "#FFFFFF", red: 1, green: 1, blue: 1, alpha: 1),
            accentSoft: KitColor(hex: "#6F2FC31F", red: 0.4353, green: 0.1843, blue: 0.7647, alpha: 0.1216),
            good: KitColor(hex: "#27631C", red: 0.1529, green: 0.3882, blue: 0.1098, alpha: 1),
            warn: KitColor(hex: "#963A0B", red: 0.5882, green: 0.2275, blue: 0.0431, alpha: 1),
            bad: KitColor(hex: "#AC0C2F", red: 0.6745, green: 0.0471, blue: 0.1843, alpha: 1),
            info: KitColor(hex: "#1850C0", red: 0.0941, green: 0.3137, blue: 0.7529, alpha: 1),
            idle: KitColor(hex: "#545764", red: 0.3294, green: 0.3412, blue: 0.3922, alpha: 1),
            shadow: KitColor(hex: "#00000029", red: 0, green: 0, blue: 0, alpha: 0.1608),
            syntax: KitSyntax(
                keyword: KitColor(hex: "#7E35DC", red: 0.4941, green: 0.2078, blue: 0.8627, alpha: 1),
                string: KitColor(hex: "#2D6F1F", red: 0.1765, green: 0.4353, blue: 0.1216, alpha: 1),
                number: KitColor(hex: "#A9420B", red: 0.6627, green: 0.2588, blue: 0.0431, alpha: 1),
                comment: KitColor(hex: "#60636D", red: 0.3765, green: 0.3882, blue: 0.4275, alpha: 1),
                property: KitColor(hex: "#106D73", red: 0.0627, green: 0.4275, blue: 0.451, alpha: 1),
                type: KitColor(hex: "#885711", red: 0.5333, green: 0.3412, blue: 0.0667, alpha: 1),
                function: KitColor(hex: "#1B5AD9", red: 0.1059, green: 0.3529, blue: 0.851, alpha: 1),
            ),
            hues: [
                KitColor(hex: "#D8540B", red: 0.8471, green: 0.3294, blue: 0.0431, alpha: 1),
                KitColor(hex: "#1E66F5", red: 0.1176, green: 0.4, blue: 0.9608, alpha: 1),
                KitColor(hex: "#8839EF", red: 0.5333, green: 0.2235, blue: 0.9373, alpha: 1),
                KitColor(hex: "#B75C9F", red: 0.7176, green: 0.3608, blue: 0.6235, alpha: 1),
                KitColor(hex: "#AE6F17", red: 0.6824, green: 0.4353, blue: 0.0902, alpha: 1),
                KitColor(hex: "#168C93", red: 0.0863, green: 0.549, blue: 0.5765, alpha: 1),
                KitColor(hex: "#398E25", red: 0.2235, green: 0.5569, blue: 0.1451, alpha: 1),
                KitColor(hex: "#D20F39", red: 0.8235, green: 0.0588, blue: 0.2235, alpha: 1),
            ]
        )),
        KitTheme(id: "gruvbox-light", label: "Gruvbox Light", dark: false, palette: KitPalette(
            ground: KitColor(hex: "#EBDBB2", red: 0.9216, green: 0.8588, blue: 0.698, alpha: 1),
            surface: KitColor(hex: "#FBF1C7", red: 0.9843, green: 0.9451, blue: 0.7804, alpha: 1),
            raised: KitColor(hex: "#E3D2A6", red: 0.8902, green: 0.8235, blue: 0.651, alpha: 1),
            inset: KitColor(hex: "#F1E4BA", red: 0.9451, green: 0.8941, blue: 0.7294, alpha: 1),
            border: KitColor(hex: "#564F492E", red: 0.3373, green: 0.3098, blue: 0.2863, alpha: 0.1804),
            borderStrong: KitColor(hex: "#564F4957", red: 0.3373, green: 0.3098, blue: 0.2863, alpha: 0.3412),
            text: KitColor(hex: "#3C3836", red: 0.2353, green: 0.2196, blue: 0.2118, alpha: 1),
            textBody: KitColor(hex: "#534E47", red: 0.3255, green: 0.3059, blue: 0.2784, alpha: 1),
            textMuted: KitColor(hex: "#545045", red: 0.3294, green: 0.3137, blue: 0.2706, alpha: 1),
            textFaint: KitColor(hex: "#60564E", red: 0.3765, green: 0.3373, blue: 0.3059, alpha: 1),
            accent: KitColor(hex: "#8F3003", red: 0.5608, green: 0.1882, blue: 0.0118, alpha: 1),
            accentOn: KitColor(hex: "#FFFFFF", red: 1, green: 1, blue: 1, alpha: 1),
            accentSoft: KitColor(hex: "#8F30031F", red: 0.5608, green: 0.1882, blue: 0.0118, alpha: 0.1216),
            good: KitColor(hex: "#54510C", red: 0.3294, green: 0.3176, blue: 0.0471, alpha: 1),
            warn: KitColor(hex: "#8F3003", red: 0.5608, green: 0.1882, blue: 0.0118, alpha: 1),
            bad: KitColor(hex: "#9D0006", red: 0.6157, green: 0, blue: 0.0235, alpha: 1),
            info: KitColor(hex: "#075666", red: 0.0275, green: 0.3373, blue: 0.4, alpha: 1),
            idle: KitColor(hex: "#545045", red: 0.3294, green: 0.3137, blue: 0.2706, alpha: 1),
            shadow: KitColor(hex: "#00000029", red: 0, green: 0, blue: 0, alpha: 0.1608),
            syntax: KitSyntax(
                keyword: KitColor(hex: "#9D0006", red: 0.6157, green: 0, blue: 0.0235, alpha: 1),
                string: KitColor(hex: "#5F5B0C", red: 0.3725, green: 0.3569, blue: 0.0471, alpha: 1),
                number: KitColor(hex: "#893C6C", red: 0.5373, green: 0.2353, blue: 0.4235, alpha: 1),
                comment: KitColor(hex: "#60564E", red: 0.3765, green: 0.3373, blue: 0.3059, alpha: 1),
                property: KitColor(hex: "#076273", red: 0.0275, green: 0.3843, blue: 0.451, alpha: 1),
                type: KitColor(hex: "#7E510C", red: 0.4941, green: 0.3176, blue: 0.0471, alpha: 1),
                function: KitColor(hex: "#366448", red: 0.2118, green: 0.3922, blue: 0.2824, alpha: 1),
            ),
            hues: [
                KitColor(hex: "#AF3A03", red: 0.6863, green: 0.2275, blue: 0.0118, alpha: 1),
                KitColor(hex: "#076678", red: 0.0275, green: 0.4, blue: 0.4706, alpha: 1),
                KitColor(hex: "#8F3F71", red: 0.5608, green: 0.2471, blue: 0.4431, alpha: 1),
                KitColor(hex: "#8F3F71", red: 0.5608, green: 0.2471, blue: 0.4431, alpha: 1),
                KitColor(hex: "#A06811", red: 0.6275, green: 0.4078, blue: 0.0667, alpha: 1),
                KitColor(hex: "#427B58", red: 0.2588, green: 0.4824, blue: 0.3451, alpha: 1),
                KitColor(hex: "#79740E", red: 0.4745, green: 0.4549, blue: 0.0549, alpha: 1),
                KitColor(hex: "#9D0006", red: 0.6157, green: 0, blue: 0.0235, alpha: 1),
            ]
        )),
    ]

    enum TypeScale {
        static let xs: CGFloat = 18
        static let sm: CGFloat = 19
        static let base: CGFloat = 20
        static let md: CGFloat = 21
        static let lg: CGFloat = 23
        static let xl: CGFloat = 27
        static let xxl: CGFloat = 33
        static let xxxl: CGFloat = 40
    }

    enum Space {
        static let s1: CGFloat = 2
        static let s2: CGFloat = 4
        static let s3: CGFloat = 6
        static let s4: CGFloat = 8
        static let s5: CGFloat = 12
        static let s6: CGFloat = 16
        static let s7: CGFloat = 24
        static let s8: CGFloat = 32
    }

    enum Radius {
        static let sm: CGFloat = 4
        static let md: CGFloat = 8
        static let lg: CGFloat = 12
        static let pill: CGFloat = 999
    }

    enum Layout {
        static let tileHeader: CGFloat = 34
        static let statusLine: CGFloat = 36
        static let tileGap: CGFloat = 6
        static let focusRing: CGFloat = 1
    }

    /// Seconds, for SwiftUI animations.
    enum Motion {
        static let fast: Double = 0.12
        static let base: Double = 0.18
        static let slow: Double = 0.32
    }
}
