const { contextBridge, ipcRenderer, webUtils } = require('electron')

async function invoke(channel, payload) {
  const response = await ipcRenderer.invoke(channel, payload)
  if (!response?.__officeIpcResponse) return response
  if (response.error) {
    const error = new Error(response.error.message)
    if (response.error.code) error.code = response.error.code
    throw error
  }
  return response.value
}

contextBridge.exposeInMainWorld('office', Object.freeze({
  auth: {
    status: () => invoke('auth:status'),
    downloadBootstrapRequest: (value) => invoke('auth:authorize-bootstrap', { ...value, action: 'download-request' }),
    authorizeBootstrap: (grant) => invoke('auth:authorize-bootstrap', grant),
    setup: (value) => invoke('auth:setup', value),
    login: (value) => invoke('auth:login', value),
    logout: () => invoke('auth:logout'),
    onSessionExpired: (callback) => {
      const listener = () => callback()
      ipcRenderer.on('office:session-expired', listener)
      return () => ipcRenderer.removeListener('office:session-expired', listener)
    },
  },
  sync: {
    onDataChanged: (callback) => {
      const listener = () => callback()
      ipcRenderer.on('office:data-changed', listener)
      return () => ipcRenderer.removeListener('office:data-changed', listener)
    },
  },
  app: {
    quit: () => invoke('app:quit'),
    canOpenDevTools: () => invoke('app:can-open-devtools'),
    menuAction: (action) => invoke('app:menu-action', action),
    onScreenshotDownloadComplete: (callback) => {
      const listener = (_event, result) => callback(result)
      ipcRenderer.on('app:screenshot-download-complete', listener)
      return () => ipcRenderer.removeListener('app:screenshot-download-complete', listener)
    },
  },
  connection: {
    get: () => invoke('connection:get'),
    configureRemote: (value) => invoke('connection:configure-remote', value),
    useLocal: () => invoke('connection:use-local'),
  },
  device: { importCredential: (value) => invoke('device:import-credential', value) },
  security: {
    unlockAdminTools: (password) => invoke('security:unlock', password),
    configureAdminToolsPassword: (value) => invoke('security:configure-admin-tools-password', value),
  },
  server: {
    start: () => invoke('server:start'),
    stop: () => invoke('server:stop'),
    status: () => invoke('server:status'),
    getAutostart: () => invoke('server:get-autostart'),
    setAutostart: (enabled) => invoke('server:set-autostart', enabled),
  },
  users: {
    list: () => invoke('users:list'),
    save: (value) => invoke('users:save', value),
    remove: (username) => invoke('users:remove', username),
  },
  presets: {
    list: () => invoke('presets:list'),
    save: (value) => invoke('presets:save', value),
    remove: (name) => invoke('presets:remove', name),
  },
  devices: {
    list: () => invoke('devices:list'),
    create: (value) => invoke('devices:create', value),
    revoke: (deviceId) => invoke('devices:revoke', deviceId),
  },
  audit: { list: () => invoke('audit:list') },
  database: {
    backup: () => invoke('database:backup'),
    backupDirectory: () => invoke('database:backup-directory'),
    chooseBackupDirectory: () => invoke('database:choose-backup-directory'),
    exportData: () => invoke('database:export'),
    verify: () => invoke('database:verify'),
    openBackups: () => invoke('database:open-backups'),
  },
  reports: { exportPdf: (fileName, landscape) => invoke('reports:export-pdf', { fileName, landscape }) },
  ids: { next: (entity) => invoke('ids:next', entity) },
  dashboard: () => invoke('dashboard:get'),
  company: {
    get: () => invoke('company:get'),
    save: (value) => invoke('company:save', value),
    logo: () => invoke('company:logo'),
    pathForFile: (file) => webUtils.getPathForFile(file),
  },
  accounts: {
    list: () => invoke('accounts:list'),
    save: (value) => invoke('accounts:save', value),
    remove: (code) => invoke('accounts:remove', code),
  },
  items: {
    list: () => invoke('items:list'),
    save: (value) => invoke('items:save', value),
    createForChallan: (value) => invoke('items:create-for-challan', value),
    remove: (code) => invoke('items:remove', code),
  },
  banks: {
    list: () => invoke('banks:list'),
    save: (value) => invoke('banks:save', value),
    remove: (code) => invoke('banks:remove', code),
  },
  challans: {
    list: (type) => invoke('challans:list', type),
    post: (value) => invoke('challans:post', value),
    update: (value) => invoke('challans:update', value),
    remove: (number) => invoke('challans:remove', number),
  },
  cheques: {
    list: () => invoke('cheques:list'),
    save: (value) => invoke('cheques:save', value),
    remove: (number) => invoke('cheques:remove', number),
  },
  vouchers: {
    list: () => invoke('vouchers:list'),
    save: (value) => invoke('vouchers:save', value),
    remove: (number) => invoke('vouchers:remove', number),
  },
  stock: {
    locations: () => invoke('stock:locations'),
    quantity: (itemCode, location) => invoke('stock:quantity', { itemCode, location }),
    types: () => invoke('stock:types'),
    saveType: (value) => invoke('stock-types:save', value),
    removeType: (code) => invoke('stock-types:remove', code),
    movements: () => invoke('stock:movements'),
    openings: () => invoke('stock:openings'),
    addOpening: (value) => invoke('stock:opening:add', value),
    transfer: (value) => invoke('stock:transfer', value),
  },
  locations: {
    save: (name) => invoke('locations:save', name),
    remove: (name) => invoke('locations:remove', name),
  },
}))
