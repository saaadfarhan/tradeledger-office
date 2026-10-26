const assert = require('node:assert/strict')
const http = require('node:http')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')
const { openOfficeDatabase } = require('./database.cjs')
const { createOfficeRpcServer } = require('./office-rpc.cjs')

function call(port, { channel, args = [], token }) {
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

test('shared office writes and reads the same host SQLite database', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'purchase-sale-shared-office-'))
  const store = openOfficeDatabase(path.join(directory, 'office.sqlite'))
  const permissions = new Map([
    ['accounts:list', 'Chart of Accounts'],
    ['accounts:save', 'Chart of Accounts'],
  ])
  const server = createOfficeRpcServer({
    tls: { key: 'test-key', cert: 'test-cert' },
    host: '127.0.0.1', port: 0, serverFactory: http.createServer,
    permissionFor: (channel) => channel.startsWith('auth:') ? null : permissions.get(channel),
    dispatch: async (channel, args, session) => {
      store.setAuditActor(session?.username || 'system')
      if (channel === 'auth:setup') return store.createFirstUser(args[0])
      if (channel === 'accounts:list') return store.listAccounts()
      if (channel === 'accounts:save') return store.saveAccount(args[0])
      throw new Error(`Unexpected channel: ${channel}`)
    },
  })
  t.after(async () => {
    await server.close()
    store.close()
    fs.rmSync(directory, { recursive: true, force: true })
  })
  const address = await server.listen()

  const login = await call(address.port, { channel: 'auth:setup', args: [{ username: 'admin', password: 'private-password' }] })
  assert.equal(login.status, 200)
  const token = login.body.token

  const saved = await call(address.port, {
    channel: 'accounts:save',
    args: [{ code: 'CASH', description: 'Cash', openingBalance: 0 }],
    token,
  })
  assert.equal(saved.status, 200)

  const listed = await call(address.port, { channel: 'accounts:list', token })
  assert.deepEqual(listed.body.value, [{ code: 'CASH', description: 'Cash', parentCode: null, openingBalance: 0 }])
  assert.deepEqual(store.listAccounts(), listed.body.value)
})
