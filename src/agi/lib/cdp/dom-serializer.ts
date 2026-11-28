/**
 * Turns the enhanced DOM tree into the indexed text an agent reads.
 *
 * Port of browser_use/dom/serializer/{serializer,clickable_elements,paint_order}.py
 * and service.py _count_hidden_elements_in_iframes (browser-use 0.12.2).
 * The output must match the Python byte for byte, because agents learn its
 * shape and `click <index>` depends on the same elements getting indices.
 */
import { DomNode, NodeType, hasAttrs, type CompoundChild, type Rect } from './dom-tree.js'

export const DEFAULT_INCLUDE_ATTRIBUTES = [
  'title', 'type', 'checked', 'id', 'name', 'role', 'value', 'placeholder', 'data-date-format', 'alt',
  'aria-label', 'aria-expanded', 'data-state', 'aria-checked', 'aria-valuemin', 'aria-valuemax',
  'aria-valuenow', 'aria-placeholder', 'pattern', 'min', 'max', 'minlength', 'maxlength', 'step',
  'accept', 'multiple', 'inputmode', 'autocomplete', 'aria-autocomplete', 'list', 'data-mask',
  'data-inputmask', 'data-datepicker', 'format', 'expected_format', 'contenteditable', 'pseudo',
  'checked', 'selected', 'expanded', 'pressed', 'disabled', 'invalid', 'valuemin', 'valuemax',
  'valuenow', 'keyshortcuts', 'haspopup', 'multiselectable', 'required', 'valuetext', 'level',
  'busy', 'live', 'ax_name',
]

const DISABLED_ELEMENTS = new Set(['style', 'script', 'head', 'meta', 'link', 'title'])
const SVG_ELEMENTS = new Set([
  'path', 'rect', 'g', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'use', 'defs',
  // Python lists 'clipPath' but compares against a lowercased name, so it never matches. Kept as-is.
  'clipPath', 'mask', 'pattern', 'image', 'text', 'tspan',
])

export class SimplifiedNode {
  children: SimplifiedNode[] = []
  shouldDisplay = true
  isInteractive = false
  isNew = false
  ignoredByPaintOrder = false
  excludedByParent = false
  isCompoundComponent = false
  constructor(public originalNode: DomNode, public isShadowHost = false) {}
}

export interface SerializedDomState {
  root: SimplifiedNode | null
  /** backendNodeId -> node. The index an agent sees IS the backendNodeId. */
  selectorMap: Map<number, DomNode>
}

// ---------------------------------------------------------------------------
// Small Python-compat helpers
// ---------------------------------------------------------------------------

/** str() of a Python float: 0 -> "0.0", 1.5 -> "1.5". */
function pyFloatStr(n: number): string {
  if (Number.isInteger(n)) return `${n}.0`
  return String(n)
}
function pyStr(v: any): string {
  if (typeof v === 'boolean') return v ? 'True' : 'False'
  if (v === null || v === undefined) return 'None'
  return String(v)
}
function capTextLength(text: string, max: number): string {
  const chars = [...text]
  if (chars.length <= max) return text
  return chars.slice(0, max).join('') + '...'
}
const isDigitStr = (s: string) => s.length > 0 && /^\d+$/.test(s)
const isUpperStr = (s: string) => /[A-Z]/.test(s) && s === s.toUpperCase()
const pyFloat = (s: string | undefined | null): number | null => {
  if (s === undefined || s === null) return null
  const t = String(s).trim()
  if (t === '' || !/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$|^[+-]?(inf|infinity|nan)$/i.test(t)) return null
  return parseFloat(t)
}

// ---------------------------------------------------------------------------
// Clickable detection (clickable_elements.py)
// ---------------------------------------------------------------------------

function hasFormControlDescendant(el: DomNode, maxDepth: number): boolean {
  if (maxDepth <= 0) return false
  for (const child of el.childrenAndShadowRoots) {
    if (child.nodeType !== NodeType.ELEMENT) continue
    if (['input', 'select', 'textarea'].includes(child.tagName)) return true
    if (hasFormControlDescendant(child, maxDepth - 1)) return true
  }
  return false
}

const SEARCH_INDICATORS = ['search', 'magnify', 'glass', 'lookup', 'find', 'query', 'search-icon', 'search-btn', 'search-button', 'searchbox']
const INTERACTIVE_TAGS = new Set(['button', 'input', 'select', 'textarea', 'a', 'details', 'summary', 'option', 'optgroup'])
const INTERACTIVE_ATTRS = ['onclick', 'onmousedown', 'onmouseup', 'onkeydown', 'onkeyup', 'tabindex']
const INTERACTIVE_ROLES = new Set(['button', 'link', 'menuitem', 'option', 'radio', 'checkbox', 'tab', 'textbox', 'combobox', 'slider', 'spinbutton', 'search', 'searchbox', 'row', 'cell', 'gridcell'])
const INTERACTIVE_AX_ROLES = new Set([...INTERACTIVE_ROLES, 'listbox'])

export function isInteractive(node: DomNode): boolean {
  if (node.nodeType !== NodeType.ELEMENT) return false
  if (node.tagName === 'html' || node.tagName === 'body') return false
  if (node.hasJsClickListener) return true

  const upper = node.tagName.toUpperCase()
  if (upper === 'IFRAME' || upper === 'FRAME') {
    const b = node.snapshotNode?.bounds
    if (b && b.width > 100 && b.height > 100) return true
  }

  if (node.tagName === 'label') {
    if (hasAttrs(node) && node.attributes['for']) return false
    if (hasFormControlDescendant(node, 2)) return true
  }
  if (node.tagName === 'span' && hasFormControlDescendant(node, 2)) return true

  if (hasAttrs(node)) {
    const classJoined = (node.attributes['class'] ?? '').toLowerCase().split(/\s+/).filter(Boolean).join(' ')
    if (SEARCH_INDICATORS.some((i) => classJoined.includes(i))) return true
    const id = (node.attributes['id'] ?? '').toLowerCase()
    if (SEARCH_INDICATORS.some((i) => id.includes(i))) return true
    for (const [k, v] of Object.entries(node.attributes)) {
      if (k.startsWith('data-') && SEARCH_INDICATORS.some((i) => v.toLowerCase().includes(i))) return true
    }
  }

  const props = node.axNode?.properties
  if (props) {
    for (const p of props) {
      if (p.name === 'disabled' && p.value) return false
      if (p.name === 'hidden' && p.value) return false
      if (['focusable', 'editable', 'settable'].includes(p.name) && p.value) return true
      if (['checked', 'expanded', 'pressed', 'selected'].includes(p.name)) return true
      if (['required', 'autocomplete'].includes(p.name) && p.value) return true
      if (p.name === 'keyshortcuts' && p.value) return true
    }
  }

  if (INTERACTIVE_TAGS.has(node.tagName)) return true

  if (hasAttrs(node)) {
    if (INTERACTIVE_ATTRS.some((a) => a in node.attributes)) return true
    if ('role' in node.attributes && INTERACTIVE_ROLES.has(node.attributes['role']!)) return true
  }
  if (node.axNode?.role && INTERACTIVE_AX_ROLES.has(node.axNode.role)) return true

  const b = node.snapshotNode?.bounds
  if (b && b.width >= 10 && b.width <= 50 && b.height >= 10 && b.height <= 50 && hasAttrs(node)) {
    if (['class', 'role', 'onclick', 'data-action', 'aria-label'].some((a) => a in node.attributes)) return true
  }

  if (node.snapshotNode?.cursorStyle === 'pointer') return true
  return false
}

// ---------------------------------------------------------------------------
// Hidden content hints for iframes (service.py)
// ---------------------------------------------------------------------------

export function countHiddenElementsInIframes(root: DomNode) {
  const hiddenByThreshold = (el: DomNode) => {
    if (el.isVisible || !el.snapshotNode || !el.snapshotNode.bounds) return false
    const s = el.snapshotNode.computedStyles || {}
    let cssHidden = (s['display'] ?? '').toLowerCase() === 'none' || (s['visibility'] ?? '').toLowerCase() === 'hidden'
    const op = parseFloat(s['opacity'] ?? '1')
    if (!Number.isNaN(op)) cssHidden = cssHidden || op <= 0
    return !cssHidden
  }
  const collect = (n: DomNode, vh: number): { tag: string; text: string; pages: number }[] => {
    const out: { tag: string; text: string; pages: number }[] = []
    if (n.nodeType === NodeType.ELEMENT && isInteractive(n) && hiddenByThreshold(n)) {
      let text = ''
      if (n.axNode?.name) text = [...n.axNode.name].slice(0, 40).join('')
      else if (hasAttrs(n)) text = [...(n.attributes['placeholder'] || n.attributes['title'] || n.attributes['aria-label'] || '')].slice(0, 40).join('')
      const y = n.snapshotNode?.bounds?.y ?? 0
      out.push({ tag: n.tagName || '?', text: text || '(no label)', pages: vh > 0 ? Math.round((y / vh) * 10) / 10 : 0 })
    }
    for (const c of n.childrenNodes || []) out.push(...collect(c, vh))
    for (const s of n.shadowRoots || []) out.push(...collect(s, vh))
    return out
  }
  const anyHidden = (n: DomNode): boolean => {
    if (hiddenByThreshold(n)) return true
    for (const c of n.childrenNodes || []) if (anyHidden(c)) return true
    for (const s of n.shadowRoots || []) if (anyHidden(s)) return true
    return false
  }
  const visit = (n: DomNode) => {
    const up = n.tagName.toUpperCase()
    if (n.nodeType === NodeType.ELEMENT && (up === 'IFRAME' || up === 'FRAME') && n.contentDocument) {
      const vh = n.snapshotNode?.clientRects?.height ?? 0
      const hidden = collect(n.contentDocument, vh).sort((a, b) => a.pages - b.pages)
      n.hiddenElementsInfo = hidden.slice(0, 10)
      if (!hidden.length && anyHidden(n.contentDocument)) n.hasHiddenContent = true
    }
    for (const c of n.childrenNodes || []) visit(c)
    if (n.contentDocument) visit(n.contentDocument)
    for (const s of n.shadowRoots || []) visit(s)
  }
  visit(root)
}

// ---------------------------------------------------------------------------
// Paint order filtering (paint_order.py)
// ---------------------------------------------------------------------------

interface R { x1: number; y1: number; x2: number; y2: number }
const rIntersects = (a: R, b: R) => !(a.x2 <= b.x1 || b.x2 <= a.x1 || a.y2 <= b.y1 || b.y2 <= a.y1)
const rContains = (a: R, b: R) => a.x1 <= b.x1 && a.y1 <= b.y1 && a.x2 >= b.x2 && a.y2 >= b.y2

class RectUnion {
  private rects: R[] = []
  private static MAX = 5000

  private splitDiff(a: R, b: R): R[] {
    const parts: R[] = []
    if (a.y1 < b.y1) parts.push({ x1: a.x1, y1: a.y1, x2: a.x2, y2: b.y1 })
    if (b.y2 < a.y2) parts.push({ x1: a.x1, y1: b.y2, x2: a.x2, y2: a.y2 })
    const yLo = Math.max(a.y1, b.y1)
    const yHi = Math.min(a.y2, b.y2)
    if (a.x1 < b.x1) parts.push({ x1: a.x1, y1: yLo, x2: b.x1, y2: yHi })
    if (b.x2 < a.x2) parts.push({ x1: b.x2, y1: yLo, x2: a.x2, y2: yHi })
    return parts
  }

  contains(r: R): boolean {
    if (!this.rects.length) return false
    let stack = [r]
    for (const s of this.rects) {
      const next: R[] = []
      for (const piece of stack) {
        if (rContains(s, piece)) continue
        if (rIntersects(piece, s)) next.push(...this.splitDiff(piece, s))
        else next.push(piece)
      }
      if (!next.length) return true
      stack = next
    }
    return false
  }

  add(r: R): boolean {
    if (this.rects.length >= RectUnion.MAX) return false
    if (this.contains(r)) return false
    let pending = [r]
    for (const s of this.rects) {
      const next: R[] = []
      for (const piece of pending) {
        if (rIntersects(piece, s)) next.push(...this.splitDiff(piece, s))
        else next.push(piece)
      }
      pending = next
    }
    this.rects.push(...pending)
    return true
  }
}

function calculatePaintOrder(root: SimplifiedNode) {
  const all: SimplifiedNode[] = []
  const collect = (n: SimplifiedNode) => {
    const sn = n.originalNode.snapshotNode
    if (sn && sn.paintOrder !== null && sn.bounds) all.push(n)
    for (const c of n.children) collect(c)
  }
  collect(root)

  const groups = new Map<number, SimplifiedNode[]>()
  for (const n of all) {
    const po = n.originalNode.snapshotNode!.paintOrder!
    if (!groups.has(po)) groups.set(po, [])
    groups.get(po)!.push(n)
  }
  const union = new RectUnion()
  for (const po of [...groups.keys()].sort((a, b) => b - a)) {
    const toAdd: R[] = []
    for (const n of groups.get(po)!) {
      const sn = n.originalNode.snapshotNode!
      const b = sn.bounds!
      const rect = { x1: b.x, y1: b.y, x2: b.x + b.width, y2: b.y + b.height }
      if (union.contains(rect)) n.ignoredByPaintOrder = true
      const cs = sn.computedStyles
      // Transparent or faded layers don't hide what's under them.
      if (cs && (cs['background-color'] ?? 'rgba(0, 0, 0, 0)') === 'rgba(0, 0, 0, 0)') continue
      if (cs && parseFloat(cs['opacity'] ?? '1') < 0.8) continue
      toAdd.push(rect)
    }
    for (const r of toAdd) union.add(r)
  }
}

// ---------------------------------------------------------------------------
// The serializer (serializer.py DOMTreeSerializer)
// ---------------------------------------------------------------------------

const PROPAGATING_ELEMENTS: { tag: string; role: string | null }[] = [
  { tag: 'a', role: null },
  { tag: 'button', role: null },
  { tag: 'div', role: 'button' },
  { tag: 'div', role: 'combobox' },
  { tag: 'span', role: 'button' },
  { tag: 'span', role: 'combobox' },
  { tag: 'input', role: 'combobox' },
]
const isPropagating = (tag: string, role: string | null) =>
  PROPAGATING_ELEMENTS.some((p) => p.tag === tag && (p.role === null || p.role === role))

export interface SerializeOptions {
  paintOrderFiltering?: boolean
  bboxFiltering?: boolean
  containmentThreshold?: number
  sessionId?: string | null
}

export class DomTreeSerializer {
  private selectorMap = new Map<number, DomNode>()
  private clickableCache = new Map<number, boolean>()
  private paintOrderFiltering: boolean
  private bboxFiltering: boolean
  private containmentThreshold: number
  private sessionId: string | null

  constructor(private root: DomNode, opts: SerializeOptions = {}) {
    this.paintOrderFiltering = opts.paintOrderFiltering ?? true
    this.bboxFiltering = opts.bboxFiltering ?? true
    this.containmentThreshold = opts.containmentThreshold ?? 0.99
    this.sessionId = opts.sessionId ?? null
  }

  serializeAccessibleElements(): SerializedDomState {
    this.selectorMap = new Map()
    this.clickableCache = new Map()
    const simplified = this.createSimplifiedTree(this.root)
    if (this.paintOrderFiltering && simplified) calculatePaintOrder(simplified)
    const optimized = this.optimizeTree(simplified)
    if (this.bboxFiltering && optimized) this.filterTreeRecursive(optimized, null)
    this.assignIndices(optimized)
    return { root: optimized, selectorMap: this.selectorMap }
  }

  private interactive(n: DomNode): boolean {
    let v = this.clickableCache.get(n.nodeId)
    if (v === undefined) { v = isInteractive(n); this.clickableCache.set(n.nodeId, v) }
    return v
  }

  private createSimplifiedTree(node: DomNode): SimplifiedNode | null {
    if (node.nodeType === NodeType.DOCUMENT) {
      for (const c of node.childrenAndShadowRoots) {
        const s = this.createSimplifiedTree(c)
        if (s) return s
      }
      return null
    }
    if (node.nodeType === NodeType.DOCUMENT_FRAGMENT) {
      const s = new SimplifiedNode(node)
      for (const c of node.childrenAndShadowRoots) {
        const sc = this.createSimplifiedTree(c)
        if (sc) s.children.push(sc)
      }
      return s
    }
    if (node.nodeType === NodeType.ELEMENT) {
      const lname = node.nodeName.toLowerCase()
      if (DISABLED_ELEMENTS.has(lname) || SVG_ELEMENTS.has(lname)) return null

      let exclude: string | undefined
      if (this.sessionId) exclude = node.attributes[`data-browser-use-exclude-${this.sessionId}`]
      if (!exclude) exclude = node.attributes['data-browser-use-exclude']
      if (typeof exclude === 'string' && exclude.toLowerCase() === 'true') return null

      if (node.nodeName === 'IFRAME' || node.nodeName === 'FRAME') {
        if (node.contentDocument) {
          const s = new SimplifiedNode(node)
          for (const c of node.contentDocument.childrenNodes || []) {
            const sc = this.createSimplifiedTree(c)
            if (sc) s.children.push(sc)
          }
          return s
        }
      }

      let isVisible = !!node.isVisible
      const isScrollable = node.isActuallyScrollable
      const kids = node.childrenAndShadowRoots
      const hasShadowContent = kids.length > 0
      const isShadowHost = kids.some((c) => c.nodeType === NodeType.DOCUMENT_FRAGMENT)

      if (!isVisible && hasAttrs(node) && Object.keys(node.attributes).some((a) => a.startsWith('aria-') || a.startsWith('pseudo'))) isVisible = true
      const isFileInput = node.tagName === 'input' && hasAttrs(node) && node.attributes['type'] === 'file'
      if (!isVisible && isFileInput) isVisible = true

      if (isVisible || isScrollable || hasShadowContent || isShadowHost) {
        const s = new SimplifiedNode(node, isShadowHost)
        for (const c of kids) {
          const sc = this.createSimplifiedTree(c)
          if (sc) s.children.push(sc)
        }
        this.addCompoundComponents(s, node)
        if (isShadowHost && s.children.length) return s
        if (isVisible || isScrollable || s.children.length) return s
      }
      return null
    }
    if (node.nodeType === NodeType.TEXT) {
      const v = node.nodeValue?.trim()
      if (node.snapshotNode && node.isVisible && v && v.length > 1) return new SimplifiedNode(node)
    }
    return null
  }

  private optimizeTree(node: SimplifiedNode | null): SimplifiedNode | null {
    if (!node) return null
    const kept: SimplifiedNode[] = []
    for (const c of node.children) {
      const o = this.optimizeTree(c)
      if (o) kept.push(o)
    }
    node.children = kept
    const o = node.originalNode
    const isVisible = !!(o.snapshotNode && o.isVisible)
    const isFileInput = o.tagName === 'input' && hasAttrs(o) && o.attributes['type'] === 'file'
    if (isVisible || o.isActuallyScrollable || o.nodeType === NodeType.TEXT || node.children.length || isFileInput) return node
    return null
  }

  private hasInteractiveDescendants(node: SimplifiedNode): boolean {
    for (const c of node.children) {
      if (this.interactive(c.originalNode)) return true
      if (this.hasInteractiveDescendants(c)) return true
    }
    return false
  }

  private isInsideShadowDom(node: SimplifiedNode): boolean {
    let cur = node.originalNode.parentNode
    while (cur) {
      if (cur.nodeType === NodeType.DOCUMENT_FRAGMENT && cur.shadowRootType !== null) return true
      cur = cur.parentNode
    }
    return false
  }

  private assignIndices(node: SimplifiedNode | null) {
    if (!node) return
    if (!node.excludedByParent && !node.ignoredByPaintOrder) {
      const o = node.originalNode
      const isInter = this.interactive(o)
      const isVisible = !!(o.snapshotNode && o.isVisible)
      const isScrollable = o.isActuallyScrollable
      const isFileInput = o.tagName === 'input' && hasAttrs(o) && o.attributes['type'] === 'file'
      const isShadowDomElement = isInter && !o.snapshotNode && ['input', 'button', 'select', 'textarea', 'a'].includes(o.tagName) && this.isInsideShadowDom(node)

      let make = false
      if (isScrollable) {
        const role = (o.attributes['role'] ?? '').toLowerCase()
        const classAttr = (o.attributes['class'] ?? '').toLowerCase()
        const classList = classAttr ? classAttr.split(/\s+/).filter(Boolean) : []
        const dropdown =
          ['listbox', 'menu', 'combobox', 'menubar', 'tree', 'grid'].includes(role) ||
          o.tagName === 'select' ||
          classList.includes('dropdown') || classList.includes('dropdown-menu') || classList.includes('select-menu') ||
          (classList.includes('ui') && classAttr.includes('dropdown'))
        // Scroll containers get an index only when nothing inside them has one.
        make = dropdown || !this.hasInteractiveDescendants(node)
      } else if (isInter && (isVisible || isFileInput || isShadowDomElement)) {
        make = true
      }
      if (make) {
        node.isInteractive = true
        this.selectorMap.set(o.backendNodeId, o)
        if (node.isCompoundComponent) node.isNew = true
      }
    }
    for (const c of node.children) this.assignIndices(c)
  }

  private filterTreeRecursive(node: SimplifiedNode, active: { bounds: Rect } | null) {
    if (active && this.shouldExcludeChild(node, active)) node.excludedByParent = true
    const tag = node.originalNode.tagName.toLowerCase()
    const role = node.originalNode.attributes['role'] ?? null
    let next = active
    const b = node.originalNode.snapshotNode?.bounds
    if (isPropagating(tag, role) && b) next = { bounds: b }
    for (const c of node.children) this.filterTreeRecursive(c, next)
  }

  private shouldExcludeChild(node: SimplifiedNode, active: { bounds: Rect }): boolean {
    const o = node.originalNode
    if (o.nodeType === NodeType.TEXT) return false
    const cb = o.snapshotNode?.bounds
    if (!cb) return false
    if (!isContained(cb, active.bounds, this.containmentThreshold)) return false
    const tag = o.tagName.toLowerCase()
    const role = o.attributes['role'] ?? null
    if (['input', 'select', 'textarea', 'label'].includes(tag)) return false
    if (isPropagating(tag, role)) return false
    if ('onclick' in o.attributes) return false
    const aria = o.attributes['aria-label']
    if (aria && aria.trim()) return false
    if (role && ['button', 'link', 'checkbox', 'radio', 'tab', 'menuitem', 'option'].includes(role)) return false
    return true
  }

  // --- compound components --------------------------------------------------

  private addCompoundComponents(s: SimplifiedNode, node: DomNode) {
    const tag = node.tagName
    if (!['input', 'select', 'details', 'audio', 'video'].includes(tag)) return
    if (tag === 'input') {
      if (!hasAttrs(node) || !['date', 'time', 'datetime-local', 'month', 'week', 'range', 'number', 'color', 'file'].includes(node.attributes['type']!)) return
    } else if (!node.axNode || !node.axNode.childIds) {
      return
    }
    const inputType = node.attributes['type'] ?? ''
    const c = (role: string, name: string, valuemin: any = null, valuemax: any = null, valuenow: any = null): CompoundChild => ({ role, name, valuemin, valuemax, valuenow })

    if (tag === 'input') {
      if (['date', 'time', 'datetime-local', 'month', 'week'].includes(inputType)) return
      if (inputType === 'range') {
        const min = pyFloat(node.attributes['min'] ?? '0') ?? 0
        const max = pyFloat(node.attributes['max'] ?? '100') ?? 100
        node.compoundChildren.push(c('slider', 'Value', pyFloatStr(min), pyFloatStr(max)))
      } else if (inputType === 'number') {
        const min = pyFloat(node.attributes['min'])
        const max = pyFloat(node.attributes['max'])
        node.compoundChildren.push(c('button', 'Increment'), c('button', 'Decrement'), c('textbox', 'Value', min === null ? null : pyFloatStr(min), max === null ? null : pyFloatStr(max)))
      } else if (inputType === 'color') {
        node.compoundChildren.push(c('textbox', 'Hex Value'), c('button', 'Color Picker'))
      } else if (inputType === 'file') {
        const multiple = 'multiple' in node.attributes
        let current = 'None'
        for (const p of node.axNode?.properties || []) {
          if (p.name === 'valuetext' && p.value) {
            const v = pyStr(p.value).trim()
            if (v && !['', 'no file chosen', 'no file selected'].includes(v.toLowerCase())) current = v
            break
          } else if (p.name === 'value' && p.value) {
            const v = pyStr(p.value).trim()
            if (v) {
              current = v.includes('\\') ? v.split('\\').pop()! : v.includes('/') ? v.split('/').pop()! : v
              break
            }
          }
        }
        node.compoundChildren.push(c('button', 'Browse Files'), c('textbox', `${multiple ? 'Files' : 'File'} Selected`, null, null, current))
      }
      s.isCompoundComponent = true
    } else if (tag === 'select') {
      const parts: CompoundChild[] = [c('button', 'Dropdown Toggle')]
      const info = extractSelectOptions(node)
      if (info) {
        const lb: CompoundChild = { ...c('listbox', 'Options'), options_count: info.count, first_options: info.firstOptions }
        if (info.formatHint) lb.format_hint = info.formatHint
        parts.push(lb)
      } else {
        parts.push(c('listbox', 'Options'))
      }
      node.compoundChildren.push(...parts)
      s.isCompoundComponent = true
    } else if (tag === 'details') {
      node.compoundChildren.push(c('button', 'Toggle Disclosure'), c('region', 'Content Area'))
      s.isCompoundComponent = true
    } else if (tag === 'audio' || tag === 'video') {
      node.compoundChildren.push(c('button', 'Play/Pause'), c('slider', 'Progress', 0, 100), c('button', 'Mute'), c('slider', 'Volume', 0, 100))
      if (tag === 'video') node.compoundChildren.push(c('button', 'Fullscreen'))
      s.isCompoundComponent = true
    }
  }

  // --- text output --------------------------------------------------------------

  static serializeTree(node: SimplifiedNode | null, include: string[], depth = 0): string {
    if (!node) return ''
    const o = node.originalNode
    if (node.excludedByParent) {
      return node.children.map((c) => DomTreeSerializer.serializeTree(c, include, depth)).filter(Boolean).join('\n')
    }
    const out: string[] = []
    const pad = '\t'.repeat(depth)
    let nextDepth = depth

    const shadowPrefix = () => {
      if (!node.isShadowHost) return ''
      const closed = node.children.some((c) => c.originalNode.nodeType === NodeType.DOCUMENT_FRAGMENT && c.originalNode.shadowRootType?.toLowerCase() === 'closed')
      return closed ? '|SHADOW(closed)|' : '|SHADOW(open)|'
    }

    if (o.nodeType === NodeType.ELEMENT) {
      if (!node.shouldDisplay) {
        return node.children.map((c) => DomTreeSerializer.serializeTree(c, include, depth)).filter(Boolean).join('\n')
      }
      if (o.tagName === 'svg') {
        let line = `${pad}${shadowPrefix()}`
        if (node.isInteractive) line += `${node.isNew ? '*' : ''}[${o.backendNodeId}]`
        line += '<svg'
        const attrs = buildAttributesString(o, include, '')
        if (attrs) line += ` ${attrs}`
        line += ' /> <!-- SVG content collapsed -->'
        out.push(line)
        return out.join('\n')
      }

      const anyScrollable = o.isActuallyScrollable || !!o.isScrollable
      const showScroll = o.shouldShowScrollInfo
      const upper = o.tagName.toUpperCase()
      if (node.isInteractive || anyScrollable || upper === 'IFRAME' || upper === 'FRAME') {
        nextDepth += 1
        let attrs = buildAttributesString(o, include, '')
        if (o.compoundChildren.length) {
          const info: string[] = []
          for (const ci of o.compoundChildren) {
            const parts: string[] = []
            if (ci.name) parts.push(`name=${ci.name}`)
            if (ci.role) parts.push(`role=${ci.role}`)
            if (ci.valuemin !== null) parts.push(`min=${ci.valuemin}`)
            if (ci.valuemax !== null) parts.push(`max=${ci.valuemax}`)
            if (ci.valuenow !== null) parts.push(`current=${ci.valuenow}`)
            if (ci.options_count !== undefined && ci.options_count !== null) parts.push(`count=${ci.options_count}`)
            if (ci.first_options && ci.first_options.length) parts.push(`options=${ci.first_options.slice(0, 4).join('|')}`)
            if (ci.format_hint) parts.push(`format=${ci.format_hint}`)
            if (parts.length) info.push(`(${parts.join(',')})`)
          }
          if (info.length) {
            const compound = `compound_components=${info.join(',')}`
            attrs = attrs ? `${attrs} ${compound}` : compound
          }
        }
        const sp = shadowPrefix()
        let line: string
        if (showScroll && !node.isInteractive) line = `${pad}${sp}|scroll element|<${o.tagName}`
        else if (node.isInteractive) line = `${pad}${sp}${node.isNew ? '*' : ''}${showScroll ? '|scroll element[' : '['}${o.backendNodeId}]<${o.tagName}`
        else if (upper === 'IFRAME') line = `${pad}${sp}|IFRAME|<${o.tagName}`
        else if (upper === 'FRAME') line = `${pad}${sp}|FRAME|<${o.tagName}`
        else line = `${pad}${sp}<${o.tagName}`
        if (attrs) line += ` ${attrs}`
        line += ' />'
        if (showScroll) {
          const t = o.getScrollInfoText()
          if (t) line += ` (${t})`
        }
        out.push(line)
      }
    } else if (o.nodeType === NodeType.DOCUMENT_FRAGMENT) {
      out.push(o.shadowRootType?.toLowerCase() === 'closed' ? `${pad}Closed Shadow` : `${pad}Open Shadow`)
      nextDepth += 1
      for (const c of node.children) {
        const t = DomTreeSerializer.serializeTree(c, include, nextDepth)
        if (t) out.push(t)
      }
      if (node.children.length) out.push(`${pad}Shadow End`)
    } else if (o.nodeType === NodeType.TEXT) {
      const v = o.nodeValue?.trim()
      if (o.snapshotNode && o.isVisible && v && v.length > 1) out.push(`${pad}${v}`)
    }

    if (o.nodeType !== NodeType.DOCUMENT_FRAGMENT) {
      for (const c of node.children) {
        const t = DomTreeSerializer.serializeTree(c, include, nextDepth)
        if (t) out.push(t)
      }
      const upper = o.tagName.toUpperCase()
      if (o.nodeType === NodeType.ELEMENT && (upper === 'IFRAME' || upper === 'FRAME')) {
        if (o.hiddenElementsInfo && o.hiddenElementsInfo.length) {
          out.push(`${pad}... (${o.hiddenElementsInfo.length} more elements below - scroll to reveal):`)
          for (const e of o.hiddenElementsInfo) out.push(`${pad}    <${e.tag}> "${e.text}" ~${pyFloatStr(e.pages)} pages down`)
        } else if (o.hasHiddenContent) {
          out.push(`${pad}... (more content below viewport - scroll to reveal)`)
        }
      }
    }
    return out.join('\n')
  }
}

function isContained(child: Rect, parent: Rect, threshold: number): boolean {
  const xo = Math.max(0, Math.min(child.x + child.width, parent.x + parent.width) - Math.max(child.x, parent.x))
  const yo = Math.max(0, Math.min(child.y + child.height, parent.y + parent.height) - Math.max(child.y, parent.y))
  const area = child.width * child.height
  if (area === 0) return false
  return (xo * yo) / area >= threshold
}

function extractSelectOptions(select: DomNode) {
  if (!select.children.length) return null
  const options: { text: string; value: string }[] = []
  const values: string[] = []
  const walk = (n: DomNode) => {
    const t = n.tagName.toLowerCase()
    if (t === 'option') {
      let value = 'value' in n.attributes ? String(n.attributes['value']).trim() : ''
      let text = ''
      for (const c of n.children) if (c.nodeType === NodeType.TEXT && c.nodeValue) text += c.nodeValue.trim() + ' '
      text = text.trim()
      if (!value && text) value = text
      if (text || value) { options.push({ text, value }); values.push(value) }
    } else {
      for (const c of n.children) walk(c)
    }
  }
  for (const c of select.children) walk(c)
  if (!options.length) return null

  const firstOptions: string[] = []
  for (const o of options.slice(0, 4)) {
    const d = o.text || o.value
    if (d) {
      const chars = [...d]
      firstOptions.push(chars.slice(0, 30).join('') + (chars.length > 30 ? '...' : ''))
    }
  }
  if (options.length > 4) firstOptions.push(`... ${options.length - 4} more options...`)

  let formatHint: string | null = null
  if (values.length >= 2) {
    const v5 = values.slice(0, 5).filter(Boolean)
    if (v5.every(isDigitStr)) formatHint = 'numeric'
    else if (v5.every((v) => [...v].length === 2 && isUpperStr(v))) formatHint = 'country/state codes'
    else if (v5.every((v) => v.includes('/') || v.includes('-'))) formatHint = 'date/path format'
    else if (v5.some((v) => v.includes('@'))) formatHint = 'email addresses'
  }
  return { count: options.length, firstOptions, formatHint }
}

const DATE_FORMATS: Record<string, string> = { date: 'YYYY-MM-DD', time: 'HH:MM', 'datetime-local': 'YYYY-MM-DDTHH:MM', month: 'YYYY-MM', week: 'YYYY-W##' }

export function buildAttributesString(node: DomNode, include: string[], text: string): string {
  // A Map keeps Python dict insertion order, including "update keeps position".
  const a = new Map<string, string>()
  for (const [k, v] of Object.entries(node.attributes)) {
    if (include.includes(k) && String(v).trim() !== '') a.set(k, String(v).trim())
  }

  if (node.tagName === 'input' && hasAttrs(node)) {
    const type = (node.attributes['type'] ?? '').toLowerCase()
    if (type in DATE_FORMATS) a.set('format', DATE_FORMATS[type]!)
    if (include.includes('placeholder') && !a.has('placeholder')) {
      if (type in DATE_FORMATS) a.set('placeholder', DATE_FORMATS[type]!)
      else if (type === 'tel' && !a.has('pattern')) a.set('placeholder', '123-456-7890')
      else if (type === 'text' || type === '') {
        const cls = (node.attributes['class'] ?? '').toLowerCase()
        if ('uib-datepicker-popup' in node.attributes) {
          const f = node.attributes['uib-datepicker-popup'] ?? ''
          if (f) { a.set('expected_format', f); a.set('format', f) }
        } else if (['datepicker', 'datetimepicker', 'daterangepicker'].some((i) => cls.includes(i)) || 'data-datepicker' in node.attributes) {
          const f = node.attributes['data-date-format'] ?? ''
          a.set('placeholder', f || 'mm/dd/yyyy')
          a.set('format', f || 'mm/dd/yyyy')
        }
      }
    }
  }

  // Never leak password values into a snapshot an LLM reads.
  const isPassword = node.tagName === 'input' && hasAttrs(node) && (node.attributes['type'] ?? '').toLowerCase() === 'password'

  for (const p of node.axNode?.properties || []) {
    if (!include.includes(p.name) || p.value === null || p.value === undefined) continue
    if (isPassword && (p.name === 'value' || p.name === 'valuetext')) continue
    if (typeof p.value === 'boolean') a.set(p.name, String(p.value))
    else {
      const s = pyStr(p.value).trim()
      if (s) a.set(p.name, s)
    }
  }

  if (['input', 'textarea', 'select'].includes(node.tagName)) {
    if (isPassword) a.delete('value')
    else {
      // The AX value tracks what was typed; the DOM attribute may be stale.
      for (const p of node.axNode?.properties || []) {
        if ((p.name === 'valuetext' || p.name === 'value') && p.value) {
          const s = pyStr(p.value).trim()
          if (s) { a.set('value', s); break }
        }
      }
    }
  }

  if (!a.size) return ''

  const ordered = include.filter((k) => a.has(k))
  if (ordered.length > 1) {
    const protectedAttrs = new Set(['format', 'expected_format', 'placeholder', 'value', 'aria-label', 'title'])
    const seen = new Map<string, string>()
    const remove = new Set<string>()
    for (const k of ordered) {
      const v = a.get(k)!
      if (v.length > 5) {
        if (seen.has(v) && !protectedAttrs.has(k)) remove.add(k)
        else seen.set(v, k)
      }
    }
    for (const k of remove) a.delete(k)
  }

  const role = node.axNode?.role
  if (role && node.nodeName === role) a.delete('role')
  if (a.has('type') && a.get('type')!.toLowerCase() === node.nodeName.toLowerCase()) a.delete('type')
  if (a.has('invalid') && a.get('invalid')!.toLowerCase() === 'false') a.delete('invalid')
  if (a.has('required') && ['false', '0', 'no'].includes(a.get('required')!.toLowerCase())) a.delete('required')
  if (a.has('expanded') && a.has('aria-expanded')) a.delete('aria-expanded')
  for (const k of ['aria-label', 'placeholder', 'title']) {
    if (a.get(k) && a.get(k)!.trim().toLowerCase() === text.trim().toLowerCase()) a.delete(k)
  }

  if (!a.size) return ''
  return [...a.entries()].map(([k, v]) => {
    const capped = capTextLength(v, 100)
    return capped ? `${k}=${capped}` : `${k}=''`
  }).join(' ')
}

export function llmRepresentation(state: SerializedDomState, include: string[] = DEFAULT_INCLUDE_ATTRIBUTES): string {
  if (!state.root) return 'Empty DOM tree (you might have to wait for the page to load)'
  return DomTreeSerializer.serializeTree(state.root, include)
}
