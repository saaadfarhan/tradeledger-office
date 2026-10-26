const https = require('node:https')
const crypto = require('node:crypto')

function normalizeFingerprint(value) {
  const fingerprint = String(value || '').replaceAll(':', '').replaceAll(/\s+/g, '').toLowerCase()
  if (!/^[a-f0-9]{64}$/.test(fingerprint)) throw new Error('Server certificate fingerprint must be 64 hexadecimal characters')
  return fingerprint
}

function createOfficeRemoteClient({ url, fingerprint, deviceCredential = null, timeoutMs = 15_000 }) {
  const endpoint = new URL(url)
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.pathname !== '/' || endpoint.search || endpoint.hash) {
    throw new Error('Office server address must be an HTTPS origin, such as https://192.168.1.20:48391')
  }
  const expectedFingerprint = normalizeFingerprint(fingerprint)
  let token = null
  let eventRequest = null
  let eventResponse = null
  let reconnectTimer = null
  let reconnectDelay = 1_000
  let generation = 0
  let onDataChanged = () => {}
  let onSessionExpired = () => {}

  function stopEventStream() {
    generation += 1
    clearTimeout(reconnectTimer)
    reconnectTimer = null
    eventRequest?.destroy()
    eventResponse?.destroy()
    eventRequest = null
    eventResponse = null
  }

  function scheduleReconnect(attempt) {
    if (!token || attempt !== generation || reconnectTimer) return
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      reconnectDelay = Math.min(reconnectDelay * 2, 30_000)
      connectEventStream(attempt)
    }, reconnectDelay)
    reconnectTimer.unref?.()
  }

  function connectEventStream(attempt = generation) {
    if (!token || attempt !== generation) return
    let buffer = ''
    const request = https.request({
      protocol: endpoint.protocol,
      hostname: endpoint.hostname,
      port: endpoint.port || 443,
      path: '/events',
      method: 'GET',
      agent: false,
      rejectUnauthorized: false,
      ...(deviceCredential ? { cert: deviceCredential.cert, key: deviceCredential.key } : {}),
      headers: { accept: 'text/event-stream', authorization: `Bearer ${token}` },
    }, (response) => {
      if (attempt !== generation) { response.destroy(); return }
      eventResponse = response
      if (response.statusCode === 401) {
        token = null
        stopEventStream()
        onSessionExpired()
        return
      }
      if (response.statusCode !== 200) { response.destroy(new Error('Office update stream unavailable')); return }
      reconnectDelay = 1_000
      response.setEncoding('utf8')
      response.on('data', (chunk) => {
        buffer += chunk
        if (buffer.length > 16_384) { response.destroy(new Error('Office update message is too large')); return }
        let boundary
        while ((boundary = buffer.indexOf('\n\n')) !== -1) {
          const block = buffer.slice(0, boundary)
          buffer = buffer.slice(boundary + 2)
          if (/^event: (ready|changed)$/m.test(block)) onDataChanged()
        }
      })
      response.on('end', () => scheduleReconnect(attempt))
      response.on('close', () => scheduleReconnect(attempt))
      response.on('error', () => scheduleReconnect(attempt))
    })
    eventRequest = request
    request.on('socket', (socket) => {
      socket.once('secureConnect', () => {
        const certificate = socket.getPeerCertificate(true)
        const actual = certificate?.raw && crypto.createHash('sha256').update(certificate.raw).digest('hex')
        if (actual !== expectedFingerprint) request.destroy(new Error('Office server certificate does not match the trusted fingerprint'))
        else request.end()
      })
    })
    request.on('error', () => scheduleReconnect(attempt))
  }

  function request(channel, args) {
    const body = Buffer.from(JSON.stringify({ channel, args }))
    return new Promise((resolve, reject) => {
      const request = https.request({
        protocol: endpoint.protocol,
        hostname: endpoint.hostname,
        port: endpoint.port || 443,
        path: '/rpc',
        method: 'POST',
        agent: false,
        rejectUnauthorized: false,
        ...(deviceCredential ? { cert: deviceCredential.cert, key: deviceCredential.key } : {}),
        headers: { 'content-type': 'application/json', 'content-length': body.length, ...(token ? { authorization: `Bearer ${token}` } : {}) },
        timeout: timeoutMs,
      }, (response) => {
        const chunks = []
        let size = 0
        response.on('data', (chunk) => {
          size += chunk.length
          if (size > 2 * 1024 * 1024) request.destroy(new Error('Office server response is too large'))
          else chunks.push(chunk)
        })
        response.on('end', () => {
          try {
            const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'))
            if ((response.statusCode || 500) >= 400) {
              const error = new Error(payload.error || `Office server returned ${response.statusCode}`)
              if (response.statusCode === 401) {
                token = null
                error.code = 'OFFICE_AUTH_EXPIRED'
              }
              reject(error)
              return
            }
            resolve(payload)
          } catch (error) { reject(error) }
        })
      })
      request.on('timeout', () => request.destroy(new Error('Office server connection timed out')))
      request.on('error', reject)
      request.on('socket', (socket) => {
        socket.once('secureConnect', () => {
          const certificate = socket.getPeerCertificate(true)
          const actual = certificate?.raw && crypto.createHash('sha256').update(certificate.raw).digest('hex')
          if (actual !== expectedFingerprint) request.destroy(new Error('Office server certificate does not match the trusted fingerprint'))
          else request.end(body)
        })
      })
    })
  }

  return {
    async invoke(channel, args = []) {
      if (channel === 'auth:login' || channel === 'auth:setup') {
        stopEventStream()
        token = null
        const response = await request(channel, args)
        token = response.token
        reconnectDelay = 1_000
        connectEventStream()
        return response.value
      }
      const response = await request(channel, args)
      if (channel === 'auth:status' && !response.value?.session) { token = null; stopEventStream() }
      if (channel === 'auth:logout') { token = null; stopEventStream() }
      return response.value
    },
    onDataChanged(callback) { onDataChanged = callback },
    onSessionExpired(callback) { onSessionExpired = callback },
    close() { token = null; stopEventStream() },
  }
}

module.exports = { createOfficeRemoteClient, normalizeFingerprint }
