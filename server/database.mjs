import { DatabaseSync } from 'node:sqlite'
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

const parseJson = (value) => JSON.parse(value)
const CONCURRENT_RECORD_KEYS = ['customers', 'followUps', 'designTasks', 'orders', 'deliveryTasks', 'afterSalesTickets', 'supplyDemands', 'inventoryMovements', 'inventoryDocuments', 'replenishmentRequests', 'categories', 'series', 'components', 'skuUnits', 'configProducts', 'productPackages']
const recordTime = item => item?.updatedAt || item?.createdAt || item?.lastContactAt || ''
const mergeRecordList = (current = [], incoming = []) => {
  const records = new Map(current.filter(item => item?.id).map(item => [item.id, item]))
  for (const item of incoming) {
    if (!item?.id) continue
    const saved = records.get(item.id)
    if (!saved || recordTime(item) >= recordTime(saved)) records.set(item.id, item)
  }
  return [...records.values()].sort((a, b) => recordTime(b).localeCompare(recordTime(a)))
}
const mergeConcurrentState = (current, incoming) => {
  if (!current || typeof current !== 'object' || !incoming || typeof incoming !== 'object') return incoming
  const merged = { ...incoming }
  for (const key of CONCURRENT_RECORD_KEYS) {
    if (Array.isArray(current[key]) && Array.isArray(incoming[key])) merged[key] = mergeRecordList(current[key], incoming[key])
  }
  return merged
}
const tokenDigest = token => createHash('sha256').update(token).digest('hex')
const validPermissions = new Set(['store.analytics', 'coaching', 'data.manage', 'members.manage', 'customers.own', 'customers.design', 'tasks.own', 'designer.dispatch', 'conversation.analysis', 'sop', 'revenue.summary', 'inventory.manage', 'inventory.receive', 'inventory.issue', 'inventory.transfer', 'inventory.audit', 'replenishment.request', 'replenishment.approve', 'purchasing.manage', 'finance.reconcile', 'cashier.payments', 'cost.view'])
const normalizePermissions = permissions => permissions == null ? null : [...new Set(permissions)].filter(permission => validPermissions.has(permission))
const validRoles = ['manager', 'sales', 'designer', 'operations', 'aftersales', 'purchasing', 'warehouse', 'finance', 'cashier']
const normalizeRoles = (roles, fallback) => {
  const selected = Array.isArray(roles) && roles.length ? roles : [fallback]
  return [...new Set([fallback, ...selected])].filter(role => validRoles.includes(role) && (role !== 'manager' || fallback === 'manager'))
}

function hashPassword(password) {
  const salt = randomBytes(16)
  const hash = scryptSync(password, salt, 64)
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`
}

function verifyPassword(password, encoded) {
  const [algorithm, saltValue, hashValue] = String(encoded).split('$')
  if (algorithm !== 'scrypt' || !saltValue || !hashValue) return false
  const expected = Buffer.from(hashValue, 'base64')
  const actual = scryptSync(password, Buffer.from(saltValue, 'base64'), expected.length)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

export class SalesDatabase {
  constructor(filename = ':memory:') {
    this.db = new DatabaseSync(filename)
    this.db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;')
    const accountSchema = this.db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'auth_accounts'").get()?.sql || ''
    if (accountSchema && !accountSchema.includes("'operations'")) {
      this.db.exec(`
        PRAGMA foreign_keys = OFF;
        BEGIN IMMEDIATE;
        ALTER TABLE auth_sessions RENAME TO auth_sessions_legacy;
        ALTER TABLE auth_accounts RENAME TO auth_accounts_legacy;
        CREATE TABLE auth_accounts (
          id TEXT PRIMARY KEY,
          username TEXT NOT NULL COLLATE NOCASE UNIQUE,
          password_hash TEXT NOT NULL,
          name TEXT NOT NULL,
          role TEXT NOT NULL CHECK(role IN ('manager', 'sales', 'designer', 'operations', 'aftersales', 'purchasing', 'warehouse', 'finance', 'cashier')),
          active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0, 1)),
          must_change_password INTEGER NOT NULL DEFAULT 0 CHECK(must_change_password IN (0, 1)),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE auth_sessions (
          token_hash TEXT PRIMARY KEY,
          account_id TEXT NOT NULL REFERENCES auth_accounts(id) ON DELETE CASCADE,
          expires_at TEXT NOT NULL,
          created_at TEXT NOT NULL,
          last_seen_at TEXT NOT NULL
        );
        INSERT INTO auth_accounts SELECT * FROM auth_accounts_legacy;
        INSERT INTO auth_sessions SELECT * FROM auth_sessions_legacy;
        DROP TABLE auth_sessions_legacy;
        DROP TABLE auth_accounts_legacy;
        COMMIT;
        PRAGMA foreign_keys = ON;
      `)
    }
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS app_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        value TEXT NOT NULL CHECK (json_valid(value)),
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action TEXT NOT NULL,
        resource TEXT NOT NULL,
        details TEXT NOT NULL CHECK (json_valid(details)),
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS members (
        id TEXT PRIMARY KEY,
        value TEXT NOT NULL CHECK (json_valid(value)),
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS integration_settings (
        name TEXT PRIMARY KEY,
        value TEXT NOT NULL CHECK (json_valid(value)),
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ideas (
        id TEXT PRIMARY KEY,
        value TEXT NOT NULL CHECK (json_valid(value)),
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS ideas_updated_idx ON ideas(updated_at DESC);
      CREATE TABLE IF NOT EXISTS cases (
        id TEXT PRIMARY KEY,
        value TEXT NOT NULL CHECK (json_valid(value)),
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS cases_updated_idx ON cases(updated_at DESC);
      CREATE TABLE IF NOT EXISTS auth_accounts (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL COLLATE NOCASE UNIQUE,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('manager', 'sales', 'designer', 'operations', 'aftersales', 'purchasing', 'warehouse', 'finance', 'cashier')),
        active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0, 1)),
        must_change_password INTEGER NOT NULL DEFAULT 0 CHECK(must_change_password IN (0, 1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS auth_sessions (
        token_hash TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES auth_accounts(id) ON DELETE CASCADE,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS auth_sessions_account_idx ON auth_sessions(account_id);
      CREATE INDEX IF NOT EXISTS auth_sessions_expiry_idx ON auth_sessions(expires_at);
    `)
    const accountColumns = this.db.prepare('PRAGMA table_info(auth_accounts)').all().map(column => column.name)
    if (!accountColumns.includes('phone')) this.db.exec('ALTER TABLE auth_accounts ADD COLUMN phone TEXT')
    if (!accountColumns.includes('can_design')) this.db.exec('ALTER TABLE auth_accounts ADD COLUMN can_design INTEGER NOT NULL DEFAULT 0 CHECK(can_design IN (0, 1))')
    if (!accountColumns.includes('custom_permissions')) this.db.exec('ALTER TABLE auth_accounts ADD COLUMN custom_permissions TEXT')
    if (!accountColumns.includes('roles')) this.db.exec('ALTER TABLE auth_accounts ADD COLUMN roles TEXT')
    const currentAccountSchema = this.db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'auth_accounts'").get()?.sql || ''
    if (!currentAccountSchema.includes("'purchasing'")) {
      this.db.exec(`
        PRAGMA foreign_keys = OFF;
        BEGIN IMMEDIATE;
        ALTER TABLE auth_sessions RENAME TO auth_sessions_role_legacy;
        ALTER TABLE auth_accounts RENAME TO auth_accounts_role_legacy;
        CREATE TABLE auth_accounts (
          id TEXT PRIMARY KEY,
          username TEXT NOT NULL COLLATE NOCASE UNIQUE,
          password_hash TEXT NOT NULL,
          name TEXT NOT NULL,
          role TEXT NOT NULL CHECK(role IN ('manager', 'sales', 'designer', 'operations', 'aftersales', 'purchasing', 'warehouse', 'finance', 'cashier')),
          active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0, 1)),
          must_change_password INTEGER NOT NULL DEFAULT 0 CHECK(must_change_password IN (0, 1)),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          phone TEXT,
          can_design INTEGER NOT NULL DEFAULT 0 CHECK(can_design IN (0, 1)),
          custom_permissions TEXT,
          roles TEXT
        );
        CREATE TABLE auth_sessions (
          token_hash TEXT PRIMARY KEY,
          account_id TEXT NOT NULL REFERENCES auth_accounts(id) ON DELETE CASCADE,
          expires_at TEXT NOT NULL,
          created_at TEXT NOT NULL,
          last_seen_at TEXT NOT NULL
        );
        INSERT INTO auth_accounts(id, username, password_hash, name, role, active, must_change_password, created_at, updated_at, phone, can_design, custom_permissions, roles)
          SELECT id, username, password_hash, name, role, active, must_change_password, created_at, updated_at, phone, can_design, custom_permissions, roles FROM auth_accounts_role_legacy;
        INSERT INTO auth_sessions SELECT * FROM auth_sessions_role_legacy;
        DROP TABLE auth_sessions_role_legacy;
        DROP TABLE auth_accounts_role_legacy;
        COMMIT;
        PRAGMA foreign_keys = ON;
        CREATE INDEX IF NOT EXISTS auth_sessions_account_idx ON auth_sessions(account_id);
        CREATE INDEX IF NOT EXISTS auth_sessions_expiry_idx ON auth_sessions(expires_at);
      `)
    }
    this.statements = {
      getState: this.db.prepare('SELECT value, updated_at FROM app_state WHERE id = 1'),
      putState: this.db.prepare(`INSERT INTO app_state(id, value, updated_at) VALUES(1, ?, ?)
        ON CONFLICT(id) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`),
      audit: this.db.prepare('INSERT INTO audit_log(action, resource, details, created_at) VALUES(?, ?, ?, ?)'),
      getAudit: this.db.prepare('SELECT id, action, resource, details, created_at FROM audit_log ORDER BY id DESC LIMIT ? OFFSET ?'),
      countAudit: this.db.prepare('SELECT COUNT(*) AS count FROM audit_log'),
      listMembers: this.db.prepare('SELECT id, value, updated_at FROM members ORDER BY id'),
      putMember: this.db.prepare(`INSERT INTO members(id, value, updated_at) VALUES(?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`),
      deleteMembers: this.db.prepare('DELETE FROM members'),
      listIntegrations: this.db.prepare('SELECT name, value, updated_at FROM integration_settings ORDER BY name'),
      putIntegration: this.db.prepare(`INSERT INTO integration_settings(name, value, updated_at) VALUES(?, ?, ?)
        ON CONFLICT(name) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`),
      deleteIntegrations: this.db.prepare('DELETE FROM integration_settings'),
      listIdeas: this.db.prepare('SELECT id, value, updated_at FROM ideas ORDER BY updated_at DESC'),
      getIdea: this.db.prepare('SELECT id, value, updated_at FROM ideas WHERE id = ?'),
      putIdea: this.db.prepare(`INSERT INTO ideas(id, value, updated_at) VALUES(?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`),
      deleteIdea: this.db.prepare('DELETE FROM ideas WHERE id = ?'),
      listCases: this.db.prepare('SELECT id, value, updated_at FROM cases ORDER BY updated_at DESC'),
      getCase: this.db.prepare('SELECT id, value, updated_at FROM cases WHERE id = ?'),
      putCase: this.db.prepare(`INSERT INTO cases(id, value, updated_at) VALUES(?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`),
      deleteCase: this.db.prepare('DELETE FROM cases WHERE id = ?'),
      countAccounts: this.db.prepare('SELECT COUNT(*) AS count FROM auth_accounts'),
      accountByUsername: this.db.prepare('SELECT * FROM auth_accounts WHERE username = ? COLLATE NOCASE'),
      accountById: this.db.prepare('SELECT * FROM auth_accounts WHERE id = ?'),
      listAccounts: this.db.prepare('SELECT * FROM auth_accounts ORDER BY created_at'),
      insertAccount: this.db.prepare('INSERT INTO auth_accounts(id, username, password_hash, name, role, active, must_change_password, created_at, updated_at, phone, can_design, custom_permissions, roles) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'),
      updateAccount: this.db.prepare('UPDATE auth_accounts SET username = ?, name = ?, role = ?, phone = ?, can_design = ?, custom_permissions = ?, roles = ?, updated_at = ? WHERE id = ?'),
      updateAccountStatus: this.db.prepare('UPDATE auth_accounts SET active = ?, updated_at = ? WHERE id = ?'),
      updateAccountPassword: this.db.prepare('UPDATE auth_accounts SET password_hash = ?, must_change_password = 1, updated_at = ? WHERE id = ?'),
      updateOwnPassword: this.db.prepare('UPDATE auth_accounts SET password_hash = ?, must_change_password = 0, updated_at = ? WHERE id = ?'),
      deleteAccount: this.db.prepare('DELETE FROM auth_accounts WHERE id = ?'),
      countActiveManagers: this.db.prepare("SELECT COUNT(*) AS count FROM auth_accounts WHERE role = 'manager' AND active = 1"),
      deleteAccountSessions: this.db.prepare('DELETE FROM auth_sessions WHERE account_id = ?'),
      deleteOtherSessions: this.db.prepare('DELETE FROM auth_sessions WHERE account_id = ? AND token_hash <> ?'),
      insertSession: this.db.prepare('INSERT INTO auth_sessions(token_hash, account_id, expires_at, created_at, last_seen_at) VALUES(?, ?, ?, ?, ?)'),
      getSession: this.db.prepare(`SELECT s.token_hash, s.expires_at, a.* FROM auth_sessions s JOIN auth_accounts a ON a.id = s.account_id WHERE s.token_hash = ?`),
      touchSession: this.db.prepare('UPDATE auth_sessions SET last_seen_at = ? WHERE token_hash = ?'),
      deleteSession: this.db.prepare('DELETE FROM auth_sessions WHERE token_hash = ?'),
      deleteExpiredSessions: this.db.prepare('DELETE FROM auth_sessions WHERE expires_at <= ?'),
    }
  }

  now() { return new Date().toISOString() }
  transaction(fn) {
    this.db.exec('BEGIN IMMEDIATE')
    try { const result = fn(); this.db.exec('COMMIT'); return result }
    catch (error) { this.db.exec('ROLLBACK'); throw error }
  }
  record(action, resource, details = {}) {
    this.statements.audit.run(action, resource, JSON.stringify(details), this.now())
  }
  getState() {
    const row = this.statements.getState.get()
    return row ? { value: parseJson(row.value), updatedAt: row.updated_at } : { value: {}, updatedAt: null }
  }
  setState(value) {
    const at = this.now()
    const merged = mergeConcurrentState(this.getState().value, value)
    this.transaction(() => { this.statements.putState.run(JSON.stringify(merged), at); this.record('update', 'state') })
    return { value: merged, updatedAt: at }
  }
  getAudit(limit, offset) {
    return { items: this.statements.getAudit.all(limit, offset).map(r => ({ ...r, details: parseJson(r.details), createdAt: r.created_at, created_at: undefined })), total: Number(this.statements.countAudit.get().count), limit, offset }
  }
  getMembers() { return this.statements.listMembers.all().map(r => ({ ...parseJson(r.value), id: r.id })) }
  setMembers(items) {
    const at = this.now()
    this.transaction(() => { this.statements.deleteMembers.run(); for (const item of items) this.statements.putMember.run(item.id, JSON.stringify(item), at); this.record('replace', 'members', { count: items.length }) })
    return this.getMembers()
  }
  getIntegrations() { return Object.fromEntries(this.statements.listIntegrations.all().map(r => [r.name, parseJson(r.value)])) }
  setIntegrations(settings) {
    const at = this.now()
    this.transaction(() => { this.statements.deleteIntegrations.run(); for (const [name, value] of Object.entries(settings)) this.statements.putIntegration.run(name, JSON.stringify(value), at); this.record('replace', 'integrations', { names: Object.keys(settings) }) })
    return this.getIntegrations()
  }
  listIdeas() { return this.statements.listIdeas.all().map(r => ({ ...parseJson(r.value), id: r.id })) }
  createIdea(input) {
    const at = this.now()
    const content = String(input?.content || '').trim()
    if (!content) throw new Error('IDEA_CONTENT_REQUIRED')
    if (content.length > 1000) throw new Error('IDEA_CONTENT_TOO_LONG')
    const id = `idea-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const idea = {
      id,
      content,
      module: String(input?.module || '待分类').slice(0, 30),
      status: '待评估',
      priority: 'P1',
      author: String(input?.author || ''),
      authorName: String(input?.authorName || ''),
      note: '',
      createdAt: at,
      updatedAt: at,
    }
    this.transaction(() => { this.statements.putIdea.run(id, JSON.stringify(idea), at); this.record('create', 'idea', { id, module: idea.module }) })
    return idea
  }
  updateIdea(id, patch) {
    const row = this.statements.getIdea.get(id)
    if (!row) return null
    const at = this.now()
    const current = parseJson(row.value)
    const next = {
      ...current,
      ...(patch?.status !== undefined ? { status: String(patch.status).slice(0, 20) } : {}),
      ...(patch?.priority !== undefined ? { priority: String(patch.priority).slice(0, 10) } : {}),
      ...(patch?.note !== undefined ? { note: String(patch.note).slice(0, 2000) } : {}),
      ...(patch?.module !== undefined ? { module: String(patch.module).slice(0, 30) } : {}),
      id,
      updatedAt: at,
    }
    this.transaction(() => { this.statements.putIdea.run(id, JSON.stringify(next), at); this.record('update', 'idea', { id, patch }) })
    return next
  }
  deleteIdea(id) {
    const existed = Boolean(this.statements.getIdea.get(id))
    if (!existed) return false
    this.transaction(() => { this.statements.deleteIdea.run(id); this.record('delete', 'idea', { id }) })
    return true
  }
  listCases() { return this.statements.listCases.all().map(r => ({ ...parseJson(r.value), id: r.id })) }
  createCase(input) {
    const at = this.now()
    const title = String(input?.title || '').trim()
    if (!title) throw new Error('CASE_TITLE_REQUIRED')
    if (title.length > 80) throw new Error('CASE_TITLE_TOO_LONG')
    const note = String(input?.note || '').trim()
    if (note.length > 2000) throw new Error('CASE_NOTE_TOO_LONG')
    const images = Array.isArray(input?.images) ? input.images.slice(0, 30).map(file => ({
      id: String(file?.id || '').slice(0, 80),
      name: String(file?.name || '').slice(0, 180),
      type: String(file?.type || 'application/octet-stream').slice(0, 120),
      url: String(file?.url || '').slice(0, 300),
      size: Number.isFinite(file?.size) ? file.size : 0,
    })) : []
    const productNames = Array.isArray(input?.productNames) ? input.productNames.map(item => String(item || '').trim().slice(0, 80)).filter(Boolean).slice(0, 10) : []
    const categories = ['成交案例', '客户实拍', '安装现场', '空间搭配', '其他']
    const category = categories.includes(input?.category) ? input.category : '其他'
    const id = `case-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const record = {
      id,
      title,
      category,
      productNames,
      customerName: String(input?.customerName || '').trim().slice(0, 60),
      images,
      note,
      status: '已发布',
      author: String(input?.author || ''),
      authorName: String(input?.authorName || ''),
      createdAt: at,
      updatedAt: at,
    }
    this.transaction(() => { this.statements.putCase.run(id, JSON.stringify(record), at); this.record('create', 'case', { id, title, category, imageCount: images.length }) })
    return record
  }
  updateCase(id, patch) {
    const row = this.statements.getCase.get(id)
    if (!row) return null
    const at = this.now()
    const current = parseJson(row.value)
    const next = {
      ...current,
      ...(patch?.title !== undefined ? { title: String(patch.title).trim().slice(0, 80) } : {}),
      ...(patch?.category !== undefined ? { category: String(patch.category).slice(0, 30) } : {}),
      ...(patch?.customerName !== undefined ? { customerName: String(patch.customerName).trim().slice(0, 60) } : {}),
      ...(patch?.note !== undefined ? { note: String(patch.note).trim().slice(0, 2000) } : {}),
      ...(patch?.status !== undefined ? { status: String(patch.status) === '已隐藏' ? '已隐藏' : '已发布' } : {}),
      id,
      updatedAt: at,
    }
    this.transaction(() => { this.statements.putCase.run(id, JSON.stringify(next), at); this.record('update', 'case', { id, patch }) })
    return next
  }
  deleteCase(id) {
    const existed = Boolean(this.statements.getCase.get(id))
    if (!existed) return false
    this.transaction(() => { this.statements.deleteCase.run(id); this.record('delete', 'case', { id }) })
    return true
  }
  publicAccount(row) {
    const roles = normalizeRoles(row.roles ? parseJson(row.roles) : null, row.role)
    if (row.can_design && !roles.includes('designer')) roles.push('designer')
    return { id: row.id, username: row.username, name: row.name, role: row.role, roles, canDesign: roles.includes('designer'), permissions: row.custom_permissions ? parseJson(row.custom_permissions) : undefined, phone: row.phone || '', active: Boolean(row.active), mustChangePassword: Boolean(row.must_change_password), createdAt: row.created_at, lastLoginAt: null }
  }
  ensureInitialAdmin({ username, password, name = '店长' }) {
    if (Number(this.statements.countAccounts.get().count) > 0) return null
    if (!username || !password) return null
    if (password.length < 10) throw new Error('Initial administrator password must be at least 10 characters')
    const at = this.now(), id = `account-${randomBytes(8).toString('hex')}`
    this.transaction(() => {
      this.statements.insertAccount.run(id, username.trim(), hashPassword(password), name, 'manager', 1, 1, at, at, '', 0, null, JSON.stringify(['manager']))
      this.record('create', 'auth_account', { accountId: id, role: 'manager', initial: true })
    })
    return this.publicAccount(this.statements.accountById.get(id))
  }
  createAccount({ username, password, name, role, roles, phone = '', canDesign = false, permissions, active = true, mustChangePassword = true }) {
    if (!validRoles.includes(role)) throw new Error('Invalid account role')
    if (!username?.trim() || !name?.trim() || !(/^\d{6}$/.test(String(password || '')) || String(password || '').length >= 10)) throw new Error('Invalid account details')
    const at = this.now(), id = `account-${randomBytes(8).toString('hex')}`
    const normalizedRoles = normalizeRoles(roles, role)
    if (canDesign && !normalizedRoles.includes('designer')) normalizedRoles.push('designer')
    if (!normalizedRoles.length) throw new Error('Invalid account roles')
    const primaryRole = normalizedRoles[0]
    const normalized = normalizedRoles.includes('manager') ? null : normalizePermissions(permissions)
    this.statements.insertAccount.run(id, username.trim(), hashPassword(password), name.trim(), primaryRole, active ? 1 : 0, mustChangePassword ? 1 : 0, at, at, String(phone || '').trim(), normalizedRoles.includes('designer') ? 1 : 0, normalized == null ? null : JSON.stringify(normalized), JSON.stringify(normalizedRoles))
    this.record('create', 'auth_account', { accountId: id, role })
    return this.publicAccount(this.statements.accountById.get(id))
  }
  listAccounts() { return this.statements.listAccounts.all().map(row => this.publicAccount(row)) }
  updateAccount(id, { username, name, role, roles, phone = '', canDesign = false, permissions }) {
    if (!validRoles.includes(role) || !username?.trim() || !name?.trim()) throw new Error('Invalid account details')
    const at = this.now()
    const normalizedRoles = normalizeRoles(roles, role)
    if (canDesign && !normalizedRoles.includes('designer')) normalizedRoles.push('designer')
    if (!normalizedRoles.length) throw new Error('Invalid account roles')
    const primaryRole = normalizedRoles[0]
    const normalized = normalizedRoles.includes('manager') ? null : normalizePermissions(permissions)
    const result = this.statements.updateAccount.run(username.trim(), name.trim(), primaryRole, String(phone || '').trim(), normalizedRoles.includes('designer') ? 1 : 0, normalized == null ? null : JSON.stringify(normalized), JSON.stringify(normalizedRoles), at, id)
    if (!result.changes) throw new Error('Account not found')
    this.record('update', 'auth_account', { accountId: id, role })
    return this.publicAccount(this.statements.accountById.get(id))
  }
  setAccountActive(id, active) {
    const at = this.now()
    this.transaction(() => {
      const result = this.statements.updateAccountStatus.run(active ? 1 : 0, at, id)
      if (!result.changes) throw new Error('Account not found')
      if (!active) this.statements.deleteAccountSessions.run(id)
      this.record(active ? 'enable' : 'disable', 'auth_account', { accountId: id })
    })
    return this.publicAccount(this.statements.accountById.get(id))
  }
  resetAccountPassword(id, password) {
    if (!(/^\d{6}$/.test(String(password || '')) || String(password || '').length >= 10)) throw new Error('Password must be 6 digits')
    const at = this.now()
    this.transaction(() => {
      const result = this.statements.updateAccountPassword.run(hashPassword(password), at, id)
      if (!result.changes) throw new Error('Account not found')
      this.statements.deleteAccountSessions.run(id)
      this.record('reset_password', 'auth_account', { accountId: id })
    })
    return true
  }
  /**
   * 员工本人修改密码：必须校验旧密码，改完保留当前会话（不被踢下线），
   * 但把该账号在其他设备上的会话全部踢掉，防止旧密码继续被使用。
   */
  changePassword(id, oldPassword, newPassword, currentTokenHash = '') {
    const row = this.statements.accountById.get(id)
    if (!row || !row.active) throw new Error('ACCOUNT_NOT_FOUND')
    if (!verifyPassword(String(oldPassword || ''), row.password_hash)) throw new Error('INVALID_CURRENT_PASSWORD')
    const next = String(newPassword || '')
    if (!(/^\d{6}$/.test(next) || next.length >= 10)) throw new Error('WEAK_PASSWORD')
    if (next.length > 200) throw new Error('WEAK_PASSWORD')
    if (verifyPassword(next, row.password_hash)) throw new Error('SAME_PASSWORD')
    const at = this.now()
    this.transaction(() => {
      const result = this.statements.updateOwnPassword.run(hashPassword(next), at, id)
      if (!result.changes) throw new Error('ACCOUNT_NOT_FOUND')
      this.statements.deleteOtherSessions.run(id, String(currentTokenHash || ''))
      this.record('change_password', 'auth_account', { accountId: id })
    })
    return true
  }
  deleteAccount(id) {
    const account = this.statements.accountById.get(id)
    if (!account) throw new Error('Account not found')
    if (account.role === 'manager' && account.active && Number(this.statements.countActiveManagers.get().count) <= 1) throw new Error('Last manager cannot be deleted')
    this.transaction(() => { this.statements.deleteAccountSessions.run(id); this.statements.deleteAccount.run(id); this.record('delete', 'auth_account', { accountId: id }) })
    return true
  }
  authenticate(username, password) {
    const row = this.statements.accountByUsername.get(String(username || '').trim())
    return row && row.active && verifyPassword(String(password || ''), row.password_hash) ? this.publicAccount(row) : null
  }
  createSession(accountId, ttlMs) {
    const token = randomBytes(32).toString('base64url'), at = this.now(), expiresAt = new Date(Date.now() + ttlMs).toISOString()
    this.statements.deleteExpiredSessions.run(at)
    this.statements.insertSession.run(tokenDigest(token), accountId, expiresAt, at, at)
    this.record('login', 'auth_session', { accountId })
    return { token, expiresAt }
  }
  getSession(token) {
    if (!token) return null
    const now = this.now()
    this.statements.deleteExpiredSessions.run(now)
    const row = this.statements.getSession.get(tokenDigest(token))
    if (!row || !row.active || row.expires_at <= now) return null
    this.statements.touchSession.run(now, row.token_hash)
    return { account: this.publicAccount(row), expiresAt: row.expires_at }
  }
  revokeSession(token) {
    if (!token) return false
    const digest = tokenDigest(token), row = this.statements.getSession.get(digest)
    const result = this.statements.deleteSession.run(digest)
    if (result.changes) this.record('logout', 'auth_session', { accountId: row?.id })
    return Boolean(result.changes)
  }
  backup() { return { version: 1, createdAt: this.now(), state: this.getState().value, members: this.getMembers(), integrations: this.getIntegrations() } }
  restore(data) {
    const at = this.now()
    this.transaction(() => {
      this.statements.putState.run(JSON.stringify(data.state), at)
      this.statements.deleteMembers.run()
      for (const item of data.members) this.statements.putMember.run(item.id, JSON.stringify(item), at)
      this.statements.deleteIntegrations.run()
      for (const [name, value] of Object.entries(data.integrations)) this.statements.putIntegration.run(name, JSON.stringify(value), at)
      this.record('restore', 'backup', { version: data.version })
    })
    return this.backup()
  }
  close() { this.db.close() }
}
