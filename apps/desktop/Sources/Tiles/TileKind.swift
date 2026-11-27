import SwiftUI
import Combine

/// What a tile shows. One subclass per tile kind. The shell owns the
/// window and the header; the content owns the body and its own actions.
@MainActor
class TileContent: ObservableObject {
    let kindId: String
    /// Who the tile belongs to: `luca:<project>` for a workbench tool
    /// (`ProjectHub.ownerId`), `app` for the app's own files. Solo, colors
    /// and workspace names go by it.
    let owner: String
    /// The tile's address. A kind may change it (a new chat gets its
    /// conversation id), and the shell saves the new one.
    @Published var uri: TileURI
    @Published var title: String
    /// Short state for the header: `starting host`, `modified`, `exited 0`.
    @Published var stateLabel: String?
    let hints = HintRegistry()
    /// The tile's id, set by the shell when the tile opens.
    var tileId = UUID()

    init(kindId: String, uri: TileURI, owner: String, title: String) {
        self.kindId = kindId
        self.uri = uri
        self.owner = owner
        self.title = title
    }

    /// The body, built once so SwiftUI keeps its state.
    lazy var body: AnyView = makeBody()

    func makeBody() -> AnyView { AnyView(EmptyView()) }

    /// Run a key action for this kind (`lucaChat.stop`). False if not ours.
    func perform(_ action: String) -> Bool { false }

    /// `Esc` left Insert mode in this tile: a text field lost the keyboard.
    func didLeaveInsert() {}

    /// True while an editor inside the tile that is not an `NSTextView` (the
    /// source editor's web view, the terminal) has the keyboard. The shell
    /// treats it as Insert mode, and never lets a `Mod` key reach it.
    var editorHasKeyboard: Bool { false }

    /// The theme kit bridge of a web tile (a page). The shell sends it page
    /// keys, and the keys view lists them. Nil for native tiles.
    var webHost: WebTileHost? { nil }

    /// Keys a project's tool declared for this tile (`ToolKeys`), already
    /// checked against the app's own. The shell routes them in Normal mode
    /// and the keys view lists them.
    var declaredKeys: [DeclaredKey] { [] }

    /// One of `declaredKeys` was pressed.
    func pressDeclared(_ key: DeclaredKey) {}

    /// True when `Esc` should reach the tile's editor instead of the shell.
    func passesEscape() -> Bool { false }

    /// A check run's `type:<text>` with this tile in focus and no window
    /// holding the keyboard. True when the tile took the text.
    func typeForCheck(_ text: String) -> Bool { false }

    /// A `:` command for this tile (`:w`). False if not ours.
    func runCommand(_ verb: String, _ rest: String) -> Bool { false }

    /// `Cmd-V` with this tile in focus. True when the tile used the
    /// pasteboard, so the text field never sees it.
    func paste(_ pasteboard: NSPasteboard) -> Bool { false }

    /// Called once when the tile opens.
    func start() {}

    /// Called once when the tile closes.
    func stop() {}
}

/// A tile kind: a title, a glyph, a view (through its content) and its key
/// bindings (scope `kind.<id>` in the keymap).
struct TileKind {
    let id: String
    let label: String
    /// SF Symbol name.
    let glyph: String
    let make: @MainActor (TileURI, String) -> TileContent
}

@MainActor
enum TileKinds {
    private(set) static var all: [String: TileKind] = [:]

    static func register(_ kind: TileKind) {
        all[kind.id] = kind
    }

    static func kind(_ id: String) -> TileKind? { all[id] }

    /// Every kind the app has: the workbench tools (`luca://`), and the
    /// app's own file tile (`app://`).
    static func registerBuiltIns() {
        register(ProjectOverviewContent.kind)
        register(RegistryContent.kind)
        register(HelperContent.kind)
        register(ConsoleContent.kind)
        register(CommandContent.kind)
        register(ChangeContent.kind)
        register(PluginsContent.kind)
        register(EndpointsContent.kind)
        register(ServersContent.kind)
        register(AiContent.kind)
        register(RequestContent.kind)
        register(LucaDocsContent.kind)
        register(ModelsContent.kind)
        register(ContentbaseContent.kind)
        register(WorkbenchDocContent.kind)
        register(AssistantsContent.kind)
        register(AssistantEditorContent.kind)
        register(WorkbenchChatContent.kind)
        register(TerminalContent.kind)
        register(FileContent.kind)
        register(FileContent.appKind)
        register(PageContent.kind)
        register(CanvasContent.kind)
        register(ToolContent.kind)
        register(ProjectsContent.kind)
    }

    /// The kind an address opens: `luca://` tools are `luca-<tool>`,
    /// `app://` ones `app-<kind>`.
    static func kind(for uri: TileURI) -> TileKind? { all[uri.kindKey] }
}

/// One open tile: an address, its content and its window.
@MainActor
final class Tile: Identifiable {
    let id: UUID
    let content: TileContent
    var controller: TileWindowController?

    var owner: String { content.owner }
    var uri: TileURI { content.uri }
    var kind: TileKind? { TileKinds.kind(content.kindId) }

    init(id: UUID, content: TileContent) {
        self.id = id
        self.content = content
        content.tileId = id
    }
}
