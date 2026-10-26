const https = require('node:https')
const crypto = require('node:crypto')
const { execFile } = require('node:child_process')

const MAX_BODY_BYTES = 2 * 1024 * 1024
const SESSION_LIFETIME_MS = 8 * 60 * 60 * 1000
const CHANGE_CHANNELS = new Set([
  'company:save', 'accounts:save', 'accounts:remove', 'items:save', 'items:create-for-challan', 'items:remove',
  'banks:save', 'banks:remove', 'challans:post', 'challans:update', 'challans:remove',
  'cheques:save', 'cheques:remove', 'vouchers:save', 'vouchers:remove',
  'stock-types:save', 'stock-types:remove', 'stock:opening:add', 'stock:transfer',
  'locations:save', 'locations:remove', 'users:save', 'users:remove', 'devices:create', 'devices:revoke', 'security:configure-admin-tools-password',
])

function resolvePeerMacAddress(remoteAddress) {
  let address = String(remoteAddress || '').replace(/^::ffff:/i, '')
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(address)) return Promise.resolve('')
  const command = process.platform === 'win32' ? 'arp' : process.platform === 'darwin' ? 'arp' : 'ip'
  const args = process.platform === 'win32' ? ['-a', address]
    : process.platform === 'darwin' ? ['-n', address]
      : ['neigh', 'show', address]
  return new Promise((resolve) => {
    execFile(command, args, { timeout: 1500, windowsHide: true }, (error, stdout) => {
      if (error) return resolve('')
      const match = String(stdout).match(/\b[0-9a-f]{2}(?:[:-][0-9a-f]{2}){5}\b/i)
      resolve(match ? match[0].replaceAll('-', ':').toUpperCase() : '')
    })
  })
}

function createOfficeRpcServer({ tls, host = '0.0.0.0', port = 48391, permissionFor, refreshSession = (session) => session, dispatch, onChange = () => {}, requireDeviceCertificate = false, resolveDevice = () => null, serverFactory = https.createServer }) {
  if (!tls?.key || !tls?.cert) throw new Error('TLS key and certificate are required')
  if (typeof permissionFor !== 'function' || typeof dispatch !== 'function') throw new Error('RPC permission and dispatch functions are required')

  const sessions = new Map()
  const loginFailures = new Map()
  const eventStreams = new Set()
  let dispatchQueue = Promise.resolve()
  let changeSequence = 0

  function publishChange(channel) {
    if (!CHANGE_CHANNELS.has(channel)) return
    try { onChange() } catch { /* a UI notification must not affect a committed write */ }
    const message = `id: ${++changeSequence}\nevent: changed\ndata: {}\n\n`
    for (const stream of eventStreams) {
      if (!stream.response.destroyed && !stream.response.writableEnded && !stream.response.write(message)) stream.response.destroy()
    }
  }

  function authenticate(token) {
    const current = token ? sessions.get(token) : null
    if (!current || current.expiresAt <= Date.now()) return null
    return { token, current }
  }

  const enqueue = (task) => {
    const result = dispatchQueue.then(task, task)
    dispatchQueue = result.catch(() => undefined)
    return result
  }

  const server = serverFactory(tls, async (request, response) => {
    const send = (status, value) => {
      const body = Buffer.from(JSON.stringify(value))
      response.writeHead(status, {
        'content-type': 'application/json; charset=utf-8',
        'content-length': body.length,
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
      })
      response.end(body)
    }

    let device = null
    let deviceCertificate = null
    if (requireDeviceCertificate) {
      const peer = request.socket.getPeerCertificate(true)
      if (!request.socket.authorized || !peer?.raw) return send(401, { error: 'An authorized device certificate is required. Import a device credential from your office administrator.' })
      try { deviceCertificate = new crypto.X509Certificate(peer.raw); device = resolveDevice(deviceCertificate) } catch { device = null }
      if (!device) return send(401, { error: 'This device certificate is revoked or is not registered with the office.' })
    }

    if (request.method === 'GET' && request.url === '/events') {
      const bearer = String(request.headers.authorization || '').match(/^Bearer ([A-Za-z0-9_-]{40,})$/)?.[1]
      const authenticated = authenticate(bearer)
      if (!authenticated) return send(401, { error: 'Sign-in expired. Please sign in again.' })
      if (eventStreams.size >= 256) return send(503, { error: 'Too many office update connections' })
      const { token, current } = authenticated
      if (current.deviceId && current.deviceId !== device?.deviceId) return send(401, { error: 'This session belongs to a different device. Sign in again.' })
      let refreshed
      try { refreshed = await refreshSession(current.session) } catch { return send(503, { error: 'Could not validate the office session' }) }
      if (!refreshed) { sessions.delete(token); return send(401, { error: 'Sign-in expired. Please sign in again.' }) }
      current.session = refreshed
      current.expiresAt = Date.now() + SESSION_LIFETIME_MS
      response.writeHead(200, {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache, no-transform',
        connection: 'keep-alive',
        'x-accel-buffering': 'no',
        'x-content-type-options': 'nosniff',
      })
      response.write(`retry: 3000\nevent: ready\ndata: {"sequence":${changeSequence}}\n\n`)
      const stream = { response, token }
      eventStreams.add(stream)
      const heartbeat = setInterval(async () => {
        const live = authenticate(token)
        if (!live) { response.end(); return }
        if ((live.current.deviceId && live.current.deviceId !== device?.deviceId) || (requireDeviceCertificate && !resolveDevice(deviceCertificate))) { sessions.delete(token); response.end(); return }
        try {
          const session = await refreshSession(live.current.session)
          if (!session) { sessions.delete(token); response.end(); return }
          live.current.session = session
          live.current.expiresAt = Date.now() + SESSION_LIFETIME_MS
          if (!response.write(': keep-alive\n\n')) response.destroy()
        } catch { response.end() }
      }, 20_000)
      response.on('close', () => { clearInterval(heartbeat); eventStreams.delete(stream) })
      return
    }
    if (request.method !== 'POST' || request.url !== '/rpc') return send(404, { error: 'Not found' })
    if (!String(request.headers['content-type'] || '').toLowerCase().startsWith('application/json')) return send(415, { error: 'Expected JSON request' })

    const chunks = []
    let size = 0
    request.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        send(413, { error: 'Request is too large' })
        request.destroy()
        return
      }
      chunks.push(chunk)
    })
    request.on('end', async () => {
      if (response.writableEnded) return
      try {
        const input = JSON.parse(Buffer.concat(chunks).toString('utf8'))
        const { channel, args } = input || {}
        if (typeof channel !== 'string' || !Array.isArray(args) || channel.length > 100) return send(400, { error: 'Invalid RPC request' })

        const bearer = String(request.headers.authorization || '').match(/^Bearer ([A-Za-z0-9_-]{40,})$/)?.[1]
        let current = bearer ? sessions.get(bearer) : null
        const now = Date.now()
        if (current && current.expiresAt <= now) { sessions.delete(bearer); current = null }
        if (current) {
          const refreshed = await refreshSession(current.session)
          if (!refreshed) { sessions.delete(bearer); current = null }
          else current.session = refreshed
        }

        if (channel === 'auth:status') {
          if (current?.deviceId && current.deviceId !== device?.deviceId) return send(401, { error: 'This session belongs to a different device. Sign in again.' })
          const value = await enqueue(() => dispatch(channel, args, current?.session ?? null, device))
          return send(200, { value: { ...value, session: current?.session ?? null } })
        }

        if (channel === 'auth:setup' || channel === 'auth:login') {
          if (channel === 'auth:setup' && requireDeviceCertificate) return send(403, { error: 'Create the first office administrator on the host computer before connecting devices.' })
          const address = request.socket.remoteAddress || 'unknown'
          const failures = loginFailures.get(address)
          if (failures && failures.until > now && failures.count >= 8) return send(429, { error: 'Too many sign-in attempts. Wait 15 minutes and try again.' })
          let session
          try {
            if (requireDeviceCertificate && (!args[0] || args[0].username !== device.username)) throw new Error('This device is authorized for a different user account')
            const authArgs = channel === 'auth:login' && args[0] && typeof args[0] === 'object'
              ? [{ ...args[0], macAddress: await resolvePeerMacAddress(request.socket.remoteAddress) }]
              : args
            session = await enqueue(() => dispatch(channel, authArgs, null, device))
            loginFailures.delete(address)
          } catch (error) {
            const currentFailures = loginFailures.get(address)
            const count = currentFailures?.until > now ? currentFailures.count + 1 : 1
            if (loginFailures.size >= 512 && !loginFailures.has(address)) loginFailures.delete(loginFailures.keys().next().value)
            loginFailures.set(address, { count, until: now + 15 * 60 * 1000 })
            throw error
          }
          const token = crypto.randomBytes(32).toString('base64url')
          sessions.set(token, { session, deviceId: device?.deviceId || null, expiresAt: now + SESSION_LIFETIME_MS })
          return send(200, { value: session, token })
        }

        if (!current || current.expiresAt <= now) return send(401, { error: 'Sign-in expired. Please sign in again.' })
        if (current.deviceId && current.deviceId !== device?.deviceId) return send(401, { error: 'This session belongs to a different device. Sign in again.' })
        const permission = permissionFor(channel, args)
        if (permission === undefined) return send(404, { error: 'Unsupported operation' })
        if (permission && !(Array.isArray(permission)
          ? permission.some((item) => current.session.permissions.includes(item))
          : current.session.permissions.includes(permission))) return send(403, { error: 'Your account does not have permission for this operation' })

        current.expiresAt = now + SESSION_LIFETIME_MS
        const value = await enqueue(() => dispatch(channel, args, current.session, device))
        publishChange(channel)
        if (channel === 'auth:logout') sessions.delete(bearer)
        return send(200, { value })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Request failed'
        return send(400, { error: message.slice(0, 500) })
      }
    })
  })

  server.requestTimeout = 15_000
  server.headersTimeout = 10_000
  server.keepAliveTimeout = 5_000

  return {
    listen() {
      return new Promise((resolve, reject) => {
        server.once('error', reject)
        server.listen(port, host, () => {
          server.removeListener('error', reject)
          resolve(server.address())
        })
      })
    },
    close() {
      sessions.clear()
      for (const stream of eventStreams) stream.response.end()
      eventStreams.clear()
      return new Promise((resolve, reject) => {
        if (!server.listening) return resolve()
        server.close((error) => error ? reject(error) : resolve())
      })
    },
    notifyChange: publishChange,
    address: () => server.address(),
  }
}

module.exports = { createOfficeRpcServer, MAX_BODY_BYTES, SESSION_LIFETIME_MS }
