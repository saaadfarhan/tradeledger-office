const assert = require('node:assert/strict')
const test = require('node:test')
const { requiresAuthenticatedSession } = require('./operation-policy.cjs')

test('local application commands such as clipboard actions do not require sign-in', () => {
  assert.equal(requiresAuthenticatedSession('app:menu-action'), false)
  assert.equal(requiresAuthenticatedSession('app:quit'), false)
  assert.equal(requiresAuthenticatedSession('accounts:list'), true)
  assert.equal(requiresAuthenticatedSession('auth:login'), false)
})
