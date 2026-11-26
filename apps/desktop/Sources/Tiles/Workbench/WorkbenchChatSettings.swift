import AppKit

/// The `,` keys of a chat tile: model, provider and effort for this
/// conversation, what the transcript shows, and the history actions (retry,
/// rename, clear, delete, export). The host does each one and answers the
/// conversation as it now is; the tile only draws that.
extension WorkbenchChatContent {
    static let prefs = UserDefaults.standard
    static let thinkingKey = "lucaDesktop.chat.showThinking"
    static let toolOutputKey = "lucaDesktop.chat.showToolOutput"

    func performSetting(_ action: String) -> Bool {
        switch action {
        case "lucaChat.set.model":
            PaletteController.shared.choose("Change", [
                PaletteChoice(title: "Model and provider", detail: modelText ?? "") { [weak self] in self?.chooseModel() },
                PaletteChoice(title: "Reasoning effort", detail: effortText) { [weak self] in self?.chooseEffort() },
            ])
        case "lucaChat.set.thinking": toggleThinking()
        case "lucaChat.set.toolOutput": toggleToolOutput()
        case "lucaChat.retry": retry()
        case "lucaChat.rename": askRename()
        case "lucaChat.clear":
            guard !transcript.busy else { Shell.shared.flash("Wait for the reply, or Ctrl-c stops it"); return true }
            PaletteController.shared.confirm("Clear this chat? The transcript is wiped; the chat keeps its tools and model.", yes: "Clear") { [weak self] in
                self?.clear()
            }
        case "lucaChat.delete":
            PaletteController.shared.confirm("Delete this chat and its history? This cannot be undone.", yes: "Delete") { [weak self] in
                self?.deleteConversation()
            }
        case "lucaChat.export": export()
        default: return false
        }
        return true
    }

    /// The effort in effect, or `default`.
    var effortText: String {
        let effort = routing?.reasoningEffort ?? settings.reasoningEffort ?? ""
        return effort.isEmpty ? "default" : effort
    }

    /// A host call that needs an open, idle chat. Flashes why not and gives nil.
    private func ready() -> WorkbenchClient? {
        guard let host else { Shell.shared.flash("The workbench host is not running"); return nil }
        guard opened != nil, conversationId != "new" else { Shell.shared.flash("Still opening the chat"); return nil }
        return host
    }

    // MARK: Model, provider, effort

    /// The assistant's own, then every model the host says can answer. The
    /// last row takes a model name typed for the provider in use.
    func chooseModel() {
        guard let host = ready() else { return }
        let assistant = assistant, id = conversationId
        Shell.shared.flash("Loading models…")
        Task { [weak self] in
            do {
                let view = try await host.chatModels(assistant: assistant, conversationId: id)
                let current = view.routing
                let overridden = !(view.settings.provider ?? "").isEmpty || !(view.settings.model ?? "").isEmpty
                var choices = [PaletteChoice(title: (overridden ? "  " : "✓ ") + "The assistant's own", detail: view.own.text) {
                    self?.applySettings(provider: "", model: "")
                }]
                for row in view.choices {
                    let on = overridden && current.provider == row.provider && (row.model.isEmpty ? (view.settings.model ?? "").isEmpty : current.model == row.model)
                    choices.append(PaletteChoice(title: (on ? "✓ " : "  ") + row.title, detail: row.ready ? row.detail : "\(row.detail) · may not answer") {
                        self?.applySettings(provider: row.provider, model: row.model)
                    })
                }
                choices.append(PaletteChoice(title: "  Another model…", detail: "type a model name for \(current.provider.isEmpty ? "the default provider" : current.provider)") {
                    PaletteController.shared.ask("Model name", initial: current.model) { text in self?.setModelText(text) }
                })
                PaletteController.shared.choose("Model for this chat", choices)
            } catch {
                Shell.shared.flash(ErrorText.message(error))
            }
        }
    }

    /// `:model <name>` or `:model <provider> <name>`.
    func setModelText(_ text: String) {
        let parts = text.split(separator: " ", maxSplits: 1).map { String($0).trimmingCharacters(in: .whitespaces) }
        if parts.count == 2 { applySettings(provider: parts[0], model: parts[1]) }
        else if let model = parts.first, !model.isEmpty { applySettings(model: model) }
    }

    func chooseEffort() {
        let current = routing?.reasoningEffort ?? ""
        let efforts: [(String, String)] = [("", "the model's own"), ("minimal", ""), ("low", ""), ("medium", ""), ("high", ""), ("xhigh", "")]
        PaletteController.shared.choose("Reasoning effort", efforts.map { effort, detail in
            PaletteChoice(title: (current == effort ? "✓ " : "  ") + (effort.isEmpty ? "default" : effort), detail: detail) { [weak self] in
                self?.applySettings(reasoningEffort: effort)
            }
        })
    }

    /// Send a change. Nil leaves a field; empty goes back to the assistant's own.
    func applySettings(provider: String? = nil, model: String? = nil, reasoningEffort: String? = nil) {
        guard let host = ready() else { return }
        guard !transcript.busy else { return Shell.shared.flash("Wait for the reply, or Ctrl-c stops it") }
        let assistant = assistant, id = conversationId
        applyingSettings = true
        Task { [weak self] in
            defer { self?.applyingSettings = false }
            do {
                let view = try await host.setChatSettings(assistant: assistant, conversationId: id, provider: provider, model: model, reasoningEffort: reasoningEffort)
                if view.ok == false { return Shell.shared.flash(view.error ?? "The host did not take it") }
                self?.adopt(view)
                Shell.shared.flash("Next reply: \(view.modelText ?? "default model") · effort \(self?.effortText ?? "default")")
            } catch {
                Shell.shared.flash(ErrorText.message(error))
            }
        }
    }

    // MARK: What shows

    func toggleThinking() {
        showThinking.toggle()
        Self.prefs.set(showThinking, forKey: Self.thinkingKey)
        Shell.shared.flash(showThinking ? "Thinking shown" : "Thinking hidden. o opens it on one message")
    }

    func toggleToolOutput() {
        showToolOutput.toggle()
        Self.prefs.set(showToolOutput, forKey: Self.toolOutputKey)
        Shell.shared.flash(showToolOutput ? "Tool output shown" : "Tool output hidden. o opens it on one message")
    }

    // MARK: History

    /// The last turn again: a failed one reruns its input, a good one is
    /// taken out and its message sent again. It streams as a new turn.
    func retry() {
        guard let host = ready() else { return }
        guard !transcript.busy else { return Shell.shared.flash("Wait for the reply, or Ctrl-c stops it") }
        let assistant = assistant, id = conversationId
        Task { [weak self] in
            do {
                let sent = try await host.retryChat(assistant: assistant, conversationId: id)
                if sent.ok != true { Shell.shared.flash(sent.error ?? "Nothing to retry") }
            } catch {
                Shell.shared.flash(ErrorText.message(error))
            }
            self?.refreshLabel()
        }
    }

    private func askRename() {
        let current = opened?.title ?? ""
        PaletteController.shared.ask("New name for this chat", initial: current == "New conversation" ? "" : current) { [weak self] text in
            self?.rename(text)
        }
    }

    func rename(_ text: String) {
        let name = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty, let host = ready() else { return }
        let assistant = assistant, id = conversationId
        Task { [weak self] in
            do {
                let view = try await host.renameChat(assistant: assistant, conversationId: id, title: name)
                if view.ok == false { return Shell.shared.flash(view.error ?? "Could not rename") }
                self?.adopt(view)
                Shell.shared.flash("Renamed to “\(name)”")
            } catch {
                Shell.shared.flash(ErrorText.message(error))
            }
        }
    }

    private func clear() {
        guard let host = ready() else { return }
        let assistant = assistant, id = conversationId
        Task { [weak self] in
            do {
                let view = try await host.clearChat(assistant: assistant, conversationId: id)
                if view.ok == false { return Shell.shared.flash(view.error ?? "Could not clear") }
                self?.adopt(view, transcript: true)
                Shell.shared.flash("Cleared")
            } catch {
                Shell.shared.flash(ErrorText.message(error))
            }
        }
    }

    /// The host sends `chat-deleted`, which closes every tile on this chat.
    private func deleteConversation() {
        guard let host = ready() else { return }
        let assistant = assistant, id = conversationId
        Task {
            do {
                let answer = try await host.deleteChat(assistant: assistant, conversationId: id)
                if answer.ok != true { Shell.shared.flash(answer.error ?? "Could not delete") }
            } catch {
                Shell.shared.flash(ErrorText.message(error))
            }
        }
    }

    private func export() {
        guard let host = ready() else { return }
        let assistant = assistant, id = conversationId
        let fetch = { () async throws -> WorkbenchChatExport in try await host.exportChat(assistant: assistant, conversationId: id) }
        PaletteController.shared.choose("Export this chat", [
            PaletteChoice(title: "Copy as markdown", detail: "") {
                Task {
                    do {
                        let file = try await fetch()
                        NSPasteboard.general.clearContents()
                        NSPasteboard.general.setString(file.markdown, forType: .string)
                        Shell.shared.flash("Copied “\(file.title)”")
                    } catch { Shell.shared.flash(ErrorText.message(error)) }
                }
            },
            PaletteChoice(title: "Save to Downloads", detail: "a markdown file") {
                Task {
                    do {
                        let file = try await fetch()
                        let folder = FileManager.default.urls(for: .downloadsDirectory, in: .userDomainMask)[0]
                        let url = folder.appendingPathComponent(file.filename)
                        try file.markdown.write(to: url, atomically: true, encoding: .utf8)
                        Shell.shared.flash("Saved \(url.path)")
                    } catch { Shell.shared.flash(ErrorText.message(error)) }
                }
            },
        ])
    }
}
