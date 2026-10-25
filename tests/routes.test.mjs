import assert from 'node:assert/strict'
import test from 'node:test'

import { PairingService } from '../service.js'
import {
  PAIR_PATH,
  ROTATE_PATH,
  STATE_PATH,
  createPairingHandler,
  registerMobileAccess,
} from '../routes.js'

const ORIGIN = 'http://192.0.2.10:3080'
const HOST = '192.0.2.10:3080'

function service() {
  return new PairingService({ now: () => 1_700_000_000_000, digit: () => 4 })
}

function request({
  method = 'GET',
  url = PAIR_PATH,
  headers = { host: HOST },
  body = '',
  remoteAddress = '192.168.1.20',
} = {}) {
  return {
    method,
    url,
    headers,
    socket: { remoteAddress },
    async *[Symbol.asyncIterator]() {
      if (body !== '') yield new TextEncoder().encode(body)
    },
  }
}

function response() {
  const headers = new Map()
  return {
    statusCode: 200,
    body: '',
    setHeader(name, value) {
      headers.set(name.toLowerCase(), Array.isArray(value) ? [...value] : [value])
    },
    end(body = '') {
      this.body += body
    },
    header(name) {
      return headers.get(name.toLowerCase())?.[0]
    },
  }
}

function context(overrides = {}) {
  const registrations = []
  const fetchRegistrations = []
  const disposed = { pairing: 0, fetch: 0 }
  const authorizeIndex = overrides.authorizeIndex ?? ((incoming, outgoing) => {
    if ((incoming.url ?? '').includes('token=test-token')) {
      outgoing.writeHead(303, {
        'set-cookie': ['dsh-auth=minted; Path=/; HttpOnly; SameSite=Strict'],
        location: './',
      })
      outgoing.end()
      return false
    }
    if ((incoming.headers.cookie ?? '').includes('dsh-auth=valid')) return true
    outgoing.writeHead(401, {})
    outgoing.end('authentication required')
    return false
  })

  const ctx = {
    webServer: {
      host: '192.0.2.10',
      port: 3080,
      protocol: 'http:',
      getOrigin: () => ORIGIN,
      register(route) {
        registrations.push(route)
        return () => {
          disposed.pairing += 1
        }
      },
    },
    connection: {
      requestRejection: overrides.requestRejection ?? (() => undefined),
      authorizeIndex,
      authenticatedUrl(baseUrl) {
        const url = new URL(baseUrl)
        url.searchParams.set('token', 'test-token')
        return url.href
      },
      fetch: {
        register(route) {
          if (overrides.failFetchRegistration === true && fetchRegistrations.length === 0) {
            throw new Error('simulated duplicate route')
          }
          fetchRegistrations.push(route)
          return async () => {
            disposed.fetch += 1
          }
        },
      },
    },
    logger: { info() {}, error() {} },
  }
  return { ctx, registrations, fetchRegistrations, disposed }
}

async function startPairing(handler) {
  const res = response()
  await handler(request(), res)
  const match = /name="nonce" value="([^"]+)"/.exec(res.body)
  assert.ok(match, 'pairing page must render a nonce')
  const cookie = res.header('set-cookie')
  assert.ok(cookie, 'pairing page must set a nonce cookie')
  return { res, nonce: match[1], cookie: cookie.split(';')[0] }
}

async function postPairing(handler, { code = '4444 4444', headers = {}, body } = {}) {
  const started = await startPairing(handler)
  const res = response()
  await handler(request({
    method: 'POST',
    headers: {
      host: HOST,
      cookie: started.cookie,
      'content-type': 'application/x-www-form-urlencoded',
      ...headers,
    },
    body: body ?? `code=${encodeURIComponent(code)}&nonce=${started.nonce}`,
  }), res)
  return { res, started }
}

test('GET /m serves the pairing page when no v1 cookie exists', async () => {
  const { ctx } = context()
  const res = response()
  await createPairingHandler(ctx, service())(request(), res)
  assert.equal(res.statusCode, 200)
  assert.match(res.body, /配对码/)
  assert.match(res.body, /name="nonce" value="[0-9a-f]{36}"/)
  assert.match(res.header('set-cookie'), /dsh-ma-pair=[0-9a-f]{36}/)
  assert.equal(res.header('cache-control'), 'no-store')
  assert.match(res.header('content-security-policy'), /default-src 'none'/)
})

test('GET /m redirects only when authorizeIndex reports a v1 cookie', async () => {
  const { ctx } = context()
  const res = response()
  await createPairingHandler(ctx, service())(
    request({ headers: { host: HOST, cookie: 'dsh-auth=valid' } }),
    res,
  )
  assert.equal(res.statusCode, 303)
  assert.equal(res.header('location'), './')
})

test('a v2-only cookie does not create a redirect loop', async () => {
  const { ctx } = context()
  const res = response()
  await createPairingHandler(ctx, service())(
    request({ headers: { host: HOST, cookie: 'dsh-auth=v2-api-only' } }),
    res,
  )
  assert.equal(res.statusCode, 200)
  assert.equal(res.header('location'), undefined)
})

test('POST /m pairs and mints the cookie without leaking the launch token', async () => {
  const instance = service()
  const { ctx } = context()
  const handler = createPairingHandler(ctx, instance)
  const { res } = await postPairing(handler)
  assert.equal(res.statusCode, 303)
  assert.equal(res.header('location'), '/')
  assert.match(res.header('set-cookie'), /dsh-auth=minted/)
  assert.equal(res.body.includes('test-token'), false)
  assert.equal(instance.snapshot().pairingCount, 1)
})

test('POST /m rejects a wrong code with a 200 HTML error page', async () => {
  const { ctx } = context()
  const { res } = await postPairing(createPairingHandler(ctx, service()), { code: '0000 0000' })
  assert.equal(res.statusCode, 200)
  assert.match(res.body, /配对码不正确/)
  assert.equal(res.header('set-cookie')?.includes('dsh-auth=') ?? false, false)
})

test('POST /m requires the page nonce; JSON and oversized bodies keep their statuses', async () => {
  const cases = [
    {
      headers: {
        host: HOST,
        'sec-fetch-site': 'cross-site',
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: 'code=4444+4444',
      status: 403,
    },
    {
      headers: {
        host: HOST,
        origin: 'http://evil.example',
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: 'code=4444+4444',
      status: 403,
    },
    {
      headers: { host: HOST, 'content-type': 'application/json' },
      body: '{"code":"44444444"}',
      status: 415,
    },
    {
      headers: { host: HOST, 'content-type': 'application/x-www-form-urlencoded' },
      body: 'x'.repeat(3000),
      status: 413,
    },
  ]
  for (const entry of cases) {
    const res = response()
    await createPairingHandler(context().ctx, service())(
      request({ method: 'POST', headers: entry.headers, body: entry.body }),
      res,
    )
    assert.equal(res.statusCode, entry.status)
  }
})

test('untrusted hosts are rejected before the page is rendered', async () => {
  const { ctx } = context()
  const res = response()
  await createPairingHandler(ctx, service())(
    request({ headers: { host: 'evil.example' } }),
    res,
  )
  assert.equal(res.statusCode, 403)
  assert.match(res.body, /未通过 Host 校验/)
})

test('Tailscale Serve host is accepted only with identity and a loopback peer', async () => {
  const tailnetHost = 'openmacbook-pro-1.tailcc0cfb.ts.net'
  const accepted = response()
  await createPairingHandler(context().ctx, service())(
    request({
      headers: { host: tailnetHost, 'tailscale-user-login': 'owner@example.com' },
      remoteAddress: '127.0.0.1',
    }),
    accepted,
  )
  assert.equal(accepted.statusCode, 200)
  assert.match(accepted.body, /手机访问/)

  const noIdentity = response()
  await createPairingHandler(context().ctx, service())(
    request({ headers: { host: tailnetHost }, remoteAddress: '127.0.0.1' }),
    noIdentity,
  )
  assert.equal(noIdentity.statusCode, 403)

  const nonLoopback = response()
  await createPairingHandler(context().ctx, service())(
    request({
      headers: { host: tailnetHost, 'tailscale-user-login': 'owner@example.com' },
      remoteAddress: '192.168.1.20',
    }),
    nonLoopback,
  )
  assert.equal(nonLoopback.statusCode, 403)
})

test('cookie mint failure is a generic 500 without a token', async () => {
  const { ctx } = context({
    authorizeIndex: (incoming, outgoing) => {
      if ((incoming.url ?? '').includes('token=')) {
        throw new Error('mint failed with secret=test-token')
      }
      outgoing.writeHead(401, {})
      outgoing.end('authentication required')
      return false
    },
  })
  const { res } = await postPairing(createPairingHandler(ctx, service()))
  assert.equal(res.statusCode, 500)
  assert.equal(res.body.includes('test-token'), false)
})

test('owner-only state and rotate routes expose the current snapshot', async () => {
  const instance = service()
  const { ctx, registrations, fetchRegistrations } = context()
  const dispose = registerMobileAccess(ctx, instance)
  assert.equal(registrations.length, 1)
  assert.equal(registrations[0].path, PAIR_PATH)
  assert.equal(fetchRegistrations.length, 2)

  const state = await fetchRegistrations[0].fetch(new Request(`${ORIGIN}${STATE_PATH}`))
  const payload = await state.json()
  assert.equal(payload.ok, true)
  assert.equal(payload.pairPath, '/m')
  assert.equal(payload.pairUrl, `${ORIGIN}/m`)
  assert.equal(payload.bindHost, '192.0.2.10')
  assert.equal(payload.loopback, false)
  assert.equal(payload.displayCode, '4444 4444')

  const rotate = await fetchRegistrations[1].fetch(new Request(`${ORIGIN}${ROTATE_PATH}`, { method: 'POST' }))
  const rotated = await rotate.json()
  assert.equal(rotated.ok, true)
  dispose()
})

test('registration failure cleans up earlier registrations', () => {
  const { ctx, disposed } = context({ failFetchRegistration: true })
  assert.throws(() => registerMobileAccess(ctx, service()), /simulated duplicate route/)
  assert.equal(disposed.pairing, 1)
  assert.equal(disposed.fetch, 0)
})
