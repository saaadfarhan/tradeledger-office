const crypto = require('node:crypto')

const GRANT_SCOPE = 'tradeledger-company-installation'
const MAX_GRANT_AGE_MS = 72 * 60 * 60 * 1000

function grantPayload(grant) {
  return JSON.stringify({
    version: grant.version,
    scope: grant.scope,
    requestId: grant.requestId,
    installationPublicKey: grant.installationPublicKey,
    firstAdminUsername: grant.firstAdminUsername,
    issuedAt: grant.issuedAt,
    expiresAt: grant.expiresAt,
  })
}

function createBootstrapGrant(request, privateKey, now = Date.now()) {
  const payload = {
    version: 1,
    scope: GRANT_SCOPE,
    requestId: request.requestId,
    installationPublicKey: request.installationPublicKey,
    firstAdminUsername: request.firstAdminUsername || null,
    issuedAt: now,
    expiresAt: now + MAX_GRANT_AGE_MS,
  }
  const signature = crypto.sign(null, Buffer.from(grantPayload(payload)), privateKey).toString('base64')
  return { ...payload, signature }
}

function verifyBootstrapGrant(grant, request, ownerPublicKey, now = Date.now()) {
  try {
    if (!grant || grant.version !== 1 || grant.scope !== GRANT_SCOPE) return false
    if (grant.requestId !== request?.requestId || grant.installationPublicKey !== request?.installationPublicKey) return false
    const requestedUsername = request?.firstAdminUsername ? String(request.firstAdminUsername).trim() : null
    if ((grant.firstAdminUsername || null) !== requestedUsername) return false
    if (!Number.isSafeInteger(grant.issuedAt) || !Number.isSafeInteger(grant.expiresAt)) return false
    if (grant.issuedAt > now + 5 * 60 * 1000 || grant.expiresAt <= now || grant.expiresAt <= grant.issuedAt) return false
    if (grant.expiresAt - grant.issuedAt > MAX_GRANT_AGE_MS) return false
    const publicKey = crypto.createPublicKey(ownerPublicKey)
    if (publicKey.asymmetricKeyType !== 'ed25519') return false
    const signature = Buffer.from(String(grant.signature || ''), 'base64')
    return signature.length === 64 && crypto.verify(null, Buffer.from(grantPayload(grant)), publicKey, signature)
  } catch { return false }
}

module.exports = { GRANT_SCOPE, MAX_GRANT_AGE_MS, createBootstrapGrant, verifyBootstrapGrant }
