import assert from 'node:assert/strict'
import { once } from 'node:events'
import { createServer } from 'node:http'
import { connect } from 'node:net'
import test from 'node:test'

import { LanGateway, lanIPv4Addresses } from '../gateway.js'

async function target() {
  const server = createServer((request, response) => {
    response.setHeader('x-seen-host', request.headers.host ?? '')
    response.setHeader('x-seen-origin', request.headers.origin ?? '')
    response.setHeader('set-cookie', 'gateway-test=1; Domain=127.0.0.1; Path=/; HttpOnly')
    response.statusCode = 302
    response.setHeader('location', `http://${request.headers.host ?? '127.0.0.1'}/landing`)
    response.end('target-ok')
  })
  server.on('upgrade', (request, socket) => {
    socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n')
    socket.end()
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  return { server, port: server.address().port }
}

test('gateway is unavailable for a LAN-bound or HTTPS target', () => {
  assert.equal(new LanGateway({ targetOrigin: 'http://192.0.2.10:3080' }).available, false)
  assert.equal(new LanGateway({ targetOrigin: 'https://127.0.0.1:3080' }).available, false)
})

test('gateway proxies HTTP and rewrites the loopback-facing headers', async (t) => {
  const addresses = lanIPv4Addresses()
  if (addresses.length === 0) {
    t.skip('no non-loopback IPv4 address on this host')
    return
  }
  const { server, port } = await target()
  const gateway = new LanGateway({
    targetOrigin: `http://127.0.0.1:${port}`,
    preferredPort: 3181,
    addresses: [addresses[0]],
  })
  t.after(async () => {
    await gateway.stop()
    server.close()
  })
  assert.equal(gateway.available, true)
  await gateway.start()
  const status = gateway.status()
  assert.equal(status.running, true)
  assert.equal(status.starting, false)
  assert.ok(status.publicOrigin)

  const publicOrigin = status.publicOrigin
  const response = await fetch(`${publicOrigin}/m?probe=1`, {
    redirect: 'manual',
    headers: {
      origin: publicOrigin,
      referer: `${publicOrigin}/m`,
    },
  })
  assert.equal(response.status, 302)
  assert.equal(response.headers.get('location'), `${publicOrigin}/landing`)
  assert.equal(response.headers.get('x-seen-host'), `127.0.0.1:${port}`)
  assert.equal(response.headers.get('x-seen-origin'), `http://127.0.0.1:${port}`)
  assert.equal(response.headers.get('set-cookie'), 'gateway-test=1; Path=/; HttpOnly')
  assert.equal(await response.text(), 'target-ok')
})

test('gateway forwards only the DSH WebSocket upgrade path', async (t) => {
  const addresses = lanIPv4Addresses()
  if (addresses.length === 0) {
    t.skip('no non-loopback IPv4 address on this host')
    return
  }
  const { server, port } = await target()
  const gateway = new LanGateway({
    targetOrigin: `http://127.0.0.1:${port}`,
    preferredPort: 3191,
    addresses: [addresses[0]],
  })
  t.after(async () => {
    await gateway.stop()
    server.close()
  })
  await gateway.start()
  const status = gateway.status()
  assert.ok(status.publicOrigin)

  const socket = connect(Number(new URL(status.publicOrigin).port), addresses[0])
  await once(socket, 'connect')
  socket.write(
    'GET /api/remote.mux HTTP/1.1\r\n'
    + `Host: ${new URL(status.publicOrigin).host}\r\n`
    + 'Upgrade: websocket\r\n'
    + 'Connection: Upgrade\r\n'
    + 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n'
    + 'Sec-WebSocket-Version: 13\r\n\r\n',
  )
  const chunks = []
  socket.on('data', (chunk) => chunks.push(chunk))
  await once(socket, 'end')
  socket.destroy()
  assert.match(Buffer.concat(chunks).toString('utf8'), /^HTTP\/1\.1 101 /)
})
