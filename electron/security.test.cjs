const assert = require('node:assert/strict')
const test = require('node:test')
const { contentSecurityPolicy } = require('./security.cjs')

test('development CSP allows Vite React refresh preamble, production CSP does not', () => {
  const development = contentSecurityPolicy('http://127.0.0.1:5173')
  const production = contentSecurityPolicy(null)
  const developmentScripts = development.match(/script-src ([^;]+)/)?.[1] ?? ''
  const productionScripts = production.match(/script-src ([^;]+)/)?.[1] ?? ''

  assert.match(developmentScripts, /'unsafe-inline'/)
  assert.doesNotMatch(productionScripts, /'unsafe-inline'/)
  assert.match(development, /ws:\/\/127\.0\.0\.1:5173/)
})
