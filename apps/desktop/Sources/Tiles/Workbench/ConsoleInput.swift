import SwiftUI
import AppKit

/// A key the console's input offers to its tile before the text view uses it.
enum ConsoleInputKey {
    case enter, tab, up, down, escape, complete
}

/// The text view of the console's input: plain code, no smart quotes, and
/// its keys go to the tile first.
final class ConsoleTextView: NSTextView {
    var onKey: ((ConsoleInputKey) -> Bool)?
    var onFocus: ((Bool) -> Void)?

    override func keyDown(with event: NSEvent) {
        let flags = event.modifierFlags.intersection(.deviceIndependentFlagsMask).subtracting([.numericPad, .function, .capsLock])
        var key: ConsoleInputKey?
        switch event.keyCode {
        case 36, 76: if flags.isEmpty { key = .enter }
        case 48: if flags.isEmpty { key = .tab }
        case 126: if flags.isEmpty { key = .up }
        case 125: if flags.isEmpty { key = .down }
        case 53: key = .escape
        case 49: if flags == .control { key = .complete }
        default:
            // Ctrl-N and Ctrl-P move in the list, as they do in a shell.
            if flags == .control, event.charactersIgnoringModifiers == "n" { key = .down }
            if flags == .control, event.charactersIgnoringModifiers == "p" { key = .up }
        }
        if let key, onKey?(key) == true { return }
        super.keyDown(with: event)
    }

    override func cancelOperation(_ sender: Any?) {
        _ = onKey?(.escape)
    }

    override func becomeFirstResponder() -> Bool {
        let ok = super.becomeFirstResponder()
        if ok { onFocus?(true) }
        return ok
    }

    override func resignFirstResponder() -> Bool {
        let ok = super.resignFirstResponder()
        if ok { onFocus?(false) }
        return ok
    }
}

/// The console's input: a code editor of one to ten lines, colored as
/// TypeScript. The tile's model holds the text and the caret; this view
/// reports every change and takes back what the model sets (a recalled
/// entry, an accepted completion).
struct ConsoleInputView: NSViewRepresentable {
    @ObservedObject var model: ConsoleContent

    static let fontSize = KitTokens.TypeScale.sm
    static var font: NSFont { .monospacedSystemFont(ofSize: fontSize, weight: .regular) }
    static var lineHeight: CGFloat { ceil(NSLayoutManager().defaultLineHeight(for: font)) }

    func makeCoordinator() -> Coordinator { Coordinator(model: model) }

    func makeNSView(context: Context) -> NSScrollView {
        let scroll = NSScrollView()
        scroll.drawsBackground = false
        scroll.hasVerticalScroller = false
        scroll.hasHorizontalScroller = false
        scroll.borderType = .noBorder

        let view = ConsoleTextView()
        view.delegate = context.coordinator
        view.isRichText = false
        view.allowsUndo = true
        view.drawsBackground = false
        view.font = Self.font
        view.textContainerInset = .zero
        view.textContainer?.lineFragmentPadding = 0
        view.textContainer?.widthTracksTextView = true
        view.isVerticallyResizable = true
        view.isHorizontallyResizable = false
        view.autoresizingMask = [.width]
        // Code, not prose: nothing may rewrite what was typed.
        view.isAutomaticQuoteSubstitutionEnabled = false
        view.isAutomaticDashSubstitutionEnabled = false
        view.isAutomaticTextReplacementEnabled = false
        view.isAutomaticSpellingCorrectionEnabled = false
        view.isContinuousSpellCheckingEnabled = false
        view.isGrammarCheckingEnabled = false
        view.isAutomaticTextCompletionEnabled = false
        view.isAutomaticLinkDetectionEnabled = false
        view.smartInsertDeleteEnabled = false
        view.onKey = { [weak coordinator = context.coordinator] key in coordinator?.model.inputKey(key) ?? false }
        view.onFocus = { [weak coordinator = context.coordinator] on in
            DispatchQueue.main.async { coordinator?.model.inputFocused = on }
        }
        scroll.documentView = view
        context.coordinator.view = view
        context.coordinator.adopt(text: model.draft, caret: model.caret)
        return scroll
    }

    func updateNSView(_ scroll: NSScrollView, context: Context) {
        let coordinator = context.coordinator
        guard let view = coordinator.view else { return }
        if coordinator.pushSeen != model.push {
            coordinator.pushSeen = model.push
            coordinator.adopt(text: model.draft, caret: model.caret)
        }
        if coordinator.focusSeen != model.inputTick {
            coordinator.focusSeen = model.inputTick
            DispatchQueue.main.async { view.window?.makeFirstResponder(view) }
        }
        if coordinator.paletteSeen != Theme.palette {
            coordinator.recolor()
        }
    }

    @MainActor
    final class Coordinator: NSObject, NSTextViewDelegate {
        let model: ConsoleContent
        weak var view: ConsoleTextView?
        var pushSeen = 0
        var focusSeen = 0
        var paletteSeen: KitPalette?
        /// True while the model's text is being put in the view, so the
        /// view's own change notes are not sent back.
        private var adopting = false

        init(model: ConsoleContent) {
            self.model = model
            pushSeen = model.push
            focusSeen = model.inputTick
        }

        /// Put the model's text and caret in the view.
        func adopt(text: String, caret: Int) {
            guard let view else { return }
            adopting = true
            if view.string != text { view.string = text }
            let length = (text as NSString).length
            view.setSelectedRange(NSRange(location: min(max(caret, 0), length), length: 0))
            adopting = false
            recolor()
            measure()
        }

        func textDidChange(_ notification: Notification) {
            guard !adopting, let view else { return }
            recolor()
            measure()
            model.inputChanged(text: view.string, caret: view.selectedRange().location, edited: true)
        }

        func textViewDidChangeSelection(_ notification: Notification) {
            guard !adopting, let view else { return }
            measure()
            // An edit reports itself; this is the caret moving on its own.
            if view.string == model.draft, view.selectedRange().location != model.caret {
                model.inputChanged(text: view.string, caret: view.selectedRange().location, edited: false)
            }
        }

        /// Color the code. The colors are the source editor's.
        func recolor() {
            guard let view, let storage = view.textStorage else { return }
            let palette = Theme.palette
            paletteSeen = palette
            let whole = NSRange(location: 0, length: storage.length)
            view.insertionPointColor = RichEditorTheme.ns(palette.accent)
            view.selectedTextAttributes = [.backgroundColor: RichEditorTheme.ns(palette.accent, alpha: 0.28)]
            view.typingAttributes = [.font: ConsoleInputView.font, .foregroundColor: RichEditorTheme.ns(palette.text)]
            storage.beginEditing()
            storage.setAttributes([.font: ConsoleInputView.font, .foregroundColor: RichEditorTheme.ns(palette.text)], range: whole)
            if let runs = CodeHighlighter.shared.runs(code: view.string, language: "typescript") {
                for run in runs where run.role != .plain && NSMaxRange(run.range) <= storage.length {
                    storage.addAttribute(.foregroundColor, value: RichEditorTheme.ns(run.role.kitColor(palette)), range: run.range)
                }
            }
            storage.endEditing()
        }

        /// Tell the model how tall the text is and where the caret is, so
        /// the input grows and the list opens under the name being typed.
        func measure() {
            guard let view, let layout = view.layoutManager, let container = view.textContainer else { return }
            layout.ensureLayout(for: container)
            let line = ConsoleInputView.lineHeight
            let lines = max(1, Int((layout.usedRect(for: container).height / line).rounded()))
            // A text that ends in a new line has one more, empty, line.
            let extra = view.string.hasSuffix("\n") ? 1 : 0
            let height = CGFloat(min(lines + extra, 10)) * line
            var x: CGFloat = 0
            let caret = view.selectedRange().location
            if caret > 0, layout.numberOfGlyphs > 0 {
                let glyph = layout.glyphIndexForCharacter(at: min(caret, view.string.utf16.count) - 1)
                let rect = layout.boundingRect(forGlyphRange: NSRange(location: glyph, length: 1), in: container)
                x = view.string.utf16.count >= caret && (view.string as NSString).substring(with: NSRange(location: caret - 1, length: 1)) == "\n" ? 0 : rect.maxX
            }
            if abs(model.inputHeight - height) > 0.5 || abs(model.caretX - x) > 0.5 {
                DispatchQueue.main.async { [model] in
                    model.inputHeight = height
                    model.caretX = x
                }
            }
        }
    }
}
