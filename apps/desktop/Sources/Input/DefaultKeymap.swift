import Foundation

/// The keymap the app ships. Your `~/.luca/desktop/keymap.yml`
/// is merged over it by action id: give an action a new `key` (or `none`),
/// or a new `label`. The keys view reads only the merged result.
enum DefaultKeymap {
    static let yaml = #"""
# Luca Desktop default keymap. Copy any line into ~/.luca/desktop/keymap.yml
# and change its key to rebind it. `key: none` unbinds an action.
#
# Keys: Mod is the layout modifier (left Option unless `modifier:` says else).
# Mod-h, Mod-Shift-h, Ctrl-d, G (Shift-g), "Space Space" (a sequence), "g g".
# Scopes: layout and global work in every mode. normal, leader, tile,
# index (every card-stack index) and kind.<kind> work in Normal mode.
# resize works in Resize mode.

modifier: left-option

bindings:
  layout.mode.toggle:   { key: "Mod-Space", label: "free / organized", scope: layout }
  layout.float.toggle:  { key: "Mod-Shift-Space", label: "float / unfloat", scope: layout }
  layout.focus.left:    { key: "Mod-h", label: "focus left", scope: layout }
  layout.focus.down:    { key: "Mod-j", label: "focus below", scope: layout }
  layout.focus.up:      { key: "Mod-k", label: "focus above", scope: layout }
  layout.focus.right:   { key: "Mod-l", label: "focus right", scope: layout }
  layout.move.left:     { key: "Mod-Shift-h", label: "move left", scope: layout }
  layout.move.down:     { key: "Mod-Shift-j", label: "move down", scope: layout }
  layout.move.up:       { key: "Mod-Shift-k", label: "move up", scope: layout }
  layout.move.right:    { key: "Mod-Shift-l", label: "move right", scope: layout }
  layout.split.right:   { key: "Mod-v", label: "next opens right", scope: layout }
  layout.split.below:   { key: "Mod-s", label: "next opens below", scope: layout }
  layout.split.rotate:  { key: "Mod-e", label: "side by side / stacked", scope: layout }
  layout.stack.toggle: { key: "Mod-t", label: "stack / split", scope: layout }
  layout.stack.prev:    { key: "Mod-[", label: "previous in stack", scope: layout }
  layout.stack.next:    { key: "Mod-]", label: "next in stack", scope: layout }
  layout.zoom:          { key: "Mod-z", label: "zoom", scope: layout }
  layout.close:         { key: "Mod-q", label: "close tile", scope: layout }
  layout.resize:        { key: "Mod-r", label: "resize mode", scope: layout }
  layout.solo:          { key: "Mod-o", label: "solo this project", scope: layout }
  layout.solo.pick:     { key: "Mod-Shift-o", label: "pick a project to solo", scope: layout }
  layout.group:         { key: "Mod-g", label: "group with (then h j k l)", scope: layout }
  layout.ungroup:       { key: "Mod-Shift-g", label: "ungroup", scope: layout }
  workspace.go.1:       { key: "Mod-1", label: "workspace 1", scope: layout }
  workspace.go.2:       { key: "Mod-2", label: "workspace 2", scope: layout }
  workspace.go.3:       { key: "Mod-3", label: "workspace 3", scope: layout }
  workspace.go.4:       { key: "Mod-4", label: "workspace 4", scope: layout }
  workspace.go.5:       { key: "Mod-5", label: "workspace 5", scope: layout }
  workspace.go.6:       { key: "Mod-6", label: "workspace 6", scope: layout }
  workspace.go.7:       { key: "Mod-7", label: "workspace 7", scope: layout }
  workspace.go.8:       { key: "Mod-8", label: "workspace 8", scope: layout }
  workspace.go.9:       { key: "Mod-9", label: "workspace 9", scope: layout }
  workspace.send.1:     { key: "Mod-Shift-1", label: "send to 1", scope: layout }
  workspace.send.2:     { key: "Mod-Shift-2", label: "send to 2", scope: layout }
  workspace.send.3:     { key: "Mod-Shift-3", label: "send to 3", scope: layout }
  workspace.send.4:     { key: "Mod-Shift-4", label: "send to 4", scope: layout }
  workspace.send.5:     { key: "Mod-Shift-5", label: "send to 5", scope: layout }
  workspace.send.6:     { key: "Mod-Shift-6", label: "send to 6", scope: layout }
  workspace.send.7:     { key: "Mod-Shift-7", label: "send to 7", scope: layout }
  workspace.send.8:     { key: "Mod-Shift-8", label: "send to 8", scope: layout }
  workspace.send.9:     { key: "Mod-Shift-9", label: "send to 9", scope: layout }

  keys.toggle.anywhere: { key: "Mod-/", label: "keys view", scope: global }
  keys.toggle:          { key: "?", label: "keys view", scope: normal }
  command.open:         { key: ":", label: "command line", scope: normal }

  palette.open:         { key: "Space Space", label: "palette", scope: leader }
  palette.projects:     { key: "Space p", label: "open a project", scope: leader }
  projects.open:        { key: "Space P", label: "the projects tile", scope: leader }
  projects.remote:      { key: "Space R", label: "open a project on another machine (ssh)", scope: leader }
  projects.new:         { key: "Space N", label: "bootstrap a new Luca project (folder, then plugins)", scope: leader }
  luca.project:         { key: "Space o", label: "this project's overview", scope: leader }
  luca.registry:        { key: "Space r", label: "this project's registry", scope: leader }
  luca.console:         { key: "Space e", label: "this project's console", scope: leader }
  luca.command:         { key: "Space x", label: "run a command of this project", scope: leader }
  luca.plugins:         { key: "Space b", label: "this project's plugins and borrowed helpers", scope: leader }
  luca.endpoints:       { key: "Space h", label: "this project's endpoints and server", scope: leader }
  luca.servers:         { key: "Space s", label: "this project's servers: start and stop", scope: leader }
  luca.ai:              { key: "Space a", label: "this project's AI setup: providers, keys, agents", scope: leader }
  luca.docs:            { key: "Space d", label: "this project's docs", scope: leader }
  luca.models:          { key: "Space D", label: "this project's doc models", scope: leader }
  luca.contentbase:     { key: "Space m", label: "this project's contentbase: define models, query documents", scope: leader }
  luca.assistants:      { key: "Space c", label: "this project's assistants and past chats", scope: leader }
  luca.chat:            { key: "Space n", label: "new chat with one of this project's assistants", scope: leader }
  luca.terminal:        { key: "Space t", label: "a terminal in this project's folder", scope: leader }
  luca.file:            { key: "Space f", label: "open a file of this project", scope: leader }
  luca.page:            { key: "Space g", label: "a web page: luca serve path or URL", scope: leader }
  luca.tools:           { key: "Space w", label: "this project's own tools (declared in workbench/)", scope: leader }
  luca.scaffold:        { key: "Space S", label: "scaffold a new helper of this project (feature, command, …)", scope: leader }
  layouts.pick:         { key: "Space l", label: "layouts", scope: leader }
  theme.pick:           { key: "Space T", label: "color themes", scope: leader }
  layout.blank:         { key: "Space X", label: "blank slate: close every tile", scope: leader }
  terminal.leave:       { key: "Mod-Esc", label: "terminal, page keys: back to Normal", scope: global }
  doc.save:             { key: "Cmd-s", label: "save the doc or file (also :w)", scope: global }

  tile.scroll.down:     { key: "j", label: "scroll down", scope: tile }
  tile.scroll.up:       { key: "k", label: "scroll up", scope: tile }
  tile.top:             { key: "g g", label: "top", scope: tile }
  tile.bottom:          { key: "G", label: "bottom", scope: tile }
  tile.page.down:       { key: "Ctrl-d", label: "half page down", scope: tile }
  tile.page.up:         { key: "Ctrl-u", label: "half page up", scope: tile }
  tile.copyLink:        { key: "y y", label: "copy the tile's address", scope: tile }
  hint.start:           { key: "f", label: "hint mode", scope: tile }

  index.down:           { key: "j", label: "next card", scope: index }
  index.up:             { key: "k", label: "previous card", scope: index }
  index.left:           { key: "h", label: "stack to the left", scope: index }
  index.right:          { key: "l", label: "stack to the right", scope: index }
  index.open:           { key: "Enter", label: "open in a new tile", scope: index }
  index.peek:           { key: "p", label: "peek", scope: index }
  index.filter:         { key: "/", label: "filter", scope: index }
  index.reload:         { key: "r", label: "reload", scope: index }

  terminal.insert:      { key: "i", label: "type in the shell", scope: kind.luca-terminal }
  terminal.restart:     { key: "R", label: "new shell", scope: kind.luca-terminal }

  lucaFile.edit:        { key: "i", label: "edit", scope: kind.luca-file }
  lucaFile.reload:      { key: "r", label: "reload from disk", scope: kind.luca-file }
  lucaFile.keepMine:    { key: "d p", label: "conflict: keep mine", scope: kind.luca-file }
  lucaFile.takeTheirs:  { key: "d o", label: "conflict: take the file on disk", scope: kind.luca-file }
  lucaFile.prompt:      { key: "p", label: "markdown: run it with luca prompt (pick who)", scope: kind.luca-file }
  lucaFile.project:     { key: "u", label: "the project", scope: kind.luca-file }
  lucaFile.restart:     { key: "R", label: "restart the workbench host", scope: kind.luca-file }
  appFile.edit:         { key: "i", label: "edit", scope: kind.app-file }
  appFile.reload:       { key: "r", label: "reload from disk", scope: kind.app-file }
  appFile.keepMine:     { key: "d p", label: "conflict: keep mine", scope: kind.app-file }
  appFile.takeTheirs:   { key: "d o", label: "conflict: take the file on disk", scope: kind.app-file }

  lucaCanvas.keys:      { key: "i", label: "give every key to the canvas", scope: kind.luca-canvas }
  lucaCanvas.reload:    { key: "r", label: "reload the canvas (its saved code runs again)", scope: kind.luca-canvas }
  lucaCanvas.restart:   { key: "R", label: "restart the workbench host", scope: kind.luca-canvas }

  lucaPage.keys:        { key: "i", label: "give every key to the page", scope: kind.luca-page }
  lucaPage.reload:      { key: "r", label: "reload", scope: kind.luca-page }
  lucaPage.serve:       { key: "s", label: "start luca serve", scope: kind.luca-page }
  lucaPage.browser:     { key: "g o", label: "open in the browser", scope: kind.luca-page }
  lucaPage.zoom.in:     { key: "+", label: "zoom in", scope: kind.luca-page }
  lucaPage.zoom.out:    { key: "-", label: "zoom out", scope: kind.luca-page }
  lucaPage.zoom.reset:  { key: "0", label: "zoom back to 100%", scope: kind.luca-page }
  lucaPage.copyURL:     { key: "y u", label: "copy the web address", scope: kind.luca-page }

  appProjects.down:     { key: "j", label: "next project", scope: kind.app-projects }
  appProjects.up:       { key: "k", label: "previous project", scope: kind.app-projects }
  appProjects.open:     { key: "Enter", label: "go to the project", scope: kind.app-projects }
  appProjects.add:      { key: "a", label: "open another folder", scope: kind.app-projects }
  appProjects.new:      { key: "n", label: "bootstrap a new project", scope: kind.app-projects }
  appProjects.ask:      { key: "c", label: "ask lucaPortfolio about your projects", scope: kind.app-projects }

  lucaTool.actions:     { key: ".", label: "pick an action of this tool", scope: kind.luca-tool }
  lucaTool.source:      { key: "E", label: "open the tool's declaration file", scope: kind.luca-tool }
  lucaTool.project:     { key: "u", label: "the project overview", scope: kind.luca-tool }
  lucaTool.restart:     { key: "R", label: "restart the workbench host (reads workbench/ again)", scope: kind.luca-tool }

  lucaProject.reload:   { key: "r", label: "reload", scope: kind.luca-project }
  lucaProject.restart:  { key: "R", label: "restart the workbench host", scope: kind.luca-project }
  lucaProject.registry: { key: "o", label: "open the registry", scope: kind.luca-project }
  lucaRegistry.restart: { key: "R", label: "restart the workbench host", scope: kind.luca-registry }
  lucaRegistry.take:    { key: "t", label: "take into… another project", scope: kind.luca-registry }
  lucaRegistry.own:     { key: "o", label: "only this project's helpers, or all", scope: kind.luca-registry }
  lucaRegistry.origin:  { key: "O", label: "next origin: own, borrowed, plugins, built in", scope: kind.luca-registry }
  lucaRegistry.servers: { key: "s", label: "the servers tile: start and stop them", scope: kind.luca-registry }
  lucaRegistry.plugins: { key: "b", label: "plugins and borrowed helpers", scope: kind.luca-registry }
  lucaHelper.call:      { key: "m", label: "call a method", scope: kind.luca-helper }
  lucaHelper.reload:    { key: "r", label: "reload", scope: kind.luca-helper }
  lucaHelper.restart:   { key: "R", label: "restart the workbench host", scope: kind.luca-helper }
  lucaHelper.clearEvents: { key: "x", label: "clear the events", scope: kind.luca-helper }
  lucaHelper.registry:  { key: "u", label: "up to the registry", scope: kind.luca-helper }
  lucaHelper.take:      { key: "t", label: "take into… another project", scope: kind.luca-helper }
  lucaChange.apply:     { key: "a", label: "write the change (asks first)", scope: kind.luca-change }
  lucaChange.imports:   { key: "i", label: "copy the relative imports too, or not", scope: kind.luca-change }
  lucaChange.overwrite: { key: "o", label: "write over clashes, or not (asks first)", scope: kind.luca-change }
  lucaChange.reload:    { key: "r", label: "plan again", scope: kind.luca-change }
  lucaChange.restart:   { key: "R", label: "restart the workbench host", scope: kind.luca-change }
  lucaChange.registry:  { key: "u", label: "the receiving project's registry", scope: kind.luca-change }
  lucaPlugins.down:     { key: "j", label: "next row", scope: kind.luca-plugins }
  lucaPlugins.up:       { key: "k", label: "previous row", scope: kind.luca-plugins }
  lucaPlugins.toggle:   { key: "t", label: "turn on or off · stop a borrow (shows the change)", scope: kind.luca-plugins }
  lucaPlugins.link:     { key: "l", label: "link a project folder as a plugin", scope: kind.luca-plugins }
  lucaPlugins.open:     { key: "o", label: "show or hide what the plugin in focus adds", scope: kind.luca-plugins }
  lucaPlugins.filter:   { key: "/", label: "filter the helpers the plugins add by name", scope: kind.luca-plugins }
  lucaPlugins.apply:    { key: "a", label: "write the change shown (asks first)", scope: kind.luca-plugins }
  lucaPlugins.cancel:   { key: "c", label: "drop the change shown", scope: kind.luca-plugins }
  lucaPlugins.reload:   { key: "r", label: "reload", scope: kind.luca-plugins }
  lucaPlugins.restart:  { key: "R", label: "restart the workbench host", scope: kind.luca-plugins }
  lucaConsole.input:    { key: "i", label: "write an expression", scope: kind.luca-console }
  lucaConsole.history:  { key: "h", label: "pick from the history", scope: kind.luca-console }
  lucaConsole.clear:    { key: "x", label: "clear the entries", scope: kind.luca-console }
  lucaConsole.reset:    { key: "X", label: "reset the scope (forget names)", scope: kind.luca-console }
  lucaConsole.docs:     { key: "d", label: "show or hide the docs pane", scope: kind.luca-console }
  lucaConsole.inspect:  { key: "o", label: "open the inspector of the helper in the docs", scope: kind.luca-console }
  lucaConsole.restart:  { key: "R", label: "restart the workbench host", scope: kind.luca-console }
  lucaCommand.run:      { key: "r", label: "run the command", scope: kind.luca-command }
  lucaCommand.stop:     { key: "Ctrl-c", label: "stop the run", scope: kind.luca-command }
  lucaCommand.edit:     { key: "i", label: "edit the first field", scope: kind.luca-command }
  lucaCommand.form:     { key: "f", label: "show or hide the form", scope: kind.luca-command }
  lucaCommand.clear:    { key: "x", label: "clear the output", scope: kind.luca-command }
  lucaCommand.registry: { key: "u", label: "up to the commands", scope: kind.luca-command }
  lucaCommand.restart:  { key: "R", label: "restart the workbench host", scope: kind.luca-command }
  lucaAi.scan:          { key: "s", label: "scan for model servers", scope: kind.luca-ai }
  lucaAi.add:           { key: "a", label: "add a found server as a provider", scope: kind.luca-ai }
  lucaAi.key:           { key: "k", label: "set an API key", scope: kind.luca-ai }
  lucaAi.agents:        { key: "c", label: "check the coding agents again", scope: kind.luca-ai }
  lucaAi.setup:         { key: "x", label: "set up a local model", scope: kind.luca-ai }
  lucaAi.setupAll:      { key: "S", label: "run luca setup in a terminal (it asks what to set up)", scope: kind.luca-ai }
  lucaAi.reload:        { key: "r", label: "reload", scope: kind.luca-ai }
  lucaAi.restart:       { key: "R", label: "restart the workbench host", scope: kind.luca-ai }
  lucaServers.down:     { key: "j", label: "next server", scope: kind.luca-servers }
  lucaServers.up:       { key: "k", label: "previous server", scope: kind.luca-servers }
  lucaServers.toggle:   { key: "s", label: "start this server, or stop this instance", scope: kind.luca-servers }
  lucaServers.options:  { key: "S", label: "start this server with options (port, host…)", scope: kind.luca-servers }
  lucaServers.open:     { key: "Enter", label: "open its page, or its inspector", scope: kind.luca-servers }
  lucaServers.inspect:  { key: "o", label: "open the server's inspector", scope: kind.luca-servers }
  lucaServers.reload:   { key: "r", label: "reload", scope: kind.luca-servers }
  lucaServers.restart:  { key: "R", label: "restart the workbench host", scope: kind.luca-servers }
  lucaEndpoints.down:   { key: "j", label: "next route", scope: kind.luca-endpoints }
  lucaEndpoints.up:     { key: "k", label: "previous route", scope: kind.luca-endpoints }
  lucaEndpoints.open:   { key: "Enter", label: "send this route a request", scope: kind.luca-endpoints }
  lucaEndpoints.serve:  { key: "s", label: "start or stop the server", scope: kind.luca-endpoints }
  lucaEndpoints.log:    { key: "l", label: "show or hide the server log", scope: kind.luca-endpoints }
  lucaEndpoints.reload: { key: "r", label: "reload the routes", scope: kind.luca-endpoints }
  lucaEndpoints.restart: { key: "R", label: "restart the workbench host", scope: kind.luca-endpoints }
  lucaRequest.send:     { key: "r", label: "send the request", scope: kind.luca-request }
  lucaDocs.models:      { key: "m", label: "the doc models", scope: kind.luca-docs }
  lucaDocs.new:         { key: "n", label: "new document: pick the model, then a title", scope: kind.luca-docs }
  lucaDocs.restart:     { key: "R", label: "restart the workbench host", scope: kind.luca-docs }
  lucaModels.docs:      { key: "u", label: "the docs index", scope: kind.luca-models }
  lucaModels.reload:    { key: "r", label: "reload", scope: kind.luca-models }
  lucaModels.restart:   { key: "R", label: "restart the workbench host", scope: kind.luca-models }
  lucaModels.contentbase: { key: "e", label: "edit models in the contentbase tile", scope: kind.luca-models }
  lucaContentbase.next:   { key: "j", label: "next model", scope: kind.luca-contentbase }
  lucaContentbase.prev:   { key: "k", label: "previous model", scope: kind.luca-contentbase }
  lucaContentbase.model:  { key: "m", label: "the model: fields, sections, template", scope: kind.luca-contentbase }
  lucaContentbase.query:  { key: "q", label: "query its documents", scope: kind.luca-contentbase }
  lucaContentbase.new:    { key: "n", label: "new model", scope: kind.luca-contentbase }
  lucaContentbase.edit:   { key: "i", label: "edit: the name or last field, the last where value", scope: kind.luca-contentbase }
  lucaContentbase.addField: { key: "a", label: "add a field", scope: kind.luca-contentbase }
  lucaContentbase.addSection: { key: "s", label: "add a section", scope: kind.luca-contentbase }
  lucaContentbase.addFilter: { key: "w", label: "add a where row", scope: kind.luca-contentbase }
  lucaContentbase.addSort: { key: "o", label: "add a sort", scope: kind.luca-contentbase }
  lucaContentbase.run:    { key: "r", label: "run the query (model: reload)", scope: kind.luca-contentbase }
  lucaContentbase.file:   { key: "e", label: "open the model's file", scope: kind.luca-contentbase }
  lucaContentbase.template: { key: "t", label: "open the model's template (write one)", scope: kind.luca-contentbase }
  lucaContentbase.delete: { key: "x", label: "delete a model this tile made", scope: kind.luca-contentbase }
  lucaContentbase.copy:   { key: "c", label: "copy the query as code", scope: kind.luca-contentbase }
  lucaContentbase.docs:   { key: "u", label: "the docs index on this model", scope: kind.luca-contentbase }
  lucaContentbase.restart: { key: "R", label: "restart the workbench host", scope: kind.luca-contentbase }
  lucaDoc.edit:         { key: "i", label: "edit (rich or source)", scope: kind.luca-doc }
  lucaDoc.rich:         { key: "e", label: "rich view", scope: kind.luca-doc }
  lucaDoc.source:       { key: "E", label: "source view (frontmatter too)", scope: kind.luca-doc }
  lucaDoc.preview:      { key: "P", label: "preview view", scope: kind.luca-doc }
  lucaDoc.fields:       { key: "F", label: "show or hide the frontmatter fields", scope: kind.luca-doc }
  lucaDoc.reload:       { key: "r", label: "reload from disk", scope: kind.luca-doc }
  lucaDoc.keepMine:     { key: "d p", label: "conflict: keep mine", scope: kind.luca-doc }
  lucaDoc.takeTheirs:   { key: "d o", label: "conflict: take the file on disk", scope: kind.luca-doc }
  lucaDoc.chat:         { key: "c", label: "chat with an assistant about this document (last pick first)", scope: kind.luca-doc }
  lucaDoc.prompt:       { key: "p", label: "run it with luca prompt (pick who)", scope: kind.luca-doc }
  lucaDoc.promptDry:    { key: "D", label: "show the prompt it becomes (dry run)", scope: kind.luca-doc }
  lucaDoc.docs:         { key: "u", label: "the docs index", scope: kind.luca-doc }
  lucaDoc.restart:      { key: "R", label: "restart the workbench host", scope: kind.luca-doc }
  lucaAssistants.new:   { key: "n", label: "new chat with this assistant", scope: kind.luca-assistants }
  lucaAssistants.history: { key: "c", label: "this assistant's past conversations", scope: kind.luca-assistants }
  lucaAssistants.restart: { key: "R", label: "restart the workbench host", scope: kind.luca-assistants }
  lucaChat.input:       { key: "i", label: "write a message", scope: kind.luca-chat }
  lucaChat.stop:        { key: "Ctrl-c", label: "stop the reply", scope: kind.luca-chat }
  lucaChat.history:     { key: "h", label: "past conversations", scope: kind.luca-chat }
  lucaChat.new:         { key: "n", label: "new chat with this assistant", scope: kind.luca-chat }
  lucaChat.tools:       { key: "t", label: "tools for this chat: add a feature", scope: kind.luca-chat }
  lucaChat.support:     { key: "s", label: "tech support: lucaExpert changes this chat's tools", scope: kind.luca-chat }
  lucaChat.assistants:  { key: "u", label: "the assistants", scope: kind.luca-chat }
  lucaChat.reload:      { key: "r", label: "open again from the host", scope: kind.luca-chat }
  lucaChat.restart:     { key: "R", label: "restart the workbench host", scope: kind.luca-chat }
  lucaChat.next:        { key: "] ]", label: "next message", scope: kind.luca-chat }
  lucaChat.prev:        { key: "[ [", label: "previous message", scope: kind.luca-chat }
  lucaChat.details:     { key: "o", label: "open or close a message's tool calls and thinking", scope: kind.luca-chat }
  lucaChat.copyMessage: { key: "y m", label: "copy the message", scope: kind.luca-chat }
  lucaChat.set.model:   { key: ", m", label: "model, provider, reasoning effort", scope: kind.luca-chat }
  lucaChat.set.thinking: { key: ", T", label: "show or hide thinking", scope: kind.luca-chat }
  lucaChat.set.toolOutput: { key: ", o", label: "show or hide tool output", scope: kind.luca-chat }
  lucaChat.retry:       { key: ", r", label: "retry the last turn", scope: kind.luca-chat }
  lucaChat.rename:      { key: ", n", label: "rename this chat", scope: kind.luca-chat }
  lucaChat.export:      { key: ", e", label: "export as markdown", scope: kind.luca-chat }
  lucaChat.clear:       { key: ", X", label: "clear the transcript", scope: kind.luca-chat }
  lucaChat.delete:      { key: ", D", label: "delete this chat", scope: kind.luca-chat }
  lucaRequest.serve:    { key: "s", label: "start or stop the server", scope: kind.luca-request }
  lucaRequest.edit:     { key: "i", label: "edit the first field", scope: kind.luca-request }
  lucaRequest.headers:  { key: "h", label: "show or hide the response headers", scope: kind.luca-request }
  lucaRequest.view:     { key: "v", label: "body as a tree or as text", scope: kind.luca-request }
  lucaRequest.clear:    { key: "x", label: "clear the response", scope: kind.luca-request }
  lucaRequest.endpoints: { key: "u", label: "up to the endpoints", scope: kind.luca-request }
  lucaRequest.restart:  { key: "R", label: "restart the workbench host", scope: kind.luca-request }

  resize.left:          { key: "h", label: "grow left", scope: resize }
  resize.down:          { key: "j", label: "grow down", scope: resize }
  resize.up:            { key: "k", label: "grow up", scope: resize }
  resize.right:         { key: "l", label: "grow right", scope: resize }
  resize.shrink.left:   { key: "H", label: "shrink from left", scope: resize }
  resize.shrink.down:   { key: "J", label: "shrink from below", scope: resize }
  resize.shrink.up:     { key: "K", label: "shrink from above", scope: resize }
  resize.shrink.right:  { key: "L", label: "shrink from right", scope: resize }
  resize.balance:       { key: "=", label: "balance", scope: resize }
"""#

    static var file: KeymapFile { KeymapFile(parsing: yaml) }
}
