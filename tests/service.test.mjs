import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CODE_LENGTH,
  CODE_TTL_MS,
  MAX_IP_FAILURES,
  MAX_TOTAL_FAILURES,
  PairingService,
  constantTimeEqual,
  formatCode,
  isLoopbackHost,
  normalizeCode,
} from '../service.js'

function service(digits = () => 4, start = 1_700_000_000_000) {
  let now = start
  const instance = new PairingService({ now: () => now, digit: digits })
  return {
    instance,
    advance(milliseconds) {
      now += milliseconds
    },
    now() {
      return now
    },
  }
}

test('code shape, formatting and normalization', () => {
  const { instance } = service()
  const snapshot = instance.snapshot()
  assert.equal(snapshot.code.length, CODE_LENGTH)
  assert.equal(snapshot.code, '44444444')
  assert.equal(snapshot.displayCode, '4444 4444')
  assert.equal(normalizeCode(' 4444 4444 '), '44444444')
  assert.equal(formatCode('12345678'), '1234 5678')
  assert.equal(formatCode('1234'), '1234')
})

test('constant-time comparison does not accept prefixes', () => {
  assert.equal(constantTimeEqual('12345678', '12345678'), true)
  assert.equal(constantTimeEqual('12345678', '12345670'), false)
  assert.equal(constantTimeEqual('1234', '12345678'), false)
})

test('loopback detection covers common spellings', () => {
  assert.equal(isLoopbackHost('127.0.0.1'), true)
  assert.equal(isLoopbackHost('127.4.3.2'), true)
  assert.equal(isLoopbackHost('localhost'), true)
  assert.equal(isLoopbackHost('::1'), true)
  assert.equal(isLoopbackHost('192.0.2.10'), false)
  assert.equal(isLoopbackHost('100.110.108.60'), false)
})

test('correct code pairs once and resets failures', () => {
  const { instance } = service()
  const code = instance.snapshot().displayCode
  assert.deepEqual(instance.attempt({ code, ip: '192.168.1.10' }), { ok: true, pairingCount: 1 })
  assert.equal(instance.snapshot().pairingCount, 1)
  assert.equal(instance.snapshot().lastPairedAt !== null, true)
})

test('a wrong code is rejected and five failures lock that source', () => {
  const { instance } = service()
  for (let index = 0; index < MAX_IP_FAILURES; index += 1) {
    assert.deepEqual(instance.attempt({ code: '00000000', ip: '192.168.1.11' }), {
      ok: false,
      reason: index === MAX_IP_FAILURES - 1 ? 'locked' : 'invalid',
    })
  }
  assert.deepEqual(instance.attempt({ code: instance.snapshot().code, ip: '192.168.1.11' }), {
    ok: false,
    reason: 'locked',
  })
})

test('twenty global failures lock the code across sources', () => {
  const { instance } = service()
  for (let source = 0; source < 4; source += 1) {
    for (let attempt = 0; attempt < MAX_IP_FAILURES; attempt += 1) {
      instance.attempt({ code: '00000000', ip: `192.168.1.${source + 20}` })
    }
  }
  assert.equal(instance.snapshot().failures, MAX_TOTAL_FAILURES)
  assert.equal(instance.snapshot().locked, true)
})

test('rate limit is applied before lockout', () => {
  const { instance } = service()
  let last
  for (let index = 0; index < 11; index += 1) {
    last = instance.attempt({ code: '00000000', ip: '192.168.1.30' })
  }
  assert.equal(last?.ok, false)
  assert.equal(last?.reason, 'rate')
  assert.equal(last?.retryAfterMs > 0, true)
})

test('expired code cannot pair', () => {
  const { instance, advance } = service()
  advance(CODE_TTL_MS + 1)
  const snapshot = instance.snapshot()
  assert.equal(snapshot.expired, true)
  const result = instance.attempt({ code: snapshot.code, ip: '192.168.1.40' })
  assert.deepEqual(result, { ok: false, reason: 'expired' })
})

test('rotation replaces the code and clears observations', () => {
  const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9, 9, 9, 9, 9, 9, 9, 9]
  const { instance } = service(() => digits.shift() ?? 9)
  assert.equal(instance.snapshot().code, '12345678')
  instance.attempt({ code: '00000000', ip: '192.168.1.50' })
  const next = instance.rotate()
  assert.equal(next.code, '99999999')
  assert.equal(next.failures, 0)
  assert.equal(next.locked, false)
  assert.deepEqual(instance.attempt({ code: '99999999', ip: '192.168.1.50' }), { ok: true, pairingCount: 1 })
})
