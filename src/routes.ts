/**
 * HTTP surface: the public pairing page and the two owner-only Fetch routes.
 * The pairing page is deliberately outside `/api`, so an unauthenticated phone
 * can reach it; every state and rotation call stays inside Connection's fence.
 */

import { contentSecurityPolicy, renderMessagePage, renderPairingPage } from './html.js'
import {
  constantTimeEqual,
  isLoopbackHost,
  type PairingService,
  type PairingSnapshot,
} from './service.js'
import type {
  FetchRouteLike,
  HeadersLike,
  IndexResponseLike,
  PluginContext,
  RequestLike,
  ResponseLike,
} from './types.js'

const PAIR_PATH = '/m'
const STATE_PATH = '/api/mobile-access/state'
const ROTATE_PATH = '/api/mobile-access/rotate'
const MAX_BODY_BYTES = 2048
const PAIR_COOKIE = 'dsh-ma-pair'
const PAIR_NONCE_TTL_SECONDS = 10 * 60

export interface MobileAccessState extends PairingSnapshot {
  readonly ok: true
  readonly version: 1
  readonly origin: string
  readonly pairPath: '/m'
  readonly pairUrl: string
  readonly bindHost: string
  readonly protocol: string
  readonly port: number
  readonly loopback: boolean
}

class PayloadTooLargeError extends Error {
  constructor() {
    super('request body too large')
    this.name = 'PayloadTooLargeError'
  }
}

/** Capture the response `authorizeIndex` writes without touching the real socket. */
class CapturedResponse implements IndexResponseLike {
  statusCode = 200
  body = ''
  private readonly headers = new Map<string, string[]>()

  writeHead(status: number, headers?: Readonly<Record<string, string>>): this {
    this.statusCode = status
    if (headers !== undefined) {
      for (const [name, value] of Object.entries(headers)) this.setHeader(name, value)
    }
    return this
  }

  setHeader(name: string, value: string | readonly string[]): void {
    this.headers.set(name.toLowerCase(), typeof value === 'string' ? [value] : [...value])
  }

  end(body?: string): void {
    if (body !== undefined) this.body += body
  }

  getHeader(name: string): readonly string[] | undefined {
    return this.headers.get(name.toLowerCase())
  }

  cookies(): readonly string[] {
    return this.getHeader('set-cookie') ?? []
  }
}

function protocolOf(ctx: PluginContext): string {
  const protocol = ctx.webServer.protocol
  if (protocol === 'http:' || protocol === 'https:') return protocol
  return protocol.endsWith(':') ? protocol : `${protocol}:`
}

function bracketHost(host: string): string {
  return host.includes(':') && !host.startsWith('[') ? `[${host}]` : host
}

/** The listener origin, with a best-effort fallback before listen completes. */
function originOf(ctx: PluginContext): string {
  try {
    return ctx.webServer.getOrigin()
  } catch {
    const protocol = protocolOf(ctx)
    const port = ctx.webServer.port
    const defaultPort = protocol === 'http:' ? 80 : 443
    return `${protocol}//${bracketHost(ctx.webServer.host)}${port === defaultPort ? '' : `:${port}`}`
  }
}

function firstHeader(headers: HeadersLike, name: string): string | undefined {
  const value = headers[name.toLowerCase()]
  if (value === undefined) return undefined
  return typeof value === 'string' ? value : value[0]
}

function requestHost(ctx: PluginContext, request: RequestLike): string {
  return firstHeader(request.headers, 'host') ?? new URL(originOf(ctx)).host
}

function baseUrlForRequest(ctx: PluginContext, request: RequestLike): string {
  const protocol = protocolOf(ctx)
  const host = requestHost(ctx, request)
  try {
    return new URL(`${protocol}//${host}/`).href
  } catch {
    const origin = originOf(ctx)
    return origin.endsWith('/') ? origin : `${origin}/`
  }
}

/**
 * The pairing page is public by design. Pin its Host to this listener so a
 * rebound DNS name cannot reach it, but do not depend on browser Origin or
 * Fetch-Metadata here: Safari's form-navigation metadata is not part of the
 * pairing authority. The eight-digit code is the authorization secret; it is
 * unknown to a cross-site initiator and is rate-limited/locked by the service.
 */
function pairingHostAllowed(ctx: PluginContext, request: RequestLike): boolean {
  const host = firstHeader(request.headers, 'host')
  if (host === undefined) return false
  let hostname: string
  try {
    hostname = new URL(`${protocolOf(ctx)}//${host}`).hostname
  } catch {
    return false
  }
  const bare = hostname.replaceAll(/^\[|\]$/g, '').toLowerCase()
  let expected: string
  try {
    expected = new URL(originOf(ctx)).hostname.replaceAll(/^\[|\]$/g, '').toLowerCase()
  } catch {
    return false
  }
  return isLoopbackHost(bare) || bare === expected
}

function pairingNonce(): string {
  const bytes = new Uint8Array(18)
  globalThis.crypto.getRandomValues(bytes)
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('')
}

function pairingCookie(nonce: string): string {
  return `${PAIR_COOKIE}=${nonce}; Path=/m; Max-Age=${PAIR_NONCE_TTL_SECONDS}; HttpOnly; SameSite=Strict`
}

function cookieValue(headers: HeadersLike, name: string): string | undefined {
  const raw = firstHeader(headers, 'cookie')
  if (raw === undefined) return undefined
  for (const part of raw.split(';')) {
    const trimmed = part.trim()
    if (trimmed.startsWith(`${name}=`)) return trimmed.slice(name.length + 1)
  }
  return undefined
}

function clientAddress(request: RequestLike): string {
  const raw = request.socket?.remoteAddress ?? 'unknown'
  return raw.startsWith('::ffff:') ? raw.slice(7) : raw
}

function sendHtml(
  response: ResponseLike,
  status: number,
  body: string,
  extraHeaders: Readonly<Record<string, string>> = {},
): void {
  response.statusCode = status
  response.setHeader('content-type', 'text/html; charset=utf-8')
  response.setHeader('cache-control', 'no-store')
  response.setHeader('pragma', 'no-cache')
  response.setHeader('referrer-policy', 'no-referrer')
  response.setHeader('x-content-type-options', 'nosniff')
  response.setHeader('x-frame-options', 'DENY')
  response.setHeader('cross-origin-resource-policy', 'same-origin')
  response.setHeader('content-security-policy', contentSecurityPolicy())
  response.setHeader('permissions-policy', 'camera=(), microphone=(), geolocation=()')
  for (const [name, value] of Object.entries(extraHeaders)) response.setHeader(name, value)
  response.end(body)
}

function redirect(response: ResponseLike, location: string): void {
  response.statusCode = 303
  response.setHeader('location', location)
  response.setHeader('cache-control', 'no-store')
  response.setHeader('pragma', 'no-cache')
  response.setHeader('referrer-policy', 'no-referrer')
  response.end()
}

function replayCaptured(response: ResponseLike, captured: CapturedResponse): boolean {
  const cookies = captured.cookies()
  if (captured.statusCode !== 303 || cookies.length === 0) return false
  response.statusCode = 303
  response.setHeader('location', '/')
  response.setHeader('cache-control', 'no-store')
  response.setHeader('pragma', 'no-cache')
  response.setHeader('referrer-policy', 'no-referrer')
  response.setHeader('set-cookie', cookies)
  response.end()
  return true
}

function jsonResponse(payload: MobileAccessState, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  })
}

function statePayload(ctx: PluginContext, service: PairingService): MobileAccessState {
  const origin = originOf(ctx)
  const snapshot = service.snapshot()
  return {
    ...snapshot,
    ok: true,
    version: 1,
    origin,
    pairPath: PAIR_PATH,
    pairUrl: new URL(PAIR_PATH, origin).href,
    bindHost: ctx.webServer.host,
    protocol: protocolOf(ctx),
    port: ctx.webServer.port,
    loopback: isLoopbackHost(ctx.webServer.host),
  }
}

function pairingPage(
  ctx: PluginContext,
  service: PairingService,
  request: RequestLike,
  nonce: string,
  error?: string,
): string {
  const snapshot = service.snapshot()
  return renderPairingPage({
    ...(error === undefined ? {} : { error }),
    host: requestHost(ctx, request),
    expiresAt: snapshot.expiresAt,
    expired: snapshot.expired,
    locked: snapshot.locked,
    codeLength: snapshot.codeLength,
    codeTtlMs: snapshot.codeTtlMs,
    nonce,
  })
}

function sendPairing(
  ctx: PluginContext,
  service: PairingService,
  request: RequestLike,
  response: ResponseLike,
  error?: string,
  status = 200,
  extraHeaders: Readonly<Record<string, string>> = {},
): void {
  const nonce = pairingNonce()
  response.setHeader('set-cookie', pairingCookie(nonce))
  sendHtml(response, status, pairingPage(ctx, service, request, nonce, error), extraHeaders)
}

function refusalPage(title: string, message: string, detail?: string): string {
  return renderMessagePage({
    title,
    message,
    ...(detail === undefined ? {} : { detail }),
  })
}

async function readBody(request: RequestLike, limit: number): Promise<string> {
  const decoder = new TextDecoder()
  const encoder = new TextEncoder()
  let text = ''
  let bytes = 0
  for await (const chunk of request) {
    if (typeof chunk === 'string') {
      bytes += encoder.encode(chunk).byteLength
      text += chunk
    } else {
      bytes += chunk.byteLength
      text += decoder.decode(chunk, { stream: true })
    }
    if (bytes > limit) throw new PayloadTooLargeError()
  }
  text += decoder.decode()
  return text
}

/**
 * Mint the v1 index cookie without ever putting the launch token in the phone's
 * address bar. `authenticatedUrl` is used server-side only; the captured 303
 * carries the Set-Cookie that is replayed on the real response.
 */
function mintIndexCookie(
  ctx: PluginContext,
  request: RequestLike,
): { readonly cookies: readonly string[] } | { readonly error: string } {
  let authUrl: string
  try {
    authUrl = ctx.connection.authenticatedUrl(baseUrlForRequest(ctx, request))
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'authenticatedUrl failed' }
  }

  let parsed: URL
  try {
    parsed = new URL(authUrl)
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'authenticatedUrl was not a URL' }
  }

  const headers: Record<string, string | readonly string[] | undefined> = { ...request.headers }
  if (headers.host === undefined) headers.host = parsed.host

  const captured = new CapturedResponse()
  let allowed = false
  try {
    allowed = ctx.connection.authorizeIndex({
      method: 'GET',
      url: `${parsed.pathname}${parsed.search}`,
      headers,
    }, captured)
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'authorizeIndex threw' }
  }

  const cookies = captured.cookies()
  if (allowed || captured.statusCode !== 303 || cookies.length === 0) {
    return { error: `authorizeIndex returned status ${captured.statusCode}` }
  }
  return { cookies }
}

function failureMessage(reason: 'invalid' | 'locked' | 'expired' | 'rate'): string {
  switch (reason) {
    case 'invalid':
      return '配对码不正确，请核对 Mac 面板上显示的 8 位数字。'
    case 'locked':
      return '配对码已锁定。请在 Mac 的「手机访问」面板点击「刷新配对码」后重试。'
    case 'expired':
      return '配对码已过期。请在 Mac 的「手机访问」面板刷新配对码后重试。'
    case 'rate':
      return '尝试过于频繁，请稍后再试。'
  }
}

async function handleGet(
  ctx: PluginContext,
  service: PairingService,
  request: RequestLike,
  response: ResponseLike,
): Promise<void> {
  const captured = new CapturedResponse()
  const allowed = ctx.connection.authorizeIndex({
    method: request.method,
    url: request.url,
    headers: request.headers,
  }, captured)

  if (allowed) {
    redirect(response, './')
    return
  }
  if (replayCaptured(response, captured)) return
  sendPairing(ctx, service, request, response)
}

async function handlePost(
  ctx: PluginContext,
  service: PairingService,
  request: RequestLike,
  response: ResponseLike,
): Promise<void> {
  const contentType = (firstHeader(request.headers, 'content-type') ?? '').toLowerCase()
  if (!contentType.startsWith('application/x-www-form-urlencoded')) {
    sendHtml(response, 415, refusalPage('无法处理请求', '配对请求必须使用表单提交。'))
    return
  }

  let body: string
  try {
    body = await readBody(request, MAX_BODY_BYTES)
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      sendHtml(response, 413, refusalPage('请求过大', '配对请求体超过允许大小。'))
      return
    }
    sendHtml(response, 400, refusalPage('无法读取请求', '配对请求体无法读取，请刷新页面重试。'))
    return
  }

  const params = new URLSearchParams(body)
  const nonce = params.get('nonce') ?? ''
  const expectedNonce = cookieValue(request.headers, PAIR_COOKIE) ?? ''
  if (nonce === '' || expectedNonce === '' || !constantTimeEqual(nonce, expectedNonce)) {
    sendPairing(ctx, service, request, response, '配对页已过期，请刷新后重试。', 403)
    return
  }

  const code = params.get('code') ?? ''
  const result = service.attempt({ code, ip: clientAddress(request) })

  if (!result.ok) {
    const extra = result.reason === 'rate'
      ? { 'retry-after': String(Math.max(1, Math.ceil((result.retryAfterMs ?? 1000) / 1000))) }
      : {}
    sendPairing(
      ctx,
      service,
      request,
      response,
      failureMessage(result.reason),
      result.reason === 'rate' ? 429 : 200,
      extra,
    )
    return
  }

  const minted = mintIndexCookie(ctx, request)
  if ('error' in minted) {
    ctx.logger?.error?.(`[mobile-access] pair.cookie_mint_failed: ${minted.error}`)
    sendHtml(response, 500, refusalPage(
      '登录凭证签发失败',
      '服务器未能签发此 iPhone 的登录凭证，请刷新页面重试。',
      '如果问题持续存在，请检查 Mac 上的 DSH 服务是否正常运行。',
    ))
    return
  }

  ctx.logger?.info?.('[mobile-access] pair.success')
  response.statusCode = 303
  response.setHeader('location', '/')
  response.setHeader('cache-control', 'no-store')
  response.setHeader('pragma', 'no-cache')
  response.setHeader('referrer-policy', 'no-referrer')
  response.setHeader('set-cookie', minted.cookies)
  response.end()
}

/**
 * Build the single exact `/m` handler. Exported for route-level tests, which do
 * not need a live DSH process.
 */
export function createPairingHandler(
  ctx: PluginContext,
  service: PairingService,
): (request: RequestLike, response: ResponseLike) => Promise<void> {
  return async (request, response) => {
    if (!pairingHostAllowed(ctx, request)) {
      sendHtml(response, 403, refusalPage('请求被拒绝', '此请求未通过 Host 校验。'))
      return
    }

    const method = (request.method ?? 'GET').toUpperCase()
    if (method === 'GET') {
      await handleGet(ctx, service, request, response)
      return
    }
    if (method === 'POST') {
      await handlePost(ctx, service, request, response)
      return
    }
    response.setHeader('allow', 'GET, POST')
    sendHtml(response, 405, refusalPage('方法不被允许', '此地址只接受 GET 或 POST 请求。'))
  }
}

/**
 * Register all three routes. The returned disposer removes them in reverse
 * order; every registration is attempted only once.
 */
export function registerMobileAccess(ctx: PluginContext, service: PairingService): () => void {
  let pairing: (() => void) | undefined
  let state: (() => Promise<void>) | undefined
  let rotate: (() => Promise<void>) | undefined

  const stateRoute: FetchRouteLike = {
    path: STATE_PATH,
    methods: ['GET'],
    requestBody: 'buffered',
    fetch: () => Promise.resolve(jsonResponse(statePayload(ctx, service))),
  }
  const rotateRoute: FetchRouteLike = {
    path: ROTATE_PATH,
    methods: ['POST'],
    requestBody: 'buffered',
    fetch: () => {
      service.rotate()
      return Promise.resolve(jsonResponse(statePayload(ctx, service)))
    },
  }

  try {
    pairing = ctx.webServer.register({
      kind: 'exact',
      path: PAIR_PATH,
      handler: createPairingHandler(ctx, service),
    })
    state = ctx.connection.fetch.register(stateRoute)
    rotate = ctx.connection.fetch.register(rotateRoute)
  } catch (error) {
    pairing?.()
    if (state !== undefined) void state().catch(() => undefined)
    if (rotate !== undefined) void rotate().catch(() => undefined)
    throw error
  }

  return () => {
    pairing?.()
    if (state !== undefined) void state().catch(() => undefined)
    if (rotate !== undefined) void rotate().catch(() => undefined)
  }
}

export { PAIR_PATH, STATE_PATH, ROTATE_PATH }
