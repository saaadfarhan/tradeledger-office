import assert from 'node:assert/strict'
import test from 'node:test'
import { APP_KEYBINDINGS, matchAppKeybinding } from './app-keybindings.ts'

function key(key: string, options: Partial<{ ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean; code: string }> = {}) {
  return matchAppKeybinding({ key, code: options.code ?? '', ctrlKey: options.ctrlKey ?? false, metaKey: options.metaKey ?? false, altKey: options.altKey ?? false, shiftKey: options.shiftKey ?? false })
}

test('every listed shortcut is unique and the list includes reload and zoom controls', () => {
  const shortcuts = APP_KEYBINDINGS.map(({ keys }) => keys)
  assert.equal(new Set(shortcuts).size, shortcuts.length)
  for (const action of ['reload', 'forceReload', 'zoomIn', 'zoomOut', 'resetZoom']) {
    assert.ok(APP_KEYBINDINGS.some((binding) => binding.action === action))
  }
})

test('reload and zoom shortcuts distinguish the intended combinations', () => {
  assert.equal(key('r', { ctrlKey: true }), 'reload')
  assert.equal(key('R', { ctrlKey: true, shiftKey: true }), 'forceReload')
  assert.equal(key('+', { ctrlKey: true }), 'zoomIn')
  assert.equal(key('=', { ctrlKey: true }), 'zoomIn')
  assert.equal(key('Add', { ctrlKey: true, code: 'NumpadAdd' }), 'zoomIn')
  assert.equal(key('-', { ctrlKey: true }), 'zoomOut')
  assert.equal(key('0', { ctrlKey: true }), 'resetZoom')
  assert.equal(key('r', { altKey: true }), null)
})

test('navigation, command, and editing shortcuts resolve to actions', () => {
  assert.equal(key('k', { metaKey: true }), 'search')
  assert.equal(key('ArrowLeft', { altKey: true }), 'back')
  assert.equal(key('ArrowRight', { altKey: true }), 'forward')
  assert.equal(key('Home', { altKey: true }), 'home')
  assert.equal(key('F1'), 'keybindings')
  assert.equal(key('F11'), 'fullscreen')
  assert.equal(key('q', { ctrlKey: true }), 'quit')
  assert.equal(key('z', { ctrlKey: true }), 'undo')
  assert.equal(key('a', { ctrlKey: true }), 'selectAll')
})
