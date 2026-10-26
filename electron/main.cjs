const path = require('node:path')
const fs = require('node:fs/promises')
const os = require('node:os')
const crypto = require('node:crypto')
const { pathToFileURL } = require('node:url')
const { app, BrowserWindow, Menu, Tray, nativeImage, dialog, ipcMain, shell, safeStorage } = require('electron')
const selfsigned = require('selfsigned')
const { openOfficeDatabase } = require('./database.cjs')
const { contentSecurityPolicy } = require('./security.cjs')
const { LOCAL_ONLY_CHANNELS, requiresAuthenticatedSession } = require('./operation-policy.cjs')
const { userFacingError } = require('./error-messages.cjs')
const { createOfficeRpcServer } = require('./office-rpc.cjs')
const { createOfficeRemoteClient } = require('./office-remote.cjs')
const { verifyBootstrapGrant } = require('./bootstrap-security.cjs')

// Electron does not auto-detect Sway as a Secret Service desktop. Select
// GNOME Keyring's libsecret backend explicitly instead of its basic_text fallback.
if (process.platform === 'linux' && (process.env.SWAYSOCK || /(^|:)sway(:|$)/i.test(process.env.XDG_CURRENT_DESKTOP || ''))) {
  app.commandLine.appendSwitch('password-store', 'gnome-libsecret')
}

app.setName('TradeLedgerOffice')
const hasSingleInstanceLock = app.requestSingleInstanceLock()

let mainWindow
let tray = null
let quitting = false
let officeStore
let activeSession = null
let officeServer = null
let remoteClient = null
let connectionConfig = null
const operationHandlers = new Map()
const adminToolsUnlocks = new Map()
const adminToolsFailures = new Map()
const ADMIN_TOOLS_UNLOCK_MS = 10 * 60 * 1000
const ADMIN_TOOLS_LOCKOUT_MS = 5 * 60 * 1000
let operationQueue = Promise.resolve()
const developmentUrl = process.env.ELECTRON_START_URL

function getDatabasePath() {
  if (process.env.PURCHASE_SALE_DB_PATH) return path.resolve(process.env.PURCHASE_SALE_DB_PATH)
  // Match the existing Windows Java installation path so current SQLite data stays visible.
  const root = process.platform === 'win32' && process.env.LOCALAPPDATA
    ? path.join(process.env.LOCALAPPDATA, 'PurchaseSaleOffice')
    : app.getPath('userData')
  return path.join(root, 'data', 'purchase-sale.sqlite')
}

function getLocalDeviceMacAddress() {
  const candidates = Object.entries(os.networkInterfaces()).flatMap(([name, interfaces]) =>
    (interfaces || []).filter((network) => !network.internal && network.mac && network.mac !== '00:00:00:00:00:00')
      .map((network) => ({ name, mac: network.mac.toUpperCase() })),
  )
  candidates.sort((left, right) => {
    const virtual = /virtual|vbox|vmware|docker|loopback|bluetooth|vpn|tunnel|wsl/i
    const physical = /ethernet|wi-?fi|wlan|^en|^eth/i
    return Number(virtual.test(left.name)) - Number(virtual.test(right.name)) || Number(physical.test(right.name)) - Number(physical.test(left.name))
  })
  return candidates[0]?.mac || ''
}

function getConnectionConfigPath() {
  return path.join(app.getPath('userData'), 'office-connection.json')
}

function getServerCertificatePaths() {
  const directory = path.join(app.getPath('userData'), 'office-server-certificate')
  return { directory, key: path.join(directory, 'server-key.pem'), cert: path.join(directory, 'server-cert.pem') }
}

function getDeviceAuthorityPaths() {
  const directory = path.join(app.getPath('userData'), 'office-device-authority')
  return { directory, key: path.join(directory, 'authority-key.pem'), cert: path.join(directory, 'authority-cert.pem') }
}

function getDeviceCredentialPath() {
  return path.join(app.getPath('userData'), 'office-device-credential.json')
}

function getBootstrapIdentityPath() { return path.join(app.getPath('userData'), 'bootstrap-installation.json') }
function getBootstrapApprovalPath() { return path.join(app.getPath('userData'), 'bootstrap-approval.json') }
function getBootstrapOwnerPublicKeyPath() { return path.join(__dirname, 'bootstrap-owner-public.pem') }

function hasSecureCredentialStorage() {
  return safeStorage.isEncryptionAvailable() && (process.platform !== 'linux' || safeStorage.getSelectedStorageBackend() !== 'basic_text')
}

async function createDeviceAuthority() {
  const files = getDeviceAuthorityPaths()
  await fs.mkdir(files.directory, { recursive: true })
  try {
    const [key, cert] = await Promise.all([fs.readFile(files.key, 'utf8'), fs.readFile(files.cert, 'utf8')])
    return { key, cert }
  } catch {
    const generated = await selfsigned.generate([{ name: 'commonName', value: 'TradeLedger Office Device Authority' }], {
      keySize: 3072, algorithm: 'sha256', notAfterDate: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000),
      extensions: [{ name: 'basicConstraints', cA: true, pathLenConstraint: 0, critical: true }, { name: 'keyUsage', keyCertSign: true, cRLSign: true, critical: true }],
    })
    await fs.writeFile(files.key, generated.private, { mode: 0o600 })
    await fs.writeFile(files.cert, generated.cert, { mode: 0o644 })
    return { key: generated.private, cert: generated.cert }
  }
}

async function issueDeviceCredential({ username, name }) {
  if (!officeStore) throw new Error('Device certificates can only be issued by the office database host')
  const deviceId = crypto.randomUUID()
  const passphrase = crypto.randomBytes(24).toString('base64url')
  const keys = crypto.generateKeyPairSync('rsa', { modulusLength: 3072, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } })
  const authority = await createDeviceAuthority()
  const issued = await selfsigned.generate([{ name: 'commonName', value: `TradeLedger device ${deviceId}` }], {
    keyType: 'rsa', keySize: 3072, algorithm: 'sha256', keyPair: { privateKey: keys.privateKey, publicKey: keys.publicKey },
    ca: { key: authority.key, cert: authority.cert }, passphrase,
    notAfterDate: new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000),
    extensions: [{ name: 'basicConstraints', cA: false, critical: true }, { name: 'keyUsage', digitalSignature: true, keyEncipherment: true, critical: true }, { name: 'extKeyUsage', clientAuth: true, critical: true }],
  })
  const fingerprint = crypto.createHash('sha256').update(new crypto.X509Certificate(issued.cert).raw).digest('hex')
  const device = officeStore.registerDevice({ deviceId, username, name, fingerprint })
  return { device, bundle: { version: 1, deviceId, username, name, certificate: issued.cert, encryptedPrivateKey: issued.private }, passphrase }
}

async function loadDeviceCredential() {
  try {
    const stored = JSON.parse(await fs.readFile(getDeviceCredentialPath(), 'utf8'))
    if (!hasSecureCredentialStorage()) throw new Error('Secure OS credential storage is unavailable. On Debian, install and sign in to a Secret Service keyring such as GNOME Keyring or KWallet.')
    return { cert: stored.certificate, key: safeStorage.decryptString(Buffer.from(stored.encryptedPrivateKey, 'base64')) }
  } catch (error) {
    if (error.code === 'ENOENT') return null
    throw new Error(`Saved device credential cannot be opened: ${error.message}`)
  }
}

async function getBootstrapOwnerPublicKey() {
  return fs.readFile(getBootstrapOwnerPublicKeyPath(), 'utf8')
}

async function loadOrCreateBootstrapIdentity() {
  if (!hasSecureCredentialStorage()) throw new Error('Secure OS credential storage is required. On Debian, install and sign in to GNOME Keyring or KWallet.')
  const filePath = getBootstrapIdentityPath()
  try {
    const saved = JSON.parse(await fs.readFile(filePath, 'utf8'))
    const privateKeyPem = safeStorage.decryptString(Buffer.from(saved.encryptedPrivateKey, 'base64'))
    const privateKey = crypto.createPrivateKey(privateKeyPem)
    const publicKey = crypto.createPublicKey(privateKey).export({ type: 'spki', format: 'pem' })
    if (privateKey.asymmetricKeyType !== 'ed25519' || publicKey !== saved.installationPublicKey || typeof saved.requestId !== 'string') {
      throw new Error('Saved installation identity is invalid')
    }
    return { request: { version: 1, requestId: saved.requestId, installationPublicKey: publicKey } }
  } catch (error) {
    if (error.code !== 'ENOENT') throw new Error(`Cannot open the protected installation identity: ${error.message}`)
  }

  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  })
  const saved = {
    version: 1,
    requestId: crypto.randomBytes(24).toString('base64url'),
    installationPublicKey: publicKey,
    encryptedPrivateKey: safeStorage.encryptString(privateKey).toString('base64'),
  }
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, `${JSON.stringify(saved)}\n`, { mode: 0o600, flag: 'wx' })
  return { request: { version: 1, requestId: saved.requestId, installationPublicKey: publicKey } }
}

async function getLocalBootstrapStatus() {
  try {
    const { request } = await loadOrCreateBootstrapIdentity()
    let savedApproval = null
    try {
      const encrypted = await fs.readFile(getBootstrapApprovalPath())
      savedApproval = JSON.parse(safeStorage.decryptString(encrypted))
    }
    catch (error) { if (error.code !== 'ENOENT') throw error }
    const ownerKey = await getBootstrapOwnerPublicKey()
    const approvedRequest = savedApproval?.request
    const acceptedAt = savedApproval?.acceptedAt
    const requestMatchesIdentity = approvedRequest?.requestId === request.requestId
      && approvedRequest?.installationPublicKey === request.installationPublicKey
    const authorized = Number.isSafeInteger(acceptedAt)
      && acceptedAt <= Date.now() + 5 * 60 * 1000
      && requestMatchesIdentity
      && verifyBootstrapGrant(savedApproval?.grant, approvedRequest, ownerKey, acceptedAt)
    return { authorized, request, authorizedFirstAdminUsername: authorized ? (savedApproval.grant.firstAdminUsername || null) : null, error: null }
  } catch (error) {
    return { authorized: false, request: null, authorizedFirstAdminUsername: null, error: error instanceof Error ? error.message : 'Could not prepare installation approval' }
  }
}

async function authorizeLocalInstallation(input) {
  if (remoteClient || !officeStore) throw new Error('Only the company computer can approve its local installation')
  const status = await getLocalBootstrapStatus()
  if (!status.request) throw new Error(status.error || 'Could not create an installation approval request')
  const requestInput = typeof input?.request === 'string' ? JSON.parse(input.request) : input?.request
  const grant = typeof input?.grant === 'string' ? JSON.parse(input.grant) : input?.grant
  const request = {
    ...status.request,
    firstAdminUsername: requestInput?.firstAdminUsername ? String(requestInput.firstAdminUsername).trim() : null,
  }
  if (requestInput?.requestId !== status.request.requestId || requestInput?.installationPublicKey !== status.request.installationPublicKey) {
    throw new Error('Approval request does not belong to this installation')
  }
  const ownerKey = await getBootstrapOwnerPublicKey()
  if (!verifyBootstrapGrant(grant, request, ownerKey)) throw new Error('Approval is invalid, expired, or was issued for a different installation or administrator name')
  const filePath = getBootstrapApprovalPath()
  const accepted = safeStorage.encryptString(JSON.stringify({ grant, request, acceptedAt: Date.now() }))
  await fs.writeFile(`${filePath}.tmp`, accepted, { mode: 0o600 })
  await fs.rename(`${filePath}.tmp`, filePath)
  return { authorized: true }
}

async function downloadLocalBootstrapRequest(input) {
  if (remoteClient || !officeStore) throw new Error('Installation approval requests can only be downloaded on the company computer')
  const status = await getLocalBootstrapStatus()
  if (!status.request) throw new Error(status.error || 'Could not create an installation approval request')
  const firstAdminUsername = input?.firstAdminUsername ? String(input.firstAdminUsername).trim() : null
  if (input?.firstAdminUsername && !firstAdminUsername) throw new Error('Enter the first administrator name before downloading the request')
  const request = { ...status.request, firstAdminUsername }
  const choice = await dialog.showSaveDialog(mainWindow, {
    title: 'Save installation approval request',
    defaultPath: path.join(app.getPath('downloads'), 'tradeledger-installation-request.json'),
    filters: [{ name: 'JSON file', extensions: ['json'] }],
  })
  if (choice.canceled || !choice.filePath) return { canceled: true, path: null }
  await fs.writeFile(choice.filePath, `${JSON.stringify(request, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
  return { canceled: false, path: choice.filePath }
}

function getLanAddresses() {
  return Object.values(os.networkInterfaces()).flatMap((entries) => entries || [])
    .filter((entry) => entry.family === 'IPv4' && !entry.internal)
    .map((entry) => entry.address)
}

function bindRemoteClient(client) {
  client.onDataChanged(notifyDataChanged)
  client.onSessionExpired(() => {
    activeSession = null
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('office:session-expired')
  })
}

function notifyDataChanged() {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('office:data-changed')
}

async function loadRemoteConnection() {
  const configPath = getConnectionConfigPath()
  try {
    const config = JSON.parse(await fs.readFile(configPath, 'utf8'))
    remoteClient = createOfficeRemoteClient({ ...config, deviceCredential: await loadDeviceCredential() })
    bindRemoteClient(remoteClient)
    connectionConfig = { url: config.url, fingerprint: config.fingerprint }
    return true
  } catch (error) {
    if (error.code === 'ENOENT') return false
    throw new Error(`Saved office server connection is invalid: ${error.message}`)
  }
}

async function createServerCertificate() {
  const paths = getServerCertificatePaths()
  await fs.mkdir(paths.directory, { recursive: true })
  try {
    const [key, cert] = await Promise.all([fs.readFile(paths.key, 'utf8'), fs.readFile(paths.cert, 'utf8')])
    return { key, cert }
  } catch {
    const generated = await selfsigned.generate([{ name: 'commonName', value: 'TradeLedger Office' }], {
      keySize: 2048,
      algorithm: 'sha256',
      notAfterDate: new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000),
      extensions: [
        { name: 'basicConstraints', cA: false, critical: true },
        { name: 'keyUsage', digitalSignature: true, keyEncipherment: true, critical: true },
        { name: 'extKeyUsage', serverAuth: true },
      ],
    })
    await fs.writeFile(paths.key, generated.private, { mode: 0o600, flag: 'wx' }).catch(async (error) => {
      if (error.code !== 'EEXIST') throw error
      await fs.writeFile(paths.key, generated.private, { mode: 0o600 })
    })
    await fs.writeFile(paths.cert, generated.cert, { mode: 0o644 })
    return { key: generated.private, cert: generated.cert }
  }
}

async function startOfficeServer({ automatic = false } = {}) {
  if (!officeStore || remoteClient) throw new Error('Only the computer with the local office database can host shared access')
  if (!automatic && !activeSession?.permissions.includes('User Rights')) throw new Error('Only an administrator can start the office server')
  if (officeServer) return officeServer.info

  const [tls, deviceAuthority] = await Promise.all([createServerCertificate(), createDeviceAuthority()])
  const certificate = new crypto.X509Certificate(tls.cert)
  const fingerprint = crypto.createHash('sha256').update(certificate.raw).digest('hex').match(/.{2}/g).join(':').toUpperCase()
  const addresses = getLanAddresses()
  const server = createOfficeRpcServer({
    tls: { ...tls, ca: deviceAuthority.cert, requestCert: true, rejectUnauthorized: false },
    requireDeviceCertificate: true,
    resolveDevice: (clientCertificate) => {
      const clientFingerprint = crypto.createHash('sha256').update(clientCertificate.raw).digest('hex')
      return officeStore.getActiveDevice(clientFingerprint)
    },
    host: '0.0.0.0',
    port: 48391,
    permissionFor: (channel, args) => {
      if (LOCAL_ONLY_CHANNELS.has(channel)) return undefined
      const permission = operationHandlers.get(channel)?.permission
      return typeof permission === 'function' ? permission(...args) : permission
    },
    refreshSession: (session) => officeStore.getUserSession(session.username),
    dispatch: (channel, args, session, device) => invokeOfficeOperation(channel, args, session, device?.deviceId || 'local'),
    onChange: notifyDataChanged,
  })
  await server.listen()
  const info = { urls: addresses.map((address) => `https://${address}:48391`), fingerprint, port: 48391 }
  officeServer = { server, info }
  updateTrayMenu()
  return info
}

async function stopOfficeServer() {
  if (!officeServer) return
  const current = officeServer
  officeServer = null
  updateTrayMenu()
  await current.server.close()
}

function updateTrayMenu() {
  if (!tray) return
  tray.setToolTip(officeServer ? 'TradeLedger Office · Shared access running' : 'TradeLedger Office')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open TradeLedger Office', click: () => showWindow() },
    { label: officeServer ? 'Shared office server is running' : 'Shared office server is stopped', enabled: false },
    { type: 'separator' },
    { label: 'Quit and stop shared access', click: () => { quitting = true; app.quit() } },
  ]))
}

function showWindow() {
  if (!mainWindow) createWindow()
  else {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  }
}

function createTray() {
  if (tray || process.platform !== 'win32') return
  const icon = nativeImage.createFromPath(path.join(__dirname, 'tray.png'))
  tray = new Tray(icon)
  tray.on('double-click', showWindow)
  updateTrayMenu()
}

function assertTrustedSender(event) {
  if (!mainWindow || event.sender !== mainWindow.webContents) throw new Error('Untrusted renderer')
  const url = event.senderFrame?.url || ''
  const trusted = developmentUrl
    ? url.startsWith(developmentUrl)
    : url.startsWith(pathToFileURL(path.join(app.getAppPath(), 'dist', 'index.html')).href)
  if (!trusted) throw new Error('IPC request rejected from an unexpected page')
}

function registerIpcHandler(channel, handler) {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      return { __officeIpcResponse: true, value: await handler(event, ...args) }
    } catch (error) {
      if (error?.code === 'OFFICE_AUTH_EXPIRED') {
        activeSession = null
        try { event.sender.send('office:session-expired') } catch { /* the renderer may have closed */ }
      }
      return {
        __officeIpcResponse: true,
        error: { code: error?.code || null, message: userFacingError(error, channel) },
      }
    }
  })
}

function registerHandler(channel, handler, permission = null) {
  operationHandlers.set(channel, { handler, permission })
  registerIpcHandler(channel, async (event, ...args) => {
    assertTrustedSender(event)
    if (channel === 'auth:login' && !remoteClient && args[0] && typeof args[0] === 'object') {
      args[0] = { ...args[0], macAddress: getLocalDeviceMacAddress() }
    }
    if (remoteClient && !LOCAL_ONLY_CHANNELS.has(channel)) {
      const result = await remoteClient.invoke(channel, args)
      if (channel === 'auth:setup' || channel === 'auth:login') activeSession = result
      if (channel === 'auth:logout') activeSession = null
      return result
    }
    const result = await invokeOfficeOperation(channel, args, activeSession)
    if (officeServer && !remoteClient) officeServer.server.notifyChange(channel)
    if (channel === 'auth:setup' || channel === 'auth:login') {
      activeSession = result
      officeStore?.setAuditActor(result?.username || 'system')
    }
    if (channel === 'auth:logout') {
      activeSession = null
      officeStore?.setAuditActor('system')
    }
    return result
  })
}

function adminToolsKey(username, deviceId = 'local') { return `${username}\u0000${deviceId || 'local'}` }

function isAdminToolsUnlocked(username, deviceId = 'local') {
  const key = adminToolsKey(username, deviceId)
  const unlock = adminToolsUnlocks.get(key)
  if (!unlock || unlock.expiresAt <= Date.now()) { adminToolsUnlocks.delete(key); return false }
  return true
}

function invokeOfficeOperation(channel, args, session, deviceId = 'local') {
  const task = async () => {
    const definition = operationHandlers.get(channel)
    if (!definition) throw new Error('Unsupported office operation')
    if (channel === 'auth:authorize-bootstrap' && deviceId !== 'local') throw new Error('Installation approval must be imported on the company computer itself')
    if (requiresAuthenticatedSession(channel)) {
      if (!session) throw new Error('Please sign in to continue')
      const requiredPermission = typeof definition.permission === 'function' ? definition.permission(...args) : definition.permission
      if (requiredPermission && !(Array.isArray(requiredPermission)
        ? requiredPermission.some((entry) => session.permissions.includes(entry))
        : session.permissions.includes(requiredPermission))) throw new Error('Your account does not have permission for this operation')
    }
    const needsAdminToolsUnlock = channel.startsWith('users:') || channel.startsWith('devices:') || channel.startsWith('database:')
    if (needsAdminToolsUnlock && !isAdminToolsUnlocked(session?.username, deviceId)) throw new Error('Unlock admin-only pages with the separate admin-tools password first')
    const unlockKey = adminToolsKey(session?.username, deviceId)
    if (channel === 'security:unlock' && (adminToolsFailures.get(unlockKey)?.blockedUntil || 0) > Date.now()) throw new Error('Too many incorrect admin-tools passwords. Wait 5 minutes and try again.')

    if (['accounts:save', 'items:save', 'banks:save'].includes(channel)) {
      const input = args[0] || {}
      const records = channel === 'accounts:save' ? officeStore.listAccounts()
        : channel === 'items:save' ? officeStore.listItems() : officeStore.listBanks()
      const key = records.some((record) => record.code === String(input.code || '').trim())
      if (key && (!input.__baseline || typeof input.__baseline !== 'object')) {
        throw new Error('This record needs a current copy before it can be updated. Refresh the list and reopen it.')
      }
    }
    const input = args[0] || {}
    const currentRecord = channel === 'challans:update'
      ? officeStore.listChallans().find((record) => record.number === String(input.number || '').trim())
      : channel === 'cheques:save'
        ? officeStore.listCheques().find((record) => record.number === String(input.number || '').trim())
        : channel === 'vouchers:save' && input.update
          ? officeStore.listVouchers().find((record) => record.number === String(input.number || '').trim())
          : null
    if (currentRecord && (!input.__baseline || typeof input.__baseline !== 'object')) {
      throw new Error('This record needs a current copy before it can be updated. Refresh the list and reopen it.')
    }

    const previousSession = activeSession
    activeSession = session
    officeStore?.setAuditActor(session?.username || 'system')
    if (!channel.startsWith('auth:')) officeStore?.setCurrentUser(session?.username || 'system', false)
    try {
      const value = await definition.handler(...args, session)
      if (channel === 'security:unlock') {
        if (!value) {
          const failures = adminToolsFailures.get(unlockKey) || { count: 0, blockedUntil: 0 }
          failures.count += 1
          if (failures.count >= 5) failures.blockedUntil = Date.now() + ADMIN_TOOLS_LOCKOUT_MS
          adminToolsFailures.set(unlockKey, failures)
          throw new Error(failures.blockedUntil > Date.now() ? 'Too many incorrect admin-tools passwords. Wait 5 minutes and try again.' : 'Admin-tools password is incorrect')
        }
        adminToolsFailures.delete(unlockKey)
        const expiresAt = Date.now() + ADMIN_TOOLS_UNLOCK_MS
        adminToolsUnlocks.set(adminToolsKey(session.username, deviceId), { expiresAt })
        return { expiresAt }
      }
      if (channel === 'security:configure-admin-tools-password') { adminToolsUnlocks.clear(); adminToolsFailures.clear() }
      if (channel === 'auth:status') return { ...value, session: session || null, adminToolsUnlockedUntil: session && isAdminToolsUnlocked(session.username, deviceId) ? adminToolsUnlocks.get(adminToolsKey(session.username, deviceId)).expiresAt : null }
      return value
    } finally {
      activeSession = previousSession
      officeStore?.setAuditActor(previousSession?.username || 'system')
      if (!channel.startsWith('auth:')) officeStore?.setCurrentUser(previousSession?.username || 'system', false)
      if (channel === 'auth:logout' && session?.username) { adminToolsUnlocks.delete(adminToolsKey(session.username, deviceId)); adminToolsFailures.delete(adminToolsKey(session.username, deviceId)) }
    }
  }
  const result = operationQueue.then(task, task)
  operationQueue = result.catch(() => undefined)
  return result
}

function registerIpc() {
  registerHandler('auth:status', async () => {
    const localInstallation = await getLocalBootstrapStatus()
    const authorized = localInstallation.authorized
    return {
      hasUsers: officeStore.hasUsers(),
      hasCompanyProfile: authorized && officeStore.hasCompanyProfile(),
      hasAdminToolsPassword: officeStore.hasAdminToolsPassword(),
      companyProfile: authorized ? { ...officeStore.getCompanyProfile(), logoPath: '' } : null,
      session: authorized ? activeSession : null,
      localInstallation,
    }
  })
  registerHandler('auth:authorize-bootstrap', (input) => input?.action === 'download-request'
    ? downloadLocalBootstrapRequest(input)
    : authorizeLocalInstallation(input))
  registerHandler('auth:setup', async (input) => {
    if (remoteClient) throw new Error('The company administrator must create the first account on the company computer')
    if (officeStore.hasUsers()) throw new Error('The company administrator is already registered')
    const bootstrap = await getLocalBootstrapStatus()
    if (!bootstrap.authorized) throw new Error(bootstrap.error || 'Owner approval is required before the first administrator can be registered')
    if (!bootstrap.authorizedFirstAdminUsername || bootstrap.authorizedFirstAdminUsername !== String(input.username || '').trim()) {
      throw new Error('The owner approval is for a different administrator name. Request approval for the intended first administrator.')
    }
    activeSession = officeStore.createFirstUser(input)
    return activeSession
  })
  registerHandler('auth:login', async (input) => {
    if (!remoteClient && !(await getLocalBootstrapStatus()).authorized) throw new Error('Owner approval is required before this installation can sign in')
    activeSession = officeStore.authenticate(input.username, input.password, input.macAddress)
    return activeSession
  })
  registerHandler('auth:logout', () => { officeStore.setCurrentUser(activeSession?.username); activeSession = null })
  registerHandler('security:unlock', (password) => officeStore.verifyAdminToolsPassword(password), 'User Rights')
  registerHandler('security:configure-admin-tools-password', (input) => officeStore.configureAdminToolsPassword(input), 'User Rights')
  registerIpcHandler('device:import-credential', async (event, input) => {
    assertTrustedSender(event)
    if (!hasSecureCredentialStorage()) throw new Error('Secure OS credential storage is unavailable. On Debian, install and sign in to a Secret Service keyring such as GNOME Keyring or KWallet.')
    const bundle = JSON.parse(String(input?.bundle || ''))
    if (bundle?.version !== 1 || !bundle.certificate || !bundle.encryptedPrivateKey) throw new Error('This is not a valid TradeLedger device credential file')
    const certificate = new crypto.X509Certificate(bundle.certificate)
    const privateKey = crypto.createPrivateKey({ key: bundle.encryptedPrivateKey, format: 'pem', passphrase: String(input?.passphrase || '') })
    const certPublic = certificate.publicKey.export({ type: 'spki', format: 'der' })
    const keyPublic = crypto.createPublicKey(privateKey).export({ type: 'spki', format: 'der' })
    if (!certPublic.equals(keyPublic)) throw new Error('The device credential does not contain a matching private key and certificate')
    const credential = { certificate: bundle.certificate, encryptedPrivateKey: safeStorage.encryptString(privateKey.export({ type: 'pkcs8', format: 'pem' })).toString('base64') }
    const filePath = getDeviceCredentialPath()
    await fs.writeFile(`${filePath}.tmp`, JSON.stringify(credential), { mode: 0o600 })
    await fs.rename(`${filePath}.tmp`, filePath)
    return { deviceId: bundle.deviceId, username: bundle.username, name: bundle.name }
  })
  registerHandler('app:quit', () => app.quit())
  registerHandler('app:can-open-devtools', () => !app.isPackaged)
  registerHandler('app:menu-action', (action) => {
    if (!mainWindow) return
    const contents = mainWindow.webContents
    switch (action) {
      case 'reload': contents.reload(); break
      case 'forceReload': contents.reloadIgnoringCache(); break
      case 'devTools':
        if (app.isPackaged) throw new Error('Developer tools are disabled in packaged builds')
        contents.toggleDevTools()
        break
      case 'zoomIn': contents.setZoomLevel(contents.getZoomLevel() + 0.5); break
      case 'zoomOut': contents.setZoomLevel(contents.getZoomLevel() - 0.5); break
      case 'resetZoom': contents.setZoomLevel(0); break
      case 'minimize': mainWindow.minimize(); break
      case 'close': mainWindow.close(); break
      case 'fullscreen': mainWindow.setFullScreen(!mainWindow.isFullScreen()); break
      case 'undo': contents.undo(); break
      case 'redo': contents.redo(); break
      case 'cut': contents.cut(); break
      case 'copy': contents.copy(); break
      case 'paste': contents.paste(); break
      case 'selectAll': contents.selectAll(); break
      default: throw new Error('Unsupported application menu action')
    }
  })
  registerHandler('ids:next', (entity) => officeStore.nextId(String(entity)), (entity) => ({ account: 'Chart of Accounts', item: 'Items', bank: 'Banks', purchaseChallan: 'Purchase Challans', saleChallan: 'Sale Challans', cheque: 'Cheque Detail', transfer: 'Transfer', voucher: ['Voucher', 'Journal Voucher', 'Payment / Receipt'] })[entity] || null)
  registerHandler('dashboard:get', (_payload, session) => officeStore.getDashboard(session.permissions), 'Overview')
  registerHandler('company:get', () => officeStore.getCompanyProfile(), ['Company Profile', 'Purchase Challans', 'Sale Challans', 'Voucher', 'Journal Voucher', 'Payment / Receipt', 'Reports'])
  registerHandler('company:save', (value) => officeStore.saveCompanyProfile(value), 'User Rights')
  registerHandler('company:logo', async () => {
    const logoPath = officeStore.getCompanyProfile().logoPath
    const mime = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }[path.extname(logoPath).toLowerCase()]
    if (!mime || !path.isAbsolute(logoPath)) return null
    try {
      const image = await fs.readFile(logoPath)
      if (image.length > 4 * 1024 * 1024) return null
      return `data:${mime};base64,${image.toString('base64')}`
    } catch { return null }
  }, ['Company Profile', 'Purchase Challans', 'Sale Challans', 'Voucher', 'Journal Voucher', 'Payment / Receipt', 'Reports'])
  registerHandler('accounts:list', () => officeStore.listAccounts(), ['Chart of Accounts', 'Purchase Challans', 'Sale Challans', 'Banks', 'Cheque Detail', 'Voucher', 'Journal Voucher', 'Payment / Receipt', 'Search Payment', 'Reports'])
  registerHandler('accounts:save', (value) => officeStore.saveAccount(value), 'Chart of Accounts')
  registerHandler('accounts:remove', (code) => officeStore.deleteAccount(String(code)), 'Chart of Accounts')
  registerHandler('items:list', () => officeStore.listItems(), ['Items', 'Purchase Challans', 'Sale Challans', 'Reports'])
  registerHandler('items:save', (value) => officeStore.saveItem(value), 'Items')
  registerHandler('items:create-for-challan', (value) => {
    if (!['PURCHASE', 'SALE'].includes(String(value?.type || '').toUpperCase())) throw new Error('Choose a valid challan type')
    return officeStore.createItemFromChallan(value.item || {})
  }, (value) => String(value?.type || '').toUpperCase() === 'SALE' ? 'Sale Challans' : 'Purchase Challans')
  registerHandler('items:remove', (code) => officeStore.deleteItem(String(code)), 'Items')
  registerHandler('banks:list', () => officeStore.listBanks(), ['Banks', 'Cheque Detail'])
  registerHandler('banks:save', (value) => officeStore.saveBank(value), 'Banks')
  registerHandler('banks:remove', (code) => officeStore.deleteBank(String(code)), 'Banks')
  registerHandler('challans:list', (type) => officeStore.listChallans(type ? String(type) : null), (type) => type === 'SALE' ? ['Sale Challans', 'Reports'] : type === 'PURCHASE' ? ['Purchase Challans', 'Reports'] : ['Purchase Challans', 'Sale Challans', 'Reports'])
  registerHandler('challans:post', (value) => officeStore.postChallan(value), (value) => value?.type === 'SALE' ? 'Sale Challans' : 'Purchase Challans')
  registerHandler('challans:update', (value) => officeStore.updateChallan(value), (value) => value?.type === 'SALE' ? 'Sale Challans' : 'Purchase Challans')
  registerHandler('challans:remove', (number) => officeStore.deleteChallan(String(number)), (number) => officeStore.getChallanType(String(number)) === 'SALE' ? 'Sale Challans' : 'Purchase Challans')
  registerHandler('cheques:list', () => officeStore.listCheques(), ['Cheque Detail', 'Reports'])
  registerHandler('cheques:save', (value) => officeStore.saveCheque(value), 'Cheque Detail')
  registerHandler('cheques:remove', (number) => officeStore.deleteCheque(String(number)), 'Cheque Detail')
  registerHandler('vouchers:list', () => {
    if (activeSession.permissions.includes('Reports')) return officeStore.listVouchers()
    const types = []
    if (activeSession.permissions.includes('Voucher')) types.push('VOUCHER')
    if (activeSession.permissions.includes('Journal Voucher')) types.push('JOURNAL VOUCHER')
    if (activeSession.permissions.includes('Payment / Receipt') || activeSession.permissions.includes('Search Payment')) types.push('PAYMENT', 'RECEIPT')
    return officeStore.listVouchers(types)
  }, ['Voucher', 'Journal Voucher', 'Search Payment', 'Payment / Receipt', 'Reports'])
  registerHandler('vouchers:save', (value) => officeStore.saveVoucher(value), (value) => ({ VOUCHER: 'Voucher', 'JOURNAL VOUCHER': 'Journal Voucher', PAYMENT: 'Payment / Receipt', RECEIPT: 'Payment / Receipt' })[String(value?.type || 'VOUCHER').toUpperCase()] || 'Voucher')
  registerHandler('vouchers:remove', (number) => officeStore.deleteVoucher(String(number)), (number) => ({ VOUCHER: 'Voucher', 'JOURNAL VOUCHER': 'Journal Voucher', PAYMENT: 'Payment / Receipt', RECEIPT: 'Payment / Receipt' })[officeStore.getVoucherType(String(number))] || null)
  registerHandler('stock:locations', () => officeStore.listLocations(), ['Items', 'Purchase Challans', 'Sale Challans', 'Item Opening Balances', 'Transfer', 'Reports', 'Locations'])
  registerHandler('locations:save', (value) => officeStore.saveLocation(value), 'Locations')
  registerHandler('locations:remove', (name) => officeStore.deleteLocation(String(name)), 'Locations')
  registerHandler('stock:quantity', ({ itemCode, location }) => officeStore.getStock(String(itemCode), String(location)), ['Items', 'Transfer'])
  registerHandler('stock:types', () => officeStore.listStockTypes(), ['Items', 'Purchase Challans', 'Sale Challans', 'Stock Types'])
  registerHandler('stock-types:save', (value) => officeStore.saveStockType(value), 'Stock Types')
  registerHandler('stock-types:remove', (code) => officeStore.deleteStockType(String(code)), 'Stock Types')
  registerHandler('stock:movements', () => officeStore.listStockMovements(), ['Reports', 'Transfer', 'Item Opening Balances', 'Locations'])
  registerHandler('stock:openings', () => officeStore.listOpeningBalances(), 'Item Opening Balances')
  registerHandler('stock:opening:add', (value) => officeStore.addOpeningBalance(value), ['Item Opening Balances', 'Items'])
  registerHandler('stock:transfer', (value) => officeStore.transferStock(value), 'Transfer')
  registerHandler('users:list', () => officeStore.listUsers(), 'User Rights')
  registerHandler('users:save', (value) => officeStore.saveUser(value), 'User Rights')
  registerHandler('users:remove', (username) => officeStore.deleteUser(String(username)), 'User Rights')
  registerHandler('devices:list', () => officeStore.listDevices(), 'User Rights')
  registerHandler('devices:create', async (input) => issueDeviceCredential(input), 'User Rights')
  registerHandler('devices:revoke', (deviceId) => officeStore.revokeDevice(String(deviceId)), 'User Rights')
  registerHandler('audit:list', () => officeStore.auditEvents(), 'Audit Log')
  registerHandler('database:backup', async () => {
    const backupDirectory = path.join(path.dirname(getDatabasePath()), 'backups')
    const timestamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
    const target = path.join(backupDirectory, `purchase-sale-${timestamp}.sqlite`)
    return { ...await officeStore.backupTo(target), path: target }
  }, 'User Rights')
  registerHandler('database:export', async () => {
    const choice = await dialog.showSaveDialog(mainWindow, {
      title: 'Export office data',
      defaultPath: path.join(app.getPath('documents'), `purchase-sale-export-${new Date().toISOString().slice(0, 10)}.json`),
      filters: [{ name: 'JSON data export', extensions: ['json'] }],
    })
    if (choice.canceled || !choice.filePath) return { canceled: true }
    const payload = officeStore.exportData()
    await fs.writeFile(choice.filePath, `${JSON.stringify(payload, null, 2)}\n`)
    return { canceled: false, path: choice.filePath, bytes: (await fs.stat(choice.filePath)).size }
  }, 'User Rights')
  registerHandler('database:verify', () => officeStore.verifyDatabase(), 'User Rights')
  registerHandler('database:open-backups', async () => {
    const directory = path.join(path.dirname(getDatabasePath()), 'backups')
    await fs.mkdir(directory, { recursive: true })
    const error = await shell.openPath(directory)
    if (error) throw new Error(`Could not open backup folder: ${error}`)
  }, 'User Rights')

  registerIpcHandler('connection:get', (event) => {
    assertTrustedSender(event)
    return { mode: remoteClient ? 'remote' : 'local', ...(connectionConfig || {}) }
  })
  registerIpcHandler('connection:configure-remote', async (event, config) => {
    assertTrustedSender(event)
    const candidate = { url: String(config?.url || '').trim(), fingerprint: String(config?.fingerprint || '').trim() }
    const client = createOfficeRemoteClient({ ...candidate, deviceCredential: await loadDeviceCredential() })
    await fs.mkdir(path.dirname(getConnectionConfigPath()), { recursive: true })
    const temporary = `${getConnectionConfigPath()}.tmp`
    await fs.writeFile(temporary, JSON.stringify(candidate), { mode: 0o600 })
    await fs.rename(temporary, getConnectionConfigPath())
    remoteClient?.close()
    remoteClient = client
    bindRemoteClient(remoteClient)
    connectionConfig = candidate
    activeSession = null
    return { mode: 'remote', ...candidate }
  })
  registerIpcHandler('connection:use-local', async (event) => {
    assertTrustedSender(event)
    remoteClient?.close()
    remoteClient = null
    connectionConfig = null
    await fs.rm(getConnectionConfigPath(), { force: true })
    if (!officeStore) officeStore = openOfficeDatabase(getDatabasePath())
    activeSession = null
    return { mode: 'local' }
  })
  registerIpcHandler('server:start', async (event) => {
    assertTrustedSender(event)
    if (!activeSession?.permissions.includes('User Rights') || !isAdminToolsUnlocked(activeSession.username, 'local')) throw new Error('Unlock Database Tools with the separate admin-tools password first')
    return startOfficeServer()
  })
  registerIpcHandler('server:stop', async (event) => {
    assertTrustedSender(event)
    if (!activeSession?.permissions.includes('User Rights')) throw new Error('Only an administrator can stop the office server')
    if (!isAdminToolsUnlocked(activeSession.username, 'local')) throw new Error('Unlock Database Tools with the separate admin-tools password first')
    await stopOfficeServer()
  })
  registerIpcHandler('server:status', (event) => {
    assertTrustedSender(event)
    if (!activeSession?.permissions.includes('User Rights') || !isAdminToolsUnlocked(activeSession.username, 'local')) throw new Error('Unlock Database Tools with the separate admin-tools password first')
    return officeServer?.info ?? null
  })
  registerIpcHandler('server:get-autostart', (event) => {
    assertTrustedSender(event)
    if (!activeSession?.permissions.includes('User Rights') || !isAdminToolsUnlocked(activeSession.username, 'local')) throw new Error('Unlock Database Tools with the separate admin-tools password first')
    return process.platform === 'win32' && app.getLoginItemSettings({ args: ['--office-start-hidden'] }).openAtLogin
  })
  registerIpcHandler('server:set-autostart', async (event, enabled) => {
    assertTrustedSender(event)
    if (!activeSession?.permissions.includes('User Rights')) throw new Error('Only an administrator can change host startup settings')
    if (!isAdminToolsUnlocked(activeSession.username, 'local')) throw new Error('Unlock Database Tools with the separate admin-tools password first')
    if (process.platform !== 'win32' || !app.isPackaged) throw new Error('Automatic host startup is available in the installed Windows app')
    if (enabled) await startOfficeServer()
    app.setLoginItemSettings({ openAtLogin: Boolean(enabled), args: ['--office-start-hidden'] })
    return app.getLoginItemSettings({ args: ['--office-start-hidden'] }).openAtLogin
  })
}

function setContentSecurityPolicy() {
  // Vite injects an inline React Refresh preamble; this exception is dev-only.
  const csp = contentSecurityPolicy(developmentUrl)
  const filter = { urls: ['http://127.0.0.1:5173/*', 'file:///*'] }
  const ses = require('electron').session.defaultSession
  ses.webRequest.onHeadersReceived(filter, (details, callback) => {
    callback({ responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [csp] } })
  })
}

function createWindow({ hidden = false } = {}) {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: 'TradeLedger Office',
    icon: path.join(__dirname, 'app-icon.png'),
    backgroundColor: '#f4f6f8',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  })
  mainWindow.once('ready-to-show', () => { if (!hidden) mainWindow.show() })
  mainWindow.on('close', (event) => {
    if (officeServer && !quitting) {
      event.preventDefault()
      mainWindow.hide()
      tray?.displayBalloon({ title: 'TradeLedger Office is still running', content: 'Shared access remains available. Open it from the notification area, or choose Quit to stop sharing.' })
    }
  })
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  mainWindow.webContents.on('will-navigate', (event, target) => {
    const trusted = developmentUrl
      ? target.startsWith(developmentUrl)
      : target.startsWith(pathToFileURL(path.join(app.getAppPath(), 'dist', 'index.html')).href)
    if (!trusted) event.preventDefault()
  })
  if (developmentUrl) mainWindow.loadURL(developmentUrl)
  else mainWindow.loadFile(path.join(app.getAppPath(), 'dist', 'index.html'))
  mainWindow.on('closed', () => { mainWindow = null })
}

function registerScreenshotDownloads() {
  require('electron').session.defaultSession.on('will-download', (_event, item, contents) => {
    const filename = path.basename(item.getFilename() || 'tradeledger-screenshot.png')
    if (item.getMimeType() !== 'image/png' && !filename.toLowerCase().endsWith('.png')) return

    item.pause()
    const owner = mainWindow && !mainWindow.isDestroyed() ? mainWindow : BrowserWindow.fromWebContents(contents)
    void dialog.showSaveDialog(owner, {
      title: 'Save DevTools screenshot',
      defaultPath: path.join(app.getPath('downloads'), filename),
      filters: [{ name: 'PNG image', extensions: ['png'] }],
    }).then(({ canceled, filePath }) => {
      if (canceled || !filePath) { item.cancel(); return }
      item.setSavePath(filePath)
      item.once('done', (_downloadEvent, state) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('app:screenshot-download-complete', { state, path: item.getSavePath() })
        }
      })
      item.resume()
    }).catch(() => item.cancel())
  })
}

app.whenReady().then(async () => {
  if (!hasSingleInstanceLock) return
  Menu.setApplicationMenu(null)
  const useRemote = await loadRemoteConnection()
  if (!useRemote) officeStore = openOfficeDatabase(getDatabasePath())
  setContentSecurityPolicy()
  registerIpc()
  registerScreenshotDownloads()
  createTray()
  const startHidden = process.platform === 'win32' && process.argv.includes('--office-start-hidden')
  if (process.platform === 'win32' && app.isPackaged && app.getLoginItemSettings({ args: ['--office-start-hidden'] }).openAtLogin) {
    try { await startOfficeServer({ automatic: true }) }
    catch (error) { dialog.showErrorBox('Shared office did not start', error instanceof Error ? error.message : 'Could not start shared access') }
  }
  createWindow({ hidden: startHidden && Boolean(officeServer) })
  app.on('activate', showWindow)
}).catch((error) => {
  dialog.showErrorBox('Cannot start TradeLedger Office', error instanceof Error ? error.message : 'Startup failed')
  app.quit()
})

if (hasSingleInstanceLock) app.on('second-instance', showWindow)

app.on('before-quit', (event) => {
  quitting = true
  tray?.destroy()
  tray = null
  if (officeServer) {
    event.preventDefault()
    void stopOfficeServer().finally(() => { officeStore?.close(); app.quit() })
  } else officeStore?.close()
})
app.on('window-all-closed', () => { if (process.platform !== 'darwin' && !officeServer) app.quit() })
