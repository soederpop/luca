import Foundation
import OSLog

/// The app's log: the unified log and `logs/luca-desktop.log` under the app
/// folder (`TilesPaths.log`, so `LUCA_DESKTOP_HOME` moves it too).
enum AppLogger {
    private static let logger = Logger(subsystem: "com.soederpop.luca.desktop", category: "app")
    private static let queue = DispatchQueue(label: "luca.desktop.logger.file", qos: .utility)

    static func info(_ message: String) {
        logger.info("\(message, privacy: .public)")
        appendToFile("INFO", message)
    }

    static func error(_ message: String) {
        logger.error("\(message, privacy: .public)")
        appendToFile("ERROR", message)
    }

    private static func appendToFile(_ level: String, _ message: String) {
        queue.sync {
            let line = "[\(ISO8601DateFormatter().string(from: Date()))] [\(level)] \(message)\n"
            guard let data = line.data(using: .utf8) else { return }
            let url = TilesPaths.log
            do {
                try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
                if !FileManager.default.fileExists(atPath: url.path) {
                    FileManager.default.createFile(atPath: url.path, contents: nil)
                }
                let handle = try FileHandle(forWritingTo: url)
                defer { try? handle.close() }
                try handle.seekToEnd()
                try handle.write(contentsOf: data)
            } catch {
                logger.error("failed to write log file: \(error.localizedDescription, privacy: .public)")
            }
        }
    }
}
