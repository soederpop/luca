import XCTest
@testable import LucaDesktop

@MainActor
final class ThemeTests: XCTestCase {
    override func tearDown() async throws {
        await MainActor.run { ThemeSettings.shared.set(.dark) }
    }

    func testANamedThemeSwapsThePaletteAndReachesPages() throws {
        let settings = ThemeSettings.shared
        let monokai = try XCTUnwrap(KitTokens.themes.first { $0.id == "monokai" })
        let before = settings.revision

        XCTAssertTrue(settings.setTheme("monokai"))
        XCTAssertEqual(Theme.palette, monokai.palette)
        XCTAssertGreaterThan(settings.revision, before)

        let host = settings.hostTheme()
        XCTAssertEqual(host["theme"] as? String, "monokai")
        let vars = try XCTUnwrap(host["vars"] as? [String: String])
        XCTAssertEqual(vars["--al-surface"], monokai.palette.surface.hex)
        XCTAssertEqual(vars["--al-syntax-keyword"], monokai.palette.syntax.keyword.hex)
    }

    func testALightThemeSetsTheSchemeAndASchemeLeavesTheTheme() {
        let settings = ThemeSettings.shared
        XCTAssertTrue(settings.setTheme("solarized-light"))
        XCTAssertFalse(settings.isDark)
        XCTAssertEqual(settings.hostTheme()["scheme"] as? String, "light")

        settings.set(.dark)
        XCTAssertNil(settings.themeId)
        XCTAssertEqual(Theme.palette, KitTokens.dark)
    }

    func testAnUnknownNameChangesNothing() {
        let settings = ThemeSettings.shared
        settings.setTheme("nord")
        XCTAssertFalse(settings.setTheme("no-such-theme"))
        XCTAssertEqual(settings.themeId, "nord")
    }

    func testThemeNamesAreTypeable() {
        let ids = KitTokens.themes.map(\.id)
        XCTAssertGreaterThanOrEqual(ids.count, 6)
        XCTAssertEqual(Set(ids).count, ids.count)
        for id in ids { XCTAssertNotNil(id.range(of: "^[a-z0-9-]+$", options: .regularExpression), id) }
    }
}
