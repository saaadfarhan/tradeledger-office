const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const privateDirectory = path.join(root, 'owner-secrets')
const privatePath = path.join(privateDirectory, 'bootstrap-owner-private.pem')
const publicPath = path.join(root, 'electron', 'bootstrap-owner-public.pem')

if (fs.existsSync(privatePath) || fs.existsSync(publicPath)) {
  throw new Error('An owner bootstrap key already exists. Back it up safely; do not replace it.')
}

const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
})
fs.mkdirSync(privateDirectory, { recursive: true, mode: 0o700 })
fs.writeFileSync(privatePath, privateKey, { mode: 0o600, flag: 'wx' })
fs.writeFileSync(publicPath, publicKey, { mode: 0o644, flag: 'wx' })
process.stdout.write('Created owner signing key. Keep owner-secrets/bootstrap-owner-private.pem offline and never package or share it.\n')
