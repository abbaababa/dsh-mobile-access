/**
 * Pairing domain: a short-lived numeric code, per-source throttling, and a
 * bounded observation table. The service owns no timers and no I/O, so it can
 * be tested with an injected clock and digit source.
 */

export const CODE_LENGTH = 8
export const CODE_TTL_MS = 10 * 60 * 1000
export const MAX_IP_FAILURES = 5
export const MAX_TOTAL_FAILURES = 20
export const RATE_LIMIT = 10
export const RATE_WINDOW_MS = 60 * 1000
export const MAX_TRACKED_SOURCES = 512
const OBSERVATION_RETENTION_MS = 10 * 60 * 1000

export type PairingFailure = 'invalid' | 'locked' | 'expired' | 'rate'

export interface PairingAttempt {
  readonly code: string
  readonly ip: string
}

export type PairingResult =
  | { readonly ok: true; readonly pairingCount: number }
  | { readonly ok: false; readonly reason: PairingFailure; readonly retryAfterMs?: number }

export interface PairingSnapshot {
  readonly code: string
  readonly displayCode: string
  readonly codeLength: number
  readonly codeTtlMs: number
  readonly createdAt: string
  readonly expiresAt: string
  readonly remainingMs: number
  readonly expired: boolean
  readonly locked: boolean
  readonly failures: number
  readonly maxTotalFailures: number
  readonly maxIpFailures: number
  readonly rateLimitPerMinute: number
  readonly rateWindowMs: number
  readonly lastPairedAt: string | null
  readonly pairingCount: number
}

export interface PairingServiceOptions {
  readonly now?: (() => number) | undefined
  readonly digit?: (() => number) | undefined
}

interface SourceRecord {
  failures: number
  windowStart: number
  windowCount: number
  lastSeen: number
}

/** Strip the display spaces and any other whitespace from a typed code. */
export function normalizeCode(value: string): string {
  return value.replaceAll(/\s+/g, '')
}

/** Group an eight-digit code as `1234 5678` for display. */
export function formatCode(value: string): string {
  const normalized = normalizeCode(value)
  if (normalized.length !== CODE_LENGTH) return normalized
  return `${normalized.slice(0, 4)} ${normalized.slice(4)}`
}

/** Compare two strings without an early return that leaks a matching prefix. */
export function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false
  let difference = 0
  for (let index = 0; index < left.length; index += 1) {
    difference |= (left.charCodeAt(index) ?? 0) ^ (right.charCodeAt(index) ?? 0)
  }
  return difference === 0
}

/** True for loopback authorities where a phone cannot reach the listener. */
export function isLoopbackHost(host: string): boolean {
  const normalized = host.replaceAll(/^\[|\]$/g, '').toLowerCase()
  return normalized === 'localhost'
    || normalized === '::1'
    || normalized === '0:0:0:0:0:0:0:1'
    || normalized === '127.0.0.1'
    || normalized.startsWith('127.')
}

/** Draw one unbiased decimal digit from the platform CSPRNG. */
function randomDigit(): number {
  const buffer = new Uint8Array(1)
  for (;;) {
    globalThis.crypto.getRandomValues(buffer)
    const value = buffer[0]
    if (value === undefined || value >= 250) continue
    return value % 10
  }
}

function generateCode(digit: () => number): string {
  let code = ''
  for (let index = 0; index < CODE_LENGTH; index += 1) {
    const value = digit()
    if (!Number.isInteger(value) || value < 0 || value > 9) {
      throw new TypeError('PairingService digit() must return an integer from 0 to 9')
    }
    code += String(value)
  }
  return code
}

/** In-memory pairing state shared by the panel and the public pairing page. */
export class PairingService {
  private code = ''
  private createdAt = 0
  private expiresAt = 0
  private failures = 0
  private lastPairedAt: number | null = null
  private pairingCount = 0
  private readonly sources = new Map<string, SourceRecord>()
  private readonly now: () => number
  private readonly digit: () => number

  constructor(options: PairingServiceOptions = {}) {
    this.now = options.now ?? (() => Date.now())
    this.digit = options.digit ?? randomDigit
    this.rotate()
  }

  /** Replace the code and clear every failure and throttle observation. */
  rotate(): PairingSnapshot {
    const now = this.now()
    this.code = generateCode(this.digit)
    this.createdAt = now
    this.expiresAt = now + CODE_TTL_MS
    this.failures = 0
    this.sources.clear()
    return this.snapshot()
  }

  /** Validate one code entry, applying expiry, lockout, and rate limits. */
  attempt(input: PairingAttempt): PairingResult {
    const now = this.now()
    this.prune(now)
    const source = this.source(input.ip, now)
    source.lastSeen = now

    if (now - source.windowStart >= RATE_WINDOW_MS) {
      source.windowStart = now
      source.windowCount = 0
    }
    source.windowCount += 1
    if (source.windowCount > RATE_LIMIT) {
      return {
        ok: false,
        reason: 'rate',
        retryAfterMs: Math.max(1, source.windowStart + RATE_WINDOW_MS - now),
      }
    }

    if (now >= this.expiresAt) return { ok: false, reason: 'expired' }
    if (this.failures >= MAX_TOTAL_FAILURES) return { ok: false, reason: 'locked' }
    if (source.failures >= MAX_IP_FAILURES) return { ok: false, reason: 'locked' }

    const candidate = normalizeCode(input.code)
    if (!constantTimeEqual(candidate, this.code)) {
      this.failures += 1
      source.failures += 1
      const locked = this.failures >= MAX_TOTAL_FAILURES || source.failures >= MAX_IP_FAILURES
      return locked ? { ok: false, reason: 'locked' } : { ok: false, reason: 'invalid' }
    }

    this.failures = 0
    source.failures = 0
    this.lastPairedAt = now
    this.pairingCount += 1
    return { ok: true, pairingCount: this.pairingCount }
  }

  /** Return an immutable point-in-time view for the owner-only panel reply. */
  snapshot(): PairingSnapshot {
    const now = this.now()
    return {
      code: this.code,
      displayCode: formatCode(this.code),
      codeLength: CODE_LENGTH,
      codeTtlMs: CODE_TTL_MS,
      createdAt: new Date(this.createdAt).toISOString(),
      expiresAt: new Date(this.expiresAt).toISOString(),
      remainingMs: Math.max(0, this.expiresAt - now),
      expired: now >= this.expiresAt,
      locked: this.failures >= MAX_TOTAL_FAILURES,
      failures: this.failures,
      maxTotalFailures: MAX_TOTAL_FAILURES,
      maxIpFailures: MAX_IP_FAILURES,
      rateLimitPerMinute: RATE_LIMIT,
      rateWindowMs: RATE_WINDOW_MS,
      lastPairedAt: this.lastPairedAt === null ? null : new Date(this.lastPairedAt).toISOString(),
      pairingCount: this.pairingCount,
    }
  }

  private source(ip: string, now: number): SourceRecord {
    const existing = this.sources.get(ip)
    if (existing !== undefined) return existing
    const created: SourceRecord = {
      failures: 0,
      windowStart: now,
      windowCount: 0,
      lastSeen: now,
    }
    this.sources.set(ip, created)
    return created
  }

  private prune(now: number): void {
    if (this.sources.size <= MAX_TRACKED_SOURCES) return
    for (const [key, source] of this.sources) {
      if (now - source.lastSeen > OBSERVATION_RETENTION_MS) this.sources.delete(key)
    }
    if (this.sources.size <= MAX_TRACKED_SOURCES) return
    let oldestKey: string | undefined
    let oldestSeen = Number.POSITIVE_INFINITY
    for (const [key, source] of this.sources) {
      if (source.lastSeen < oldestSeen) {
        oldestSeen = source.lastSeen
        oldestKey = key
      }
    }
    if (oldestKey !== undefined) this.sources.delete(oldestKey)
  }
}
