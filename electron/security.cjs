function contentSecurityPolicy(developmentUrl) {
  const isDevelopment = Boolean(developmentUrl)
  return `default-src 'self'; script-src 'self'${isDevelopment ? " 'unsafe-eval' 'unsafe-inline' http://127.0.0.1:5173" : ''}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'${isDevelopment ? ' ws://127.0.0.1:5173 http://127.0.0.1:5173' : ''}`
}

module.exports = { contentSecurityPolicy }
