import { createServer } from 'node:http'

const JSON_TYPE = { 'content-type': 'application/json; charset=utf-8' }
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const SESSION_COOKIE = 'sales_session'

function parseCookies(header = '') {
  return Object.fromEntries(header.split(';').map(part => part.trim()).filter(Boolean).map(part => {
    const index = part.indexOf('=')
    return index < 0 ? [part, ''] : [part.slice(0, index), decodeURIComponent(part.slice(index + 1))]
  }))
}

export class ApiError extends Error {
  constructor(status, code, message, details) { super(message); this.status = status; this.code = code; this.details = details }
}

function validateMembers(value) {
  const items = Array.isArray(value) ? value : value?.members
  if (!Array.isArray(items)) throw new ApiError(400, 'VALIDATION_ERROR', 'members must be an array')
  const ids = new Set()
  for (const [index, item] of items.entries()) {
    if (!isObject(item) || typeof item.id !== 'string' || !item.id.trim()) throw new ApiError(400, 'VALIDATION_ERROR', `members[${index}].id must be a non-empty string`)
    if (ids.has(item.id)) throw new ApiError(400, 'VALIDATION_ERROR', `duplicate member id: ${item.id}`)
    ids.add(item.id)
  }
  return items
}

function validateIntegrations(value) {
  const settings = isObject(value?.integrations) ? value.integrations : value
  if (!isObject(settings)) throw new ApiError(400, 'VALIDATION_ERROR', 'integrations must be an object')
  for (const name of Object.keys(settings)) if (!name.trim()) throw new ApiError(400, 'VALIDATION_ERROR', 'integration names must be non-empty')
  return settings
}

function publicIntegrations(settings) {
  return Object.fromEntries(Object.entries(settings).map(([name, value]) => {
    if (!isObject(value) || !Object.prototype.hasOwnProperty.call(value, 'secret')) return [name, value]
    const { secret: _secret, ...publicValue } = value
    return [name, { ...publicValue, secretConfigured: Boolean(_secret) }]
  }))
}

function mergeIntegrationSecrets(current, incoming) {
  return Object.fromEntries(Object.entries(incoming).map(([name, value]) => {
    const previous = current[name]
    if (isObject(value) && isObject(previous) && !Object.prototype.hasOwnProperty.call(value, 'secret') && Object.prototype.hasOwnProperty.call(previous, 'secret')) {
      return [name, { ...value, secret: previous.secret }]
    }
    return [name, value]
  }))
}

function validateBackup(value) {
  if (!isObject(value) || value.version !== 1 || !isObject(value.state) || !isObject(value.integrations)) throw new ApiError(400, 'VALIDATION_ERROR', 'invalid version 1 backup')
  return { version: 1, state: value.state, members: validateMembers(value.members), integrations: validateIntegrations(value.integrations) }
}

async function readJson(req, maxBodyBytes) {
  const contentType = req.headers['content-type'] || ''
  if (!contentType.toLowerCase().startsWith('application/json')) throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be application/json')
  let size = 0; const chunks = []
  for await (const chunk of req) {
    size += chunk.length
    if (size > maxBodyBytes) throw new ApiError(413, 'PAYLOAD_TOO_LARGE', `request body exceeds ${maxBodyBytes} bytes`)
    chunks.push(chunk)
  }
  if (!size) throw new ApiError(400, 'INVALID_JSON', 'request body is required')
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) }
  catch { throw new ApiError(400, 'INVALID_JSON', 'request body is not valid JSON') }
}

export function createApiServer({ database, maxBodyBytes = 1_048_576, corsOrigin = '*', sessionTtlMs = 8 * 60 * 60 * 1000, secureCookies = false, loginLimit = 5, loginWindowMs = 15 * 60 * 1000 }) {
  const loginAttempts = new Map()
  return createServer(async (req, res) => {
    const requestOrigin = req.headers.origin
    const allowOrigin = corsOrigin === '*' ? '*' : corsOrigin
    const headers = { ...JSON_TYPE, 'access-control-allow-origin': allowOrigin, 'access-control-allow-methods': 'GET, PUT, POST, PATCH, OPTIONS', 'access-control-allow-headers': 'Content-Type', ...(allowOrigin === '*' ? {} : { 'access-control-allow-credentials': 'true', vary: 'Origin' }) }
    const send = (status, body, extra = {}) => { res.writeHead(status, { ...headers, ...extra }); res.end(body === undefined ? undefined : JSON.stringify(body)) }
    const cookie = (value, maxAge) => `${SESSION_COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=${secureCookies ? 'None' : 'Lax'}; Max-Age=${maxAge}${secureCookies ? '; Secure' : ''}`
    const unsafe = !['GET', 'HEAD', 'OPTIONS'].includes(req.method)
    const crossSite = req.headers['sec-fetch-site'] === 'cross-site'
    if (requestOrigin && corsOrigin !== '*' && requestOrigin !== corsOrigin) return send(403, { error: { code: 'ORIGIN_FORBIDDEN', message: 'Request origin is not allowed' } })
    if (unsafe && corsOrigin !== '*' && !requestOrigin) return send(403, { error: { code: 'ORIGIN_REQUIRED', message: 'Request origin is required' } })
    if (unsafe && corsOrigin === '*' && crossSite) return send(403, { error: { code: 'ORIGIN_FORBIDDEN', message: 'Request origin is not allowed' } })
    if (req.method === 'OPTIONS') return send(204)
    try {
      const url = new URL(req.url, 'http://localhost')
      if (req.method === 'GET' && url.pathname === '/api/health') return send(200, { ok: true, service: 'sales-data', timestamp: new Date().toISOString() })
      if (req.method === 'POST' && url.pathname === '/api/auth/login') {
        const address = req.socket.remoteAddress || 'unknown', now = Date.now()
        const recent = (loginAttempts.get(address) || []).filter(at => now - at < loginWindowMs)
        if (recent.length >= loginLimit) throw new ApiError(429, 'LOGIN_RATE_LIMITED', 'Too many login attempts; try again later')
        const body = await readJson(req, maxBodyBytes)
        const account = database.authenticate(body?.username, body?.password)
        if (!account) {
          recent.push(now); loginAttempts.set(address, recent)
          database.record('login_failed', 'auth_session', { address })
          throw new ApiError(401, 'INVALID_CREDENTIALS', 'Username or password is incorrect')
        }
        loginAttempts.delete(address)
        const session = database.createSession(account.id, sessionTtlMs)
        return send(200, { user: account, expiresAt: session.expiresAt }, { 'set-cookie': cookie(session.token, Math.floor(sessionTtlMs / 1000)) })
      }
      const sessionToken = parseCookies(req.headers.cookie)[SESSION_COOKIE]
      const session = database.getSession(sessionToken)
      if (req.method === 'POST' && url.pathname === '/api/auth/logout') {
        database.revokeSession(sessionToken)
        return send(204, undefined, { 'set-cookie': cookie('', 0) })
      }
      if (!session) throw new ApiError(401, 'AUTH_REQUIRED', 'Authentication is required')
      if (req.method === 'GET' && url.pathname === '/api/auth/me') return send(200, { user: session.account, expiresAt: session.expiresAt })
      const requireManager = () => { if (session.account.role !== 'manager') throw new ApiError(403, 'FORBIDDEN', 'Manager permission is required') }
      if (req.method === 'GET' && url.pathname === '/api/accounts') { requireManager(); return send(200, { accounts: database.listAccounts() }) }
      if (req.method === 'GET' && url.pathname === '/api/designers') return send(200, { designers: database.listAccounts().filter(item => (item.role === 'designer' || item.canDesign) && item.active) })
      if (req.method === 'GET' && url.pathname === '/api/salespeople') return send(200, { salespeople: database.listAccounts().filter(item => item.role === 'sales' && item.active) })
      if (req.method === 'GET' && url.pathname === '/api/delivery-staff') return send(200, { deliveryStaff: database.listAccounts().filter(item => item.role === 'aftersales' && item.active) })
      if (req.method === 'POST' && url.pathname === '/api/accounts') {
        requireManager()
        try { return send(201, { account: database.createAccount(await readJson(req, maxBodyBytes)) }) }
        catch (error) { throw new ApiError(String(error?.message).includes('UNIQUE') ? 409 : 400, 'ACCOUNT_INVALID', 'Account details are invalid or already used') }
      }
      const statusMatch = url.pathname.match(/^\/api\/accounts\/([^/]+)\/status$/)
      if (req.method === 'PATCH' && statusMatch) { requireManager(); const body = await readJson(req, maxBodyBytes); return send(200, { account: database.setAccountActive(decodeURIComponent(statusMatch[1]), Boolean(body.active)) }) }
      const accountMatch = url.pathname.match(/^\/api\/accounts\/([^/]+)$/)
      if (req.method === 'PATCH' && accountMatch) { requireManager(); try { return send(200, { account: database.updateAccount(decodeURIComponent(accountMatch[1]), await readJson(req, maxBodyBytes)) }) } catch (error) { throw new ApiError(String(error?.message).includes('UNIQUE') ? 409 : 400, 'ACCOUNT_INVALID', 'Account details are invalid or already used') } }
      if (req.method === 'DELETE' && accountMatch) { requireManager(); if (decodeURIComponent(accountMatch[1]) === session.account.id) throw new ApiError(400, 'ACCOUNT_INVALID', 'You cannot delete the account currently in use'); try { database.deleteAccount(decodeURIComponent(accountMatch[1])); return send(204) } catch { throw new ApiError(400, 'ACCOUNT_INVALID', 'This account cannot be deleted') } }
      const resetMatch = url.pathname.match(/^\/api\/accounts\/([^/]+)\/reset-password$/)
      if (req.method === 'POST' && resetMatch) { requireManager(); const body = await readJson(req, maxBodyBytes); database.resetAccountPassword(decodeURIComponent(resetMatch[1]), body.password); return send(200, { ok: true }) }
      if (req.method === 'GET' && url.pathname === '/api/state') return send(200, database.getState())
      if (req.method === 'PUT' && url.pathname === '/api/state') { const body = await readJson(req, maxBodyBytes); if (!isObject(body)) throw new ApiError(400, 'VALIDATION_ERROR', 'state must be an object'); return send(200, database.setState(body)) }
      if (req.method === 'GET' && url.pathname === '/api/audit') {
        requireManager()
        const limit = Number(url.searchParams.get('limit') ?? 50), offset = Number(url.searchParams.get('offset') ?? 0)
        if (!Number.isInteger(limit) || limit < 1 || limit > 200 || !Number.isInteger(offset) || offset < 0) throw new ApiError(400, 'VALIDATION_ERROR', 'limit must be 1..200 and offset must be non-negative')
        return send(200, database.getAudit(limit, offset))
      }
      if (req.method === 'GET' && url.pathname === '/api/backup') { requireManager(); const backup = database.backup(); return send(200, { ...backup, integrations: publicIntegrations(backup.integrations) }, { 'content-disposition': 'attachment; filename="sales-backup.json"' }) }
      if (req.method === 'POST' && url.pathname === '/api/restore') { requireManager(); return send(200, database.restore(validateBackup(await readJson(req, maxBodyBytes)))) }
      if (req.method === 'GET' && url.pathname === '/api/members') return send(200, { members: database.getMembers() })
      if (req.method === 'PUT' && url.pathname === '/api/members') { requireManager(); return send(200, { members: database.setMembers(validateMembers(await readJson(req, maxBodyBytes))) }) }
      if (req.method === 'GET' && url.pathname === '/api/integrations') { requireManager(); return send(200, { integrations: publicIntegrations(database.getIntegrations()) }) }
      if (req.method === 'PUT' && url.pathname === '/api/integrations') { requireManager(); const incoming = validateIntegrations(await readJson(req, maxBodyBytes)); const saved = database.setIntegrations(mergeIntegrationSecrets(database.getIntegrations(), incoming)); return send(200, { integrations: publicIntegrations(saved) }) }
      throw new ApiError(404, 'NOT_FOUND', 'API route not found')
    } catch (error) {
      const known = error instanceof ApiError
      if (!known) console.error(error)
      send(known ? error.status : 500, { error: { code: known ? error.code : 'INTERNAL_ERROR', message: known ? error.message : 'Internal server error', ...(known && error.details ? { details: error.details } : {}) } })
    }
  })
}
