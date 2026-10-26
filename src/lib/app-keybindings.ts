export type AppKeybindingAction =
  | 'search' | 'back' | 'forward' | 'home' | 'keybindings'
  | 'reload' | 'forceReload' | 'zoomIn' | 'zoomOut' | 'resetZoom'
  | 'fullscreen' | 'quit' | 'undo' | 'redo' | 'cut' | 'copy' | 'paste' | 'selectAll'

export const APP_KEYBINDINGS: Array<{ keys: string; action: AppKeybindingAction; description: string }> = [
  { keys: 'Ctrl+K', action: 'search', description: 'Open global search and commands' },
  { keys: 'Alt+←', action: 'back', description: 'Go to the previous page' },
  { keys: 'Alt+→', action: 'forward', description: 'Go to the next page' },
  { keys: 'Alt+Home', action: 'home', description: 'Open the overview' },
  { keys: 'F1', action: 'keybindings', description: 'Show keyboard shortcuts' },
  { keys: 'Ctrl+R', action: 'reload', description: 'Reload the application' },
  { keys: 'Ctrl+Shift+R', action: 'forceReload', description: 'Reload and bypass the cache' },
  { keys: 'Ctrl++ or Ctrl+=', action: 'zoomIn', description: 'Increase interface zoom' },
  { keys: 'Ctrl+-', action: 'zoomOut', description: 'Decrease interface zoom' },
  { keys: 'Ctrl+0', action: 'resetZoom', description: 'Reset interface zoom' },
  { keys: 'F11', action: 'fullscreen', description: 'Toggle full screen' },
  { keys: 'Ctrl+Q', action: 'quit', description: 'Show the quit confirmation' },
  { keys: 'Ctrl+Z', action: 'undo', description: 'Undo the last text edit' },
  { keys: 'Ctrl+Y', action: 'redo', description: 'Redo the last text edit' },
  { keys: 'Ctrl+X', action: 'cut', description: 'Cut selected text' },
  { keys: 'Ctrl+C', action: 'copy', description: 'Copy selected text' },
  { keys: 'Ctrl+V', action: 'paste', description: 'Paste from the clipboard' },
  { keys: 'Ctrl+A', action: 'selectAll', description: 'Select all text in the focused field' },
]

type KeyEventLike = Pick<KeyboardEvent, 'key' | 'code' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'>

export function matchAppKeybinding(event: KeyEventLike): AppKeybindingAction | null {
  const key = event.key.toLowerCase()
  const modifier = event.ctrlKey || event.metaKey

  if (modifier && !event.altKey && key === 'k' && !event.shiftKey) return 'search'
  if (event.altKey && !modifier && key === 'arrowleft') return 'back'
  if (event.altKey && !modifier && key === 'arrowright') return 'forward'
  if (event.altKey && !modifier && key === 'home') return 'home'
  if (!modifier && !event.altKey && key === 'f1') return 'keybindings'
  if (modifier && !event.altKey && key === 'r') return event.shiftKey ? 'forceReload' : 'reload'
  if (modifier && !event.altKey && (key === '+' || key === '=' || event.code === 'NumpadAdd')) return 'zoomIn'
  if (modifier && !event.altKey && (key === '-' || event.code === 'NumpadSubtract')) return 'zoomOut'
  if (modifier && !event.altKey && key === '0') return 'resetZoom'
  if (!modifier && !event.altKey && key === 'f11') return 'fullscreen'
  if (modifier && !event.altKey && key === 'q') return 'quit'
  if (modifier && !event.altKey && !event.shiftKey && key === 'z') return 'undo'
  if (modifier && !event.altKey && key === 'y') return 'redo'
  if (modifier && !event.altKey && key === 'x') return 'cut'
  if (modifier && !event.altKey && key === 'c') return 'copy'
  if (modifier && !event.altKey && key === 'v') return 'paste'
  if (modifier && !event.altKey && key === 'a') return 'selectAll'
  return null
}
