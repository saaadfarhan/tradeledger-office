const assert = require('node:assert/strict')
const test = require('node:test')
const { userFacingError } = require('./error-messages.cjs')

test('turns a remote ID timeout into actionable language without exposing transport wording', () => {
  const message = userFacingError(new Error('Office server connection timed out'), 'ids:next')
  assert.equal(message, 'The shared office did not respond in time. Check that the host app is open and your LAN or VPN is connected, then try again.')
  assert.doesNotMatch(message, /Office server connection timed out/)
})

test('warns users to verify a write after a dropped remote connection', () => {
  const message = userFacingError(Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' }), 'challans:post')
  assert.match(message, /check whether the record was saved before trying again/i)
})

test('explains when a restarted shared server invalidates the operator sign-in', () => {
  assert.match(userFacingError(Object.assign(new Error('Sign-in expired'), { code: 'OFFICE_AUTH_EXPIRED' })), /Please sign in again/)
})

test('converts common setup and data-entry mistakes into next steps', () => {
  assert.match(userFacingError(new Error('Server certificate fingerprint must be 64 hexadecimal characters')), /Enter the full 64-character/)
  assert.match(userFacingError(new Error('UNIQUE constraint failed: accounts.code')), /already in use/)
  assert.match(userFacingError(new Error('The account does not have permission for this operation')), /Ask an office administrator/)
  assert.match(userFacingError(new Error('Unknown item: ITM-00003')), /Choose an existing item/)
  assert.match(userFacingError(Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' })), /host app is running/)
})
