/**
 * Private Line — two-device WebRTC voice call prototype.
 *
 * Run with:  luca run examples/private-line/serve.ts        (https, self-signed)
 *       or:  HTTP=1 luca run examples/private-line/serve.ts (plain http on 8080,
 *            for use behind a TLS tunnel like cloudflared/ngrok)
 *
 * Both parties enter a shared five-word safety phrase (generated from the
 * EFF wordlist via the dice button, exchanged out-of-band). The phrase
 * never reaches this server: clients join a room named by a PBKDF2 hash
 * of the phrase, and authenticate each other's DTLS cert fingerprints
 * with a phrase-derived HMAC key before any audio is enabled. A signaling
 * MITM who doesn't know the phrase cannot complete a call — it fails
 * closed. This server is a blind relay for offers/answers/ICE between
 * exactly two peers per room; media flows peer-to-peer via DTLS-SRTP.
 */

// CONTAINER GAP: browsers require a secure origin for getUserMedia on
// non-localhost devices, but the container's express/websocket servers
// have no TLS option yet. Until a TLS-capable server feature exists,
// node:https + a ws server attached to it are used directly here.
import https from 'node:https'
import http from 'node:http'
import { WebSocketServer, WebSocket } from 'ws'

declare var container: any

// HTTP=1 serves plain http (no self-signed cert) — for use behind a
// TLS-terminating tunnel like cloudflared or ngrok.
const PLAIN_HTTP = process.env.HTTP === '1'
const PORT = Number(process.env.PORT || (PLAIN_HTTP ? 8080 : 8443))

interface Peer {
  ws: WebSocket
  room: string
}

async function main() {
  const fs = container.fs
  const paths = container.paths
  const proc = container.feature('proc')
  const ui = container.feature('ui')
  const networking = container.feature('networking')

  const baseDir = paths.resolve('examples/private-line')
  const indexPath = paths.resolve(baseDir, 'public', 'index.html')

  const wordlistPath = paths.resolve(baseDir, 'public', 'wordlist.txt')

  const requestHandler = (req: any, res: any) => {
    if (req.method === 'GET' && (req.url === '/' || req.url?.startsWith('/?'))) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      res.end(fs.readFile(indexPath))
    } else if (req.method === 'GET' && req.url === '/wordlist.txt') {
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'max-age=86400' })
      res.end(fs.readFile(wordlistPath))
    } else {
      res.writeHead(404)
      res.end('not found')
    }
  }

  let server: http.Server | https.Server
  if (PLAIN_HTTP) {
    server = http.createServer(requestHandler)
  } else {
    const certDir = paths.resolve(baseDir, '.certs')
    const keyPath = paths.resolve(certDir, 'key.pem')
    const certPath = paths.resolve(certDir, 'cert.pem')

    if (!fs.exists(keyPath) || !fs.exists(certPath)) {
      fs.ensureFolder(certDir)
      await proc.exec(
        `openssl req -x509 -newkey rsa:2048 -keyout "${keyPath}" -out "${certPath}" -days 365 -nodes -subj "/CN=private-line.local"`
      )
      console.log(ui.colors.dim('Generated self-signed certificate in .certs/'))
    }

    server = https.createServer(
      { key: fs.readFile(keyPath), cert: fs.readFile(certPath) },
      requestHandler
    )
  }

  // ---- signaling: rooms of exactly two peers ----
  const rooms = new Map<string, Set<WebSocket>>()
  const peers = new Map<WebSocket, Peer>()

  const wss = new WebSocketServer({ server })

  function otherPeer(ws: WebSocket): WebSocket | undefined {
    const peer = peers.get(ws)
    if (!peer) return undefined
    for (const member of rooms.get(peer.room) ?? []) {
      if (member !== ws) return member
    }
    return undefined
  }

  function leave(ws: WebSocket) {
    const peer = peers.get(ws)
    if (!peer) return
    peers.delete(ws)
    const members = rooms.get(peer.room)
    members?.delete(ws)
    if (members && members.size === 0) rooms.delete(peer.room)
    const remaining = otherPeerInRoom(peer.room)
    if (remaining) remaining.send(JSON.stringify({ type: 'peer-left' }))
  }

  function otherPeerInRoom(room: string): WebSocket | undefined {
    const members = rooms.get(room)
    if (!members) return undefined
    return [...members][0]
  }

  wss.on('connection', (ws: WebSocket) => {
    ws.on('message', (raw: Buffer) => {
      let msg: any
      try { msg = JSON.parse(raw.toString()) } catch { return }

      if (msg.type === 'join') {
        const room = String(msg.room || '').trim().toLowerCase()
        if (!room) return ws.send(JSON.stringify({ type: 'error', error: 'missing room code' }))
        const members = rooms.get(room) ?? new Set<WebSocket>()
        if (members.size >= 2) {
          return ws.send(JSON.stringify({ type: 'error', error: 'room is full' }))
        }
        members.add(ws)
        rooms.set(room, members)
        peers.set(ws, { ws, room })
        ws.send(JSON.stringify({ type: 'joined', room, peers: members.size - 1 }))
        const other = otherPeer(ws)
        if (other) other.send(JSON.stringify({ type: 'peer-joined' }))
        console.log(ui.colors.dim(`[room ${room.slice(0, 8)}…] peer joined (${members.size}/2)`))
        return
      }

      if (msg.type === 'signal') {
        otherPeer(ws)?.send(JSON.stringify({ type: 'signal', data: msg.data }))
        return
      }

      if (msg.type === 'hangup') {
        otherPeer(ws)?.send(JSON.stringify({ type: 'hangup' }))
        return
      }
    })

    ws.on('close', () => leave(ws))
    ws.on('error', () => leave(ws))
  })

  server.listen(PORT, '0.0.0.0', async () => {
    const proto = PLAIN_HTTP ? 'http' : 'https'
    const nets = await networking.getLocalNetworks()
    const lan = nets.find((n: any) => n.address.startsWith('192.168.') || n.address.startsWith('10.'))

    console.log()
    console.log(ui.colors.bold('  Private Line — prototype'))
    console.log()
    console.log(`  This device:   ${ui.colors.cyan(`${proto}://localhost:${PORT}`)}`)
    if (lan) {
      console.log(`  Other device:  ${ui.colors.cyan(`${proto}://${lan.address}:${PORT}`)}`)
    }
    console.log()
    if (PLAIN_HTTP) {
      console.log(ui.colors.dim('  Plain HTTP mode — put a TLS tunnel in front, e.g.'))
      console.log(ui.colors.dim(`  cloudflared tunnel --url http://localhost:${PORT}`))
    } else {
      console.log(ui.colors.dim('  Open on two devices, accept the self-signed cert warning,'))
      console.log(ui.colors.dim('  and join the same room code. Ctrl+C to stop.'))
    }
    console.log()
  })

  process.on('SIGINT', () => {
    wss.close()
    server.close()
    process.exit(0)
  })

  await new Promise(() => {})
}

main()
