import assert from 'node:assert/strict'
import test from 'node:test'
import { karachiGreeting, karachiHour } from './karachi-time.ts'

test('greetings follow Karachi local time regardless of the computer timezone', () => {
  assert.equal(karachiHour(new Date('2026-10-19T00:00:00Z')), 5)
  assert.equal(karachiGreeting(new Date('2026-10-19T00:00:00Z')), 'Good morning')
  assert.equal(karachiGreeting(new Date('2026-10-19T06:59:00Z')), 'Good morning')
  assert.equal(karachiGreeting(new Date('2026-10-19T07:00:00Z')), 'Good afternoon')
  assert.equal(karachiGreeting(new Date('2026-10-19T12:00:00Z')), 'Good evening')
  assert.equal(karachiGreeting(new Date('2026-10-19T17:00:00Z')), 'Welcome back')
})
