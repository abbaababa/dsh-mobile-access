/**
 * Loopback-only DSH needs one LAN entry to be reachable from a phone. This
 * gateway is deliberately small and additive: it forwards HTTP and the one
 * DSH WebSocket endpoint to the loopback listener, rewriting Host/Origin so
 * the existing Connection trust fence and cookies keep their normal meaning.
 * The DSH listener itself never changes and the Mac keeps using 127.0.0.1.
 */

import { createServer, request as httpRequest, type IncomingMessage, type OutgoingHttpHeaders, type Server, type ServerResponse } from 'node:http'
import { connect, type Socket } from 'node:net'
import { networkInterfaces } from 'node:os'
import type { Duplex } from 'node:stream'

import { isLoopbackHost } from './service.js'

const DEFAULT_PORT = 3081
const PORT_ATTEMPTS = 10
const UPGRADE_PATH = '/api/remote.mux'
const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'proxy-connection',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
])

/** Public gateway status consumed by the owner-only panel. */
export interface LanGatewayStatus {
  readonly available: boolean
  readonly running: boolean
  readonly starting: boolean
  readonly port: number | null
  readonly publicOrigin: string | null
  readonly lanAddresses: readonly string[]
  readonly error: string | null
}

export interface LanGatewayOptions {
  readonly targetOrigin: string
  readonly preferredPort?: number
  /** Test seam: do not enumerate host interfaces. */
  readonly addresses?: readonly string[]
}

export const EMPTY_GATEWAY_STATUS: LanGatewayStatus = {
  available: false,
  running: false,
  starting: false,
  port: null,
  publicOrigin: null,
  lanAddresses: [],
  error: null,
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function stripBrackets(host: string): string {
  return host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host
}

function isPrivate(address: string): boolean {
  if (address.startsWith('10.')) return true
  if (address.startsWith('192.168.')) return true
  const parts = address.split('.')
  if (parts.length !== 4) return false
  const second = Number(parts[1])
  return parts[0] === '172' && second >= 16 && second <= 31
}

function interfaceScore(name: string, address: string): number {
  const lower = name.toLowerCase()
  if (lower === 'en0' || lower === 'wi-fi' || lower === 'wlan0') return 0
  if (lower === 'en1' || lower === 'ethernet' || lower === 'eth0') return 1
  if (lower.startsWith('utun') || lower.includes('tailscale')) return 40
  return isPrivate(address) ? 10 : 20
}

/** Every usable non-loopback IPv4 address, best candidate first. */
export function lanIPv4Addresses(): string[] {
  const found: Array<{ address: string; score: number }> = []
  for (const [name, entries] of Object.entries(networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.internal) continue
      if (entry.family !== 'IPv4') continue
      if (entry.address.startsWith('127.') || entry.address.startsWith('169.254.')) continue
      if (entry.address === '0.0.0.0') continue
      found.push({ address: entry.address, score: interfaceScore(name, entry.address) })
    }
  }
  const seen = new Set<string>()
  return found
    .sort((left, right) => left.score - right.score || left.address.localeCompare(right.address))
    .map((entry) => entry.address)
    .filter((address) => {
      if (seen.has(address)) return false
      seen.add(address)
      return true
    })
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve) => {
    server.close(() => resolve())
    setTimeout(resolve, 500).unref()
  })
}

export class LanGateway {
  private readonly target: URL
  private readonly targetHost: string
  private readonly targetPort: number
  private readonly preferredPort: number
  private readonly addresses: readonly string[]
  private readonly unavailable: string | null
  private server: Server | undefined
  private port: number | null = null
  private running = false
  private starting = false
  private error: string | null = null
  private stopped = false
  private readonly sockets = new Set<Socket>()

  constructor(options: LanGatewayOptions) {
    this.target = new URL(options.targetOrigin)
    this.targetHost = stripBrackets(this.target.hostname)
    this.targetPort = Number(this.target.port || (this.target.protocol === 'https:' ? 443 : 80))
    this.preferredPort = options.preferredPort ?? DEFAULT_PORT
    this.addresses = options.addresses ?? lanIPv4Addresses()
    if (!isLoopbackHost(this.target.hostname)) {
      this.unavailable = null
    } else if (this.target.protocol !== 'http:') {
      this.unavailable = 'HTTPS DSH 监听地址不能由 HTTP 网关代理；请继续使用局域网绑定或受信任证书。'
    } else if (this.addresses.length === 0) {
      this.unavailable = '未找到可用的局域网 IPv4 地址；请检查 Mac/Windows 的网络连接。'
    } else {
      this.unavailable = null
    }
  }

  get available(): boolean {
    return this.unavailable === null && isLoopbackHost(this.target.hostname)
  }

  status(): LanGatewayStatus {
    const publicAddress = this.addresses[0]
    return {
      available: this.available,
      running: this.running,
      starting: this.starting,
      port: this.port,
      publicOrigin: this.running && this.port !== null && publicAddress !== undefined
        ? `http://${publicAddress}:${this.port}`
        : null,
      lanAddresses: this.addresses,
      error: this.error ?? (this.available ? null : this.unavailable),
    }
  }

  async start(): Promise<void> {
    if (this.stopped || this.running || this.starting) return
    if (!this.available) {
      this.error = this.unavailable
      return
    }
    this.starting = true
    this.error = null
    try {
      const server = createServer((request, response) => this.onRequest(request, response))
      server.on('upgrade', (request, socket, head) => this.onUpgrade(request, socket, head))
      server.on('connection', (socket) => this.track(socket))
      server.on('clientError', (_error, socket) => {
        if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n')
      })
      const port = await listenOnFreePort(server, this.preferredPort)
      this.server = server
      this.port = port
      this.running = true
      server.on('error', (caught) => {
        this.error = errorText(caught)
        this.running = false
      })
    } catch (caught) {
      this.error = errorText(caught)
      await this.closeServer()
    } finally {
      this.starting = false
    }
  }

  async stop(): Promise<void> {
    this.stopped = true
    this.running = false
    this.port = null
    for (const socket of this.sockets) socket.destroy()
    this.sockets.clear()
    await this.closeServer()
  }

  private async closeServer(): Promise<void> {
    const server = this.server
    this.server = undefined
    if (server === undefined) return
    await closeServer(server)
  }

  private track(socket: Socket): void {
    this.sockets.add(socket)
    socket.on('close', () => this.sockets.delete(socket))
    socket.on('error', () => this.sockets.delete(socket))
  }

  private get publicOrigin(): string | null {
    const address = this.addresses[0]
    return address === undefined || this.port === null ? null : `http://${address}:${this.port}`
  }

  private rewriteOrigin(value: string): string {
    const publicOrigin = this.publicOrigin
    return publicOrigin !== null && value === publicOrigin ? this.target.origin : value
  }

  private rewriteReferer(value: string): string {
    const publicOrigin = this.publicOrigin
    if (publicOrigin === null || !value.startsWith(`${publicOrigin}/`)) return value
    return `${this.target.origin}${value.slice(publicOrigin.length)}`
  }

  private requestHeaders(request: IncomingMessage): OutgoingHttpHeaders {
    const headers: OutgoingHttpHeaders = {}
    for (const [name, value] of Object.entries(request.headers)) {
      if (value === undefined) continue
      const lower = name.toLowerCase()
      if (HOP_BY_HOP.has(lower) || lower === 'host' || lower.startsWith('x-forwarded-')) continue
      if (lower === 'origin') {
        headers.origin = this.rewriteOrigin(String(value))
        continue
      }
      if (lower === 'referer') {
        headers.referer = this.rewriteReferer(String(value))
        continue
      }
      headers[lower] = value
    }
    headers.host = this.target.host
    const publicOrigin = this.publicOrigin
    if (publicOrigin !== null) {
      const publicUrl = new URL(publicOrigin)
      headers['x-forwarded-host'] = publicUrl.host
      headers['x-forwarded-proto'] = 'http'
    }
    return headers
  }

  private responseHeaders(headers: IncomingMessage['headers']): OutgoingHttpHeaders {
    const result: OutgoingHttpHeaders = {}
    for (const [name, value] of Object.entries(headers)) {
      if (value === undefined) continue
      const lower = name.toLowerCase()
      if (HOP_BY_HOP.has(lower)) continue
      if (lower === 'location' && typeof value === 'string') {
        const publicOrigin = this.publicOrigin
        result.location = publicOrigin !== null && value.startsWith(`${this.target.origin}/`)
          ? `${publicOrigin}${value.slice(this.target.origin.length)}`
          : value
        continue
      }
      if (lower === 'set-cookie') {
        result['set-cookie'] = (Array.isArray(value) ? value : [value])
          .map((cookie) => cookie.replaceAll(/;\s*Domain=[^;]*/gi, ''))
        continue
      }
      result[lower] = value
    }
    return result
  }

  private onRequest(request: IncomingMessage, response: ServerResponse): void {
    if (!this.running) {
      response.writeHead(503, { 'content-type': 'text/plain; charset=utf-8' })
      response.end('LAN gateway is not running')
      return
    }
    const upstream = httpRequest({
      protocol: 'http:',
      hostname: this.targetHost,
      port: this.targetPort,
      method: request.method,
      path: request.url,
      headers: this.requestHeaders(request),
    }, (incoming) => {
      response.writeHead(incoming.statusCode ?? 502, this.responseHeaders(incoming.headers))
      incoming.pipe(response)
    })
    upstream.on('error', () => {
      if (!response.headersSent) {
        response.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' })
        response.end('LAN gateway upstream error')
      } else {
        response.destroy()
      }
    })
    request.on('error', () => upstream.destroy())
    request.pipe(upstream)
  }

  private onUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer): void {
    if (!this.running) {
      socket.destroy()
      return
    }
    let pathname: string
    try {
      pathname = new URL(request.url ?? '/', this.target.origin).pathname
    } catch {
      socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n')
      return
    }
    if (pathname !== UPGRADE_PATH) {
      socket.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n')
      return
    }
    const upstream = connect({ host: this.targetHost, port: this.targetPort }, () => {
      const headers = this.requestHeaders(request)
      headers.connection = 'Upgrade'
      headers.upgrade = 'websocket'
      const lines = [`GET ${request.url ?? '/'} HTTP/1.1`]
      for (const [name, value] of Object.entries(headers)) {
        if (value === undefined) continue
        if (Array.isArray(value)) {
          for (const item of value) lines.push(`${name}: ${item}`)
        } else {
          lines.push(`${name}: ${String(value)}`)
        }
      }
      upstream.write(`${lines.join('\r\n')}\r\n\r\n`)
      if (head.length > 0) upstream.write(head)
      socket.pipe(upstream)
      upstream.pipe(socket)
    })
    this.track(upstream)
    upstream.on('error', () => socket.destroy())
    socket.on('error', () => upstream.destroy())
    socket.on('close', () => upstream.destroy())
  }
}

async function listenOnFreePort(server: Server, preferredPort: number): Promise<number> {
  const candidates = Array.from({ length: PORT_ATTEMPTS }, (_, index) => preferredPort + index)
  candidates.push(0)
  let lastError: unknown
  for (const port of candidates) {
    try {
      await new Promise<void>((resolve, reject) => {
        const onError = (caught: Error): void => {
          server.off('listening', onListening)
          reject(caught)
        }
        const onListening = (): void => {
          server.off('error', onError)
          resolve()
        }
        server.once('error', onError)
        server.once('listening', onListening)
        server.listen({ host: '0.0.0.0', port, exclusive: true })
      })
      const address = server.address()
      return typeof address === 'object' && address !== null ? address.port : port
    } catch (caught) {
      lastError = caught
      if (server.listening) await closeServer(server)
    }
  }
  throw lastError instanceof Error ? lastError : new Error('no free LAN gateway port')
}
