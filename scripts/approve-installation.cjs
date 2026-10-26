const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { createBootstrapGrant } = require('../electron/bootstrap-security.cjs')

const [requestPath, privateKeyPath, grantPath] = process.argv.slice(2)
if (!requestPath || !privateKeyPath || !grantPath) {
  process.stderr.write('Usage: node scripts/approve-installation.cjs <request.json> <owner-private.pem> <approval.json>\n')
  process.exit(2)
}

const request = JSON.parse(fs.readFileSync(path.resolve(requestPath), 'utf8'))
if (request?.version !== 1 || typeof request.requestId !== 'string' || typeof request.installationPublicKey !== 'string') {
  throw new Error('Invalid installation approval request')
}
if (request.firstAdminUsername !== null && request.firstAdminUsername !== undefined && (typeof request.firstAdminUsername !== 'string' || !request.firstAdminUsername.trim())) {
  throw new Error('Requested first administrator name is invalid')
}
const privateKey = crypto.createPrivateKey(fs.readFileSync(path.resolve(privateKeyPath), 'utf8'))
if (privateKey.asymmetricKeyType !== 'ed25519') throw new Error('Owner key must be an Ed25519 private key')
const publicFromPrivate = crypto.createPublicKey(privateKey).export({ type: 'spki', format: 'pem' })
const expectedPublic = fs.readFileSync(path.resolve(__dirname, '../electron/bootstrap-owner-public.pem'), 'utf8')
if (publicFromPrivate !== expectedPublic) throw new Error('This owner key does not match the app build’s trusted public key')

const grant = createBootstrapGrant(request, privateKey)
fs.writeFileSync(path.resolve(grantPath), `${JSON.stringify(grant, null, 2)}\n`, { mode: 0o600, flag: 'wx' })
process.stdout.write('Created a one-time, device-bound approval valid for 72 hours.\n')
