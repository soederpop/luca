/**
 * A minimal Chrome DevTools Protocol connection over one browser-level websocket.
 *
 * Page sessions use flat mode (Target.attachToTarget with flatten: true), so
 * every page shares this one socket and messages carry a sessionId. That is
 * what browser-use's cdp_use does too, and it avoids one socket per tab.
 */

type Handler = (params: any, sessionId?: string) => void

export class CdpError extends Error {
  constructor(public method: string, public code: number, message: string) {
    super(`${method}: ${message}`)
  }
}

export class CdpConnection {
  private ws: WebSocket
  private nextId = 1
  private pending = new Map<number, { method: string; resolve: (v: any) => void; reject: (e: Error) => void }>()
  private listeners = new Map<string, Set<Handler>>()
  closed = false
  private closeHandlers = new Set<() => void>()

  private constructor(ws: WebSocket) {
    this.ws = ws
    ws.onmessage = (ev) => this.handleMessage(String(ev.data))
    ws.onclose = () => {
      this.closed = true
      for (const h of this.closeHandlers) h()
      for (const p of this.pending.values()) p.reject(new Error(`CDP socket closed during ${p.method}`))
      this.pending.clear()
    }
  }

  /**
   * Open a connection to a browser ws:// URL (see discovery.ts to find one).
   * No timeout on purpose: on Chrome 144+ a real-profile connection waits on
   * an "Allow" popup, and dropping the socket dismisses it. So hold one
   * connection for the life of the process; never reconnect per command.
   */
  static async connect(wsUrl: string): Promise<CdpConnection> {
    const ws = new WebSocket(wsUrl)
    await new Promise<void>((resolve, reject) => {
      ws.onopen = () => resolve()
      ws.onerror = () => reject(new Error(`Could not open CDP websocket ${wsUrl}`))
    })
    return new CdpConnection(ws)
  }

  send<T = any>(method: string, params: Record<string, any> = {}, sessionId?: string, timeoutMs = 30_000): Promise<T> {
    if (this.closed) return Promise.reject(new Error(`CDP socket is closed (${method})`))
    const id = this.nextId++
    const msg: Record<string, any> = { id, method, params }
    if (sessionId) msg.sessionId = sessionId
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`CDP ${method} timed out after ${timeoutMs}ms`))
      }, timeoutMs)
      this.pending.set(id, {
        method,
        resolve: (v) => { clearTimeout(timer); resolve(v) },
        reject: (e) => { clearTimeout(timer); reject(e) },
      })
      this.ws.send(JSON.stringify(msg))
    })
  }

  /** Subscribe to a CDP event. Returns an unsubscribe function. */
  on(method: string, handler: Handler): () => void {
    let set = this.listeners.get(method)
    if (!set) this.listeners.set(method, (set = new Set()))
    set.add(handler)
    return () => set!.delete(handler)
  }

  /** Resolve with the first matching event, or null on timeout. */
  waitFor(method: string, predicate: (params: any, sessionId?: string) => boolean, timeoutMs: number): Promise<any | null> {
    return new Promise((resolve) => {
      const off = this.on(method, (params, sessionId) => {
        if (!predicate(params, sessionId)) return
        clearTimeout(timer)
        off()
        resolve(params)
      })
      const timer = setTimeout(() => { off(); resolve(null) }, timeoutMs)
    })
  }

  /** Called once when the socket drops, for whatever reason. */
  onClose(handler: () => void): () => void {
    this.closeHandlers.add(handler)
    return () => this.closeHandlers.delete(handler)
  }

  close() {
    if (this.closed) return
    this.closed = true
    try { this.ws.close() } catch {}
  }

  private handleMessage(raw: string) {
    let msg: any
    try { msg = JSON.parse(raw) } catch { return }
    if (typeof msg.id === 'number') {
      const p = this.pending.get(msg.id)
      if (!p) return
      this.pending.delete(msg.id)
      if (msg.error) p.reject(new CdpError(p.method, msg.error.code, msg.error.message))
      else p.resolve(msg.result)
      return
    }
    const set = this.listeners.get(msg.method)
    if (set) for (const h of [...set]) h(msg.params, msg.sessionId)
  }
}
