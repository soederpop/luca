// Shared typed protocol definitions between server and client
export interface ServerMessages {
  welcome: { features: string[] }
  connected: { features: string[] }
  pong: { replyTo: string }
  state: { replyTo: string; state: Record<string, any> }
  gitInfo: { replyTo: string; branch: string; sha: string }
  execResult: { replyTo: string; stdout: string; stderr: string }
  stateChanged: { state: Record<string, any> }
  chat: { from: string; text: string }
  error: { message: string; replyTo?: string }
  unknown: { replyTo: string }
}

export interface ClientMessages {
  ping: {}
  getState: {}
  getGitInfo: {}
  exec: { command: string }
  chat: { text: string }
  subscribe: { channel: string }
}
