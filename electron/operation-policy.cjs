const LOCAL_ONLY_CHANNELS = new Set(['app:quit', 'app:menu-action', 'app:can-open-devtools', 'auth:authorize-bootstrap'])

function requiresAuthenticatedSession(channel) {
  return !channel.startsWith('auth:') && !LOCAL_ONLY_CHANNELS.has(channel)
}

module.exports = { LOCAL_ONLY_CHANNELS, requiresAuthenticatedSession }
