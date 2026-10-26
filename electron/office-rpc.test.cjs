const assert = require('node:assert/strict')
const http = require('node:http')
const test = require('node:test')
const { createOfficeRpcServer } = require('./office-rpc.cjs')

async function call(port, { channel, args = [], token }) {
  const body = JSON.stringify({ channel, args })
  return new Promise((resolve, reject) => {
    const request = http.request({
      host: '127.0.0.1', port, path: '/rpc', method: 'POST',
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    }, (response) => {
      const chunks = []
      response.on('data', (chunk) => chunks.push(chunk))
      response.on('end', () => resolve({ status: response.statusCode, body: JSON.parse(Buffer.concat(chunks).toString()) }))
    })
    request.on('error', reject)
    request.end(body)
  })
}

test('authenticated change streams notify clients after successful writes only', async (t) => {
  const server = createOfficeRpcServer({
    tls: { key: 'test-key', cert: 'test-cert' },
    host: '127.0.0.1', port: 0, serverFactory: http.createServer,
    permissionFor: (channel) => channel === 'accounts:save' ? 'Chart of Accounts' : channel === 'auth:login' ? null : undefined,
    dispatch: async (channel, args) => {
      if (channel === 'auth:login') return { username: 'manager', permissions: ['Chart of Accounts'] }
      if (channel === 'accounts:save' && args[0]?.code === 'FAIL') throw new Error('write failed')
      if (channel === 'accounts:save') return { code: 'CASH' }
      throw new Error('write failed')
    },
  })
  t.after(() => server.close())
  const address = await server.listen()
  const login = await call(address.port, { channel: 'auth:login' })
  const token = login.body.token

  const deniedStream = await new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: address.port, path: '/events' }, (response) => {
      response.resume()
      response.on('end', () => resolve(response.statusCode))
    }).on('error', reject)
  })
  assert.equal(deniedStream, 401)

  let changeEvents = 0
  let resolveFirstChange
  const firstChange = new Promise((resolve) => { resolveFirstChange = resolve })
  const event = new Promise((resolve, reject) => {
    const request = http.get({ host: '127.0.0.1', port: address.port, path: '/events', headers: { authorization: `Bearer ${token}` } }, (response) => {
      t.after(() => response.destroy())
      response.setEncoding('utf8')
      response.on('data', (chunk) => {
        const count = (chunk.match(/event: changed/g) || []).length
        if (count) {
          changeEvents += count
          resolveFirstChange()
          resolve()
        }
      })
    })
    request.on('error', reject)
  })
  const saved = await call(address.port, { channel: 'accounts:save', args: [{ code: 'CASH' }], token })
  assert.equal(saved.status, 200)
  await event

  await firstChange
  const countBeforeFailure = changeEvents
  const failed = await call(address.port, { channel: 'accounts:save', args: [{ code: 'FAIL' }], token })
  assert.equal(failed.status, 400)
  await new Promise((resolve) => setTimeout(resolve, 50))
  assert.equal(changeEvents, countBeforeFailure)
})

test('office RPC authenticates independently, checks permissions server-side, and rejects unknown methods', async (t) => {
  const known = new Set(['auth:status', 'auth:login', 'auth:logout', 'accounts:list', 'accounts:remove', 'challans:list'])
  const server = createOfficeRpcServer({
    tls: { key: 'test-key', cert: 'test-cert' },
    host: '127.0.0.1', port: 0, serverFactory: http.createServer,
    permissionFor: (channel, args) => channel === 'accounts:list' ? 'Chart of Accounts' : channel === 'accounts:remove' ? 'Chart of Accounts' : channel === 'challans:list' ? (args[0] === 'SALE' ? 'Sale Challans' : 'Purchase Challans') : channel.startsWith('auth:') ? null : undefined,
    dispatch: async (channel, args) => {
      assert.ok(known.has(channel), `unexpected dispatch channel ${channel}`)
      if (channel === 'auth:status') return { hasUsers: true, hasCompanyProfile: true }
      if (channel === 'auth:login') return args[0] === 'operator'
        ? { username: 'operator', permissions: ['Overview'] }
        : { username: 'manager', permissions: ['Overview', 'Chart of Accounts', 'Purchase Challans'] }
      if (channel === 'accounts:list') return ['account list']
      if (channel === 'challans:list') return [`${args[0]} challans`]
      return null
    },
  })
  t.after(() => server.close())
  const address = await server.listen()

  const status = await call(address.port, { channel: 'auth:status' })
  assert.equal(status.status, 200)
  assert.equal(status.body.value.session, null)

  const operator = await call(address.port, { channel: 'auth:login', args: ['operator'] })
  assert.equal(operator.status, 200)
  assert.equal(operator.body.value.username, 'operator')
  assert.ok(operator.body.token)

  const blocked = await call(address.port, { channel: 'accounts:list', token: operator.body.token })
  assert.equal(blocked.status, 403)

  const manager = await call(address.port, { channel: 'auth:login', args: ['manager'] })
  const allowed = await call(address.port, { channel: 'accounts:list', token: manager.body.token })
  assert.deepEqual(allowed.body.value, ['account list'])
  const allowedDynamicPermission = await call(address.port, { channel: 'challans:list', args: ['PURCHASE'], token: manager.body.token })
  assert.deepEqual(allowedDynamicPermission.body.value, ['PURCHASE challans'])
  const blockedDynamicPermission = await call(address.port, { channel: 'challans:list', args: ['SALE'], token: manager.body.token })
  assert.equal(blockedDynamicPermission.status, 403)

  const unknown = await call(address.port, { channel: 'shell:execute', token: manager.body.token })
  assert.equal(unknown.status, 404)

  const noSession = await call(address.port, { channel: 'accounts:list' })
  assert.equal(noSession.status, 401)
})
