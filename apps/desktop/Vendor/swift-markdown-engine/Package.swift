// swift-tools-version: 5.9
import PackageDescription

// The core of nodes-app/swift-markdown-engine 0.16.0, kept in this repo so
// Luca Desktop can carry a parser fix. See VENDORED.md before you change a file.
let package = Package(
    name: "MarkdownEngine",
    platforms: [.macOS(.v14)],
    products: [
        .library(name: "MarkdownEngine", targets: ["MarkdownEngine"])
    ],
    targets: [
        .target(name: "MarkdownEngine"),
        .testTarget(name: "MarkdownEngineTests", dependencies: ["MarkdownEngine"])
    ]
)
