// swift-tools-version: 5.10
import PackageDescription

// Luca Desktop: the keyboard-first workbench for any Luca project folder.
// Every resource is a tile, and a tile is its own window. It talks only to
// the project's workbench host (`luca workbench`).
let package = Package(
    name: "LucaDesktop",
    platforms: [
        .macOS("15.4")
    ],
    products: [
        .executable(name: "LucaDesktop", targets: ["LucaDesktop"])
    ],
    dependencies: [
        .package(url: "https://github.com/gonzalezreal/swift-markdown-ui.git", from: "2.4.0"),
        // Pinned to the current app's version; 1.99 does not build with this toolchain.
        .package(url: "https://github.com/migueldeicaza/SwiftTerm.git", exact: "1.11.2"),
        // The rich doc editor: the core of nodes-app/swift-markdown-engine
        // 0.16.0, kept in Vendor/ with a fence parsing fix. It has no
        // dependencies and no resources.
        .package(path: "Vendor/swift-markdown-engine"),
        // Layout files (~/.luca/desktop/layouts/*.yml). A real
        // parser, so a broken file reports its line instead of half loading.
        .package(url: "https://github.com/jpsim/Yams.git", exact: "5.1.3")
    ],
    targets: [
        .executableTarget(
            name: "LucaDesktop",
            dependencies: [
                .product(name: "MarkdownUI", package: "swift-markdown-ui"),
                "SwiftTerm",
                .product(name: "MarkdownEngine", package: "swift-markdown-engine"),
                "Yams"
            ],
            path: "Sources"
        ),
        .testTarget(
            name: "LucaDesktopTests",
            dependencies: ["LucaDesktop"],
            path: "Tests/LucaDesktopTests"
        )
    ]
)
