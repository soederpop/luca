/**
 * Builds browser-use's "enhanced" DOM tree from raw CDP data.
 *
 * Port of browser_use/dom/service.py, enhanced_snapshot.py and views.py
 * (browser-use 0.12.2). It joins three CDP views of one page by backendNodeId:
 * DOM.getDocument (structure), DOMSnapshot.captureSnapshot (layout, styles,
 * paint order) and Accessibility.getFullAXTree (roles, names, states).
 *
 * Gotcha for anyone comparing against the Python: Python treats an empty dict
 * or list as false. Here `attributes` is always an object, so emptiness checks
 * go through hasAttrs(), never a bare truthiness test.
 */
import type { CdpConnection } from './connection.js'

export const NodeType = {
  ELEMENT: 1,
  ATTRIBUTE: 2,
  TEXT: 3,
  CDATA: 4,
  ENTITY_REFERENCE: 5,
  ENTITY: 6,
  PROCESSING_INSTRUCTION: 7,
  COMMENT: 8,
  DOCUMENT: 9,
  DOCUMENT_TYPE: 10,
  DOCUMENT_FRAGMENT: 11,
  NOTATION: 12,
} as const

/** Order matters: snapshot styles come back as indices in this order. */
export const REQUIRED_COMPUTED_STYLES = [
  'display', 'visibility', 'opacity', 'overflow', 'overflow-x', 'overflow-y',
  'cursor', 'pointer-events', 'position', 'background-color',
]

export interface Rect { x: number; y: number; width: number; height: number }

export interface SnapshotNode {
  isClickable: boolean | null
  cursorStyle: string | null
  bounds: Rect | null
  clientRects: Rect | null
  scrollRects: Rect | null
  computedStyles: Record<string, string> | null
  paintOrder: number | null
}

export interface AXProperty { name: string; value: any }

export interface AXNodeInfo {
  axNodeId: string
  ignored: boolean
  role: string | null
  name: string | null
  description: string | null
  properties: AXProperty[] | null
  childIds: string[] | null
}

export interface CompoundChild {
  role: string
  name: string
  valuemin: number | string | null
  valuemax: number | string | null
  valuenow: string | null
  options_count?: number
  first_options?: string[]
  format_hint?: string | null
}

export interface HiddenElementInfo { tag: string; text: string; pages: number }

export class DomNode {
  nodeId!: number
  backendNodeId!: number
  nodeType!: number
  nodeName!: string
  nodeValue!: string
  attributes: Record<string, string> = {}
  isScrollable: boolean | null = null
  frameId: string | null = null
  sessionId: string | null = null
  contentDocument: DomNode | null = null
  shadowRootType: string | null = null
  shadowRoots: DomNode[] | null = null
  parentNode: DomNode | null = null
  childrenNodes: DomNode[] | null = null
  axNode: AXNodeInfo | null = null
  snapshotNode: SnapshotNode | null = null
  isVisible: boolean | null = null
  hasJsClickListener = false
  absolutePosition: Rect | null = null
  hiddenElementsInfo: HiddenElementInfo[] | null = null
  hasHiddenContent = false
  compoundChildren: CompoundChild[] = []

  get tagName(): string { return this.nodeName.toLowerCase() }
  get children(): DomNode[] { return this.childrenNodes || [] }
  get childrenAndShadowRoots(): DomNode[] {
    const out = this.childrenNodes ? [...this.childrenNodes] : []
    if (this.shadowRoots) out.push(...this.shadowRoots)
    return out
  }

  /** CDP's isScrollable plus a scroll-vs-client rect check for what CDP misses. */
  get isActuallyScrollable(): boolean {
    if (this.isScrollable) return true
    if (!this.snapshotNode) return false
    const { scrollRects: sr, clientRects: cr } = this.snapshotNode
    if (sr && cr) {
      const v = sr.height > cr.height + 1
      const h = sr.width > cr.width + 1
      if (v || h) {
        const styles = this.snapshotNode.computedStyles
        if (styles) {
          const overflow = (styles['overflow'] ?? 'visible').toLowerCase()
          const ox = (styles['overflow-x'] ?? overflow).toLowerCase()
          const oy = (styles['overflow-y'] ?? overflow).toLowerCase()
          const ok = ['auto', 'scroll', 'overlay']
          return ok.includes(overflow) || ok.includes(ox) || ok.includes(oy)
        }
        return ['div', 'main', 'section', 'article', 'aside', 'body', 'html'].includes(this.tagName)
      }
    }
    return false
  }

  /** Show scroll info only on the outermost scrollable, to avoid nested spam. */
  get shouldShowScrollInfo(): boolean {
    if (this.tagName === 'iframe') return true
    if (!(this.isScrollable || this.isActuallyScrollable)) return false
    if (this.tagName === 'body' || this.tagName === 'html') return true
    if (this.parentNode && (this.parentNode.isScrollable || this.parentNode.isActuallyScrollable)) return false
    return true
  }

  get scrollInfo() {
    if (!this.isActuallyScrollable || !this.snapshotNode) return null
    const sr = this.snapshotNode.scrollRects
    const cr = this.snapshotNode.clientRects
    if (!sr || !cr) return null
    const scrollTop = sr.y
    const scrollLeft = sr.x
    const contentAbove = Math.max(0, scrollTop)
    const contentBelow = Math.max(0, sr.height - cr.height - scrollTop)
    let hPct = 0
    if (sr.width > cr.width) {
      const maxLeft = sr.width - cr.width
      hPct = maxLeft > 0 ? (scrollLeft / maxLeft) * 100 : 0
    }
    let vPct = 0
    if (sr.height > cr.height) {
      const maxTop = sr.height - cr.height
      vPct = maxTop > 0 ? (scrollTop / maxTop) * 100 : 0
    }
    return {
      scrollableHeight: sr.height,
      scrollableWidth: sr.width,
      visibleHeight: cr.height,
      visibleWidth: cr.width,
      pagesAbove: pyRound(cr.height > 0 ? contentAbove / cr.height : 0, 1),
      pagesBelow: pyRound(cr.height > 0 ? contentBelow / cr.height : 0, 1),
      verticalPct: pyRound(vPct, 1),
      horizontalPct: pyRound(hPct, 1),
    }
  }

  getScrollInfoText(): string {
    if (this.tagName === 'iframe') {
      const html = this.findHtmlInContentDocument()
      const info = html?.scrollInfo
      if (info && (info.pagesBelow > 0 || info.pagesAbove > 0)) {
        return `scroll: ${info.pagesAbove.toFixed(1)}↑ ${info.pagesBelow.toFixed(1)}↓ ${Math.trunc(info.verticalPct)}%`
      }
      return 'scroll'
    }
    const info = this.scrollInfo
    if (!info) return ''
    const parts: string[] = []
    if (info.scrollableHeight > info.visibleHeight) {
      parts.push(`${info.pagesAbove.toFixed(1)} pages above, ${info.pagesBelow.toFixed(1)} pages below`)
    }
    if (info.scrollableWidth > info.visibleWidth) parts.push(`horizontal ${info.horizontalPct.toFixed(0)}%`)
    return parts.join(' ')
  }

  private findHtmlInContentDocument(): DomNode | null {
    const doc = this.contentDocument
    if (!doc) return null
    if (doc.tagName === 'html') return doc
    for (const c of doc.childrenNodes || []) if (c.tagName === 'html') return c
    return null
  }
}

export const hasAttrs = (n: DomNode) => Object.keys(n.attributes).length > 0

/** Python's round(): half-to-even. Matters only at exact .x5 ties. */
export function pyRound(n: number, digits: number): number {
  const m = 10 ** digits
  const v = n * m
  const f = Math.floor(v)
  const diff = v - f
  let r: number
  if (Math.abs(diff - 0.5) < 1e-9) r = f % 2 === 0 ? f : f + 1
  else r = Math.round(v)
  return r / m
}

// ---------------------------------------------------------------------------
// Snapshot lookup (enhanced_snapshot.py)
// ---------------------------------------------------------------------------

export function buildSnapshotLookup(snapshot: any, devicePixelRatio = 1): Map<number, SnapshotNode> {
  const lookup = new Map<number, SnapshotNode>()
  const strings: string[] = snapshot.strings
  for (const doc of snapshot.documents || []) {
    const nodes = doc.nodes
    const layout = doc.layout

    // First occurrence wins for duplicate layout entries, like the Python.
    const layoutIndexMap = new Map<number, number>()
    if (layout?.nodeIndex) {
      layout.nodeIndex.forEach((nodeIndex: number, layoutIdx: number) => {
        if (!layoutIndexMap.has(nodeIndex)) layoutIndexMap.set(nodeIndex, layoutIdx)
      })
    }
    const hasClickable = !!nodes.isClickable
    const clickable = new Set<number>(hasClickable ? nodes.isClickable.index : [])

    const backendIds: number[] = nodes.backendNodeId || []
    // Python builds a dict first, so a repeated backend id keeps its LAST index.
    const backendToIndex = new Map<number, number>()
    backendIds.forEach((b, i) => backendToIndex.set(b, i))

    for (const [backendNodeId, snapshotIndex] of backendToIndex) {
      const entry: SnapshotNode = {
        isClickable: hasClickable ? clickable.has(snapshotIndex) : null,
        cursorStyle: null,
        bounds: null,
        clientRects: null,
        scrollRects: null,
        computedStyles: null,
        paintOrder: null,
      }
      const layoutIdx = layoutIndexMap.get(snapshotIndex)
      if (layoutIdx !== undefined && layoutIdx < (layout.bounds?.length ?? 0)) {
        const b = layout.bounds[layoutIdx]
        if (b && b.length >= 4) {
          // Snapshot bounds are device pixels; divide to get CSS pixels.
          entry.bounds = { x: b[0] / devicePixelRatio, y: b[1] / devicePixelRatio, width: b[2] / devicePixelRatio, height: b[3] / devicePixelRatio }
        }
        if (layoutIdx < (layout.styles?.length ?? 0)) {
          const styles: Record<string, string> = {}
          ;(layout.styles[layoutIdx] as number[]).forEach((si, i) => {
            if (i < REQUIRED_COMPUTED_STYLES.length && si >= 0 && si < strings.length) styles[REQUIRED_COMPUTED_STYLES[i]!] = strings[si]!
          })
          if (Object.keys(styles).length) entry.computedStyles = styles
          entry.cursorStyle = styles['cursor'] ?? null
        }
        if (layoutIdx < (layout.paintOrders?.length ?? 0)) entry.paintOrder = layout.paintOrders[layoutIdx]
        const cr = layout.clientRects?.[layoutIdx]
        if (cr && cr.length >= 4) entry.clientRects = { x: cr[0], y: cr[1], width: cr[2], height: cr[3] }
        const sr = layout.scrollRects?.[layoutIdx]
        if (sr && sr.length >= 4) entry.scrollRects = { x: sr[0], y: sr[1], width: sr[2], height: sr[3] }
      }
      lookup.set(backendNodeId, entry)
    }
  }
  return lookup
}

// ---------------------------------------------------------------------------
// Fetching the raw trees (service.py _get_all_trees)
// ---------------------------------------------------------------------------

export interface RawTrees {
  snapshot: any
  domTree: any
  axNodes: any[]
  devicePixelRatio: number
  jsClickListenerIds: Set<number>
}

const IFRAME_SCROLL_JS = `(() => {
  const scrollData = {};
  document.querySelectorAll('iframe').forEach((iframe, index) => {
    try {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      if (doc) scrollData[index] = {
        scrollTop: doc.documentElement.scrollTop || doc.body.scrollTop || 0,
        scrollLeft: doc.documentElement.scrollLeft || doc.body.scrollLeft || 0
      };
    } catch (e) {}
  });
  return scrollData;
})()`

// getEventListeners only exists with includeCommandLineAPI. Skipped past 10k
// elements because the per-element loop gets too slow.
const CLICK_LISTENER_JS = `(() => {
  if (typeof getEventListeners !== 'function') return null;
  const all = document.querySelectorAll('*');
  if (all.length > 10000) return null;
  const out = [];
  for (const el of all) {
    try {
      const l = getEventListeners(el);
      if (l.click || l.mousedown || l.mouseup || l.pointerdown || l.pointerup) out.push(el);
    } catch (e) {}
  }
  return out;
})()`

async function getDevicePixelRatio(cdp: CdpConnection, sessionId: string): Promise<number> {
  try {
    const m = await cdp.send('Page.getLayoutMetrics', {}, sessionId)
    const vv = m.visualViewport || {}
    const cvv = m.cssVisualViewport || {}
    const clv = m.cssLayoutViewport || {}
    const width = cvv.clientWidth ?? clv.clientWidth ?? 1920
    const deviceWidth = vv.clientWidth ?? width
    const cssWidth = cvv.clientWidth ?? width
    return cssWidth > 0 ? deviceWidth / cssWidth : 1
  } catch {
    return 1
  }
}

async function getAxTreeForAllFrames(cdp: CdpConnection, sessionId: string): Promise<any[]> {
  const { frameTree } = await cdp.send('Page.getFrameTree', {}, sessionId)
  const ids: string[] = []
  const walk = (n: any) => { ids.push(n.frame.id); for (const c of n.childFrames || []) walk(c) }
  walk(frameTree)
  const results = await Promise.allSettled(ids.map((frameId) => cdp.send('Accessibility.getFullAXTree', { frameId }, sessionId)))
  // The root frame is required; a child frame detaching mid-request is not fatal.
  if (results[0]!.status === 'rejected') throw (results[0] as PromiseRejectedResult).reason
  const nodes: any[] = []
  for (const r of results) if (r.status === 'fulfilled') nodes.push(...r.value.nodes)
  return nodes
}

async function getJsClickListenerIds(cdp: CdpConnection, sessionId: string): Promise<Set<number>> {
  const ids = new Set<number>()
  try {
    const res = await cdp.send('Runtime.evaluate', { expression: CLICK_LISTENER_JS, includeCommandLineAPI: true, returnByValue: false }, sessionId)
    const objectId = res?.result?.objectId
    if (!objectId) return ids
    const props = await cdp.send('Runtime.getProperties', { objectId, ownProperties: true }, sessionId)
    const elementIds: string[] = []
    for (const p of props.result || []) {
      if (typeof p.name === 'string' && /^\d+$/.test(p.name) && p.value?.objectId) elementIds.push(p.value.objectId)
    }
    const backend = await Promise.all(elementIds.map(async (oid) => {
      try { return (await cdp.send('DOM.describeNode', { objectId: oid }, sessionId)).node?.backendNodeId ?? null } catch { return null }
    }))
    for (const b of backend) if (b != null) ids.add(b)
    cdp.send('Runtime.releaseObject', { objectId }, sessionId).catch(() => {})
  } catch {}
  return ids
}

export async function getAllTrees(cdp: CdpConnection, sessionId: string, maxIframes = 100): Promise<RawTrees> {
  try { await cdp.send('Runtime.evaluate', { expression: 'document.readyState' }, sessionId) } catch {}
  // Python reads iframe scroll positions here but only logs them. Kept for parity of page side effects (none).
  try { await cdp.send('Runtime.evaluate', { expression: IFRAME_SCROLL_JS, returnByValue: true }, sessionId) } catch {}
  const jsClickListenerIds = await getJsClickListenerIds(cdp, sessionId)

  const [snapshot, domTree, axNodes, devicePixelRatio] = await Promise.all([
    cdp.send('DOMSnapshot.captureSnapshot', {
      computedStyles: REQUIRED_COMPUTED_STYLES,
      includePaintOrder: true,
      includeDOMRects: true,
      includeBlendedBackgroundColors: false,
      includeTextColorOpacities: false,
    }, sessionId, 10_000),
    cdp.send('DOM.getDocument', { depth: -1, pierce: true }, sessionId, 10_000),
    getAxTreeForAllFrames(cdp, sessionId),
    getDevicePixelRatio(cdp, sessionId),
  ])
  if (snapshot?.documents?.length > maxIframes) snapshot.documents = snapshot.documents.slice(0, maxIframes)
  return { snapshot, domTree, axNodes, devicePixelRatio, jsClickListenerIds }
}

// ---------------------------------------------------------------------------
// Building the enhanced tree (service.py get_dom_tree)
// ---------------------------------------------------------------------------

function buildAxNode(ax: any): AXNodeInfo {
  let properties: AXProperty[] | null = null
  if (ax.properties && ax.properties.length) {
    properties = ax.properties.map((p: any) => ({ name: p.name, value: p.value?.value ?? null }))
  }
  return {
    axNodeId: ax.nodeId,
    ignored: ax.ignored,
    role: ax.role?.value ?? null,
    name: ax.name?.value ?? null,
    description: ax.description?.value ?? null,
    properties,
    childIds: ax.childIds && ax.childIds.length ? ax.childIds : null,
  }
}

/**
 * Visible means: not hidden by CSS, has bounds, and sits inside every
 * enclosing frame's viewport (plus `viewportThreshold` px above and below).
 *
 * Gotcha kept from the Python on purpose: this mutates node.snapshotNode.bounds
 * in place (shifting by iframe offset and frame scroll). Paint-order and bbox
 * filtering later read those shifted bounds, so "fixing" it changes output.
 */
export function isVisibleAccordingToAllParents(node: DomNode, htmlFrames: DomNode[], viewportThreshold: number | null = 1000): boolean {
  if (!node.snapshotNode) return false
  const styles = node.snapshotNode.computedStyles || {}
  const display = (styles['display'] ?? '').toLowerCase()
  const visibility = (styles['visibility'] ?? '').toLowerCase()
  if (display === 'none' || visibility === 'hidden') return false
  const opacity = parseFloat(styles['opacity'] ?? '1')
  if (!Number.isNaN(opacity) && opacity <= 0) return false

  const bounds = node.snapshotNode.bounds
  if (!bounds) return false
  if (viewportThreshold === null) return true

  for (let i = htmlFrames.length - 1; i >= 0; i--) {
    const frame = htmlFrames[i]!
    const fs = frame.snapshotNode
    if (frame.nodeType === NodeType.ELEMENT && (frame.nodeName.toUpperCase() === 'IFRAME' || frame.nodeName.toUpperCase() === 'FRAME') && fs?.bounds) {
      bounds.x += fs.bounds.x
      bounds.y += fs.bounds.y
    }
    if (frame.nodeType === NodeType.ELEMENT && frame.nodeName === 'HTML' && fs?.scrollRects && fs?.clientRects) {
      const right = fs.clientRects.width
      const bottom = fs.clientRects.height
      const ax = bounds.x - fs.scrollRects.x
      const ay = bounds.y - fs.scrollRects.y
      const intersects = ax < right && ax + bounds.width > 0 && ay < bottom + viewportThreshold && ay + bounds.height > 0 - viewportThreshold
      if (!intersects) return false
      bounds.x -= fs.scrollRects.x
      bounds.y -= fs.scrollRects.y
    }
  }
  return true
}

export interface BuildOptions { viewportThreshold?: number | null }

export function buildEnhancedTree(trees: RawTrees, sessionId: string | null, opts: BuildOptions = {}): DomNode {
  const viewportThreshold = opts.viewportThreshold === undefined ? 1000 : opts.viewportThreshold
  const axLookup = new Map<number, any>()
  for (const ax of trees.axNodes) if ('backendDOMNodeId' in ax) axLookup.set(ax.backendDOMNodeId, ax)
  const snapshotLookup = buildSnapshotLookup(trees.snapshot, trees.devicePixelRatio)
  const byNodeId = new Map<number, DomNode>()

  const construct = (raw: any, htmlFrames: DomNode[], offsetIn: Rect | null): DomNode => {
    const offset: Rect = offsetIn ? { ...offsetIn } : { x: 0, y: 0, width: 0, height: 0 }
    const existing = byNodeId.get(raw.nodeId)
    if (existing) return existing

    const n = new DomNode()
    n.nodeId = raw.nodeId
    n.backendNodeId = raw.backendNodeId
    n.nodeType = raw.nodeType
    n.nodeName = raw.nodeName
    n.nodeValue = raw.nodeValue
    if (raw.attributes) for (let i = 0; i < raw.attributes.length; i += 2) n.attributes[raw.attributes[i]] = raw.attributes[i + 1]
    n.isScrollable = raw.isScrollable ?? null
    n.frameId = raw.frameId ?? null
    n.sessionId = sessionId
    n.shadowRootType = raw.shadowRootType || null
    const ax = axLookup.get(raw.backendNodeId)
    n.axNode = ax ? buildAxNode(ax) : null
    n.snapshotNode = snapshotLookup.get(raw.backendNodeId) ?? null
    n.hasJsClickListener = trees.jsClickListenerIds.has(raw.backendNodeId)
    const sb = n.snapshotNode?.bounds
    if (sb) n.absolutePosition = { x: sb.x + offset.x, y: sb.y + offset.y, width: sb.width, height: sb.height }

    byNodeId.set(raw.nodeId, n)
    if (raw.parentId) n.parentNode = byNodeId.get(raw.parentId) ?? null

    const frames = [...htmlFrames]
    if (raw.nodeType === NodeType.ELEMENT && raw.nodeName === 'HTML' && raw.frameId != null) {
      frames.push(n)
      const sr = n.snapshotNode?.scrollRects
      if (sr) { offset.x -= sr.x; offset.y -= sr.y }
    }
    const upper = raw.nodeName.toUpperCase()
    if ((upper === 'IFRAME' || upper === 'FRAME') && n.snapshotNode?.bounds) {
      frames.push(n)
      offset.x += n.snapshotNode.bounds.x
      offset.y += n.snapshotNode.bounds.y
    }

    if (raw.contentDocument) {
      n.contentDocument = construct(raw.contentDocument, frames, offset)
      n.contentDocument.parentNode = n
    }
    if (raw.shadowRoots && raw.shadowRoots.length) {
      n.shadowRoots = []
      for (const sr of raw.shadowRoots) {
        const s = construct(sr, frames, offset)
        s.parentNode = n
        n.shadowRoots.push(s)
      }
    }
    if (raw.children && raw.children.length) {
      n.childrenNodes = []
      const shadowIds = new Set<number>((raw.shadowRoots || []).map((s: any) => s.nodeId))
      for (const c of raw.children) {
        if (shadowIds.has(c.nodeId)) continue
        n.childrenNodes.push(construct(c, frames, offset))
      }
    }
    n.isVisible = isVisibleAccordingToAllParents(n, frames, viewportThreshold)
    // Cross-origin iframes (separate targets) are off by default in browser-use; not ported.
    return n
  }

  return construct(trees.domTree.root, [], null)
}
