import AppKit

// Top-level code runs on the main thread; say so to the compiler.
MainActor.assumeIsolated { TilesMain.run() }
