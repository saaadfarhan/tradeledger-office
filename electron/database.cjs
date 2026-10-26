const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const Database = require('better-sqlite3')
const PASSWORD_HASH_ITERATIONS = 600_000

function openOfficeDatabase(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  const db = new Database(filePath)
  db.pragma('foreign_keys = ON')
  db.pragma('journal_mode = WAL')
  initializeSchema(db)
  return createOfficeStore(db)
}

function initializeSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS company_profile (
      id INTEGER PRIMARY KEY CHECK (id = 1), name TEXT NOT NULL, address TEXT NOT NULL,
      phone TEXT NOT NULL, fiscal_year TEXT NOT NULL, logo_path TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS users (
      username TEXT PRIMARY KEY, password_hash TEXT NOT NULL, permissions TEXT NOT NULL,
      mac_address TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS authorized_devices (
      device_id TEXT PRIMARY KEY, username TEXT NOT NULL, name TEXT NOT NULL,
      certificate_fingerprint TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL, revoked_at TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS app_security (
      id INTEGER PRIMARY KEY CHECK (id = 1), admin_tools_password_hash TEXT NOT NULL DEFAULT ''
    );
    INSERT OR IGNORE INTO app_security(id, admin_tools_password_hash) VALUES (1, '');
    CREATE TABLE IF NOT EXISTS accounts (
      code TEXT PRIMARY KEY, description TEXT NOT NULL, parent_code TEXT,
      opening_balance NUMERIC NOT NULL DEFAULT 0, opening_balance_side TEXT NOT NULL DEFAULT 'DEBIT',
      account_type TEXT NOT NULL DEFAULT 'UNCLASSIFIED',
      FOREIGN KEY (parent_code) REFERENCES accounts(code)
    );
    CREATE TABLE IF NOT EXISTS items (
      code TEXT PRIMARY KEY, description TEXT NOT NULL, unit TEXT NOT NULL,
      sale_rate NUMERIC NOT NULL, purchase_rate NUMERIC NOT NULL, stock_type TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS stock_types (
      code TEXT PRIMARY KEY, description TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS locations (name TEXT PRIMARY KEY COLLATE NOCASE);
    INSERT OR IGNORE INTO stock_types(code, description) VALUES ('REG', 'Regular');
    INSERT OR IGNORE INTO stock_types(code, description) VALUES ('SER', 'Service');
    CREATE TABLE IF NOT EXISTS banks (
      code TEXT PRIMARY KEY, name TEXT NOT NULL, account_number TEXT,
      opening_balance NUMERIC NOT NULL DEFAULT 0, address TEXT, phone TEXT,
      ledger_account_code TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS cheques (
      number TEXT PRIMARY KEY, bank_code TEXT NOT NULL, cheque_date TEXT NOT NULL,
      party TEXT NOT NULL, amount NUMERIC NOT NULL, status TEXT NOT NULL, manual_id TEXT,
      direction TEXT NOT NULL DEFAULT '', bank_account_code TEXT NOT NULL DEFAULT '', cleared_date TEXT NOT NULL DEFAULT '',
      FOREIGN KEY (bank_code) REFERENCES banks(code)
    );
    CREATE TABLE IF NOT EXISTS cheque_status_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT, cheque_number TEXT NOT NULL,
      status TEXT NOT NULL, changed_at TEXT NOT NULL,
      FOREIGN KEY (cheque_number) REFERENCES cheques(number)
    );
    CREATE TABLE IF NOT EXISTS audit_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT, event_time TEXT NOT NULL,
      username TEXT NOT NULL, action TEXT NOT NULL, details TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS challans (
      number TEXT PRIMARY KEY, type TEXT NOT NULL, date TEXT NOT NULL, party TEXT NOT NULL,
      location TEXT NOT NULL, total NUMERIC NOT NULL
    );
    CREATE TABLE IF NOT EXISTS challan_lines (
      challan_number TEXT NOT NULL, line_number INTEGER NOT NULL, item_code TEXT, item_label TEXT,
      quantity NUMERIC NOT NULL, rate NUMERIC NOT NULL, amount NUMERIC NOT NULL,
      PRIMARY KEY (challan_number, line_number),
      CHECK (item_code IS NOT NULL OR item_label IS NOT NULL),
      FOREIGN KEY (challan_number) REFERENCES challans(number),
      FOREIGN KEY (item_code) REFERENCES items(code)
    );
    CREATE TABLE IF NOT EXISTS vouchers (
      number TEXT PRIMARY KEY, date TEXT NOT NULL, narration TEXT, reference TEXT,
      voucher_type TEXT NOT NULL DEFAULT 'VOUCHER'
    );
    CREATE TABLE IF NOT EXISTS voucher_lines (
      voucher_number TEXT NOT NULL, line_number INTEGER NOT NULL, account_code TEXT NOT NULL,
      debit NUMERIC NOT NULL, credit NUMERIC NOT NULL,
      PRIMARY KEY (voucher_number, line_number),
      FOREIGN KEY (voucher_number) REFERENCES vouchers(number),
      FOREIGN KEY (account_code) REFERENCES accounts(code)
    );
    CREATE TABLE IF NOT EXISTS stock_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL, document TEXT NOT NULL,
      type TEXT NOT NULL, item_code TEXT NOT NULL, location TEXT NOT NULL,
      quantity NUMERIC NOT NULL, rate NUMERIC NOT NULL, amount NUMERIC NOT NULL,
      FOREIGN KEY (item_code) REFERENCES items(code)
    );
    CREATE TABLE IF NOT EXISTS stock_transfers (
      transfer_id TEXT PRIMARY KEY, transfer_date TEXT NOT NULL, item_code TEXT NOT NULL,
      from_location TEXT NOT NULL, to_location TEXT NOT NULL, quantity NUMERIC NOT NULL,
      FOREIGN KEY (item_code) REFERENCES items(code)
    );
    CREATE TABLE IF NOT EXISTS sync_operations (
      operation_id TEXT PRIMARY KEY, origin_device TEXT NOT NULL, sequence_number INTEGER NOT NULL,
      entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, operation_type TEXT NOT NULL,
      payload TEXT NOT NULL, created_at TEXT NOT NULL, content_hash TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sync_conflicts (
      conflict_id TEXT PRIMARY KEY, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL,
      local_operation_id TEXT NOT NULL, remote_operation_id TEXT NOT NULL, status TEXT NOT NULL,
      local_payload TEXT NOT NULL, remote_payload TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS id_sequences (entity TEXT PRIMARY KEY, last_number INTEGER NOT NULL);
  `)

  const columns = db.prepare('PRAGMA table_info(cheques)').all().map((column) => column.name)
  if (!columns.includes('manual_id')) db.exec('ALTER TABLE cheques ADD COLUMN manual_id TEXT')
  if (!columns.includes('direction')) db.exec("ALTER TABLE cheques ADD COLUMN direction TEXT NOT NULL DEFAULT ''")
  if (!columns.includes('bank_account_code')) db.exec("ALTER TABLE cheques ADD COLUMN bank_account_code TEXT NOT NULL DEFAULT ''")
  if (!columns.includes('cleared_date')) db.exec("ALTER TABLE cheques ADD COLUMN cleared_date TEXT NOT NULL DEFAULT ''")
  const userColumns = db.prepare('PRAGMA table_info(users)').all().map((column) => column.name)
  if (!userColumns.includes('mac_address')) db.exec("ALTER TABLE users ADD COLUMN mac_address TEXT NOT NULL DEFAULT ''")
  const bankColumns = db.prepare('PRAGMA table_info(banks)').all().map((column) => column.name)
  if (!bankColumns.includes('ledger_account_code')) db.exec("ALTER TABLE banks ADD COLUMN ledger_account_code TEXT NOT NULL DEFAULT ''")
  const voucherColumns = db.prepare('PRAGMA table_info(vouchers)').all().map((column) => column.name)
  if (!voucherColumns.includes('voucher_type')) db.exec("ALTER TABLE vouchers ADD COLUMN voucher_type TEXT NOT NULL DEFAULT 'VOUCHER'")
  const accountColumns = db.prepare('PRAGMA table_info(accounts)').all().map((column) => column.name)
  if (!accountColumns.includes('opening_balance_side')) db.exec("ALTER TABLE accounts ADD COLUMN opening_balance_side TEXT NOT NULL DEFAULT 'DEBIT'")
  if (!accountColumns.includes('account_type')) db.exec("ALTER TABLE accounts ADD COLUMN account_type TEXT NOT NULL DEFAULT 'UNCLASSIFIED'")
  const challanLineColumns = db.prepare('PRAGMA table_info(challan_lines)').all().map((column) => column.name)
  if (!challanLineColumns.includes('item_label')) {
    db.pragma('foreign_keys = OFF')
    db.transaction(() => {
      db.exec('ALTER TABLE challan_lines RENAME TO challan_lines_legacy')
      db.exec(`CREATE TABLE challan_lines (
        challan_number TEXT NOT NULL, line_number INTEGER NOT NULL, item_code TEXT, item_label TEXT,
        quantity NUMERIC NOT NULL, rate NUMERIC NOT NULL, amount NUMERIC NOT NULL,
        PRIMARY KEY (challan_number, line_number), CHECK (item_code IS NOT NULL OR item_label IS NOT NULL),
        FOREIGN KEY (challan_number) REFERENCES challans(number), FOREIGN KEY (item_code) REFERENCES items(code)
      )`)
      db.exec('INSERT INTO challan_lines(challan_number, line_number, item_code, quantity, rate, amount) SELECT challan_number, line_number, item_code, quantity, rate, amount FROM challan_lines_legacy')
      db.exec('DROP TABLE challan_lines_legacy')
    })()
    db.pragma('foreign_keys = ON')
  }
  db.exec(`INSERT OR IGNORE INTO locations(name) SELECT DISTINCT trim(location) FROM stock_movements WHERE trim(location)<>'';
    INSERT OR IGNORE INTO locations(name) SELECT DISTINCT trim(location) FROM challans WHERE trim(location)<>'';
    INSERT OR IGNORE INTO locations(name) SELECT DISTINCT trim(from_location) FROM stock_transfers WHERE trim(from_location)<>'';
    INSERT OR IGNORE INTO locations(name) SELECT DISTINCT trim(to_location) FROM stock_transfers WHERE trim(to_location)<>'';`)
}

function createOfficeStore(db) {
  const findAccount = db.prepare(`SELECT code, description, parent_code AS parentCode,
    opening_balance AS openingBalance, opening_balance_side AS openingBalanceSide,
    account_type AS accountType FROM accounts WHERE code = ?`)
  const audit = db.prepare('INSERT INTO audit_events(event_time, username, action, details) VALUES (?, ?, ?, ?)')
  const now = () => new Date().toISOString()
  let currentUser = 'system'
  const recordAudit = (action, details) => audit.run(now(), currentUser, action, details)
  const knownLocation = (value, label = 'Location') => {
    const name = required(value, label)
    if (!db.prepare('SELECT 1 FROM locations WHERE name=?').get(name)) throw new Error(`Select a saved location from Locations: ${name}`)
    return name
  }

  function mergeConcurrentFields(current, baseline, proposed, fields, entity) {
    if (!current) throw new Error(`This ${entity} was deleted by another user. Refresh the list before saving.`)
    if (!baseline) return proposed
    const merged = { ...proposed }
    const conflicts = []
    for (const [key, kind = 'text'] of fields) {
      const normalize = (value) => kind === 'number' ? Number(value ?? 0)
        : kind === 'nullable' ? (value || null)
        : kind === 'lines' ? JSON.stringify((value || []).map((line) => [line.itemCode || line.accountCode || line.itemLabel || '', Number(line.quantity ?? line.debit ?? 0), Number(line.credit ?? 0), line.itemCode ? 0 : Number(line.rate ?? 0)]))
            : (value ?? '')
      const same = (left, right) => normalize(left) === normalize(right)
      const original = baseline[key]
      const latest = current[key]
      const submitted = proposed[key]
      const changedHere = !same(submitted, original)
      const changedThere = !same(latest, original)
      if (changedHere && changedThere && !same(submitted, latest)) conflicts.push(key)
      else if (!changedHere && changedThere) merged[key] = latest
    }
    if (conflicts.length) {
      throw new Error(`This ${entity} has newer changes from another user (${conflicts.join(', ')}). Reopen it and apply your changes again.`)
    }
    return merged
  }

  function listUsers() {
    return db.prepare('SELECT username, permissions, mac_address AS macAddress FROM users ORDER BY username').all().map((row) => ({
      username: row.username,
      macAddress: row.macAddress,
      permissions: normalizePermissions(row.permissions ? row.permissions.split('\u001f').filter(Boolean) : []),
    }))
  }

  function getUserSession(username) {
    const user = db.prepare('SELECT username, permissions FROM users WHERE username=?').get(String(username || '').trim())
    if (!user) return null
    return {
      username: user.username,
      permissions: normalizePermissions(user.permissions ? user.permissions.split('\u001f').filter(Boolean) : []),
    }
  }

  function requireAdministrator() {
    const actor = listUsers().find((user) => user.username === currentUser)
    if (!actor?.permissions.includes('User Rights')) throw new Error('Only an administrator can manage user accounts')
  }

  function saveUser(input) {
    requireAdministrator()
    const username = required(input.username, 'User name')
    if (username.length > 80) throw new Error('User name must be 80 characters or fewer')
    const macAddress = normalizeMacAddress(input.macAddress)
    const existing = db.prepare('SELECT password_hash FROM users WHERE username=?').get(username)
    const password = String(input.password || '')
    if (!existing && password.length < 8) throw new Error('New user passwords must be at least 8 characters')
    if (password && password.length < 8) throw new Error('Passwords must be at least 8 characters')
    const permissions = normalizePermissions((input.permissions || []).map(String))
    if (permissions.length <= 2) throw new Error('Select at least one page permission')
    if (existing && listUsers().find((user) => user.username === username)?.permissions.includes('User Rights') && !permissions.includes('User Rights')) {
      const anotherManager = db.prepare("SELECT 1 FROM users WHERE username<>? AND instr(permissions, 'User Rights') > 0 LIMIT 1").get(username)
      if (!anotherManager) throw new Error('At least one user must retain User Rights access')
    }
    const hash = password ? hashPassword(password) : existing?.password_hash
    db.prepare('INSERT INTO users(username, password_hash, permissions, mac_address) VALUES (?, ?, ?, ?) ON CONFLICT(username) DO UPDATE SET password_hash=excluded.password_hash, permissions=excluded.permissions, mac_address=excluded.mac_address')
      .run(username, hash, permissions.join('\u001f'), macAddress)
    recordAudit(existing ? 'USER_UPDATE' : 'USER_SAVE', username)
    return listUsers().find((user) => user.username === username)
  }

  function deleteUser(username) {
    if (username === currentUser) throw new Error('You cannot delete the signed-in user')
    requireAdministrator()
    const userCount = db.prepare('SELECT COUNT(*) AS count FROM users').get().count
    if (userCount <= 1) throw new Error('The last user account cannot be deleted')
    const target = listUsers().find((user) => user.username === username)
    if (target?.permissions.includes('User Rights')) {
      const anotherManager = db.prepare("SELECT 1 FROM users WHERE username<>? AND instr(permissions, 'User Rights') > 0 LIMIT 1").get(username)
      if (!anotherManager) throw new Error('At least one user must retain User Rights access')
    }
    const result = db.prepare('DELETE FROM users WHERE username=?').run(username)
    if (!result.changes) throw new Error('User does not exist')
    recordAudit('USER_DELETE', username)
    db.prepare("UPDATE authorized_devices SET revoked_at=? WHERE username=? AND revoked_at=''").run(now(), username)
  }

  function listDevices() {
    return db.prepare('SELECT device_id AS deviceId, username, name, certificate_fingerprint AS fingerprint, created_at AS createdAt, revoked_at AS revokedAt FROM authorized_devices ORDER BY created_at DESC').all()
  }

  function registerDevice(input) {
    requireAdministrator()
    const username = required(input.username, 'User name')
    if (!db.prepare('SELECT 1 FROM users WHERE username=?').get(username)) throw new Error('Select a saved user for this device')
    const deviceId = required(input.deviceId, 'Device ID')
    const fingerprint = required(input.fingerprint, 'Device certificate fingerprint')
    const name = required(input.name, 'Device name')
    db.prepare('INSERT INTO authorized_devices(device_id, username, name, certificate_fingerprint, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(deviceId, username, name, fingerprint, now())
    recordAudit('DEVICE_ENROLL', `${name} · ${username}`)
    return listDevices().find((device) => device.deviceId === deviceId)
  }

  function getActiveDevice(fingerprint) {
    return db.prepare("SELECT device_id AS deviceId, username, name, certificate_fingerprint AS fingerprint FROM authorized_devices WHERE certificate_fingerprint=? AND revoked_at=''").get(String(fingerprint || '')) || null
  }

  function revokeDevice(deviceId) {
    requireAdministrator()
    const device = db.prepare("SELECT name, username FROM authorized_devices WHERE device_id=? AND revoked_at=''").get(String(deviceId || ''))
    if (!device) throw new Error('Device is already revoked or does not exist')
    db.prepare('UPDATE authorized_devices SET revoked_at=? WHERE device_id=?').run(now(), deviceId)
    recordAudit('DEVICE_REVOKE', `${device.name} · ${device.username}`)
  }

  function authenticate(username, password, macAddress = '') {
    const user = db.prepare('SELECT username, password_hash, permissions, mac_address AS macAddress FROM users WHERE username=?').get(String(username).trim())
    if (!user || !verifyPassword(String(password), user.password_hash)) throw new Error('User name or password is incorrect')
    if (user.macAddress && normalizeMacAddress(macAddress) !== user.macAddress) {
      throw new Error('This account can only sign in from its registered MAC address on the office LAN')
    }
    if (passwordNeedsRehash(user.password_hash)) {
      db.prepare('UPDATE users SET password_hash=? WHERE username=?').run(hashPassword(String(password)), user.username)
    }
    currentUser = user.username
    recordAudit('LOGIN', user.username)
    return { username: user.username, permissions: normalizePermissions(user.permissions ? user.permissions.split('\u001f').filter(Boolean) : []) }
  }

  function createFirstUser(input) {
    if (db.prepare('SELECT 1 FROM users LIMIT 1').get()) throw new Error('A user account already exists')
    const username = required(input.username, 'User name')
    const password = String(input.password || '')
    if (password.length < 8) throw new Error('Password must be at least 8 characters')
    const permissions = ['Overview', 'Company Profile', 'Chart of Accounts', 'Items', 'Banks', 'Stock Types', 'Locations', 'Item Opening Balances', 'Transfer', 'Cheque Detail', 'Purchase Challans', 'Sale Challans', 'Voucher', 'Journal Voucher', 'Search Payment', 'Payment / Receipt', 'Reports', 'User Rights', 'Audit Log', 'Database Tools', 'Manual']
    db.prepare('INSERT INTO users(username, password_hash, permissions) VALUES (?, ?, ?)').run(username, hashPassword(password), permissions.join('\u001f'))
    currentUser = username
    recordAudit('INITIAL_ADMIN_CREATED', username)
    return { username, permissions: normalizePermissions(permissions) }
  }

  function setCurrentUser(username, recordLogout = true) {
    currentUser = username || 'system'
    if (username && recordLogout) recordAudit('LOGOUT', username)
  }

  function setAuditActor(username) {
    currentUser = username || 'system'
  }

  function auditEvents() {
    return db.prepare('SELECT event_time AS eventTime, username, action, details FROM audit_events ORDER BY id DESC LIMIT 1000').all()
  }

  async function backupTo(target) {
    fs.mkdirSync(path.dirname(target), { recursive: true })
    await db.backup(target)
    recordAudit('DATABASE_BACKUP', path.basename(target))
    return { fileName: path.basename(target), bytes: fs.statSync(target).size }
  }

  function exportData() {
    recordAudit('DATABASE_EXPORT', 'Business data JSON export')
    const tables = ['company_profile', 'accounts', 'items', 'stock_types', 'locations', 'banks', 'cheques', 'cheque_status_history', 'challans', 'challan_lines', 'vouchers', 'voucher_lines', 'stock_movements', 'stock_transfers', 'audit_events']
    const data = Object.fromEntries(tables.map((table) => [table, db.prepare(`SELECT * FROM ${table}`).all()]))
    return { format: 'purchase-sale-office-data', version: 1, exportedAt: now(), data }
  }

  function verifyDatabase() {
    const integrity = db.pragma('integrity_check').map((row) => row.integrity_check)
    const foreignKeyViolations = db.pragma('foreign_key_check')
    const tableNames = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map((row) => row.name)
    const tableCounts = Object.fromEntries(tableNames.map((table) => [table, db.prepare(`SELECT COUNT(*) AS count FROM "${table}"`).get().count]))
    const result = { ok: integrity.length === 1 && integrity[0] === 'ok' && foreignKeyViolations.length === 0, integrity, foreignKeyViolations, tableCounts, checkedAt: now() }
    recordAudit('DATABASE_VERIFY', result.ok ? 'Integrity and foreign keys passed' : 'Integrity or foreign-key errors found')
    return result
  }

  function getCompanyProfile() {
    return db.prepare('SELECT name, address, phone, fiscal_year AS fiscalYear, logo_path AS logoPath FROM company_profile WHERE id=1').get()
      || { name: '', address: '', phone: '', fiscalYear: '', logoPath: '' }
  }

  function hasCompanyProfile() {
    return Boolean(db.prepare("SELECT 1 FROM company_profile WHERE id=1 AND trim(name)<>''").get())
  }

  function hasAdminToolsPassword() {
    return Boolean(db.prepare('SELECT 1 FROM app_security WHERE id=1 AND admin_tools_password_hash<>\'\'').get())
  }

  function configureAdminToolsPassword(input) {
    requireAdministrator()
    const stored = db.prepare('SELECT admin_tools_password_hash AS hash FROM app_security WHERE id=1').get()?.hash || ''
    const currentPassword = String(input.currentPassword || '')
    const newPassword = String(input.newPassword || '')
    if (stored && !verifyPassword(currentPassword, stored)) throw new Error('Current admin-tools password is incorrect')
    if (newPassword.length < 12) throw new Error('Admin-tools password must be at least 12 characters')
    if (db.prepare('SELECT password_hash FROM users').all().some((user) => verifyPassword(newPassword, user.password_hash))) throw new Error('Choose an admin-tools password that is different from every user sign-in password')
    db.prepare('UPDATE app_security SET admin_tools_password_hash=? WHERE id=1').run(hashPassword(newPassword))
    recordAudit(stored ? 'ADMIN_TOOLS_PASSWORD_UPDATE' : 'ADMIN_TOOLS_PASSWORD_SET', 'Admin-only pages')
  }

  function verifyAdminToolsPassword(password) {
    const stored = db.prepare('SELECT admin_tools_password_hash FROM app_security WHERE id=1').get()?.admin_tools_password_hash || ''
    const input = String(password || '')
    const valid = Boolean(stored && verifyPassword(input, stored))
    if (valid && passwordNeedsRehash(stored)) db.prepare('UPDATE app_security SET admin_tools_password_hash=? WHERE id=1').run(hashPassword(input))
    return valid
  }

  function saveCompanyProfile(input) {
    const isUpdate = hasCompanyProfile()
    const profile = {
      name: required(input.name, 'Company name'), address: String(input.address || '').trim(),
      phone: String(input.phone || '').trim(), fiscalYear: String(input.fiscalYear || '').trim(),
      logoPath: String(input.logoPath || '').trim(),
    }
    db.prepare(`INSERT INTO company_profile(id, name, address, phone, fiscal_year, logo_path)
      VALUES (1, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,
      address=excluded.address, phone=excluded.phone, fiscal_year=excluded.fiscal_year,
      logo_path=excluded.logo_path`).run(profile.name, profile.address, profile.phone, profile.fiscalYear, profile.logoPath)
    recordAudit(isUpdate ? 'COMPANY_PROFILE_UPDATE' : 'COMPANY_PROFILE_SAVE', profile.name)
    return profile
  }

  const idDefinitions = {
    account: { table: 'accounts', column: 'code', prefix: 'ACC' },
    item: { table: 'items', column: 'code', prefix: 'ITM' },
    bank: { table: 'banks', column: 'code', prefix: 'BNK' },
    purchaseChallan: { table: 'challans', column: 'number', prefix: 'PUR', type: 'PURCHASE' },
    saleChallan: { table: 'challans', column: 'number', prefix: 'SAL', type: 'SALE' },
    cheque: { table: 'cheques', column: 'number', prefix: 'CHQ' },
    transfer: { table: 'stock_transfers', column: 'transfer_id', prefix: 'TRF' },
    voucher: { table: 'vouchers', column: 'number', prefix: 'VCH' },
  }
  function allocateOfficeId(entity) {
    const definition = idDefinitions[entity]
    if (!definition) throw new Error('Unknown ID type')
    const existing = db.prepare(`SELECT ${definition.column} AS value FROM ${definition.table} WHERE ${definition.column} LIKE ?`).all(`${definition.prefix}-%`)
    const maxExisting = existing.reduce((max, row) => {
      const match = String(row.value).match(new RegExp(`^${definition.prefix}-(\\d+)$`))
      return match ? Math.max(max, Number(match[1])) : max
    }, 0)
    const stored = db.prepare('SELECT last_number FROM id_sequences WHERE entity=?').get(entity)?.last_number ?? 0
    const next = Math.max(maxExisting, stored) + 1
    db.prepare('INSERT INTO id_sequences(entity, last_number) VALUES (?, ?) ON CONFLICT(entity) DO UPDATE SET last_number=excluded.last_number').run(entity, next)
    return `${definition.prefix}-${String(next).padStart(5, '0')}`
  }
  const nextOfficeId = db.transaction(allocateOfficeId)

  function listAccounts() {
    return db.prepare(`SELECT code, description, parent_code AS parentCode,
      opening_balance AS openingBalance, opening_balance_side AS openingBalanceSide,
      account_type AS accountType FROM accounts ORDER BY code`).all()
  }

  function saveAccount(input) {
    const code = required(input.code, 'Account code')
    const exists = findAccount.get(code)
    const proposed = {
      description: required(input.description, 'Description'),
      parentCode: input.parentCode ? String(input.parentCode).trim() : null,
      openingBalance: nonNegative(input.openingBalance ?? 0, 'Opening balance'),
      openingBalanceSide: String(input.openingBalanceSide || 'DEBIT').toUpperCase(),
      accountType: String(input.accountType || 'UNCLASSIFIED').toUpperCase(),
    }
    const merged = input.__baseline
      ? mergeConcurrentFields(exists, input.__baseline, proposed, [['description'], ['parentCode', 'nullable'], ['openingBalance', 'number'], ['openingBalanceSide'], ['accountType']], 'account')
      : proposed
    const description = required(merged.description, 'Description')
    const parentCode = merged.parentCode ? String(merged.parentCode).trim() : null
    if (!['DEBIT', 'CREDIT'].includes(merged.openingBalanceSide)) throw new Error('Opening balance side must be debit or credit')
    if (!['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE', 'UNCLASSIFIED'].includes(merged.accountType)) throw new Error('Account type is not supported')
    if (parentCode === code) throw new Error('An account cannot be its own parent')
    if (parentCode && !findAccount.get(parentCode)) throw new Error('Parent account does not exist')
    let ancestorCode = parentCode
    while (ancestorCode) {
      if (ancestorCode === code) throw new Error('An account cannot be placed beneath one of its descendants')
      ancestorCode = findAccount.get(ancestorCode)?.parentCode || null
    }
    const balance = nonNegative(merged.openingBalance, 'Opening balance')
    if (exists) {
      db.prepare('UPDATE accounts SET description = ?, parent_code = ?, opening_balance = ?, opening_balance_side = ?, account_type = ? WHERE code = ?').run(description, parentCode, balance, merged.openingBalanceSide, merged.accountType, code)
      recordAudit('ACCOUNT_UPDATE', code)
    } else {
      db.prepare('INSERT INTO accounts(code, description, parent_code, opening_balance, opening_balance_side, account_type) VALUES (?, ?, ?, ?, ?, ?)').run(code, description, parentCode, balance, merged.openingBalanceSide, merged.accountType)
      recordAudit('ACCOUNT_SAVE', code)
    }
    return findAccount.get(code)
  }

  function deleteAccount(code) {
    const child = db.prepare('SELECT 1 FROM accounts WHERE parent_code = ? LIMIT 1').get(code)
    if (child) throw new Error('Delete child accounts first')
    if (db.prepare('SELECT 1 FROM cheques WHERE party=? OR bank_account_code=? UNION ALL SELECT 1 FROM banks WHERE ledger_account_code=? LIMIT 1').get(code, code, code)) {
      throw new Error('This account is assigned to a cheque or bank and cannot be deleted')
    }
    const result = db.prepare('DELETE FROM accounts WHERE code = ?').run(code)
    if (!result.changes) throw new Error('Account does not exist')
    recordAudit('ACCOUNT_DELETE', code)
  }

  function listItems() {
    return db.prepare(`SELECT i.code, i.description, i.unit, i.sale_rate AS saleRate,
      i.purchase_rate AS purchaseRate, i.stock_type AS stockType,
      COALESCE((SELECT SUM(m.quantity) FROM stock_movements m WHERE m.item_code=i.code), 0) AS stockQuantity
      FROM items i ORDER BY i.code`).all()
  }

  function saveItem(input) {
    return db.transaction(() => {
      const item = {
        code: required(input.code, 'Item code'), description: required(input.description, 'Description'),
        unit: String(input.unit || 'Unit').trim(), saleRate: nonNegative(input.saleRate, 'Sale rate'),
        purchaseRate: nonNegative(input.purchaseRate, 'Purchase rate'), stockType: required(input.stockType, 'Stock type'),
      }
      if (!item.unit) item.unit = 'Unit'
      if (!db.prepare('SELECT 1 FROM stock_types WHERE code = ?').get(item.stockType)) throw new Error('Selected stock type does not exist')
      const quantityToAdd = input.quantityToAdd == null || input.quantityToAdd === '' ? 0 : nonNegative(input.quantityToAdd, 'Quantity to add')
      const location = quantityToAdd > 0 ? knownLocation(input.location) : ''
      const exists = db.prepare('SELECT code, description, unit, sale_rate AS saleRate, purchase_rate AS purchaseRate, stock_type AS stockType FROM items WHERE code = ?').get(item.code)
      const merged = input.__baseline
        ? mergeConcurrentFields(exists, input.__baseline, item, [['description'], ['unit'], ['saleRate', 'number'], ['purchaseRate', 'number'], ['stockType']], 'item')
        : item
      if (exists) {
        db.prepare('UPDATE items SET description=?, unit=?, sale_rate=?, purchase_rate=?, stock_type=? WHERE code=?')
          .run(merged.description, merged.unit, merged.saleRate, merged.purchaseRate, merged.stockType, item.code)
        recordAudit('ITEM_UPDATE', item.code)
      } else {
        db.prepare('INSERT INTO items(code, description, unit, sale_rate, purchase_rate, stock_type) VALUES (?, ?, ?, ?, ?, ?)')
          .run(item.code, item.description, item.unit, item.saleRate, item.purchaseRate, item.stockType)
        recordAudit('ITEM_SAVE', item.code)
      }
      if (quantityToAdd > 0) {
        const amount = quantityToAdd * merged.purchaseRate
        db.prepare(`INSERT INTO stock_movements(date, document, type, item_code, location, quantity, rate, amount)
          VALUES (?, 'OPENING', 'OPENING', ?, ?, ?, ?, ?)`).run(new Date().toISOString().slice(0, 10), item.code, location, quantityToAdd, merged.purchaseRate, amount)
        recordAudit('OPENING_BALANCE_SAVE', `${item.code} · ${location} · ${quantityToAdd}`)
      }
      return listItems().find((row) => row.code === item.code)
    })()
  }

  function createItemFromChallan(input) {
    const code = input.code ? required(input.code, 'Item code') : nextOfficeId('item')
    if (db.prepare('SELECT 1 FROM items WHERE code=?').get(code)) throw new Error(`Item code already exists: ${code}`)
    return saveItem({ ...input, code, quantityToAdd: 0 })
  }

  function deleteItem(code) {
    const result = db.prepare('DELETE FROM items WHERE code = ?').run(code)
    if (!result.changes) throw new Error('Item does not exist')
    recordAudit('ITEM_DELETE', code)
  }

  function listBanks() {
    return db.prepare('SELECT code, name, account_number AS accountNumber, opening_balance AS openingBalance, address, phone, ledger_account_code AS ledgerAccountCode FROM banks ORDER BY code').all()
  }

  function saveBank(input) {
    const bank = {
      code: required(input.code, 'Bank code'), name: required(input.name, 'Bank name'),
      accountNumber: String(input.accountNumber || ''), openingBalance: nonNegative(input.openingBalance ?? 0, 'Opening balance'),
      address: String(input.address || ''), phone: String(input.phone || ''), ledgerAccountCode: String(input.ledgerAccountCode || '').trim(),
    }
    const exists = db.prepare('SELECT code, name, account_number AS accountNumber, opening_balance AS openingBalance, address, phone, ledger_account_code AS ledgerAccountCode FROM banks WHERE code = ?').get(bank.code)
    const merged = input.__baseline
      ? mergeConcurrentFields(exists, input.__baseline, bank, [['name'], ['accountNumber'], ['openingBalance', 'number'], ['address'], ['phone'], ['ledgerAccountCode']], 'bank')
      : bank
    if (merged.ledgerAccountCode && !findAccount.get(merged.ledgerAccountCode)) throw new Error('Selected bank ledger account does not exist')
    const sql = exists
      ? 'UPDATE banks SET name=?, account_number=?, opening_balance=?, address=?, phone=?, ledger_account_code=? WHERE code=?'
      : 'INSERT INTO banks(code, name, account_number, opening_balance, address, phone, ledger_account_code) VALUES (?, ?, ?, ?, ?, ?, ?)'
    db.prepare(sql).run(...(exists
      ? [merged.name, merged.accountNumber, merged.openingBalance, merged.address, merged.phone, merged.ledgerAccountCode, bank.code]
      : [bank.code, merged.name, merged.accountNumber, merged.openingBalance, merged.address, merged.phone, merged.ledgerAccountCode]))
    recordAudit(exists ? 'BANK_UPDATE' : 'BANK_SAVE', bank.code)
    return bank
  }

  function deleteBank(code) {
    const result = db.prepare('DELETE FROM banks WHERE code = ?').run(code)
    if (!result.changes) throw new Error('Bank does not exist')
    recordAudit('BANK_DELETE', code)
  }

  function getDashboard(userPermissions) {
    const permissions = new Set(userPermissions || ['Chart of Accounts', 'Items', 'Banks', 'Purchase Challans', 'Sale Challans', 'Reports', 'Transfer', 'Item Opening Balances'])
    const canSeeAccounts = ['Chart of Accounts', 'Purchase Challans', 'Sale Challans', 'Voucher', 'Journal Voucher', 'Payment / Receipt', 'Search Payment', 'Reports'].some((permission) => permissions.has(permission))
    const canSeeItems = ['Items', 'Purchase Challans', 'Sale Challans', 'Reports'].some((permission) => permissions.has(permission))
    const canSeeBanks = ['Banks', 'Cheque Detail', 'Reports'].some((permission) => permissions.has(permission))
    const canSeePurchases = permissions.has('Purchase Challans') || permissions.has('Reports')
    const canSeeSales = permissions.has('Sale Challans') || permissions.has('Reports')
    const canSeeStock = ['Items', 'Purchase Challans', 'Sale Challans', 'Reports', 'Transfer', 'Item Opening Balances'].some((permission) => permissions.has(permission))
    const today = new Date().toISOString().slice(0, 10)
    const counts = {
      accounts: canSeeAccounts ? db.prepare('SELECT COUNT(*) AS count FROM accounts').get().count : null,
      items: canSeeItems ? db.prepare('SELECT COUNT(*) AS count FROM items').get().count : null,
      banks: canSeeBanks ? db.prepare('SELECT COUNT(*) AS count FROM banks').get().count : null,
      purchasesToday: canSeePurchases ? db.prepare("SELECT COALESCE(SUM(total), 0) AS total FROM challans WHERE type='PURCHASE' AND date=?").get(today).total : null,
      salesToday: canSeeSales ? db.prepare("SELECT COALESCE(SUM(total), 0) AS total FROM challans WHERE type='SALE' AND date=?").get(today).total : null,
    }
    const recent = canSeePurchases || canSeeSales
      ? db.prepare(`SELECT number, type, date, party, total FROM challans WHERE type IN (${[canSeePurchases && 'PURCHASE', canSeeSales && 'SALE'].filter(Boolean).map(() => '?').join(',')}) ORDER BY date DESC, number DESC LIMIT 8`).all(...[canSeePurchases && 'PURCHASE', canSeeSales && 'SALE'].filter(Boolean))
      : []
    const stock = canSeeStock ? db.prepare(`SELECT COALESCE(SUM(balance), 0) AS quantity FROM (
      SELECT SUM(quantity) AS balance FROM stock_movements GROUP BY item_code, location HAVING SUM(quantity) > 0
    )`).get().quantity : null
    return { today, counts, recent, canSeeRecent: canSeePurchases || canSeeSales, stockQuantity: stock }
  }

  function listChallans(type) {
    const documents = type
      ? db.prepare('SELECT number, type, date, party, location, total FROM challans WHERE type=? ORDER BY date DESC, number DESC').all(type)
      : db.prepare('SELECT number, type, date, party, location, total FROM challans ORDER BY date DESC, number DESC').all()
    const getLines = db.prepare('SELECT line_number AS lineNumber, item_code AS itemCode, item_label AS itemLabel, quantity, rate, amount FROM challan_lines WHERE challan_number=? ORDER BY line_number')
    return documents.map((document) => ({ ...document, lines: getLines.all(document.number).map((line) => ({ ...line, itemCode: line.itemCode ?? '' })) }))
  }

  function getStock(itemCode, location) {
    return db.prepare('SELECT COALESCE(SUM(quantity), 0) AS quantity FROM stock_movements WHERE item_code=? AND location=?').get(itemCode, location).quantity
  }

  function listLocations() {
    return db.prepare('SELECT name FROM locations ORDER BY name COLLATE NOCASE').all().map((row) => row.name)
  }

  function saveLocation(input) {
    const name = required(typeof input === 'string' ? input : input?.name, 'Location name').replace(/\s+/g, ' ')
    if (name.length > 100) throw new Error('Location name must be 100 characters or fewer')
    if (db.prepare('SELECT 1 FROM locations WHERE name=?').get(name)) throw new Error(`Location already exists: ${name}`)
    db.prepare('INSERT INTO locations(name) VALUES (?)').run(name)
    recordAudit('LOCATION_CREATE', name)
    return name
  }

  function deleteLocation(input) {
    const name = required(input, 'Location name')
    const normalized = name.toLocaleLowerCase()
    const used = db.prepare(`SELECT 1 FROM stock_movements WHERE lower(trim(location))=? UNION ALL SELECT 1 FROM challans WHERE lower(trim(location))=? UNION ALL SELECT 1 FROM stock_transfers WHERE lower(trim(from_location))=? OR lower(trim(to_location))=? LIMIT 1`).get(normalized, normalized, normalized, normalized)
    if (used) throw new Error('This location has recorded stock or challan activity and cannot be deleted')
    const result = db.prepare('DELETE FROM locations WHERE name=?').run(name)
    if (!result.changes) throw new Error('Location does not exist')
    recordAudit('LOCATION_DELETE', name)
  }

  function listStockMovements() {
    return db.prepare(`SELECT id, date, document, type, item_code AS itemCode, location,
      quantity, rate, amount FROM stock_movements ORDER BY date DESC, id DESC`).all()
  }

  function listOpeningBalances() {
    return db.prepare(`SELECT m.id, m.date, m.document, m.item_code AS itemCode,
      i.description AS itemDescription, m.location, m.quantity, m.rate, m.amount
      FROM stock_movements m LEFT JOIN items i ON i.code=m.item_code
      WHERE m.type='OPENING' ORDER BY m.id DESC`).all()
  }

  const addOpeningBalanceTransaction = db.transaction((input) => {
    const itemCode = required(input.itemCode, 'Item code')
    const item = db.prepare('SELECT purchase_rate AS rate FROM items WHERE code=?').get(itemCode)
    if (!item) throw new Error(`Unknown item: ${itemCode}`)
    const location = knownLocation(input.location)
    const quantity = positive(input.quantity, 'Opening quantity')
    const rate = nonNegative(item.rate, 'Purchase rate')
    const amount = quantity * rate
    db.prepare(`INSERT INTO stock_movements(date, document, type, item_code, location, quantity, rate, amount)
      VALUES (?, 'OPENING', 'OPENING', ?, ?, ?, ?, ?)`).run(new Date().toISOString().slice(0, 10), itemCode, location, quantity, rate, amount)
    recordAudit('OPENING_BALANCE_SAVE', `${itemCode} · ${location} · ${quantity}`)
    return { itemCode, location, quantity, rate, amount }
  })

  const transferStockTransaction = db.transaction((input) => {
    const itemCode = required(input.itemCode, 'Item code')
    if (!db.prepare('SELECT 1 FROM items WHERE code=?').get(itemCode)) throw new Error(`Unknown item: ${itemCode}`)
    const fromLocation = knownLocation(input.fromLocation, 'Source location')
    const toLocation = knownLocation(input.toLocation, 'Destination location')
    if (fromLocation === toLocation) throw new Error('Source and destination locations must differ')
    const quantity = positive(input.quantity, 'Transfer quantity')
    const available = getStock(itemCode, fromLocation)
    if (available < quantity) throw new Error(`Insufficient stock for transfer: ${itemCode} has ${available} at ${fromLocation}`)
    // This transaction already owns the write lock; allocate within it without
    // attempting to start a nested better-sqlite3 transaction.
    const transferId = allocateOfficeId('transfer')
    const date = new Date().toISOString().slice(0, 10)
    db.prepare(`INSERT INTO stock_transfers(transfer_id, transfer_date, item_code, from_location, to_location, quantity)
      VALUES (?, ?, ?, ?, ?, ?)`).run(transferId, date, itemCode, fromLocation, toLocation, quantity)
    const insert = db.prepare(`INSERT INTO stock_movements(date, document, type, item_code, location, quantity, rate, amount)
      VALUES (?, ?, ?, ?, ?, ?, 0, 0)`)
    insert.run(date, transferId, 'TRANSFER OUT', itemCode, fromLocation, -quantity)
    insert.run(date, transferId, 'TRANSFER IN', itemCode, toLocation, quantity)
    recordAudit('STOCK_TRANSFER', `${transferId} · ${itemCode} · ${quantity} · ${fromLocation} → ${toLocation}`)
    return { transferId, date, itemCode, fromLocation, toLocation, quantity }
  })

  function listStockTypes() {
    return db.prepare('SELECT code, description FROM stock_types ORDER BY code').all()
  }

  function saveStockType(input) {
    const code = required(input.code, 'Stock type code').toUpperCase()
    const description = required(input.description, 'Stock type description')
    const exists = db.prepare('SELECT 1 FROM stock_types WHERE code=?').get(code)
    db.prepare(`INSERT INTO stock_types(code, description) VALUES (?, ?)
      ON CONFLICT(code) DO UPDATE SET description=excluded.description`).run(code, description)
    recordAudit(exists ? 'STOCK_TYPE_UPDATE' : 'STOCK_TYPE_SAVE', code)
    return { code, description }
  }

  function deleteStockType(codeInput) {
    const code = required(codeInput, 'Stock type code').toUpperCase()
    if (['REG', 'SER'].includes(code)) throw new Error('Built-in stock types cannot be deleted')
    if (db.prepare('SELECT 1 FROM items WHERE stock_type=? LIMIT 1').get(code)) throw new Error('Stock type is assigned to items and cannot be deleted')
    const result = db.prepare('DELETE FROM stock_types WHERE code=?').run(code)
    if (!result.changes) throw new Error('Stock type does not exist')
    recordAudit('STOCK_TYPE_DELETE', code)
  }

  function listVouchers(types = null) {
    const headers = types?.length
      ? db.prepare(`SELECT number, date, narration, reference, voucher_type AS type FROM vouchers WHERE voucher_type IN (${types.map(() => '?').join(',')}) ORDER BY date DESC, number DESC`).all(...types)
      : db.prepare(`SELECT number, date, narration, reference, voucher_type AS type FROM vouchers ORDER BY date DESC, number DESC`).all()
    const lines = db.prepare(`SELECT line_number AS lineNumber, account_code AS accountCode, debit, credit
      FROM voucher_lines WHERE voucher_number=? ORDER BY line_number`)
    return headers.map((voucher) => ({ ...voucher, lines: lines.all(voucher.number) }))
  }

  function validateVoucher(input) {
    const number = required(input.number, 'Voucher number')
    const date = required(input.date, 'Voucher date')
    const parsedDate = new Date(`${date}T00:00:00Z`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) throw new Error('Voucher date must be a real date in yyyy-MM-dd format')
    const type = String(input.type || 'VOUCHER').trim().toUpperCase()
    if (!['VOUCHER', 'JOURNAL VOUCHER', 'PAYMENT', 'RECEIPT'].includes(type)) throw new Error('Voucher type is not supported')
    if (!Array.isArray(input.lines) || input.lines.length < 2) throw new Error('A balanced voucher needs at least two lines')
    const lines = input.lines.map((line) => {
      const accountCode = required(line.accountCode, 'Account')
      if (!findAccount.get(accountCode)) throw new Error(`Unknown account: ${accountCode}`)
      const debit = nonNegative(line.debit, 'Debit')
      const credit = nonNegative(line.credit, 'Credit')
      if (debit > 0 && credit > 0) throw new Error('A voucher line cannot have both debit and credit')
      if (debit === 0 && credit === 0) throw new Error('Each voucher line needs a debit or credit amount')
      return { accountCode, debit, credit }
    })
    const debitTotal = lines.reduce((sum, line) => sum + line.debit, 0)
    const creditTotal = lines.reduce((sum, line) => sum + line.credit, 0)
    if (Math.abs(debitTotal - creditTotal) > 1e-8) throw new Error('Debit and credit totals must balance')
    return { number, date, type, narration: String(input.narration || '').trim(), reference: String(input.reference || '').trim(), lines }
  }

  const saveVoucherTransaction = db.transaction((input) => {
    let voucher = validateVoucher(input)
    const existing = db.prepare('SELECT number, date, narration, reference, voucher_type AS type FROM vouchers WHERE number=?').get(voucher.number)
    const exists = Boolean(existing)
    const update = Boolean(input.update)
    if (exists && !update) throw new Error(`Voucher number already exists: ${voucher.number}`)
    if (!exists && update) throw new Error('Voucher does not exist')
    if (exists) {
      const existingType = getVoucherType(voucher.number)
      if (existingType !== voucher.type) throw new Error('An existing voucher cannot be changed to another voucher type')
      if (input.__baseline) {
        const current = { ...existing, lines: db.prepare('SELECT account_code AS accountCode, debit, credit FROM voucher_lines WHERE voucher_number=? ORDER BY line_number').all(voucher.number) }
        const merged = mergeConcurrentFields(current, input.__baseline, voucher, [['date'], ['narration'], ['reference'], ['lines', 'lines']], 'voucher')
        voucher = validateVoucher({ ...voucher, ...merged })
      }
      db.prepare('UPDATE vouchers SET date=?, narration=?, reference=?, voucher_type=? WHERE number=?')
        .run(voucher.date, voucher.narration, voucher.reference, voucher.type, voucher.number)
      db.prepare('DELETE FROM voucher_lines WHERE voucher_number=?').run(voucher.number)
    } else {
      db.prepare('INSERT INTO vouchers(number,date,narration,reference,voucher_type) VALUES (?,?,?,?,?)')
        .run(voucher.number, voucher.date, voucher.narration, voucher.reference, voucher.type)
    }
    const insert = db.prepare('INSERT INTO voucher_lines(voucher_number,line_number,account_code,debit,credit) VALUES (?,?,?,?,?)')
    voucher.lines.forEach((line, index) => insert.run(voucher.number, index + 1, line.accountCode, line.debit, line.credit))
    recordAudit(exists ? 'VOUCHER_UPDATE' : `${voucher.type.replaceAll(' ', '_')}_POST`, voucher.number)
    return voucher
  })

  function deleteVoucher(numberInput) {
    const number = required(numberInput, 'Voucher number')
    const existing = db.prepare('SELECT voucher_type AS type FROM vouchers WHERE number=?').get(number)
    if (!existing) throw new Error('Voucher does not exist')
    db.transaction(() => {
      db.prepare('DELETE FROM voucher_lines WHERE voucher_number=?').run(number)
      db.prepare('DELETE FROM vouchers WHERE number=?').run(number)
      recordAudit('VOUCHER_DELETE', `${number} · ${existing.type}`)
    })()
  }

  function getVoucherType(number) {
    return db.prepare('SELECT voucher_type AS type FROM vouchers WHERE number=?').get(String(number))?.type ?? null
  }

  const postChallanTransaction = db.transaction((input) => {
    const type = String(input.type || '').toUpperCase()
    if (!['PURCHASE', 'SALE'].includes(type)) throw new Error('Challan type must be Purchase or Sale')
    const number = required(input.number, 'Challan number')
    const date = required(input.date, 'Challan date')
    const party = required(input.party, 'Party')
    const location = knownLocation(input.location)
    const parsedDate = new Date(`${date}T00:00:00Z`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) throw new Error('Date must be a real date in yyyy-MM-dd format')
    if (!Array.isArray(input.lines) || input.lines.length === 0) throw new Error('Add at least one item line')
    if (db.prepare('SELECT 1 FROM challans WHERE number=?').get(number)) throw new Error(`Challan number already exists: ${number}`)

    const lines = input.lines.map((line) => {
      const itemCode = String(line.itemCode || '').trim()
      const itemLabel = String(line.itemLabel || '').trim()
      const item = itemCode ? db.prepare('SELECT code, sale_rate, purchase_rate FROM items WHERE code=?').get(itemCode) : null
      if (itemCode && !item) throw new Error(`Unknown item: ${itemCode}`)
      if (!itemCode && !itemLabel) throw new Error('Choose a catalog item or enter a line label')
      const quantity = positive(line.quantity, 'Quantity')
      const rate = nonNegative(item ? type === 'PURCHASE' ? item.purchase_rate : item.sale_rate : line.rate, 'Item rate')
      return { itemCode: itemCode || null, itemLabel: itemCode ? null : itemLabel, quantity, rate, amount: quantity * rate }
    })
    if (type === 'SALE') {
      const grouped = new Map()
      for (const line of lines) if (line.itemCode) grouped.set(line.itemCode, (grouped.get(line.itemCode) || 0) + line.quantity)
      for (const [itemCode, quantity] of grouped) {
        if (getStock(itemCode, location) < quantity) throw new Error(`Insufficient stock for ${itemCode} at ${location}`)
      }
    }
    const total = lines.reduce((sum, line) => sum + line.amount, 0)
    db.prepare('INSERT INTO challans(number, type, date, party, location, total) VALUES (?, ?, ?, ?, ?, ?)')
      .run(number, type, date, party, location, total)
    const insertLine = db.prepare('INSERT INTO challan_lines(challan_number, line_number, item_code, item_label, quantity, rate, amount) VALUES (?, ?, ?, ?, ?, ?, ?)')
    const insertMovement = db.prepare('INSERT INTO stock_movements(date, document, type, item_code, location, quantity, rate, amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    lines.forEach((line, index) => {
      const signedQuantity = type === 'PURCHASE' ? line.quantity : -line.quantity
      insertLine.run(number, index + 1, line.itemCode, line.itemLabel, line.quantity, line.rate, line.amount)
      if (line.itemCode) insertMovement.run(date, number, type, line.itemCode, location, signedQuantity, line.rate, signedQuantity * line.rate)
    })
    recordAudit('CHALLAN_POST', number)
    return { number, type, date, party, location, total, lines }
  })

  const updateChallanTransaction = db.transaction((input) => {
    const number = required(input.number, 'Challan number')
    const existing = db.prepare('SELECT number, type, date, party, location FROM challans WHERE number=?').get(number)
    if (!existing) throw new Error('Challan does not exist')
    const type = existing.type
    if (input.type && String(input.type).toUpperCase() !== type) throw new Error('A challan cannot be changed from purchase to sale or vice versa')
    const current = { ...existing, lines: db.prepare('SELECT item_code AS itemCode, item_label AS itemLabel, quantity, rate FROM challan_lines WHERE challan_number=? ORDER BY line_number').all(number) }
    const proposed = { date: input.date, party: input.party, location: input.location, lines: input.lines }
    const changes = input.__baseline
      ? mergeConcurrentFields(current, input.__baseline, proposed, [['date'], ['party'], ['location'], ['lines', 'lines']], 'challan')
      : proposed
    const date = required(changes.date, 'Challan date')
    const parsedDate = new Date(`${date}T00:00:00Z`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) throw new Error('Date must be a real date in yyyy-MM-dd format')
    const party = required(changes.party, 'Party')
    const location = knownLocation(changes.location)
    if (!Array.isArray(changes.lines) || changes.lines.length === 0) throw new Error('Add at least one item line')

    // Temporarily remove the old stock effect inside this transaction so the replacement
    // sale is validated against the balance that would exist after the edit.
    const oldMovements = db.prepare('SELECT DISTINCT item_code AS itemCode, location FROM stock_movements WHERE document=?').all(number)
    db.prepare('DELETE FROM stock_movements WHERE document=?').run(number)
    const lines = changes.lines.map((line) => {
      const itemCode = String(line.itemCode || '').trim()
      const itemLabel = String(line.itemLabel || '').trim()
      const item = itemCode ? db.prepare('SELECT sale_rate, purchase_rate FROM items WHERE code=?').get(itemCode) : null
      if (itemCode && !item) throw new Error(`Unknown item: ${itemCode}`)
      if (!itemCode && !itemLabel) throw new Error('Choose a catalog item or enter a line label')
      const quantity = positive(line.quantity, 'Quantity')
      const rate = nonNegative(item ? type === 'PURCHASE' ? item.purchase_rate : item.sale_rate : line.rate, 'Item rate')
      return { itemCode: itemCode || null, itemLabel: itemCode ? null : itemLabel, quantity, rate, amount: quantity * rate }
    })
    if (type === 'SALE') {
      const grouped = new Map()
      for (const line of lines) if (line.itemCode) grouped.set(line.itemCode, (grouped.get(line.itemCode) || 0) + line.quantity)
      for (const [itemCode, quantity] of grouped) if (getStock(itemCode, location) < quantity) throw new Error(`Insufficient stock for ${itemCode} at ${location}`)
    }
    const total = lines.reduce((sum, line) => sum + line.amount, 0)
    db.prepare('UPDATE challans SET date=?, party=?, location=?, total=? WHERE number=?').run(date, party, location, total, number)
    db.prepare('DELETE FROM challan_lines WHERE challan_number=?').run(number)
    const insertLine = db.prepare('INSERT INTO challan_lines(challan_number, line_number, item_code, item_label, quantity, rate, amount) VALUES (?, ?, ?, ?, ?, ?, ?)')
    const insertMovement = db.prepare('INSERT INTO stock_movements(date, document, type, item_code, location, quantity, rate, amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    lines.forEach((line, index) => {
      const signedQuantity = type === 'PURCHASE' ? line.quantity : -line.quantity
      insertLine.run(number, index + 1, line.itemCode, line.itemLabel, line.quantity, line.rate, line.amount)
      if (line.itemCode) insertMovement.run(date, number, type, line.itemCode, location, signedQuantity, line.rate, signedQuantity * line.rate)
    })
    const affected = new Map(oldMovements.map((movement) => [`${movement.itemCode}\u0000${movement.location}`, movement]))
    for (const line of lines) if (line.itemCode) affected.set(`${line.itemCode}\u0000${location}`, { itemCode: line.itemCode, location })
    for (const movement of affected.values()) if (getStock(movement.itemCode, movement.location) < -1e-9) {
      throw new Error(`This change would leave ${movement.itemCode} below zero stock at ${movement.location}`)
    }
    recordAudit('CHALLAN_UPDATE', number)
    return { number, type, date, party, location, total, lines }
  })

  const deleteChallanTransaction = db.transaction((numberInput) => {
    const number = required(numberInput, 'Challan number')
    const existing = db.prepare('SELECT number, type FROM challans WHERE number=?').get(number)
    if (!existing) throw new Error('Challan does not exist')
    const movements = db.prepare('SELECT DISTINCT item_code AS itemCode, location FROM stock_movements WHERE document=?').all(number)
    db.prepare('DELETE FROM stock_movements WHERE document=?').run(number)
    if (existing.type === 'PURCHASE') {
      for (const movement of movements) if (getStock(movement.itemCode, movement.location) < -1e-9) {
        throw new Error(`Cannot delete this purchase: later sales would leave ${movement.itemCode} below zero stock at ${movement.location}`)
      }
    }
    db.prepare('DELETE FROM challan_lines WHERE challan_number=?').run(number)
    db.prepare('DELETE FROM challans WHERE number=?').run(number)
    recordAudit('CHALLAN_DELETE', number)
  })

  function saveCheque(input) {
    const existingCheque = db.prepare(`SELECT bank_code AS bankCode, bank_account_code AS bankAccountCode
      FROM cheques WHERE number=?`).get(String(input.number || '').trim())
    let cheque = {
      number: required(input.number, 'Cheque number'), bankCode: required(input.bankCode, 'Bank'),
      date: required(input.date, 'Cheque date'), party: required(input.party, 'Party'),
      amount: positive(input.amount, 'Amount'), status: required(input.status, 'Status').toUpperCase(),
      checkNumber: String(input.checkNumber || ''),
      direction: String(input.direction || '').toUpperCase(), bankAccountCode: String(input.bankAccountCode || '').trim(), clearedDate: String(input.clearedDate || '').trim(),
    }
    if (input.__baseline) {
      const current = db.prepare(`SELECT number, bank_code AS bankCode, cheque_date AS date, party, amount,
        status, manual_id AS checkNumber, direction, bank_account_code AS bankAccountCode, cleared_date AS clearedDate FROM cheques WHERE number=?`).get(cheque.number)
      const merged = mergeConcurrentFields(current, input.__baseline, cheque,
        [['bankCode'], ['date'], ['party'], ['amount', 'number'], ['status'], ['checkNumber'], ['direction'], ['bankAccountCode'], ['clearedDate']], 'cheque')
      cheque = { ...cheque, ...merged }
    }
    const chequeDate = new Date(`${cheque.date}T00:00:00Z`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cheque.date) || Number.isNaN(chequeDate.getTime()) || chequeDate.toISOString().slice(0, 10) !== cheque.date) throw new Error('Cheque date must be a real date in yyyy-MM-dd format')
    if (!['PENDING', 'CLEARED', 'RETURNED', 'CANCELLED'].includes(cheque.status)) throw new Error('Cheque status is not supported')
    const selectedBank = db.prepare('SELECT ledger_account_code AS ledgerAccountCode FROM banks WHERE code=?').get(cheque.bankCode)
    if (!selectedBank) throw new Error('Selected bank does not exist')
    if (cheque.status === 'CLEARED') {
      if (!['PAYMENT', 'RECEIPT'].includes(cheque.direction)) throw new Error('Choose whether this cleared cheque is a payment or receipt')
      const existingMappedAccount = existingCheque?.bankCode === cheque.bankCode ? existingCheque.bankAccountCode : ''
      cheque.bankAccountCode = existingMappedAccount || selectedBank.ledgerAccountCode
      if (!cheque.bankAccountCode) throw new Error('Assign this bank a Chart of Accounts ledger account in Banks before clearing the cheque')
      if (!findAccount.get(cheque.party)) throw new Error('The cheque party must be a Chart of Accounts account')
      if (!findAccount.get(cheque.bankAccountCode)) throw new Error('The bank ledger account no longer exists; update the bank mapping')
      const clearedDate = new Date(`${cheque.clearedDate}T00:00:00Z`)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(cheque.clearedDate) || Number.isNaN(clearedDate.getTime()) || clearedDate.toISOString().slice(0, 10) !== cheque.clearedDate) throw new Error('Enter a real cheque clearing date in yyyy-MM-dd format')
    }
    return db.transaction(() => {
      const previous = db.prepare('SELECT status FROM cheques WHERE number=?').get(cheque.number)
      db.prepare(`INSERT INTO cheques(number, bank_code, cheque_date, party, amount, status, manual_id, direction, bank_account_code, cleared_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(number) DO UPDATE SET bank_code=excluded.bank_code, cheque_date=excluded.cheque_date,
          party=excluded.party, amount=excluded.amount, status=excluded.status, manual_id=excluded.manual_id,
          direction=excluded.direction, bank_account_code=excluded.bank_account_code, cleared_date=excluded.cleared_date`)
        .run(cheque.number, cheque.bankCode, cheque.date, cheque.party, cheque.amount, cheque.status, cheque.checkNumber, cheque.direction, cheque.bankAccountCode, cheque.clearedDate)
      // Status history represents transitions, not ordinary edits to cheque details.
      if (!previous || previous.status !== cheque.status) {
        db.prepare('INSERT INTO cheque_status_history(cheque_number, status, changed_at) VALUES (?, ?, ?)')
          .run(cheque.number, cheque.status, now())
      }
      recordAudit('CHEQUE_SAVE', cheque.number)
      return cheque
    })()
  }

  function listCheques() {
    return db.prepare(`SELECT number, bank_code AS bankCode, cheque_date AS date, party, amount,
      status, manual_id AS checkNumber, direction, bank_account_code AS bankAccountCode, cleared_date AS clearedDate FROM cheques ORDER BY cheque_date DESC, number DESC`).all()
  }

  const deleteChequeTransaction = db.transaction((numberInput) => {
    const number = required(numberInput, 'Cheque number')
    if (!db.prepare('SELECT 1 FROM cheques WHERE number=?').get(number)) throw new Error('Cheque does not exist')
    db.prepare('DELETE FROM cheque_status_history WHERE cheque_number=?').run(number)
    db.prepare('DELETE FROM cheques WHERE number=?').run(number)
    recordAudit('CHEQUE_DELETE', number)
  })

  return {
    close: () => db.close(), backupTo, exportData, verifyDatabase,
    nextId: (entity) => nextOfficeId(entity),
    getDashboard, getCompanyProfile, hasCompanyProfile, saveCompanyProfile, hasAdminToolsPassword, configureAdminToolsPassword, verifyAdminToolsPassword, listAccounts, saveAccount, deleteAccount,
    listItems, saveItem, createItemFromChallan, deleteItem, listBanks, saveBank, deleteBank,
    listChallans, postChallan: (input) => postChallanTransaction(input), updateChallan: (input) => updateChallanTransaction(input), deleteChallan: (number) => deleteChallanTransaction(number),
    getStock, listLocations, saveLocation, deleteLocation, listStockMovements, listOpeningBalances,
    addOpeningBalance: (input) => addOpeningBalanceTransaction(input), transferStock: (input) => transferStockTransaction(input),
    listStockTypes, saveStockType, deleteStockType,
    listVouchers, saveVoucher: (input) => saveVoucherTransaction(input), deleteVoucher, getVoucherType,
    listCheques, saveCheque, deleteCheque: (number) => deleteChequeTransaction(number),
    getChallanType: (number) => db.prepare('SELECT type FROM challans WHERE number=?').get(number)?.type ?? null,
    listUsers, getUserSession, saveUser, deleteUser, authenticate, createFirstUser, setCurrentUser, setAuditActor, auditEvents,
    listDevices, registerDevice, getActiveDevice, revokeDevice,
    hasUsers: () => Boolean(db.prepare('SELECT 1 FROM users LIMIT 1').get()),
    getStockTypes: listStockTypes,
  }
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16)
  const derived = crypto.pbkdf2Sync(password, salt, PASSWORD_HASH_ITERATIONS, 32, 'sha256')
  return `pbkdf2$${PASSWORD_HASH_ITERATIONS}$${salt.toString('base64')}$${derived.toString('base64')}`
}

function passwordNeedsRehash(stored) {
  if (typeof stored !== 'string' || !stored.startsWith('pbkdf2$')) return true
  const iterations = Number(stored.split('$')[1])
  return !Number.isSafeInteger(iterations) || iterations < PASSWORD_HASH_ITERATIONS
}

function verifyPassword(password, stored) {
  try {
    if (typeof stored === 'string' && stored.startsWith('pbkdf2$')) {
      const [, iterations, salt, expected] = stored.split('$')
      const work = Number(iterations)
      const saltBytes = Buffer.from(salt, 'base64')
      const expectedBytes = Buffer.from(expected, 'base64')
      if (!Number.isSafeInteger(work) || work < 1 || work > 2_000_000 || saltBytes.length < 16 || expectedBytes.length !== 32) return false
      const hash = crypto.pbkdf2Sync(password, saltBytes, work, 32, 'sha256')
      return crypto.timingSafeEqual(hash, expectedBytes)
    }
    if (typeof stored !== 'string' || !/^[a-f0-9]{64}$/i.test(stored)) return false
    const legacy = crypto.createHash('sha256').update(password).digest('hex')
    return crypto.timingSafeEqual(Buffer.from(legacy), Buffer.from(stored))
  } catch { return false }
}

function normalizePermissions(values) {
  const aliases = {
    'Chart of Account': 'Chart of Accounts', Bank: 'Banks', 'Purchase Challan': 'Purchase Challans', 'Sale Challan': 'Sale Challans',
    Reports: 'Reports',
    'Cheque Detail': 'Cheque Detail', 'User Rights': 'User Rights', 'Audit Log': 'Audit Log',
  }
  const permissions = new Set(values.map((permission) => aliases[permission] || permission))
  permissions.add('Overview')
  permissions.add('Manual')
  if (permissions.has('User Rights')) {
    permissions.add('Company Profile')
    permissions.add('Database Tools')
  } else {
    permissions.delete('Company Profile')
  }
  if (permissions.has('User Rights')) {
    permissions.add('Stock Types')
    permissions.add('Locations')
    permissions.add('Item Opening Balances')
    permissions.add('Transfer')
    permissions.add('Voucher')
    permissions.add('Journal Voucher')
    permissions.add('Search Payment')
    permissions.add('Payment / Receipt')
  }
  return [...permissions]
}

function normalizeMacAddress(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const compact = raw.replace(/[:-]/g, '').toUpperCase()
  if (!/^[0-9A-F]{12}$/.test(compact) || /^0{12}$/.test(compact) || /^F{12}$/.test(compact)) {
    throw new Error('Enter a valid MAC address, such as 00:1A:2B:3C:4D:5E')
  }
  return compact.match(/.{2}/g).join(':')
}

function required(value, label) {
  const text = String(value ?? '').trim()
  if (!text) throw new Error(`${label} is required`)
  return text
}

function positive(value, label) {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) throw new Error(`${label} must be greater than zero`)
  return number
}

function nonNegative(value, label) {
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0) throw new Error(`${label} cannot be negative`)
  return number
}

module.exports = { openOfficeDatabase }
