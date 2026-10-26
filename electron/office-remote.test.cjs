const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const https = require('node:https')
const test = require('node:test')
const selfsigned = require('selfsigned')
const { createOfficeRemoteClient } = require('./office-remote.cjs')
const { createOfficeRpcServer } = require('./office-rpc.cjs')

test('remote client pins the TLS certificate and carries login token only in process memory', async (t) => {
  const pems = await selfsigned.generate([{ name: 'commonName', value: 'localhost' }], { keySize: 2048, algorithm: 'sha256' })
  const certificate = new crypto.X509Certificate(pems.cert)
  const fingerprint = crypto.createHash('sha256').update(certificate.raw).digest('hex')
  let receivedRequests = 0
  const server = https.createServer({ key: pems.private, cert: pems.cert }, (request, response) => {
    if (request.method === 'GET' && request.url === '/events') {
      response.writeHead(200, { 'content-type': 'text/event-stream' })
      response.write('event: ready\ndata: {}\n\n')
      return
    }
    receivedRequests += 1
    const chunks = []
    request.on('data', (chunk) => chunks.push(chunk))
    request.on('end', () => {
      const { channel } = JSON.parse(Buffer.concat(chunks).toString())
      response.setHeader('content-type', 'application/json')
      if (channel === 'auth:login') return response.end(JSON.stringify({ value: { username: 'operator', permissions: ['Overview'] }, token: 'a'.repeat(43) }))
      if (channel === 'auth:status') return response.end(JSON.stringify({ value: { hasUsers: true, session: request.headers.authorization ? { username: 'operator', permissions: ['Overview'] } : null } }))
      response.end(JSON.stringify({ value: null }))
    })
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  const client = createOfficeRemoteClient({ url: `https://127.0.0.1:${address.port}`, fingerprint })
  t.after(() => { client.close(); return new Promise((resolve) => server.close(resolve)) })

  assert.deepEqual(await client.invoke('auth:login', ['operator', 'example-password']), { username: 'operator', permissions: ['Overview'] })
  assert.deepEqual(await client.invoke('auth:status'), { hasUsers: true, session: { username: 'operator', permissions: ['Overview'] } })

  const untrusted = createOfficeRemoteClient({ url: `https://127.0.0.1:${address.port}`, fingerprint: '00'.repeat(32) })
  await assert.rejects(untrusted.invoke('auth:status'), /trusted fingerprint/)
  assert.equal(receivedRequests, 2, 'the client must verify the certificate before transmitting the request')
})

test('remote client reports when the host does not answer before the request timeout', async (t) => {
  const pems = await selfsigned.generate([{ name: 'commonName', value: 'localhost' }], { keySize: 2048, algorithm: 'sha256' })
  const fingerprint = crypto.createHash('sha256').update(new crypto.X509Certificate(pems.cert).raw).digest('hex')
  const server = https.createServer({ key: pems.private, cert: pems.cert }, (request) => request.resume())
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections() }))
  const address = server.address()
  const client = createOfficeRemoteClient({ url: `https://127.0.0.1:${address.port}`, fingerprint, timeoutMs: 30 })

  await assert.rejects(client.invoke('ids:next', ['item']), /Office server connection timed out/)
})

test('a pinned remote client reaches the RPC host and host permissions reject unauthorized operations', async (t) => {
  const pems = await selfsigned.generate([{ name: 'commonName', value: 'Purchase Sale Office' }], { keySize: 2048, algorithm: 'sha256' })
  const fingerprint = crypto.createHash('sha256').update(new crypto.X509Certificate(pems.cert).raw).digest('hex')
  let clerkPermissions = ['Overview']
  const server = createOfficeRpcServer({
    tls: { key: pems.private, cert: pems.cert },
    host: '127.0.0.1', port: 0,
    permissionFor: (channel) => channel === 'dashboard:get' ? 'Overview' : channel === 'users:list' ? 'User Rights' : channel.startsWith('auth:') ? null : undefined,
    refreshSession: (session) => ({ ...session, permissions: clerkPermissions }),
    dispatch: async (channel, args) => {
      if (channel === 'auth:login') return args[0].username === 'admin'
        ? { username: 'admin', permissions: ['Overview', 'User Rights'] }
        : { username: 'clerk', permissions: ['Overview'] }
      if (channel === 'auth:status') return { hasUsers: true, hasCompanyProfile: true }
      if (channel === 'dashboard:get') return { counts: { items: 7 } }
      if (channel === 'users:list') return [{ username: 'clerk' }]
      if (channel === 'auth:logout') return null
      throw new Error(`Unexpected channel ${channel}`)
    },
  })
  t.after(() => server.close())
  const address = await server.listen()
  const client = createOfficeRemoteClient({ url: `https://127.0.0.1:${address.port}`, fingerprint })
  const clerk = await client.invoke('auth:login', [{ username: 'clerk', password: 'private' }])
  assert.equal(clerk.username, 'clerk')
  assert.deepEqual(await client.invoke('dashboard:get'), { counts: { items: 7 } })
  await assert.rejects(client.invoke('users:list'), /does not have permission/)

  clerkPermissions = ['Overview', 'User Rights']
  assert.deepEqual(await client.invoke('users:list'), [{ username: 'clerk' }], 'updated permissions take effect without logging in again')
  clerkPermissions = ['Overview']
  await assert.rejects(client.invoke('users:list'), /does not have permission/, 'revoked permissions take effect on the next request')

  await client.invoke('auth:logout')
  await assert.rejects(client.invoke('dashboard:get'), (error) => error.code === 'OFFICE_AUTH_EXPIRED' && /Sign-in expired/.test(error.message))
})
