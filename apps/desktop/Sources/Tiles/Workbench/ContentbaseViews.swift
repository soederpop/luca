import SwiftUI

/// The contentbase tile: the models on the left, the picked one's form or
/// query on the right.
struct ContentbaseView: View {
    @ObservedObject var model: ContentbaseContent

    private var p: KitPalette { Theme.palette }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if model.hostStatus != .running || model.error != nil {
                VStack(alignment: .leading, spacing: WorkbenchStyle.Gap.row) {
                    WorkbenchHostLine(status: model.hostStatus)
                    if let error = model.error {
                        Text(error).font(WorkbenchStyle.body).foregroundStyle(p.bad.color).textSelection(.enabled)
                    }
                }
                .padding(WorkbenchStyle.Gap.page)
            }
            if let overview = model.overview {
                if let notice = overview.notice {
                    Text(notice).font(WorkbenchStyle.body).foregroundStyle(p.warn.color).padding(WorkbenchStyle.Gap.page)
                } else {
                    HStack(alignment: .top, spacing: 0) {
                        ContentbaseModelList(model: model, overview: overview)
                            .frame(width: 250)
                        Rectangle().fill(p.border.color).frame(width: 1)
                        ContentbaseDetail(model: model)
                    }
                }
            } else if model.hostStatus == .running, model.error == nil {
                ProgressView().controlSize(.small).padding(WorkbenchStyle.Gap.page)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(p.surface.color)
    }
}

// MARK: - The model list

private struct ContentbaseModelList: View {
    @ObservedObject var model: ContentbaseContent
    let overview: ContentbaseOverview

    private var p: KitPalette { Theme.palette }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: KitTokens.Space.s3) {
                HStack(spacing: KitTokens.Space.s3) {
                    Text("Models").font(WorkbenchStyle.heading).foregroundStyle(p.text.color)
                    CountPill(count: overview.models.filter { $0.slot >= 0 }.count, color: WorkbenchStyle.thingColor("docs"))
                    Spacer(minLength: 0)
                    Button { model.newModel() } label: {
                        HStack(spacing: KitTokens.Space.s2) {
                            Image(systemName: "plus")
                            Text("New")
                        }
                        .font(WorkbenchStyle.ui(KitTokens.TypeScale.xs, weight: .semibold))
                        .foregroundStyle(p.accent.color)
                    }
                    .buttonStyle(.plain)
                    .keyBadge("lucaContentbase.new")
                    .hintTarget("lucaContentbase.new", in: model.hints) { model.newModel() }
                }
                .padding(.bottom, KitTokens.Space.s3)
                Text(overview.rootDisplay).font(WorkbenchStyle.code(KitTokens.TypeScale.xs)).foregroundStyle(p.textFaint.color)
                    .lineLimit(1).truncationMode(.head)
                    .padding(.bottom, KitTokens.Space.s4)

                if model.isNew {
                    row(name: model.draft.name.isEmpty ? "New model" : model.draft.name, detail: "not saved", slot: 0, selected: true, tag: "new", tagColor: p.accent.color) {}
                }
                ForEach(overview.models) { m in
                    row(name: m.name, detail: m.prefix.isEmpty ? "any other document" : m.prefix + "/", slot: m.slot,
                        selected: !model.isNew && m.name == model.selected, tag: "\(m.count)", tagColor: WorkbenchStyle.slotColor(m.slot),
                        source: m.source) {
                        model.select(m.name)
                    }
                }
                if !overview.loadErrors.isEmpty {
                    VStack(alignment: .leading, spacing: KitTokens.Space.s3) {
                        Text("Did not load").font(WorkbenchStyle.ui(KitTokens.TypeScale.xs, weight: .semibold)).foregroundStyle(p.bad.color)
                        ForEach(overview.loadErrors) { e in
                            VStack(alignment: .leading, spacing: 2) {
                                Text(e.model ?? e.fileDisplay).font(WorkbenchStyle.code(KitTokens.TypeScale.xs, weight: .semibold)).foregroundStyle(p.text.color)
                                Text(e.message).font(WorkbenchStyle.meta).foregroundStyle(p.textMuted.color).fixedSize(horizontal: false, vertical: true)
                            }
                        }
                    }
                    .padding(.top, KitTokens.Space.s6)
                }
            }
            .padding(WorkbenchStyle.Gap.card)
        }
        .background(p.inset.color.opacity(0.35))
    }

    private func row(name: String, detail: String, slot: Int, selected: Bool, tag: String, tagColor: Color,
                     source: String? = nil, action: @escaping () -> Void) -> some View {
        let color = WorkbenchStyle.slotColor(slot)
        return Button(action: action) {
            HStack(spacing: KitTokens.Space.s4) {
                Circle().fill(color).frame(width: 9, height: 9)
                VStack(alignment: .leading, spacing: 1) {
                    HStack(spacing: KitTokens.Space.s2) {
                        Text(name).font(WorkbenchStyle.ui(KitTokens.TypeScale.sm, weight: selected ? .semibold : .regular))
                            .foregroundStyle(selected ? p.text.color : p.textBody.color)
                        if source == "tile" {
                            Image(systemName: "pencil").font(.system(size: 10)).foregroundStyle(p.accent.color).help("Made in this tile: editable")
                        }
                    }
                    Text(detail).font(WorkbenchStyle.code(KitTokens.TypeScale.xs)).foregroundStyle(p.textFaint.color).lineLimit(1)
                }
                Spacer(minLength: 0)
                Text(tag).font(WorkbenchStyle.ui(KitTokens.TypeScale.xs, weight: .semibold).monospacedDigit()).foregroundStyle(tagColor)
            }
            .padding(.horizontal, KitTokens.Space.s4)
            .padding(.vertical, KitTokens.Space.s3)
            .background(RoundedRectangle(cornerRadius: KitTokens.Radius.md).fill(selected ? color.opacity(0.16) : Color.clear))
            .overlay(alignment: .leading) {
                if selected { RoundedRectangle(cornerRadius: 2).fill(color).frame(width: 3).padding(.vertical, 4) }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

// MARK: - The detail

private struct ContentbaseDetail: View {
    @ObservedObject var model: ContentbaseContent

    private var p: KitPalette { Theme.palette }
    private var color: Color { WorkbenchStyle.slotColor(model.isNew ? 0 : (model.current?.slot ?? 0)) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: WorkbenchStyle.Gap.section) {
                header
                if model.pane == .model || model.isNew {
                    ContentbaseForm(model: model, color: color)
                } else {
                    ContentbaseQueryPane(model: model, color: color)
                }
            }
            .padding(WorkbenchStyle.Gap.page)
            .frame(maxWidth: WorkbenchStyle.Size.readable + 240, alignment: .leading)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: KitTokens.Space.s4) {
            HStack(alignment: .firstTextBaseline, spacing: KitTokens.Space.s5) {
                Text(model.isNew ? (model.draft.name.isEmpty ? "New model" : model.draft.name) : (model.selected ?? "No model"))
                    .font(WorkbenchStyle.title).foregroundStyle(color)
                if let m = model.current {
                    Button { model.openDocs() } label: {
                        WorkbenchTag(text: "\(m.count) doc\(m.count == 1 ? "" : "s")", color: color)
                    }
                    .buttonStyle(.plain)
                    .keyBadge("lucaContentbase.docs")
                    .help("Open the docs index on \(m.name)")
                }
                if model.dirty { WorkbenchTag(text: "not saved", color: p.warn.color) }
                Spacer(minLength: 0)
                if !model.isNew { paneSwitch }
            }
            if let m = model.current {
                HStack(spacing: KitTokens.Space.s4) {
                    Text(m.sourceText).font(WorkbenchStyle.meta).foregroundStyle(p.textMuted.color)
                    if !m.file.isEmpty {
                        Button("open file") { model.openFile() }
                            .buttonStyle(.plain).font(WorkbenchStyle.meta).foregroundStyle(p.accent.color)
                        BoundKey(action: "lucaContentbase.file")
                    }
                }
            } else if model.isNew {
                Text("Saved as \(model.preview?.fileDisplay.isEmpty == false ? model.preview!.fileDisplay : (model.overview?.modelsDirDisplay ?? "docs/models") + "/<name>.md")")
                    .font(WorkbenchStyle.code(KitTokens.TypeScale.xs)).foregroundStyle(p.textMuted.color)
            }
        }
    }

    private var paneSwitch: some View {
        HStack(spacing: 2) {
            paneButton("Model", .model, "lucaContentbase.model")
            paneButton("Query", .query, "lucaContentbase.query")
        }
        .padding(2)
        .background(Capsule().fill(p.inset.color))
    }

    private func paneButton(_ title: String, _ pane: ContentbaseContent.Pane, _ action: String) -> some View {
        let on = model.pane == pane
        return Button { model.show(pane) } label: {
            HStack(spacing: KitTokens.Space.s3) {
                Text(title).font(WorkbenchStyle.ui(KitTokens.TypeScale.sm, weight: on ? .semibold : .regular))
                BoundKey(action: action)
            }
            .foregroundStyle(on ? p.accentOn.color : p.textBody.color)
            .padding(.horizontal, KitTokens.Space.s5)
            .padding(.vertical, KitTokens.Space.s2)
            .background(Capsule().fill(on ? color : Color.clear))
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Shared controls

private struct CbTextField: View {
    let placeholder: String
    @Binding var text: String
    var code = true
    var width: CGFloat?
    var tint: Color?
    var focus: FocusState<String?>.Binding
    let focusId: String

    private var p: KitPalette { Theme.palette }

    var body: some View {
        TextField(placeholder, text: $text)
            .textFieldStyle(.plain)
            .font(code ? WorkbenchStyle.code(KitTokens.TypeScale.sm) : WorkbenchStyle.body)
            .foregroundStyle(tint ?? p.text.color)
            .focused(focus, equals: focusId)
            .padding(.horizontal, KitTokens.Space.s4)
            .padding(.vertical, KitTokens.Space.s3)
            .background(RoundedRectangle(cornerRadius: KitTokens.Radius.md).fill(p.inset.color))
            .overlay(RoundedRectangle(cornerRadius: KitTokens.Radius.md)
                .stroke(focus.wrappedValue == focusId ? p.accent.color.opacity(0.7) : p.border.color))
            .frame(width: width)
            .frame(maxWidth: width == nil ? .infinity : nil, alignment: .leading)
    }
}

private struct CbMenu: View {
    let value: String
    let options: [String]
    var label: (String) -> String = { $0 }
    var tint: Color?
    let pick: (String) -> Void

    private var p: KitPalette { Theme.palette }

    var body: some View {
        Menu {
            ForEach(options, id: \.self) { option in
                Button(label(option)) { pick(option) }
            }
        } label: {
            HStack(spacing: KitTokens.Space.s3) {
                Text(value.isEmpty ? "—" : label(value)).foregroundStyle(value.isEmpty ? p.textFaint.color : (tint ?? p.text.color))
                Image(systemName: "chevron.up.chevron.down").font(.system(size: 11)).foregroundStyle(p.textMuted.color)
            }
            .font(WorkbenchStyle.code(KitTokens.TypeScale.sm))
            .padding(.horizontal, KitTokens.Space.s4)
            .padding(.vertical, KitTokens.Space.s3)
            .background(RoundedRectangle(cornerRadius: KitTokens.Radius.md).fill(p.inset.color))
        }
        .menuStyle(.button)
        .buttonStyle(.plain)
        .fixedSize()
    }
}

private struct CbIconButton: View {
    let systemName: String
    let help: String
    var tint: Color?
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: systemName).font(.system(size: 12, weight: .semibold))
                .foregroundStyle(tint ?? Theme.palette.textMuted.color)
                .frame(width: 22, height: 22)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .help(help)
    }
}

private struct CbAddButton: View {
    let title: String
    let action: String
    let hints: HintRegistry
    let run: () -> Void

    var body: some View {
        Button(action: run) {
            HStack(spacing: KitTokens.Space.s3) {
                Image(systemName: "plus.circle.fill")
                Text(title)
                BoundKey(action: action)
            }
            .font(WorkbenchStyle.ui(KitTokens.TypeScale.sm, weight: .semibold))
            .foregroundStyle(Theme.palette.accent.color)
        }
        .buttonStyle(.plain)
        .hintTarget(action, in: hints, action: run)
    }
}

/// A comma-separated list as one text field.
@MainActor private func commaBinding(_ list: Binding<[String]>) -> Binding<String> {
    Binding(get: { list.wrappedValue.joined(separator: ", ") },
            set: { list.wrappedValue = $0.split(separator: ",", omittingEmptySubsequences: false).map { $0.trimmingCharacters(in: .whitespaces) } })
}

/// The editor's field types, colored as the host's kinds.
@MainActor private func typeColor(_ type: String) -> Color {
    WorkbenchStyle.fieldColor(type == "list" ? "array" : type)
}

// MARK: - The model form

private struct ContentbaseForm: View {
    @ObservedObject var model: ContentbaseContent
    let color: Color
    @FocusState private var focused: String?

    private var p: KitPalette { Theme.palette }

    var body: some View {
        VStack(alignment: .leading, spacing: WorkbenchStyle.Gap.section) {
            if let m = model.current, let note = m.readOnlyNote {
                WorkbenchCard(tint: p.info.color) {
                    HStack(spacing: KitTokens.Space.s5) {
                        Image(systemName: "lock").foregroundStyle(p.info.color)
                        Text(note).font(WorkbenchStyle.body).foregroundStyle(p.textBody.color)
                        Spacer(minLength: 0)
                    }
                }
            }
            VStack(alignment: .leading, spacing: WorkbenchStyle.Gap.section) {
                basics
                fields
                sections
            }
            .disabled(!model.editable)
            if model.editable {
                problems
                saveBar
                generatedFile
            }
            if let m = model.current, m.source != "builtin" { template(m) }
            if let m = model.current, !m.relationships.isEmpty {
                WorkbenchSection(title: "Relationships", count: m.relationships.count, color: p.syntax.type.color) {
                    Text(m.relationships.joined(separator: ", ")).font(WorkbenchStyle.code(KitTokens.TypeScale.sm)).foregroundStyle(p.textBody.color)
                }
            }
        }
        .onChange(of: model.focusTick) { _, _ in
            if model.draft.name.isEmpty || model.isNew && model.draft.fields.isEmpty { focused = "name" }
            else if let last = model.draft.fields.last { focused = "field-\(last.id)" }
            else { focused = "name" }
        }
    }

    private var basics: some View {
        WorkbenchCard(tint: color) {
            Grid(alignment: .leadingFirstTextBaseline, horizontalSpacing: KitTokens.Space.s6, verticalSpacing: KitTokens.Space.s5) {
                GridRow {
                    label("Name", "a capital first: Customer")
                    CbTextField(placeholder: "e.g. Customer", text: $model.draft.name, width: 320, tint: color, focus: $focused, focusId: "name")
                }
                GridRow {
                    label("Folder", "documents live in docs/<folder>/")
                    HStack(spacing: KitTokens.Space.s3) {
                        CbTextField(placeholder: "e.g. customers", text: Binding(get: { model.draft.prefix }, set: {
                            model.prefixTouched = true
                            model.draft.prefix = $0
                        }), width: 320, focus: $focused, focusId: "prefix")
                        Text("/").font(WorkbenchStyle.code(KitTokens.TypeScale.sm)).foregroundStyle(p.textFaint.color)
                    }
                }
                GridRow {
                    label("Description", "assistants read this to learn the model")
                    TextField("What one document of this model is", text: $model.draft.description, axis: .vertical)
                        .lineLimit(1...4)
                        .textFieldStyle(.plain)
                        .font(WorkbenchStyle.body)
                        .focused($focused, equals: "description")
                        .padding(.horizontal, KitTokens.Space.s4)
                        .padding(.vertical, KitTokens.Space.s3)
                        .background(RoundedRectangle(cornerRadius: KitTokens.Radius.md).fill(p.inset.color))
                        .overlay(RoundedRectangle(cornerRadius: KitTokens.Radius.md).stroke(focused == "description" ? p.accent.color.opacity(0.7) : p.border.color))
                }
            }
        }
    }

    private func label(_ title: String, _ note: String) -> some View {
        VStack(alignment: .trailing, spacing: 1) {
            Text(title).font(WorkbenchStyle.ui(KitTokens.TypeScale.sm, weight: .semibold)).foregroundStyle(p.text.color)
            Text(note).font(WorkbenchStyle.meta).foregroundStyle(p.textFaint.color)
        }
        .gridColumnAlignment(.trailing)
    }

    // MARK: Fields

    private var fields: some View {
        WorkbenchSection(title: "Frontmatter fields", note: "the zod schema of meta", count: model.draft.fields.count, color: p.syntax.property.color) {
            VStack(alignment: .leading, spacing: WorkbenchStyle.Gap.row) {
                if model.draft.fields.isEmpty {
                    Text("No fields. Documents may carry any frontmatter.").font(WorkbenchStyle.body).foregroundStyle(p.textFaint.color)
                }
                ForEach($model.draft.fields) { $field in
                    fieldRow($field)
                }
                if model.editable {
                    CbAddButton(title: "Add a field", action: "lucaContentbase.addField", hints: model.hints) { model.addField() }
                }
            }
        }
    }

    private func fieldRow(_ field: Binding<ContentbaseFieldSpec>) -> some View {
        let f = field.wrappedValue
        let tint = typeColor(f.type)
        return WorkbenchCard(tint: tint, padding: WorkbenchStyle.Gap.row) {
            VStack(alignment: .leading, spacing: KitTokens.Space.s4) {
                HStack(spacing: KitTokens.Space.s4) {
                    CbTextField(placeholder: "name", text: field.name, width: 170, tint: WorkbenchStyle.keyColor, focus: $focused, focusId: "field-\(f.id)")
                    CbMenu(value: f.type, options: model.fieldTypes, tint: tint) { type in
                        field.wrappedValue.type = type
                        if type != "enum" { field.wrappedValue.options = [] }
                        field.wrappedValue.default = ""
                    }
                    Toggle(isOn: field.required) {
                        Text("required").font(WorkbenchStyle.ui(KitTokens.TypeScale.xs, weight: .semibold))
                            .foregroundStyle(f.required ? p.warn.color : p.textMuted.color)
                    }
                    .toggleStyle(.checkbox)
                    defaultControl(field)
                    Spacer(minLength: 0)
                    if model.editable {
                        CbIconButton(systemName: "arrow.up", help: "move up") { model.moveField(f.id, by: -1) }
                        CbIconButton(systemName: "arrow.down", help: "move down") { model.moveField(f.id, by: 1) }
                        CbIconButton(systemName: "trash", help: "remove the field", tint: p.bad.color) { model.removeField(f.id) }
                    }
                }
                if f.type == "enum" {
                    HStack(spacing: KitTokens.Space.s4) {
                        Text("values").font(WorkbenchStyle.meta).foregroundStyle(p.textMuted.color).frame(width: 72, alignment: .trailing)
                        CbTextField(placeholder: "draft, live, retired", text: commaBinding(field.options), tint: typeColor("enum"), focus: $focused, focusId: "options-\(f.id)")
                    }
                }
                HStack(spacing: KitTokens.Space.s4) {
                    Text("describe").font(WorkbenchStyle.meta).foregroundStyle(p.textMuted.color).frame(width: 72, alignment: .trailing)
                    CbTextField(placeholder: "How to fill this field in", text: field.description, code: false, focus: $focused, focusId: "describe-\(f.id)")
                }
            }
        }
    }

    @ViewBuilder private func defaultControl(_ field: Binding<ContentbaseFieldSpec>) -> some View {
        let f = field.wrappedValue
        HStack(spacing: KitTokens.Space.s3) {
            Text("default").font(WorkbenchStyle.meta).foregroundStyle(p.textMuted.color)
            if f.type == "enum" || f.type == "boolean" {
                CbMenu(value: f.default, options: [""] + (f.type == "boolean" ? ["true", "false"] : f.options.filter { !$0.isEmpty }),
                       label: { $0.isEmpty ? "none" : $0 }, tint: typeColor(f.type)) { field.wrappedValue.default = $0 }
            } else {
                CbTextField(placeholder: f.type == "list" ? "a, b" : "none", text: field.default, width: 150, tint: typeColor(f.type),
                            focus: $focused, focusId: "default-\(f.id)")
            }
        }
    }

    // MARK: Sections

    private var sections: some View {
        WorkbenchSection(title: "Sections", note: "## headings to pull out of the body", count: model.draft.sections.count, color: p.syntax.function.color) {
            VStack(alignment: .leading, spacing: WorkbenchStyle.Gap.row) {
                if model.draft.sections.isEmpty {
                    Text("No sections.").font(WorkbenchStyle.body).foregroundStyle(p.textFaint.color)
                }
                ForEach($model.draft.sections) { $section in
                    sectionRow($section)
                }
                if model.editable {
                    CbAddButton(title: "Add a section", action: "lucaContentbase.addSection", hints: model.hints) { model.addSection() }
                }
                if let m = model.current, m.sections.contains(where: { $0.extract == "custom" }) {
                    Text("Some sections use their own extract code; it shows here as text.")
                        .font(WorkbenchStyle.meta).foregroundStyle(p.textFaint.color)
                }
            }
        }
    }

    private func sectionRow(_ section: Binding<ContentbaseSectionSpec>) -> some View {
        let s = section.wrappedValue
        return WorkbenchCard(tint: p.syntax.function.color, padding: WorkbenchStyle.Gap.row) {
            VStack(alignment: .leading, spacing: KitTokens.Space.s4) {
                HStack(spacing: KitTokens.Space.s4) {
                    Text("##").font(WorkbenchStyle.code(KitTokens.TypeScale.sm, weight: .bold)).foregroundStyle(p.syntax.function.color)
                    CbTextField(placeholder: "Heading in the document", text: section.heading, code: false, focus: $focused, focusId: "heading-\(s.id)")
                    Text("as").font(WorkbenchStyle.meta).foregroundStyle(p.textMuted.color)
                    CbTextField(placeholder: "key", text: section.key, width: 140, tint: WorkbenchStyle.keyColor, focus: $focused, focusId: "key-\(s.id)")
                    CbMenu(value: s.extract, options: model.extractKinds, label: Self.extractLabel, tint: p.syntax.type.color) { section.wrappedValue.extract = $0 }
                    if model.editable {
                        CbIconButton(systemName: "trash", help: "remove the section", tint: p.bad.color) { model.removeSection(s.id) }
                    }
                }
                HStack(spacing: KitTokens.Space.s4) {
                    Text("or").font(WorkbenchStyle.meta).foregroundStyle(p.textMuted.color).frame(width: 22, alignment: .trailing)
                    CbTextField(placeholder: "other headings that count, comma separated", text: commaBinding(section.alternatives), code: false,
                                focus: $focused, focusId: "alts-\(s.id)")
                }
            }
        }
    }

    static func extractLabel(_ kind: String) -> String {
        switch kind {
        case "text": return "text (paragraphs)"
        case "list": return "list (items)"
        case "code": return "code blocks"
        default: return kind
        }
    }

    // MARK: Save, problems, the file

    @ViewBuilder private var problems: some View {
        if let problems = model.preview?.problems, !problems.isEmpty, model.dirty, !model.draft.sameContent(as: .blank()) {
            WorkbenchCard(tint: p.warn.color) {
                VStack(alignment: .leading, spacing: KitTokens.Space.s3) {
                    ForEach(problems, id: \.self) { line in
                        Label(line, systemImage: "exclamationmark.triangle").font(WorkbenchStyle.body).foregroundStyle(p.warn.color)
                    }
                }
            }
        }
    }

    private var saveBar: some View {
        let blocked = !(model.preview?.problems.isEmpty ?? true)
        let canSave = (model.dirty || model.isNew) && !model.saving
        return HStack(spacing: KitTokens.Space.s5) {
            Button { model.save() } label: {
                HStack(spacing: KitTokens.Space.s3) {
                    Image(systemName: "square.and.arrow.down")
                    Text(model.isNew ? "Create model" : "Save model")
                    BoundKey(action: "doc.save", tint: p.accentOn.color)
                }
                .font(WorkbenchStyle.ui(KitTokens.TypeScale.sm, weight: .semibold))
                .padding(.horizontal, KitTokens.Space.s6)
                .padding(.vertical, KitTokens.Space.s3)
                .background(Capsule().fill(canSave && !blocked ? p.accent.color : p.inset.color))
                .foregroundStyle(canSave && !blocked ? p.accentOn.color : p.textFaint.color)
            }
            .buttonStyle(.plain)
            .disabled(!canSave)
            if model.saving { ProgressView().controlSize(.small) }
            if model.dirty || model.isNew {
                Button(model.isNew ? "Cancel" : "Revert") { model.revert() }
                    .buttonStyle(.plain).font(WorkbenchStyle.body).foregroundStyle(p.textMuted.color)
            }
            Spacer(minLength: 0)
            if let m = model.current, m.source == "tile" {
                Button { model.confirmDelete() } label: {
                    HStack(spacing: KitTokens.Space.s3) {
                        Image(systemName: "trash")
                        Text("Delete model")
                        BoundKey(action: "lucaContentbase.delete")
                    }
                    .font(WorkbenchStyle.body)
                    .foregroundStyle(p.bad.color)
                }
                .buttonStyle(.plain)
            }
        }
    }

    @ViewBuilder private var generatedFile: some View {
        if let preview = model.preview, !preview.text.isEmpty {
            VStack(alignment: .leading, spacing: KitTokens.Space.s4) {
                Button { model.showFile.toggle() } label: {
                    HStack(spacing: KitTokens.Space.s3) {
                        Image(systemName: model.showFile ? "chevron.down" : "chevron.right").font(.system(size: 11))
                        Text("The file it writes").font(WorkbenchStyle.ui(KitTokens.TypeScale.sm, weight: .semibold))
                        Text(preview.fileDisplay).font(WorkbenchStyle.code(KitTokens.TypeScale.xs)).foregroundStyle(p.textFaint.color)
                    }
                    .foregroundStyle(p.textMuted.color)
                }
                .buttonStyle(.plain)
                if model.showFile {
                    WorkbenchCard {
                        Text(preview.text)
                            .font(WorkbenchStyle.code(KitTokens.TypeScale.xs))
                            .foregroundStyle(p.textBody.color)
                            .textSelection(.enabled)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
        }
    }

    private func template(_ m: ContentbaseModel) -> some View {
        WorkbenchSection(title: "Template", note: "new documents of \(m.name) start from it", color: p.syntax.string.color) {
            HStack(spacing: KitTokens.Space.s5) {
                Text(m.template.fileDisplay).font(WorkbenchStyle.code(KitTokens.TypeScale.sm)).foregroundStyle(p.textBody.color)
                WorkbenchTag(text: m.template.exists ? "exists" : "none yet", color: m.template.exists ? p.good.color : p.textFaint.color)
                Button(m.template.exists ? "edit" : "write one") { model.openTemplate() }
                    .buttonStyle(.plain).font(WorkbenchStyle.body).foregroundStyle(p.accent.color)
                BoundKey(action: "lucaContentbase.template")
                Spacer(minLength: 0)
            }
        }
    }
}

// MARK: - The query pane

private struct ContentbaseQueryPane: View {
    @ObservedObject var model: ContentbaseContent
    let color: Color
    @FocusState private var focused: String?

    private var p: KitPalette { Theme.palette }
    private var paths: [ContentbaseResult.Path] { model.result?.paths ?? [] }
    private var ops: [String] { model.result?.ops ?? ["eq", "neq", "in", "notIn", "gt", "gte", "lt", "lte", "contains", "startsWith", "endsWith", "regex", "exists"] }

    var body: some View {
        VStack(alignment: .leading, spacing: WorkbenchStyle.Gap.section) {
            builder
            results
        }
        .onChange(of: model.focusTick) { _, _ in
            if let last = model.filters.last { focused = "value-\(last.id)" }
        }
    }

    private var builder: some View {
        WorkbenchCard(tint: color) {
            VStack(alignment: .leading, spacing: WorkbenchStyle.Gap.row) {
                if let raw = model.rawWhere {
                    HStack(spacing: KitTokens.Space.s4) {
                        Text("where").font(WorkbenchStyle.ui(KitTokens.TypeScale.sm, weight: .semibold)).foregroundStyle(p.textMuted.color)
                        Text(raw).font(WorkbenchStyle.code(KitTokens.TypeScale.sm)).foregroundStyle(p.textBody.color).textSelection(.enabled)
                        Spacer(minLength: 0)
                        Button("back to rows") { model.rawWhere = nil }.buttonStyle(.plain).font(WorkbenchStyle.body).foregroundStyle(p.accent.color)
                    }
                } else {
                    if model.filters.isEmpty {
                        Text("Every \(model.selected ?? "") document.").font(WorkbenchStyle.body).foregroundStyle(p.textMuted.color)
                    }
                    ForEach(Array($model.filters.enumerated()), id: \.element.id) { index, $filter in
                        filterRow($filter, first: index == 0)
                    }
                    ForEach(Array($model.sorts.enumerated()), id: \.element.id) { index, $sort in
                        sortRow($sort, first: index == 0)
                    }
                    HStack(spacing: KitTokens.Space.s7) {
                        CbAddButton(title: "Where", action: "lucaContentbase.addFilter", hints: model.hints) { model.addFilter() }
                        CbAddButton(title: "Sort by", action: "lucaContentbase.addSort", hints: model.hints) { model.addSort() }
                        columnsMenu
                        Spacer(minLength: 0)
                    }
                }
            }
        }
    }

    private func pathColor(_ key: String) -> Color {
        WorkbenchStyle.fieldColor(model.path(key)?.kind ?? "value")
    }

    private func filterRow(_ filter: Binding<ContentbaseFilter>, first: Bool) -> some View {
        let f = filter.wrappedValue
        let options = model.path(f.path)?.options ?? []
        return HStack(spacing: KitTokens.Space.s4) {
            Text(first ? "where" : "and").font(WorkbenchStyle.ui(KitTokens.TypeScale.sm, weight: .semibold))
                .foregroundStyle(p.textMuted.color).frame(width: 66, alignment: .trailing)
            CbMenu(value: f.path, options: paths.map(\.key), tint: pathColor(f.path)) { filter.wrappedValue.path = $0 }
            CbMenu(value: f.op, options: ops, label: ContentbaseContent.opLabel, tint: p.syntax.keyword.color) { filter.wrappedValue.op = $0 }
            if f.op == "exists" {
                CbMenu(value: f.value.isEmpty ? "true" : f.value, options: ["true", "false"], tint: WorkbenchStyle.fieldColor("boolean")) { filter.wrappedValue.value = $0 }
            } else if !options.isEmpty, f.op == "eq" || f.op == "neq" {
                CbMenu(value: f.value, options: options, tint: WorkbenchStyle.fieldColor("enum")) { filter.wrappedValue.value = $0 }
            } else {
                CbTextField(placeholder: f.op == "in" || f.op == "notIn" ? "a, b, c" : "value", text: filter.value, width: 240,
                            tint: pathColor(f.path), focus: $focused, focusId: "value-\(f.id)")
            }
            CbIconButton(systemName: "xmark", help: "remove") { model.filters.removeAll { $0.id == f.id } }
            Spacer(minLength: 0)
        }
    }

    private func sortRow(_ sort: Binding<ContentbaseSort>, first: Bool) -> some View {
        let s = sort.wrappedValue
        return HStack(spacing: KitTokens.Space.s4) {
            Text(first ? "sort by" : "then").font(WorkbenchStyle.ui(KitTokens.TypeScale.sm, weight: .semibold))
                .foregroundStyle(p.textMuted.color).frame(width: 66, alignment: .trailing)
            CbMenu(value: s.path, options: paths.filter { !$0.key.hasPrefix("sections.") }.map(\.key), tint: pathColor(s.path)) { sort.wrappedValue.path = $0 }
            CbMenu(value: s.direction, options: ["asc", "desc"], label: { $0 == "asc" ? "ascending" : "descending" }, tint: p.syntax.keyword.color) {
                sort.wrappedValue.direction = $0
            }
            CbIconButton(systemName: "xmark", help: "remove") { model.sorts.removeAll { $0.id == s.id } }
            Spacer(minLength: 0)
        }
    }

    private var columnsMenu: some View {
        Menu {
            ForEach(paths.filter { $0.key != "title" }) { path in
                Button { model.toggleColumn(path.key) } label: {
                    if model.shownColumn(path.key) { Label(path.key, systemImage: "checkmark") } else { Text(path.key) }
                }
            }
        } label: {
            HStack(spacing: KitTokens.Space.s3) {
                Image(systemName: "rectangle.split.3x1")
                Text("Columns")
            }
            .font(WorkbenchStyle.ui(KitTokens.TypeScale.sm, weight: .semibold))
            .foregroundStyle(p.accent.color)
        }
        .menuStyle(.button)
        .buttonStyle(.plain)
        .fixedSize()
    }

    // MARK: Results

    @ViewBuilder private var results: some View {
        if let r = model.result {
            if !r.ok {
                WorkbenchCard(tint: p.bad.color) {
                    Text(r.error ?? "The query failed").font(WorkbenchStyle.body).foregroundStyle(p.bad.color).textSelection(.enabled)
                }
            } else {
                VStack(alignment: .leading, spacing: WorkbenchStyle.Gap.row) {
                    HStack(spacing: KitTokens.Space.s5) {
                        WorkbenchSectionTitle(title: "Results", note: summary(r), count: r.total, color: color)
                        if model.querying { ProgressView().controlSize(.small) }
                        Button { model.copyCode() } label: {
                            HStack(spacing: KitTokens.Space.s3) {
                                Image(systemName: "doc.on.doc")
                                Text("Copy as code")
                                BoundKey(action: "lucaContentbase.copy")
                            }
                            .font(WorkbenchStyle.body).foregroundStyle(p.accent.color)
                        }
                        .buttonStyle(.plain)
                    }
                    table(r)
                    if let code = r.code {
                        Text(code).font(WorkbenchStyle.code(KitTokens.TypeScale.xs)).foregroundStyle(p.textFaint.color).textSelection(.enabled)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
        } else if model.querying {
            ProgressView().controlSize(.small)
        }
    }

    private func summary(_ r: ContentbaseResult) -> String {
        let shown = r.count ?? 0
        let total = r.total ?? 0
        let time = r.ms.map { " · \($0) ms" } ?? ""
        return shown < total ? "first \(shown) of \(total)\(time)" : "\(total) document\(total == 1 ? "" : "s")\(time)"
    }

    private func table(_ r: ContentbaseResult) -> some View {
        let columns = r.columns ?? []
        let rows = r.rows ?? []
        return ScrollView(.horizontal) {
            Grid(alignment: .leadingFirstTextBaseline, horizontalSpacing: 0, verticalSpacing: 0) {
                GridRow {
                    headerCell("title")
                    ForEach(columns) { headerCell($0.title, kind: $0.kind) }
                }
                .background(p.inset.color)
                if rows.isEmpty {
                    GridRow {
                        Text("No documents match.").font(WorkbenchStyle.body).foregroundStyle(p.textFaint.color)
                            .padding(KitTokens.Space.s5)
                            .gridCellColumns(columns.count + 1)
                    }
                }
                ForEach(Array(rows.enumerated()), id: \.element.id) { index, row in
                    GridRow {
                        Button { model.openRow(row) } label: {
                            VStack(alignment: .leading, spacing: 1) {
                                Text(row.title).font(WorkbenchStyle.ui(KitTokens.TypeScale.sm, weight: .semibold)).foregroundStyle(color)
                                Text(row.id).font(WorkbenchStyle.code(KitTokens.TypeScale.xs)).foregroundStyle(p.textFaint.color)
                            }
                            .frame(minWidth: 180, maxWidth: 300, alignment: .leading)
                            .padding(.horizontal, KitTokens.Space.s5)
                            .padding(.vertical, KitTokens.Space.s4)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .help("Open \(row.id)")
                        ForEach(Array(row.cells.enumerated()), id: \.offset) { _, cell in
                            ContentbaseCellView(cell: cell)
                                .frame(minWidth: 90, maxWidth: 280, alignment: .leading)
                                .padding(.horizontal, KitTokens.Space.s5)
                                .padding(.vertical, KitTokens.Space.s4)
                        }
                    }
                    .background(index % 2 == 1 ? p.inset.color.opacity(0.4) : Color.clear)
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: KitTokens.Radius.md))
            .overlay(RoundedRectangle(cornerRadius: KitTokens.Radius.md).stroke(p.border.color))
        }
    }

    private func headerCell(_ title: String, kind: String? = nil) -> some View {
        HStack(spacing: KitTokens.Space.s2) {
            if let kind { Circle().fill(WorkbenchStyle.fieldColor(kind)).frame(width: 6, height: 6) }
            Text(title).font(WorkbenchStyle.ui(KitTokens.TypeScale.xs, weight: .semibold)).foregroundStyle(p.textMuted.color)
        }
        .padding(.horizontal, KitTokens.Space.s5)
        .padding(.vertical, KitTokens.Space.s3)
    }
}

/// One table cell, drawn by its kind: lists as chips, an unset value faint.
private struct ContentbaseCellView: View {
    let cell: ContentbaseResult.Cell

    private var p: KitPalette { Theme.palette }

    var body: some View {
        let tint = WorkbenchStyle.fieldColor(cell.kind)
        if cell.kind == "array" {
            if cell.items.isEmpty {
                Text("[]").font(WorkbenchStyle.code(KitTokens.TypeScale.xs)).foregroundStyle(p.textFaint.color)
            } else {
                VStack(alignment: .leading, spacing: 2) {
                    ForEach(Array(cell.items.prefix(6).enumerated()), id: \.offset) { _, item in
                        Text(item).font(WorkbenchStyle.code(KitTokens.TypeScale.xs)).foregroundStyle(tint).lineLimit(1)
                            .padding(.horizontal, KitTokens.Space.s3).padding(.vertical, 1)
                            .background(Capsule().fill(tint.opacity(0.12)))
                    }
                    if cell.items.count > 6 {
                        Text("+\(cell.items.count - 6) more").font(WorkbenchStyle.meta).foregroundStyle(p.textFaint.color)
                    }
                }
            }
        } else if let text = cell.text {
            if cell.kind == "enum" {
                Text(text).font(WorkbenchStyle.code(KitTokens.TypeScale.xs, weight: .semibold)).foregroundStyle(tint)
                    .padding(.horizontal, KitTokens.Space.s3).padding(.vertical, 1)
                    .background(Capsule().fill(tint.opacity(0.15)))
            } else {
                Text(text).font(WorkbenchStyle.code(KitTokens.TypeScale.sm)).foregroundStyle(tint).lineLimit(4)
                    .textSelection(.enabled)
            }
        } else {
            Text("—").font(WorkbenchStyle.code(KitTokens.TypeScale.sm)).foregroundStyle(p.textFaint.color)
        }
    }
}
