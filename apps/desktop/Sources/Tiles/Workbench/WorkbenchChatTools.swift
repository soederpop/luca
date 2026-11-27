import Foundation

/// `t` and `s` of a chat tile. The picker sends the whole new list with
/// `POST /chat/extensions`; the header redraws from the host's
/// `chat-extensions` frame, so a change the tech support chat makes shows
/// here too. Building the tools is the host's job.
extension WorkbenchChatContent {
    static let supportAssistant = "lucaArchitect"

    /// Container features with tools. Ones the assistant has already show as
    /// built in. Picking one that is on opens its settings.
    func chooseTools() {
        guard let host else { return Shell.shared.flash("The workbench host is not running") }
        guard conversationId != "new" else { return Shell.shared.flash("Still opening the chat") }
        let assistant = assistant, id = conversationId
        Task { [weak self] in
            do {
                let view = try await host.chatExtensions(assistant: assistant, conversationId: id)
                let on = Set(view.extensions.map(\.feature))
                var choices = view.features.map { feature in
                    let mark = on.contains(feature.name) ? "✓ " : (feature.isBuiltIn ? "• " : "  ")
                    let detail = feature.isBuiltIn ? "built in · \(feature.description)" : "\(feature.tools.count) tool\(feature.tools.count == 1 ? "" : "s") · \(feature.description)"
                    return PaletteChoice(title: mark + feature.name, detail: detail) {
                        if on.contains(feature.name) {
                            self?.configure(feature, view.extensions)
                        } else if feature.isBuiltIn {
                            Shell.shared.flash("\(assistant) already has \(feature.name)")
                        } else {
                            let list = view.extensions + [WorkbenchChatExtension(feature: feature.name)]
                            self?.save(list, note: "Added \(feature.name). The next message has its tools.") {
                                if feature.tools.count > 1 || !feature.options.isEmpty { self?.configure(feature, list) }
                            }
                        }
                    }
                }
                // Invented sets are not features: they show so they can be removed.
                for entry in view.extensions where entry.isInvented {
                    choices.insert(PaletteChoice(title: "✓ " + entry.feature, detail: "invented in tech support · \(entry.description ?? "")") {
                        PaletteController.shared.confirm("Remove \(entry.feature) from this chat?", yes: "Remove") {
                            self?.save(view.extensions.filter { $0.feature != entry.feature }, note: "Removed \(entry.feature)")
                        }
                    }, at: 0)
                }
                choices.append(PaletteChoice(title: "  Ask tech support…", detail: "\(Self.supportAssistant) adds or writes tools for this chat") {
                    self?.openSupport()
                })
                PaletteController.shared.choose("Tools for this chat", choices)
            } catch {
                Shell.shared.flash(ErrorText.message(error))
            }
        }
    }

    /// A header chip's click: that extension's settings.
    func configure(_ featureName: String) {
        guard let host, conversationId != "new" else { return }
        let assistant = assistant, id = conversationId
        Task { [weak self] in
            do {
                let view = try await host.chatExtensions(assistant: assistant, conversationId: id)
                if let feature = view.features.first(where: { $0.name == featureName }) {
                    self?.configure(feature, view.extensions)
                } else {
                    self?.chooseTools()
                }
            } catch {
                Shell.shared.flash(ErrorText.message(error))
            }
        }
    }

    /// Send the list. `then` runs once the host took it.
    func save(_ list: [WorkbenchChatExtension], note: String, then: (() -> Void)? = nil) {
        guard let host else { return Shell.shared.flash("The workbench host is not running") }
        let assistant = assistant, id = conversationId
        Task {
            do {
                let saved = try await host.setChatExtensions(assistant: assistant, conversationId: id, extensions: list)
                guard saved.ok == true else { return Shell.shared.flash(saved.error ?? "The host refused the change") }
                Shell.shared.flash(note)
                then?()
            } catch {
                Shell.shared.flash(ErrorText.message(error))
            }
        }
    }

    /// One added feature's settings: which tools, the folder they are held
    /// to, and each option that is one plain value. `list` is the list last
    /// sent. Every change is sent at once, then this list opens again.
    private func configure(_ feature: WorkbenchChatExtensions.Feature, _ list: [WorkbenchChatExtension]) {
        guard let entry = list.first(where: { $0.feature == feature.name }) else { return }
        let update: (WorkbenchChatExtension, String) -> Void = { [weak self] next, note in
            let updated = list.map { $0.feature == feature.name ? next : $0 }
            self?.save(updated, note: note) { self?.configure(feature, updated) }
        }
        let back: () -> Void = { [weak self] in self?.configure(feature, list) }

        var choices = [PaletteChoice(title: "  Done", detail: "the next message has these settings") {}]
        let only = entry.only ?? []
        choices.append(PaletteChoice(title: "  tools: " + (only.isEmpty ? "all \(feature.tools.count)" : only.joined(separator: ", ")), detail: "choose which tools to add") { [weak self] in
            self?.chooseOnly(feature, entry, update: update, back: back)
        })
        choices.append(PaletteChoice(title: "  folder: " + (entry.folder ?? "none"), detail: "hold every path to this folder") {
            Self.editText("folder for \(feature.name)", current: entry.folder, clear: { update(entry.with(folder: nil), "Folder cleared") }, back: back) { text in
                update(entry.with(folder: text), "Folder set")
            }
        })
        for option in feature.options {
            let value = entry.options?[option.name]
            let shown = value.map(Self.display) ?? option.default.map { "default \(Self.display($0))" } ?? "not set"
            choices.append(PaletteChoice(title: "  \(option.name): \(shown)", detail: Self.optionDetail(option)) {
                Self.editOption(option, value: value, back: back) { next in
                    update(entry.with(option: option.name, next), next == nil ? "\(option.name) cleared" : "\(option.name) set")
                }
            })
        }
        choices.append(PaletteChoice(title: "  Remove \(feature.name)", detail: "take these tools off this chat") { [weak self] in
            self?.save(list.filter { $0.feature != feature.name }, note: "Removed \(feature.name)")
        })
        PaletteController.shared.choose("\(feature.name) settings", choices)
    }

    private func chooseOnly(_ feature: WorkbenchChatExtensions.Feature, _ entry: WorkbenchChatExtension, update: @escaping (WorkbenchChatExtension, String) -> Void, back: @escaping () -> Void) {
        let only = entry.only ?? []
        var choices = [PaletteChoice(title: (only.isEmpty ? "✓ " : "  ") + "All tools", detail: "\(feature.tools.count) tools") {
            update(entry.with(only: nil), "All \(feature.name) tools")
        }]
        for tool in feature.tools {
            let picked = only.contains(tool.name)
            let detail = tool.builtIn == true ? "built in · \(tool.description)" : tool.description
            choices.append(PaletteChoice(title: (picked ? "✓ " : "  ") + tool.name, detail: detail) {
                // Keep the feature's order, so the list reads the same each time.
                let next = feature.tools.map(\.name).filter { $0 == tool.name ? !picked : only.contains($0) }
                update(entry.with(only: next), picked ? "Removed \(tool.name)" : "Added \(tool.name)")
            })
        }
        choices.append(PaletteChoice(title: "  Back", detail: "") { back() })
        PaletteController.shared.choose("\(feature.name) tools", choices)
    }

    /// Booleans and fixed lists are picked; text and numbers are typed.
    private static func editOption(_ option: WorkbenchChatExtensions.Feature.Option, value: JSONValue?, back: @escaping () -> Void, set: @escaping (JSONValue?) -> Void) {
        let fixed: [JSONValue]? = option.type == "boolean" ? [.bool(true), .bool(false)] : option.enum?.map(JSONValue.string)
        if let fixed {
            var choices = fixed.map { item in
                PaletteChoice(title: (item == value ? "✓ " : "  ") + display(item), detail: item == option.default ? "default" : "") { set(item) }
            }
            choices.append(PaletteChoice(title: (value == nil ? "✓ " : "  ") + "Not set", detail: option.default.map { "use the default, \(display($0))" } ?? "use the feature's own") { set(nil) })
            PaletteController.shared.choose(option.name, choices)
            return
        }
        editText("\(option.name) (\(option.type))", current: value.map(display), clear: { set(nil) }, back: back) { text in
            guard let parsed = option.parse(text) else {
                Shell.shared.flash("\(option.name) needs \(optionDetail(option, short: true))")
                return back()
            }
            set(parsed)
        }
    }

    /// An empty answer does nothing in the palette, so a value that is set
    /// offers Change or Clear first.
    private static func editText(_ title: String, current: String?, clear: @escaping () -> Void, back: @escaping () -> Void, set: @escaping (String) -> Void) {
        let ask = { PaletteController.shared.ask(title, initial: current ?? "", onAnswer: set) }
        guard let current, !current.isEmpty else { return ask() }
        PaletteController.shared.choose(title, [
            PaletteChoice(title: "Change", detail: current) { ask() },
            PaletteChoice(title: "Clear", detail: "remove this setting") { clear() },
            PaletteChoice(title: "Back", detail: "") { back() },
        ])
    }

    private static func optionDetail(_ option: WorkbenchChatExtensions.Feature.Option, short: Bool = false) -> String {
        var kind = option.type == "integer" ? "a whole number" : option.type == "number" ? "a number" : option.type == "boolean" ? "true or false" : "text"
        if let values = option.enum { kind = "one of " + values.joined(separator: ", ") }
        switch (option.minimum, option.maximum) {
        case let (min?, max?): kind += " from \(display(.number(min))) to \(display(.number(max)))"
        case let (min?, nil): kind += " of at least \(display(.number(min)))"
        case let (nil, max?): kind += " of at most \(display(.number(max)))"
        default: break
        }
        return short || option.description.isEmpty ? kind : "\(kind) · \(option.description)"
    }

    private static func display(_ value: JSONValue) -> String {
        switch value {
        case .string(let text): return text
        case .bool(let flag): return flag ? "true" : "false"
        case .number(let number): return number.rounded() == number && abs(number) < 1e15 ? String(Int(number)) : String(number)
        default: return "…"
        }
    }

    // MARK: Tech support

    /// lucaArchitect beside this chat, with tools to change this chat's tools.
    /// One per chat: a second `s` focuses it.
    func openSupport() {
        guard target == nil, assistant != Self.supportAssistant else { return Shell.shared.flash("This is the tech support chat") }
        guard conversationId != "new" else { return Shell.shared.flash("Still opening the chat") }
        if let tile = Shell.shared.tiles.values.first(where: {
            $0.content.kindId == Self.kind.id && $0.uri.authority == projectId && $0.uri.option("extends") == conversationId && $0.uri.option("extendsAssistant") == assistant
        }) {
            return Shell.shared.focusTile(tile.id)
        }
        _ = Shell.shared.open(TileURI.luca(project: projectId, tool: "chat", id: "new", options: [
            .init(name: "assistant", value: Self.supportAssistant),
            .init(name: "extends", value: conversationId),
            .init(name: "extendsAssistant", value: assistant),
        ]), focus: true, near: tileId, group: true)
    }
}
