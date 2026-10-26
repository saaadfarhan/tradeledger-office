function userFacingError(error, channel = '') {
  const message = String(error?.message || error || '')
  const code = String(error?.code || '')

  if (code === 'OFFICE_AUTH_EXPIRED' || /sign-in expired/i.test(message)) {
    return 'The shared office no longer recognizes this sign-in. Its app may have restarted, or the account/device authorization may have changed. Confirm the host is still running and your device is active under the correct user, then sign in again.'
  }
  if (/timed out/i.test(message) || ['ETIMEDOUT', 'ESOCKETTIMEDOUT'].includes(code)) {
    if (channel === 'ids:next') {
      return 'The shared office did not respond in time. Check that the host app is open and your LAN or VPN is connected, then try again.'
    }
    return 'The shared office did not respond in time. Check that the host app is open and your LAN or VPN is connected. If you were saving, check whether the record was saved before trying again.'
  }
  if (['ECONNREFUSED', 'ECONNRESET', 'EHOSTUNREACH', 'ENETUNREACH', 'ENOTFOUND', 'EAI_AGAIN', 'EPIPE'].includes(code)) {
    return 'The shared office connection was lost. Check that the host app is running and your LAN or VPN is connected, then retry. If you were saving, check whether the record was saved before trying again.'
  }
  if (/certificate does not match the trusted fingerprint/i.test(message)) {
    return 'The server fingerprint does not match. Recheck the address and fingerprint with the office administrator; do not ignore this warning.'
  }
  if (/fingerprint must be 64 hexadecimal characters/i.test(message)) {
    return 'Enter the full 64-character SHA-256 fingerprint shown on the host. Colons and spaces are okay.'
  }
  if (/office server address must be an HTTPS origin/i.test(message) || message === 'Invalid URL') {
    return 'Enter the complete HTTPS address shown on the host, for example https://192.168.1.20:48391.'
  }
  if (/does not have permission/i.test(message)) {
    return 'Your account is not allowed to do that. Ask an office administrator to grant the required page access.'
  }
  if (/only an administrator/i.test(message)) {
    return 'This action is available to an office administrator only.'
  }
  if (/EADDRINUSE|address already in use/i.test(message) || code === 'EADDRINUSE') {
    return 'Another app is already using the office sharing port. Close any duplicate TradeLedger Office window and try again.'
  }
  if (/SQLITE_BUSY|database is locked/i.test(message)) {
    return 'The office database is busy. Wait a few seconds and try again.'
  }
  if (/UNIQUE constraint failed/i.test(message)) {
    return 'That code or number is already in use. Choose a different one.'
  }
  if (/FOREIGN KEY constraint failed/i.test(message)) {
    return 'This record is linked to other data and cannot be removed yet. Remove or update the related records first.'
  }
  if (/no such (table|column)/i.test(message)) {
    return 'The office database needs an update. Ask the administrator to close and reopen the app; if the message returns, contact support.'
  }
  const missingItem = message.match(/Unknown item:\s*(.+)/i)
  if (missingItem) return `Item ${missingItem[1]} was not found. Choose an existing item or add it on the Items page first.`
  const missingAccount = message.match(/Unknown account:\s*(.+)/i)
  if (missingAccount) return `Account ${missingAccount[1]} was not found. Choose an existing account from Chart of Accounts.`
  if (/parent account does not exist/i.test(message)) return 'That parent account no longer exists. Choose a different parent account.'
  if (/delete child accounts first/i.test(message)) return 'This account has child accounts. Move or delete those child accounts before deleting this one.'
  if (/date must be a real date|date must be .*yyyy-MM-dd/i.test(message)) return 'Enter a valid date and try again.'
  if (/insufficient stock/i.test(message)) return `${message}. Check the current stock balance or reduce the quantity.`
  if (/EACCES|EPERM|permission denied/i.test(message)) {
    return 'Windows blocked access to this file or folder. Check its permissions and try again.'
  }
  return message || 'The request could not be completed. Please try again.'
}

module.exports = { userFacingError }
