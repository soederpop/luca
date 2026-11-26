import AppKit
import SwiftUI

/// A tile's window: borderless, resizable from its edges, no title bar.
final class TileWindow: NSWindow {
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { true }
}

/// Owns one tile window and tells the shell what the user did to it.
@MainActor
final class TileWindowController: NSObject, NSWindowDelegate {
    let tileId: UUID
    let window: TileWindow
    /// True while the shell sets the frame, so the move is not read as a drag.
    private var applying = false

    init(tile: Tile, frame: CGRect) {
        tileId = tile.id
        window = TileWindow(contentRect: frame, styleMask: [.borderless, .resizable], backing: .buffered, defer: false)
        super.init()
        window.isReleasedWhenClosed = false
        window.isOpaque = false
        window.backgroundColor = .clear
        window.hasShadow = true
        window.minSize = CGSize(width: 220, height: 120)
        window.collectionBehavior = [.managed, .fullScreenNone]
        window.delegate = self
        if AppFocus.quiet { window.level = AppFocus.level(.normal) }
        window.setFrame(frame, display: false)
        let root = TileChromeView(tile: tile, content: tile.content, hints: tile.content.hints)
            .environmentObject(Shell.shared)
            .environmentObject(KeymapStore.shared)
            .environmentObject(ProjectHub.shared)
        window.contentView = NSHostingView(rootView: root)
    }

    func setFrame(_ frame: CGRect, animated: Bool) {
        guard window.frame != frame else { return }
        applying = true
        if animated && window.isVisible {
            NSAnimationContext.runAnimationGroup({ context in
                context.duration = KitTokens.Motion.fast
                context.allowsImplicitAnimation = true
                window.animator().setFrame(frame, display: true)
            }, completionHandler: { [weak self] in
                MainActor.assumeIsolated { self?.applying = false }
            })
        } else {
            window.setFrame(frame, display: true)
            applying = false
        }
    }

    func close() {
        window.delegate = nil
        window.orderOut(nil)
        window.contentView = nil
        window.close()
    }

    // MARK: NSWindowDelegate

    func windowDidMove(_ notification: Notification) {
        guard !applying else { return }
        Shell.shared.tileWindowMoved(tileId, frame: window.frame)
    }

    func windowDidResize(_ notification: Notification) {
        guard !applying else { return }
        Shell.shared.tileWindowMoved(tileId, frame: window.frame)
    }

    func windowDidEndLiveResize(_ notification: Notification) {
        Shell.shared.tileWindowEndedResize(tileId)
    }

    func windowDidBecomeKey(_ notification: Notification) {
        Shell.shared.tileDidBecomeKey(tileId)
    }

    // MARK: Keyboard scrolling

    /// The biggest scroll view in the tile: the transcript, the document.
    func mainScrollView() -> NSScrollView? {
        func all(_ view: NSView) -> [NSScrollView] {
            view.subviews.flatMap { sub -> [NSScrollView] in
                (sub as? NSScrollView).map { [$0] + all(sub) } ?? all(sub)
            }
        }
        guard let root = window.contentView else { return nil }
        return all(root)
            .filter { $0.documentView != nil }
            .max { $0.bounds.width * $0.bounds.height < $1.bounds.width * $1.bounds.height }
    }

    enum ScrollMove { case lines(Int), halfPages(Int), top, bottom }

    func scroll(_ move: ScrollMove) {
        guard let scrollView = mainScrollView(), let document = scrollView.documentView else { return }
        let clip = scrollView.contentView
        let visible = clip.bounds.height
        let maxOffset = max(0, document.frame.height - visible)
        // Offset from the top, whichever way the document view is flipped.
        let fromTop = document.isFlipped ? clip.bounds.origin.y : maxOffset - clip.bounds.origin.y
        let target: CGFloat
        switch move {
        case .lines(let n): target = fromTop + CGFloat(n) * 48
        case .halfPages(let n): target = fromTop + CGFloat(n) * visible / 2
        case .top: target = 0
        case .bottom: target = maxOffset
        }
        let clamped = min(max(0, target), maxOffset)
        var origin = clip.bounds.origin
        origin.y = document.isFlipped ? clamped : maxOffset - clamped
        clip.scroll(to: origin)
        scrollView.reflectScrolledClipView(clip)
    }
}

/// The header is the drag handle. A drag that ends over another tile in
/// organized mode swaps or splits there.
struct TileDragHandle: NSViewRepresentable {
    let tileId: UUID

    final class HandleView: NSView {
        var tileId = UUID()

        override func mouseDown(with event: NSEvent) {
            guard let window else { return }
            window.makeKeyAndOrderFront(nil)
            if event.clickCount == 2 {
                MainActor.assumeIsolated { Shell.shared.perform("layout.zoom", count: nil) }
                return
            }
            let dragged = tileId
            MainActor.assumeIsolated { Shell.shared.tileDragWillBegin(dragged) }
            window.performDrag(with: event)
            // performDrag returns after the mouse is up.
            let id = tileId
            MainActor.assumeIsolated { Shell.shared.tileDragEnded(id, at: NSEvent.mouseLocation) }
        }

        override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }
    }

    func makeNSView(context: Context) -> HandleView {
        let view = HandleView()
        view.tileId = tileId
        return view
    }

    func updateNSView(_ view: HandleView, context: Context) {
        view.tileId = tileId
    }
}
